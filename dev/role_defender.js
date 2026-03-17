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

    var hostile = this.getPriorityHostile(creep);

    if (hostile) {
      var attackResult = creep.attack(hostile);

      if (attackResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(hostile, MOVE_OPTIONS);
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

  getPriorityHostile(creep) {
    var hostiles = utils.getDefenseHostiles(
      creep.room,
      creep.room.find(FIND_HOSTILE_CREEPS),
    );

    if (hostiles.length === 0) return null;

    var controllerHostile = this.getControllerHostile(creep, hostiles);

    if (controllerHostile) {
      return controllerHostile;
    }

    hostiles.sort(function (a, b) {
      var aClaim = a.getActiveBodyparts(CLAIM);
      var bClaim = b.getActiveBodyparts(CLAIM);
      if (aClaim !== bClaim) return bClaim - aClaim;

      var aHeal = a.getActiveBodyparts(HEAL);
      var bHeal = b.getActiveBodyparts(HEAL);
      if (aHeal !== bHeal) return bHeal - aHeal;

      var aCombat =
        a.getActiveBodyparts(ATTACK) + a.getActiveBodyparts(RANGED_ATTACK);
      var bCombat =
        b.getActiveBodyparts(ATTACK) + b.getActiveBodyparts(RANGED_ATTACK);
      if (aCombat !== bCombat) return bCombat - aCombat;

      return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
    });

    return hostiles[0];
  },

  getControllerHostile(creep, hostiles) {
    if (!creep.room.controller) return null;

    var controller = creep.room.controller;
    var hostileReservation = controller.reservation;
    var hostileReservationUser = null;

    if (hostileReservation && hostileReservation.username) {
      hostileReservationUser = hostileReservation.username;
    }

    var claimers = _.filter(hostiles, function (hostile) {
      if (hostile.getActiveBodyparts(CLAIM) <= 0) return false;
      if (hostile.pos.getRangeTo(controller) > 3) return false;

      if (hostileReservationUser) {
        return hostile.owner && hostile.owner.username === hostileReservationUser;
      }

      return true;
    });

    if (claimers.length === 0) return null;

    claimers.sort(function (a, b) {
      var aRange = creep.pos.getRangeTo(a);
      var bRange = creep.pos.getRangeTo(b);

      if (aRange !== bRange) return aRange - bRange;

      return a.hits - b.hits;
    });

    return claimers[0];
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
