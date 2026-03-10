module.exports = {
  run(creep) {
    if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.delivering = false;
    }

    if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
      creep.memory.delivering = true;
    }

    if (!creep.memory.delivering) {
      const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (s) =>
          s.structureType === STRUCTURE_CONTAINER &&
          s.store[RESOURCE_ENERGY] > 0,
      });

      if (container) {
        if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(container, {
            visualizePathStyle: { stroke: "#ffaa00" },
          });
        }
        return;
      }

      const dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 25,
      });

      if (dropped) {
        if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) {
          creep.moveTo(dropped, { visualizePathStyle: { stroke: "#ffaa00" } });
        }
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
