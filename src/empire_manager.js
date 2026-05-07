/*
Developer Summary:
Empire Manager

Purpose:
- Keep owned-room discovery in one place
- Record a lightweight empire snapshot each tick
- Build multi-room console reports without changing room behavior

Important Notes:
- Owned rooms remain self-sufficient and continue to run through room_manager.
- Empire state is observational for now. Expansion decisions can be layered on
  top after reporting makes the multi-room shape visible.
*/

const roomReporting = require("room_reporting");
const config = require("config");
const defenseManager = require("defense_manager");
const reservationManager = require("reservation_manager");
const attackManager = require("attack_manager");
const roomProgress = require("room_progress");
const utils = require("utils");
const invasionLog = require("invasion_log");
const advancedStructureManager = require("advanced_structure_manager");
const scheduler = require("scheduler");

function ensureEmpireMemory() {
  if (!Memory.empire) Memory.empire = {};
  if (!Memory.empire.rooms) Memory.empire.rooms = {};
  if (!Memory.empire.expansion) {
    Memory.empire.expansion = {};
  }
  if (!Memory.empire.expansion.plans) {
    Memory.empire.expansion.plans = {};
  }
  if (!Memory.empire.reservation) {
    Memory.empire.reservation = {};
  }
  if (!Memory.empire.reservation.plans) {
    Memory.empire.reservation.plans = {};
  }
  if (!Memory.empire.minerals) {
    Memory.empire.minerals = {};
  }
  if (!Memory.empire.support) {
    Memory.empire.support = {};
  }

  return Memory.empire;
}

function getQueue(roomName) {
  return Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].spawnQueue
    ? Memory.rooms[roomName].spawnQueue
    : [];
}

function sumEnergyInStore(structure, resourceType) {
  if (!structure || !structure.store) return 0;
  return structure.store[resourceType] || 0;
}

function getGclSummary(ownedRoomCount) {
  const gcl = Game.gcl || null;
  const level = gcl && typeof gcl.level === "number" ? gcl.level : null;
  const progress = gcl && typeof gcl.progress === "number" ? gcl.progress : null;
  const progressTotal =
    gcl && typeof gcl.progressTotal === "number" ? gcl.progressTotal : null;
  const progressPct =
    progressTotal && progressTotal > 0 && progress !== null
      ? Math.floor((Math.min(progress, progressTotal) / progressTotal) * 100)
      : null;

  return {
    level: level,
    progress: progress,
    progressTotal: progressTotal,
    progressPct: progressPct,
    roomSlotsUsed: ownedRoomCount,
    roomSlotsLimit: level,
    roomSlotsAvailable:
      level === null ? null : Math.max(0, level - ownedRoomCount),
  };
}

function getGclLabel(gcl) {
  if (!gcl || gcl.level === null) return "GCL unknown";

  return `GCL ${gcl.level}${gcl.progressPct !== null ? ` ${gcl.progressPct}%` : ""}`;
}

function getRoomSlotLabel(gcl) {
  if (!gcl || gcl.roomSlotsLimit === null) {
    return `Rooms ${gcl ? gcl.roomSlotsUsed : 0}/?`;
  }

  return `Rooms ${gcl.roomSlotsUsed}/${gcl.roomSlotsLimit}`;
}

function getControllerProgressPct(room) {
  if (!room.controller || !room.controller.progressTotal) return null;

  return Math.floor(
    (Math.min(room.controller.progress || 0, room.controller.progressTotal) /
      room.controller.progressTotal) *
      100,
  );
}

function countBusySpawns(spawns) {
  let busy = 0;

  for (let i = 0; i < spawns.length; i++) {
    if (spawns[i].spawning) busy++;
  }

  return busy;
}

function countHostiles(state) {
  if (!state) return 0;
  if (state.defense && state.defense.homeThreat) {
    return state.defense.homeThreat.hostileCount || 0;
  }

  return state.hostileCreeps ? state.hostileCreeps.length : 0;
}

function getPhaseCounts(reports) {
  const counts = {};

  for (let i = 0; i < reports.length; i++) {
    const phase = reports[i].state && reports[i].state.phase
      ? reports[i].state.phase
      : "unknown";
    counts[phase] = (counts[phase] || 0) + 1;
  }

  return counts;
}

function formatPhaseCounts(counts) {
  const phases = Object.keys(counts).sort();
  const parts = [];

  for (let i = 0; i < phases.length; i++) {
    parts.push(`${phases[i]} ${counts[phases[i]]}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "none";
}

const EMPIRE_ROW_WIDTHS = {
  room: 15,
  phase: 13,
  status: 8,
  goal: 33,
};

function trimCell(value, width) {
  const text = value === undefined || value === null ? "" : String(value);
  if (text.length <= width) return text;
  if (width <= 3) return text.slice(0, width);
  return text.slice(0, width - 3) + "...";
}

function padCell(value, width) {
  const text = trimCell(value, width);
  return text + " ".repeat(Math.max(0, width - text.length));
}

function formatEmpireRow(roomLabel, phaseLabel, statusLabel, goalLabel) {
  return [
    padCell(roomLabel, EMPIRE_ROW_WIDTHS.room),
    padCell(phaseLabel, EMPIRE_ROW_WIDTHS.phase),
    padCell(statusLabel, EMPIRE_ROW_WIDTHS.status),
    trimCell(goalLabel, EMPIRE_ROW_WIDTHS.goal),
  ].join("  ");
}

function getEmpireChildKey(row) {
  if (!row) return "";
  return `${row.kind || "child"}:${row.targetRoom || ""}`;
}

function formatCompactNumber(value) {
  const amount = typeof value === "number" ? value : parseInt(value || 0, 10) || 0;

  if (Math.abs(amount) >= 1000000) {
    return (amount / 1000000).toFixed(amount >= 10000000 ? 0 : 1) + "m";
  }

  if (Math.abs(amount) >= 1000) {
    return (amount / 1000).toFixed(amount >= 10000 ? 0 : 1) + "k";
  }

  return String(amount);
}

function capitalizeLabel(value) {
  const text = value ? String(value) : "";
  if (!text) return "";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getEmpireRoomStatus(report) {
  if (report.alert && report.alert.active) return "alert";
  if (report.state && report.state.phase === "bootstrap") return "startup";
  return "clear";
}

function getEmpirePhaseLabel(report) {
  const phase = report.state && report.state.phase ? report.state.phase : "unknown";
  const room = Game.rooms[report.room];
  const rcl = room && room.controller ? room.controller.level || 0 : 0;
  return `${phase} ${rcl}`.trim();
}

function getRuntimeLabel() {
  if (Memory.stats && Memory.stats.runtime && Memory.stats.runtime.pressure) {
    return Memory.stats.runtime.pressure;
  }

  return "normal";
}

function normalizeRoomName(roomName) {
  if (!roomName) return null;

  const normalized = String(roomName).trim();
  return normalized.length > 0 ? normalized : null;
}

function getExpansionMemory() {
  return ensureEmpireMemory().expansion;
}

function getExpansionSettings() {
  return config.EXPANSION || {};
}

function isExpansionEnabled() {
  const settings = getExpansionSettings();
  return settings.ENABLED !== false;
}

function getThreatMemoryTtl() {
  const settings = getExpansionSettings();
  return typeof settings.DEFENSE_MEMORY_TTL === "number"
    ? settings.DEFENSE_MEMORY_TTL
    : 300;
}

function getVisionRefreshTtl() {
  const settings = getExpansionSettings();
  return typeof settings.VISIBILITY_REFRESH_TTL === "number"
    ? settings.VISIBILITY_REFRESH_TTL
    : 150;
}

function getPlanStatus(plan, ownedRoomCount) {
  if (!plan || !plan.targetRoom) return "invalid";
  if (plan.cancelled) return "cancelled";

  const targetRoom = Game.rooms[plan.targetRoom] || null;
  const targetOwned = !!(
    targetRoom &&
    targetRoom.controller &&
    targetRoom.controller.my
  );
  const hasSpawn = !!(
    targetRoom &&
    targetRoom.find(FIND_MY_SPAWNS).length > 0
  );
  const targetLevel =
    targetRoom && targetRoom.controller ? targetRoom.controller.level || 0 : 0;
  const gcl = getGclSummary(ownedRoomCount);

  if (targetOwned && hasSpawn && targetLevel >= 4) return "complete";
  if (targetOwned) return "bootstrapping";
  if (
    !targetOwned &&
    gcl.roomSlotsLimit !== null &&
    gcl.roomSlotsAvailable <= 0
  ) {
    return "blocked_gcl";
  }
  if (
    targetRoom &&
    targetRoom.controller &&
    targetRoom.controller.owner &&
    !targetOwned
  ) {
    return "blocked_owner";
  }
  if (module.exports.getExpansionThreat(plan)) return "threatened";

  return "claiming";
}

function getPlanStatusLabel(plan, ownedRoomCount) {
  const status = getPlanStatus(plan, ownedRoomCount);

  switch (status) {
    case "blocked_gcl":
      return "blocked by GCL";
    case "blocked_owner":
      return "blocked by owner";
    default:
      return status;
  }
}

function getExpansionRowStatus(plan, ownedRoomCount) {
  const status = getPlanStatus(plan, ownedRoomCount);

  if (status === "threatened") return "alert";
  if (status.indexOf("blocked") === 0) return "blocked";
  if (status === "claiming") return "claim";
  if (status === "bootstrapping") return "boot";
  if (status === "complete") return "done";

  return status;
}

function getExpansionRowNextGoal(plan, ownedRoomCount) {
  const status = getPlanStatus(plan, ownedRoomCount);

  if (status === "threatened") return "Defend expansion";
  if (status === "blocked_gcl") return "Wait for GCL";
  if (status === "blocked_owner") return "Blocked by owner";
  if (status === "claiming") return "Claim controller";
  if (status === "bootstrapping") return "Build first spawn";
  if (status === "complete") return "Spawn online";

  return getPlanStatusLabel(plan, ownedRoomCount);
}

function getExpansionProgressSummary(plan, targetRoom) {
  if (targetRoom && targetRoom.controller && targetRoom.controller.my) {
    return roomProgress.getProgressSummary(targetRoom, { update: false });
  }

  const intel = plan && plan.intel ? plan.intel : null;
  if (!intel || typeof intel.controllerLevel !== "number") return null;

  const level = intel.controllerLevel || 0;
  const progressTotal = intel.controllerProgressTotal || 0;
  const progress = intel.controllerProgress || 0;
  const pct = progressTotal > 0
    ? Math.round((Math.min(progress, progressTotal) / progressTotal) * 100)
    : null;

  return {
    level: level,
    targetLevel: progressTotal > 0 && level < 8 ? level + 1 : null,
    pct: pct,
    eta: null,
  };
}

function formatExpansionProgressLabel(progress) {
  if (!progress) return "RCL --";
  if (progress.targetLevel) return `RCL ${progress.level} ${progress.pct}%`;
  return `RCL ${progress.level}`;
}

function appendExpansionEta(goal, progress) {
  const eta = progress && progress.eta ? progress.eta : "--";
  return `${goal} | ETA ${eta}`;
}

function isParentReady(room, state) {
  const settings = getExpansionSettings();
  const minRcl =
    typeof settings.MIN_PARENT_RCL === "number" ? settings.MIN_PARENT_RCL : 4;

  if (!room || !room.controller || room.controller.level < minRcl) {
    return false;
  }
  if (!state || !state.spawns || state.spawns.length <= 0) {
    return false;
  }
  if (state.defense && state.defense.hasThreats) {
    return false;
  }
  if (
    !state.buildStatus ||
    (!state.buildStatus.stableReady && !state.buildStatus.developmentComplete)
  ) {
    return false;
  }

  return true;
}

function isParentOperational(room, state) {
  const settings = getExpansionSettings();
  const minRcl =
    typeof settings.MIN_PARENT_RCL === "number" ? settings.MIN_PARENT_RCL : 4;

  if (!room || !room.controller || !room.controller.my) return false;
  if (room.controller.level < minRcl) return false;
  if (!state || !state.spawns || state.spawns.length <= 0) return false;
  if (state.defense && state.defense.hasThreats) return false;

  return true;
}

function hasRecentThreatIntel(plan) {
  if (!plan || !plan.intel) return false;
  if ((plan.intel.hostileCount || 0) <= 0) return false;
  if (typeof plan.intel.threatSeenAt !== "number") return false;

  return Game.time - plan.intel.threatSeenAt <= getThreatMemoryTtl();
}

function shouldRefreshVisibility(plan, targetRoom) {
  if (targetRoom) return false;
  if (!plan || !plan.intel) return true;
  if (typeof plan.intel.visibleAt !== "number") return true;

  return Game.time - plan.intel.visibleAt >= getVisionRefreshTtl();
}

function hasStartedExpansionOperation(plan, targetRoom) {
  if (!plan) return false;
  if (typeof plan.startedAt === "number") return true;

  const room = targetRoom || (plan.targetRoom ? Game.rooms[plan.targetRoom] : null);
  return !!(room && room.controller && room.controller.my);
}

function getVisibleExpansionThreat(room) {
  if (!room) return null;

  const hostiles = utils.getDefenseIntruders(room);
  if (hostiles.length <= 0) return null;

  return defenseManager.createThreatDescriptor({
    roomName: room.name,
    scope: "expansion",
    classification: "expansion_threat",
    priority: 1050,
    hostiles: hostiles,
    hostileReservation: false,
    desiredDefenders: Math.max(1, Math.ceil(hostiles.length / 2)),
    reaction: defenseManager.getReactionConfig(),
    responseRole: "defender",
    spawnCooldown: 25,
    visible: true,
    towerCanHandle: false,
    responseMode: "creep_only",
    hostileCombatPower: defenseManager.getHostileCombatPower(hostiles),
    hostileHealingPower: defenseManager.getHostileHealingPower(hostiles),
  });
}

function getStoredExpansionThreat(plan) {
  if (!hasRecentThreatIntel(plan)) return null;

  return {
    roomName: plan.targetRoom,
    scope: "expansion",
    classification: "expansion_threat",
    type: "expansion_threat",
    priority: 1050,
    hostiles: [],
    hostileCount: plan.intel.hostileCount || 1,
    hostileReservation: false,
    active: true,
    desiredDefenders: Math.max(1, plan.intel.desiredDefenders || 1),
    threatScore: plan.intel.threatScore || 1,
    threatLevel: plan.intel.threatLevel || 1,
    responseRole: "defender",
    spawnCooldown: 25,
    visible: false,
    towerTargetId: null,
    towerTargetSummary: plan.intel.threatLabel || "stale expansion threat",
    towerFocusDamage: 0,
    towerCanHandle: false,
    activeTowerCount: 0,
    readyTowerCount: 0,
    responseMode: "creep_only",
    hostileCombatPower: plan.intel.hostileCombatPower || 120,
    hostileHealingPower: plan.intel.hostileHealingPower || 0,
  };
}

function countExpansionCreeps(role, targetRoom, parentRoom) {
  let count = 0;

  for (const creepName in Game.creeps) {
    if (!Object.prototype.hasOwnProperty.call(Game.creeps, creepName)) continue;

    const creep = Game.creeps[creepName];
    if (!creep || !creep.memory) continue;
    if (creep.memory.role !== role) continue;
    if (creep.memory.targetRoom !== targetRoom) continue;
    if (creep.memory.room !== parentRoom) continue;
    if (
      creep.ticksToLive !== undefined &&
      creep.ticksToLive <= getReplaceTtl(role)
    ) {
      continue;
    }

    count++;
  }

  return count;
}

function countQueuedExpansion(role, targetRoom, parentRoom) {
  const queue = getQueue(parentRoom);
  let count = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (
      item.role === role &&
      item.targetRoom === targetRoom &&
      item.homeRoom === parentRoom
    ) {
      count++;
    }
  }

  return count;
}

function countExpansionDefenseCoverage(targetRoom) {
  let count = 0;

  for (const creepName in Game.creeps) {
    if (!Object.prototype.hasOwnProperty.call(Game.creeps, creepName)) continue;

    const creep = Game.creeps[creepName];
    if (!creep || !creep.memory || creep.memory.role !== "defender") continue;
    if (creep.memory.targetRoom !== targetRoom) continue;
    if (creep.ticksToLive !== undefined && creep.ticksToLive <= 90) continue;
    count++;
  }

  if (!Memory.rooms) return count;

  for (const roomName in Memory.rooms) {
    if (!Object.prototype.hasOwnProperty.call(Memory.rooms, roomName)) continue;
    const queue = Memory.rooms[roomName] ? Memory.rooms[roomName].spawnQueue : null;
    if (!queue) continue;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (item && item.role === "defender" && item.targetRoom === targetRoom) {
        count++;
      }
    }
  }

  return count;
}

function getReplaceTtl(role) {
  const settings = getExpansionSettings();

  if (role === "claimer") {
    return typeof settings.CLAIMER_REPLACE_TTL === "number"
      ? settings.CLAIMER_REPLACE_TTL
      : 200;
  }

  return typeof settings.PIONEER_REPLACE_TTL === "number"
    ? settings.PIONEER_REPLACE_TTL
    : 200;
}

function chooseParentRoom(targetRoomName, ownedRooms) {
  const rooms = ownedRooms || [];
  let best = null;
  let bestScore = -Infinity;

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    const spawns = room.find(FIND_MY_SPAWNS);
    if (!room.controller || !room.controller.my || spawns.length <= 0) continue;

    let score = room.controller.level * 100 + room.energyCapacityAvailable;
    if (room.storage) score += 200;
    if (targetRoomName && Game.map && Game.map.getRoomLinearDistance) {
      score -= Game.map.getRoomLinearDistance(room.name, targetRoomName) * 25;
    }

    if (score > bestScore) {
      best = room;
      bestScore = score;
    }
  }

  return best;
}

function getExpansionPlans() {
  const expansion = getExpansionMemory();
  return expansion.plans || {};
}

function ensureExpansionPlanDefaults(plan, targetRoom) {
  if (!plan) return plan;

  let changed = false;
  if (!plan.targetRoom && targetRoom) {
    plan.targetRoom = targetRoom;
    changed = true;
  }
  if (changed) {
    plan.defaultsUpgradedAt = Game.time;
    plan.updatedAt = Game.time;
  }

  return plan;
}

function canExpansionSelfSpawn(room) {
  if (!room) return false;

  const spawns = room.find(FIND_MY_SPAWNS);
  if (spawns.length <= 0) return false;

  for (let i = 0; i < spawns.length; i++) {
    if (spawns[i].spawning) return true;
  }

  return room.energyAvailable >= 200;
}

function isExpansionTotalCollapse(room) {
  if (!room || !room.controller || !room.controller.my) return false;
  if (room.find(FIND_MY_CREEPS).length > 0) return false;

  return !canExpansionSelfSpawn(room);
}

function adoptExpansionParent(plan, parentRoomName) {
  if (!plan || !parentRoomName || plan.parentRoom === parentRoomName) return false;

  if (!plan.previousParents) plan.previousParents = [];
  if (plan.parentRoom) {
    plan.previousParents.push({
      room: plan.parentRoom,
      clearedAt: Game.time,
    });
  }

  plan.parentRoom = parentRoomName;
  plan.recoveredAt = Game.time;
  plan.updatedAt = Game.time;
  return true;
}

function clearExpansionParent(plan) {
  if (!plan || plan.cancelled || !plan.parentRoom) return false;

  if (!plan.previousParents) plan.previousParents = [];
  plan.previousParents.push({
    room: plan.parentRoom,
    clearedAt: Game.time,
  });
  plan.parentRoom = null;
  plan.independentAt = plan.independentAt || Game.time;
  plan.updatedAt = Game.time;
  pruneExpansionQueue(plan.targetRoom);
  return true;
}

function reconcileExpansionSupport(plan) {
  if (!plan || plan.cancelled) return false;

  const room = plan.targetRoom ? Game.rooms[plan.targetRoom] : null;
  const hasIndependentSpawn = !!(
    room &&
    room.controller &&
    room.controller.my &&
    room.controller.level >= 4 &&
    room.find(FIND_MY_SPAWNS).length > 0
  );

  if (plan.parentRoom) {
    if (hasIndependentSpawn && !isExpansionTotalCollapse(room)) {
      return clearExpansionParent(plan);
    }
    return false;
  }

  if (!isExpansionTotalCollapse(room)) return false;

  const selected = chooseParentRoom(plan.targetRoom, module.exports.collectOwnedRooms());
  if (!selected) return false;

  return adoptExpansionParent(plan, selected.name);
}

function getTargetRoleCounts(room) {
  if (!room) return {};

  const cache = utils.getRoomRuntimeCache(room);
  const state = cache && cache.state ? cache.state : null;
  if (state && state.roleCounts) {
    return state.roleCounts;
  }

  const counts = {};
  for (const creepName in Game.creeps) {
    if (!Object.prototype.hasOwnProperty.call(Game.creeps, creepName)) continue;

    const creep = Game.creeps[creepName];
    if (!creep || !creep.memory || creep.memory.room !== room.name) continue;

    const role = creep.memory.role || "none";
    counts[role] = (counts[role] || 0) + 1;
  }

  return counts;
}

function shouldRequestExpansionPioneerSupport(targetRoom) {
  if (!targetRoom || !targetRoom.controller || !targetRoom.controller.my) {
    return false;
  }

  const hasSpawn = targetRoom.find(FIND_MY_SPAWNS).length > 0;
  if (!hasSpawn) return true;

  if (!isExpansionTotalCollapse(targetRoom)) return false;

  const roleCounts = getTargetRoleCounts(targetRoom);
  return (
    (roleCounts.worker || 0) + (roleCounts.jrworker || 0) <= 0 &&
    (roleCounts.hauler || 0) <= 0
  );
}

function getActivePlanList() {
  const plans = getExpansionPlans();
  const result = [];

  for (const targetRoom in plans) {
    if (!Object.prototype.hasOwnProperty.call(plans, targetRoom)) continue;
    const plan = plans[targetRoom];
    ensureExpansionPlanDefaults(plan, targetRoom);
    if (!plan || plan.cancelled) continue;
    reconcileExpansionSupport(plan);
    result.push(plan);
  }

  result.sort(function (a, b) {
    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  return result;
}

function buildExpansionLines() {
  const plans = getActivePlanList();
  const ownedRooms = module.exports.collectOwnedRooms();
  const lines = ["[OPS][EXPANSION]"];

  if (plans.length === 0) {
    lines.push("No active expansion plans.");
    return lines;
  }

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    lines.push(
      `${plan.targetRoom} | parent ${plan.parentRoom || "none"} | ${getPlanStatusLabel(plan, ownedRooms.length)} | age ${
        Game.time - (plan.createdAt || Game.time)
      }`,
    );
  }

  return lines;
}

function getEmpireExpansionRows(ownedRoomCount) {
  const plans = getActivePlanList();
  const rows = [];

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    if (!plan.parentRoom) continue;
    const targetRoom = Game.rooms[plan.targetRoom] || null;
    if (targetRoom) {
      module.exports.updatePlanIntel(plan);
    }
    const progress = getExpansionProgressSummary(plan, targetRoom);

    rows.push({
      kind: "expansion",
      parentRoom: plan.parentRoom,
      targetRoom: plan.targetRoom,
      phaseLabel: formatExpansionProgressLabel(progress),
      status: getExpansionRowStatus(plan, ownedRoomCount),
      nextGoal: appendExpansionEta(
        getExpansionRowNextGoal(plan, ownedRoomCount),
        progress,
      ),
    });
  }

  rows.sort(function (a, b) {
    if ((a.parentRoom || "") !== (b.parentRoom || "")) {
      return (a.parentRoom || "").localeCompare(b.parentRoom || "");
    }

    return (a.targetRoom || "").localeCompare(b.targetRoom || "");
  });

  return rows;
}

function pruneExpansionQueue(targetRoomName) {
  const targetRoom = normalizeRoomName(targetRoomName);
  if (!targetRoom || !Memory.rooms) return 0;

  let removed = 0;

  for (const roomName in Memory.rooms) {
    if (!Object.prototype.hasOwnProperty.call(Memory.rooms, roomName)) continue;
    const roomMemory = Memory.rooms[roomName];
    if (!roomMemory || !roomMemory.spawnQueue) continue;

    const before = roomMemory.spawnQueue.length;
    roomMemory.spawnQueue = roomMemory.spawnQueue.filter(function (item) {
      return !(
        item &&
        item.targetRoom === targetRoom &&
        (
          item.operation === "expansion" ||
          item.operation === "expansion_defense" ||
          item.operation === "expansion_defense_support"
        )
      );
    });
    removed += before - roomMemory.spawnQueue.length;
  }

  return removed;
}

function getEmpireAdvancedConfig() {
  return config.ADVANCED && config.ADVANCED.EMPIRE
    ? config.ADVANCED.EMPIRE
    : {};
}

function getStoreAmount(structure, resourceType) {
  if (!structure || !structure.store || !resourceType) return 0;
  if (typeof structure.store.getUsedCapacity === "function") {
    const used = structure.store.getUsedCapacity(resourceType);
    if (typeof used === "number" && used > 0) return used;
  }
  return structure.store[resourceType] || 0;
}

function getTerminalFreeCapacity(terminal, resourceType) {
  if (!terminal || !terminal.store) return 0;
  if (typeof terminal.store.getFreeCapacity === "function") {
    return terminal.store.getFreeCapacity(resourceType);
  }
  return 0;
}

function getTransactionCost(amount, fromRoom, toRoom) {
  if (
    Game.map &&
    typeof Game.map.calcTransactionCost === "function"
  ) {
    return Game.map.calcTransactionCost(amount, fromRoom, toRoom);
  }

  const distance =
    Game.map && typeof Game.map.getRoomLinearDistance === "function"
      ? Game.map.getRoomLinearDistance(fromRoom, toRoom)
      : 1;
  return Math.ceil(amount * Math.max(1, distance) * 0.1);
}

function getReactionForProduct(product) {
  return product
    ? advancedStructureManager.getReactionInputsForProduct(product)
    : null;
}

function getLabDemandForRoom(room, state) {
  const summary =
    state && state.advancedOps
      ? state.advancedOps
      : Memory.rooms &&
        Memory.rooms[room.name] &&
        Memory.rooms[room.name].advancedOps
        ? Memory.rooms[room.name].advancedOps.summary
        : null;
  if (!summary || !summary.labGoal) return null;

  const product = summary.labProduct || summary.labGoal;
  const reaction = getReactionForProduct(product);
  if (!reaction) return null;

  const terminal = room.terminal || null;
  const storage = room.storage || null;
  const labs =
    state && state.structuresByType
      ? state.structuresByType[STRUCTURE_LAB] || []
      : [];
  const reagents = [reaction.reagentA, reaction.reagentB];
  let best = null;

  for (let i = 0; i < reagents.length; i++) {
    const resourceType = reagents[i];
    let localAmount =
      getStoreAmount(terminal, resourceType) + getStoreAmount(storage, resourceType);
    for (let labIndex = 0; labIndex < labs.length; labIndex++) {
      localAmount += getStoreAmount(labs[labIndex], resourceType);
    }
    const missing = Math.max(0, advancedStructureManager.getLabInputTarget() - localAmount);
    if (missing <= 0) continue;
    if (!best || missing > best.missing) {
      best = {
        roomName: room.name,
        resourceType: resourceType,
        missing: missing,
        goal: summary.labGoal,
        product: product,
        reason: summary.labReason || null,
      };
    }
  }

  return best;
}

function getSupportSettings() {
  return getEmpireAdvancedConfig();
}

module.exports = {
  collectOwnedRooms() {
    const ownedRooms = [];

    for (const roomName in Game.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Game.rooms, roomName)) continue;

      const room = Game.rooms[roomName];
      if (!room.controller || !room.controller.my) continue;

      ownedRooms.push(room);
    }

    ownedRooms.sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });

    return ownedRooms;
  },

  record(ownedRooms, roomStates) {
    const rooms = ownedRooms || this.collectOwnedRooms();
    const states = roomStates || {};
    const memory = ensureEmpireMemory();
    const roomNames = [];
    const roomSnapshots = {};
    let totalCreeps = 0;
    let totalSites = 0;
    let totalQueue = 0;
    let totalStorageEnergy = 0;
    let alertRooms = 0;

    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      const state = states[room.name] || null;
      const spawns = state && state.spawns
        ? state.spawns
        : room.find(FIND_MY_SPAWNS);
      const sites = state && state.sites
        ? state.sites
        : room.find(FIND_CONSTRUCTION_SITES);
      const homeCreeps = state && state.homeCreeps
        ? state.homeCreeps
        : _.filter(Game.creeps, function (creep) {
            return creep.memory && creep.memory.room === room.name;
          });
      const queue = getQueue(room.name);
      const storageEnergy = sumEnergyInStore(room.storage, RESOURCE_ENERGY);
      const hostiles = countHostiles(state);
      const phase = state && state.phase ? state.phase : null;
      const roleCounts = state && state.roleCounts ? state.roleCounts : {};

      roomNames.push(room.name);
      totalCreeps += homeCreeps.length;
      totalSites += sites.length;
      totalQueue += queue.length;
      totalStorageEnergy += storageEnergy;
      if (hostiles > 0) alertRooms++;

      roomSnapshots[room.name] = {
        tick: Game.time,
        phase: phase,
        rcl: room.controller ? room.controller.level : 0,
        controllerProgressPct: getControllerProgressPct(room),
        energyAvailable: room.energyAvailable,
        energyCapacityAvailable: room.energyCapacityAvailable,
        storageEnergy: storageEnergy,
        terminalEnergy: sumEnergyInStore(room.terminal, RESOURCE_ENERGY),
        spawnCount: spawns.length,
        busySpawns: countBusySpawns(spawns),
        constructionSites: sites.length,
        creepCount: homeCreeps.length,
        roleCounts: roleCounts,
        spawnQueueSize: queue.length,
        nextQueued: queue.length > 0 ? queue[0].role : "none",
        hostileCount: hostiles,
        alert: hostiles > 0,
      };
    }

    memory.tick = Game.time;
    memory.ownedRooms = roomNames;
    memory.gcl = getGclSummary(rooms.length);
    memory.summary = {
      tick: Game.time,
      roomCount: rooms.length,
      creepCount: totalCreeps,
      constructionSites: totalSites,
      spawnQueueSize: totalQueue,
      storageEnergy: totalStorageEnergy,
      alertRooms: alertRooms,
    };
    memory.rooms = roomSnapshots;
    memory.expansion.summary = this.getExpansionSummary(rooms.length);
    memory.reservation.summary = reservationManager.getReservationSummary();
    memory.support = this.getScheduledSupportSummary(rooms, states, memory);
    if (Memory.runtime && Memory.runtime.roomReview && Memory.runtime.roomReview.lastSummary) {
      memory.roomReview = Memory.runtime.roomReview.lastSummary;
    }
    this.runMineralBalancing(rooms, states, memory);

    return memory;
  },

  runMineralBalancing(ownedRooms, roomStates, empireMemory) {
    const settings = getEmpireAdvancedConfig();
    const mineralMemory = empireMemory.minerals || {};

    if (settings.MINERAL_BALANCING_ENABLED === false) {
      mineralMemory.status = "disabled";
      empireMemory.minerals = mineralMemory;
      return mineralMemory;
    }

    const interval =
      typeof settings.RUN_INTERVAL === "number" ? Math.max(1, settings.RUN_INTERVAL) : 5;
    const balanceDecision = scheduler.canRunOptional(
      "empire.mineralBalancing",
      interval,
    );
    if (!balanceDecision.ok) {
      scheduler.recordSkip("empire.mineralBalancing", balanceDecision.reason);
      mineralMemory.status = "waiting";
      empireMemory.minerals = mineralMemory;
      return mineralMemory;
    }
    const balanceCpu = Game.cpu ? Game.cpu.getUsed() : 0;

    const rooms = ownedRooms || [];
    const states = roomStates || {};
    const demands = [];
    const pendingByRoom = {};
    const transferBatch =
      typeof settings.TRANSFER_BATCH === "number" ? settings.TRANSFER_BATCH : 500;
    const minReserve =
      typeof settings.MIN_SENDER_RESERVE === "number" ? settings.MIN_SENDER_RESERVE : 500;
    const minEnergy =
      typeof settings.MIN_TERMINAL_ENERGY === "number" ? settings.MIN_TERMINAL_ENERGY : 5000;
    const maxEnergyRatio =
      typeof settings.MAX_TRANSFER_ENERGY_RATIO === "number"
        ? settings.MAX_TRANSFER_ENERGY_RATIO
        : 0.25;
    const maxTransfers =
      typeof settings.MAX_TRANSFERS_PER_TICK === "number"
        ? Math.max(0, settings.MAX_TRANSFERS_PER_TICK)
        : 1;
    let transfers = 0;
    let lastTransfer = null;

    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      if (!room.terminal || room.terminal.cooldown > 0) continue;
      if (getTerminalFreeCapacity(room.terminal) <= 0) continue;

      const demand = getLabDemandForRoom(room, states[room.name] || null);
      if (!demand) continue;
      demands.push(demand);
      pendingByRoom[room.name] = {
        resourceType: demand.resourceType,
        missing: demand.missing,
        goal: demand.goal,
        product: demand.product,
      };
    }

    for (let demandIndex = 0; demandIndex < demands.length; demandIndex++) {
      if (transfers >= maxTransfers) break;

      const demand = demands[demandIndex];
      const receiver = Game.rooms[demand.roomName] || null;
      if (!receiver || !receiver.terminal) continue;

      const receiverFree = getTerminalFreeCapacity(receiver.terminal, demand.resourceType);
      if (receiverFree <= 0) continue;

      const sender = this.findMineralSender(
        rooms,
        demand,
        minReserve,
        minEnergy,
        maxEnergyRatio,
        receiverFree,
      );
      if (!sender) continue;

      const amount = Math.min(transferBatch, demand.missing, sender.available, receiverFree);
      if (amount <= 0) continue;

      const result = sender.terminal.send(
        demand.resourceType,
        amount,
        receiver.name,
        "empire_lab_import",
      );

      if (result === OK) {
        transfers++;
        lastTransfer = {
          tick: Game.time,
          from: sender.room.name,
          to: receiver.name,
          resourceType: demand.resourceType,
          amount: amount,
          goal: demand.goal,
          product: demand.product,
          energyCost: sender.energyCost,
        };
      }
    }

    mineralMemory.tick = Game.time;
    mineralMemory.status = transfers > 0 ? "sent" : demands.length > 0 ? "pending" : "idle";
    mineralMemory.pendingByRoom = pendingByRoom;
    if (lastTransfer) mineralMemory.lastTransfer = lastTransfer;
    empireMemory.minerals = mineralMemory;
    scheduler.markOptionalRun("empire.mineralBalancing", balanceCpu);
    return mineralMemory;
  },

  findMineralSender(rooms, demand, minReserve, minEnergy, maxEnergyRatio, receiverFree) {
    let best = null;

    for (let i = 0; i < rooms.length; i++) {
      const room = rooms[i];
      if (!room || room.name === demand.roomName || !room.terminal) continue;
      if (room.terminal.cooldown > 0) continue;

      const terminal = room.terminal;
      const stored = getStoreAmount(terminal, demand.resourceType);
      const available = Math.min(stored - minReserve, receiverFree);
      if (available <= 0) continue;

      const terminalEnergy = getStoreAmount(terminal, RESOURCE_ENERGY);
      if (terminalEnergy < minEnergy) continue;

      const amount = Math.min(
        typeof getEmpireAdvancedConfig().TRANSFER_BATCH === "number"
          ? getEmpireAdvancedConfig().TRANSFER_BATCH
          : 500,
        demand.missing,
        available,
      );
      const energyCost = getTransactionCost(amount, room.name, demand.roomName);
      if (energyCost > terminalEnergy - minEnergy) continue;
      if (energyCost > terminalEnergy * maxEnergyRatio) continue;

      const score = available - energyCost;
      if (!best || score > best.score) {
        best = {
          room: room,
          terminal: terminal,
          available: available,
          energyCost: energyCost,
          score: score,
        };
      }
    }

    return best;
  },

  buildSupportSummary(ownedRooms, roomStates) {
    const requestsByDonor = {};
    const rooms = ownedRooms || [];
    const states = roomStates || {};

    for (let i = 0; i < rooms.length; i++) {
      const donor = rooms[i];
      const donorState = states[donor.name] || null;
      if (!this.canProvideEmpireSupport(donor, donorState)) continue;

      for (let j = 0; j < rooms.length; j++) {
        const target = rooms[j];
        if (target.name === donor.name) continue;

        const targetState = states[target.name] || null;
        const request = this.getSupportNeedForTarget(target, targetState, donor.name);
        if (!request) continue;
        if (!requestsByDonor[donor.name]) requestsByDonor[donor.name] = [];
        requestsByDonor[donor.name].push(request);
      }
    }

    return {
      tick: Game.time,
      requestsByDonor: requestsByDonor,
    };
  },

  getScheduledSupportSummary(ownedRooms, roomStates, empireMemory) {
    const settings = getSupportSettings();
    const interval =
      typeof settings.RUN_INTERVAL === "number" ? Math.max(1, settings.RUN_INTERVAL) : 5;
    const existing = empireMemory && empireMemory.support ? empireMemory.support : null;
    const decision = scheduler.canRunOptional("empire.support", interval);

    if (!decision.ok) {
      scheduler.recordSkip("empire.support", decision.reason);
      return existing || {
        tick: Game.time,
        requestsByDonor: {},
        status: "waiting",
      };
    }

    const before = Game.cpu ? Game.cpu.getUsed() : 0;
    const summary = this.buildSupportSummary(ownedRooms, roomStates);
    summary.status = "updated";
    scheduler.markOptionalRun("empire.support", before);
    return summary;
  },

  getEmpireSupportSpawnRequests(room, state) {
    const settings = getSupportSettings();
    if (settings.SUPPORT_ENABLED === false) return [];

    const memory = ensureEmpireMemory();
    if (!memory.support || !memory.support.requestsByDonor) {
      if (!scheduler.getMemory().active) {
        memory.support = this.buildSupportSummary(this.collectOwnedRooms(), {});
      } else {
        memory.support = {
          tick: Game.time,
          requestsByDonor: {},
          status: "waiting",
        };
      }
    }

    return (memory.support.requestsByDonor[room.name] || []).filter(function (request) {
      return !!request;
    });
  },

  canProvideEmpireSupport(room, state) {
    const settings = getSupportSettings();
    if (settings.SUPPORT_ENABLED === false) return false;
    if (!room || !room.controller || !room.controller.my) return false;
    if (room.controller.level < (settings.SUPPORT_MIN_DONOR_RCL || 6)) return false;
    if (!room.storage || (room.storage.store[RESOURCE_ENERGY] || 0) < (settings.SUPPORT_MIN_DONOR_STORAGE_ENERGY || 50000)) {
      return false;
    }
    if (state && state.hostileCreeps && state.hostileCreeps.length > 0) return false;

    const queue = getQueue(room.name);
    for (let i = 0; i < queue.length; i++) {
      if ((queue[i].priority || 0) >= 90 && queue[i].operation !== "empire_support") {
        return false;
      }
    }

    return true;
  },

  getSupportNeedForTarget(targetRoom, targetState, donorRoomName) {
    const settings = getSupportSettings();
    if (!targetRoom || !targetRoom.controller || !targetRoom.controller.my) return null;
    if (!targetState) return null;
    if (targetState.hostileCreeps && targetState.hostileCreeps.length > 0) return null;

    const maxPerRole = settings.SUPPORT_MAX_PER_TARGET_ROLE || 1;
    const sites = targetState.sites ? targetState.sites.length : 0;
    const roleCounts = targetState.roleCounts || {};
    const workerCoverage =
      (roleCounts.worker || 0) +
      (roleCounts.jrworker || 0) +
      this.countEmpireSupport("worker", targetRoom.name, donorRoomName);
    const upgraderCoverage =
      (roleCounts.upgrader || 0) +
      this.countEmpireSupport("upgrader", targetRoom.name, donorRoomName);

    if (
      sites > 0 &&
      workerCoverage < Math.max(1, Math.min(maxPerRole, sites))
    ) {
      return {
        role: "worker",
        priority: settings.SUPPORT_WORKER_PRIORITY || 65,
        operation: "empire_support",
        supportRole: "worker",
        homeRoom: donorRoomName,
        targetRoom: targetRoom.name,
      };
    }

    const downgradeTicks =
      targetRoom.controller && typeof targetRoom.controller.ticksToDowngrade === "number"
        ? targetRoom.controller.ticksToDowngrade
        : Infinity;
    const controllerPressure =
      downgradeTicks <= (settings.SUPPORT_CONTROLLER_DOWNGRADE_TICKS || 8000) ||
      (
        targetRoom.controller.level < 8 &&
        getQueue(targetRoom.name).length > 0 &&
        (roleCounts.upgrader || 0) <= 0
      );

    if (controllerPressure && upgraderCoverage < maxPerRole) {
      return {
        role: "upgrader",
        priority: settings.SUPPORT_UPGRADER_PRIORITY || 58,
        operation: "empire_support",
        supportRole: "upgrader",
        homeRoom: donorRoomName,
        targetRoom: targetRoom.name,
      };
    }

    return null;
  },

  countEmpireSupport(role, targetRoomName, donorRoomName) {
    let count = 0;

    for (const creepName in Game.creeps) {
      if (!Object.prototype.hasOwnProperty.call(Game.creeps, creepName)) continue;
      const creep = Game.creeps[creepName];
      if (!creep || !creep.memory) continue;
      if (creep.memory.operation !== "empire_support") continue;
      if (creep.memory.supportRole !== role && creep.memory.role !== role) continue;
      if (creep.memory.targetRoom !== targetRoomName) continue;
      if (donorRoomName && creep.memory.homeRoom !== donorRoomName) continue;
      if (creep.ticksToLive !== undefined && creep.ticksToLive <= 100) continue;
      count++;
    }

    if (!Memory.rooms) return count;
    for (const roomName in Memory.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Memory.rooms, roomName)) continue;
      const queue = Memory.rooms[roomName] ? Memory.rooms[roomName].spawnQueue : null;
      if (!queue) continue;
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (!item || item.operation !== "empire_support") continue;
        if (item.role !== role && item.supportRole !== role) continue;
        if (item.targetRoom !== targetRoomName) continue;
        if (donorRoomName && item.homeRoom !== donorRoomName) continue;
        count++;
      }
    }

    return count;
  },

  createExpansion(targetRoomName, parentRoomName) {
    if (!isExpansionEnabled()) {
      return {
        ok: false,
        message: "Expansion is disabled in config.",
      };
    }

    const targetRoom = normalizeRoomName(targetRoomName);
    if (!targetRoom) {
      return {
        ok: false,
        message: "Target room is required.",
      };
    }

    const ownedRooms = this.collectOwnedRooms();
    const reservedPlan = reservationManager.getActiveReservation(targetRoom);
    let parentRoom = normalizeRoomName(parentRoomName) ||
      (reservedPlan ? reservedPlan.parentRoom : null);

    if (parentRoom) {
      const parent = Game.rooms[parentRoom];
      if (!parent || !parent.controller || !parent.controller.my) {
        return {
          ok: false,
          message: `Parent room ${parentRoom} is not an owned visible room.`,
        };
      }
      if (parent.find(FIND_MY_SPAWNS).length <= 0) {
        return {
          ok: false,
          message: `Parent room ${parentRoom} has no available spawn network.`,
        };
      }
    } else {
      const selected = chooseParentRoom(targetRoom, ownedRooms);
      if (!selected) {
        return {
          ok: false,
          message: "No owned room with a spawn is available as an expansion parent.",
        };
      }
      parentRoom = selected.name;
    }

    const plans = getExpansionPlans();
    const existing = plans[targetRoom] || {};
    const plan = Object.assign({}, existing, {
      targetRoom: targetRoom,
      parentRoom: parentRoom,
      createdAt: existing.createdAt || Game.time,
      updatedAt: Game.time,
      cancelled: false,
    });
    delete plan.focus;

    plans[targetRoom] = plan;
    this.updatePlanIntel(plan);
    if (reservedPlan) {
      reservationManager.convertReservationToExpansion(targetRoom, parentRoom);
    }

    return {
      ok: true,
      plan: plan,
      message: `Expansion plan active: ${targetRoom} from ${parentRoom}.`,
    };
  },

  getActiveExpansion(targetRoomName) {
    const targetRoom = normalizeRoomName(targetRoomName);
    if (!targetRoom) return null;

    const plan = getExpansionPlans()[targetRoom] || null;
    if (!plan || plan.cancelled) return null;
    ensureExpansionPlanDefaults(plan, targetRoom);
    reconcileExpansionSupport(plan);

    return plan;
  },

  getExpansionThreat(planOrTargetRoom) {
    const plan =
      typeof planOrTargetRoom === "string"
        ? this.getActiveExpansion(planOrTargetRoom)
        : planOrTargetRoom;

    if (!plan || plan.cancelled) return null;

    const targetRoom = Game.rooms[plan.targetRoom] || null;
    if (targetRoom) {
      return getVisibleExpansionThreat(targetRoom);
    }

    return getStoredExpansionThreat(plan);
  },

  updatePlanIntel(plan) {
    if (!plan || !plan.targetRoom) return;

    const room = Game.rooms[plan.targetRoom] || null;
    if (!plan.intel) plan.intel = {};
    if (!room) return;

    const threat = getVisibleExpansionThreat(room);
    invasionLog.recordRemote(plan.targetRoom, "expansion", threat);
    plan.intel.visibleAt = Game.time;
    plan.intel.hostileCount = threat ? threat.hostileCount || 0 : 0;
    plan.intel.threatSeenAt = threat ? Game.time : null;
    plan.intel.threatScore = threat ? threat.threatScore || 0 : 0;
    plan.intel.threatLevel = threat ? threat.threatLevel || 0 : 0;
    plan.intel.desiredDefenders = threat ? threat.desiredDefenders || 1 : 0;
    plan.intel.hostileCombatPower = threat ? threat.hostileCombatPower || 0 : 0;
    plan.intel.hostileHealingPower = threat ? threat.hostileHealingPower || 0 : 0;
    plan.intel.threatLabel = threat ? threat.towerTargetSummary || threat.classification || "visible expansion threat" : null;
    plan.intel.targetOwned = !!(room.controller && room.controller.my);
    plan.intel.controllerLevel = room.controller ? room.controller.level || 0 : 0;
    plan.intel.controllerProgress = room.controller ? room.controller.progress || 0 : 0;
    plan.intel.controllerProgressTotal = room.controller
      ? room.controller.progressTotal || 0
      : 0;
    plan.intel.hasSpawn = room.find(FIND_MY_SPAWNS).length > 0;
    plan.updatedAt = Game.time;
  },

  cancelExpansion(targetRoomName) {
    const targetRoom = normalizeRoomName(targetRoomName);
    const plans = getExpansionPlans();

    if (!targetRoom || !plans[targetRoom]) {
      return {
        ok: false,
        message: "Expansion plan not found.",
      };
    }

    plans[targetRoom].cancelled = true;
    plans[targetRoom].updatedAt = Game.time;
    const removed = pruneExpansionQueue(targetRoom);

    return {
      ok: true,
      plan: plans[targetRoom],
      message:
        removed > 0
          ? `Expansion plan cancelled: ${targetRoom}. Removed ${removed} queued spawn requests.`
          : `Expansion plan cancelled: ${targetRoom}.`,
    };
  },

  convertExpansionToReservation(targetRoomName, nextParentRoom) {
    const targetRoom = normalizeRoomName(targetRoomName);
    if (!targetRoom) return null;

    const plan = getExpansionPlans()[targetRoom] || null;
    if (!plan || plan.cancelled || plan.convertedToReservation) return null;

    plan.convertedToReservation = true;
    plan.cancelled = true;
    plan.convertedAt = Game.time;
    plan.updatedAt = Game.time;
    if (nextParentRoom) plan.convertedParentRoom = nextParentRoom;
    pruneExpansionQueue(targetRoom);

    return plan;
  },

  getExpansionSummary(ownedRoomCount) {
    const plans = getActivePlanList();
    const counts = {
      active: plans.length,
      claiming: 0,
      bootstrapping: 0,
      blocked: 0,
      complete: 0,
    };

    for (let i = 0; i < plans.length; i++) {
      const status = getPlanStatus(plans[i], ownedRoomCount);

      if (status === "claiming") counts.claiming++;
      else if (status === "bootstrapping") counts.bootstrapping++;
      else if (status === "complete") counts.complete++;
      else if (status.indexOf("blocked") === 0) counts.blocked++;
    }

    return counts;
  },

  getExpansionSpawnRequests(room, state) {
    if (!isExpansionEnabled()) return [];

    const requests = [];
    const plans = getActivePlanList();
    const ownedRoomCount = this.collectOwnedRooms().length;
    const settings = getExpansionSettings();
    const desiredPioneers =
      typeof settings.PIONEERS_PER_EXPANSION === "number"
        ? settings.PIONEERS_PER_EXPANSION
        : 2;

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      const targetRoom = Game.rooms[plan.targetRoom] || null;
      if (targetRoom) {
        this.updatePlanIntel(plan);
      }
      if (
        plan.parentRoom === room.name &&
        isParentReady(room, state) &&
        typeof plan.startedAt !== "number"
      ) {
        plan.startedAt = Game.time;
      }

      const threat = this.getExpansionThreat(plan);
      const started = hasStartedExpansionOperation(plan, targetRoom);

      if (plan.parentRoom === room.name && started) {
        this.addExpansionMaintenanceRequests(room, state, requests, plan, targetRoom, threat);
      }

      if (threat) {
        if (started) {
          this.addExpansionDefenseRequest(room, state, requests, plan, threat);
        }
        continue;
      }

      if (plan.parentRoom !== room.name) continue;
      if (!isParentReady(room, state)) continue;

      const status = getPlanStatus(plan, ownedRoomCount);
      plan.status = status;
      plan.updatedAt = Game.time;

      if (status === "claiming") {
        if (room.energyCapacityAvailable < 650) continue;

        const claimers =
          countExpansionCreeps("claimer", plan.targetRoom, room.name) +
          countQueuedExpansion("claimer", plan.targetRoom, room.name);
        if (claimers <= 0) {
          requests.push({
            role: "claimer",
            priority:
              typeof settings.CLAIM_PRIORITY === "number"
                ? settings.CLAIM_PRIORITY
                : 95,
            homeRoom: room.name,
            targetRoom: plan.targetRoom,
            operation: "expansion",
          });
        }
      }

      if (targetRoom && shouldRequestExpansionPioneerSupport(targetRoom)) {
        const pioneers =
          countExpansionCreeps("pioneer", plan.targetRoom, room.name) +
          countQueuedExpansion("pioneer", plan.targetRoom, room.name);

        for (let pioneerIndex = pioneers; pioneerIndex < desiredPioneers; pioneerIndex++) {
          requests.push({
            role: "pioneer",
            priority:
              typeof settings.PIONEER_PRIORITY === "number"
                ? settings.PIONEER_PRIORITY
                : 75,
            homeRoom: room.name,
            targetRoom: plan.targetRoom,
            operation: "expansion",
          });
        }
      }
    }

    return requests;
  },

  addExpansionMaintenanceRequests(room, state, requests, plan, targetRoom, threat) {
    if (plan.parentRoom !== room.name) return;
    if (!isParentOperational(room, state)) return;

    const status = getPlanStatus(plan, this.collectOwnedRooms().length);
    if (status !== "claiming") return;

    const claimers =
      countExpansionCreeps("claimer", plan.targetRoom, room.name) +
      countQueuedExpansion("claimer", plan.targetRoom, room.name);

    if (claimers <= 0 && (shouldRefreshVisibility(plan, targetRoom) || !!threat)) {
      requests.push({
        role: "claimer",
        priority:
          typeof getExpansionSettings().CLAIM_PRIORITY === "number"
            ? getExpansionSettings().CLAIM_PRIORITY
            : 95,
        homeRoom: room.name,
        targetRoom: plan.targetRoom,
        operation: "expansion",
      });
    }
  },

  addExpansionDefenseRequest(room, state, requests, plan, threat) {
    if (!this.shouldRoomDefendExpansion(room, state, plan, threat)) return;

    const assigned = countExpansionDefenseCoverage(plan.targetRoom);
    const desired = Math.max(1, threat.desiredDefenders || 1);
    if (assigned >= desired) return;

    requests.push({
      role: "defender",
      priority: 1050,
      threatLevel: threat.threatLevel || 1,
      threatScore: threat.threatScore || 0,
      responseMode: "creep_only",
      targetRoom: plan.targetRoom,
      operation:
        room.name === plan.parentRoom
          ? "expansion_defense"
          : "expansion_defense_support",
      defenseType: "expansion_threat",
      homeRoom: room.name,
    });
  },

  shouldRoomDefendExpansion(room, state, plan) {
    if (!room || !room.controller || !room.controller.my) return false;
    if (!state || !state.spawns || state.spawns.length <= 0) return false;
    if (state.defense && state.defense.hasThreats) return false;
    if (room.energyCapacityAvailable < 650) return false;

    if (room.name === plan.parentRoom) return true;
    if (getExpansionSettings().DEFENSE_SUPPORT_ENABLED === false) return false;
    if (this.isExpansionParentDefenseAvailable(plan.parentRoom)) return false;
    if (
      !Game.map ||
      typeof Game.map.getRoomLinearDistance !== "function" ||
      Game.map.getRoomLinearDistance(room.name, plan.targetRoom) >
        (
          typeof getExpansionSettings().DEFENSE_SUPPORT_DISTANCE === "number"
            ? getExpansionSettings().DEFENSE_SUPPORT_DISTANCE
            : 2
        )
    ) {
      return false;
    }

    return this.getBestExpansionDefenseHelper(plan) === room.name;
  },

  isExpansionParentDefenseAvailable(parentRoomName) {
    const parent = Game.rooms[parentRoomName] || null;
    if (!parent || !parent.controller || !parent.controller.my) return false;
    if (parent.find(FIND_MY_SPAWNS).length <= 0) return false;
    if (parent.energyCapacityAvailable < 650) return false;

    const cache = utils.getRoomRuntimeCache(parent);
    const state = cache && cache.state ? cache.state : null;
    if (state && state.defense && state.defense.hasThreats) return false;

    return true;
  },

  getBestExpansionDefenseHelper(plan) {
    let bestRoomName = null;
    let bestScore = Infinity;

    for (const roomName in Game.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Game.rooms, roomName)) continue;
      if (roomName === plan.parentRoom) continue;

      const room = Game.rooms[roomName];
      if (!room || !room.controller || !room.controller.my) continue;
      if (room.find(FIND_MY_SPAWNS).length <= 0) continue;
      if (room.energyCapacityAvailable < 650) continue;
      if (
        !Game.map ||
        typeof Game.map.getRoomLinearDistance !== "function"
      ) {
        continue;
      }

      const distance = Game.map.getRoomLinearDistance(room.name, plan.targetRoom);
      const maxDistance =
        typeof getExpansionSettings().DEFENSE_SUPPORT_DISTANCE === "number"
          ? getExpansionSettings().DEFENSE_SUPPORT_DISTANCE
          : 2;
      if (distance > maxDistance) continue;

      if (
        distance < bestScore ||
        (distance === bestScore && (!bestRoomName || room.name < bestRoomName))
      ) {
        bestRoomName = room.name;
        bestScore = distance;
      }
    }

    return bestRoomName;
  },

  getExpansionLines() {
    return buildExpansionLines();
  },

  buildRoomReports(ownedRooms, roomStates, options) {
    const rooms = ownedRooms || this.collectOwnedRooms();
    const states = roomStates || {};
    const reportOptions = options || {};
    const reports = [];

    for (let i = 0; i < rooms.length; i++) {
      reports.push(
        roomReporting.build(
          rooms[i],
          states[rooms[i].name] || null,
          reportOptions,
        ),
      );
    }

    return reports;
  },

  buildReport(reports) {
    const roomReports = reports || this.buildRoomReports(null, null, {
      updateProgress: true,
    });
    const gcl = getGclSummary(roomReports.length);
    const phaseCounts = getPhaseCounts(roomReports);
    const summary = {
      tick: Game.time,
      gcl: gcl,
      roomCount: roomReports.length,
      creepCount: 0,
      constructionSites: 0,
      spawnQueueSize: 0,
      alertRooms: 0,
      storageEnergy: 0,
      energyAvailable: 0,
      energyCapacityAvailable: 0,
      phaseCounts: phaseCounts,
      pressure: getRuntimeLabel(),
    };

    for (let i = 0; i < roomReports.length; i++) {
      const report = roomReports[i];
      const state = report.state || {};
      const room = Game.rooms[report.room];
      const spawnQueue = Memory.rooms &&
        Memory.rooms[report.room] &&
        Memory.rooms[report.room].spawnQueue
          ? Memory.rooms[report.room].spawnQueue
          : [];

      summary.creepCount += state.homeCreeps ? state.homeCreeps.length : 0;
      summary.constructionSites += state.sites ? state.sites.length : 0;
      summary.spawnQueueSize += spawnQueue.length;
      summary.alertRooms += report.alert && report.alert.active ? 1 : 0;
      summary.storageEnergy += room && room.storage
        ? room.storage.store[RESOURCE_ENERGY] || 0
        : 0;
      summary.energyAvailable += room ? room.energyAvailable || 0 : 0;
      summary.energyCapacityAvailable += room
          ? room.energyCapacityAvailable || 0
          : 0;
    }

    const expansionRows = getEmpireExpansionRows(roomReports.length);
    const reservationRows = reservationManager.getEmpireChildRows();
    const attackRows = attackManager.getEmpireChildRows();
    const childRows = expansionRows.concat(reservationRows).concat(attackRows);
    const childRowsByParent = {};
    const renderedChildRows = {};

    for (let i = 0; i < childRows.length; i++) {
      const row = childRows[i];
      if (!childRowsByParent[row.parentRoom]) {
        childRowsByParent[row.parentRoom] = [];
      }
      childRowsByParent[row.parentRoom].push(row);
    }

    const lines = [
      "[OPS][EMPIRE]",
      `Rooms: ${summary.roomCount}/${
        gcl.roomSlotsLimit === null ? "?" : gcl.roomSlotsLimit
      }   CPU: ${summary.pressure}   Creeps: ${summary.creepCount}   Queue: ${
        summary.spawnQueueSize
      }   Sites: ${summary.constructionSites}`,
      `Alerts: ${
        summary.alertRooms > 0 ? summary.alertRooms : "clear"
      }   Storage: ${formatCompactNumber(summary.storageEnergy)}   Energy: ${
        summary.energyAvailable
      }/${summary.energyCapacityAvailable}`,
      `${getGclLabel(gcl)}   Slots: ${
        gcl.roomSlotsUsed
      }/${gcl.roomSlotsLimit === null ? "?" : gcl.roomSlotsLimit}   Phases: ${formatPhaseCounts(phaseCounts)}`,
    ];
    const expansionSummary = this.getExpansionSummary(roomReports.length);
    if (expansionSummary.active > 0) {
      lines.push(
        `Expansions: ${expansionSummary.active} active | claim ${expansionSummary.claiming} | boot ${expansionSummary.bootstrapping} | blocked ${expansionSummary.blocked}`,
      );
    }
    if (attackRows.length > 0) {
      lines.push(`Attacks: ${attackRows.length} active`);
    }
    if (
      Memory.stats &&
      Memory.stats.scheduler &&
      Memory.stats.scheduler.tick
    ) {
      const schedule = Memory.stats.scheduler;
      const reasons = schedule.reasons || {};
      const reasonParts = [];
      for (const reason in reasons) {
        if (!Object.prototype.hasOwnProperty.call(reasons, reason)) continue;
        if (reason === "interval") continue;
        if ((reasons[reason] || 0) <= 0) continue;
        reasonParts.push(`${reason} ${reasons[reason]}`);
      }
      lines.push(
        `Sched: ran ${schedule.ran || 0} deferred ${schedule.deferred || 0}` +
          (reasonParts.length > 0 ? ` (${reasonParts.join(", ")})` : ""),
      );
    }
    if (
      Memory.empire &&
      Memory.empire.minerals &&
      Memory.empire.minerals.lastTransfer
    ) {
      const transfer = Memory.empire.minerals.lastTransfer;
      lines.push(
        `Minerals: ${transfer.from} -> ${transfer.to} ${transfer.resourceType} ${transfer.amount}`,
      );
    }
    if (
      Memory.empire &&
      Memory.empire.roomReview &&
      Memory.empire.roomReview.reviewed &&
      Memory.empire.roomReview.reviewed.length > 0
    ) {
      const review = Memory.empire.roomReview;
      const segments = [];
      for (let i = 0; i < review.reviewed.length; i++) {
        const entry = review.reviewed[i];
        if (!entry || !entry.changed || entry.changed.length <= 0) continue;
        segments.push(`${entry.room} fixed ${entry.changed.join(",")}`);
      }
      if (segments.length > 0) {
        lines.push(`Review: ${segments.join(" | ")}`);
      }
    }

    if (roomReports.length > 0) {
      lines.push(
        formatEmpireRow("Room", "Phase/RCL", "Status", "Next Goal"),
      );

      for (let i = 0; i < roomReports.length; i++) {
        const report = roomReports[i];
        lines.push(
          formatEmpireRow(
            report.room,
            getEmpirePhaseLabel(report),
            getEmpireRoomStatus(report),
            capitalizeLabel(report.nextTask),
          ),
        );

        const attachedChildRows = childRowsByParent[report.room] || [];
        for (let j = 0; j < attachedChildRows.length; j++) {
          const child = attachedChildRows[j];
          renderedChildRows[getEmpireChildKey(child)] = true;
          lines.push(
            formatEmpireRow(
              `${child.kind} ${child.targetRoom}`,
              child.phaseLabel || "",
              child.status,
              child.nextGoal,
            ),
          );
        }
      }
    }

    const unattachedRows = [];
    for (let i = 0; i < childRows.length; i++) {
      if (!renderedChildRows[getEmpireChildKey(childRows[i])]) {
        unattachedRows.push(childRows[i]);
      }
    }

    if (unattachedRows.length > 0) {
      lines.push("Unattached");
      for (let i = 0; i < unattachedRows.length; i++) {
        const child = unattachedRows[i];
        lines.push(
          formatEmpireRow(
            `${child.kind} ${child.targetRoom}`,
            child.phaseLabel || "",
            child.status,
            child.nextGoal,
          ),
        );
      }
    }

    return {
      summary: summary,
      reports: roomReports,
      lines: lines,
    };
  },
};
