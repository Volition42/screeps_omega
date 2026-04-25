/*
Developer Summary:
Reserved Room Remote Hauler

Purpose:
- Withdraw energy from reserved-room source containers
- Return energy to the parent room using normal home delivery priorities
- Keep targeting cheap through cached creep memory
*/

const utils = require("utils");

const ROOM_TRAVEL_OPTIONS = {
  reusePath: 30,
  range: 20,
};

const MOVE_OPTIONS = {
  reusePath: 12,
};

module.exports = {
  run(creep) {
    const homeRoom = creep.memory.homeRoom || creep.memory.room;
    const targetRoom = creep.memory.targetRoom;
    if (!homeRoom || !targetRoom) return;

    if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.delivering = false;
      delete creep.memory.pickupTargetId;
      delete creep.memory.pickupTargetKind;
      delete creep.memory.deliveryTargetId;
    }

    if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
      creep.memory.delivering = true;
      delete creep.memory.pickupTargetId;
      delete creep.memory.pickupTargetKind;
      delete creep.memory.deliveryTargetId;
    }

    if (creep.memory.delivering) {
      this.deliver(creep, homeRoom);
      return;
    }

    if (creep.room.name !== targetRoom) {
      utils.moveTo(
        creep,
        new RoomPosition(25, 25, targetRoom),
        ROOM_TRAVEL_OPTIONS,
      );
      return;
    }

    const pickup = this.getPickupTarget(creep);
    if (!pickup) return;

    if (pickup.kind === "pickup") {
      if (creep.pickup(pickup.target) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, pickup.target, MOVE_OPTIONS);
      }
      return;
    }

    if (creep.withdraw(pickup.target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
      utils.moveTo(creep, pickup.target, MOVE_OPTIONS);
    }
  },

  deliver(creep, homeRoomName) {
    if (creep.room.name !== homeRoomName) {
      utils.moveTo(
        creep,
        new RoomPosition(25, 25, homeRoomName),
        ROOM_TRAVEL_OPTIONS,
      );
      return;
    }

    const storage = creep.room.storage;
    if (
      storage &&
      storage.store &&
      storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    ) {
      delete creep.memory.deliveryTargetId;
      if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, storage, MOVE_OPTIONS);
      }
      return;
    }

    const target = this.getDeliveryTarget(creep);
    if (target) {
      if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, target, MOVE_OPTIONS);
      }
      return;
    }

    if (creep.room.storage && creep.pos.getRangeTo(creep.room.storage) > 1) {
      utils.moveTo(creep, creep.room.storage, MOVE_OPTIONS);
    }
  },

  getPickupTarget(creep) {
    const cached = this.getCachedPickupTarget(creep);
    if (cached) return cached;

    const target = this.findPickupTarget(creep);
    if (target && target.target && target.target.id) {
      creep.memory.pickupTargetId = target.target.id;
      creep.memory.pickupTargetKind = target.kind;
    }

    return target;
  },

  getCachedPickupTarget(creep) {
    if (!creep.memory.pickupTargetId || !creep.memory.pickupTargetKind) {
      return null;
    }

    const target = Game.getObjectById(creep.memory.pickupTargetId);
    const kind = creep.memory.pickupTargetKind;

    if (
      (kind === "pickup" && (!target || target.amount <= 0)) ||
      (kind === "withdraw" &&
        (!target || !target.store || (target.store[RESOURCE_ENERGY] || 0) <= 0))
    ) {
      delete creep.memory.pickupTargetId;
      delete creep.memory.pickupTargetKind;
      return null;
    }

    return {
      target: target,
      kind: kind,
    };
  },

  findPickupTarget(creep) {
    const assigned = Game.getObjectById(creep.memory.targetId);
    if (assigned && assigned.store && (assigned.store[RESOURCE_ENERGY] || 0) > 0) {
      return {
        target: assigned,
        kind: "withdraw",
      };
    }

    const sourceId = creep.memory.sourceId;
    const source = sourceId ? Game.getObjectById(sourceId) : null;
    const containers = creep.room.find(FIND_STRUCTURES, {
      filter: function (structure) {
        return (
          structure.structureType === STRUCTURE_CONTAINER &&
          structure.store &&
          (structure.store[RESOURCE_ENERGY] || 0) > 0 &&
          (!source || structure.pos.getRangeTo(source) <= 1)
        );
      },
    });

    if (containers.length > 0) {
      return {
        target: creep.pos.findClosestByPath(containers) || containers[0],
        kind: "withdraw",
      };
    }

    const dropped = creep.room.find(FIND_DROPPED_RESOURCES, {
      filter: function (resource) {
        return resource.resourceType === RESOURCE_ENERGY && resource.amount > 0;
      },
    });
    if (dropped.length > 0) {
      return {
        target: creep.pos.findClosestByPath(dropped) || dropped[0],
        kind: "pickup",
      };
    }

    return null;
  },

  getDeliveryTarget(creep) {
    const cached = this.getCachedDeliveryTarget(creep);
    if (cached) return cached;

    const target = utils.getHaulerDeliveryTarget(creep.room, creep);
    if (target && target.id) {
      creep.memory.deliveryTargetId = target.id;
    }

    return target;
  },

  getCachedDeliveryTarget(creep) {
    if (!creep.memory.deliveryTargetId) return null;

    const target = Game.getObjectById(creep.memory.deliveryTargetId);
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
};
