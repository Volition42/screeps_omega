/*
Developer Summary:
Remote Hauler

Phase 2 remote logistics role.

Purpose:
- Pull energy from remote source containers
- Return it to the home room
- Deliver using the existing home-room hauler priority logic

Important Notes:
- This role stays source-assigned to preserve configurable hauler counts
- Pickup remains remote-container-first; it does not source from home storage
*/

const utils = require("utils");

const MOVE_OPTIONS = {
  reusePath: 20,
};

module.exports = {
  run(creep, options) {
    var targetRoom = creep.memory.targetRoom;
    var homeRoom = creep.memory.homeRoom || creep.memory.room;
    var sourceId = creep.memory.sourceId;
    var thinkInterval =
      options && options.thinkInterval ? options.thinkInterval : 1;
    if (!targetRoom || !homeRoom || !sourceId) return;

    if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.delivering = false;
    }

    if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
      creep.memory.delivering = true;
    }

    if (!creep.memory.delivering) {
      this.runPickup(creep, targetRoom, sourceId);
      return;
    }

    this.runDelivery(creep, homeRoom, thinkInterval);
  },

  runPickup(creep, targetRoom, sourceId) {
    if (creep.room.name !== targetRoom) {
      this.moveToRoom(creep, targetRoom, "#e7fcff");
      return;
    }

    var container = utils.getSourceContainerBySource(creep.room, sourceId);
    if (
      container &&
      (container.store[RESOURCE_ENERGY] || 0) > 0
    ) {
      if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(container, MOVE_OPTIONS);
      }
      return;
    }

    var source = Game.getObjectById(sourceId);
    var dropped = null;

    if (source) {
      dropped = source.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
        filter: function (resource) {
          return resource.resourceType === RESOURCE_ENERGY && resource.amount > 0;
        },
      });
    }

    if (dropped) {
      if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) {
        creep.moveTo(dropped, MOVE_OPTIONS);
      }
      return;
    }

    if (source && creep.pos.getRangeTo(source) > 2) {
      creep.moveTo(source, MOVE_OPTIONS);
    }
  },

  runDelivery(creep, homeRoom, thinkInterval) {
    if (creep.room.name !== homeRoom) {
      this.moveToRoom(creep, homeRoom, "#66ccff");
      return;
    }

    var target = this.getDeliveryTarget(creep, thinkInterval);
    if (target) {
      if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, MOVE_OPTIONS);
      }
      return;
    }

    if (creep.room.storage && creep.pos.getRangeTo(creep.room.storage) > 1) {
      creep.moveTo(creep.room.storage, MOVE_OPTIONS);
    }
  },

  getDeliveryTarget(creep, thinkInterval) {
    var cached = this.getCachedDeliveryTarget(creep);

    if (cached && !this.shouldThink(creep, thinkInterval, "remoteHaulerDelivery")) {
      return cached;
    }

    var target = utils.getHaulerDeliveryTarget(creep.room, creep);

    if (target && target.id) {
      creep.memory.deliveryTargetId = target.id;
    } else {
      delete creep.memory.deliveryTargetId;
    }

    return target;
  },

  getCachedDeliveryTarget(creep) {
    if (!creep.memory.deliveryTargetId) return null;

    var target = Game.getObjectById(creep.memory.deliveryTargetId);
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

    var memoryKey = key + "ThinkAt";
    if (!creep.memory[memoryKey] || Game.time >= creep.memory[memoryKey]) {
      creep.memory[memoryKey] = Game.time + interval;
      return true;
    }

    return false;
  },

  moveToRoom(creep, roomName, stroke) {
    creep.moveTo(new RoomPosition(25, 25, roomName), {
      reusePath: 50,
      range: 20,
      visualizePathStyle: { stroke: stroke },
    });
  },
};
