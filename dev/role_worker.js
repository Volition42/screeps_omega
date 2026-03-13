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

      const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
      if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source);
        }
      }
      return;
    }

    const spawnTarget = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_SPAWN &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });

    if (spawnTarget) {
      if (creep.transfer(spawnTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(spawnTarget);
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
