const utils = require("utils");
const config = require("config");

module.exports = {
  run(creep) {
    if (creep.memory.overrideMove) {
      const t = creep.memory.overrideMove;
      const pos = new RoomPosition(t.x, t.y, t.room);

      if (!creep.pos.isEqualTo(pos)) {
        creep.moveTo(pos, { visualizePathStyle: { stroke: "#ffaa00" } });
        return;
      }

      delete creep.memory.overrideMove;
    }
    if (!creep.memory.sourceId) return;

    const source = Game.getObjectById(creep.memory.sourceId);
    if (!source) return;

    const container = utils.getSourceContainerBySource(creep.room, source.id);

    // Miner can work on or adjacent to the source container now.
    if (
      container &&
      !creep.pos.isEqualTo(container.pos) &&
      !creep.pos.isNearTo(container.pos)
    ) {
      creep.moveTo(container);
      return;
    }

    if (!container && !creep.pos.isNearTo(source)) {
      creep.moveTo(source);
      return;
    }

    if (
      container &&
      creep.store[RESOURCE_ENERGY] > 0 &&
      container.hits <
        container.hitsMax * config.REPAIR.criticalContainerThreshold
    ) {
      creep.repair(container);
      return;
    }

    const result = creep.harvest(source);

    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(source);
      return;
    }

    if (container && creep.store[RESOURCE_ENERGY] > 0) {
      if (creep.transfer(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(container);
      }
      return;
    }

    if (!container && creep.store.getFreeCapacity() === 0) {
      creep.drop(RESOURCE_ENERGY);
    }
  },
};
