module.exports = {
  run(creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
    }
    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
    }

    if (!creep.memory.working) {
      if (!creep.memory.sourceId) {
        const sources = creep.room.find(FIND_SOURCES);
        if (sources.length) {
          creep.memory.sourceId = sources[0].id;
        }
      }

      const source = Game.getObjectById(creep.memory.sourceId);
      if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source);
      }
      return;
    }

    const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (s) =>
        (s.structureType === STRUCTURE_SPAWN ||
          s.structureType === STRUCTURE_EXTENSION) &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });

    if (target) {
      if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target);
      }
      return;
    }

    if (
      creep.room.controller &&
      creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE
    ) {
      creep.moveTo(creep.room.controller);
    }
  },
};
