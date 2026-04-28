/*
Developer Summary:
Offensive assault creep.

Purpose:
- Provide combat pressure during manual attack operations
- Prioritize hostile creeps, then exposed hostile structures
*/

const attackManager = require("attack_manager");
const utils = require("utils");

const ROOM_TRAVEL_OPTIONS = {
  reusePath: 20,
  range: 20,
  visualizePathStyle: { stroke: "#ff006e" },
};

module.exports = {
  run(creep) {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) return;
    if (!attackManager.getActiveAttack(targetRoom)) return;

    if (creep.room.name !== targetRoom) {
      utils.moveTo(creep, new RoomPosition(25, 25, targetRoom), ROOM_TRAVEL_OPTIONS);
      return;
    }

    const target = this.getPriorityTarget(creep);
    if (!target) {
      this.moveToController(creep);
      return;
    }

    this.attackTarget(creep, target);
  },

  getPriorityTarget(creep) {
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    if (hostiles.length > 0) {
      const closest = creep.pos.findClosestByRange(hostiles);
      if (closest) return closest;
    }

    const priority = [
      STRUCTURE_TOWER,
      STRUCTURE_SPAWN,
      STRUCTURE_RAMPART,
      STRUCTURE_WALL,
    ];
    const structures = creep.room.find(FIND_STRUCTURES).filter(function (structure) {
      return !structure.my || structure.structureType === STRUCTURE_WALL;
    });

    for (let i = 0; i < priority.length; i++) {
      const matches = structures.filter(function (structure) {
        return structure.structureType === priority[i];
      });
      if (matches.length <= 0) continue;
      matches.sort(function (a, b) {
        return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
      });
      return matches[0];
    }

    return null;
  },

  attackTarget(creep, target) {
    const range = creep.pos.getRangeTo(target);
    const rangedParts = creep.getActiveBodyparts(RANGED_ATTACK);
    const attackParts = creep.getActiveBodyparts(ATTACK);

    if (rangedParts > 0 && range <= 3 && typeof creep.rangedAttack === "function") {
      creep.rangedAttack(target);
    }

    if (attackParts > 0 && range <= 1 && typeof creep.attack === "function") {
      creep.attack(target);
    }

    const desiredRange = attackParts > 0 ? 1 : 3;
    if (range > desiredRange) {
      utils.moveTo(creep, target, {
        reusePath: 4,
        range: desiredRange,
        visualizePathStyle: { stroke: "#ff006e" },
      });
    }
  },

  moveToController(creep) {
    if (!creep.room.controller) return;
    if (creep.pos.getRangeTo(creep.room.controller) > 3) {
      utils.moveTo(creep, creep.room.controller, {
        reusePath: 10,
        range: 3,
        visualizePathStyle: { stroke: "#ff006e" },
      });
    }
  },
};
