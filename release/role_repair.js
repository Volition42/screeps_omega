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
      let sourceContainer = null;

      if (creep.memory.withdrawTargetId) {
        sourceContainer = Game.getObjectById(creep.memory.withdrawTargetId);

        if (
          !sourceContainer ||
          sourceContainer.structureType !== STRUCTURE_CONTAINER ||
          (sourceContainer.store[RESOURCE_ENERGY] || 0) <= 0
        ) {
          sourceContainer = null;
          delete creep.memory.withdrawTargetId;
        }
      }

      if (!sourceContainer) {
        sourceContainer = utils.getBalancedSourceContainer(creep.room, creep);

        if (sourceContainer) {
          creep.memory.withdrawTargetId = sourceContainer.id;
        }
      }

      if (sourceContainer) {
        if (
          creep.withdraw(sourceContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE
        ) {
          creep.moveTo(sourceContainer);
        }
        return;
      }

      const controllerContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: function (s) {
          return (
            s.structureType === STRUCTURE_CONTAINER &&
            creep.room.controller &&
            s.pos.getRangeTo(creep.room.controller) <= 4 &&
            s.store[RESOURCE_ENERGY] > 0
          );
        },
      });

      if (controllerContainer) {
        if (
          creep.withdraw(controllerContainer, RESOURCE_ENERGY) ===
          ERR_NOT_IN_RANGE
        ) {
          creep.moveTo(controllerContainer);
        }
        return;
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
