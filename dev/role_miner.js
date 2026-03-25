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
};
