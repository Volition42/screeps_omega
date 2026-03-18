/*
Developer Summary:
Bootstrap JrWorker

Purpose:
- Recover a home room during bootstrap phases
- Pull energy from stable local buffers before harvesting
- Feed the room's core infrastructure in a strict bootstrap order

Important Notes:
- Withdrawal priority:
  storage -> non-controller containers -> harvest
- Delivery priority:
  spawn -> extensions -> towers -> controller
*/

const logisticsManager = require("logistics_manager");

const MOVE_OPTIONS = {
  reusePath: 10,
};

module.exports = {
  run(creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
      this.clearDeliveryTarget(creep);
      this.clearWithdrawalTarget(creep);
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
      this.clearHarvestSource(creep);
      this.clearWithdrawalTarget(creep);
    }

    if (!creep.memory.working) {
      var withdrawalTarget = this.getWithdrawalTarget(creep);

      if (withdrawalTarget) {
        var withdrawalResult = creep.withdraw(
          withdrawalTarget,
          RESOURCE_ENERGY,
        );

        if (withdrawalResult === ERR_NOT_IN_RANGE) {
          creep.moveTo(withdrawalTarget, MOVE_OPTIONS);
        } else if (
          withdrawalResult === ERR_FULL ||
          withdrawalResult === ERR_INVALID_TARGET ||
          withdrawalResult === ERR_NOT_ENOUGH_RESOURCES
        ) {
          this.clearWithdrawalTarget(creep);
        }

        return;
      }

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

  getWithdrawalTarget(creep) {
    var cached = this.getCachedWithdrawalTarget(creep);
    if (cached) return cached;

    var target = logisticsManager.getStorageEnergyTarget(creep.room);

    if (!target) {
      target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: function (structure) {
          return (
            structure.structureType === STRUCTURE_CONTAINER &&
            (!creep.room.controller ||
              structure.pos.getRangeTo(creep.room.controller) > 4) &&
            structure.store &&
            (structure.store[RESOURCE_ENERGY] || 0) > 0
          );
        },
      });
    }

    if (target && target.id) {
      creep.memory.withdrawTargetId = target.id;
    } else {
      this.clearWithdrawalTarget(creep);
    }

    return target;
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
        Infinity,
        creep,
      );
    }

    if (target && target.id) {
      creep.memory.deliveryTargetId = target.id;
    } else {
      this.clearDeliveryTarget(creep);
    }

    return target;
  },

  getCachedWithdrawalTarget(creep) {
    if (!creep.memory.withdrawTargetId) return null;

    var target = Game.getObjectById(creep.memory.withdrawTargetId);
    if (
      !target ||
      !target.pos ||
      target.pos.roomName !== creep.room.name ||
      !target.store ||
      (target.store[RESOURCE_ENERGY] || 0) <= 0
    ) {
      this.clearWithdrawalTarget(creep);
      return null;
    }

    if (
      target.structureType === STRUCTURE_CONTAINER &&
      creep.room.controller &&
      target.pos.getRangeTo(creep.room.controller) <= 4
    ) {
      this.clearWithdrawalTarget(creep);
      return null;
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

  clearWithdrawalTarget(creep) {
    delete creep.memory.withdrawTargetId;
  },

  clearDeliveryTarget(creep) {
    delete creep.memory.deliveryTargetId;
  },
};
