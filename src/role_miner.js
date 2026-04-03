/*
Developer Summary:
Miner Role

Purpose:
- Sit on a source container
- Harvest source energy efficiently
- Keep the container alive if it becomes critically damaged
- Do not over-harvest when the container is full

Important Notes:
- Miners are intended to be single-source specialists
- Miner should stop harvesting when both:
  - its own carry is full
  - the container under it is full
- This prevents wasted dropped energy on the ground
*/

const config = require("config");
const utils = require("utils");

module.exports = {
  run(creep) {
    const sourceId = creep.memory.sourceId;
    if (!sourceId) return;

    const source = Game.getObjectById(sourceId);
    if (!source) return;

    const container = utils.getSourceContainerBySource(creep.room, sourceId);

    // Move onto assigned container if possible
    if (container && !creep.pos.isEqualTo(container.pos)) {
      utils.moveTo(creep, container.pos, {
        reusePath: 20,
        range: 0,
      });
      return;
    }

    // Emergency repair if the miner is standing on a damaged container
    if (container) {
      const criticalThreshold = Math.floor(
        container.hitsMax * config.REPAIR.criticalContainerThreshold,
      );

      if (
        container.hits < criticalThreshold &&
        creep.store[RESOURCE_ENERGY] > 0
      ) {
        creep.repair(container);
        return;
      }
    }

    // If the miner and container are both effectively full, stop harvesting.
    if (container) {
      const containerFree = container.store.getFreeCapacity(RESOURCE_ENERGY);
      const creepFree = creep.store.getFreeCapacity(RESOURCE_ENERGY);

      if (containerFree === 0 && creepFree === 0) {
        return;
      }
    }

    // Harvest source
    const harvestResult = creep.harvest(source);

    // If creep has energy and is not on a perfectly full container,
    // transfer into the container to keep flow clean.
    if (
      container &&
      creep.store[RESOURCE_ENERGY] > 0 &&
      container.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    ) {
      creep.transfer(container, RESOURCE_ENERGY);
    }

    // Fallback movement if not already in place
    if (harvestResult === ERR_NOT_IN_RANGE) {
      utils.moveTo(creep, source.pos, {
        reusePath: 20,
        range: 1,
      });
    }
  },

  runMineral(creep) {
    const mineralId = creep.memory.targetId;
    if (!mineralId) return;

    const mineral = Game.getObjectById(mineralId);
    if (!mineral) return;

    const runtimeCache = utils.getRoomRuntimeCache(creep.room);
    const state = runtimeCache ? runtimeCache.state : null;
    const container = state && state.mineralContainer ? state.mineralContainer : null;
    const extractor = this.getExtractor(creep.room, mineral, state);
    const carriedResource = this.getCarriedResourceType(creep);

    if (carriedResource) {
      if (
        container &&
        creep.pos.isEqualTo(container.pos) &&
        container.store.getFreeCapacity(carriedResource) > 0
      ) {
        creep.transfer(container, carriedResource);
        return;
      }

      if (!container || !creep.pos.isEqualTo(container.pos) || container.store.getFreeCapacity(carriedResource) <= 0) {
        const delivery = this.getMineralDeliveryTarget(creep.room);
        if (delivery) {
          if (creep.transfer(delivery, carriedResource) === ERR_NOT_IN_RANGE) {
            utils.moveTo(creep, delivery, {
              reusePath: 20,
              range: 1,
            });
          }
          return;
        }
      }
    }

    if (!extractor || mineral.mineralAmount <= 0) {
      this.holdNearMineral(creep, container, mineral);
      return;
    }

    if (container && !creep.pos.isEqualTo(container.pos)) {
      utils.moveTo(creep, container.pos, {
        reusePath: 20,
        range: 0,
      });
      return;
    }

    const containerFree = container
      ? container.store.getFreeCapacity(this.getMineralResourceType(mineral))
      : 0;
    const creepFree = creep.store.getFreeCapacity(this.getMineralResourceType(mineral));

    if (container && containerFree === 0 && creepFree === 0) {
      const delivery = this.getMineralDeliveryTarget(creep.room);
      if (delivery && creep.transfer(delivery, this.getMineralResourceType(mineral)) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, delivery, {
          reusePath: 20,
          range: 1,
        });
      }
      return;
    }

    const harvestResult = creep.harvest(mineral);

    if (
      container &&
      creep.store.getUsedCapacity() > 0 &&
      container.store.getFreeCapacity(this.getMineralResourceType(mineral)) > 0
    ) {
      creep.transfer(container, this.getMineralResourceType(mineral));
    }

    if (harvestResult === ERR_NOT_IN_RANGE) {
      utils.moveTo(creep, mineral.pos, {
        reusePath: 20,
        range: 1,
      });
    }
  },

  getExtractor(room, mineral, state) {
    if (!room || !mineral) return null;

    const structuresByType = state && state.structuresByType ? state.structuresByType : null;
    const extractors = structuresByType && structuresByType[STRUCTURE_EXTRACTOR]
      ? structuresByType[STRUCTURE_EXTRACTOR]
      : room.find(FIND_STRUCTURES, {
          filter: function (structure) {
            return structure.structureType === STRUCTURE_EXTRACTOR;
          },
        });

    return _.find(extractors, function (extractor) {
      return extractor.pos.isEqualTo(mineral.pos);
    }) || null;
  },

  getMineralDeliveryTarget(room) {
    if (room.terminal && room.terminal.store.getFreeCapacity() > 0) {
      return room.terminal;
    }
    if (room.storage && room.storage.store.getFreeCapacity() > 0) {
      return room.storage;
    }

    return null;
  },

  getCarriedResourceType(creep) {
    if (!creep || !creep.store) return null;

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

  getMineralResourceType(mineral) {
    return mineral && mineral.mineralType ? mineral.mineralType : null;
  },

  holdNearMineral(creep, container, mineral) {
    const anchor = container ? container.pos : mineral ? mineral.pos : null;
    if (!anchor) return;

    const range = container ? 0 : 1;
    if (creep.pos.inRangeTo(anchor, range)) return;

    utils.moveTo(creep, anchor, {
      reusePath: 20,
      range: range,
    });
  },
};
