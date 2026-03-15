/*
Developer Summary:
Repair Role

Purpose:
- Withdraw energy from shared colony buffers
- Maintain critical infrastructure and defenses
- Build when repair pressure is low
- Upgrade as final fallback

Withdrawal priority:
- storage
- source containers
- harvest source as fallback

Important Notes:
- Miners and upgraders are unchanged
- Repairers now follow the same withdrawal order as workers
*/

const config = require("config");
const utils = require("utils");

module.exports = {
  run(creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
      delete creep.memory.withdrawTargetId;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
      delete creep.memory.withdrawTargetId;
    }

    if (!creep.memory.working) {
      let target = null;

      if (creep.memory.withdrawTargetId) {
        target = Game.getObjectById(creep.memory.withdrawTargetId);

        if (
          !target ||
          ((target.structureType === STRUCTURE_STORAGE ||
            target.structureType === STRUCTURE_CONTAINER) &&
            (target.store[RESOURCE_ENERGY] || 0) <= 0)
        ) {
          target = null;
          delete creep.memory.withdrawTargetId;
        }
      }

      if (!target) {
        target = utils.getGeneralEnergyWithdrawalTarget(creep.room, creep);

        if (target && target.id) {
          creep.memory.withdrawTargetId = target.id;
        } else {
          delete creep.memory.withdrawTargetId;
        }
      }

      if (!target) return;

      if (
        target.structureType === STRUCTURE_STORAGE ||
        target.structureType === STRUCTURE_CONTAINER
      ) {
        if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target);
        }
        return;
      }

      if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target);
      }

      return;
    }

    const criticalContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          s.hits < s.hitsMax * config.REPAIR.criticalContainerThreshold
        );
      },
    });

    if (criticalContainer) {
      if (creep.repair(criticalContainer) === ERR_NOT_IN_RANGE) {
        creep.moveTo(criticalContainer);
      }
      return;
    }

    const importantRepairTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (s) {
        if (s.structureType === STRUCTURE_ROAD) return false;
        if (s.structureType === STRUCTURE_WALL) return false;
        if (s.structureType === STRUCTURE_RAMPART) return false;

        if (s.structureType === STRUCTURE_CONTAINER) {
          return s.hits < s.hitsMax * config.REPAIR.importantThreshold;
        }

        if (
          s.structureType === STRUCTURE_EXTENSION ||
          s.structureType === STRUCTURE_SPAWN ||
          s.structureType === STRUCTURE_TOWER
        ) {
          return s.hits < s.hitsMax * config.REPAIR.spawnExtensionThreshold;
        }

        return false;
      },
    });

    if (importantRepairTarget) {
      if (creep.repair(importantRepairTarget) === ERR_NOT_IN_RANGE) {
        creep.moveTo(importantRepairTarget);
      }
      return;
    }

    const lowRampart = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_RAMPART &&
          s.hits < config.REPAIR.rampartMinHits
        );
      },
    });

    if (lowRampart) {
      if (creep.repair(lowRampart) === ERR_NOT_IN_RANGE) {
        creep.moveTo(lowRampart);
      }
      return;
    }

    const lowWall = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_WALL &&
          s.hits < config.REPAIR.wallMinHits
        );
      },
    });

    if (lowWall) {
      if (creep.repair(lowWall) === ERR_NOT_IN_RANGE) {
        creep.moveTo(lowWall);
      }
      return;
    }

    const roadRepairTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_ROAD &&
          s.hits < s.hitsMax * config.REPAIR.roadThreshold
        );
      },
    });

    if (roadRepairTarget) {
      if (creep.repair(roadRepairTarget) === ERR_NOT_IN_RANGE) {
        creep.moveTo(roadRepairTarget);
      }
      return;
    }

    const site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) {
        creep.moveTo(site);
      }
      return;
    }

    if (creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller);
      }
    }
  },
};
