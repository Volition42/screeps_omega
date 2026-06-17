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
  return "none";
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
