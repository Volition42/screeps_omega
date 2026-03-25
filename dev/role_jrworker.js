/*
Developer Summary:
Bootstrap JrWorker

Purpose:
- Recover a home room during bootstrap phases
- Pull energy from stable local buffers before harvesting
- Feed the room's core infrastructure in a strict bootstrap order

Important Notes:
- Withdrawal priority:
  storage -> containers -> harvest
- Delivery priority:
  spawn -> extensions -> towers -> controller
*/

const logisticsManager = require("logistics_manager");
const utils = require("utils");

const MOVE_OPTIONS = {
  reusePath: 10,
};

const INTERACT_MOVE_OPTIONS = {
  reusePath: 10,
  range: 1,
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
          utils.moveTo(creep, withdrawalTarget, MOVE_OPTIONS);
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

      var harvestResult = creep.harvest(source);
      creep.memory.debugAction = {
        kind: "harvest",
        result: harvestResult,
        range: creep.pos.getRangeTo(source),
        sourceId: source.id,
      };

      if (harvestResult === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, source.pos, INTERACT_MOVE_OPTIONS);
      }
      return;
    }

    var deliveryTarget = this.getDeliveryTarget(creep);

    if (deliveryTarget) {
      var transferResult = creep.transfer(deliveryTarget, RESOURCE_ENERGY);

      if (transferResult === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, deliveryTarget, MOVE_OPTIONS);
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
        utils.moveTo(creep, creep.room.controller.pos, INTERACT_MOVE_OPTIONS);
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
      var candidates = creep.room.find(FIND_SOURCES_ACTIVE);
      if (!candidates || candidates.length === 0) {
        candidates = creep.room.find(FIND_SOURCES);
      }

      if (candidates && candidates.length > 0) {
        var assignedCounts = {};
        var creeps = creep.room.find(FIND_MY_CREEPS);

        for (var i = 0; i < creeps.length; i++) {
          var other = creeps[i];
          var assignedId =
            other.memory && other.memory.harvestSourceId
              ? other.memory.harvestSourceId
              : null;

          if (!assignedId) continue;
          assignedCounts[assignedId] = (assignedCounts[assignedId] || 0) + 1;
        }

        source = _.min(candidates, function (candidate) {
          var assigned = assignedCounts[candidate.id] || 0;
          return assigned * 100 + creep.pos.getRangeTo(candidate);
        });
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
