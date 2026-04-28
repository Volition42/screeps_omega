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
    const plan = attackManager.getActiveAttack(targetRoom);
    if (!plan) return;

    if (this.waitForHealer(creep, plan)) {
      return;
    }

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

  waitForHealer(creep, plan) {
    if (!this.shouldRequireHealer(creep, plan)) {
      delete creep.memory.waitingForHealer;
      return false;
    }

    const healer = this.getAssignedHealer(creep, plan.targetRoom);
    const closeEnough = !!(
      healer &&
      healer.room.name === creep.room.name &&
      creep.pos.getRangeTo(healer) <= 3
    );

    if (closeEnough) {
      delete creep.memory.waitingForHealer;
      return false;
    }

    creep.memory.waitingForHealer = true;

    if (creep.room.name === plan.targetRoom) {
      const homeRoom = creep.memory.homeRoom || creep.memory.room || plan.parentRoom;
      if (homeRoom && homeRoom !== creep.room.name) {
        utils.moveTo(creep, new RoomPosition(25, 25, homeRoom), {
          reusePath: 10,
          range: 20,
          visualizePathStyle: { stroke: "#ff006e" },
        });
      }
      return true;
    }

    if (healer && healer.room.name === creep.room.name) {
      utils.moveTo(creep, healer, {
        reusePath: 3,
        range: 1,
        visualizePathStyle: { stroke: "#ff006e" },
      });
      return true;
    }

    this.rallyOutsideTarget(creep, plan);
    return true;
  },

  shouldRequireHealer(creep, plan) {
    const healer = this.getAssignedHealer(creep, plan.targetRoom);
    if (healer) return true;

    const intel = plan.intel || {};
    return (intel.towers || 0) > 0 || (intel.hostileCreeps || 0) > 0;
  },

  getAssignedHealer(creep, targetRoom) {
    const homeRoom = creep.memory.homeRoom || creep.memory.room || null;
    const candidates = [];

    for (const creepName in Game.creeps) {
      if (!Object.prototype.hasOwnProperty.call(Game.creeps, creepName)) continue;
      const candidate = Game.creeps[creepName];
      if (!candidate || !candidate.memory) continue;
      if (candidate.memory.operation !== "attack") continue;
      if (candidate.memory.role !== "combat_healer") continue;
      if (candidate.memory.targetRoom !== targetRoom) continue;
      if (
        homeRoom &&
        (candidate.memory.homeRoom || candidate.memory.room) !== homeRoom
      ) {
        continue;
      }
      candidates.push(candidate);
    }

    if (candidates.length <= 0) return null;
    candidates.sort(function (a, b) {
      if (a.room.name === creep.room.name && b.room.name !== creep.room.name) return -1;
      if (a.room.name !== creep.room.name && b.room.name === creep.room.name) return 1;
      return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
    });
    return candidates[0];
  },

  rallyOutsideTarget(creep, plan) {
    const homeRoom = creep.memory.homeRoom || creep.memory.room || plan.parentRoom;
    if (homeRoom && creep.room.name !== homeRoom) {
      utils.moveTo(creep, new RoomPosition(25, 25, homeRoom), {
        reusePath: 10,
        range: 20,
        visualizePathStyle: { stroke: "#ff006e" },
      });
      return;
    }

    const spawn = creep.room.find(FIND_MY_SPAWNS)[0];
    const anchor = spawn || creep.room.storage || new RoomPosition(25, 25, creep.room.name);
    if (creep.pos.getRangeTo(anchor) > 3) {
      utils.moveTo(creep, anchor, {
        reusePath: 10,
        range: 3,
        visualizePathStyle: { stroke: "#ff006e" },
      });
    }
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
