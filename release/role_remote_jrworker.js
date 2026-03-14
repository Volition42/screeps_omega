/*
Developer Summary:
Remote JrWorker

Phase 1 remote mining role.

Purpose:
- Travel to a configured remote room
- Harvest energy directly from remote sources
- Bring energy back to the home room
- Fill home spawn/extensions first
- Use storage/container/controller as fallback

Important Notes:
- This is intentionally simple
- No remote construction yet
- No reservation yet
- No defense yet
*/

module.exports = {
  run(creep) {
    var targetRoom = creep.memory.targetRoom;
    var homeRoom = creep.memory.room;

    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
    }

    // Harvest mode
    if (!creep.memory.working) {
      if (creep.room.name !== targetRoom) {
        creep.moveTo(new RoomPosition(25, 25, targetRoom), {
          reusePath: 20,
          visualizePathStyle: { stroke: "#ffaa00" },
        });
        return;
      }

      var source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
      if (!source) {
        source = creep.pos.findClosestByPath(FIND_SOURCES);
      }

      if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
          creep.moveTo(source, {
            reusePath: 10,
            visualizePathStyle: { stroke: "#ffaa00" },
          });
        }
      }

      return;
    }

    // Delivery mode
    if (creep.room.name !== homeRoom) {
      creep.moveTo(new RoomPosition(25, 25, homeRoom), {
        reusePath: 20,
        visualizePathStyle: { stroke: "#66ccff" },
      });
      return;
    }

    var energyTarget = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: function (s) {
        return (
          (s.structureType === STRUCTURE_SPAWN ||
            s.structureType === STRUCTURE_EXTENSION) &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });

    if (energyTarget) {
      if (creep.transfer(energyTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(energyTarget, {
          reusePath: 10,
          visualizePathStyle: { stroke: "#66ccff" },
        });
      }
      return;
    }

    var storage = creep.room.storage;
    if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
      if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(storage, {
          reusePath: 10,
          visualizePathStyle: { stroke: "#66ccff" },
        });
      }
      return;
    }

    var container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });

    if (container) {
      if (creep.transfer(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(container, {
          reusePath: 10,
          visualizePathStyle: { stroke: "#66ccff" },
        });
      }
      return;
    }

    if (creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller, {
          reusePath: 10,
          visualizePathStyle: { stroke: "#66ccff" },
        });
      }
    }
  },
};
