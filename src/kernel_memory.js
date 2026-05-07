const config = require("config");
const scheduler = require("scheduler");

const FULL_CLEANUP_INTERVAL = 500;
const ROOM_MEMORY_STALE_AGE = 5000;

var lastFullCleanupTick = 0;

function getSettings() {
  const settings = config.MEMORY || {};
  return {
    enabled: settings.ROOM_REVIEW_ENABLED !== false,
    interval:
      typeof settings.ROOM_REVIEW_INTERVAL === "number"
        ? settings.ROOM_REVIEW_INTERVAL
        : 500,
    roomCooldown:
      typeof settings.ROOM_REVIEW_ROOM_COOLDOWN === "number"
        ? settings.ROOM_REVIEW_ROOM_COOLDOWN
        : 5000,
    maxRooms:
      typeof settings.ROOM_REVIEW_MAX_ROOMS === "number"
        ? Math.max(1, settings.ROOM_REVIEW_MAX_ROOMS)
        : 1,
    minBucket:
      typeof settings.ROOM_REVIEW_MIN_BUCKET === "number"
        ? settings.ROOM_REVIEW_MIN_BUCKET
        : 3000,
  };
}

function ensureReviewMemory() {
  if (!Memory.runtime) Memory.runtime = {};
  if (!Memory.runtime.roomReview) {
    Memory.runtime.roomReview = {
      lastRun: 0,
      cursor: 0,
      lastByRoom: {},
      lastSummary: null,
    };
  }
  if (!Memory.runtime.roomReview.lastByRoom) {
    Memory.runtime.roomReview.lastByRoom = {};
  }

  return Memory.runtime.roomReview;
}

function getRoomMemory(roomName) {
  if (!Memory.rooms) Memory.rooms = {};
  if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
  return Memory.rooms[roomName];
}

function hasObject(id) {
  return !!(id && Game.getObjectById(id));
}

function hasRoomHostiles(state) {
  return !!(
    state &&
    (
      (state.hostileCreeps && state.hostileCreeps.length > 0) ||
      (state.hostilePowerCreeps && state.hostilePowerCreeps.length > 0) ||
      (state.hostileStructures && state.hostileStructures.length > 0)
    )
  );
}

function getTowers(state) {
  return state && state.structuresByType && state.structuresByType[STRUCTURE_TOWER]
    ? state.structuresByType[STRUCTURE_TOWER]
    : [];
}

function getStoredEnergy(structure) {
  if (!structure || !structure.store) return 0;
  return structure.store[RESOURCE_ENERGY] || 0;
}

function isRoomEnergyReady(room) {
  if (!room) return false;
  const capacity = room.energyCapacityAvailable || 0;
  if (capacity <= 0) return true;
  return room.energyAvailable >= capacity || room.energyAvailable >= capacity * 0.95;
}

function isTowerEmergencyReady(state) {
  const towers = getTowers(state);
  if (towers.length <= 0) return true;
  const threshold =
    config.LOGISTICS && typeof config.LOGISTICS.towerEmergencyThreshold === "number"
      ? config.LOGISTICS.towerEmergencyThreshold
      : 400;

  for (let i = 0; i < towers.length; i++) {
    if (getStoredEnergy(towers[i]) >= threshold) return true;
  }

  return false;
}

function countDefenseQueue(queue) {
  let count = 0;
  for (let i = 0; i < queue.length; i++) {
    const request = queue[i];
    if (request && (request.role === "defender" || request.defenseType || request.operation === "defense_support")) {
      count++;
    }
  }
  return count;
}

function pushChanged(changed, key) {
  if (changed.indexOf(key) === -1) changed.push(key);
}

function pruneSpawnQueue(room, state, roomMemory, changed) {
  const queue = roomMemory.spawnQueue || [];
  if (!Array.isArray(queue) || queue.length <= 0) {
    if (roomMemory.spawnQueue && !Array.isArray(roomMemory.spawnQueue)) {
      delete roomMemory.spawnQueue;
      pushChanged(changed, "spawnQueue");
    }
    return [];
  }

  const sourcesById = {};
  const sources = state && state.sources ? state.sources : room.find(FIND_SOURCES);
  for (let i = 0; i < sources.length; i++) {
    sourcesById[sources[i].id] = true;
  }

  const mineralsById = {};
  const minerals = state && state.minerals ? state.minerals : room.find(FIND_MINERALS);
  for (let j = 0; j < minerals.length; j++) {
    mineralsById[minerals[j].id] = true;
  }

  const next = [];
  for (let k = 0; k < queue.length; k++) {
    const request = queue[k];
    if (!request || typeof request !== "object" || !request.role) continue;
    if (request.homeRoom && request.homeRoom !== room.name && !request.targetRoom) continue;
    if (request.sourceId && !sourcesById[request.sourceId] && !hasObject(request.sourceId)) continue;
    if (request.targetId && request.role === "mineral_miner" && !mineralsById[request.targetId]) continue;
    if (
      request.targetId &&
      request.role !== "mineral_miner" &&
      (!request.targetRoom || request.targetRoom === room.name) &&
      !hasObject(request.targetId)
    ) {
      continue;
    }
    if (request.role === "mineral_miner") {
      const extractors =
        state && state.structuresByType && state.structuresByType[STRUCTURE_EXTRACTOR]
          ? state.structuresByType[STRUCTURE_EXTRACTOR]
          : [];
      if (extractors.length <= 0 || !state.mineralContainer) continue;
    }

    next.push(request);
  }

  if (next.length !== queue.length) {
    roomMemory.spawnQueue = next;
    pushChanged(changed, "spawnQueue");
  }

  return next;
}

function clearDefenseMemory(room, state, roomMemory, queue, changed) {
  const defense = roomMemory.defense;
  if (!defense || typeof defense !== "object") return;

  const hostiles = hasRoomHostiles(state);
  const defenseQueue = countDefenseQueue(queue || roomMemory.spawnQueue || []);
  const physicallySafe =
    !hostiles &&
    defenseQueue <= 0 &&
    isRoomEnergyReady(room) &&
    isTowerEmergencyReady(state);

  if (physicallySafe && defense.recovery && defense.recovery.active) {
    delete defense.recovery;
    pushChanged(changed, "defense.recovery");
  }

  if (physicallySafe && defense.spawnLocks) {
    delete defense.spawnLocks;
    pushChanged(changed, "defense.spawnLocks");
  }

  if (physicallySafe && defense.support) {
    delete defense.support;
    pushChanged(changed, "defense.support");
  }

  if (Object.keys(defense).length === 0) {
    delete roomMemory.defense;
    pushChanged(changed, "defense");
  }
}

function clearConstructionMemory(state, roomMemory, changed) {
  const construction = roomMemory.construction;
  if (!construction || typeof construction !== "object") return;

  const futurePlan = construction.futurePlan || null;
  const phase = state && state.phase ? state.phase : null;
  if (futurePlan && futurePlan.roadmapPhase && phase && futurePlan.roadmapPhase !== phase) {
    delete construction.futurePlan;
    delete construction.lastAdvancedPlan;
    pushChanged(changed, "construction.futurePlan");
  }

  if (construction.storagePlanningDetails && !futurePlan && state && state.infrastructure && state.infrastructure.hasStorage) {
    delete construction.storagePlanningDetails;
    delete construction.storagePlanningPosition;
    pushChanged(changed, "construction.storagePlanning");
  }

  if (Object.keys(construction).length === 0) {
    delete roomMemory.construction;
    pushChanged(changed, "construction");
  }
}

function isAdvancedTaskValid(task) {
  if (!task || !task.pickupId || !task.deliveryId || !task.resourceType) return false;
  const pickup = Game.getObjectById(task.pickupId);
  const delivery = Game.getObjectById(task.deliveryId);
  if (!pickup || !delivery || !pickup.store || !delivery.store) return false;
  if ((pickup.store[task.resourceType] || 0) <= 0) return false;
  if (
    typeof delivery.store.getFreeCapacity === "function" &&
    delivery.store.getFreeCapacity(task.resourceType) <= 0
  ) {
    return false;
  }
  return true;
}

function clearAdvancedMemory(roomMemory, changed) {
  const advanced = roomMemory.advancedOps;
  if (!advanced || typeof advanced !== "object") return;

  if (advanced.taskClaim && (!advanced.taskClaim.until || advanced.taskClaim.until < Game.time)) {
    delete advanced.taskClaim;
    pushChanged(changed, "advancedOps.taskClaim");
  }

  if (advanced.task && !isAdvancedTaskValid(advanced.task)) {
    delete advanced.task;
    pushChanged(changed, "advancedOps.task");
  }

  if (advanced.summary) {
    const summary = advanced.summary;
    const ids = [
      summary.pickupId,
      summary.deliveryId,
      summary.labId,
      summary.factoryId,
      summary.targetId,
    ];
    for (let i = 0; i < ids.length; i++) {
      if (ids[i] && !hasObject(ids[i])) {
        delete advanced.summary;
        pushChanged(changed, "advancedOps.summary");
        break;
      }
    }
  }

  if (Object.keys(advanced).length === 0) {
    delete roomMemory.advancedOps;
    pushChanged(changed, "advancedOps");
  }
}

function clearLegacyMemory(roomName, roomMemory, changed) {
  const legacyKeys = ["roomFocus", "roomFocusMigratedAt", "roomFocusUpdatedAt"];
  for (let i = 0; i < legacyKeys.length; i++) {
    if (Object.prototype.hasOwnProperty.call(roomMemory, legacyKeys[i])) {
      delete roomMemory[legacyKeys[i]];
      pushChanged(changed, legacyKeys[i]);
    }
  }

  if (Memory.empire && Memory.empire.expansion && Memory.empire.expansion.plans) {
    const plan = Memory.empire.expansion.plans[roomName];
    if (plan && Object.prototype.hasOwnProperty.call(plan, "focus")) {
      delete plan.focus;
      plan.updatedAt = Game.time;
      pushChanged(changed, "expansion.focus");
    }
  }
}

function clearLegacyEmpirePlanFields(changed) {
  if (!Memory.empire) return;

  const groups = [
    Memory.empire.expansion && Memory.empire.expansion.plans
      ? Memory.empire.expansion.plans
      : null,
    Memory.empire.reservation && Memory.empire.reservation.plans
      ? Memory.empire.reservation.plans
      : null,
  ];

  let removed = 0;
  for (let i = 0; i < groups.length; i++) {
    const plans = groups[i];
    if (!plans) continue;
    for (const roomName in plans) {
      if (!Object.prototype.hasOwnProperty.call(plans, roomName)) continue;
      const plan = plans[roomName];
      if (!plan || !Object.prototype.hasOwnProperty.call(plan, "focus")) continue;
      delete plan.focus;
      plan.updatedAt = Game.time;
      removed++;
    }
  }

  if (removed > 0) {
    changed.push("empirePlans.focus");
  }
}

module.exports = {
  getRoomReviewInterval() {
    return getSettings().interval;
  },

  cleanup() {
    if (!Memory.creeps) Memory.creeps = {};
    if (!Memory.rooms) Memory.rooms = {};

    for (const name in Memory.creeps) {
      if (!Game.creeps[name]) {
        delete Memory.creeps[name];
      }
    }

    if (Game.time - lastFullCleanupTick < FULL_CLEANUP_INTERVAL) return;
    const cleanupDecision = scheduler.canRunOptional(
      "memory.fullCleanup",
      FULL_CLEANUP_INTERVAL,
    );
    if (!cleanupDecision.ok) {
      scheduler.recordSkip("memory.fullCleanup", cleanupDecision.reason);
      return;
    }

    const before = Game.cpu ? Game.cpu.getUsed() : 0;
    lastFullCleanupTick = Game.time;
    this.runFullCleanup();
    scheduler.markOptionalRun("memory.fullCleanup", before);
  },

  runFullCleanup() {
    for (const roomName in Game.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Game.rooms, roomName)) continue;

      if (!Memory.rooms[roomName]) {
        Memory.rooms[roomName] = {};
      }

      Memory.rooms[roomName].lastSeen = Game.time;
    }

    for (const roomName in Memory.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Memory.rooms, roomName)) {
        continue;
      }

      const roomMemory = Memory.rooms[roomName];

      if (!roomMemory || typeof roomMemory !== "object") {
        delete Memory.rooms[roomName];
        continue;
      }

      if (roomMemory.stateCache) {
        delete roomMemory.stateCache;
      }

      if (Game.rooms[roomName]) continue;

      const lastSeen = roomMemory.lastSeen || 0;

      // Developer note:
      // Room memory ages out only on periodic full cleanup so normal ticks
      // do not keep paying for broad room-memory sweeps.
      if (lastSeen > 0 && Game.time - lastSeen < ROOM_MEMORY_STALE_AGE) {
        continue;
      }

      delete Memory.rooms[roomName];
    }
  },

  reviewOwnedRooms(ownedRooms, roomStates) {
    const settings = getSettings();
    const reviewMemory = ensureReviewMemory();

    if (!settings.enabled) {
      return this.recordReviewSummary({
        tick: Game.time,
        skipped: "disabled",
        reviewed: [],
        totalFixes: 0,
      });
    }

    if (Game.cpu && typeof Game.cpu.bucket === "number" && Game.cpu.bucket < settings.minBucket) {
      return this.recordReviewSummary({
        tick: Game.time,
        skipped: "bucket",
        reviewed: [],
        totalFixes: 0,
      });
    }

    if (reviewMemory.lastRun && Game.time - reviewMemory.lastRun < settings.interval) {
      return reviewMemory.lastSummary || this.recordReviewSummary({
        tick: Game.time,
        skipped: "interval",
        reviewed: [],
        totalFixes: 0,
      });
    }

    const rooms = (ownedRooms || []).filter(function (room) {
      return room && room.controller && room.controller.my && Game.rooms[room.name];
    }).sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });

    if (rooms.length <= 0) {
      reviewMemory.lastRun = Game.time;
      return this.recordReviewSummary({
        tick: Game.time,
        skipped: "no_owned_rooms",
        reviewed: [],
        totalFixes: 0,
      });
    }

    const states = roomStates || {};
    const reviewed = [];
    let totalFixes = 0;
    let attempts = 0;
    let cursor = reviewMemory.cursor || 0;

    while (attempts < rooms.length && reviewed.length < settings.maxRooms) {
      const index = cursor % rooms.length;
      const room = rooms[index];
      cursor = (index + 1) % rooms.length;
      attempts++;

      const lastReviewed = reviewMemory.lastByRoom[room.name] || 0;
      if (lastReviewed && Game.time - lastReviewed < settings.roomCooldown) {
        continue;
      }

      const result = this.reviewRoom(room, states[room.name] || null);
      reviewMemory.lastByRoom[room.name] = Game.time;
      reviewed.push(result);
      totalFixes += result.changed.length;
    }

    const globalChanged = [];
    clearLegacyEmpirePlanFields(globalChanged);
    if (globalChanged.length > 0) {
      reviewed.push({
        room: "empire",
        changed: globalChanged,
      });
      totalFixes += globalChanged.length;
    }

    reviewMemory.cursor = cursor;
    reviewMemory.lastRun = Game.time;

    return this.recordReviewSummary({
      tick: Game.time,
      skipped: reviewed.length > 0 ? null : "cooldown",
      reviewed: reviewed,
      totalFixes: totalFixes,
    });
  },

  reviewRoom(room, state) {
    const roomMemory = getRoomMemory(room.name);
    const changed = [];

    roomMemory.lastSeen = Game.time;
    roomMemory.reviewedAt = Game.time;
    roomMemory.review = {
      tick: Game.time,
      rcl: room.controller ? room.controller.level || 0 : 0,
      owned: !!(room.controller && room.controller.my),
    };

    const effectiveState = state || {};
    const queue = pruneSpawnQueue(room, effectiveState, roomMemory, changed);
    clearDefenseMemory(room, effectiveState, roomMemory, queue, changed);
    clearConstructionMemory(effectiveState, roomMemory, changed);
    clearAdvancedMemory(roomMemory, changed);
    clearLegacyMemory(room.name, roomMemory, changed);

    roomMemory.review.changed = changed.slice();

    return {
      room: room.name,
      changed: changed,
    };
  },

  recordReviewSummary(summary) {
    const reviewMemory = ensureReviewMemory();
    reviewMemory.lastSummary = summary;

    if (!Memory.empire) Memory.empire = {};
    Memory.empire.roomReview = summary;

    return summary;
  },
};
