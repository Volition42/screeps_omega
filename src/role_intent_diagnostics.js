const TICK_COUNTER_LIMIT = 20;
const CONTENTION_LIMIT = 5;

const ENERGY_SPEND_ORDER = [
  "harvest",
  "haul",
  "build",
  "repair-critical",
  "repair-noncritical",
  "upgrade",
  "reserve-bank",
  "idle",
  "fallback",
];

const DEFERRED_ORDER = [
  "construction-reserve-pressure",
  "repair-reserve-pressure",
  "upgrade-reserve-pressure",
  "upgrade-gcl-push-blocked",
  "invalid-target",
  "missing-energy",
  "missing-request",
  "no-safe-work",
];

const STALE_RELEASE_ORDER = [
  "ops-full-target",
  "ops-empty-source",
  "ops-missing-target",
  "ops-missing-source",
  "ops-invalid-request",
  "cached-invalid-target",
];

function getRoomName(roomOrName) {
  if (!roomOrName) return null;
  if (typeof roomOrName === "string") return roomOrName;
  return roomOrName.name || null;
}

function getRoomMemory(roomName) {
  if (!roomName) return null;
  if (!Memory.rooms) Memory.rooms = {};
  if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
  if (!Memory.rooms[roomName].roleIntent) {
    Memory.rooms[roomName].roleIntent = {};
  }

  const memory = Memory.rooms[roomName].roleIntent;
  if (memory.tick !== Game.time) {
    memory.tick = Game.time;
    memory.deferred = {};
    memory.staleReleases = {};
  }
  if (!memory.deferred) memory.deferred = {};
  if (!memory.staleReleases) memory.staleReleases = {};
  return memory;
}

function incrementCounter(counter, label) {
  if (!counter || !label) return;
  if (!Object.prototype.hasOwnProperty.call(counter, label)) {
    const keys = Object.keys(counter);
    if (keys.length >= TICK_COUNTER_LIMIT) return;
  }
  counter[label] = Math.min(999, (counter[label] || 0) + 1);
}

function isRecordingSuppressed() {
  return !!(
    Memory.stats &&
    Memory.stats.runtime &&
    Memory.stats.runtime.pressure === "critical"
  );
}

function recordDeferred(roomOrName, label) {
  if (isRecordingSuppressed()) return;
  const memory = getRoomMemory(getRoomName(roomOrName));
  if (!memory) return;
  incrementCounter(memory.deferred, label);
}

function recordStaleRelease(roomOrName, label) {
  if (isRecordingSuppressed()) return;
  const memory = getRoomMemory(getRoomName(roomOrName));
  if (!memory) return;
  incrementCounter(memory.staleReleases, label);
}

function getDiagnosticMemory(roomName) {
  return getRoomMemory(roomName) || {
    tick: Game.time,
    deferred: {},
    staleReleases: {},
  };
}

function getTarget(id) {
  return id && typeof Game !== "undefined" && Game.getObjectById
    ? Game.getObjectById(id)
    : null;
}

function getControllerId(room) {
  return room && room.controller && room.controller.id
    ? room.controller.id
    : "controller";
}

function addCount(counts, label, amount) {
  const value = typeof amount === "number" ? amount : 1;
  counts[label] = (counts[label] || 0) + value;
}

function getStoredAmount(target, resourceType) {
  if (!target || !target.store) return 0;
  if (typeof target.store.getUsedCapacity === "function") {
    const used = target.store.getUsedCapacity(resourceType);
    if (typeof used === "number" && used > 0) return used;
  }
  return target.store[resourceType] || 0;
}

function getWorkTargetCategory(creep, room) {
  const role = creep.memory ? creep.memory.role : null;
  const memory = creep.memory || {};

  if (role === "repair") {
    if (memory.workTargetKind === "criticalRepair" || memory.workTargetKind === "importantRepair") {
      return "repair-critical";
    }
    if (
      memory.workTargetKind === "rampartRepair" ||
      memory.workTargetKind === "wallRepair" ||
      memory.workTargetKind === "roadRepair"
    ) {
      return "repair-noncritical";
    }
    if (memory.workTargetKind === "build") return "build";
    if (memory.workTargetKind === "upgrade") return "upgrade";
  }

  if (role === "worker") {
    const target = getTarget(memory.workTargetId);
    if (!target) return "fallback";
    if (target.progressTotal !== undefined) return "build";
    if (target.structureType === STRUCTURE_STORAGE) return "reserve-bank";
    if (room && room.controller && target.id === room.controller.id) return "upgrade";
    return "haul";
  }

  return "fallback";
}

function getCreepIntent(creep, room) {
  const memory = creep.memory || {};
  const role = memory.role || "unknown";
  const carriedEnergy = getStoredAmount(creep, RESOURCE_ENERGY);

  if (role === "worker") {
    if (memory.working) {
      const category = getWorkTargetCategory(creep, room);
      return {
        role: role,
        energy: category,
        active: category !== "fallback",
        targetId: memory.workTargetId || (category === "upgrade" ? getControllerId(room) : null),
        targetKind: category === "build" ? "construction-site" : category === "haul" ? "logistics-target" : category === "upgrade" ? "controller" : null,
      };
    }
    return {
      role: role,
      energy: memory.withdrawTargetId ? "harvest" : "idle",
      active: !!memory.withdrawTargetId,
      targetId: memory.withdrawTargetId || null,
      targetKind: memory.withdrawTargetId ? "logistics-source" : null,
    };
  }

  if (role === "repair") {
    if (memory.working) {
      const category = getWorkTargetCategory(creep, room);
      return {
        role: role,
        energy: category,
        active: category !== "fallback",
        targetId: memory.workTargetKind === "upgrade" ? getControllerId(room) : memory.workTargetId || null,
        targetKind: category === "build" ? "construction-site" : category.indexOf("repair") === 0 ? "repair-target" : category === "upgrade" ? "controller" : null,
      };
    }
    return {
      role: role,
      energy: memory.withdrawTargetId ? "harvest" : "idle",
      active: !!memory.withdrawTargetId,
      targetId: memory.withdrawTargetId || null,
      targetKind: memory.withdrawTargetId ? "logistics-source" : null,
    };
  }

  if (role === "upgrader") {
    return {
      role: role,
      energy: memory.upgrading ? "upgrade" : memory.withdrawTargetId ? "harvest" : "idle",
      active: !!(memory.upgrading || memory.withdrawTargetId),
      targetId: memory.upgrading ? getControllerId(room) : memory.withdrawTargetId || null,
      targetKind: memory.upgrading ? "controller" : memory.withdrawTargetId ? "logistics-source" : null,
    };
  }

  if (role === "hauler") {
    let targetId = null;
    let targetKind = null;
    if (memory.opsLogisticsTask) {
      targetId = carriedEnergy > 0 ? memory.opsLogisticsTask.deliveryId : memory.opsLogisticsTask.pickupId;
      targetKind = carriedEnergy > 0 ? "logistics-target" : "logistics-source";
    } else if (memory.advancedTask) {
      targetId = carriedEnergy > 0 ? memory.advancedTask.deliveryId : memory.advancedTask.pickupId;
      targetKind = carriedEnergy > 0 ? "logistics-target" : "logistics-source";
    } else if (memory.marketTask) {
      targetId = carriedEnergy > 0 ? memory.marketTask.deliveryId : memory.marketTask.pickupId;
      targetKind = carriedEnergy > 0 ? "logistics-target" : "logistics-source";
    } else if (memory.delivering) {
      targetId = memory.deliveryTargetId || null;
      targetKind = targetId ? "logistics-target" : null;
    } else {
      targetId = memory.pickupTargetId || null;
      targetKind = targetId ? "logistics-source" : null;
    }

    return {
      role: role,
      energy: targetId ? "haul" : "idle",
      active: !!targetId,
      targetId: targetId,
      targetKind: targetKind,
    };
  }

  if (role === "miner" || role === "mineral_miner") {
    return {
      role: role,
      energy: memory.sourceId || memory.targetId ? "harvest" : "idle",
      active: !!(memory.sourceId || memory.targetId),
      targetId: memory.sourceId || memory.targetId || null,
      targetKind: memory.sourceId || memory.targetId ? "logistics-source" : null,
    };
  }

  return {
    role: role,
    energy: "fallback",
    active: true,
    targetId: memory.targetId || null,
    targetKind: memory.targetId ? "logistics-target" : null,
  };
}

function formatCounter(counts, order) {
  const parts = [];
  const seen = {};

  for (let i = 0; i < order.length; i++) {
    const label = order[i];
    seen[label] = true;
    parts.push(label + ": " + (counts[label] || 0));
  }

  const extras = Object.keys(counts).sort();
  for (let j = 0; j < extras.length; j++) {
    const label = extras[j];
    if (seen[label]) continue;
    parts.push(label + ": " + counts[label]);
  }

  return parts.join(" | ");
}

function getLargestSink(energySpend) {
  let best = "none";
  let bestCount = 0;

  for (let i = 0; i < ENERGY_SPEND_ORDER.length; i++) {
    const label = ENERGY_SPEND_ORDER[i];
    const count = energySpend[label] || 0;
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }

  return bestCount > 0 ? best : "none";
}

function summarizeContention(targets) {
  const rows = [];
  const keys = Object.keys(targets).sort();

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const row = targets[key];
    if (!row || row.count <= 1) continue;
    rows.push({
      key: key,
      kind: row.kind,
      id: row.id,
      count: row.count,
    });
  }

  rows.sort(function (a, b) {
    if (b.count !== a.count) return b.count - a.count;
    return a.key.localeCompare(b.key);
  });

  return rows.slice(0, CONTENTION_LIMIT);
}

function build(room, state) {
  const creeps = state && state.homeCreeps ? state.homeCreeps : room.find(FIND_MY_CREEPS);
  const diagnostics = getDiagnosticMemory(room.name);
  const roleCounts = {};
  const energySpend = {};
  const targets = {};
  let active = 0;
  let idle = 0;

  for (let i = 0; i < creeps.length; i++) {
    const creep = creeps[i];
    const intent = getCreepIntent(creep, room);
    addCount(roleCounts, intent.role, 1);
    addCount(energySpend, intent.energy, 1);
    if (intent.active) active += 1;
    else idle += 1;

    if (intent.targetId && intent.targetKind) {
      const key = intent.targetKind + ":" + intent.targetId;
      if (!targets[key]) {
        targets[key] = {
          kind: intent.targetKind,
          id: intent.targetId,
          count: 0,
        };
      }
      targets[key].count += 1;
    }
  }

  return {
    roomName: room.name,
    tick: Game.time,
    creepCount: creeps.length,
    active: active,
    idle: idle,
    roleCounts: roleCounts,
    energySpend: energySpend,
    deferred: diagnostics.deferred || {},
    staleReleases: diagnostics.staleReleases || {},
    contention: summarizeContention(targets),
    largestSink: getLargestSink(energySpend),
    wasteSignals:
      idle +
      sumCounts(diagnostics.deferred || {}) +
      sumCounts(diagnostics.staleReleases || {}) +
      summarizeContention(targets).length,
  };
}

function sumCounts(counts) {
  const keys = Object.keys(counts || {});
  let total = 0;

  for (let i = 0; i < keys.length; i++) {
    total += counts[keys[i]] || 0;
  }

  return total;
}

function formatContention(rows) {
  if (!rows || rows.length === 0) return "none";
  return rows
    .map(function (row) {
      return row.kind + " " + row.id + ": " + row.count + " creeps";
    })
    .join(" | ");
}

function formatRoleCounts(counts) {
  const keys = Object.keys(counts || {}).sort();
  if (keys.length === 0) return "none";
  return keys
    .map(function (role) {
      return role + ": " + counts[role];
    })
    .join(" | ");
}

function formatLines(summary) {
  return [
    `[OPS][${summary.roomName}][ROLES]`,
    "Role Intent / Waste",
    "Creeps: " + summary.creepCount + " | Active: " + summary.active + " | Idle: " + summary.idle,
    "Roles: " + formatRoleCounts(summary.roleCounts),
    "Energy Spend: " + formatCounter(summary.energySpend, ENERGY_SPEND_ORDER),
    "Deferred: " + formatCounter(summary.deferred, DEFERRED_ORDER),
    "Stale Releases: " + formatCounter(summary.staleReleases, STALE_RELEASE_ORDER),
    "Contention: " + formatContention(summary.contention),
    "Largest Sink: " + summary.largestSink,
    "Visible Waste Signals: " + summary.wasteSignals,
    "Notes: inspect repeated high sinks or contention before changing task priorities",
  ];
}

module.exports = {
  ENERGY_SPEND_ORDER: ENERGY_SPEND_ORDER,
  DEFERRED_ORDER: DEFERRED_ORDER,
  STALE_RELEASE_ORDER: STALE_RELEASE_ORDER,
  recordDeferred: recordDeferred,
  recordStaleRelease: recordStaleRelease,
  isRecordingSuppressed: isRecordingSuppressed,
  getDiagnosticMemory: getDiagnosticMemory,
  build: build,
  formatLines: formatLines,
};
