module.exports = {
  run(creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
    }

    if (!creep.memory.working) {
      let source = null;

      if (creep.memory.sourceId) {
        source = Game.getObjectById(creep.memory.sourceId);
      }

      if (!source) {
        const sources = creep.room.find(FIND_SOURCES);
        if (sources.length > 0) {
          const index = Game.time % sources.length;
          source = sources[index];
          creep.memory.sourceId = source.id;
        }
      }

      if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
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
        creep.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
      }
      return;
    }

    if (creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, {
          visualizePathStyle: { stroke: "#00ff00" },
        });
      }
    }
  },
};
