/*
Developer Summary:
Reserved Room Manager

Purpose:
- Keep reserved-room operation memory and reporting in one place
- Spawn parent-owned reserver, remote worker, miner, hauler, and defender work
- Plan only lightweight visible-room remote construction on a throttled cadence

Important Notes:
- Reserved rooms are console-driven like expansions.
- CPU is protected by avoiding scans for non-visible rooms and throttling remote
  construction planning through RESERVATION.REMOTE_PLAN_INTERVAL.
- Remote roads intentionally use de-duplicated PathFinder paths so shared
  trunk tiles are planned once instead of fanning roads around every source.
*/

const config = require("config");
const utils = require("utils");
const defenseManager = require("defense_manager");

function ensureEmpireMemory() {
  if (!Memory.empire) Memory.empire = {};
  if (!Memory.empire.reservation) Memory.empire.reservation = {};
  if (!Memory.empire.reservation.plans) Memory.empire.reservation.plans = {};

  return Memory.empire;
}

function getReservationMemory() {
  return ensureEmpireMemory().reservation;
}

function getSettings() {
  return config.RESERVATION || {};
}

function isEnabled() {
  return getSettings().ENABLED !== false;
}

function normalizeRoomName(roomName) {
  if (!roomName) return null;

  const normalized = String(roomName).trim();
  return normalized.length > 0 ? normalized : null;
}

function getQueue(roomName) {
  return Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].spawnQueue
    ? Memory.rooms[roomName].spawnQueue
    : [];
}

function getRoomDistance(roomA, roomB) {
  if (Game.map && typeof Game.map.getRoomLinearDistance === "function") {
    return Game.map.getRoomLinearDistance(roomA, roomB);
  }

  const parsedA = parseRoomName(roomA);
  const parsedB = parseRoomName(roomB);
  if (!parsedA || !parsedB) return roomA === roomB ? 0 : 50;

  return Math.max(
    Math.abs(parsedA.x - parsedB.x),
    Math.abs(parsedA.y - parsedB.y),
  );
}

function parseRoomName(roomName) {
  const match = /^([WE])(\d+)([NS])(\d+)$/.exec(roomName || "");
  if (!match) return null;

  const x = parseInt(match[2], 10);
  const y = parseInt(match[4], 10);

  return {
    x: match[1] === "W" ? -x - 1 : x,
    y: match[3] === "N" ? -y - 1 : y,
  };
}

function getOwnedRoom(roomName) {
  const room = roomName ? Game.rooms[roomName] : null;
  if (!room || !room.controller || !room.controller.my) return null;
  return room;
}

function getPlanKey(targetRoom) {
  return normalizeRoomName(targetRoom);
}

function getPlans() {
  return getReservationMemory().plans || {};
}

function getThreatMemoryTtl() {
  const settings = getSettings();
  return typeof settings.DEFENSE_MEMORY_TTL === "number"
    ? settings.DEFENSE_MEMORY_TTL
    : 300;
}

function getVisionRefreshTtl() {
  const settings = getSettings();
  return typeof settings.VISIBILITY_REFRESH_TTL === "number"
    ? settings.VISIBILITY_REFRESH_TTL
    : 150;
}

function pruneReservationQueue(targetRoomName) {
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
          item.operation === "reservation" ||
          item.operation === "reservation_defense" ||
          item.operation === "reservation_defense_support"
        )
      );
    });
    removed += before - roomMemory.spawnQueue.length;
  }

  return removed;
}

function getActivePlanList() {
  const plans = getPlans();
  const result = [];

  for (const targetRoom in plans) {
    if (!Object.prototype.hasOwnProperty.call(plans, targetRoom)) continue;

    const plan = plans[targetRoom];
    if (!plan || plan.cancelled || plan.convertedToExpansion) continue;
    result.push(plan);
  }

  result.sort(function (a, b) {
    if ((a.parentRoom || "") !== (b.parentRoom || "")) {
      return (a.parentRoom || "").localeCompare(b.parentRoom || "");
    }
    return (a.targetRoom || "").localeCompare(b.targetRoom || "");
  });

  return result;
}

function isParentOperational(room, state) {
  const settings = getSettings();
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

function hasStartedReservationOperation(plan, targetRoom) {
  if (!plan) return false;
  if (typeof plan.startedAt === "number") return true;

  const room = targetRoom || (plan.targetRoom ? Game.rooms[plan.targetRoom] : null);
  if (
    room &&
    room.controller &&
    room.controller.reservation &&
    room.controller.reservation.username === utils.getUsername()
  ) {
    return true;
  }

  return !!(
    plan.intel &&
    typeof plan.intel.reservationTicks === "number" &&
    plan.intel.reservationTicks > 0
  );
}

function getStoredThreat(plan) {
  if (!hasRecentThreatIntel(plan)) return null;

  return {
    roomName: plan.targetRoom,
    scope: "reservation",
    classification: "reserved_room_threat",
    type: "reserved_room_threat",
    priority: getSettings().DEFENSE_PRIORITY || 1050,
    hostiles: [],
    hostileCount: plan.intel.hostileCount || 1,
    hostileReservation: false,
    active: true,
    desiredDefenders: Math.max(
      1,
      Math.min(
        getSettings().MAX_REMOTE_DEFENDERS || 1,
        plan.intel.desiredDefenders || 1,
      ),
    ),
    threatScore: plan.intel.threatScore || 1,
    threatLevel: plan.intel.threatLevel || 1,
    responseRole: "defender",
    spawnCooldown: getSettings().DEFENSE_SPAWN_COOLDOWN || 25,
    visible: false,
    towerTargetId: null,
    towerTargetSummary: plan.intel.threatLabel || "stale remote threat",
    towerFocusDamage: 0,
    towerCanHandle: false,
    activeTowerCount: 0,
    readyTowerCount: 0,
    responseMode: "creep_only",
    hostileCombatPower: plan.intel.hostileCombatPower || 120,
    hostileHealingPower: plan.intel.hostileHealingPower || 0,
  };
}

function getReplaceTtl(role) {
  const settings = getSettings();

  if (role === "reserver") {
    return typeof settings.RESERVER_REPLACE_TTL === "number"
      ? settings.RESERVER_REPLACE_TTL
      : 200;
  }

  return typeof settings.REMOTE_CREEP_REPLACE_TTL === "number"
    ? settings.REMOTE_CREEP_REPLACE_TTL
    : 100;
}

function countCreeps(role, targetRoom, parentRoom, sourceId) {
  let count = 0;

  for (const creepName in Game.creeps) {
    if (!Object.prototype.hasOwnProperty.call(Game.creeps, creepName)) continue;

    const creep = Game.creeps[creepName];
    if (!creep || !creep.memory) continue;
    if (creep.memory.role !== role) continue;
    if (creep.memory.targetRoom !== targetRoom) continue;
    if ((creep.memory.homeRoom || creep.memory.room) !== parentRoom) continue;
    if (sourceId && creep.memory.sourceId !== sourceId) continue;
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

function countQueued(role, targetRoom, parentRoom, sourceId) {
  const queue = getQueue(parentRoom);
  let count = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (!item || item.role !== role) continue;
    if (item.targetRoom !== targetRoom) continue;
    if ((item.homeRoom || parentRoom) !== parentRoom) continue;
    if (sourceId && item.sourceId !== sourceId) continue;
    count++;
  }

  return count;
}

function countDefenseCoverage(targetRoom) {
  let count = 0;

  for (const creepName in Game.creeps) {
    if (!Object.prototype.hasOwnProperty.call(Game.creeps, creepName)) continue;

    const creep = Game.creeps[creepName];
    if (!creep || !creep.memory || creep.memory.role !== "defender") continue;
    if (creep.memory.targetRoom !== targetRoom) continue;
    if (creep.ticksToLive !== undefined && creep.ticksToLive <= 90) continue;
    count++;
  }

  if (Memory.rooms) {
    for (const roomName in Memory.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Memory.rooms, roomName)) continue;

      const queue = Memory.rooms[roomName].spawnQueue || [];
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (item && item.role === "defender" && item.targetRoom === targetRoom) {
          count++;
        }
      }
    }
  }

  return count;
}

function getPlanStatus(plan) {
  if (!plan || !plan.targetRoom) return "invalid";
  if (plan.cancelled) return "cancelled";
  if (plan.convertedToExpansion) return "converted";

  const parent = getOwnedRoom(plan.parentRoom);
  if (!parent) return "blocked_parent";

  const target = Game.rooms[plan.targetRoom] || null;
  if (target && target.controller && target.controller.owner && !target.controller.my) {
    return "blocked_owner";
  }
  if (module.exports.getReservationThreat(plan)) return "threatened";
  if (target && target.controller && target.controller.reservation) {
    return "reserved";
  }
  if (target) return "visible";

  return "scouting";
}

function getStatusLabel(plan) {
  const status = getPlanStatus(plan);

  switch (status) {
    case "blocked_parent":
      return "blocked: parent unavailable";
    case "blocked_owner":
      return "blocked: owned by another player";
    case "threatened":
      return "threatened";
    default:
      return status;
  }
}

function getReservationTicks(plan) {
  const room = plan && plan.targetRoom ? Game.rooms[plan.targetRoom] : null;
  if (room && room.controller && room.controller.reservation) {
    return room.controller.reservation.ticksToEnd || 0;
  }

  if (plan && plan.intel && typeof plan.intel.reservationTicks === "number") {
    return plan.intel.reservationTicks;
  }

  return 0;
}

function isParentStable(room, state) {
  const settings = getSettings();
  const minRcl =
    typeof settings.MIN_PARENT_RCL === "number" ? settings.MIN_PARENT_RCL : 4;

  if (!room || !room.controller || room.controller.level < minRcl) return false;
  if (!state || !state.spawns || state.spawns.length <= 0) return false;
  if (state.defense && state.defense.hasThreats) return false;

  if (settings.REQUIRE_STABLE_PARENT === false) return true;

  return !!(
    state.buildStatus &&
    (state.buildStatus.stableReady || state.buildStatus.developmentComplete)
  );
}

function hasRemoteThreat(room) {
  if (!room) return false;
  return utils.getDefenseIntruders(room).length > 0;
}

function getRemoteThreat(room) {
  const hostiles = utils.getDefenseIntruders(room);
  if (hostiles.length <= 0) return null;

  const reaction = defenseManager.getReactionConfig();

  return defenseManager.createThreatDescriptor({
    roomName: room.name,
    scope: "reservation",
    classification: "reserved_room_threat",
    priority:
      getSettings().DEFENSE_PRIORITY ||
      Math.max(1000, reaction.SUPPORT_PRIORITY || 1050),
    hostiles: hostiles,
    hostileReservation: false,
    desiredDefenders: Math.min(
      getSettings().MAX_REMOTE_DEFENDERS || 1,
      Math.max(1, Math.ceil(hostiles.length / 2)),
    ),
    reaction: reaction,
    responseRole: "defender",
    spawnCooldown: getSettings().DEFENSE_SPAWN_COOLDOWN || 25,
    visible: true,
    towerCanHandle: false,
    responseMode: "creep_only",
    hostileCombatPower: 120,
    hostileHealingPower: 0,
  });
}

function getParentDeliveryTarget(parentRoom) {
  if (!parentRoom) return null;
  return parentRoom.storage || parentRoom.find(FIND_MY_SPAWNS)[0] || parentRoom.controller || null;
}

function getRemoteContainersBySource(room) {
  const sources = room.find(FIND_SOURCES);
  const containers = room.find(FIND_STRUCTURES, {
    filter: function (structure) {
      return structure.structureType === STRUCTURE_CONTAINER;
    },
  });
  const sites = room.find(FIND_CONSTRUCTION_SITES, {
    filter: function (site) {
      return site.structureType === STRUCTURE_CONTAINER;
    },
  });
  const bySourceId = {};

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    bySourceId[source.id] =
      _.find(containers, function (container) {
        return container.pos.getRangeTo(source) <= 1;
      }) ||
      _.find(sites, function (site) {
        return site.pos.getRangeTo(source) <= 1;
      }) ||
      null;
  }

  return bySourceId;
}

function hasStructureOrSiteAt(room, pos, structureType) {
  const structures = pos.lookFor(LOOK_STRUCTURES);
  for (let i = 0; i < structures.length; i++) {
    if (!structureType || structures[i].structureType === structureType) return true;
  }

  const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
  for (let j = 0; j < sites.length; j++) {
    if (!structureType || sites[j].structureType === structureType) return true;
  }

  return false;
}

function isRemoteBuildPosOpen(room, terrain, pos, structureType) {
  if (!pos || pos.x <= 0 || pos.y <= 0 || pos.x >= 49 || pos.y >= 49) {
    return false;
  }
  if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) return false;

  const structures = pos.lookFor(LOOK_STRUCTURES);
  for (let i = 0; i < structures.length; i++) {
    if (structures[i].structureType === structureType) return true;
    if (
      structureType === STRUCTURE_ROAD &&
      structures[i].structureType === STRUCTURE_CONTAINER
    ) {
      continue;
    }
    return false;
  }

  const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
  for (let j = 0; j < sites.length; j++) {
    if (sites[j].structureType === structureType) return true;
    return false;
  }

  const sources = room.find(FIND_SOURCES);
  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    if (pos.isEqualTo(sources[sourceIndex].pos)) return false;
  }

  const minerals = room.find(FIND_MINERALS);
  for (let mineralIndex = 0; mineralIndex < minerals.length; mineralIndex++) {
    if (pos.isEqualTo(minerals[mineralIndex].pos)) return false;
  }

  if (room.controller && pos.isEqualTo(room.controller.pos)) return false;

  return true;
}

function pickRemoteContainerPos(room, source, parentAnchor) {
  const terrain = room.getTerrain();
  let best = null;
  let bestScore = Infinity;

  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (dx === 0 && dy === 0) continue;

      const pos = new RoomPosition(source.pos.x + dx, source.pos.y + dy, room.name);
      if (!isRemoteBuildPosOpen(room, terrain, pos, STRUCTURE_CONTAINER)) {
        continue;
      }

      const score =
        (parentAnchor && parentAnchor.pos ? pos.getRangeTo(parentAnchor.pos) : 0) +
        pos.getRangeTo(source.pos) * 10;
      if (score < bestScore) {
        best = pos;
        bestScore = score;
      }
    }
  }

  return best;
}

function shouldPlaceRemoteRoad(room, pos) {
  if (!pos || pos.roomName !== room.name) return false;
  if (pos.x <= 0 || pos.y <= 0 || pos.x >= 49 || pos.y >= 49) return false;

  const terrain = room.getTerrain();
  if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) return false;
  if (hasStructureOrSiteAt(room, pos, STRUCTURE_ROAD)) return false;

  const structures = pos.lookFor(LOOK_STRUCTURES);
  for (let i = 0; i < structures.length; i++) {
    if (structures[i].structureType !== STRUCTURE_CONTAINER) return false;
  }

  const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
  if (sites.length > 0) return false;

  return true;
}

function serializePos(pos) {
  return pos
    ? {
        x: pos.x,
        y: pos.y,
        roomName: pos.roomName,
      }
    : null;
}

module.exports = {
  run(ownedRooms, roomStates) {
    if (!isEnabled()) return;

    const plans = getActivePlanList();
    const states = roomStates || {};

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      const parent = getOwnedRoom(plan.parentRoom);
      const parentState = parent ? states[parent.name] || null : null;

      this.updatePlanIntel(plan);
      if (!parent || !parentState || !isParentStable(parent, parentState)) {
        continue;
      }

      this.planRemoteConstruction(plan, parent);
    }
  },

  createReservation(targetRoomName, parentRoomName) {
    if (!isEnabled()) {
      return {
        ok: false,
        message: "Reserved room operations are disabled in config.",
      };
    }

    const targetRoom = normalizeRoomName(targetRoomName);
    if (!targetRoom) {
      return {
        ok: false,
        message: "Target room is required.",
      };
    }

    const parentRoom = normalizeRoomName(parentRoomName);
    const parent = getOwnedRoom(parentRoom);
    if (!parent) {
      return {
        ok: false,
        message: parentRoom
          ? `Parent room ${parentRoom} is not an owned visible room.`
          : "Parent room is required.",
      };
    }
    if (parent.find(FIND_MY_SPAWNS).length <= 0) {
      return {
        ok: false,
        message: `Parent room ${parentRoom} has no available spawn network.`,
      };
    }

    const maxDistance =
      typeof getSettings().MAX_DISTANCE === "number" ? getSettings().MAX_DISTANCE : 3;
    if (getRoomDistance(parentRoom, targetRoom) > maxDistance) {
      return {
        ok: false,
        message: `Target room ${targetRoom} is beyond reserved-room distance ${maxDistance}.`,
      };
    }

    const plans = getPlans();
    const existing = plans[targetRoom] || {};
    const plan = Object.assign({}, existing, {
      targetRoom: targetRoom,
      parentRoom: parentRoom,
      createdAt: existing.createdAt || Game.time,
      updatedAt: Game.time,
      cancelled: false,
      convertedToExpansion: false,
      operation: "reservation",
    });

    plans[targetRoom] = plan;
    this.updatePlanIntel(plan);

    return {
      ok: true,
      plan: plan,
      message: `Reserved room plan active: ${targetRoom} from ${parentRoom}.`,
    };
  },

  cancelReservation(targetRoomName) {
    const targetRoom = normalizeRoomName(targetRoomName);
    const plans = getPlans();

    if (!targetRoom || !plans[targetRoom]) {
      return {
        ok: false,
        message: "Reserved room plan not found.",
      };
    }

    plans[targetRoom].cancelled = true;
    plans[targetRoom].updatedAt = Game.time;
    const removed = pruneReservationQueue(targetRoom);

    return {
      ok: true,
      plan: plans[targetRoom],
      message:
        removed > 0
          ? `Reserved room plan cancelled: ${targetRoom}. Removed ${removed} queued spawn requests.`
          : `Reserved room plan cancelled: ${targetRoom}.`,
    };
  },

  convertReservationToExpansion(targetRoomName, nextParentRoom) {
    const targetRoom = normalizeRoomName(targetRoomName);
    if (!targetRoom) return null;

    const plan = getPlans()[targetRoom] || null;
    if (!plan || plan.cancelled || plan.convertedToExpansion) return null;

    plan.convertedToExpansion = true;
    plan.cancelled = true;
    plan.convertedAt = Game.time;
    plan.updatedAt = Game.time;
    if (nextParentRoom) plan.convertedParentRoom = nextParentRoom;

    return plan;
  },

  getActiveReservation(targetRoomName) {
    const targetRoom = normalizeRoomName(targetRoomName);
    if (!targetRoom) return null;

    const plan = getPlans()[targetRoom] || null;
    if (!plan || plan.cancelled || plan.convertedToExpansion) return null;

    return plan;
  },

  getReservationThreat(planOrTargetRoom) {
    const plan =
      typeof planOrTargetRoom === "string"
        ? this.getActiveReservation(planOrTargetRoom)
        : planOrTargetRoom;

    if (!plan || plan.cancelled || plan.convertedToExpansion) return null;

    const targetRoom = Game.rooms[plan.targetRoom] || null;
    if (targetRoom) {
      return getRemoteThreat(targetRoom);
    }

    return getStoredThreat(plan);
  },

  getReservationSpawnRequests(room, state) {
    if (!isEnabled()) return [];

    const requests = [];
    const plans = getActivePlanList();

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      const targetRoom = Game.rooms[plan.targetRoom] || null;
      if (targetRoom) {
        this.updatePlanIntel(plan);
      }
      if (
        plan.parentRoom === room.name &&
        isParentStable(room, state) &&
        typeof plan.startedAt !== "number"
      ) {
        plan.startedAt = Game.time;
      }

      const threat = this.getReservationThreat(plan);
      const started = hasStartedReservationOperation(plan, targetRoom);

      if (plan.parentRoom === room.name && started) {
        this.addReservationMaintenanceRequests(
          room,
          state,
          requests,
          plan,
          targetRoom,
          threat,
        );
      }

      if (threat) {
        if (started) {
          this.addRemoteDefenseRequest(room, state, requests, plan, threat);
        }
        continue;
      }

      if (plan.parentRoom !== room.name) continue;
      if (!isParentStable(room, state)) continue;

      this.addRemoteEconomyRequests(room, state, requests, plan, targetRoom);
    }

    return requests;
  },

  addReservationMaintenanceRequests(room, state, requests, plan, targetRoom, threat) {
    if (plan.parentRoom !== room.name) return;
    if (!isParentOperational(room, state)) return;

    const reserveTicks = targetRoom && targetRoom.controller && targetRoom.controller.reservation
      ? targetRoom.controller.reservation.ticksToEnd || 0
      : plan.intel && typeof plan.intel.reservationTicks === "number"
        ? plan.intel.reservationTicks
        : 0;
    const reserveRefresh =
      typeof getSettings().RESERVATION_REFRESH_TICKS === "number"
        ? getSettings().RESERVATION_REFRESH_TICKS
        : 2500;
    const reserverCount =
      countCreeps("reserver", plan.targetRoom, room.name) +
      countQueued("reserver", plan.targetRoom, room.name);
    const needsVisibility = shouldRefreshVisibility(plan, targetRoom);
    const needsMaintenance = reserveTicks < reserveRefresh;

    if (reserverCount <= 0 && (needsVisibility || needsMaintenance || !!threat)) {
      requests.push({
        role: "reserver",
        priority: getSettings().RESERVER_PRIORITY || 96,
        homeRoom: room.name,
        targetRoom: plan.targetRoom,
        operation: "reservation",
      });
    }
  },

  addRemoteDefenseRequest(room, state, requests, plan, threat) {
    if (!this.shouldRoomDefendRemote(room, state, plan, threat)) return;

    const desired = Math.max(1, threat.desiredDefenders || 1);
    const assigned = countDefenseCoverage(plan.targetRoom);
    if (assigned >= desired) return;

    requests.push({
      role: "defender",
      priority: getSettings().DEFENSE_PRIORITY || 1050,
      threatLevel: threat.threatLevel || 1,
      threatScore: threat.threatScore || 0,
      responseMode: "creep_only",
      targetRoom: plan.targetRoom,
      operation:
        room.name === plan.parentRoom
          ? "reservation_defense"
          : "reservation_defense_support",
      defenseType: "reserved_room_threat",
      homeRoom: room.name,
    });
  },

  shouldRoomDefendRemote(room, state, plan, threat) {
    if (!room || !room.controller || !room.controller.my) return false;
    if (!state || !state.spawns || state.spawns.length <= 0) return false;
    if (state.defense && state.defense.hasThreats) return false;
    if (room.energyCapacityAvailable < 650) return false;

    if (room.name === plan.parentRoom) return true;

    const settings = getSettings();
    const supportEnabled = settings.DEFENSE_SUPPORT_ENABLED !== false;
    if (!supportEnabled) return false;
    if (this.isParentDefenseAvailable(plan.parentRoom)) return false;
    if (getRoomDistance(room.name, plan.targetRoom) > (settings.DEFENSE_SUPPORT_DISTANCE || 2)) {
      return false;
    }

    return this.getBestDefenseHelper(plan, threat) === room.name;
  },

  isParentDefenseAvailable(parentRoomName) {
    const parent = getOwnedRoom(parentRoomName);
    if (!parent) return false;
    if (parent.find(FIND_MY_SPAWNS).length <= 0) return false;
    if (parent.energyCapacityAvailable < 650) return false;

    const cache = utils.getRoomRuntimeCache(parent);
    const state = cache && cache.state ? cache.state : null;
    if (state && state.defense && state.defense.hasThreats) return false;

    return true;
  },

  getBestDefenseHelper(plan) {
    let bestRoomName = null;
    let bestScore = Infinity;

    for (const roomName in Game.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Game.rooms, roomName)) continue;
      if (roomName === plan.parentRoom) continue;

      const room = getOwnedRoom(roomName);
      if (!room) continue;
      if (room.find(FIND_MY_SPAWNS).length <= 0) continue;
      if (room.energyCapacityAvailable < 650) continue;

      const distance = getRoomDistance(room.name, plan.targetRoom);
      if (distance > (getSettings().DEFENSE_SUPPORT_DISTANCE || 2)) continue;
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

  addRemoteEconomyRequests(room, state, requests, plan, targetRoom) {
    const settings = getSettings();
    const reserveTicks = targetRoom && targetRoom.controller && targetRoom.controller.reservation
      ? targetRoom.controller.reservation.ticksToEnd || 0
      : 0;
    const reserveRefresh =
      typeof settings.RESERVATION_REFRESH_TICKS === "number"
        ? settings.RESERVATION_REFRESH_TICKS
        : 2500;

    const reserverCount =
      countCreeps("reserver", plan.targetRoom, room.name) +
      countQueued("reserver", plan.targetRoom, room.name);
    if (reserverCount <= 0 && (!targetRoom || reserveTicks < reserveRefresh)) {
      requests.push({
        role: "reserver",
        priority: settings.RESERVER_PRIORITY || 96,
        homeRoom: room.name,
        targetRoom: plan.targetRoom,
        operation: "reservation",
      });
    }

    if (!targetRoom) return;

    const bySourceId = getRemoteContainersBySource(targetRoom);
    const sources = targetRoom.find(FIND_SOURCES);
    const constructionSites = targetRoom.find(FIND_CONSTRUCTION_SITES);
    const needsWorker =
      constructionSites.length > 0 || this.needsRemoteRepair(targetRoom) ||
      this.countRemoteSourceContainers(bySourceId) < sources.length;

    const workerCount =
      countCreeps("remoteworker", plan.targetRoom, room.name) +
      countQueued("remoteworker", plan.targetRoom, room.name);
    if (needsWorker && workerCount <= 0) {
      requests.push({
        role: "remoteworker",
        priority: settings.REMOTE_WORKER_PRIORITY || 74,
        homeRoom: room.name,
        targetRoom: plan.targetRoom,
        operation: "reservation",
      });
    }

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const container = bySourceId[source.id];
      if (!container || container.structureType !== STRUCTURE_CONTAINER) continue;

      const miners =
        countCreeps("remoteminer", plan.targetRoom, room.name, source.id) +
        countQueued("remoteminer", plan.targetRoom, room.name, source.id);
      if (miners <= 0) {
        requests.push({
          role: "remoteminer",
          priority: settings.REMOTE_MINER_PRIORITY || 73,
          homeRoom: room.name,
          targetRoom: plan.targetRoom,
          sourceId: source.id,
          targetId: container.id,
          operation: "reservation",
        });
      }

      const haulers =
        countCreeps("remotehauler", plan.targetRoom, room.name, source.id) +
        countQueued("remotehauler", plan.targetRoom, room.name, source.id);
      const desiredHaulers = this.getDesiredRemoteHaulers(room, targetRoom, source, container);
      for (let h = haulers; h < desiredHaulers; h++) {
        requests.push({
          role: "remotehauler",
          priority: settings.REMOTE_HAULER_PRIORITY || 72,
          homeRoom: room.name,
          targetRoom: plan.targetRoom,
          sourceId: source.id,
          targetId: container.id,
          operation: "reservation",
        });
      }
    }
  },

  countRemoteSourceContainers(bySourceId) {
    let count = 0;
    for (const sourceId in bySourceId) {
      if (!Object.prototype.hasOwnProperty.call(bySourceId, sourceId)) continue;
      if (bySourceId[sourceId] && bySourceId[sourceId].structureType === STRUCTURE_CONTAINER) {
        count++;
      }
    }
    return count;
  },

  getDesiredRemoteHaulers(parentRoom, targetRoom, source, container) {
    if (!parentRoom || !targetRoom || !source || !container) return 1;

    const settings = getSettings();
    const incomePerTick =
      typeof settings.SOURCE_INCOME_PER_TICK === "number"
        ? settings.SOURCE_INCOME_PER_TICK
        : 10;
    const carryPerHauler =
      typeof settings.REMOTE_HAULER_CARRY_PARTS === "number"
        ? settings.REMOTE_HAULER_CARRY_PARTS
        : 8;
    const delivery = getParentDeliveryTarget(parentRoom);
    const range = delivery && delivery.pos
      ? container.pos.getRangeTo(delivery.pos) * 2 + 10
      : getRoomDistance(parentRoom.name, targetRoom.name) * 50 + 20;

    return Math.max(1, Math.ceil((incomePerTick * range) / (carryPerHauler * 50)));
  },

  needsRemoteRepair(room) {
    const structures = room.find(FIND_STRUCTURES, {
      filter: function (structure) {
        return (
          (
            structure.structureType === STRUCTURE_CONTAINER ||
            structure.structureType === STRUCTURE_ROAD
          ) &&
          structure.hits < structure.hitsMax * 0.6
        );
      },
    });

    return structures.length > 0;
  },

  updatePlanIntel(plan) {
    if (!plan || !plan.targetRoom) return;

    const room = Game.rooms[plan.targetRoom] || null;
    if (!plan.intel) plan.intel = {};
    if (!room) return;

    const sources = room.find(FIND_SOURCES);
    const bySourceId = getRemoteContainersBySource(room);
    const sourceIntel = [];

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const container = bySourceId[source.id] || null;
      sourceIntel.push({
        id: source.id,
        pos: serializePos(source.pos),
        containerId:
          container && container.structureType === STRUCTURE_CONTAINER
            ? container.id
            : null,
        containerPos: container ? serializePos(container.pos) : null,
      });
    }

    const threat = getRemoteThreat(room);
    plan.intel = {
      visibleAt: Game.time,
      sourceCount: sources.length,
      sources: sourceIntel,
      reservationTicks:
        room.controller && room.controller.reservation
          ? room.controller.reservation.ticksToEnd || 0
          : 0,
      hostileCount: threat ? threat.hostileCount || 0 : 0,
      threatSeenAt: threat ? Game.time : null,
      threatScore: threat ? threat.threatScore || 0 : 0,
      threatLevel: threat ? threat.threatLevel || 0 : 0,
      desiredDefenders: threat ? threat.desiredDefenders || 1 : 0,
      hostileCombatPower: threat ? threat.hostileCombatPower || 0 : 0,
      hostileHealingPower: threat ? threat.hostileHealingPower || 0 : 0,
      threatLabel: threat ? threat.towerTargetSummary || threat.classification || "visible remote threat" : null,
      constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
    };
    plan.updatedAt = Game.time;
  },

  planRemoteConstruction(plan, parentRoom) {
    const targetRoom = Game.rooms[plan.targetRoom] || null;
    if (!targetRoom || hasRemoteThreat(targetRoom)) return;

    const settings = getSettings();
    const interval =
      typeof settings.REMOTE_PLAN_INTERVAL === "number"
        ? settings.REMOTE_PLAN_INTERVAL
        : 100;
    if (plan.lastRemotePlan && Game.time - plan.lastRemotePlan < interval) {
      return;
    }
    plan.lastRemotePlan = Game.time;

    const maxSites =
      typeof settings.MAX_REMOTE_SITES_PER_ROOM === "number"
        ? settings.MAX_REMOTE_SITES_PER_ROOM
        : 5;
    let placed = 0;
    const siteCount = targetRoom.find(FIND_CONSTRUCTION_SITES).length;
    if (siteCount >= maxSites) return;

    placed += this.placeRemoteSourceContainers(
      targetRoom,
      parentRoom,
      maxSites - siteCount - placed,
    );
    if (placed >= maxSites - siteCount) return;

    this.placeRemoteRoads(targetRoom, parentRoom, maxSites - siteCount - placed);
  },

  placeRemoteSourceContainers(targetRoom, parentRoom, budget) {
    if (budget <= 0) return 0;

    const parentAnchor = getParentDeliveryTarget(parentRoom);
    const sources = targetRoom.find(FIND_SOURCES);
    const bySourceId = getRemoteContainersBySource(targetRoom);
    let placed = 0;

    for (let i = 0; i < sources.length && placed < budget; i++) {
      const source = sources[i];
      if (bySourceId[source.id]) continue;

      const pos = pickRemoteContainerPos(targetRoom, source, parentAnchor);
      if (!pos) continue;

      if (targetRoom.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER) === OK) {
        placed++;
      }
    }

    return placed;
  },

  placeRemoteRoads(targetRoom, parentRoom, budget) {
    if (budget <= 0) return 0;

    const parentAnchor = getParentDeliveryTarget(parentRoom);
    if (!parentAnchor || !parentAnchor.pos) return 0;

    const bySourceId = getRemoteContainersBySource(targetRoom);
    const goals = [];

    for (const sourceId in bySourceId) {
      if (!Object.prototype.hasOwnProperty.call(bySourceId, sourceId)) continue;
      const container = bySourceId[sourceId];
      if (!container || !container.pos) continue;
      goals.push(container.pos);
    }

    const planned = {};
    for (let i = 0; i < goals.length; i++) {
      const result = PathFinder.search(
        parentAnchor.pos,
        { pos: goals[i], range: 1 },
        {
          maxRooms: Math.max(2, getSettings().MAX_DISTANCE || 3),
          plainCost: 2,
          swampCost: 10,
        },
      );

      const path = result && result.path ? result.path : [];
      for (let j = 0; j < path.length; j++) {
        const pos = path[j];
        if (!pos) continue;
        const roomName = pos.roomName || (
          parentAnchor.pos.roomName === targetRoom.name ? targetRoom.name : null
        );
        if (roomName !== targetRoom.name) continue;
        const roadPos = pos.roomName
          ? pos
          : new RoomPosition(pos.x, pos.y, targetRoom.name);
        planned[`${roadPos.roomName}:${roadPos.x}:${roadPos.y}`] = roadPos;
      }
    }

    const keys = Object.keys(planned).sort();
    let placed = 0;
    for (let k = 0; k < keys.length && placed < budget; k++) {
      const pos = planned[keys[k]];
      if (!shouldPlaceRemoteRoad(targetRoom, pos)) continue;

      if (targetRoom.createConstructionSite(pos.x, pos.y, STRUCTURE_ROAD) === OK) {
        placed++;
      }
    }

    return placed;
  },

  isRoomThreatened(roomName) {
    return !!this.getReservationThreat(roomName);
  },

  getReservationSummary() {
    const plans = getActivePlanList();
    const summary = {
      active: plans.length,
      reserved: 0,
      scouting: 0,
      threatened: 0,
      blocked: 0,
    };

    for (let i = 0; i < plans.length; i++) {
      const status = getPlanStatus(plans[i]);
      if (status === "reserved" || status === "visible") summary.reserved++;
      else if (status === "scouting") summary.scouting++;
      else if (status === "threatened") summary.threatened++;
      else if (status.indexOf("blocked") === 0) summary.blocked++;
    }

    return summary;
  },

  getReservedLines(parentRoomName) {
    const parentFilter = normalizeRoomName(parentRoomName);
    const plans = getActivePlanList();
    const lines = ["[OPS][RESERVED]"];
    const grouped = {};

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      if (parentFilter && plan.parentRoom !== parentFilter) continue;
      if (!grouped[plan.parentRoom || "none"]) grouped[plan.parentRoom || "none"] = [];
      grouped[plan.parentRoom || "none"].push(plan);
    }

    const parents = Object.keys(grouped).sort();
    if (parents.length === 0) {
      lines.push(
        parentFilter
          ? `No reserved rooms for parent ${parentFilter}.`
          : "No active reserved room plans.",
      );
      return lines;
    }

    for (let i = 0; i < parents.length; i++) {
      const parent = parents[i];
      lines.push(`Parent ${parent}`);
      const parentPlans = grouped[parent];

      for (let j = 0; j < parentPlans.length; j++) {
        const plan = parentPlans[j];
        lines.push(
          `- ${plan.targetRoom} | ${getStatusLabel(plan)} | reserve ${getReservationTicks(plan)} | age ${
            Game.time - (plan.createdAt || Game.time)
          }`,
        );
      }
    }

    return lines;
  },
};
