const config = require("config");
const scheduler = require("scheduler");

const FULL_CLEANUP_INTERVAL = 500;
const ROOM_MEMORY_STALE_AGE = 5000;
const DEFAULT_MEMORY_LIMIT_KB = 2048;

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
    pressureCleanupEnabled: settings.PRESSURE_CLEANUP_ENABLED !== false,
    pressureCleanupInterval:
      typeof settings.PRESSURE_CLEANUP_INTERVAL === "number"
        ? Math.max(10, settings.PRESSURE_CLEANUP_INTERVAL)
        : 100,
    pressureCleanupMinBucket:
      typeof settings.PRESSURE_CLEANUP_MIN_BUCKET === "number"
        ? settings.PRESSURE_CLEANUP_MIN_BUCKET
        : 2000,
    statsHistoryLimit:
      typeof settings.STATS_HISTORY_LIMIT === "number"
        ? Math.max(10, settings.STATS_HISTORY_LIMIT)
        : 50,
    roomStatsMaxAge:
      typeof settings.ROOM_STATS_MAX_AGE === "number"
        ? Math.max(100, settings.ROOM_STATS_MAX_AGE)
        : 1000,
    diagnosticTtl:
      typeof settings.DIAGNOSTIC_TTL === "number"
        ? Math.max(10, settings.DIAGNOSTIC_TTL)
        : 500,
    completedRequestTtl:
      typeof settings.COMPLETED_REQUEST_TTL === "number"
        ? Math.max(100, settings.COMPLETED_REQUEST_TTL)
        : 5000,
    memoryLimitKb:
      typeof settings.MEMORY_LIMIT_KB === "number"
        ? Math.max(1000, settings.MEMORY_LIMIT_KB)
        : DEFAULT_MEMORY_LIMIT_KB,
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

function ensurePressureCleanupMemory() {
  if (!Memory.runtime) Memory.runtime = {};
  if (!Memory.runtime.memoryCleanup) {
    Memory.runtime.memoryCleanup = {
      lastRun: 0,
      entriesRemoved: 0,
      pathsTouched: [],
      lastSummary: null,
    };
  }
  if (!Array.isArray(Memory.runtime.memoryCleanup.pathsTouched)) {
    Memory.runtime.memoryCleanup.pathsTouched = [];
  }
  return Memory.runtime.memoryCleanup;
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

function noteCleanup(summary, path, removed) {
  const amount = typeof removed === "number" ? removed : 1;
  if (amount <= 0) return;
  summary.entriesRemoved += amount;
  if (summary.pathsTouched.indexOf(path) === -1) {
    summary.pathsTouched.push(path);
  }
}

function trimArray(array, limit) {
  if (!Array.isArray(array)) return 0;
  const max = Math.max(0, Math.floor(limit || 0));
  if (array.length <= max) return 0;
  const removed = array.length - max;
  array.splice(0, removed);
  return removed;
}

function getObjectSizeKb(value) {
  if (typeof value === "undefined") return 0;
  try {
    return Number((JSON.stringify(value).length / 1024).toFixed(1));
  } catch (error) {
    return 0;
  }
}

function classifyMemoryPressure(usedKb, limitKb) {
  if (typeof usedKb !== "number" || usedKb <= 0) return "unknown";
  const limit = Math.max(1, limitKb || DEFAULT_MEMORY_LIMIT_KB);
  if (usedKb >= limit * 0.92) return "critical";
  if (usedKb >= limit * 0.82) return "warning";
  return "normal";
}

function pruneDeadCreepMemory(summary) {
  if (!Memory.creeps) Memory.creeps = {};
  let removed = 0;
  for (const name in Memory.creeps) {
    if (!Object.prototype.hasOwnProperty.call(Memory.creeps, name)) continue;
    if (!Game.creeps[name]) {
      delete Memory.creeps[name];
      removed++;
    }
  }
  noteCleanup(summary, "Memory.creeps", removed);
  return removed;
}

function prunePowerCreepMemory(summary) {
  let removed = 0;
  if (Memory.powerCreeps && typeof Memory.powerCreeps === "object") {
    for (const name in Memory.powerCreeps) {
      if (!Object.prototype.hasOwnProperty.call(Memory.powerCreeps, name)) continue;
      if (!Game.powerCreeps || !Game.powerCreeps[name]) {
        delete Memory.powerCreeps[name];
        removed++;
      }
    }
  }
  noteCleanup(summary, "Memory.powerCreeps", removed);

  if (!Memory.rooms) return;
  for (const roomName in Memory.rooms) {
    if (!Object.prototype.hasOwnProperty.call(Memory.rooms, roomName)) continue;
    const power = Memory.rooms[roomName] && Memory.rooms[roomName].power;
    const generateOps = power && power.generateOps;
    const name = generateOps && generateOps.name;
    if (name && (!Game.powerCreeps || !Game.powerCreeps[name])) {
      delete power.generateOps;
      noteCleanup(summary, `Memory.rooms.${roomName}.power.generateOps`, 1);
    }
  }
}

function pruneStatsMemory(settings, summary) {
  if (!Memory.stats) return;
  const removedHistory = trimArray(Memory.stats.history, settings.statsHistoryLimit);
  noteCleanup(summary, "Memory.stats.history", removedHistory);

  if (Memory.stats.rooms) {
    let removedRooms = 0;
    for (const roomName in Memory.stats.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Memory.stats.rooms, roomName)) continue;
      const row = Memory.stats.rooms[roomName];
      const tick = row && row.cpu && typeof row.cpu.tick === "number" ? row.cpu.tick : 0;
      if (!tick || Game.time - tick > settings.roomStatsMaxAge) {
        delete Memory.stats.rooms[roomName];
        removedRooms++;
      }
    }
    noteCleanup(summary, "Memory.stats.rooms", removedRooms);
    if (Object.keys(Memory.stats.rooms).length === 0) delete Memory.stats.rooms;
  }

  if (Memory.stats.hud) {
    let removedHud = 0;
    for (const roomName in Memory.stats.hud) {
      if (!Object.prototype.hasOwnProperty.call(Memory.stats.hud, roomName)) continue;
      const row = Memory.stats.hud[roomName];
      const tick = row && typeof row.tick === "number" ? row.tick : 0;
      if (!Game.rooms[roomName] || !tick || Game.time - tick > settings.diagnosticTtl) {
        delete Memory.stats.hud[roomName];
        removedHud++;
      }
    }
    noteCleanup(summary, "Memory.stats.hud", removedHud);
    if (Object.keys(Memory.stats.hud).length === 0) delete Memory.stats.hud;
  }
}

function pruneRuntimeMemory(settings, summary) {
  if (!Memory.runtime) return;
  if (Memory.runtime.scheduler) {
    const removedRecent = trimArray(
      Memory.runtime.scheduler.recent,
      config.SCHEDULING && typeof config.SCHEDULING.HISTORY_SIZE === "number"
        ? config.SCHEDULING.HISTORY_SIZE
        : 25,
    );
    noteCleanup(summary, "Memory.runtime.scheduler.recent", removedRecent);
  }

  if (Memory.runtime.rooms) {
    let removedRooms = 0;
    for (const roomName in Memory.runtime.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Memory.runtime.rooms, roomName)) continue;
      const row = Memory.runtime.rooms[roomName];
      const tick = row && typeof row.tick === "number" ? row.tick : 0;
      if (!Game.rooms[roomName] || !tick || Game.time - tick > settings.diagnosticTtl) {
        delete Memory.runtime.rooms[roomName];
        removedRooms++;
      }
    }
    noteCleanup(summary, "Memory.runtime.rooms", removedRooms);
    if (Object.keys(Memory.runtime.rooms).length === 0) delete Memory.runtime.rooms;
  }
}

function pruneRoomDiagnostics(settings, summary) {
  if (!Memory.rooms) return;
  for (const roomName in Memory.rooms) {
    if (!Object.prototype.hasOwnProperty.call(Memory.rooms, roomName)) continue;
    const roomMemory = Memory.rooms[roomName];
    if (!roomMemory || typeof roomMemory !== "object") continue;

    if (
      roomMemory.roleIntent &&
      (!roomMemory.roleIntent.tick ||
        Game.time - roomMemory.roleIntent.tick > settings.diagnosticTtl)
    ) {
      delete roomMemory.roleIntent;
      noteCleanup(summary, `Memory.rooms.${roomName}.roleIntent`, 1);
    }

    if (
      roomMemory.hud &&
      (!roomMemory.hud.tick || Game.time - roomMemory.hud.tick > settings.diagnosticTtl)
    ) {
      delete roomMemory.hud;
      noteCleanup(summary, `Memory.rooms.${roomName}.hud`, 1);
    }

    if (
      roomMemory.review &&
      roomMemory.review.tick &&
      Game.time - roomMemory.review.tick > settings.diagnosticTtl
    ) {
      delete roomMemory.review;
      noteCleanup(summary, `Memory.rooms.${roomName}.review`, 1);
    }

    if (
      roomMemory.power &&
      roomMemory.power.generateOps &&
      roomMemory.power.generateOps.lastTick &&
      Game.time - roomMemory.power.generateOps.lastTick > settings.diagnosticTtl &&
      (!roomMemory.power.generateOps.name ||
        !Game.powerCreeps ||
        !Game.powerCreeps[roomMemory.power.generateOps.name])
    ) {
      delete roomMemory.power.generateOps;
      noteCleanup(summary, `Memory.rooms.${roomName}.power.generateOps`, 1);
    }

    if (roomMemory.advancedOps && typeof roomMemory.advancedOps === "object") {
      const advanced = roomMemory.advancedOps;

      if (
        advanced.labSchedule &&
        (
          !advanced.labSchedule.tick ||
          Game.time - advanced.labSchedule.tick > settings.diagnosticTtl
        )
      ) {
        delete advanced.labSchedule;
        noteCleanup(summary, `Memory.rooms.${roomName}.advancedOps.labSchedule`, 1);
      }

      if (
        advanced.taskClaim &&
        advanced.taskClaim.until &&
        advanced.taskClaim.until < Game.time
      ) {
        delete advanced.taskClaim;
        noteCleanup(summary, `Memory.rooms.${roomName}.advancedOps.taskClaim`, 1);
      }

      if (!Game.rooms[roomName] && advanced.summary) {
        delete advanced.summary;
        noteCleanup(summary, `Memory.rooms.${roomName}.advancedOps.summary`, 1);
      }

      if (Object.keys(advanced).length === 0) {
        delete roomMemory.advancedOps;
        noteCleanup(summary, `Memory.rooms.${roomName}.advancedOps`, 1);
      }
    }

    if (roomMemory.spawnRequestAges && typeof roomMemory.spawnRequestAges === "object") {
      const queue = Array.isArray(roomMemory.spawnQueue) ? roomMemory.spawnQueue : [];
      const activeKeys = {};
      for (let i = 0; i < queue.length; i++) {
        if (queue[i] && queue[i].requestKey) activeKeys[queue[i].requestKey] = true;
      }

      let removedAges = 0;
      for (const key in roomMemory.spawnRequestAges) {
        if (!Object.prototype.hasOwnProperty.call(roomMemory.spawnRequestAges, key)) continue;
        if (queue.length > 0 && activeKeys[key]) continue;
        delete roomMemory.spawnRequestAges[key];
        removedAges++;
      }
      noteCleanup(summary, `Memory.rooms.${roomName}.spawnRequestAges`, removedAges);
      if (Object.keys(roomMemory.spawnRequestAges).length === 0) {
        delete roomMemory.spawnRequestAges;
      }
    }
  }
}

function pruneOpsLogistics(settings, summary) {
  if (!Memory.ops || !Memory.ops.logistics) return;
  const logistics = Memory.ops.logistics;

  if (logistics.history) {
    let removedHistory = 0;
    const historyLimit = 8;
    for (const roomName in logistics.history) {
      if (!Object.prototype.hasOwnProperty.call(logistics.history, roomName)) continue;
      const removed = trimArray(logistics.history[roomName], historyLimit);
      removedHistory += removed;
      if (Array.isArray(logistics.history[roomName]) && logistics.history[roomName].length === 0) {
        delete logistics.history[roomName];
      }
    }
    noteCleanup(summary, "Memory.ops.logistics.history", removedHistory);
    if (Object.keys(logistics.history).length === 0) delete logistics.history;
  }

  if (logistics.requests) {
    let removedRequests = 0;
    const terminalStatuses = {
      done: true,
      canceled: true,
      expired: true,
    };
    for (const id in logistics.requests) {
      if (!Object.prototype.hasOwnProperty.call(logistics.requests, id)) continue;
      const request = logistics.requests[id];
      if (!request || typeof request !== "object") {
        delete logistics.requests[id];
        removedRequests++;
        continue;
      }
      if (request.status === "open" && request.expiresAt && request.expiresAt < Game.time) {
        request.status = "expired";
        request.updatedAt = Game.time;
      }
      const lastTick = Math.max(
        request.updatedAt || 0,
        request.completedAt || 0,
        request.canceledAt || 0,
        request.expiresAt || 0,
        request.createdAt || 0,
      );
      if (
        terminalStatuses[request.status] &&
        lastTick &&
        Game.time - lastTick > settings.completedRequestTtl
      ) {
        delete logistics.requests[id];
        removedRequests++;
      }
    }
    noteCleanup(summary, "Memory.ops.logistics.requests", removedRequests);
    if (Object.keys(logistics.requests).length === 0) delete logistics.requests;
  }
}

function buildTopLevelSizeRows() {
  const rows = [];
  for (const key in Memory) {
    if (!Object.prototype.hasOwnProperty.call(Memory, key)) continue;
    rows.push({
      key: "Memory." + key,
      kb: getObjectSizeKb(Memory[key]),
    });
  }
  rows.sort(function (a, b) {
    if (b.kb !== a.kb) return b.kb - a.kb;
    return a.key.localeCompare(b.key);
  });
  return rows;
}

function buildKnownCategoryRows() {
  const categories = [
    ["Memory.rooms", Memory.rooms],
    ["Memory.creeps", Memory.creeps],
    ["Memory.stats", Memory.stats],
    ["Memory.stats.history", Memory.stats && Memory.stats.history],
    ["Memory.stats.rooms", Memory.stats && Memory.stats.rooms],
    ["Memory.ops", Memory.ops],
    ["Memory.ops.logistics.requests", Memory.ops && Memory.ops.logistics && Memory.ops.logistics.requests],
    ["Memory.ops.logistics.history", Memory.ops && Memory.ops.logistics && Memory.ops.logistics.history],
    ["Memory.runtime", Memory.runtime],
    ["Memory.powerCreeps", Memory.powerCreeps],
  ];
  const rows = [];
  for (let i = 0; i < categories.length; i++) {
    if (typeof categories[i][1] === "undefined") continue;
    rows.push({
      key: categories[i][0],
      kb: getObjectSizeKb(categories[i][1]),
    });
  }
  rows.sort(function (a, b) {
    if (b.kb !== a.kb) return b.kb - a.kb;
    return a.key.localeCompare(b.key);
  });
  return rows;
}

function formatSizeRows(rows, limit) {
  const visible = rows.slice(0, limit || 5);
  if (visible.length === 0) return "none";
  return visible
    .map(function (row) {
      return row.key + " " + row.kb + "KB";
    })
    .join(" | ");
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

    pruneDeadCreepMemory({
      entriesRemoved: 0,
      pathsTouched: [],
    });

    this.runPressureCleanup();

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

  runPressureCleanup() {
    const settings = getSettings();
    const memory = ensurePressureCleanupMemory();

    if (!settings.pressureCleanupEnabled) {
      memory.lastSummary = {
        tick: Game.time,
        skipped: "disabled",
        entriesRemoved: 0,
        pathsTouched: [],
      };
      return memory.lastSummary;
    }

    if (memory.lastRun && Game.time - memory.lastRun < settings.pressureCleanupInterval) {
      return memory.lastSummary || {
        tick: Game.time,
        skipped: "interval",
        entriesRemoved: 0,
        pathsTouched: [],
      };
    }

    const cleanupDecision = scheduler.canRunOptional(
      "memory.pressureCleanup",
      settings.pressureCleanupInterval,
      {
        minBucket: settings.pressureCleanupMinBucket,
      },
    );
    if (!cleanupDecision.ok) {
      scheduler.recordSkip("memory.pressureCleanup", cleanupDecision.reason);
      memory.lastSummary = {
        tick: Game.time,
        skipped: cleanupDecision.reason,
        entriesRemoved: 0,
        pathsTouched: [],
      };
      return memory.lastSummary;
    }

    const before = Game.cpu ? Game.cpu.getUsed() : 0;
    const summary = this.runDeepCleanup(settings);
    scheduler.markOptionalRun("memory.pressureCleanup", before);
    return summary;
  },

  runDeepCleanup(settingsOverride) {
    const settings = settingsOverride || getSettings();
    const memory = ensurePressureCleanupMemory();
    const summary = {
      tick: Game.time,
      skipped: null,
      entriesRemoved: 0,
      pathsTouched: [],
    };

    pruneDeadCreepMemory(summary);
    prunePowerCreepMemory(summary);
    pruneStatsMemory(settings, summary);
    pruneRuntimeMemory(settings, summary);
    pruneRoomDiagnostics(settings, summary);
    pruneOpsLogistics(settings, summary);

    const usedKb = getObjectSizeKb(Memory);
    summary.usedKb = usedKb;
    summary.limitKb = settings.memoryLimitKb;
    summary.pressure = classifyMemoryPressure(usedKb, settings.memoryLimitKb);
    summary.topLevel = buildTopLevelSizeRows().slice(0, 5);
    summary.largestKnown = buildKnownCategoryRows().slice(0, 5);

    memory.lastRun = Game.time;
    memory.entriesRemoved = summary.entriesRemoved;
    memory.pathsTouched = summary.pathsTouched.slice(0, 12);
    memory.lastSummary = {
      tick: summary.tick,
      skipped: summary.skipped,
      entriesRemoved: summary.entriesRemoved,
      pathsTouched: summary.pathsTouched.slice(0, 12),
      usedKb: summary.usedKb,
      limitKb: summary.limitKb,
      pressure: summary.pressure,
      topLevel: summary.topLevel,
      largestKnown: summary.largestKnown,
    };

    return memory.lastSummary;
  },

  getMemoryReport() {
    const settings = getSettings();
    const cleanup = ensurePressureCleanupMemory();
    const usedKb = getObjectSizeKb(Memory);
    const pressure = classifyMemoryPressure(usedKb, settings.memoryLimitKb);
    return {
      tick: Game.time,
      usedKb: usedKb,
      limitKb: settings.memoryLimitKb,
      pressure: pressure,
      cleanupLastRun: cleanup.lastRun || 0,
      cleanupEntriesRemoved: cleanup.entriesRemoved || 0,
      cleanupPathsTouched: cleanup.pathsTouched || [],
      topLevel: buildTopLevelSizeRows().slice(0, 5),
      largestKnown: buildKnownCategoryRows().slice(0, 6),
    };
  },

  formatMemoryReportLines(report) {
    const summary = report || this.getMemoryReport();
    return [
      "[OPS][MEMORY]",
      "Used " +
        summary.usedKb +
        " / " +
        summary.limitKb +
        " KB | pressure " +
        summary.pressure,
      "Cleanup last " +
        (summary.cleanupLastRun || "--") +
        " | removed " +
        (summary.cleanupEntriesRemoved || 0),
      "Touched " +
        (summary.cleanupPathsTouched && summary.cleanupPathsTouched.length > 0
          ? summary.cleanupPathsTouched.slice(0, 6).join(", ")
          : "none"),
      "Top keys " + formatSizeRows(summary.topLevel || [], 5),
      "Known categories " + formatSizeRows(summary.largestKnown || [], 6),
    ];
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
