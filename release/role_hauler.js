/*
Developer Summary:
Hauler Role

Purpose:
- Pull energy from source-side logistics
- Deliver energy using shared room-wide priority logic
- Support emergency defense and spawn recovery first

Delivery priority:
Threat mode or low tower energy:
- spawn
- towers
- extensions
- storage

Normal mode:
- spawn
- extensions
- storage
- towers below reserve threshold

Pickup priority:
Normal mode:
- assigned source container
- other source containers
- large dropped energy
- small dropped energy

Emergency fallback:
- storage if source-side logistics are unavailable

Important Notes:
- Storage fallback allows haulers to keep spawn/extensions alive
  when miners are dead or containers are empty
- This makes haulers useful during colony recovery without changing
  miner or upgrader specialization
*/

const utils = require("utils");
const advancedStructureManager = require("advanced_structure_manager");

const MOVE_OPTIONS = {
  reusePath: 12,
};

module.exports = {
  run(creep, options) {
    const thinkInterval =
      options && options.thinkInterval ? options.thinkInterval : 1;
    const runtimeCache = utils.getRoomRuntimeCache(creep.room);
    const state = runtimeCache ? runtimeCache.state : null;

    if (this.runAdvancedTask(creep, state, thinkInterval)) {
      return;
    }

    if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.delivering = false;
      delete creep.memory.pickupTargetId;
      delete creep.memory.pickupTargetKind;
      delete creep.memory.deliveryTargetId;
    }

    if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
      creep.memory.delivering = true;
      delete creep.memory.pickupTargetId;
      delete creep.memory.pickupTargetKind;
      delete creep.memory.deliveryTargetId;
    }

    if (!creep.memory.delivering) {
      const pickupTarget = this.getPickupTarget(creep);
      if (!pickupTarget) return;

      if (pickupTarget.kind === "pickup") {
        if (creep.pickup(pickupTarget.target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(pickupTarget.target, MOVE_OPTIONS);
        }
        return;
      }

      if (
        creep.withdraw(pickupTarget.target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE
      ) {
        creep.moveTo(pickupTarget.target, MOVE_OPTIONS);
      }

      return;
    }

    const deliveryTarget = this.getDeliveryTarget(creep, thinkInterval);

    if (deliveryTarget) {
      if (
        creep.transfer(deliveryTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE
      ) {
        creep.moveTo(deliveryTarget, MOVE_OPTIONS);
      }
      return;
    }

    if (creep.room.storage && creep.pos.getRangeTo(creep.room.storage) > 1) {
      creep.moveTo(creep.room.storage, MOVE_OPTIONS);
    }
  },

  getPickupTarget(creep) {
    const cached = this.getCachedPickupTarget(creep);
    if (cached) return cached;

    return this.findPickupTarget(creep);
  },

  getCachedPickupTarget(creep) {
    const targetId = creep.memory.pickupTargetId;
    const kind = creep.memory.pickupTargetKind;
    if (!targetId || !kind) return null;

    const target = Game.getObjectById(targetId);
    if (!this.isValidPickupTarget(target, kind)) {
      delete creep.memory.pickupTargetId;
      delete creep.memory.pickupTargetKind;
      return null;
    }

    return {
      target: target,
      kind: kind,
    };
  },

  findPickupTarget(creep) {
    let sourceContainer = null;

    if (creep.memory.sourceId) {
      sourceContainer = utils.getSourceContainerBySource(
        creep.room,
        creep.memory.sourceId,
      );

      if (
        sourceContainer &&
        (sourceContainer.store[RESOURCE_ENERGY] || 0) <= 0
      ) {
        sourceContainer = null;
      }
    }

    if (!sourceContainer) {
      sourceContainer = utils.getBalancedSourceContainer(creep.room, creep);
    }

    if (sourceContainer) {
      return this.storePickupTarget(creep, sourceContainer, "withdraw");
    }

    const droppedEnergy = _.filter(
      utils.getDroppedEnergyResources(creep.room),
      function (resource) {
        return resource.amount > 0;
      },
    );
    const largeDrops = _.filter(droppedEnergy, function (resource) {
      return resource.amount >= creep.store.getFreeCapacity();
    });
    const largeDrop =
      largeDrops.length > 0 ? creep.pos.findClosestByPath(largeDrops) : null;

    if (largeDrop) {
      return this.storePickupTarget(creep, largeDrop, "pickup");
    }

    const smallDrop =
      droppedEnergy.length > 0
        ? creep.pos.findClosestByPath(droppedEnergy)
        : null;

    if (smallDrop) {
      return this.storePickupTarget(creep, smallDrop, "pickup");
    }

    // Developer note:
    // Emergency fallback.
    // If source-side logistics are dry, allow haulers to pull from storage
    // so they can still power spawn/extensions/towers during recovery.
    if (
      creep.room.storage &&
      (creep.room.storage.store[RESOURCE_ENERGY] || 0) > 0
    ) {
      return this.storePickupTarget(creep, creep.room.storage, "withdraw");
    }

    return null;
  },

  storePickupTarget(creep, target, kind) {
    creep.memory.pickupTargetId = target.id;
    creep.memory.pickupTargetKind = kind;

    return {
      target: target,
      kind: kind,
    };
  },

  isValidPickupTarget(target, kind) {
    if (!target) return false;

    if (kind === "pickup") {
      return (
        target.resourceType === RESOURCE_ENERGY &&
        target.amount > 0
      );
    }

    return (
      (target.structureType === STRUCTURE_CONTAINER ||
        target.structureType === STRUCTURE_STORAGE) &&
      (target.store[RESOURCE_ENERGY] || 0) > 0
    );
  },

  getDeliveryTarget(creep, thinkInterval) {
    const cached = this.getCachedDeliveryTarget(creep);

    if (cached && !this.shouldThink(creep, thinkInterval, "haulerDelivery")) {
      return cached;
    }

    const target = utils.getHaulerDeliveryTarget(creep.room, creep);

    if (target && target.id) {
      creep.memory.deliveryTargetId = target.id;
    } else {
      delete creep.memory.deliveryTargetId;
    }

    return target;
  },

  getCachedDeliveryTarget(creep) {
    if (!creep.memory.deliveryTargetId) return null;

    const target = Game.getObjectById(creep.memory.deliveryTargetId);
    if (
      !target ||
      !target.store ||
      target.store.getFreeCapacity(RESOURCE_ENERGY) <= 0
    ) {
      delete creep.memory.deliveryTargetId;
      return null;
    }

    return target;
  },

  shouldThink(creep, interval, key) {
    if (interval <= 1) return true;

    const memoryKey = key + "ThinkAt";
    if (!creep.memory[memoryKey] || Game.time >= creep.memory[memoryKey]) {
      creep.memory[memoryKey] = Game.time + interval;
      return true;
    }

    return false;
  },

  runAdvancedTask(creep, state, thinkInterval) {
    const carriedResource = this.getCarriedResourceType(creep);
    const totalCarry = creep.store.getUsedCapacity();
    const hasStoredAdvancedTask = !!creep.memory.advancedTask;

    if (!hasStoredAdvancedTask && totalCarry > 0) {
      return false;
    }

    if (!hasStoredAdvancedTask && totalCarry === 0) {
      if (!this.shouldThink(creep, thinkInterval, "haulerAdvanced")) {
        return false;
      }

      const nextTask = advancedStructureManager.getHaulerTask(
        creep.room,
        creep,
        state,
      );
      if (!nextTask) return false;
    }

    const task = creep.memory.advancedTask;
    if (!task) {
      if (carriedResource) {
        return this.returnAdvancedResource(creep, carriedResource);
      }

      return false;
    }

    const resourceType = task.resourceType;
    if (!this.hasOnlyResource(creep, resourceType)) {
      advancedStructureManager.clearHaulerTask(creep);
      return carriedResource
        ? this.returnAdvancedResource(creep, carriedResource)
        : false;
    }

    const pickup = Game.getObjectById(task.pickupId);
    const delivery = Game.getObjectById(task.deliveryId);

    if (!pickup || !delivery) {
      advancedStructureManager.clearHaulerTask(creep);
      return carriedResource
        ? this.returnAdvancedResource(creep, carriedResource)
        : false;
    }

    if (this.getStoredAmount(creep, resourceType) > 0) {
      const carriedAmount = this.getStoredAmount(creep, resourceType);
      const transferAmount =
        typeof task.amount === "number" && task.amount > 0
          ? Math.min(task.amount, carriedAmount)
          : carriedAmount;
      const transferResult = creep.transfer(
        delivery,
        resourceType,
        transferAmount,
      );

      if (transferResult === ERR_NOT_IN_RANGE) {
        creep.moveTo(delivery, MOVE_OPTIONS);
      } else if (transferResult === OK) {
        if (typeof task.amount === "number") {
          task.amount -= transferAmount;
        }
        if (!task.amount || task.amount <= 0) {
          advancedStructureManager.clearHaulerTask(creep);
        }
      } else {
        advancedStructureManager.clearHaulerTask(creep);
      }
      return true;
    }

    if (this.getStoredAmount(pickup, resourceType) <= 0) {
      advancedStructureManager.clearHaulerTask(creep);
      return false;
    }

    const withdrawAmount =
      typeof task.amount === "number" && task.amount > 0
        ? Math.min(task.amount, creep.store.getFreeCapacity(resourceType))
        : null;
    const withdrawResult =
      typeof withdrawAmount === "number" && withdrawAmount > 0
        ? creep.withdraw(pickup, resourceType, withdrawAmount)
        : creep.withdraw(pickup, resourceType);

    if (withdrawResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(pickup, MOVE_OPTIONS);
    } else if (withdrawResult !== OK) {
      advancedStructureManager.clearHaulerTask(creep);
    }

    return true;
  },

  returnAdvancedResource(creep, resourceType) {
    const target =
      (creep.room.terminal &&
        creep.room.terminal.store.getFreeCapacity(resourceType) > 0 &&
        creep.room.terminal) ||
      (creep.room.storage &&
        creep.room.storage.store.getFreeCapacity(resourceType) > 0 &&
        creep.room.storage) ||
      null;

    if (!target) return false;

    if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
      creep.moveTo(target, MOVE_OPTIONS);
    }

    return true;
  },

  getCarriedResourceType(creep) {
    for (const resourceType in creep.store) {
      if (!Object.prototype.hasOwnProperty.call(creep.store, resourceType)) {
        continue;
      }
      if ((creep.store[resourceType] || 0) > 0) {
        return resourceType;
      }
    }

    return null;
  },

  hasOnlyResource(creep, resourceType) {
    let seen = null;

    for (const currentType in creep.store) {
      if (!Object.prototype.hasOwnProperty.call(creep.store, currentType)) {
        continue;
      }
      if ((creep.store[currentType] || 0) <= 0) continue;

      if (seen && seen !== currentType) return false;
      seen = currentType;
    }

    return !seen || seen === resourceType;
  },

  getStoredAmount(target, resourceType) {
    if (!target || !target.store) return 0;
    if (typeof target.store.getUsedCapacity === "function") {
      const used = target.store.getUsedCapacity(resourceType);
      if (typeof used === "number" && used > 0) return used;
    }

    return target.store[resourceType] || 0;
  },
};
