/*
Developer Summary:
Offensive dismantler.

Purpose:
- Move to an attack target room
- Break priority hostile structures and blocking walls/ramparts
*/

const attackManager = require("attack_manager");
const utils = require("utils");

const ROOM_TRAVEL_OPTIONS = {
  reusePath: 20,
  range: 20,
  visualizePathStyle: { stroke: "#ff595e" },
};

const TARGET_MOVE_OPTIONS = {
  reusePath: 4,
  range: 1,
  visualizePathStyle: { stroke: "#ff595e" },
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

    if (creep.pos.getRangeTo(target) > 1) {
      utils.moveTo(creep, target, TARGET_MOVE_OPTIONS);
      return;
    }

    if (creep.getActiveBodyparts(WORK) > 0 && typeof creep.dismantle === "function") {
      creep.dismantle(target);
      return;
    }

    if (creep.getActiveBodyparts(ATTACK) > 0 && typeof creep.attack === "function") {
      creep.attack(target);
    }
  },

  getPriorityTarget(creep) {
    const room = creep.room;
    const controller = room.controller || null;
    const structures = room.find(FIND_STRUCTURES).filter(function (structure) {
      if (structure.my) return false;
      return structure.structureType !== STRUCTURE_ROAD &&
        structure.structureType !== STRUCTURE_CONTAINER;
    });

    const priority = [
      STRUCTURE_TOWER,
      STRUCTURE_SPAWN,
      STRUCTURE_RAMPART,
      STRUCTURE_WALL,
      STRUCTURE_STORAGE,
      STRUCTURE_TERMINAL,
    ];

    for (let i = 0; i < priority.length; i++) {
      const matches = structures.filter(function (structure) {
        return structure.structureType === priority[i];
      });
      if (matches.length <= 0) continue;
      matches.sort(function (a, b) {
        const aRange = controller ? a.pos.getRangeTo(controller) : creep.pos.getRangeTo(a);
        const bRange = controller ? b.pos.getRangeTo(controller) : creep.pos.getRangeTo(b);
        if (aRange !== bRange) return aRange - bRange;
        return (a.hits || 0) - (b.hits || 0);
      });
      return matches[0];
    }

    if (structures.length <= 0) return null;
    structures.sort(function (a, b) {
      return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
    });
    return structures[0];
  },

  moveToController(creep) {
    if (!creep.room.controller) return;
    if (creep.pos.getRangeTo(creep.room.controller) > 3) {
      utils.moveTo(creep, creep.room.controller, {
        reusePath: 10,
        range: 3,
        visualizePathStyle: { stroke: "#ff595e" },
      });
    }
  },
};
