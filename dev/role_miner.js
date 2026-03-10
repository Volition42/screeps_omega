const economyManager = require("economy_manager");

module.exports = {
  run(creep) {
    let source = creep.memory.sourceId
      ? Game.getObjectById(creep.memory.sourceId)
      : null;

    if (!source) {
      source = economyManager.getLeastAssignedSource(creep.room, "miner");
      if (source) creep.memory.sourceId = source.id;
    }

    if (!source) return;

    const container = source.pos.findInRange(FIND_STRUCTURES, 1, {
      filter: (s) => s.structureType === STRUCTURE_CONTAINER,
    })[0];

    if (container && !creep.pos.isEqualTo(container.pos)) {
      creep.moveTo(container, { visualizePathStyle: { stroke: "#ffaa00" } });
      return;
    }

    if (!container && !creep.pos.isNearTo(source)) {
      creep.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      return;
    }

    creep.harvest(source);

    if (container && creep.store[RESOURCE_ENERGY] > 0) {
      creep.transfer(container, RESOURCE_ENERGY);
    }
  },
};
