/*
Developer Summary:
Compact invasion history for owned and child rooms.

Purpose:
- Store one compact record per hostile threat window
- Keep memory bounded by room
- Provide readable ops console output without truncating fields
*/

const DEFAULT_PER_ROOM_CAP = 20;
const DEFAULT_WIDTH = 85;
const DEFAULT_REMOTE_STALE_TTL = 25;

function getMemory() {
  if (!Memory.empire) Memory.empire = {};
  if (!Memory.empire.invasionLog) Memory.empire.invasionLog = {};
  if (!Memory.empire.invasionLog.rooms) Memory.empire.invasionLog.rooms = {};
  return Memory.empire.invasionLog;
}

function getRoomLog(roomName) {
  const memory = getMemory();
  if (!memory.rooms[roomName]) {
    memory.rooms[roomName] = {
      active: null,
      entries: [],
    };
  }
  if (!memory.rooms[roomName].entries) memory.rooms[roomName].entries = [];
  return memory.rooms[roomName];
}

function getOwnerName(hostile) {
  return hostile && hostile.owner && hostile.owner.username
    ? hostile.owner.username
    : "unknown";
}

function getOwners(threat) {
  const seen = {};
  const owners = [];
  const hostiles = threat && threat.hostiles ? threat.hostiles : [];

  for (let i = 0; i < hostiles.length; i++) {
    const owner = getOwnerName(hostiles[i]);
    if (seen[owner]) continue;
    seen[owner] = true;
    owners.push(owner);
  }

  owners.sort();
  return owners;
}

function getThreatHostileCount(threat) {
  if (!threat) return 0;
  if (typeof threat.hostileCount === "number") return threat.hostileCount;
  return threat.hostiles ? threat.hostiles.length : 0;
}

function createEntry(roomName, scope, threat, status) {
  const owners = getOwners(threat);
  return {
    r: roomName,
    sc: scope || (threat && threat.scope) || "home",
    s: Game.time,
    e: null,
    l: Game.time,
    st: status || "open",
    h: getThreatHostileCount(threat),
    ms: threat ? threat.threatScore || 0 : 0,
    ml: threat ? threat.threatLevel || 0 : 0,
    o: owners.length > 0 ? owners : ["unknown"],
    m: threat ? threat.responseMode || "idle" : "idle",
    b: threat ? threat.breachSeverity || "clear" : "clear",
    tw: threat && threat.towerCanHandle ? "held" : "unhandled",
    d: threat ? threat.desiredDefenders || 0 : 0,
    t: threat ? threat.towerTargetSummary || threat.classification || "none" : "none",
  };
}

function updateEntry(entry, threat) {
  const owners = getOwners(threat);
  entry.l = Game.time;
  entry.h = Math.max(entry.h || 0, getThreatHostileCount(threat));
  entry.ms = Math.max(entry.ms || 0, threat ? threat.threatScore || 0 : 0);
  entry.ml = Math.max(entry.ml || 0, threat ? threat.threatLevel || 0 : 0);
  entry.d = Math.max(entry.d || 0, threat ? threat.desiredDefenders || 0 : 0);
  entry.m = threat && threat.responseMode ? threat.responseMode : entry.m;
  entry.b = threat && threat.breachSeverity ? threat.breachSeverity : entry.b;
  if (threat && threat.towerCanHandle === false) {
    entry.tw = "unhandled";
  } else if (threat && threat.towerCanHandle && entry.tw !== "unhandled") {
    entry.tw = "held";
  }
  entry.t = threat && (threat.towerTargetSummary || threat.classification)
    ? threat.towerTargetSummary || threat.classification
    : entry.t;

  for (let i = 0; i < owners.length; i++) {
    if (entry.o.indexOf(owners[i]) === -1) entry.o.push(owners[i]);
  }
  entry.o.sort();
}

function pruneEntries(roomLog) {
  const cap = module.exports.getPerRoomCap();
  while (roomLog.entries.length > cap) {
    roomLog.entries.shift();
  }
}

module.exports = {
  getPerRoomCap() {
    return DEFAULT_PER_ROOM_CAP;
  },

  recordOwned(room, state) {
    if (!room || !state || !state.defense) return null;
    const threat = state.defense.homeThreat || null;
    if (threat && threat.active) {
      return this.recordThreat(room.name, "home", threat);
    }
    return this.closeRoom(room.name, "cleared", "home");
  },

  recordRemote(roomName, scope, threat) {
    if (!roomName) return null;
    if (threat && threat.active !== false) {
      return this.recordThreat(roomName, scope || (threat.scope || "remote"), threat);
    }
    return this.closeRoom(roomName, "cleared", scope || "remote");
  },

  recordThreat(roomName, scope, threat) {
    const roomLog = getRoomLog(roomName);
    if (!roomLog.active) {
      roomLog.active = createEntry(roomName, scope, threat, "open");
    } else {
      roomLog.active.sc = scope || roomLog.active.sc;
      updateEntry(roomLog.active, threat);
    }
    return roomLog.active;
  },

  closeRoom(roomName, status, scope) {
    const memory = getMemory();
    const roomLog = memory.rooms[roomName];
    if (!roomLog) return null;
    const active = roomLog.active;
    if (!active) return null;
    if (scope && active.sc !== scope) return null;

    active.e = Game.time;
    active.l = Game.time;
    active.st = status || "cleared";
    roomLog.entries.push(active);
    roomLog.active = null;
    pruneEntries(roomLog);
    return active;
  },

  closeStaleRemotes(ttl) {
    const memory = getMemory();
    if (memory.staleCheckedAt === Game.time) return;
    memory.staleCheckedAt = Game.time;
    const limit = typeof ttl === "number" ? ttl : DEFAULT_REMOTE_STALE_TTL;
    for (const roomName in memory.rooms) {
      if (!Object.prototype.hasOwnProperty.call(memory.rooms, roomName)) continue;
      const roomLog = memory.rooms[roomName];
      const active = roomLog.active;
      if (!active || active.sc === "home") continue;
      if (Game.time - (active.l || active.s || Game.time) <= limit) continue;
      this.closeRoom(roomName, "stale", active.sc);
    }
  },

  clear(roomName) {
    const memory = getMemory();
    if (!roomName || roomName === "all") {
      const result = this.getStats();
      memory.rooms = {};
      return {
        ok: true,
        clearedRooms: result.rooms,
        clearedEntries: result.stored,
      };
    }

    const roomLog = memory.rooms[roomName];
    const clearedEntries = roomLog
      ? (roomLog.entries ? roomLog.entries.length : 0) + (roomLog.active ? 1 : 0)
      : 0;
    if (roomLog) delete memory.rooms[roomName];
    return {
      ok: true,
      clearedRooms: roomLog ? 1 : 0,
      clearedEntries: clearedEntries,
    };
  },

  getEntries(roomName) {
    const memory = getMemory();
    const result = [];
    for (const name in memory.rooms) {
      if (!Object.prototype.hasOwnProperty.call(memory.rooms, name)) continue;
      if (roomName && name !== roomName) continue;
      const roomLog = memory.rooms[name];
      if (roomLog.entries) {
        for (let i = 0; i < roomLog.entries.length; i++) {
          result.push(roomLog.entries[i]);
        }
      }
      if (roomLog.active) result.push(roomLog.active);
    }
    result.sort(function (a, b) {
      return (b.l || b.s || 0) - (a.l || a.s || 0);
    });
    return result;
  },

  getStats() {
    const memory = getMemory();
    let rooms = 0;
    let stored = 0;
    for (const roomName in memory.rooms) {
      if (!Object.prototype.hasOwnProperty.call(memory.rooms, roomName)) continue;
      const roomLog = memory.rooms[roomName];
      const roomStored = (roomLog.entries ? roomLog.entries.length : 0) + (roomLog.active ? 1 : 0);
      if (roomStored <= 0) continue;
      rooms++;
      stored += roomStored;
    }
    return {
      rooms: rooms,
      stored: stored,
    };
  },

  formatLines(roomName, limit, width) {
    const stats = this.getStats();
    const entryLimit = typeof limit === "number" && limit > 0 ? Math.floor(limit) : 20;
    const entries = this.getEntries(roomName).slice(0, entryLimit);
    const lines = [
      `[OPS][INVASIONS] stored ${stats.stored} | rooms ${stats.rooms} | cap ${this.getPerRoomCap()}/room`,
    ];

    if (entries.length <= 0) {
      lines.push(roomName ? `No invasion log entries for ${roomName}` : "No invasion log entries");
      return lines;
    }

    for (let i = 0; i < entries.length; i++) {
      const entryLines = this.formatEntryLines(entries[i], width || DEFAULT_WIDTH);
      for (let j = 0; j < entryLines.length; j++) lines.push(entryLines[j]);
    }

    return lines;
  },

  formatEntryLines(entry, width) {
    const endLabel = entry.e === null || typeof entry.e === "undefined" ? "open" : entry.e;
    const durationEnd = entry.e || entry.l || Game.time;
    const duration = Math.max(0, durationEnd - (entry.s || durationEnd));
    const first =
      `${entry.r} ${entry.s}-${endLabel} ${duration}t | ${entry.sc} | ` +
      `max H${entry.h || 0} S${entry.ms || 0} L${entry.ml || 0} | owners ${(entry.o || ["unknown"]).join(",")}`;
    const second =
      `mode ${entry.m || "idle"} | breach ${entry.b || "clear"} | def ${entry.d || 0} | ` +
      `target ${entry.t || "none"} | ${entry.st || "cleared"} | tower ${entry.tw || "unknown"}`;
    return this.wrapLine(first, width).concat(this.wrapLine(second, width));
  },

  wrapLine(line, width) {
    const limit = width || DEFAULT_WIDTH;
    if (String(line).length <= limit) return [String(line)];

    const words = String(line).split(" ");
    const lines = [];
    let current = "";
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const candidate = current ? current + " " + word : word;
      if (candidate.length > limit && current) {
        lines.push(current);
        current = "  " + word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  },
};
