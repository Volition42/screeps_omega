/*
Developer Summary:
Defender role.

Purpose:
- Hold the assigned room during active invasions
- Support nearby owned rooms when spawned for cross-room defense
- Use melee pressure against hostile creeps and hostile structures

Important Notes:
- This role is intentionally defensive and returns home when support work clears
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

    var targetRoomName = creep.memory.targetRoom || homeRoomName;
    var threat = this.getDefenseThreat(targetRoomName, state);

    if (
      targetRoomName !== homeRoomName &&
      this.shouldReleaseSupportAssignment(targetRoomName, threat)
    ) {
      delete creep.memory.targetRoom;
      creep.memory.operation = null;
      targetRoomName = homeRoomName;
      threat = this.getDefenseThreat(homeRoomName, state);
    }

    creep.memory.defenseType = threat
      ? threat.classification || threat.type || "active"
      : "clear";

    if (creep.room.name !== targetRoomName) {
      this.moveToRoom(creep, targetRoomName);
      return;
    }

    var hostile = this.getPriorityHostile(creep, threat);
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

    if (targetRoomName !== homeRoomName) {
      this.moveToRoom(creep, homeRoomName);
      return;
    }

    this.rally(creep, targetRoomName);
  },

  shouldReleaseSupportAssignment(targetRoomName, threat) {
    var targetRoom = Game.rooms[targetRoomName];
    if (!targetRoom) return false;
    if (threat && threat.active) return false;

    return utils.getDefenseIntruders(targetRoom).length === 0;
  },

  getDefenseThreat(roomName, state) {
    if (state && state.defense) {
      var stateThreat = defenseManager.getThreatByRoom(state.defense, roomName);
      if (stateThreat) return stateThreat;
    }

    var room = Game.rooms[roomName];
    if (!room) return null;

    var cache = utils.getRoomRuntimeCache(room);
    var cacheState = cache && cache.state ? cache.state : null;

    if (cacheState && cacheState.defense) {
      var cachedThreat = defenseManager.getThreatByRoom(cacheState.defense, roomName);
      if (cachedThreat) return cachedThreat;
    }

    var hostiles = utils.getDefenseIntruders(room);
    if (hostiles.length <= 0) return null;

    return defenseManager.getOwnedRoomThreat(
      room,
      cacheState,
      defenseManager.getReactionConfig(),
    );
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
