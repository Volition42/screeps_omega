/*
Developer Summary:
Remote ranged defender role.

Purpose:
- Respond to active threats in configured remote rooms
- Use ranged attacks against hostile creeps and hostile structures
- Hold controller pressure areas when reservation threats are active

Important Notes:
- This role remains defensive only and does not proactively roam
- Home melee defense is handled by role_defender
*/

const defenseManager = require("defense_manager");
const utils = require("utils");

const MOVE_OPTIONS = {
  reusePath: 8,
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

    if (!threat || threat.scope !== "remote") {
      creep.memory.targetRoom = homeRoomName;
      creep.memory.defenseType = "clear";
      this.rallyHome(creep, homeRoomName);
      return;
    }

    creep.memory.targetRoom = threat.roomName;
    creep.memory.defenseType = threat.classification;

    if (creep.room.name !== threat.roomName) {
      this.moveToRoom(creep, threat.roomName);
      return;
    }

    var hostile = this.getPriorityHostile(creep);

    if (hostile) {
      this.engageTarget(creep, hostile);
      return;
    }

    if (threat.claimPressure && creep.room.controller) {
      if (creep.pos.getRangeTo(creep.room.controller) > 3) {
        creep.moveTo(creep.room.controller, MOVE_OPTIONS);
      }
      return;
    }

    this.holdRemote(creep);
  },

  getDefenseState(homeRoomName, state) {
    if (state && state.defense) return state.defense;

    var homeRoom = Game.rooms[homeRoomName];
    if (!homeRoom) return null;

    var cache = utils.getRoomRuntimeCache(homeRoom);
    return cache && cache.state ? cache.state.defense || null : null;
  },

  getPriorityHostile(creep) {
    var targets = utils.getDefenseIntruders(
      creep.room,
      creep.room.find(FIND_HOSTILE_CREEPS),
      typeof FIND_HOSTILE_POWER_CREEPS !== "undefined"
        ? creep.room.find(FIND_HOSTILE_POWER_CREEPS)
        : [],
      typeof FIND_HOSTILE_STRUCTURES !== "undefined"
        ? creep.room.find(FIND_HOSTILE_STRUCTURES)
        : [],
    );

    if (targets.length === 0) return null;

    var closestByPath = creep.pos.findClosestByPath(targets, {
      range: 3,
    });

    if (closestByPath) return closestByPath;

    targets.sort(function (a, b) {
      return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
    });

    return targets[0];
  },

  engageTarget(creep, target) {
    var range = creep.pos.getRangeTo(target);

    if (range <= 3) {
      creep.rangedAttack(target);
    }

    if (range > 3) {
      creep.moveTo(target, {
        reusePath: 0,
        range: 3,
        visualizePathStyle: { stroke: "#ff9f43" },
      });
      return;
    }

    if (
      range <= 2 &&
      this.isDangerousCreep(target) &&
      this.flee(creep, [target])
    ) {
      return;
    }

    if (range < 3 && target.structureType === STRUCTURE_INVADER_CORE) {
      creep.moveTo(target, {
        reusePath: 0,
        range: 3,
        visualizePathStyle: { stroke: "#ff9f43" },
      });
    }
  },

  isDangerousCreep(target) {
    if (!target || typeof target.getActiveBodyparts !== "function") return false;

    return (
      target.getActiveBodyparts(ATTACK) > 0 ||
      target.getActiveBodyparts(RANGED_ATTACK) > 0
    );
  },

  flee(creep, hostiles) {
    var goals = _.map(hostiles, function (hostile) {
      return {
        pos: hostile.pos,
        range: 4,
      };
    });

    var result = PathFinder.search(creep.pos, goals, {
      flee: true,
      maxRooms: 1,
    });

    if (!result.path || result.path.length === 0) return false;

    creep.moveTo(result.path[0], MOVE_OPTIONS);
    return true;
  },

  holdRemote(creep) {
    var anchor = creep.room.controller || new RoomPosition(25, 25, creep.room.name);

    if (creep.pos.getRangeTo(anchor) > 4) {
      creep.moveTo(anchor, MOVE_OPTIONS);
    }
  },

  rallyHome(creep, homeRoomName) {
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
      reusePath: 40,
      range: 20,
      visualizePathStyle: { stroke: "#ff9f43" },
    });
  },
};
