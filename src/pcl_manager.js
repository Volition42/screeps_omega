/*
Developer Summary:
PCL / Power Creep Readiness Manager

Purpose:
- Provide read-only GPL/PCL and friendly Power Creep visibility
- Evaluate room readiness for manual Power Creep room enablement
- Keep Power Creep preparation operator-driven and non-executing

Important Notes:
- Does not add autonomous Power Creep movement or power use
- Operator-confirmed move commands call moveTo only after explicit confirm
- Native Power Creep lifecycle actions require explicit operator confirm
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

const LIFECYCLE = {
  READY: "READY",
  BLOCKED_INVALID_ACTION: "BLOCKED_INVALID_ACTION",
  BLOCKED_INVALID_MODE: "BLOCKED_INVALID_MODE",
  BLOCKED_NO_POWER_CREEPS: "BLOCKED_NO_POWER_CREEPS",
  BLOCKED_MISSING_POWER_CREEP: "BLOCKED_MISSING_POWER_CREEP",
  BLOCKED_ALREADY_SPAWNED: "BLOCKED_ALREADY_SPAWNED",
  BLOCKED_NOT_SPAWNED: "BLOCKED_NOT_SPAWNED",
  BLOCKED_NOT_OWNED: "BLOCKED_NOT_OWNED",
  BLOCKED_RCL: "BLOCKED_RCL",
  BLOCKED_NO_CONTROLLER: "BLOCKED_NO_CONTROLLER",
  BLOCKED_NO_POWER_SPAWN: "BLOCKED_NO_POWER_SPAWN",
  BLOCKED_POWER_SPAWN_NOT_OWNED: "BLOCKED_POWER_SPAWN_NOT_OWNED",
  BLOCKED_NO_POSITION: "BLOCKED_NO_POSITION",
  BLOCKED_NO_STORE: "BLOCKED_NO_STORE",
  BLOCKED_INSUFFICIENT_OPS: "BLOCKED_INSUFFICIENT_OPS",
  BLOCKED_NO_USE_POWER: "BLOCKED_NO_USE_POWER",
  BLOCKED_MISSING_CONSTANT: "BLOCKED_MISSING_CONSTANT",
  BLOCKED_MISSING_POWER: "BLOCKED_MISSING_POWER",
  BLOCKED_COOLDOWN: "BLOCKED_COOLDOWN",
  BLOCKED_NO_CAPACITY: "BLOCKED_NO_CAPACITY",
  BLOCKED_INVALID_TARGET: "BLOCKED_INVALID_TARGET",
  BLOCKED_NO_TARGET: "BLOCKED_NO_TARGET",
  BLOCKED_ROOM_MISMATCH: "BLOCKED_ROOM_MISMATCH",
  BLOCKED_NOT_IN_RANGE: "BLOCKED_NOT_IN_RANGE",
  BLOCKED_THREAT: "BLOCKED_THREAT",
  BLOCKED_CPU_PRESSURE: "BLOCKED_CPU_PRESSURE",
  BLOCKED_ENABLEMENT_READINESS: "BLOCKED_ENABLEMENT_READINESS",
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

function getStoreFreeCapacity(target, resourceType) {
  if (!target || !target.store || typeof target.store.getFreeCapacity !== "function") {
    return null;
  }

  const free = target.store.getFreeCapacity(resourceType);
  return typeof free === "number" ? free : null;
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

function getAllPowerSpawns(room) {
  if (!room || typeof room.find !== "function") return [];
  return room.find(FIND_STRUCTURES, {
    filter(structure) {
      return structure.structureType === STRUCTURE_POWER_SPAWN;
    },
  });
}

function getPowerCreepByName(name) {
  const powerCreeps = Game.powerCreeps || null;
  if (!powerCreeps) return null;
  return powerCreeps[name] || null;
}

function hasAnyPowerCreeps() {
  return !!(Game.powerCreeps && Object.keys(Game.powerCreeps).length > 0);
}

function isPowerCreepSpawned(powerCreep) {
  return !!(
    powerCreep &&
    (powerCreep.ticksToLive || powerCreep.room || powerCreep.pos)
  );
}

function getPowerCreepRoomName(powerCreep) {
  if (!powerCreep) return null;
  if (powerCreep.room && powerCreep.room.name) return powerCreep.room.name;
  if (powerCreep.pos && powerCreep.pos.roomName) return powerCreep.pos.roomName;
  return null;
}

function getRange(powerCreep, target) {
  if (!powerCreep || !powerCreep.pos || !target || !target.pos) return null;
  if (powerCreep.pos.roomName !== target.pos.roomName) return null;
  if (typeof powerCreep.pos.getRangeTo === "function") {
    return powerCreep.pos.getRangeTo(target);
  }
  return Math.max(
    Math.abs(powerCreep.pos.x - target.pos.x),
    Math.abs(powerCreep.pos.y - target.pos.y),
  );
}

function formatPosition(pos) {
  if (!pos) return "unknown";
  return `${pos.roomName || "?"}:${pos.x},${pos.y}`;
}

function normalizeMoveTarget(targetType) {
  const normalized =
    typeof targetType === "string" ? targetType.trim().toLowerCase() : targetType;
  if (normalized === "powerspawn" || normalized === "power_spawn" || normalized === "power-spawn") {
    return "powerSpawn";
  }
  if (normalized === "controller") return "controller";
  if (normalized === "staging" || normalized === "stage") return "staging";
  return normalized || "";
}

function targetLabel(targetType) {
  if (targetType === "powerSpawn") return "Power Spawn";
  if (targetType === "controller") return "Controller";
  if (targetType === "staging") return "Staging";
  return targetType || "none";
}

function resultLabel(result) {
  const labels = {};
  if (typeof OK !== "undefined") labels[OK] = "OK";
  if (typeof ERR_NOT_OWNER !== "undefined") labels[ERR_NOT_OWNER] = "ERR_NOT_OWNER";
  if (typeof ERR_NO_PATH !== "undefined") labels[ERR_NO_PATH] = "ERR_NO_PATH";
  if (typeof ERR_NAME_EXISTS !== "undefined") labels[ERR_NAME_EXISTS] = "ERR_NAME_EXISTS";
  if (typeof ERR_BUSY !== "undefined") labels[ERR_BUSY] = "ERR_BUSY";
  if (typeof ERR_NOT_FOUND !== "undefined") labels[ERR_NOT_FOUND] = "ERR_NOT_FOUND";
  if (typeof ERR_NOT_ENOUGH_ENERGY !== "undefined") labels[ERR_NOT_ENOUGH_ENERGY] = "ERR_NOT_ENOUGH_ENERGY";
  if (typeof ERR_NOT_ENOUGH_RESOURCES !== "undefined") labels[ERR_NOT_ENOUGH_RESOURCES] = "ERR_NOT_ENOUGH_RESOURCES";
  if (typeof ERR_INVALID_TARGET !== "undefined") labels[ERR_INVALID_TARGET] = "ERR_INVALID_TARGET";
  if (typeof ERR_FULL !== "undefined") labels[ERR_FULL] = "ERR_FULL";
  if (typeof ERR_NOT_IN_RANGE !== "undefined") labels[ERR_NOT_IN_RANGE] = "ERR_NOT_IN_RANGE";
  if (typeof ERR_INVALID_ARGS !== "undefined") labels[ERR_INVALID_ARGS] = "ERR_INVALID_ARGS";
  if (typeof ERR_TIRED !== "undefined") labels[ERR_TIRED] = "ERR_TIRED";
  if (typeof ERR_NO_BODYPART !== "undefined") labels[ERR_NO_BODYPART] = "ERR_NO_BODYPART";
  if (typeof ERR_RCL_NOT_ENOUGH !== "undefined") labels[ERR_RCL_NOT_ENOUGH] = "ERR_RCL_NOT_ENOUGH";
  return Object.prototype.hasOwnProperty.call(labels, result)
    ? labels[result]
    : String(result);
}

function normalizeMode(mode) {
  return typeof mode === "string" ? mode.trim().toLowerCase() : mode;
}

function normalizeAction(action) {
  return typeof action === "string" ? action.trim().toLowerCase() : action;
}

function nativeActionLabel(action) {
  if (action === "spawn") return "powerSpawn.spawnPowerCreep(powerCreep)";
  if (action === "renew") return "powerSpawn.renewPowerCreep(powerCreep)";
  if (action === "enable") return "powerCreep.enableRoom(room.controller)";
  if (action === "move") return "powerCreep.moveTo(target)";
  if (action === "generateOps") return "powerCreep.usePower(PWR_GENERATE_OPS)";
  if (action === "operateSpawn") return "powerCreep.usePower(PWR_OPERATE_SPAWN, spawn)";
  if (action === "operateExtension") return "powerCreep.usePower(PWR_OPERATE_EXTENSION, room.controller)";
  return "none";
}

function getGenerateOpsPowerConstant() {
  return typeof PWR_GENERATE_OPS !== "undefined" ? PWR_GENERATE_OPS : null;
}

function getOperateSpawnPowerConstant() {
  return typeof PWR_OPERATE_SPAWN !== "undefined" ? PWR_OPERATE_SPAWN : null;
}

function getOperateExtensionPowerConstant() {
  return typeof PWR_OPERATE_EXTENSION !== "undefined" ? PWR_OPERATE_EXTENSION : null;
}

function getOpsResourceType() {
  return typeof RESOURCE_OPS !== "undefined" ? RESOURCE_OPS : "ops";
}

function getGenerateOpsPowerInfo(powerCreep, powerConstant) {
  if (!powerCreep || !powerCreep.powers) return null;
  if (powerConstant !== null && powerCreep.powers[powerConstant]) {
    return powerCreep.powers[powerConstant];
  }
  return powerCreep.powers.PWR_GENERATE_OPS || null;
}

const OPERATOR_POWER_DEFS = [
  { key: "spawn", constantName: "PWR_OPERATE_SPAWN", targetType: "spawn", targetLabel: "spawns" },
  { key: "extension", constantName: "PWR_OPERATE_EXTENSION", targetType: "extension", targetLabel: "extensions" },
  { key: "tower", constantName: "PWR_OPERATE_TOWER", targetType: "tower", targetLabel: "towers" },
  { key: "storage", constantName: "PWR_OPERATE_STORAGE", targetType: "storage", targetLabel: "storage" },
  { key: "terminal", constantName: "PWR_OPERATE_TERMINAL", targetType: "terminal", targetLabel: "terminal" },
  { key: "factory", constantName: "PWR_OPERATE_FACTORY", targetType: "factory", targetLabel: "factory" },
  { key: "lab", constantName: "PWR_OPERATE_LAB", targetType: "lab", targetLabel: "labs" },
  { key: "power", constantName: "PWR_OPERATE_POWER", targetType: "powerSpawn", targetLabel: "powerSpawn" },
  { key: "source", constantName: "PWR_REGEN_SOURCE", targetType: "source", targetLabel: "sources" },
  { key: "mineral", constantName: "PWR_REGEN_MINERAL", targetType: "mineral", targetLabel: "minerals" },
];

function getGlobalConstant(name) {
  return typeof global !== "undefined" && Object.prototype.hasOwnProperty.call(global, name)
    ? global[name]
    : null;
}

function getPowerInfo(powerConstant) {
  if (
    powerConstant === null ||
    typeof POWER_INFO === "undefined" ||
    !POWER_INFO ||
    !Object.prototype.hasOwnProperty.call(POWER_INFO, powerConstant)
  ) {
    return null;
  }
  return POWER_INFO[powerConstant] || null;
}

function getPowerOpsCost(powerConstant) {
  const info = getPowerInfo(powerConstant);
  return info && typeof info.ops === "number" ? info.ops : null;
}

function getPowerRange(powerConstant) {
  const info = getPowerInfo(powerConstant);
  return info && typeof info.range === "number" ? info.range : null;
}

function getPowerCreepPowerInfo(powerCreep, powerConstant, constantName) {
  if (!powerCreep || !powerCreep.powers) return null;
  if (powerConstant !== null && powerCreep.powers[powerConstant]) return powerCreep.powers[powerConstant];
  return powerCreep.powers[constantName] || null;
}

function countRoomStructures(room, structureType) {
  if (!room || typeof room.find !== "function" || typeof FIND_STRUCTURES === "undefined") return [];
  return room.find(FIND_STRUCTURES, {
    filter(structure) {
      return structure.structureType === structureType;
    },
  });
}

function getOwnedSpawns(room) {
  if (!room || typeof room.find !== "function") return [];
  if (typeof FIND_MY_SPAWNS !== "undefined") {
    return room.find(FIND_MY_SPAWNS);
  }
  if (typeof FIND_MY_STRUCTURES !== "undefined" && typeof STRUCTURE_SPAWN !== "undefined") {
    return room.find(FIND_MY_STRUCTURES, {
      filter(structure) {
        return structure.structureType === STRUCTURE_SPAWN;
      },
    });
  }
  return [];
}

function resolveOwnedSpawnTarget(room, targetArg) {
  const spawns = getOwnedSpawns(room);
  const requested = typeof targetArg === "string" ? targetArg.trim() : targetArg;

  if (!room) {
    return {
      requested: requested || null,
      spawn: null,
      status: LIFECYCLE.BLOCKED_NOT_OWNED,
      detail: "room not visible or not owned",
      defaulted: false,
    };
  }

  if (spawns.length <= 0) {
    return {
      requested: requested || null,
      spawn: null,
      status: LIFECYCLE.BLOCKED_NO_TARGET,
      detail: "missing owned spawn",
      defaulted: !requested,
    };
  }

  if (requested) {
    const objectById =
      Game.getObjectById && typeof Game.getObjectById === "function"
        ? Game.getObjectById(requested)
        : null;
    const matched = spawns.filter(function (spawn) {
      return spawn && (spawn.name === requested || spawn.id === requested || spawn === objectById);
    })[0];

    return {
      requested: requested,
      spawn: matched || null,
      status: matched ? null : LIFECYCLE.BLOCKED_NO_TARGET,
      detail: matched ? "owned spawn target" : "requested owned spawn not found in room",
      defaulted: false,
    };
  }

  return {
    requested: null,
    spawn: spawns[0],
    status: null,
    detail: "default first owned spawn",
    defaulted: true,
  };
}

function resolveOwnedControllerTarget(room) {
  if (!room || !room.controller || !room.controller.my) {
    return {
      controller: null,
      status: LIFECYCLE.BLOCKED_NOT_OWNED,
      detail: "room not visible or not owned",
    };
  }

  return {
    controller: room.controller,
    status: null,
    detail: "owned room controller target",
  };
}

function getRoomOperatorTargets(room, targetType) {
  if (!room) return [];
  if (targetType === "spawn" && typeof STRUCTURE_SPAWN !== "undefined") {
    return countRoomStructures(room, STRUCTURE_SPAWN);
  }
  if (targetType === "extension" && typeof STRUCTURE_EXTENSION !== "undefined") {
    return countRoomStructures(room, STRUCTURE_EXTENSION);
  }
  if (targetType === "tower" && typeof STRUCTURE_TOWER !== "undefined") {
    return countRoomStructures(room, STRUCTURE_TOWER);
  }
  if (targetType === "storage") return room.storage ? [room.storage] : [];
  if (targetType === "terminal") return room.terminal ? [room.terminal] : [];
  if (targetType === "factory" && typeof STRUCTURE_FACTORY !== "undefined") {
    return countRoomStructures(room, STRUCTURE_FACTORY);
  }
  if (targetType === "lab" && typeof STRUCTURE_LAB !== "undefined") {
    return countRoomStructures(room, STRUCTURE_LAB);
  }
  if (targetType === "powerSpawn" && typeof STRUCTURE_POWER_SPAWN !== "undefined") {
    return countRoomStructures(room, STRUCTURE_POWER_SPAWN);
  }
  if (targetType === "source" && typeof FIND_SOURCES !== "undefined" && typeof room.find === "function") {
    return room.find(FIND_SOURCES);
  }
  if (targetType === "mineral" && typeof FIND_MINERALS !== "undefined" && typeof room.find === "function") {
    return room.find(FIND_MINERALS);
  }
  return [];
}

function getOperatorTargetSummary(room) {
  const summary = {};
  for (let i = 0; i < OPERATOR_POWER_DEFS.length; i++) {
    const def = OPERATOR_POWER_DEFS[i];
    summary[def.targetLabel] = getRoomOperatorTargets(room, def.targetType).length;
  }
  return summary;
}

function formatOperatorTargetSummaryLine(roomName, summary) {
  return (
    `[OPS][${roomName}][OPERATOR] targets ` +
    `spawns ${summary.spawns || 0} | extensions ${summary.extensions || 0} | ` +
    `towers ${summary.towers || 0} | storage ${summary.storage || 0} | ` +
    `terminal ${summary.terminal || 0} | factory ${summary.factory || 0} | ` +
    `labs ${summary.labs || 0} | powerSpawn ${summary.powerSpawn || 0} | ` +
    `sources ${summary.sources || 0} | minerals ${summary.minerals || 0}`
  );
}

function getFirstVisibleOperatorTarget(room, targetType) {
  const targets = getRoomOperatorTargets(room, targetType);
  return targets.length > 0 ? targets[0] : null;
}

function evaluateOperatorPower(def, powerCreep, room) {
  const powerConstant = getGlobalConstant(def.constantName);
  const powerInfo = getPowerCreepPowerInfo(powerCreep, powerConstant, def.constantName);
  const cooldown = powerInfo && typeof powerInfo.cooldown === "number" ? powerInfo.cooldown : 0;
  const opsCost = getPowerOpsCost(powerConstant);
  const carriedOps = getStoreAmount(powerCreep, getOpsResourceType());
  const targetCount = room ? getRoomOperatorTargets(room, def.targetType).length : null;
  const target = room ? getFirstVisibleOperatorTarget(room, def.targetType) : null;
  const range = powerCreep && target ? getRange(powerCreep, target) : null;
  const requiredRange = powerConstant !== null ? getPowerRange(powerConstant) : null;

  let status = "ready";
  if (powerConstant === null) {
    status = "missing-constant";
  } else if (!powerCreep) {
    status = "missing-creep";
  } else if (!isPowerCreepSpawned(powerCreep)) {
    status = "not-spawned";
  } else if (!powerInfo) {
    status = "missing-power";
  } else if (cooldown > 0) {
    status = "cooldown";
  } else if (opsCost !== null && carriedOps < opsCost) {
    status = "need-ops";
  } else if (room && targetCount <= 0) {
    status = "no-targets";
  } else if (requiredRange !== null && range !== null && range > requiredRange) {
    status = "out-of-range";
  }

  return {
    key: def.key,
    constantName: def.constantName,
    powerConstant: powerConstant,
    powerExists: powerConstant !== null,
    hasPower: !!powerInfo,
    cooldown: cooldown,
    opsCost: opsCost,
    carriedOps: carriedOps,
    enoughOps: opsCost === null ? "unknown" : carriedOps >= opsCost ? "yes" : "no",
    targetType: def.targetType,
    targetLabel: def.targetLabel,
    targetCount: targetCount,
    range: range,
    requiredRange: requiredRange,
    status: status,
  };
}

function buildOperatorReadiness(powerCreepName, roomName) {
  const powerCreep = getPowerCreepByName(powerCreepName);
  const room = roomName && Game.rooms ? Game.rooms[roomName] || null : null;
  const spawned = isPowerCreepSpawned(powerCreep);
  const currentRoomName = getPowerCreepRoomName(powerCreep);
  const rows = OPERATOR_POWER_DEFS.map(function (def) {
    return evaluateOperatorPower(def, powerCreep, room);
  });
  const supported = rows.filter(function (row) {
    return row.powerExists;
  }).length;
  const ready = rows.filter(function (row) {
    return row.status === "ready";
  }).length;

  return {
    powerCreepName: powerCreepName,
    roomName: roomName || null,
    room: room,
    powerCreep: powerCreep,
    registryAvailable: !!Game.powerCreeps,
    spawned: spawned,
    currentRoomName: currentRoomName,
    carriedOps: getStoreAmount(powerCreep, getOpsResourceType()),
    supported: supported,
    ready: ready,
    rows: rows,
    targetSummary: room ? getOperatorTargetSummary(room) : null,
  };
}

function formatOperatorPowerRow(report, row, detailed) {
  const parts = [
    `[OPS][${report.powerCreepName || "?"}][POWER]`,
    row.key,
    row.status,
    "cooldown",
    String(row.cooldown),
  ];

  parts.push("ops");
  parts.push(`${fmt(row.carriedOps)}/${row.opsCost === null ? "unknown" : fmt(row.opsCost)}`);
  parts.push("enough");
  parts.push(row.enoughOps);

  if (row.targetCount !== null) {
    parts.push("targets");
    parts.push(String(row.targetCount));
  }

  if (detailed) {
    parts.push("target");
    parts.push(row.targetType);
    parts.push("constant");
    parts.push(row.powerExists ? row.constantName : "missing");
    if (row.range !== null) {
      parts.push("range");
      parts.push(`${row.range}/${row.requiredRange === null ? "unknown" : row.requiredRange}`);
    }
  }

  return parts.join(" ");
}

function formatOperatorReadiness(powerCreepName, roomName, mode) {
  const report = buildOperatorReadiness(powerCreepName, roomName);
  const detailed = mode === "powers";
  const lines = [
    `[OPS][${powerCreepName || "?"}][OPERATOR] ` +
      `spawned ${report.spawned ? "yes" : "no"} | room ${report.currentRoomName || "unknown"} | ` +
      `ops ${fmt(report.carriedOps)} | ready ${report.ready}/${report.rows.length} | ` +
      `supported ${report.supported}/${report.rows.length}`,
  ];

  if (!report.registryAvailable) {
    lines.push(`[OPS][${powerCreepName || "?"}][OPERATOR] Game.powerCreeps missing`);
  }
  if (!report.powerCreep) {
    lines.push(`[OPS][${powerCreepName || "?"}][OPERATOR] missing Power Creep`);
  } else if (!report.spawned) {
    lines.push(`[OPS][${powerCreepName || "?"}][OPERATOR] unspawned Power Creep`);
  }
  if (roomName && !report.room) {
    lines.push(`[OPS][${powerCreepName || "?"}][OPERATOR] room ${roomName} not visible`);
  }
  if (report.targetSummary) {
    lines.push(formatOperatorTargetSummaryLine(report.room.name, report.targetSummary));
  }

  for (let i = 0; i < report.rows.length; i++) {
    const row = report.rows[i];
    if (!detailed && row.status === "missing-constant") continue;
    lines.push(formatOperatorPowerRow(report, row, detailed));
  }

  lines.push(`[OPS][${powerCreepName || "?"}][OPERATOR] report only; OPERATE_* usePower not called.`);
  return lines.join("\n");
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
        ops: getStoreAmount(powerCreep, getOpsResourceType()),
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

function addLifecycleCheck(checks, key, ok, detail, status) {
  checks.push({
    key: key,
    ok: !!ok,
    detail: detail || "",
    status: status || null,
  });
}

function firstBlockedStatus(checks, fallback) {
  for (let i = 0; i < checks.length; i++) {
    if (!checks[i].ok) return checks[i].status || fallback;
  }
  return null;
}

function formatLifecycleReport(report) {
  const target = report.targetId ? report.targetType + " " + report.targetId : report.targetType;
  const lines = [
    `[OPS][POWER_CREEP] action ${report.action} | mode ${report.mode} | room ${report.roomName || "?"} | ` +
      `creep ${report.powerCreepName || "?"} | target ${target || "none"} | status ${report.status}`,
  ];

  if (report.blockedReason) {
    lines.push(`[OPS][POWER_CREEP] blocked ${report.blockedReason}`);
  }

  for (let i = 0; i < report.checks.length; i++) {
    const item = report.checks[i];
    lines.push(
      `[OPS][POWER_CREEP] ${item.ok ? "OK" : "BLOCK"} ${item.key}` +
        `${item.detail ? " - " + item.detail : ""}`,
    );
  }

  lines.push(`[OPS][POWER_CREEP] native ${report.nativeAction}`);

  if (report.mode === "check") {
    lines.push("[OPS][POWER_CREEP] dry run only; native action not called.");
  } else if (report.executed) {
    lines.push(
      `[OPS][POWER_CREEP] API result ${report.apiResult} (${resultLabel(report.apiResult)})`,
    );
  } else {
    lines.push("[OPS][POWER_CREEP] native action not called.");
  }

  return lines.join("\n");
}

function resolvePowerCreepTarget(room, targetType) {
  const normalizedTarget = normalizeMoveTarget(targetType);
  const powerSpawns = getOwnedPowerSpawns(room);
  const powerSpawn = powerSpawns.length > 0 ? powerSpawns[0] : null;

  if (normalizedTarget === "powerSpawn") {
    return {
      requestedType: normalizedTarget,
      targetType: "Power Spawn",
      target: powerSpawn,
      targetId: powerSpawn ? powerSpawn.id : null,
      targetPosition: powerSpawn ? powerSpawn.pos : null,
      status: powerSpawn ? null : LIFECYCLE.BLOCKED_NO_POWER_SPAWN,
      detail: powerSpawn ? "owned Power Spawn" : "missing owned Power Spawn",
    };
  }

  if (normalizedTarget === "controller") {
    return {
      requestedType: normalizedTarget,
      targetType: "Controller",
      target: room && room.controller ? room.controller : null,
      targetId: room && room.controller ? room.controller.id : null,
      targetPosition: room && room.controller ? room.controller.pos : null,
      status: room && room.controller ? null : LIFECYCLE.BLOCKED_NO_CONTROLLER,
      detail: room && room.controller ? "controller visible" : "missing controller",
    };
  }

  if (normalizedTarget === "staging") {
    return {
      requestedType: normalizedTarget,
      targetType: "Staging",
      target: powerSpawn,
      targetId: powerSpawn ? powerSpawn.id : null,
      targetPosition: powerSpawn ? powerSpawn.pos : null,
      status: powerSpawn ? null : LIFECYCLE.BLOCKED_NO_POWER_SPAWN,
      detail: powerSpawn
        ? "default staging target is Power Spawn"
        : "default staging target missing Power Spawn",
    };
  }

  return {
    requestedType: normalizedTarget,
    targetType: targetLabel(normalizedTarget),
    target: null,
    targetId: null,
    targetPosition: null,
    status: LIFECYCLE.BLOCKED_INVALID_TARGET,
    detail: 'use "powerSpawn", "controller", or "staging"',
  };
}

function evaluatePowerCreepPosition(powerCreepName, roomName) {
  const checks = [];
  const room = Game.rooms && Game.rooms[roomName] ? Game.rooms[roomName] : null;
  const powerCreep = getPowerCreepByName(powerCreepName);
  const powerCreepSpawned = isPowerCreepSpawned(powerCreep);
  const creepRoomName = getPowerCreepRoomName(powerCreep);
  const targets = ["powerSpawn", "controller", "staging"].map(function (targetType) {
    const resolved = resolvePowerCreepTarget(room, targetType);
    return {
      type: resolved.targetType,
      requestedType: resolved.requestedType,
      id: resolved.targetId,
      position: resolved.targetPosition,
      detail: resolved.detail,
      range: powerCreepSpawned && resolved.target ? getRange(powerCreep, resolved.target) : null,
      status: resolved.status || "VISIBLE",
    };
  });

  addLifecycleCheck(
    checks,
    "Power Creeps registry",
    hasAnyPowerCreeps(),
    hasAnyPowerCreeps() ? "available" : "Game.powerCreeps missing or empty",
    LIFECYCLE.BLOCKED_NO_POWER_CREEPS,
  );
  addLifecycleCheck(
    checks,
    "named Power Creep",
    !!powerCreep,
    powerCreep ? powerCreep.name || powerCreepName : "not found",
    LIFECYCLE.BLOCKED_MISSING_POWER_CREEP,
  );
  addLifecycleCheck(
    checks,
    "spawned Power Creep",
    !!powerCreep && powerCreepSpawned,
    powerCreepSpawned ? `in ${creepRoomName || "unknown"}` : "not spawned",
    LIFECYCLE.BLOCKED_NOT_SPAWNED,
  );
  addLifecycleCheck(
    checks,
    "visible Power Creep position",
    !!(powerCreep && powerCreep.pos),
    powerCreep && powerCreep.pos ? formatPosition(powerCreep.pos) : "position unavailable",
    LIFECYCLE.BLOCKED_NO_POSITION,
  );
  addLifecycleCheck(
    checks,
    "owned room",
    !!(room && room.controller && room.controller.my),
    room ? "visible" : "room not visible or not owned",
    LIFECYCLE.BLOCKED_NOT_OWNED,
  );

  const blocked = firstBlockedStatus(checks, LIFECYCLE.BLOCKED_MISSING_POWER_CREEP);
  return {
    action: "position",
    mode: "check",
    roomName: roomName,
    powerCreepName: powerCreepName,
    powerCreep: powerCreep,
    currentPosition: powerCreep && powerCreep.pos ? powerCreep.pos : null,
    currentRoomName: creepRoomName,
    status: blocked || LIFECYCLE.READY,
    blockedReason: blocked,
    checks: checks,
    targets: targets,
  };
}

function evaluatePowerCreepMove(powerCreepName, roomName, targetType, mode) {
  const normalizedMode = normalizeMode(mode);
  const normalizedTarget = normalizeMoveTarget(targetType);
  const checks = [];
  const room = Game.rooms && Game.rooms[roomName] ? Game.rooms[roomName] : null;
  const powerCreep = getPowerCreepByName(powerCreepName);
  const powerCreepSpawned = isPowerCreepSpawned(powerCreep);
  const creepRoomName = getPowerCreepRoomName(powerCreep);
  const threat = hasActiveThreat(room);
  const resolved = resolvePowerCreepTarget(room, normalizedTarget);
  const range = powerCreepSpawned && resolved.target ? getRange(powerCreep, resolved.target) : null;

  addLifecycleCheck(
    checks,
    "mode",
    normalizedMode === "check" || normalizedMode === "confirm",
    'use "check" or "confirm"',
    LIFECYCLE.BLOCKED_INVALID_MODE,
  );
  addLifecycleCheck(
    checks,
    "operator approval",
    normalizedMode === "check" || normalizedMode === "confirm",
    normalizedMode === "confirm"
      ? "confirmed"
      : normalizedMode === "check"
        ? "dry run; moveTo not called"
        : 'use "confirm" to issue moveTo',
    LIFECYCLE.BLOCKED_INVALID_MODE,
  );
  addLifecycleCheck(
    checks,
    "Power Creeps registry",
    hasAnyPowerCreeps(),
    hasAnyPowerCreeps() ? "available" : "Game.powerCreeps missing or empty",
    LIFECYCLE.BLOCKED_NO_POWER_CREEPS,
  );
  addLifecycleCheck(
    checks,
    "named Power Creep",
    !!powerCreep,
    powerCreep ? powerCreep.name || powerCreepName : "not found",
    LIFECYCLE.BLOCKED_MISSING_POWER_CREEP,
  );
  addLifecycleCheck(
    checks,
    "spawned Power Creep",
    !!powerCreep && powerCreepSpawned,
    powerCreepSpawned ? `in ${creepRoomName || "unknown"}` : "not spawned",
    LIFECYCLE.BLOCKED_NOT_SPAWNED,
  );
  addLifecycleCheck(
    checks,
    "visible Power Creep position",
    !!(powerCreep && powerCreep.pos),
    powerCreep && powerCreep.pos ? formatPosition(powerCreep.pos) : "position unavailable",
    LIFECYCLE.BLOCKED_NO_POSITION,
  );
  addLifecycleCheck(
    checks,
    "owned room",
    !!(room && room.controller && room.controller.my),
    room ? "visible" : "room not visible or not owned",
    LIFECYCLE.BLOCKED_NOT_OWNED,
  );
  addLifecycleCheck(
    checks,
    "target type",
    resolved.status !== LIFECYCLE.BLOCKED_INVALID_TARGET,
    resolved.detail,
    LIFECYCLE.BLOCKED_INVALID_TARGET,
  );
  addLifecycleCheck(
    checks,
    "target exists",
    !!resolved.target && !resolved.status,
    resolved.detail,
    resolved.status || LIFECYCLE.BLOCKED_NO_TARGET,
  );
  addLifecycleCheck(
    checks,
    "target position visible",
    !!resolved.targetPosition,
    resolved.targetPosition ? formatPosition(resolved.targetPosition) : "position unavailable",
    LIFECYCLE.BLOCKED_NO_TARGET,
  );
  addLifecycleCheck(
    checks,
    "no active threat",
    !threat,
    threat ? "active threat" : "clear",
    LIFECYCLE.BLOCKED_THREAT,
  );

  const blocked = firstBlockedStatus(checks, LIFECYCLE.BLOCKED_INVALID_MODE);

  return {
    action: "move",
    mode: normalizedMode || String(mode || ""),
    roomName: roomName,
    powerCreepName: powerCreepName,
    powerCreep: powerCreep,
    currentPosition: powerCreep && powerCreep.pos ? powerCreep.pos : null,
    currentRoomName: creepRoomName,
    targetType: resolved.targetType,
    requestedTargetType: normalizedTarget,
    target: resolved.target,
    targetId: resolved.targetId,
    targetPosition: resolved.targetPosition,
    targetDetail: resolved.detail,
    range: range,
    nativeAction: nativeActionLabel("move"),
    crossRoom: !!(powerCreep && powerCreep.pos && resolved.targetPosition && powerCreep.pos.roomName !== resolved.targetPosition.roomName),
    status: blocked || LIFECYCLE.READY,
    blockedReason: blocked,
    checks: checks,
  };
}

function formatPositionReport(report) {
  const lines = [
    `[OPS][POWER_CREEP] action ${report.action} | mode ${report.mode} | room ${report.roomName || "?"} | ` +
      `creep ${report.powerCreepName || "?"} | current ${formatPosition(report.currentPosition)} | status ${report.status}`,
  ];

  if (report.blockedReason) {
    lines.push(`[OPS][POWER_CREEP] blocked ${report.blockedReason}`);
  }

  for (let i = 0; i < report.checks.length; i++) {
    const item = report.checks[i];
    lines.push(
      `[OPS][POWER_CREEP] ${item.ok ? "OK" : "BLOCK"} ${item.key}` +
        `${item.detail ? " - " + item.detail : ""}`,
    );
  }

  for (let i = 0; i < report.targets.length; i++) {
    const target = report.targets[i];
    lines.push(
      `[OPS][POWER_CREEP] target ${target.type} | room ${report.roomName || "?"} | ` +
        `pos ${formatPosition(target.position)} | range ${
          typeof target.range === "number" ? target.range : "cross-room/unavailable"
        } | status ${target.status} | ${target.detail}`,
    );
  }

  lines.push("[OPS][POWER_CREEP] position report only; native action not called.");
  return lines.join("\n");
}

function formatMoveReport(report) {
  const lines = [
    `[OPS][POWER_CREEP] action ${report.action} | mode ${report.mode || "?"} | room ${report.roomName || "?"} | ` +
      `creep ${report.powerCreepName || "?"} | target ${report.targetType || "none"} ${
        report.targetId || "none"
      } | status ${report.status}`,
    `[OPS][POWER_CREEP] current ${formatPosition(report.currentPosition)} | target room ${
      report.roomName || "?"
    } | target pos ${formatPosition(report.targetPosition)} | range ${
      typeof report.range === "number" ? report.range : "cross-room/unavailable"
    }`,
  ];

  if (report.crossRoom) {
    lines.push("[OPS][POWER_CREEP] cross-room movement is operator-directed; no route automation added.");
  }

  if (report.blockedReason) {
    lines.push(`[OPS][POWER_CREEP] blocked ${report.blockedReason}`);
  }

  for (let i = 0; i < report.checks.length; i++) {
    const item = report.checks[i];
    lines.push(
      `[OPS][POWER_CREEP] ${item.ok ? "OK" : "BLOCK"} ${item.key}` +
        `${item.detail ? " - " + item.detail : ""}`,
    );
  }

  lines.push(`[OPS][POWER_CREEP] native ${report.nativeAction}`);

  if (report.mode === "check") {
    lines.push("[OPS][POWER_CREEP] dry run only; moveTo not called.");
  } else if (report.executed) {
    lines.push(
      `[OPS][POWER_CREEP] moveTo result ${report.apiResult} (${resultLabel(report.apiResult)})`,
    );
  } else {
    lines.push("[OPS][POWER_CREEP] moveTo not called.");
  }

  return lines.join("\n");
}

function evaluateGenerateOps(powerCreepName, mode) {
  const normalizedMode = normalizeMode(mode);
  const checks = [];
  const powerConstant = getGenerateOpsPowerConstant();
  const resourceType = getOpsResourceType();
  const powerCreep = getPowerCreepByName(powerCreepName);
  const powerCreepSpawned = isPowerCreepSpawned(powerCreep);
  const creepRoomName = getPowerCreepRoomName(powerCreep);
  const powerInfo = getGenerateOpsPowerInfo(powerCreep, powerConstant);
  const cooldown =
    powerInfo && typeof powerInfo.cooldown === "number" ? powerInfo.cooldown : 0;
  const opsCarried = powerCreep && powerCreep.store ? getStoreAmount(powerCreep, resourceType) : 0;
  const freeCapacity = powerCreep ? getStoreFreeCapacity(powerCreep, resourceType) : null;

  addLifecycleCheck(
    checks,
    "mode",
    normalizedMode === "check" || normalizedMode === "confirm",
    'use "check" or "confirm"',
    LIFECYCLE.BLOCKED_INVALID_MODE,
  );
  addLifecycleCheck(
    checks,
    "explicit confirm",
    normalizedMode === "confirm" || normalizedMode === "check",
    normalizedMode === "confirm"
      ? "confirmed"
      : normalizedMode === "check"
        ? "dry run; usePower not called"
        : 'use ops.powerCreep("CREEP_NAME", "generateOps", "confirm")',
    LIFECYCLE.BLOCKED_INVALID_MODE,
  );
  addLifecycleCheck(
    checks,
    "PWR_GENERATE_OPS constant",
    powerConstant !== null,
    powerConstant !== null ? "available" : "missing in runtime",
    LIFECYCLE.BLOCKED_MISSING_CONSTANT,
  );
  addLifecycleCheck(
    checks,
    "Power Creeps registry",
    hasAnyPowerCreeps(),
    hasAnyPowerCreeps() ? "available" : "Game.powerCreeps missing or empty",
    LIFECYCLE.BLOCKED_NO_POWER_CREEPS,
  );
  addLifecycleCheck(
    checks,
    "named Power Creep",
    !!powerCreep,
    powerCreep ? powerCreep.name || powerCreepName : "not found",
    LIFECYCLE.BLOCKED_MISSING_POWER_CREEP,
  );
  addLifecycleCheck(
    checks,
    "spawned Power Creep",
    !!powerCreep && powerCreepSpawned,
    powerCreepSpawned ? `in ${creepRoomName || "unknown"}` : "not spawned",
    LIFECYCLE.BLOCKED_NOT_SPAWNED,
  );
  addLifecycleCheck(
    checks,
    "visible store",
    !!(powerCreep && powerCreep.store),
    powerCreep && powerCreep.store ? "store visible" : "store unavailable",
    LIFECYCLE.BLOCKED_NO_STORE,
  );
  addLifecycleCheck(
    checks,
    "usePower method",
    !!(powerCreep && typeof powerCreep.usePower === "function"),
    powerCreep && typeof powerCreep.usePower === "function" ? "available" : "unavailable",
    LIFECYCLE.BLOCKED_NO_USE_POWER,
  );
  addLifecycleCheck(
    checks,
    "GENERATE_OPS power",
    !!powerInfo,
    powerInfo ? `level ${powerInfo.level || "?"}` : "missing PWR_GENERATE_OPS",
    LIFECYCLE.BLOCKED_MISSING_POWER,
  );
  addLifecycleCheck(
    checks,
    "GENERATE_OPS cooldown",
    !!powerInfo && cooldown <= 0,
    powerInfo ? `cooldown ${cooldown}` : "power unavailable",
    LIFECYCLE.BLOCKED_COOLDOWN,
  );
  addLifecycleCheck(
    checks,
    "ops free capacity",
    typeof freeCapacity === "number" && freeCapacity > 0,
    typeof freeCapacity === "number" ? `free ${fmt(freeCapacity)}` : "free capacity unavailable",
    LIFECYCLE.BLOCKED_NO_CAPACITY,
  );

  const blocked = firstBlockedStatus(checks, LIFECYCLE.BLOCKED_INVALID_MODE);
  return {
    action: "generateOps",
    mode: normalizedMode || String(mode || ""),
    powerCreepName: powerCreepName,
    powerCreep: powerCreep,
    spawned: !!(powerCreep && powerCreepSpawned),
    currentRoomName: creepRoomName,
    opsCarried: opsCarried,
    freeCapacity: freeCapacity,
    cooldown: cooldown,
    nativeAction: nativeActionLabel("generateOps"),
    powerConstant: powerConstant,
    status: blocked || LIFECYCLE.READY,
    blockedReason: blocked,
    checks: checks,
  };
}

function formatGenerateOpsReport(report) {
  const lines = [
    `[OPS][POWER_CREEP] action ${report.action} | mode ${report.mode || "?"} | ` +
      `creep ${report.powerCreepName || "?"} | spawned ${report.spawned ? "yes" : "no"} | ` +
      `room ${report.currentRoomName || "unknown"} | ops ${fmt(report.opsCarried)} | ` +
      `free ${typeof report.freeCapacity === "number" ? fmt(report.freeCapacity) : "unknown"} | ` +
      `cooldown ${report.cooldown} | status ${report.status}`,
  ];

  if (report.blockedReason) {
    lines.push(`[OPS][POWER_CREEP] blocked ${report.blockedReason}`);
  }

  for (let i = 0; i < report.checks.length; i++) {
    const item = report.checks[i];
    lines.push(
      `[OPS][POWER_CREEP] ${item.ok ? "OK" : "BLOCK"} ${item.key}` +
        `${item.detail ? " - " + item.detail : ""}`,
    );
  }

  lines.push(`[OPS][POWER_CREEP] native ${report.nativeAction}`);

  if (report.mode === "check") {
    lines.push("[OPS][POWER_CREEP] dry run only; usePower not called.");
  } else if (report.executed) {
    lines.push(
      `[OPS][POWER_CREEP] usePower result ${report.apiResult} (${resultLabel(report.apiResult)})`,
    );
  } else {
    lines.push("[OPS][POWER_CREEP] usePower not called.");
  }

  return lines.join("\n");
}

function evaluateOperateSpawn(powerCreepName, roomName, targetArg, mode) {
  const normalizedMode = normalizeMode(mode);
  const checks = [];
  const room = Game.rooms && Game.rooms[roomName] ? Game.rooms[roomName] : null;
  const powerConstant = getOperateSpawnPowerConstant();
  const resourceType = getOpsResourceType();
  const powerCreep = getPowerCreepByName(powerCreepName);
  const powerCreepSpawned = isPowerCreepSpawned(powerCreep);
  const creepRoomName = getPowerCreepRoomName(powerCreep);
  const powerInfo = getPowerCreepPowerInfo(powerCreep, powerConstant, "PWR_OPERATE_SPAWN");
  const cooldown =
    powerInfo && typeof powerInfo.cooldown === "number" ? powerInfo.cooldown : 0;
  const opsCost = powerConstant !== null ? getPowerOpsCost(powerConstant) : null;
  const requiredRange = powerConstant !== null ? getPowerRange(powerConstant) : null;
  const opsCarried = powerCreep && powerCreep.store ? getStoreAmount(powerCreep, resourceType) : 0;
  const target = resolveOwnedSpawnTarget(room, targetArg);
  const range = powerCreepSpawned && target.spawn ? getRange(powerCreep, target.spawn) : null;
  const threat = hasActiveThreat(room);

  addLifecycleCheck(
    checks,
    "mode",
    normalizedMode === "check" || normalizedMode === "confirm",
    'use "check" or "confirm"',
    LIFECYCLE.BLOCKED_INVALID_MODE,
  );
  addLifecycleCheck(
    checks,
    "explicit confirm",
    normalizedMode === "confirm" || normalizedMode === "check",
    normalizedMode === "confirm"
      ? "confirmed"
      : normalizedMode === "check"
        ? "dry run; usePower not called"
        : 'use ops.operator("CREEP_NAME", "ROOM", "operateSpawn", "confirm")',
    LIFECYCLE.BLOCKED_INVALID_MODE,
  );
  addLifecycleCheck(
    checks,
    "Power Creeps registry",
    hasAnyPowerCreeps(),
    hasAnyPowerCreeps() ? "available" : "Game.powerCreeps missing or empty",
    LIFECYCLE.BLOCKED_NO_POWER_CREEPS,
  );
  addLifecycleCheck(
    checks,
    "named Power Creep",
    !!powerCreep,
    powerCreep ? powerCreep.name || powerCreepName : "not found",
    LIFECYCLE.BLOCKED_MISSING_POWER_CREEP,
  );
  addLifecycleCheck(
    checks,
    "spawned Power Creep",
    !!powerCreep && powerCreepSpawned,
    powerCreepSpawned ? `in ${creepRoomName || "unknown"}` : "not spawned",
    LIFECYCLE.BLOCKED_NOT_SPAWNED,
  );
  addLifecycleCheck(
    checks,
    "visible Power Creep position",
    !!(powerCreep && powerCreep.pos),
    powerCreep && powerCreep.pos ? formatPosition(powerCreep.pos) : "position unavailable",
    LIFECYCLE.BLOCKED_NO_POSITION,
  );
  addLifecycleCheck(
    checks,
    "owned room",
    !!(room && room.controller && room.controller.my),
    room ? "visible" : "room not visible or not owned",
    LIFECYCLE.BLOCKED_NOT_OWNED,
  );
  addLifecycleCheck(
    checks,
    "PWR_OPERATE_SPAWN constant",
    powerConstant !== null,
    powerConstant !== null ? "available" : "missing in runtime",
    LIFECYCLE.BLOCKED_MISSING_CONSTANT,
  );
  addLifecycleCheck(
    checks,
    "usePower method",
    !!(powerCreep && typeof powerCreep.usePower === "function"),
    powerCreep && typeof powerCreep.usePower === "function" ? "available" : "unavailable",
    LIFECYCLE.BLOCKED_NO_USE_POWER,
  );
  addLifecycleCheck(
    checks,
    "OPERATE_SPAWN power",
    !!powerInfo,
    powerInfo ? `level ${powerInfo.level || "?"}` : "missing PWR_OPERATE_SPAWN",
    LIFECYCLE.BLOCKED_MISSING_POWER,
  );
  addLifecycleCheck(
    checks,
    "OPERATE_SPAWN cooldown",
    !!powerInfo && cooldown <= 0,
    powerInfo ? `cooldown ${cooldown}` : "power unavailable",
    LIFECYCLE.BLOCKED_COOLDOWN,
  );
  addLifecycleCheck(
    checks,
    "ops cost",
    opsCost === null || opsCarried >= opsCost,
    opsCost === null ? `carried ${fmt(opsCarried)} cost unknown` : `${fmt(opsCarried)}/${fmt(opsCost)}`,
    LIFECYCLE.BLOCKED_INSUFFICIENT_OPS,
  );
  addLifecycleCheck(
    checks,
    "owned spawn target",
    !!target.spawn && !target.status,
    target.detail,
    target.status || LIFECYCLE.BLOCKED_NO_TARGET,
  );
  addLifecycleCheck(
    checks,
    "target position visible",
    !!(target.spawn && target.spawn.pos),
    target.spawn && target.spawn.pos ? formatPosition(target.spawn.pos) : "position unavailable",
    LIFECYCLE.BLOCKED_NO_TARGET,
  );
  addLifecycleCheck(
    checks,
    "Power Creep range",
    requiredRange === null || (typeof range === "number" && range <= requiredRange),
    typeof range === "number"
      ? `range ${range}/${requiredRange === null ? "unknown" : requiredRange}`
      : "range unavailable",
    LIFECYCLE.BLOCKED_NOT_IN_RANGE,
  );
  addLifecycleCheck(
    checks,
    "no active threat",
    !threat,
    threat ? "active threat" : "clear",
    LIFECYCLE.BLOCKED_THREAT,
  );

  const blocked = firstBlockedStatus(checks, LIFECYCLE.BLOCKED_INVALID_MODE);
  return {
    action: "operateSpawn",
    mode: normalizedMode || String(mode || ""),
    roomName: roomName,
    powerCreepName: powerCreepName,
    powerCreep: powerCreep,
    spawned: !!(powerCreep && powerCreepSpawned),
    currentRoomName: creepRoomName,
    opsCarried: opsCarried,
    opsCost: opsCost,
    cooldown: cooldown,
    requiredRange: requiredRange,
    range: range,
    target: target.spawn,
    targetName: target.spawn && target.spawn.name ? target.spawn.name : null,
    targetId: target.spawn ? target.spawn.id : null,
    targetRoomName: target.spawn && target.spawn.pos ? target.spawn.pos.roomName : roomName,
    targetDetail: target.detail,
    targetDefaulted: target.defaulted,
    requestedTarget: target.requested,
    nativeAction: nativeActionLabel("operateSpawn"),
    powerConstant: powerConstant,
    status: blocked || LIFECYCLE.READY,
    blockedReason: blocked,
    checks: checks,
  };
}

function formatOperateSpawnReport(report) {
  const targetLabel = report.targetName || report.targetId || "none";
  const lines = [
    `[OPS][POWER_CREEP] action ${report.action} | mode ${report.mode || "?"} | ` +
      `creep ${report.powerCreepName || "?"} | room ${report.roomName || "?"} | ` +
      `target spawn ${targetLabel} | status ${report.status}`,
    `[OPS][POWER_CREEP] ops ${fmt(report.opsCarried)}/${report.opsCost === null ? "unknown" : fmt(report.opsCost)} | ` +
      `cooldown ${report.cooldown} | range ${
        typeof report.range === "number" ? report.range : "unavailable"
      }/${report.requiredRange === null ? "unknown" : report.requiredRange}`,
    `[OPS][POWER_CREEP] target name ${report.targetName || "unknown"} | id ${report.targetId || "unknown"} | ` +
      `room ${report.targetRoomName || "unknown"} | resolution ${report.targetDetail}`,
  ];

  if (report.targetDefaulted) {
    lines.push("[OPS][POWER_CREEP] target defaulted to first owned spawn in room.");
  }
  if (report.requestedTarget) {
    lines.push(`[OPS][POWER_CREEP] requested target ${report.requestedTarget}`);
  }
  if (report.blockedReason) {
    lines.push(`[OPS][POWER_CREEP] blocked ${report.blockedReason}`);
  }

  for (let i = 0; i < report.checks.length; i++) {
    const item = report.checks[i];
    lines.push(
      `[OPS][POWER_CREEP] ${item.ok ? "OK" : "BLOCK"} ${item.key}` +
        `${item.detail ? " - " + item.detail : ""}`,
    );
  }

  lines.push(`[OPS][POWER_CREEP] native ${report.nativeAction}`);

  if (report.mode === "check") {
    lines.push("[OPS][POWER_CREEP] dry run only; usePower not called.");
  } else if (report.executed) {
    lines.push(
      `[OPS][POWER_CREEP] usePower result ${report.apiResult} (${resultLabel(report.apiResult)})`,
    );
  } else {
    lines.push("[OPS][POWER_CREEP] usePower not called.");
  }

  return lines.join("\n");
}

function evaluateOperateExtension(powerCreepName, roomName, mode) {
  const normalizedMode = normalizeMode(mode);
  const checks = [];
  const room = Game.rooms && Game.rooms[roomName] ? Game.rooms[roomName] : null;
  const powerConstant = getOperateExtensionPowerConstant();
  const resourceType = getOpsResourceType();
  const powerCreep = getPowerCreepByName(powerCreepName);
  const powerCreepSpawned = isPowerCreepSpawned(powerCreep);
  const creepRoomName = getPowerCreepRoomName(powerCreep);
  const powerInfo = getPowerCreepPowerInfo(powerCreep, powerConstant, "PWR_OPERATE_EXTENSION");
  const cooldown =
    powerInfo && typeof powerInfo.cooldown === "number" ? powerInfo.cooldown : 0;
  const opsCost = powerConstant !== null ? getPowerOpsCost(powerConstant) : null;
  const requiredRange = powerConstant !== null ? getPowerRange(powerConstant) : null;
  const opsCarried = powerCreep && powerCreep.store ? getStoreAmount(powerCreep, resourceType) : 0;
  const target = resolveOwnedControllerTarget(room);
  const range = powerCreepSpawned && target.controller ? getRange(powerCreep, target.controller) : null;
  const threat = hasActiveThreat(room);

  addLifecycleCheck(
    checks,
    "mode",
    normalizedMode === "check" || normalizedMode === "confirm",
    'use "check" or "confirm"',
    LIFECYCLE.BLOCKED_INVALID_MODE,
  );
  addLifecycleCheck(
    checks,
    "explicit confirm",
    normalizedMode === "confirm" || normalizedMode === "check",
    normalizedMode === "confirm"
      ? "confirmed"
      : normalizedMode === "check"
        ? "dry run; usePower not called"
        : 'use ops.operator("CREEP_NAME", "ROOM", "operateExtension", "confirm")',
    LIFECYCLE.BLOCKED_INVALID_MODE,
  );
  addLifecycleCheck(
    checks,
    "Power Creeps registry",
    hasAnyPowerCreeps(),
    hasAnyPowerCreeps() ? "available" : "Game.powerCreeps missing or empty",
    LIFECYCLE.BLOCKED_NO_POWER_CREEPS,
  );
  addLifecycleCheck(
    checks,
    "named Power Creep",
    !!powerCreep,
    powerCreep ? powerCreep.name || powerCreepName : "not found",
    LIFECYCLE.BLOCKED_MISSING_POWER_CREEP,
  );
  addLifecycleCheck(
    checks,
    "spawned Power Creep",
    !!powerCreep && powerCreepSpawned,
    powerCreepSpawned ? `in ${creepRoomName || "unknown"}` : "not spawned",
    LIFECYCLE.BLOCKED_NOT_SPAWNED,
  );
  addLifecycleCheck(
    checks,
    "visible Power Creep position",
    !!(powerCreep && powerCreep.pos),
    powerCreep && powerCreep.pos ? formatPosition(powerCreep.pos) : "position unavailable",
    LIFECYCLE.BLOCKED_NO_POSITION,
  );
  addLifecycleCheck(
    checks,
    "owned room",
    !!(room && room.controller && room.controller.my),
    room ? "visible" : "room not visible or not owned",
    LIFECYCLE.BLOCKED_NOT_OWNED,
  );
  addLifecycleCheck(
    checks,
    "room controller target",
    !!target.controller && !target.status,
    target.detail,
    target.status || LIFECYCLE.BLOCKED_NO_TARGET,
  );
  addLifecycleCheck(
    checks,
    "target position visible",
    !!(target.controller && target.controller.pos),
    target.controller && target.controller.pos ? formatPosition(target.controller.pos) : "position unavailable",
    LIFECYCLE.BLOCKED_NO_TARGET,
  );
  addLifecycleCheck(
    checks,
    "Power Creep room",
    !!powerCreep && !!creepRoomName && creepRoomName === roomName,
    creepRoomName ? `in ${creepRoomName}` : "room unavailable",
    LIFECYCLE.BLOCKED_ROOM_MISMATCH,
  );
  addLifecycleCheck(
    checks,
    "PWR_OPERATE_EXTENSION constant",
    powerConstant !== null,
    powerConstant !== null ? "available" : "missing in runtime",
    LIFECYCLE.BLOCKED_MISSING_CONSTANT,
  );
  addLifecycleCheck(
    checks,
    "usePower method",
    !!(powerCreep && typeof powerCreep.usePower === "function"),
    powerCreep && typeof powerCreep.usePower === "function" ? "available" : "unavailable",
    LIFECYCLE.BLOCKED_NO_USE_POWER,
  );
  addLifecycleCheck(
    checks,
    "OPERATE_EXTENSION power",
    !!powerInfo,
    powerInfo ? `level ${powerInfo.level || "?"}` : "missing PWR_OPERATE_EXTENSION",
    LIFECYCLE.BLOCKED_MISSING_POWER,
  );
  addLifecycleCheck(
    checks,
    "OPERATE_EXTENSION cooldown",
    !!powerInfo && cooldown <= 0,
    powerInfo ? `cooldown ${cooldown}` : "power unavailable",
    LIFECYCLE.BLOCKED_COOLDOWN,
  );
  addLifecycleCheck(
    checks,
    "ops cost",
    opsCost === null || opsCarried >= opsCost,
    opsCost === null ? `carried ${fmt(opsCarried)} cost unknown` : `${fmt(opsCarried)}/${fmt(opsCost)}`,
    LIFECYCLE.BLOCKED_INSUFFICIENT_OPS,
  );
  addLifecycleCheck(
    checks,
    "Power Creep range",
    requiredRange === null || (typeof range === "number" && range <= requiredRange),
    typeof range === "number"
      ? `range ${range}/${requiredRange === null ? "unknown" : requiredRange}`
      : "range unavailable",
    LIFECYCLE.BLOCKED_NOT_IN_RANGE,
  );
  addLifecycleCheck(
    checks,
    "no active threat",
    !threat,
    threat ? "active threat" : "clear",
    LIFECYCLE.BLOCKED_THREAT,
  );

  const blocked = firstBlockedStatus(checks, LIFECYCLE.BLOCKED_INVALID_MODE);
  return {
    action: "operateExtension",
    mode: normalizedMode || String(mode || ""),
    roomName: roomName,
    powerCreepName: powerCreepName,
    powerCreep: powerCreep,
    spawned: !!(powerCreep && powerCreepSpawned),
    currentRoomName: creepRoomName,
    opsCarried: opsCarried,
    opsCost: opsCost,
    cooldown: cooldown,
    requiredRange: requiredRange,
    range: range,
    target: target.controller,
    targetName: null,
    targetId: target.controller ? target.controller.id : null,
    targetRoomName: target.controller && target.controller.pos ? target.controller.pos.roomName : roomName,
    targetDetail: target.detail,
    nativeAction: nativeActionLabel("operateExtension"),
    powerConstant: powerConstant,
    status: blocked || LIFECYCLE.READY,
    blockedReason: blocked,
    checks: checks,
  };
}

function formatOperateExtensionReport(report) {
  const targetLabel = report.targetId || "none";
  const lines = [
    `[OPS][POWER_CREEP] action ${report.action} | mode ${report.mode || "?"} | ` +
      `creep ${report.powerCreepName || "?"} | room ${report.roomName || "?"} | ` +
      `target controller ${targetLabel} | status ${report.status}`,
    `[OPS][POWER_CREEP] ops ${fmt(report.opsCarried)}/${report.opsCost === null ? "unknown" : fmt(report.opsCost)} | ` +
      `cooldown ${report.cooldown} | range ${
        typeof report.range === "number" ? report.range : "unavailable"
      }/${report.requiredRange === null ? "unknown" : report.requiredRange}`,
    `[OPS][POWER_CREEP] target name ${report.targetName || "unknown"} | id ${report.targetId || "unknown"} | ` +
      `room ${report.targetRoomName || "unknown"} | resolution ${report.targetDetail}`,
  ];

  if (report.blockedReason) {
    lines.push(`[OPS][POWER_CREEP] blocked ${report.blockedReason}`);
  }

  for (let i = 0; i < report.checks.length; i++) {
    const item = report.checks[i];
    lines.push(
      `[OPS][POWER_CREEP] ${item.ok ? "OK" : "BLOCK"} ${item.key}` +
        `${item.detail ? " - " + item.detail : ""}`,
    );
  }

  lines.push(`[OPS][POWER_CREEP] native ${report.nativeAction}`);

  if (report.mode === "check") {
    lines.push("[OPS][POWER_CREEP] dry run only; usePower not called.");
  } else if (report.executed) {
    lines.push(
      `[OPS][POWER_CREEP] usePower result ${report.apiResult} (${resultLabel(report.apiResult)})`,
    );
  } else {
    lines.push("[OPS][POWER_CREEP] usePower not called.");
  }

  return lines.join("\n");
}

function evaluatePowerCreepLifecycle(powerCreepName, action, roomName, mode) {
  const normalizedAction = normalizeAction(action);
  const normalizedMode = normalizeMode(mode);
  const checks = [];
  const room = Game.rooms && Game.rooms[roomName] ? Game.rooms[roomName] : null;
  const powerCreep = getPowerCreepByName(powerCreepName);
  const powerCreepSpawned = isPowerCreepSpawned(powerCreep);
  const allPowerSpawns = getAllPowerSpawns(room);
  const powerSpawns = getOwnedPowerSpawns(room);
  const powerSpawn = powerSpawns.length > 0 ? powerSpawns[0] : null;
  const controllerLevel = room && room.controller ? room.controller.level || 0 : 0;
  const threat = hasActiveThreat(room);
  const cpuPressure = room ? getCriticalCpuPressure(room.name) : false;
  const range = powerCreepSpawned && powerSpawn ? getRange(powerCreep, powerSpawn) : null;
  const creepRoomName = getPowerCreepRoomName(powerCreep);

  addLifecycleCheck(
    checks,
    "mode",
    normalizedMode === "check" || normalizedMode === "confirm",
    'use "check" or "confirm"',
    LIFECYCLE.BLOCKED_INVALID_MODE,
  );
  addLifecycleCheck(
    checks,
    "action",
    normalizedAction === "spawn" || normalizedAction === "renew",
    'use "spawn" or "renew"',
    LIFECYCLE.BLOCKED_INVALID_ACTION,
  );
  addLifecycleCheck(
    checks,
    "Power Creeps registry",
    hasAnyPowerCreeps(),
    hasAnyPowerCreeps() ? "available" : "Game.powerCreeps missing or empty",
    LIFECYCLE.BLOCKED_NO_POWER_CREEPS,
  );
  addLifecycleCheck(
    checks,
    "named Power Creep",
    !!powerCreep,
    powerCreep ? powerCreep.name || powerCreepName : "not found",
    LIFECYCLE.BLOCKED_MISSING_POWER_CREEP,
  );

  if (normalizedAction === "spawn") {
    addLifecycleCheck(
      checks,
      "not already spawned",
      !!powerCreep && !powerCreepSpawned,
      powerCreepSpawned ? `currently in ${creepRoomName || "unknown"}` : "unspawned",
      LIFECYCLE.BLOCKED_ALREADY_SPAWNED,
    );
  } else if (normalizedAction === "renew") {
    addLifecycleCheck(
      checks,
      "spawned Power Creep",
      !!powerCreep && powerCreepSpawned,
      powerCreepSpawned ? `in ${creepRoomName || "unknown"}` : "not spawned",
      LIFECYCLE.BLOCKED_NOT_SPAWNED,
    );
  }

  addLifecycleCheck(
    checks,
    "owned room",
    !!(room && room.controller && room.controller.my),
    room ? "visible" : "room not visible or not owned",
    LIFECYCLE.BLOCKED_NOT_OWNED,
  );
  addLifecycleCheck(
    checks,
    "RCL8",
    normalizedAction !== "spawn" || controllerLevel >= 8,
    `RCL ${controllerLevel}`,
    LIFECYCLE.BLOCKED_RCL,
  );
  addLifecycleCheck(
    checks,
    "Power Spawn exists",
    allPowerSpawns.length > 0,
    `${allPowerSpawns.length} found`,
    LIFECYCLE.BLOCKED_NO_POWER_SPAWN,
  );
  addLifecycleCheck(
    checks,
    "Power Spawn owned",
    powerSpawns.length > 0,
    `${powerSpawns.length} owned`,
    LIFECYCLE.BLOCKED_POWER_SPAWN_NOT_OWNED,
  );

  if (normalizedAction === "renew") {
    addLifecycleCheck(
      checks,
      "same room",
      !!powerCreep && creepRoomName === roomName,
      creepRoomName ? `Power Creep in ${creepRoomName}` : "Power Creep has no room",
      LIFECYCLE.BLOCKED_ROOM_MISMATCH,
    );
    addLifecycleCheck(
      checks,
      "Power Spawn range",
      typeof range === "number" && range <= 1,
      typeof range === "number" ? `range ${range}` : "range unavailable",
      LIFECYCLE.BLOCKED_NOT_IN_RANGE,
    );
  }

  addLifecycleCheck(
    checks,
    "no active threat",
    !threat,
    threat ? "active threat" : "clear",
    LIFECYCLE.BLOCKED_THREAT,
  );
  addLifecycleCheck(
    checks,
    "no critical CPU pressure",
    !cpuPressure,
    cpuPressure ? "critical" : "clear",
    LIFECYCLE.BLOCKED_CPU_PRESSURE,
  );

  const blocked = firstBlockedStatus(checks, LIFECYCLE.BLOCKED_INVALID_MODE);
  return {
    action: normalizedAction || String(action || ""),
    mode: normalizedMode || String(mode || ""),
    roomName: roomName,
    powerCreepName: powerCreepName,
    powerCreep: powerCreep,
    powerSpawn: powerSpawn,
    targetType: "Power Spawn",
    targetId: powerSpawn ? powerSpawn.id : null,
    nativeAction: nativeActionLabel(normalizedAction),
    status: blocked || LIFECYCLE.READY,
    blockedReason: blocked,
    checks: checks,
  };
}

function evaluateEnablementConfirm(roomName, mode, powerCreepName) {
  const normalizedMode = normalizeMode(mode);
  const readiness = module.exports.getRoomEnablementReadiness(roomName);
  const room = Game.rooms && Game.rooms[roomName] ? Game.rooms[roomName] : null;
  const powerCreep = getPowerCreepByName(powerCreepName);
  const powerCreepSpawned = isPowerCreepSpawned(powerCreep);
  const controller = room && room.controller ? room.controller : null;
  const creepRoomName = getPowerCreepRoomName(powerCreep);
  const range = powerCreepSpawned && controller ? getRange(powerCreep, controller) : null;
  const checks = [];

  addLifecycleCheck(
    checks,
    "mode",
    normalizedMode === "check" || normalizedMode === "confirm",
    'use "check" or "confirm"',
    LIFECYCLE.BLOCKED_INVALID_MODE,
  );
  addLifecycleCheck(
    checks,
    "explicit confirm",
    normalizedMode === "confirm",
    normalizedMode === "confirm" ? "confirmed" : 'use ops.powerEnable("ROOM", "confirm", "CREEP_NAME")',
    LIFECYCLE.BLOCKED_INVALID_MODE,
  );
  addLifecycleCheck(
    checks,
    "Power Creeps registry",
    hasAnyPowerCreeps(),
    hasAnyPowerCreeps() ? "available" : "Game.powerCreeps missing or empty",
    LIFECYCLE.BLOCKED_NO_POWER_CREEPS,
  );
  addLifecycleCheck(
    checks,
    "named Power Creep",
    !!powerCreepName && !!powerCreep,
    powerCreep ? powerCreep.name || powerCreepName : "not found",
    LIFECYCLE.BLOCKED_MISSING_POWER_CREEP,
  );
  addLifecycleCheck(
    checks,
    "spawned Power Creep",
    !!powerCreep && powerCreepSpawned,
    powerCreepSpawned ? `in ${creepRoomName || "unknown"}` : "not spawned",
    LIFECYCLE.BLOCKED_NOT_SPAWNED,
  );
  addLifecycleCheck(
    checks,
    "owned room",
    !!(room && room.controller && room.controller.my),
    room ? "visible" : "room not visible or not owned",
    LIFECYCLE.BLOCKED_NOT_OWNED,
  );
  addLifecycleCheck(
    checks,
    "controller exists",
    !!controller,
    controller ? "controller visible" : "missing",
    LIFECYCLE.BLOCKED_NO_CONTROLLER,
  );
  addLifecycleCheck(
    checks,
    "RCL8",
    !!(controller && controller.level >= 8),
    controller ? `RCL ${controller.level || 0}` : "missing",
    LIFECYCLE.BLOCKED_RCL,
  );
  addLifecycleCheck(
    checks,
    "enablement readiness",
    readiness.status === ENABLEMENT.READY_TO_ENABLE,
    readiness.status,
    LIFECYCLE.BLOCKED_ENABLEMENT_READINESS,
  );
  addLifecycleCheck(
    checks,
    "same room",
    !!powerCreep && creepRoomName === roomName,
    creepRoomName ? `Power Creep in ${creepRoomName}` : "Power Creep has no room",
    LIFECYCLE.BLOCKED_ROOM_MISMATCH,
  );
  addLifecycleCheck(
    checks,
    "controller range",
    typeof range === "number" && range <= 1,
    typeof range === "number" ? `range ${range}` : "range unavailable",
    LIFECYCLE.BLOCKED_NOT_IN_RANGE,
  );

  const blocked = firstBlockedStatus(checks, LIFECYCLE.BLOCKED_INVALID_MODE);
  return {
    action: "enable",
    mode: normalizedMode || String(mode || ""),
    roomName: roomName,
    powerCreepName: powerCreepName,
    powerCreep: powerCreep,
    controller: controller,
    targetType: "Controller",
    targetId: controller ? controller.id : null,
    nativeAction: nativeActionLabel("enable"),
    status: blocked || LIFECYCLE.READY,
    blockedReason: blocked,
    checks: checks,
  };
}

module.exports = {
  ENABLEMENT: ENABLEMENT,
  LIFECYCLE: LIFECYCLE,

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

  formatOperatorReadiness: formatOperatorReadiness,

  formatOperateSpawn(powerCreepName, roomName, targetArg, mode) {
    const report = evaluateOperateSpawn(powerCreepName, roomName, targetArg, mode);

    if (report.mode === "confirm" && !report.blockedReason) {
      report.executed = true;
      report.apiResult = report.powerCreep.usePower(report.powerConstant, report.target);
      report.status = report.apiResult === OK ? "EXECUTED" : "API_ERROR";
    } else {
      report.executed = false;
    }

    return formatOperateSpawnReport(report);
  },

  formatOperateExtension(powerCreepName, roomName, mode) {
    const report = evaluateOperateExtension(powerCreepName, roomName, mode);

    if (report.mode === "confirm" && !report.blockedReason) {
      report.executed = true;
      report.apiResult = report.powerCreep.usePower(report.powerConstant, report.target);
      report.status = report.apiResult === OK ? "EXECUTED" : "API_ERROR";
    } else {
      report.executed = false;
    }

    return formatOperateExtensionReport(report);
  },

  formatPowerCreepLifecycle(powerCreepName, action, roomName, mode) {
    const report = evaluatePowerCreepLifecycle(powerCreepName, action, roomName, mode);

    if (report.mode === "confirm" && !report.blockedReason) {
      report.executed = true;
      report.apiResult =
        report.action === "spawn"
          ? report.powerSpawn.spawnPowerCreep(report.powerCreep)
          : report.powerSpawn.renewPowerCreep(report.powerCreep);
      report.status = report.apiResult === OK ? "EXECUTED" : "API_ERROR";
    } else {
      report.executed = false;
    }

    return formatLifecycleReport(report);
  },

  formatPowerCreepPosition(powerCreepName, roomName) {
    return formatPositionReport(evaluatePowerCreepPosition(powerCreepName, roomName));
  },

  formatPowerCreepMove(powerCreepName, roomName, targetType, mode) {
    const report = evaluatePowerCreepMove(powerCreepName, roomName, targetType, mode);

    if (report.mode === "confirm" && !report.blockedReason) {
      report.executed = true;
      report.apiResult = report.powerCreep.moveTo(report.target);
      report.status = report.apiResult === OK ? "EXECUTED" : "API_ERROR";
    } else {
      report.executed = false;
    }

    return formatMoveReport(report);
  },

  formatPowerCreepGenerateOps(powerCreepName, mode) {
    const report = evaluateGenerateOps(powerCreepName, mode);

    if (report.mode === "confirm" && !report.blockedReason) {
      report.executed = true;
      report.apiResult = report.powerCreep.usePower(report.powerConstant);
      report.status = report.apiResult === OK ? "EXECUTED" : "API_ERROR";
    } else {
      report.executed = false;
    }

    return formatGenerateOpsReport(report);
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

  formatEnablementConfirm(roomName, mode, powerCreepName) {
    const report = evaluateEnablementConfirm(roomName, mode, powerCreepName);

    if (report.mode === "confirm" && !report.blockedReason) {
      report.executed = true;
      report.apiResult = report.powerCreep.enableRoom(report.controller);
      report.status = report.apiResult === OK ? "EXECUTED" : "API_ERROR";
    } else {
      report.executed = false;
    }

    return formatLifecycleReport(report);
  },
};
