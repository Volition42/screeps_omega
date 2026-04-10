/*
Developer Summary:
Home defender role.

Purpose:
- Hold the home room during active invasions
- Use melee pressure against hostile creeps and hostile structures
- Stay anchored to the home room

Important Notes:
- This role is intentionally defensive and does not leave the home room
*/

const defenseManager = require("defense_manager");
const utils = require("utils");

const MOVE_OPTIONS = {
  reusePath: 10,
};

const COMBAT_MOVE_OPTIONS = {
  reusePath: 3,
  range: 1,
  visualizePathStyle: { stroke: "#ff6b6b" },
};

module.exports = {
  run(creep, state) {
    var homeRoomName = creep.memory.homeRoom || creep.memory.room;
    if (!homeRoomName) return;

    var homeThreat = this.getHomeThreat(homeRoomName, state);

    creep.memory.defenseType = homeThreat ? homeThreat.classification : "clear";

    if (creep.room.name !== homeRoomName) {
      this.moveToRoom(creep, homeRoomName);
      return;
    }

    var hostile = this.getPriorityHostile(creep, homeThreat);
    var attackParts = creep.getActiveBodyparts(ATTACK);
    var rangedParts = creep.getActiveBodyparts(RANGED_ATTACK);
    var healParts = creep.getActiveBodyparts(HEAL);

    if (hostile) {
      var range = creep.pos.getRangeTo(hostile);

      if (rangedParts > 0 && range <= 3 && typeof creep.rangedAttack === "function") {
        creep.rangedAttack(hostile);
      }

      if (attackParts > 0 && range <= 1 && typeof creep.attack === "function") {
        creep.attack(hostile);
      }

      if (
        ((attackParts > 0 && range > 1) || (attackParts <= 0 && range > 3)) &&
        typeof creep.moveTo === "function"
      ) {
        creep.moveTo(
          hostile,
          attackParts > 0
            ? COMBAT_MOVE_OPTIONS
            : Object.assign({}, COMBAT_MOVE_OPTIONS, { range: 3 }),
        );
      }

      if (
        healParts > 0 &&
        creep.hits < creep.hitsMax &&
        typeof creep.heal === "function"
      ) {
        creep.heal(creep);
      }

      return;
    }

    this.rally(creep, homeRoomName);
  },

  getHomeThreat(homeRoomName, state) {
    if (state && state.defense) {
      return defenseManager.getThreatByRoom(state.defense, homeRoomName);
    }

    var homeRoom = Game.rooms[homeRoomName];
    if (!homeRoom) return null;

    var cache = utils.getRoomRuntimeCache(homeRoom);
    if (!cache || !cache.state || !cache.state.defense) return null;

    return defenseManager.getThreatByRoom(cache.state.defense, homeRoomName);
  },

  getPriorityHostile(creep, homeThreat) {
    if (homeThreat && homeThreat.towerTargetId) {
      var assigned = Game.getObjectById(homeThreat.towerTargetId);
      if (assigned && assigned.pos && assigned.pos.roomName === creep.room.name) {
        return assigned;
      }
    }

    var targets = utils.getDefenseIntruders(creep.room);

    if (targets.length === 0) return null;

    var closestByPath = creep.pos.findClosestByPath(targets);
    if (closestByPath) return closestByPath;

    targets.sort(function (a, b) {
      return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
    });

    return targets[0];
  },

  rally(creep, homeRoomName) {
    var spawn = creep.room.find(FIND_MY_SPAWNS)[0];
    var anchor = spawn || new RoomPosition(25, 25, homeRoomName);

    if (creep.pos.getRangeTo(anchor) > 3) {
      creep.moveTo(anchor, MOVE_OPTIONS);
    }
  },

  moveToRoom(creep, roomName) {
    creep.moveTo(new RoomPosition(25, 25, roomName), {
      reusePath: 40,
      range: 20,
      visualizePathStyle: { stroke: "#ff6b6b" },
    });
  },
};
