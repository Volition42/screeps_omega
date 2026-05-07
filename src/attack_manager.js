/*
Developer Summary:
Manual offensive operation manager.

Purpose:
- Keep player-initiated room attacks in one memory-backed operation layer
- Coordinate parent and support-room spawn demand
- Expose attack status for ops, empire reports, and HUD visuals
- Apply a temporary hard-war economy override while an attack is active
*/

const config = require("config");
const reservationManager = require("reservation_manager");

const POST_EXPAND = "expand";
const POST_RESERVE = "reserve";
const POST_NONE = "none";
const POST_ACTIONS = [POST_EXPAND, POST_RESERVE, POST_NONE];

const STATUS_SCOUTING = "scouting";
const STATUS_SAFE_MODE_WAIT = "safe_mode_wait";
const STATUS_BREACHING = "breaching";
const STATUS_CONTROLLER_ATTACK = "controller_attack";
const STATUS_POST_ACTION = "post_action";
const STATUS_COMPLETE = "complete";
const STATUS_BLOCKED = "blocked";

const ATTACK_ROLES = {
  dismantler: true,
  assault: true,
  combat_healer: true,
  controller_attacker: true,
};

function ensureEmpireMemory() {
  if (!Memory.empire) Memory.empire = {};
  if (!Memory.empire.attack) Memory.empire.attack = {};
  if (!Memory.empire.attack.plans) Memory.empire.attack.plans = {};

  return Memory.empire;
}

function getAttackMemory() {
  return ensureEmpireMemory().attack;
}

function getPlans() {
  return getAttackMemory().plans;
}

function normalizeRoomName(roomName) {
  if (!roomName) return null;

  const normalized = String(roomName).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizePostAction(value) {
  if (typeof value === "undefined" || value === null || value === "") {
    return POST_EXPAND;
  }

  const normalized = String(value).trim().toLowerCase();
  return POST_ACTIONS.indexOf(normalized) !== -1 ? normalized : null;
}

function getSettings() {
  return config.ATTACK || {};
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
  if (room.find(FIND_MY_SPAWNS).length <= 0) return null;
  return room;
}

function collectOwnedRooms() {
  const rooms = [];

  for (const roomName in Game.rooms) {
    if (!Object.prototype.hasOwnProperty.call(Game.rooms, roomName)) continue;
    const room = getOwnedRoom(roomName);
    if (room) rooms.push(room);
  }

  rooms.sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });

  return rooms;
}

function getMaxSupportDistance() {
  const settings = getSettings();
  return typeof settings.SUPPORT_DISTANCE === "number"
    ? settings.SUPPORT_DISTANCE
    : 2;
}

function getEligibleParentRooms(targetRoom) {
  const minRcl =
    typeof getSettings().MIN_PARENT_RCL === "number"
      ? getSettings().MIN_PARENT_RCL
      : 4;

  return collectOwnedRooms().filter(function (room) {
    return room.controller && room.controller.level >= minRcl &&
      getRoomDistance(room.name, targetRoom) <= getMaxSupportDistance() + 1;
  });
}

function chooseParentRoom(targetRoom) {
  const candidates = getEligibleParentRooms(targetRoom);
  let best = null;
  let bestScore = -Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const room = candidates[i];
    let score = room.controller.level * 100 + room.energyCapacityAvailable;
    if (room.storage) score += 200;
    score -= getRoomDistance(room.name, targetRoom) * 50;

    if (score > bestScore) {
      best = room;
      bestScore = score;
    }
  }

  return best;
}

function normalizeAllies(allies) {
  if (!allies) return null;
  const values = Array.isArray(allies) ? allies : [allies];
  const result = [];
  const seen = {};

  for (let i = 0; i < values.length; i++) {
    const roomName = normalizeRoomName(values[i]);
    if (!roomName || seen[roomName]) continue;
    seen[roomName] = true;
    result.push(roomName);
  }

  return result;
}

function getParticipantRooms(plan) {
  const rooms = [];
  const seen = {};

  if (plan && plan.parentRoom) {
    rooms.push(plan.parentRoom);
    seen[plan.parentRoom] = true;
  }

  const allies = plan && plan.allies ? plan.allies : [];
  for (let i = 0; i < allies.length; i++) {
    if (!allies[i] || seen[allies[i]]) continue;
    seen[allies[i]] = true;
    rooms.push(allies[i]);
  }

  return rooms;
}

function chooseAllies(targetRoom, parentRoom) {
  const rooms = collectOwnedRooms();
  const maxDistance = getMaxSupportDistance();
  const allies = [];

  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    if (room.name === parentRoom) continue;
    if (getRoomDistance(room.name, targetRoom) > maxDistance) continue;
    allies.push(room.name);
  }

  return allies;
}

function countAttackCreeps(role, targetRoom, homeRoom) {
  let count = 0;

  for (const creepName in Game.creeps) {
    if (!Object.prototype.hasOwnProperty.call(Game.creeps, creepName)) continue;
    const creep = Game.creeps[creepName];
    if (!creep || !creep.memory) continue;
    if (creep.memory.operation !== "attack") continue;
    if (role && creep.memory.role !== role) continue;
    if (targetRoom && creep.memory.targetRoom !== targetRoom) continue;
    if (homeRoom && (creep.memory.homeRoom || creep.memory.room) !== homeRoom) continue;
    if (
      creep.ticksToLive !== undefined &&
      creep.ticksToLive <= getReplaceTtl(creep.memory.role)
    ) {
      continue;
    }
    count++;
  }

  return count;
}

function countQueuedAttack(role, targetRoom, homeRoom) {
  let count = 0;

  if (!Memory.rooms) return count;

  for (const roomName in Memory.rooms) {
    if (!Object.prototype.hasOwnProperty.call(Memory.rooms, roomName)) continue;
    if (homeRoom && roomName !== homeRoom) continue;

    const queue = Memory.rooms[roomName] ? Memory.rooms[roomName].spawnQueue : null;
    if (!queue) continue;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      if (!item || item.operation !== "attack") continue;
      if (role && item.role !== role) continue;
      if (targetRoom && item.targetRoom !== targetRoom) continue;
      count++;
    }
  }

  return count;
}

function getReplaceTtl(role) {
  const settings = getSettings();
  if (role === "controller_attacker") {
    return typeof settings.CONTROLLER_ATTACKER_REPLACE_TTL === "number"
      ? settings.CONTROLLER_ATTACKER_REPLACE_TTL
      : 180;
  }

  return typeof settings.ATTACKER_REPLACE_TTL === "number"
    ? settings.ATTACKER_REPLACE_TTL
    : 120;
}

function getGclRoomSlotsAvailable() {
  const gcl = Game.gcl || null;
  if (!gcl || typeof gcl.level !== "number") return null;

  let owned = 0;
  for (const roomName in Game.rooms) {
    if (!Object.prototype.hasOwnProperty.call(Game.rooms, roomName)) continue;
    const room = Game.rooms[roomName];
    if (room && room.controller && room.controller.my) owned++;
  }

  return Math.max(0, gcl.level - owned);
}

function formatCompactNumber(value) {
  const amount = typeof value === "number" ? value : parseInt(value || 0, 10) || 0;
  if (Math.abs(amount) >= 1000000) return (amount / 1000000).toFixed(1) + "m";
  if (Math.abs(amount) >= 1000) return (amount / 1000).toFixed(1) + "k";
  return String(amount);
}

module.exports = {
  POST_EXPAND,
  POST_RESERVE,
  POST_NONE,
  POST_ACTIONS,
  ATTACK_ROLES,

  normalizePostAction,

  createAttack(targetRoomName, options) {
    if (getSettings().ENABLED === false) {
      return {
        ok: false,
        message: "Attack operations are disabled in config.",
      };
    }

    const targetRoom = normalizeRoomName(targetRoomName);
    if (!targetRoom) {
      return {
        ok: false,
        message: "Target room is required.",
      };
    }

    const opts = options || {};
    const postAction = normalizePostAction(opts.postAction);
    if (!postAction) {
      return {
        ok: false,
        message: `Attack postAction must be one of: ${POST_ACTIONS.join(", ")}.`,
      };
    }

    let parentRoom = normalizeRoomName(opts.parentRoom);
    if (parentRoom) {
      if (!getOwnedRoom(parentRoom)) {
        return {
          ok: false,
          message: `Parent room ${parentRoom} is not an owned visible room with a spawn.`,
        };
      }
    } else {
      const selected = chooseParentRoom(targetRoom);
      if (!selected) {
        return {
          ok: false,
          message: "No eligible owned room with a spawn is available as an attack parent.",
        };
      }
      parentRoom = selected.name;
    }

    let allies = normalizeAllies(opts.allies);
    if (allies) {
      for (let i = 0; i < allies.length; i++) {
        if (allies[i] === parentRoom) continue;
        if (!getOwnedRoom(allies[i])) {
          return {
            ok: false,
            message: `Ally room ${allies[i]} is not an owned visible room with a spawn.`,
          };
        }
      }
      allies = allies.filter(function (roomName) {
        return roomName !== parentRoom;
      });
    } else {
      allies = chooseAllies(targetRoom, parentRoom);
    }

    const plans = getPlans();
    const existing = plans[targetRoom] || {};
    const plan = Object.assign({}, existing, {
      targetRoom: targetRoom,
      parentRoom: parentRoom,
      allies: allies,
      postAction: postAction,
      status: existing.status && existing.status !== STATUS_COMPLETE
        ? existing.status
        : STATUS_SCOUTING,
      createdAt: existing.createdAt || Game.time,
      updatedAt: Game.time,
      cancelled: false,
      completed: false,
      attackModeActive: !!existing.attackModeActive,
      attackModeStartedAt: existing.attackModeStartedAt || null,
      operation: "attack",
    });

    plans[targetRoom] = plan;
    this.updatePlanIntel(plan);
    this.updatePlanStatus(plan);

    return {
      ok: true,
      plan: plan,
      message:
        `Attack plan active: ${targetRoom} from ${parentRoom} ` +
        `(${postAction}, allies ${allies.length > 0 ? allies.join(",") : "auto:none"}).`,
    };
  },

  cancelAttack(targetRoomName) {
    const targetRoom = normalizeRoomName(targetRoomName);
    const plans = getPlans();
    const plan = targetRoom ? plans[targetRoom] : null;

    if (!targetRoom || !plan || plan.cancelled || plan.completed) {
      return {
        ok: false,
        message: targetRoom
          ? `No active attack plan for ${targetRoom}.`
          : "Target room is required.",
      };
    }

    plan.cancelled = true;
    plan.status = STATUS_COMPLETE;
    plan.completed = true;
    plan.completedAt = Game.time;
    plan.updatedAt = Game.time;
    plan.attackModeActive = false;
    plan.attackModeEndedAt = Game.time;

    return {
      ok: true,
      plan: plan,
      message: `Attack plan cancelled: ${targetRoom}.`,
    };
  },

  getActiveAttack(targetRoomName) {
    const targetRoom = normalizeRoomName(targetRoomName);
    if (!targetRoom) return null;

    const plan = getPlans()[targetRoom] || null;
    if (!plan || plan.cancelled || plan.completed) return null;
    this.ensurePlanDefaults(plan, targetRoom);
    return plan;
  },

  getActivePlans() {
    const plans = getPlans();
    const result = [];

    for (const targetRoom in plans) {
      if (!Object.prototype.hasOwnProperty.call(plans, targetRoom)) continue;
      const plan = this.getActiveAttack(targetRoom);
      if (plan) result.push(plan);
    }

    result.sort(function (a, b) {
      return a.targetRoom.localeCompare(b.targetRoom);
    });

    return result;
  },

  ensurePlanDefaults(plan, targetRoom) {
    if (!plan) return null;
    plan.targetRoom = plan.targetRoom || targetRoom;
    plan.parentRoom = normalizeRoomName(plan.parentRoom);
    plan.allies = normalizeAllies(plan.allies) || [];
    plan.postAction = normalizePostAction(plan.postAction) || POST_EXPAND;
    plan.status = plan.status || STATUS_SCOUTING;
    plan.operation = "attack";
    if (typeof plan.attackModeActive !== "boolean") plan.attackModeActive = false;
    return plan;
  },

  run() {
    const plans = this.getActivePlans();
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      this.updatePlanIntel(plan);
      this.updatePlanStatus(plan);
      this.performPostActionIfReady(plan);
    }
  },

  updatePlanIntel(plan) {
    if (!plan || !plan.targetRoom) return null;

    const room = Game.rooms[plan.targetRoom] || null;
    const intel = plan.intel || {};
    if (intel.updatedAt === Game.time) {
      return intel;
    }
    intel.updatedAt = Game.time;
    intel.visible = !!room;

    if (!room) {
      plan.intel = intel;
      return intel;
    }

    const controller = room.controller || null;
    const structures = room.find(FIND_STRUCTURES);
    const hostileStructures = room.find(FIND_HOSTILE_STRUCTURES);
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    const towers = structures.filter(function (structure) {
      return structure.structureType === STRUCTURE_TOWER && !structure.my;
    });
    const spawns = structures.filter(function (structure) {
      return structure.structureType === STRUCTURE_SPAWN && !structure.my;
    });
    const ramparts = structures.filter(function (structure) {
      return structure.structureType === STRUCTURE_RAMPART && !structure.my;
    });
    const walls = structures.filter(function (structure) {
      return structure.structureType === STRUCTURE_WALL;
    });

    intel.visibleAt = Game.time;
    intel.owner = controller && controller.owner ? controller.owner.username || "unknown" : null;
    intel.my = !!(controller && controller.my);
    intel.reservation = controller && controller.reservation
      ? controller.reservation.username || "reserved"
      : null;
    intel.controllerLevel = controller ? controller.level || 0 : 0;
    intel.safeMode = controller ? controller.safeMode || 0 : 0;
    intel.ticksToDowngrade = controller &&
      typeof controller.ticksToDowngrade === "number"
        ? controller.ticksToDowngrade
        : null;
    intel.towers = towers.length;
    intel.spawns = spawns.length;
    intel.ramparts = ramparts.length;
    intel.walls = walls.length;
    intel.hostileCreeps = hostileCreeps.length;
    intel.hostileStructures = hostileStructures.length;
    intel.minRampartHits = this.getMinHits(ramparts);
    intel.minWallHits = this.getMinHits(walls);
    intel.neutral = !!(controller && !controller.owner && !controller.reservation);

    plan.intel = intel;
    return intel;
  },

  getMinHits(structures) {
    if (!structures || structures.length <= 0) return null;
    let minHits = structures[0].hits || 0;
    for (let i = 1; i < structures.length; i++) {
      minHits = Math.min(minHits, structures[i].hits || 0);
    }
    return minHits;
  },

  updatePlanStatus(plan) {
    if (!plan || plan.cancelled || plan.completed) return STATUS_COMPLETE;

    const intel = plan.intel || this.updatePlanIntel(plan);
    let status = STATUS_SCOUTING;

    if (!intel || !intel.visible) {
      status = plan.attackModeActive ? STATUS_BREACHING : STATUS_SCOUTING;
    } else if (intel.my) {
      status = STATUS_COMPLETE;
    } else if (intel.neutral) {
      status = STATUS_POST_ACTION;
    } else if (intel.safeMode && intel.safeMode > 0) {
      status = STATUS_SAFE_MODE_WAIT;
    } else if ((intel.towers || 0) > 0 || (intel.spawns || 0) > 0 || (intel.ramparts || 0) > 0) {
      status = STATUS_BREACHING;
    } else {
      status = STATUS_CONTROLLER_ATTACK;
    }

    plan.status = status;
    plan.updatedAt = Game.time;
    return status;
  },

  performPostActionIfReady(plan) {
    if (!plan || plan.cancelled || plan.completed) return null;
    if (plan.status !== STATUS_POST_ACTION && plan.status !== STATUS_COMPLETE) return null;

    const room = Game.rooms[plan.targetRoom] || null;
    if (room && room.controller && room.controller.my) {
      plan.completed = true;
      plan.status = STATUS_COMPLETE;
      plan.completedAt = Game.time;
      plan.attackModeActive = false;
      return { ok: true, action: "already_owned" };
    }

    if (plan.status !== STATUS_POST_ACTION) return null;

    if (plan.postAction === POST_NONE) {
      plan.completed = true;
      plan.status = STATUS_COMPLETE;
      plan.completedAt = Game.time;
      plan.attackModeActive = false;
      return { ok: true, action: POST_NONE };
    }

    if (plan.postAction === POST_RESERVE) {
      return this.createPostNeutralReservation(plan);
    }

    if (plan.postAction === POST_EXPAND) {
      const slotsAvailable = getGclRoomSlotsAvailable();
      if (slotsAvailable === null || slotsAvailable > 0) {
        const empireManager = require("empire_manager");
        const result = empireManager.createExpansion(
          plan.targetRoom,
          plan.parentRoom,
        );
        if (result && result.ok) {
          plan.completed = true;
          plan.status = STATUS_COMPLETE;
          plan.completedAt = Game.time;
          plan.attackModeActive = false;
        } else if (slotsAvailable === 0) {
          return this.createPostNeutralReservation(plan);
        } else {
          plan.status = STATUS_BLOCKED;
          plan.blockedReason = result ? result.message : "Expansion creation failed.";
        }
        return result;
      }

      return this.createPostNeutralReservation(plan);
    }

    return null;
  },

  createPostNeutralReservation(plan) {
    const result = reservationManager.createReservation(
      plan.targetRoom,
      plan.parentRoom,
    );
    if (result && result.ok) {
      plan.completed = true;
      plan.status = STATUS_COMPLETE;
      plan.completedAt = Game.time;
      plan.attackModeActive = false;
    } else {
      plan.status = STATUS_BLOCKED;
      plan.blockedReason = result ? result.message : "Reservation creation failed.";
    }
    return result;
  },

  getAttackSpawnRequests(room, state) {
    const requests = [];
    if (!room || !room.controller || !room.controller.my) return requests;

    const plans = this.getActivePlans();
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      if (!this.isParticipantRoom(plan, room.name)) continue;
      if (state && state.defense && state.defense.hasThreats) continue;

      this.updatePlanIntel(plan);
      const status = this.updatePlanStatus(plan);
      if (
        status === STATUS_SAFE_MODE_WAIT ||
        status === STATUS_POST_ACTION ||
        status === STATUS_COMPLETE ||
        status === STATUS_BLOCKED
      ) {
        continue;
      }

      this.activateAttackMode(plan);
      this.addRoomAttackRequests(room, plan, requests, status);
    }

    return requests;
  },

  activateAttackMode(plan) {
    if (!plan.attackModeActive) {
      plan.attackModeActive = true;
      plan.attackModeStartedAt = Game.time;
    }
  },

  isParticipantRoom(plan, roomName) {
    return getParticipantRooms(plan).indexOf(roomName) !== -1;
  },

  isRoomInAttackMode(roomName) {
    const plans = this.getActivePlans();
    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      if (!plan.attackModeActive) continue;
      if (this.isParticipantRoom(plan, roomName)) return true;
    }
    return false;
  },

  addRoomAttackRequests(room, plan, requests, status) {
    const isParent = room.name === plan.parentRoom;
    const basePriority =
      typeof getSettings().ATTACK_PRIORITY === "number"
        ? getSettings().ATTACK_PRIORITY
        : 980;

    const addIfNeeded = (role, desired, priorityOffset) => {
      const existing =
        countAttackCreeps(role, plan.targetRoom, room.name) +
        countQueuedAttack(role, plan.targetRoom, room.name) +
        requests.filter(function (request) {
          return request.role === role &&
            request.targetRoom === plan.targetRoom &&
            request.homeRoom === room.name;
        }).length;

      for (let index = existing; index < desired; index++) {
        requests.push({
          role: role,
          priority: basePriority + (priorityOffset || 0),
          homeRoom: room.name,
          targetRoom: plan.targetRoom,
          operation: "attack",
          attackStatus: status,
        });
      }
    };

    if (status === STATUS_SCOUTING) {
      addIfNeeded("assault", 1, 0);
      return;
    }

    if (status === STATUS_BREACHING) {
      addIfNeeded("dismantler", 1, 20);
      addIfNeeded("combat_healer", room.energyCapacityAvailable >= 300 ? 1 : 0, 35);
      addIfNeeded("assault", 1, 0);
      return;
    }

    if (status === STATUS_CONTROLLER_ATTACK) {
      addIfNeeded("combat_healer", room.energyCapacityAvailable >= 300 ? 1 : 0, 35);
      if (isParent) {
        addIfNeeded("controller_attacker", 1, 30);
      } else {
        addIfNeeded("dismantler", 1, 15);
        addIfNeeded("assault", 1, 0);
      }
    }
  },

  isAttackRole(role) {
    return !!ATTACK_ROLES[role];
  },

  getAttacksLines() {
    const plans = this.getActivePlans();
    const lines = ["[OPS][ATTACKS]"];

    if (plans.length <= 0) {
      lines.push("No active attack plans.");
      return lines;
    }

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      this.updatePlanIntel(plan);
      this.updatePlanStatus(plan);
      const intel = plan.intel || {};
      lines.push(
        `${plan.targetRoom} | ${plan.status} | post ${plan.postAction} | parent ${plan.parentRoom} | allies ${plan.allies.length}`,
      );
      lines.push(
        `  owner ${intel.owner || intel.reservation || "neutral/unknown"} | RCL ${intel.controllerLevel || 0} | safe ${intel.safeMode || 0} | towers ${intel.towers || 0} | spawns ${intel.spawns || 0}`,
      );
    }

    return lines;
  },

  getEmpireChildRows() {
    const plans = this.getActivePlans();
    const rows = [];

    for (let i = 0; i < plans.length; i++) {
      const plan = plans[i];
      rows.push({
        kind: "attack",
        targetRoom: plan.targetRoom,
        parentRoom: plan.parentRoom || null,
        phaseLabel: plan.postAction || POST_EXPAND,
        status: plan.attackModeActive ? "attack" : "plan",
        nextGoal: this.getNextGoalLabel(plan),
      });
    }

    return rows;
  },

  getNextGoalLabel(plan) {
    if (!plan) return "unknown";
    if (plan.status === STATUS_SAFE_MODE_WAIT) return "Wait safe mode";
    if (plan.status === STATUS_SCOUTING) return "Gain vision";
    if (plan.status === STATUS_BREACHING) return "Breach room";
    if (plan.status === STATUS_CONTROLLER_ATTACK) return "Attack controller";
    if (plan.status === STATUS_POST_ACTION) return `Post ${plan.postAction}`;
    if (plan.status === STATUS_BLOCKED) return plan.blockedReason || "Blocked";
    return "Complete";
  },

  getOwnedRoomHudReport(room, state) {
    if (!room) return null;
    const plans = this.getActivePlans().filter((plan) => this.isParticipantRoom(plan, room.name));
    if (plans.length <= 0) return null;

    const active = plans.filter((plan) => plan.attackModeActive);
    if (active.length <= 0) return null;

    const plan = active[0];
    const queue =
      Memory.rooms && Memory.rooms[room.name] && Memory.rooms[room.name].spawnQueue
        ? Memory.rooms[room.name].spawnQueue
        : [];
    const nextAttack = queue.find(function (item) {
      return item && item.operation === "attack";
    });

    const roleCounts = this.getAttackRoleCounts(plan.targetRoom, room.name);
    return {
      alert: { active: true },
      state: { phase: "attack" },
      attack: { plan: plan },
      hudLines: [
        `${room.name} | ATTACK`,
        `Target ${plan.targetRoom} | ${plan.status} | post ${plan.postAction}`,
        `D ${roleCounts.dismantler} A ${roleCounts.assault} He ${roleCounts.combat_healer} CA ${roleCounts.controller_attacker}`,
        `Spawn support | Next ${nextAttack ? nextAttack.role : "none"}`,
        `Economy hard-war | Upg/build held`,
      ],
    };
  },

  getAttackRoleCounts(targetRoom, homeRoom) {
    return {
      dismantler: countAttackCreeps("dismantler", targetRoom, homeRoom),
      assault: countAttackCreeps("assault", targetRoom, homeRoom),
      combat_healer: countAttackCreeps("combat_healer", targetRoom, homeRoom),
      controller_attacker: countAttackCreeps("controller_attacker", targetRoom, homeRoom),
    };
  },

  getVisibleAttackRooms() {
    const plans = this.getActivePlans();
    const entries = [];

    for (let i = 0; i < plans.length; i++) {
      const room = Game.rooms[plans[i].targetRoom] || null;
      if (!room) continue;
      entries.push({ plan: plans[i], room: room });
    }

    return entries;
  },

  getAttackRoomHudReport(room) {
    if (!room) return null;
    const plan = this.getActiveAttack(room.name);
    if (!plan) return null;

    this.updatePlanIntel(plan);
    this.updatePlanStatus(plan);

    const intel = plan.intel || {};
    const roleCounts = this.getAttackRoleCounts(plan.targetRoom, null);
    return {
      alert: { active: true },
      state: { phase: "attack" },
      attack: { plan: plan },
      hudLines: [
        `Attack ${room.name} | ${plan.status}`,
        `Owner ${intel.owner || intel.reservation || "neutral"} | RCL ${intel.controllerLevel || 0} | Safe ${intel.safeMode || 0}`,
        `Towers ${intel.towers || 0} | Spawns ${intel.spawns || 0} | Hostiles ${intel.hostileCreeps || 0}`,
        `Ctrl ${intel.ticksToDowngrade || "--"} | Walls ${formatCompactNumber(intel.minWallHits)} | Ramp ${formatCompactNumber(intel.minRampartHits)}`,
        `Creeps D ${roleCounts.dismantler} A ${roleCounts.assault} He ${roleCounts.combat_healer} CA ${roleCounts.controller_attacker}`,
        `Parent ${plan.parentRoom} | Next ${this.getNextGoalLabel(plan)}`,
      ],
    };
  },

  getPrimaryTarget(room) {
    if (!room) return null;
    const priority = [
      STRUCTURE_TOWER,
      STRUCTURE_SPAWN,
      STRUCTURE_RAMPART,
      STRUCTURE_WALL,
    ];
    const structures = room.find(FIND_STRUCTURES).filter(function (structure) {
      return !structure.my || structure.structureType === STRUCTURE_WALL;
    });

    for (let p = 0; p < priority.length; p++) {
      const matches = structures.filter(function (structure) {
        return structure.structureType === priority[p];
      });
      if (matches.length > 0) {
        matches.sort(function (a, b) {
          return (a.hits || 0) - (b.hits || 0);
        });
        return matches[0];
      }
    }

    return room.controller || null;
  },
};
