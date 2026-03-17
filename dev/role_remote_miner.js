/*
Developer Summary:
Remote Miner

Phase 2 remote harvest role.

Purpose:
- Specialize one miner per remote source
- Harvest into the remote source container
- Keep that container alive if it becomes critically damaged

Important Notes:
- Spawn logic should only field this role once a remote container is built
- This role does not build roads or containers in Phase B
*/

const config = require("config");
const utils = require("utils");

const MOVE_OPTIONS = {
  reusePath: 20,
};

module.exports = {
  run(creep) {
    var targetRoom = creep.memory.targetRoom;
    var sourceId = creep.memory.sourceId;
    if (!targetRoom || !sourceId) return;

    if (creep.room.name !== targetRoom) {
      this.moveToRoom(creep, targetRoom);
      return;
    }

    var source = Game.getObjectById(sourceId);
    if (!source) return;

    var container = utils.getSourceContainerBySource(creep.room, sourceId);

    if (container && !creep.pos.isEqualTo(container.pos)) {
      creep.moveTo(container, MOVE_OPTIONS);
      return;
    }

    if (container) {
      var criticalThreshold = Math.floor(
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

    var harvestResult = creep.harvest(source);

    if (
      container &&
      creep.store[RESOURCE_ENERGY] > 0 &&
      container.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    ) {
      creep.transfer(container, RESOURCE_ENERGY);
    }

    if (harvestResult === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, MOVE_OPTIONS);
    }
  },

  moveToRoom(creep, roomName) {
    creep.moveTo(new RoomPosition(25, 25, roomName), {
      reusePath: 50,
      range: 20,
      visualizePathStyle: { stroke: "#62d8ff" },
    });
  },
};
