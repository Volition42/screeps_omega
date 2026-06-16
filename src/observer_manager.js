/*
Developer Summary:
Observer Scan Scheduler

Purpose:
- Give built observers a bounded intelligence-gathering role in mature rooms
- Maintain compact, capped room intel without raw room snapshots
- Avoid remote selection, expansion decisions, combat planning, or map-wide scans

Important Notes:
- Runs only for owned RCL8+ rooms with observers.
- Schedules at most one observeRoom attempt per eligible room interval.
- Target sources are bounded: configured targets, configured reservations, and
  direct adjacent rooms only.
*/

const config = require("config");
const reservationManager = require("reservation_manager");

const IMPORTANT_STRUCTURES = [
  STRUCTURE_TOWER,
  STRUCTURE_SPAWN,
  STRUCTURE_TERMINAL,
  STRUCTURE_STORAGE,
  STRUCTURE_POWER_SPAWN,
  STRUCTURE_OBSERVER,
  STRUCTURE_NUKER,
];

function getSettings() {
  const settings = config.OBSERVER || {};

  return {
    enabled: settings.ENABLED !== false,
    minRcl: typeof settings.MIN_RCL === "number" ? settings.MIN_RCL : 8,
    runInterval:
      typeof settings.RUN_INTERVAL === "number"
        ? Math.max(1, settings.RUN_INTERVAL)
        : 10,
    maxTargetsPerRoom:
      typeof settings.MAX_TARGETS_PER_ROOM === "number"
        ? Math.max(1, settings.MAX_TARGETS_PER_ROOM)
        : 20,
    intelMaxAge:
      typeof settings.INTEL_MAX_AGE === "number"
        ? Math.max(100, settings.INTEL_MAX_AGE)
        : 50000,
    includeAdjacentRooms: settings.INCLUDE_ADJACENT_ROOMS !== false,
    includeRemoteRooms: settings.INCLUDE_REMOTE_ROOMS !== false,
    targets: settings.TARGETS || {},
  };
}

function ensureMemory() {
  if (!Memory.intel) Memory.intel = {};
  if (!Memory.intel.rooms) Memory.intel.rooms = {};
  if (!Memory.observer) Memory.observer = {};
  if (!Memory.observer.rooms) Memory.observer.rooms = {};
  if (!Memory.observer.observedTargets) Memory.observer.observedTargets = {};

  return Memory.observer;
}

function getRoomMemory(roomName) {
  const memory = ensureMemory();
  if (!memory.rooms[roomName]) {
    memory.rooms[roomName] = {
      queue: [],
      cursor: 0,
      lastRun: null,
      lastObservedTarget: null,
      lastResult: null,
      lastReason: "not_run",
    };
  }

  if (!Array.isArray(memory.rooms[roomName].queue)) memory.rooms[roomName].queue = [];
  if (typeof memory.rooms[roomName].cursor !== "number") memory.rooms[roomName].cursor = 0;

  return memory.rooms[roomName];
}

function normalizeRoomName(roomName) {
  if (!roomName) return null;

  const normalized = String(roomName).trim();
  return normalized.length > 0 ? normalized : null;
}

function addUnique(targets, roomName, homeRoomName) {
  const normalized = normalizeRoomName(roomName);
  if (!normalized || normalized === homeRoomName) return;
  if (targets.indexOf(normalized) === -1) targets.push(normalized);
}

function parseRoomName(roomName) {
  const match = /^([WE])(\d+)([NS])(\d+)$/.exec(roomName || "");
  if (!match) return null;

  return {
    horizontal: match[1],
    x: parseInt(match[2], 10),
    vertical: match[3],
    y: parseInt(match[4], 10),
  };
}

function shiftAxis(direction, value, delta) {
  if (delta === 0) return { direction: direction, value: value };

  let coordinate = direction === "W" ? -value - 1 : value;
  coordinate += delta;

  if (coordinate < 0) {
    return { direction: "W", value: -coordinate - 1 };
  }

  return { direction: "E", value: coordinate };
}

function shiftNorthSouth(direction, value, delta) {
  if (delta === 0) return { direction: direction, value: value };

  let coordinate = direction === "N" ? -value - 1 : value;
  coordinate += delta;

  if (coordinate < 0) {
    return { direction: "N", value: -coordinate - 1 };
  }

  return { direction: "S", value: coordinate };
}

function getAdjacentRooms(roomName) {
  if (Game.map && typeof Game.map.describeExits === "function") {
    const exits = Game.map.describeExits(roomName) || {};
    return Object.keys(exits)
      .map(function (key) {
        return exits[key];
      })
      .filter(function (name) {
        return !!name;
      })
      .sort();
  }

  const parsed = parseRoomName(roomName);
  if (!parsed) return [];

  const result = [];
  const deltas = [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ];

  for (let i = 0; i < deltas.length; i++) {
    const x = shiftAxis(parsed.horizontal, parsed.x, deltas[i][0]);
    const y = shiftNorthSouth(parsed.vertical, parsed.y, deltas[i][1]);
    result.push(`${x.direction}${x.value}${y.direction}${y.value}`);
  }

  return result.sort();
}

function getRemoteTargets(roomName) {
  const targets = [];
  if (
    !reservationManager ||
    typeof reservationManager.getActiveReservations !== "function"
  ) {
    return targets;
  }

  const reservations = reservationManager.getActiveReservations();
  for (let i = 0; i < reservations.length; i++) {
    const plan = reservations[i];
    if (!plan || plan.parentRoom !== roomName || !plan.targetRoom) continue;
    addUnique(targets, plan.targetRoom, roomName);
  }

  return targets.sort();
}

function buildTargetQueue(roomName, settings) {
  const targets = [];
  const configured = settings.targets && settings.targets[roomName]
    ? settings.targets[roomName]
    : [];

  if (Array.isArray(configured)) {
    for (let i = 0; i < configured.length; i++) {
      addUnique(targets, configured[i], roomName);
    }
  }

  if (settings.includeRemoteRooms) {
    const remotes = getRemoteTargets(roomName);
    for (let i = 0; i < remotes.length; i++) {
      addUnique(targets, remotes[i], roomName);
    }
  }

  if (settings.includeAdjacentRooms) {
    const adjacent = getAdjacentRooms(roomName);
    for (let i = 0; i < adjacent.length; i++) {
      addUnique(targets, adjacent[i], roomName);
    }
  }

  return targets.slice(0, settings.maxTargetsPerRoom);
}

function summarizeController(controller) {
  if (!controller) return null;

  const summary = {
    level: controller.level || 0,
  };

  if (controller.owner && controller.owner.username) {
    summary.owner = controller.owner.username;
  }

  if (controller.reservation) {
    summary.reservation = {
      username: controller.reservation.username || null,
      ticksToEnd: controller.reservation.ticksToEnd || 0,
    };
  }

  return summary;
}

function countImportantStructures(room) {
  const counts = {};
  for (let i = 0; i < IMPORTANT_STRUCTURES.length; i++) {
    counts[IMPORTANT_STRUCTURES[i]] = 0;
  }

  const structures = room.find(FIND_STRUCTURES);
  for (let i = 0; i < structures.length; i++) {
    const structureType = structures[i].structureType;
    if (counts[structureType] === undefined) continue;
    counts[structureType]++;
  }

  return counts;
}

module.exports = {
  getSettings: getSettings,

  run(room, state) {
    const settings = getSettings();
    const status = this.getStatus(room);

    if (!settings.enabled) {
      status.lastResult = "disabled";
      status.lastReason = "disabled";
      return status;
    }
    if (!room || !room.controller || !room.controller.my) {
      status.lastResult = "skipped";
      status.lastReason = "not_owned";
      return status;
    }
    if (room.controller.level < settings.minRcl) {
      status.lastResult = "skipped";
      status.lastReason = "rcl";
      return status;
    }

    const structuresByType = state && state.structuresByType ? state.structuresByType : {};
    const observers = structuresByType[STRUCTURE_OBSERVER] || [];
    status.observerCount = observers.length;
    if (observers.length <= 0) {
      status.lastResult = "skipped";
      status.lastReason = "no_observer";
      return status;
    }

    this.recordVisibleIntel(room.name);
    this.cleanupIntel(settings);

    const memory = getRoomMemory(room.name);
    if (memory.lastRun && Game.time - memory.lastRun < settings.runInterval) {
      memory.lastResult = "skipped";
      memory.lastReason = "interval";
      return this.getStatus(room);
    }

    const queue = buildTargetQueue(room.name, settings);
    memory.queue = queue;
    if (memory.cursor >= queue.length) memory.cursor = 0;

    if (queue.length === 0) {
      memory.lastRun = Game.time;
      memory.lastResult = "skipped";
      memory.lastReason = "empty_queue";
      return this.getStatus(room);
    }

    const target = queue[memory.cursor];
    memory.cursor = (memory.cursor + 1) % queue.length;
    memory.lastRun = Game.time;

    const result = observers[0].observeRoom(target);
    memory.lastObservedTarget = target;
    memory.lastResult = result === OK ? "ok" : "error";
    memory.lastReason = result === OK ? "observed" : `observe_${result}`;

    ensureMemory().observedTargets[target] = {
      observerRoom: room.name,
      requestedAt: Game.time,
    };

    return this.getStatus(room);
  },

  recordVisibleIntel(observerRoomName) {
    ensureMemory();

    for (const roomName in Memory.observer.observedTargets) {
      if (!Object.prototype.hasOwnProperty.call(Memory.observer.observedTargets, roomName)) {
        continue;
      }

      const observed = Memory.observer.observedTargets[roomName];
      if (!observed || observed.observerRoom !== observerRoomName) continue;

      const room = Game.rooms[roomName];
      if (!room) continue;

      Memory.intel.rooms[roomName] = {
        roomName: roomName,
        observerRoom: observerRoomName,
        lastObserved: Game.time,
        controller: summarizeController(room.controller),
        hostileCount: room.find(FIND_HOSTILE_CREEPS).length,
        sourceCount: room.find(FIND_SOURCES).length,
        mineralType:
          room.find(FIND_MINERALS)[0] && room.find(FIND_MINERALS)[0].mineralType
            ? room.find(FIND_MINERALS)[0].mineralType
            : null,
        structures: countImportantStructures(room),
      };

      delete Memory.observer.observedTargets[roomName];
    }
  },

  cleanupIntel(settings) {
    const activeSettings = settings || getSettings();
    const memory = ensureMemory();
    if (
      memory.lastCleanup &&
      Game.time - memory.lastCleanup < Math.max(100, activeSettings.runInterval * 10)
    ) {
      return 0;
    }

    memory.lastCleanup = Game.time;
    let removed = 0;

    for (const roomName in Memory.intel.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Memory.intel.rooms, roomName)) continue;
      const intel = Memory.intel.rooms[roomName];
      if (!intel || typeof intel.lastObserved !== "number") {
        delete Memory.intel.rooms[roomName];
        removed++;
        continue;
      }
      if (Game.time - intel.lastObserved > activeSettings.intelMaxAge) {
        delete Memory.intel.rooms[roomName];
        removed++;
      }
    }

    return removed;
  },

  getStatus(room) {
    const settings = getSettings();
    ensureMemory();

    const roomName = room && room.name ? room.name : null;
    const memory = roomName ? getRoomMemory(roomName) : {};
    const intelRooms = Memory.intel && Memory.intel.rooms ? Memory.intel.rooms : {};
    const intelNames = Object.keys(intelRooms);
    let newestAge = null;
    let oldestAge = null;

    for (let i = 0; i < intelNames.length; i++) {
      const intel = intelRooms[intelNames[i]];
      if (!intel || typeof intel.lastObserved !== "number") continue;
      if (roomName && intel.observerRoom !== roomName) continue;

      const age = Math.max(0, Game.time - intel.lastObserved);
      newestAge = newestAge === null ? age : Math.min(newestAge, age);
      oldestAge = oldestAge === null ? age : Math.max(oldestAge, age);
    }

    const structuresByType =
      room && room.find
        ? room.find(FIND_MY_STRUCTURES).reduce(function (acc, structure) {
            if (!acc[structure.structureType]) acc[structure.structureType] = [];
            acc[structure.structureType].push(structure);
            return acc;
          }, {})
        : {};
    const observers = structuresByType[STRUCTURE_OBSERVER] || [];
    const queue = Array.isArray(memory.queue) ? memory.queue : [];

    return {
      enabled: settings.enabled,
      observerCount: observers.length,
      lastObservedTarget: memory.lastObservedTarget || null,
      queuedTargets: queue.length,
      targets: queue.slice(0, settings.maxTargetsPerRoom),
      intelCount: intelNames.filter(function (name) {
        return !roomName || intelRooms[name].observerRoom === roomName;
      }).length,
      oldestIntelAge: oldestAge,
      newestIntelAge: newestAge,
      lastResult: memory.lastResult || "none",
      lastReason: memory.lastReason || "not_run",
      lastRun: memory.lastRun || null,
      runInterval: settings.runInterval,
      maxTargetsPerRoom: settings.maxTargetsPerRoom,
    };
  },
};
