/*
Developer Summary:
Defender role.

Purpose:
- Travel to threatened owned or configured remote rooms
- Attack hostile creeps with a simple melee response
- Hold remote controllers when hostile reservation pressure is the only signal

Important Notes:
- This role is intentionally narrow and does not perform proactive attacks
- Assignment is reevaluated each tick from the home room defense plan
- If no threat is active, the defender falls back to a home-room rally posture
*/

const defenseManager = require("defense_manager");
const utils = require("utils");

const MOVE_OPTIONS = {
  reusePath: 10,
};

module.exports = {
  run(creep, state) {
    var homeRoomName = creep.memory.homeRoom || creep.memory.room;
    if (!homeRoomName) return;

    var defenseState = this.getDefenseState(homeRoomName, state);
    var threat = defenseManager.getPreferredThreat(
      defenseState,
      creep.memory.targetRoom,
    );

    if (threat) {
      creep.memory.targetRoom = threat.roomName;
      creep.memory.defenseType = threat.type;
    } else {
      creep.memory.targetRoom = homeRoomName;
      delete creep.memory.defenseType;
    }

    var targetRoom = creep.memory.targetRoom || homeRoomName;

    if (creep.room.name !== targetRoom) {
      this.moveToRoom(creep, targetRoom);
      return;
    }

    var hostile = this.getPriorityHostile(creep, threat);

    if (hostile) {
      var attackResult = creep.attack(hostile);

      if (attackResult === ERR_NOT_IN_RANGE) {
        this.moveToTarget(creep, hostile);
      }

      return;
    }

    if (
      threat &&
      threat.roomName === creep.room.name &&
      threat.hostileReservation &&
      creep.room.controller
    ) {
      if (creep.pos.getRangeTo(creep.room.controller) > 1) {
        creep.moveTo(creep.room.controller, MOVE_OPTIONS);
      }
      return;
    }

    this.rally(creep, homeRoomName);
  },

  getDefenseState(homeRoomName, state) {
    if (state && state.defense) return state.defense;

    var homeRoom = Game.rooms[homeRoomName];
    if (!homeRoom) return null;

    var cache = utils.getRoomRuntimeCache(homeRoom);
    return cache && cache.state ? cache.state.defense || null : null;
  },

  getPriorityHostile(creep, threat) {
    var hostiles = utils.getDefenseIntruders(
      creep.room,
      creep.room.find(FIND_HOSTILE_CREEPS),
      typeof FIND_HOSTILE_POWER_CREEPS !== "undefined"
        ? creep.room.find(FIND_HOSTILE_POWER_CREEPS)
        : [],
      typeof FIND_HOSTILE_STRUCTURES !== "undefined"
        ? creep.room.find(FIND_HOSTILE_STRUCTURES)
        : [],
    );

    if (hostiles.length === 0) return null;

    var controllerHostile = this.getControllerHostile(creep, hostiles, threat);

    if (controllerHostile) {
      return controllerHostile;
    }

    var closestByPath = creep.pos.findClosestByPath(hostiles);

    if (closestByPath) {
      return closestByPath;
    }

    hostiles.sort(function (a, b) {
      var aClaim = this.getActiveBodyparts(a, CLAIM);
      var bClaim = this.getActiveBodyparts(b, CLAIM);
      if (aClaim !== bClaim) return bClaim - aClaim;

      var aHeal = this.getActiveBodyparts(a, HEAL);
      var bHeal = this.getActiveBodyparts(b, HEAL);
      if (aHeal !== bHeal) return bHeal - aHeal;

      var aCombat =
        this.getActiveBodyparts(a, ATTACK) +
        this.getActiveBodyparts(a, RANGED_ATTACK);
      var bCombat =
        this.getActiveBodyparts(b, ATTACK) +
        this.getActiveBodyparts(b, RANGED_ATTACK);
      if (aCombat !== bCombat) return bCombat - aCombat;

      return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
    }, this);

    return hostiles[0];
  },

  getControllerHostile(creep, hostiles, threat) {
    if (!creep.room.controller) return null;

    var controller = creep.room.controller;
    var hostileReservation = controller.reservation;
    var hostileReservationUser = null;

    if (hostileReservation && hostileReservation.username) {
      hostileReservationUser = hostileReservation.username;
    }

    var controllerThreatActive =
      hostileReservationUser ||
      (threat && threat.hostileReservation) ||
      (threat && threat.claimParts > 0);

    var controllerIntruders = this.getControllerIntruders(creep.room, controller);
    var candidates = this.mergeTargets(hostiles, controllerIntruders);

    var claimers = _.filter(candidates, function (hostile) {
      var nearController = hostile.pos.getRangeTo(controller) <= 4;
      var hasClaim = this.getActiveBodyparts(hostile, CLAIM) > 0;

      if (!nearController && !hasClaim) return false;

      if (!controllerThreatActive) {
        return nearController && hasClaim;
      }

      if (hostileReservationUser) {
        return hostile.owner && hostile.owner.username === hostileReservationUser;
      }

      return nearController || hasClaim;
    }, this);

    if (claimers.length === 0) return null;

    var closestByPath = creep.pos.findClosestByPath(claimers);

    if (closestByPath) {
      return closestByPath;
    }

    claimers.sort(function (a, b) {
      var aRange = creep.pos.getRangeTo(a);
      var bRange = creep.pos.getRangeTo(b);

      if (aRange !== bRange) return aRange - bRange;

      return a.hits - b.hits;
    });

    return claimers[0];
  },

  getControllerIntruders(room, controller) {
    var hostileCreeps = _.filter(room.find(FIND_CREEPS), function (candidate) {
      if (!candidate || !candidate.pos) return false;
      if (candidate.pos.getRangeTo(controller) > 4) return false;

      return utils.isDefenseHostile(candidate);
    });
    var hostilePowerCreeps = [];

    if (typeof FIND_POWER_CREEPS !== "undefined") {
      hostilePowerCreeps = _.filter(
        room.find(FIND_POWER_CREEPS),
        function (candidate) {
          if (!candidate || !candidate.pos) return false;
          if (candidate.pos.getRangeTo(controller) > 4) return false;

          return utils.isDefenseHostile(candidate);
        },
      );
    }

    return hostileCreeps.concat(hostilePowerCreeps);
  },

  mergeTargets(primary, secondary) {
    var byId = {};
    var merged = [];
    var groups = [primary || [], secondary || []];

    for (var i = 0; i < groups.length; i++) {
      for (var j = 0; j < groups[i].length; j++) {
        var target = groups[i][j];
        var id = target && target.id ? target.id : null;

        if (id && byId[id]) continue;
        if (id) byId[id] = true;

        merged.push(target);
      }
    }

    return merged;
  },

  moveToTarget(creep, target) {
    creep.moveTo(target, {
      reusePath: 0,
      range: 1,
      visualizePathStyle: { stroke: "#ff6b6b" },
    });
  },

  getActiveBodyparts(creep, partType) {
    if (!creep || typeof creep.getActiveBodyparts !== "function") {
      return 0;
    }

    return creep.getActiveBodyparts(partType);
  },

  rally(creep, homeRoomName) {
    if (creep.room.name !== homeRoomName) {
      this.moveToRoom(creep, homeRoomName);
      return;
    }

    var spawn = creep.room.find(FIND_MY_SPAWNS)[0];
    var anchor = spawn || new RoomPosition(25, 25, homeRoomName);

    if (creep.pos.getRangeTo(anchor) > 3) {
      creep.moveTo(anchor, MOVE_OPTIONS);
    }
  },

  moveToRoom(creep, roomName) {
    creep.moveTo(new RoomPosition(25, 25, roomName), {
      reusePath: 50,
      range: 20,
      visualizePathStyle: { stroke: "#ff6b6b" },
    });
  },
};
