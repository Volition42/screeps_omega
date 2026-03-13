const config = require("config");
const utils = require("utils");

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
    if (!creep.memory.targetId) return;

    const container = Game.getObjectById(creep.memory.targetId);
    if (!container) return;

    const workPos = utils.getUpgraderWorkPosition(creep.room, container);

    if (workPos && !creep.pos.isEqualTo(workPos)) {
      creep.moveTo(workPos);
      return;
    }

    if (
      creep.store[RESOURCE_ENERGY] > 0 &&
      container.hits <
        container.hitsMax * config.REPAIR.criticalContainerThreshold
    ) {
      creep.repair(container);
      return;
    }

    if (creep.store[RESOURCE_ENERGY] === 0) {
      if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(container);
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
