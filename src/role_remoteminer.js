/*
Developer Summary:
Reserved Room Remote Miner

Purpose:
- Mine a single reserved-room source for a parent room
- Stand on the assigned source container when available
- Keep the container alive and avoid waste when it is full
*/

const config = require("config");
const utils = require("utils");

const ROOM_TRAVEL_OPTIONS = {
  reusePath: 30,
  range: 20,
};

module.exports = {
  run(creep) {
    const targetRoom = creep.memory.targetRoom;
    const sourceId = creep.memory.sourceId;
    if (!targetRoom || !sourceId) return;

    if (creep.room.name !== targetRoom) {
      utils.moveTo(
        creep,
        new RoomPosition(25, 25, targetRoom),
        ROOM_TRAVEL_OPTIONS,
      );
      return;
    }

    const source = Game.getObjectById(sourceId);
    if (!source) return;

    const container =
      Game.getObjectById(creep.memory.targetId) ||
      this.getSourceContainer(creep.room, source);

    if (container && !creep.pos.isEqualTo(container.pos)) {
      utils.moveTo(creep, container.pos, {
        reusePath: 20,
        range: 0,
      });
      return;
    }

    if (container && container.hits < container.hitsMax * config.REPAIR.criticalContainerThreshold) {
      if (creep.store[RESOURCE_ENERGY] > 0) {
        creep.repair(container);
        return;
      }
    }

    if (
      container &&
      container.store.getFreeCapacity(RESOURCE_ENERGY) === 0 &&
      creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0
    ) {
      return;
    }

    const result = creep.harvest(source);

    if (
      container &&
      creep.store[RESOURCE_ENERGY] > 0 &&
      container.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    ) {
      creep.transfer(container, RESOURCE_ENERGY);
    }

    if (result === ERR_NOT_IN_RANGE) {
      utils.moveTo(creep, source.pos, {
        reusePath: 20,
        range: 1,
      });
    }
  },

  getSourceContainer(room, source) {
    const containers = room.find(FIND_STRUCTURES, {
      filter: function (structure) {
        return (
          structure.structureType === STRUCTURE_CONTAINER &&
          structure.pos.getRangeTo(source) <= 1
        );
      },
    });

    return containers.length > 0 ? containers[0] : null;
  },
};
