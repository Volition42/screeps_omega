/*
Developer Summary:
Bootstrap JrWorker

Purpose:
- Recover a home room when the local economy is degraded
- Harvest directly from sources
- Feed essential room energy targets before doing controller work

Important Notes:
- This role stays intentionally simple and self-sufficient
- Target caching keeps bootstrap creeps from oscillating between valid targets
*/

const config = require("config");
const logisticsManager = require("logistics_manager");

const MOVE_OPTIONS = {
  reusePath: 10,
};

module.exports = {
  run(creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
      this.clearDeliveryTarget(creep);
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
      this.clearHarvestSource(creep);
    }

    if (!creep.memory.working) {
      var source = this.getHarvestSource(creep);
      if (!source) return;

      if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, MOVE_OPTIONS);
      }
      return;
    }

    var deliveryTarget = this.getDeliveryTarget(creep);

    if (deliveryTarget) {
      var transferResult = creep.transfer(deliveryTarget, RESOURCE_ENERGY);

      if (transferResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(deliveryTarget, MOVE_OPTIONS);
        return;
      }

      if (
        transferResult === ERR_FULL ||
        transferResult === ERR_INVALID_TARGET ||
        transferResult === ERR_NOT_OWNER
      ) {
        this.clearDeliveryTarget(creep);
      }

      return;
    }

    var site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) {
        creep.moveTo(site, MOVE_OPTIONS);
      }
      return;
    }

    if (creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, MOVE_OPTIONS);
      }
    }
  },

  getHarvestSource(creep) {
    var source = null;

    if (creep.memory.harvestSourceId) {
      source = Game.getObjectById(creep.memory.harvestSourceId);

      if (
        !source ||
        !source.pos ||
        source.pos.roomName !== creep.room.name ||
        source.energy <= 0
      ) {
        source = null;
        this.clearHarvestSource(creep);
      }
    }

    if (!source) {
      source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
      if (!source) {
        source = creep.pos.findClosestByPath(FIND_SOURCES);
      }

      if (source) {
        creep.memory.harvestSourceId = source.id;
      }
    }

    return source;
  },

  getDeliveryTarget(creep) {
    var cached = this.getCachedDeliveryTarget(creep);
    if (cached) return cached;

    var target = logisticsManager.getSpawnDeliveryTarget(creep.room, creep);

    if (!target) {
      target = logisticsManager.getExtensionDeliveryTarget(creep.room, creep);
    }

    if (!target) {
      target = logisticsManager.getLowTowerTarget(
        creep.room,
        config.LOGISTICS.towerEmergencyThreshold,
        creep,
      );
    }

    if (!target) {
      target = logisticsManager.getControllerContainerDeliveryTarget(
        creep.room,
        creep,
        config.LOGISTICS.controllerContainerReserve,
      );
    }

    if (!target) {
      target = logisticsManager.getStorageDeliveryTarget(creep.room);
    }

    if (!target) {
      target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: function (structure) {
          return (
            structure.structureType === STRUCTURE_CONTAINER &&
            structure.store &&
            structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
          );
        },
      });
    }

    if (target && target.id) {
      creep.memory.deliveryTargetId = target.id;
    } else {
      this.clearDeliveryTarget(creep);
    }

    return target;
  },

  getCachedDeliveryTarget(creep) {
    if (!creep.memory.deliveryTargetId) return null;

    var target = Game.getObjectById(creep.memory.deliveryTargetId);
    if (
      !target ||
      !target.pos ||
      target.pos.roomName !== creep.room.name ||
      !target.store ||
      target.store.getFreeCapacity(RESOURCE_ENERGY) <= 0
    ) {
      this.clearDeliveryTarget(creep);
      return null;
    }

    return target;
  },

  clearHarvestSource(creep) {
    delete creep.memory.harvestSourceId;
  },

  clearDeliveryTarget(creep) {
    delete creep.memory.deliveryTargetId;
  },
};
