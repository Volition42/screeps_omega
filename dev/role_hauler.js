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
- controller container
- storage

Normal mode:
- spawn
- extensions
- controller container
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
        filter: function (r) {
          return (
            r.resourceType === RESOURCE_ENERGY &&
            r.amount >= creep.store.getFreeCapacity()
          );
        },
      });

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
        sourceContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
          filter: function (s) {
            return (
              s.structureType === STRUCTURE_CONTAINER &&
              _.some(creep.room.find(FIND_SOURCES), function (src) {
                return s.pos.getRangeTo(src) <= 1;
              }) &&
              (s.store[RESOURCE_ENERGY] || 0) > 0
            );
          },
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

      if (largeDrop) {
        if (creep.pickup(largeDrop) === ERR_NOT_IN_RANGE) {
          creep.moveTo(largeDrop);
        }
        return;
      }

      const smallDrop = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: function (r) {
          return r.resourceType === RESOURCE_ENERGY;
        },
      });

      if (smallDrop) {
        if (creep.pickup(smallDrop) === ERR_NOT_IN_RANGE) {
          creep.moveTo(smallDrop);
        }
        return;
      }

      // Developer note:
      // Emergency fallback.
      // If source-side logistics are dry, allow haulers to pull from storage
      // so they can still power spawn/extensions/towers during recovery.
      if (
        creep.room.storage &&
        (creep.room.storage.store[RESOURCE_ENERGY] || 0) > 0
      ) {
        if (
          creep.withdraw(creep.room.storage, RESOURCE_ENERGY) ===
          ERR_NOT_IN_RANGE
        ) {
          creep.moveTo(creep.room.storage);
        }
      }

      return;
    }

    const deliveryTarget = utils.getHaulerDeliveryTarget(creep.room, creep);

    if (deliveryTarget) {
      if (
        creep.transfer(deliveryTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE
      ) {
        creep.moveTo(deliveryTarget);
      }
      return;
    }

    if (creep.room.storage && creep.pos.getRangeTo(creep.room.storage) > 1) {
      creep.moveTo(creep.room.storage);
    }
  },
};
