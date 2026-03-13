const utils = require("utils");
const config = require("config");

module.exports = {
  run(creep) {
    if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.delivering = false;
    }

    if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
      creep.memory.delivering = true;
    }

    if (!creep.memory.delivering) {
      const largeDrop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: (r) =>
          r.resourceType === RESOURCE_ENERGY &&
          r.amount >= creep.store.getFreeCapacity(),
      });

      if (largeDrop) {
        if (creep.pickup(largeDrop) === ERR_NOT_IN_RANGE) {
          creep.moveTo(largeDrop);
        }
        return;
      }

      let sourceContainer = null;

      if (creep.memory.sourceId) {
        sourceContainer = utils.getSourceContainerBySource(
          creep.room,
          creep.memory.sourceId,
        );
      }

      if (!sourceContainer) {
        sourceContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: (s) =>
            s.structureType === STRUCTURE_CONTAINER &&
            _.some(
              creep.room.find(FIND_SOURCES),
              (src) => s.pos.getRangeTo(src) <= 1,
            ) &&
            s.store[RESOURCE_ENERGY] > 0,
        });
      }

      if (sourceContainer) {
        if (
          creep.withdraw(sourceContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE
        ) {
          creep.moveTo(sourceContainer);
        }
        return;
      }

      const smallDrop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: (r) => r.resourceType === RESOURCE_ENERGY,
      });

      if (smallDrop) {
        if (creep.pickup(smallDrop) === ERR_NOT_IN_RANGE) {
          creep.moveTo(smallDrop);
        }
      }

      return;
    }

    const spawnTarget = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: (s) =>
        s.structureType === STRUCTURE_SPAWN &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });

    if (spawnTarget) {
      if (creep.transfer(spawnTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(spawnTarget);
      }
      return;
    }

    const extensionTarget = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: (s) =>
        s.structureType === STRUCTURE_EXTENSION &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });

    if (extensionTarget) {
      if (
        creep.transfer(extensionTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE
      ) {
        creep.moveTo(extensionTarget);
      }
      return;
    }

    const towerTarget = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: (s) =>
        s.structureType === STRUCTURE_TOWER &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });

    if (towerTarget) {
      if (creep.transfer(towerTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(towerTarget);
      }
      return;
    }

    const controllerReserve = config.LOGISTICS.controllerContainerReserve;

    const controllerContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (s) =>
        s.structureType === STRUCTURE_CONTAINER &&
        creep.room.controller &&
        s.pos.getRangeTo(creep.room.controller) <= 4 &&
        s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
        (s.store[RESOURCE_ENERGY] || 0) < controllerReserve,
    });

    if (controllerContainer) {
      if (
        creep.transfer(controllerContainer, RESOURCE_ENERGY) ===
        ERR_NOT_IN_RANGE
      ) {
        creep.moveTo(controllerContainer);
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
