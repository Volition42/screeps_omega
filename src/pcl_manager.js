/*
Developer Summary:
PCL / Power Creep Readiness Manager

Purpose:
- Provide read-only GPL/PCL and friendly Power Creep visibility
- Evaluate room readiness for manual Power Creep room enablement
- Keep Power Creep preparation operator-driven and non-executing

Important Notes:
- Does not spawn, renew, move, or operate Power Creeps
- Does not call controller.enableRoom()
- Does not write Memory
*/

const config = require("config");
const powerManager = require("power_manager");

const ENABLEMENT = {
  READY_TO_ENABLE: "READY_TO_ENABLE",
  BLOCKED_NOT_OWNED: "BLOCKED_NOT_OWNED",
  BLOCKED_RCL: "BLOCKED_RCL",
  BLOCKED_NO_POWER_SPAWN: "BLOCKED_NO_POWER_SPAWN",
  BLOCKED_NO_STORAGE: "BLOCKED_NO_STORAGE",
  BLOCKED_THREAT: "BLOCKED_THREAT",
  BLOCKED_CPU_PRESSURE: "BLOCKED_CPU_PRESSURE",
  BLOCKED_POWER_PROCESSING_UNHEALTHY: "BLOCKED_POWER_PROCESSING_UNHEALTHY",
};

function fmt(value) {
  return Math.round(value || 0).toLocaleString();
}

function pct(progress, total) {
  if (!total || total <= 0) return "0.0%";
  return `${Math.min(100, Math.max(0, (progress / total) * 100)).toFixed(1)}%`;
}

function getStoreAmount(target, resourceType) {
  if (!target || !target.store) return 0;
  if (typeof target.store.getUsedCapacity === "function") {
    const used = target.store.getUsedCapacity(resourceType);
    if (typeof used === "number") return used;
  }
  return target.store[resourceType] || 0;
}

function getRoomPowerMemory(roomName) {
  return Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].power
    ? Memory.rooms[roomName].power
    : {};
}

function getOwnedPowerSpawns(room) {
  if (!room || typeof room.find !== "function") return [];
  return room.find(FIND_MY_STRUCTURES, {
    filter(structure) {
      return structure.structureType === STRUCTURE_POWER_SPAWN;
    },
  });
}

function getPowerCreepRows() {
  const powerCreeps = Game.powerCreeps || {};
  return Object.keys(powerCreeps)
    .sort()
    .map(function (name) {
      const powerCreep = powerCreeps[name];
      const spawned = !!(
        powerCreep &&
        (powerCreep.ticksToLive || powerCreep.room || powerCreep.pos)
      );
      const powers = powerCreep && powerCreep.powers ? Object.keys(powerCreep.powers).sort() : [];
      const roomName =
        powerCreep && powerCreep.room
          ? powerCreep.room.name
          : powerCreep && powerCreep.pos
            ? powerCreep.pos.roomName
            : null;
      const shardName =
        powerCreep && powerCreep.shard
          ? powerCreep.shard.name || powerCreep.shard
          : null;

      return {
        name: powerCreep && powerCreep.name ? powerCreep.name : name,
        className: powerCreep && powerCreep.className ? powerCreep.className : "unknown",
        level: powerCreep && typeof powerCreep.level === "number" ? powerCreep.level : 0,
        ticksToLive:
          powerCreep && typeof powerCreep.ticksToLive === "number"
            ? powerCreep.ticksToLive
            : null,
        shard: shardName,
        roomName: roomName,
        powers: powers,
        ops: getStoreAmount(powerCreep, RESOURCE_OPS),
        spawned: spawned,
      };
    });
}

function getCriticalCpuPressure(roomName) {
  const runtime = Memory.stats && Memory.stats.runtime ? Memory.stats.runtime : null;
  if (runtime && runtime.pressure === "critical") return true;

  const roomCpu =
    Memory.stats &&
    Memory.stats.rooms &&
    Memory.stats.rooms[roomName] &&
    Memory.stats.rooms[roomName].cpu
      ? Memory.stats.rooms[roomName].cpu
      : null;
  return !!(roomCpu && roomCpu.pressure === "critical");
}

function hasActiveThreat(room) {
  if (!room) return false;

  const hostiles =
    typeof FIND_HOSTILE_CREEPS !== "undefined" ? room.find(FIND_HOSTILE_CREEPS) : [];
  const hostilePowerCreeps =
    typeof FIND_HOSTILE_POWER_CREEPS !== "undefined"
      ? room.find(FIND_HOSTILE_POWER_CREEPS)
      : [];
  if ((hostiles && hostiles.length > 0) || (hostilePowerCreeps && hostilePowerCreeps.length > 0)) {
    return true;
  }

  const defense =
    Memory.rooms && Memory.rooms[room.name] && Memory.rooms[room.name].defense
      ? Memory.rooms[room.name].defense
      : null;
  return !!(
    defense &&
    ((defense.homeThreat && defense.homeThreat.active) ||
      (defense.recovery && defense.recovery.active))
  );
}

function getProcessingHealth(room, powerSpawns, storageEnergy, minStorageEnergy) {
  const settings = powerManager.getEffectiveSettings(room);
  const power = getRoomPowerMemory(room.name);
  const readiness = power.readiness || "UNKNOWN";

  if (!settings.EFFECTIVE_PROCESSING_ENABLED) {
    return {
      ok: false,
      reason: "processing disabled",
      readiness: readiness,
    };
  }

  if (powerSpawns.length <= 0) {
    return {
      ok: false,
      reason: ENABLEMENT.BLOCKED_NO_POWER_SPAWN,
      readiness: readiness,
    };
  }

  if (storageEnergy < minStorageEnergy) {
    return {
      ok: false,
      reason: "storage energy below reserve",
      readiness: readiness,
    };
  }

  if (
    readiness === "UNKNOWN" ||
    readiness === powerManager.READINESS.BLOCKED_DISABLED ||
    readiness === powerManager.READINESS.BLOCKED_THREAT ||
    readiness === powerManager.READINESS.BLOCKED_CPU_PRESSURE ||
    readiness === powerManager.READINESS.BLOCKED_RCL ||
    readiness === powerManager.READINESS.BLOCKED_NO_POWER_SPAWN ||
    readiness === powerManager.READINESS.BLOCKED_STORAGE_RESERVE
  ) {
    return {
      ok: false,
      reason: readiness,
      readiness: readiness,
    };
  }

  return {
    ok: true,
    reason: readiness,
    readiness: readiness,
  };
}

function addChecklist(checklist, key, ok, detail) {
  checklist.push({
    key: key,
    ok: !!ok,
    detail: detail || "",
  });
}

module.exports = {
  ENABLEMENT: ENABLEMENT,

  getGlobalStatus() {
    const gpl = Game.gpl || {};
    const rows = getPowerCreepRows();
    const known = rows.length;
    const spawned = rows.filter(function (row) {
      return row.spawned;
    }).length;
    const unspawned = known - spawned;
    const gplLevel = typeof gpl.level === "number" ? gpl.level : 0;
    const availableSlots = Math.max(0, gplLevel - known);

    return {
      gplAvailable: !!Game.gpl,
      gplLevel: gplLevel,
      gplProgress: typeof gpl.progress === "number" ? gpl.progress : 0,
      gplProgressTotal: typeof gpl.progressTotal === "number" ? gpl.progressTotal : 0,
      gplPercent: pct(gpl.progress || 0, gpl.progressTotal || 0),
      knownPowerCreeps: known,
      spawnedPowerCreeps: spawned,
      unspawnedPowerCreeps: unspawned,
      availablePowerCreepSlots: availableSlots,
    };
  },

  formatGlobalStatus(roomName) {
    const status = this.getGlobalStatus();
    const lines = [
      "[OPS][PCL] GPL " +
        `${status.gplLevel} | ${fmt(status.gplProgress)}/${fmt(status.gplProgressTotal)} ` +
        `(${status.gplPercent}) | Power Creeps known ${status.knownPowerCreeps} ` +
        `spawned ${status.spawnedPowerCreeps} unspawned ${status.unspawnedPowerCreeps} ` +
        `slots ${status.availablePowerCreepSlots}`,
    ];

    if (!status.gplAvailable) {
      lines.push("[OPS][PCL] Game.gpl unavailable; reporting safe zero progress.");
    }

    if (roomName) {
      const readiness = this.getRoomEnablementReadiness(roomName);
      lines.push(this.formatEnablementSummaryLine(readiness));
    }

    return lines.join("\n");
  },

  getPowerCreepRows: getPowerCreepRows,

  formatPowerCreeps() {
    const rows = getPowerCreepRows();
    const lines = [
      `[OPS][POWER_CREEPS] known ${rows.length} spawned ${rows.filter(function (row) {
        return row.spawned;
      }).length}`,
    ];

    if (rows.length === 0) {
      lines.push("[OPS][POWER_CREEPS] none");
      return lines.join("\n");
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const location = row.spawned
        ? `${row.shard || "shard?"}/${row.roomName || "room?"}`
        : "unspawned";
      lines.push(
        `[OPS][POWER_CREEPS] ${row.name} | ${row.className} L${row.level} | ` +
          `${row.spawned ? "spawned" : "unspawned"} | ttl ${
            row.ticksToLive !== null ? row.ticksToLive : "--"
          } | ${location} | ops ${fmt(row.ops)} | powers ${
            row.powers.length > 0 ? row.powers.join(",") : "none"
          }`,
      );
    }

    return lines.join("\n");
  },

  getRoomEnablementReadiness(roomName) {
    const room = Game.rooms && Game.rooms[roomName] ? Game.rooms[roomName] : null;
    const checklist = [];

    if (!room || !room.controller || !room.controller.my) {
      addChecklist(checklist, "owned room", false, "room not visible or not owned");
      return {
        roomName: roomName,
        status: ENABLEMENT.BLOCKED_NOT_OWNED,
        checklist: checklist,
        nextSteps: ["claim or select a visible owned room"],
      };
    }

    const controllerLevel = room.controller ? room.controller.level || 0 : 0;
    const powerSpawns = getOwnedPowerSpawns(room);
    const storageEnergy = getStoreAmount(room.storage, RESOURCE_ENERGY);
    const terminalEnergy = getStoreAmount(room.terminal, RESOURCE_ENERGY);
    const settings = Object.assign(
      {
        MIN_STORAGE_ENERGY: 50000,
      },
      config.POWER || {},
    );
    const minStorageEnergy =
      typeof powerManager.getEffectiveSettings === "function"
        ? powerManager.getEffectiveSettings(room).MIN_STORAGE_ENERGY
        : settings.MIN_STORAGE_ENERGY;
    const threat = hasActiveThreat(room);
    const cpuPressure = getCriticalCpuPressure(room.name);
    const processingHealth = getProcessingHealth(
      room,
      powerSpawns,
      storageEnergy,
      minStorageEnergy,
    );

    addChecklist(checklist, "owned room", true, "controller owned");
    addChecklist(checklist, "controller exists", !!room.controller, "controller visible");
    addChecklist(checklist, "RCL8", controllerLevel >= 8, `RCL ${controllerLevel}`);
    addChecklist(checklist, "Power Spawn exists", powerSpawns.length > 0, `${powerSpawns.length} found`);
    addChecklist(checklist, "storage exists", !!room.storage, room.storage ? "present" : "missing");
    addChecklist(
      checklist,
      "terminal preferred",
      !!room.terminal,
      room.terminal ? `present energy ${fmt(terminalEnergy)}` : "not required",
    );
    addChecklist(
      checklist,
      "Power Spawn processing healthy",
      processingHealth.ok,
      processingHealth.reason,
    );
    addChecklist(checklist, "no active threat", !threat, threat ? "active threat" : "clear");
    addChecklist(
      checklist,
      "sufficient energy reserve",
      storageEnergy >= minStorageEnergy,
      `${fmt(storageEnergy)}/${fmt(minStorageEnergy)}`,
    );
    addChecklist(
      checklist,
      "no critical CPU pressure",
      !cpuPressure,
      cpuPressure ? "critical" : "clear",
    );

    let status = ENABLEMENT.READY_TO_ENABLE;
    if (controllerLevel < 8) {
      status = ENABLEMENT.BLOCKED_RCL;
    } else if (powerSpawns.length <= 0) {
      status = ENABLEMENT.BLOCKED_NO_POWER_SPAWN;
    } else if (!room.storage) {
      status = ENABLEMENT.BLOCKED_NO_STORAGE;
    } else if (threat) {
      status = ENABLEMENT.BLOCKED_THREAT;
    } else if (cpuPressure) {
      status = ENABLEMENT.BLOCKED_CPU_PRESSURE;
    } else if (!processingHealth.ok || storageEnergy < minStorageEnergy) {
      status = ENABLEMENT.BLOCKED_POWER_PROCESSING_UNHEALTHY;
    }

    const nextSteps = checklist
      .filter(function (item) {
        return !item.ok && item.key !== "terminal preferred";
      })
      .map(function (item) {
        return item.key + ": " + item.detail;
      });
    if (nextSteps.length === 0) nextSteps.push("manual enableRoom review only; no automation added");

    return {
      roomName: room.name,
      status: status,
      checklist: checklist,
      nextSteps: nextSteps,
    };
  },

  formatEnablementSummaryLine(readiness) {
    return `[OPS][${readiness.roomName}][POWER_ENABLE] ${readiness.status} | next ${readiness.nextSteps[0] || "none"}`;
  },

  formatEnablementReadiness(roomName) {
    const readiness = this.getRoomEnablementReadiness(roomName);
    const lines = [this.formatEnablementSummaryLine(readiness)];

    for (let i = 0; i < readiness.checklist.length; i++) {
      const item = readiness.checklist[i];
      lines.push(
        `[OPS][${readiness.roomName}][POWER_ENABLE] ${item.ok ? "OK" : "BLOCK"} ` +
          `${item.key}${item.detail ? " - " + item.detail : ""}`,
      );
    }

    lines.push(
      `[OPS][${readiness.roomName}][POWER_ENABLE] dry run only; enableRoom not called.`,
    );
    return lines.join("\n");
  },
};
