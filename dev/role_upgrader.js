module.exports = {
  run(creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
    }

    if (!creep.memory.working) {
      const source = creep.pos.findClosestByPath(FIND_SOURCES);
      if (source) {
        creep.memory.sourceId = source.id;
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source);
        }
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
