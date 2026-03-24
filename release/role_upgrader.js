const utils = require("utils");

const MOVE_OPTIONS = {
  reusePath: 10,
};

module.exports = {
  run(creep, options) {
    const thinkInterval =
      options && options.thinkInterval ? options.thinkInterval : 1;

    delete creep.memory.targetId;
    delete creep.memory.overrideMove;

    if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.upgrading = false;
      delete creep.memory.withdrawTargetId;
    }

    if (!creep.memory.upgrading && creep.store.getFreeCapacity() === 0) {
      creep.memory.upgrading = true;
      delete creep.memory.withdrawTargetId;
    }

    if (!creep.memory.upgrading) {
      const target = this.getWithdrawalTarget(creep, thinkInterval);
      if (!target) return;

      if (
        target.structureType === STRUCTURE_STORAGE ||
        target.structureType === STRUCTURE_CONTAINER
      ) {
        if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, MOVE_OPTIONS);
        }
        return;
      }

      if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, MOVE_OPTIONS);
      }
      return;
    }

    if (!creep.room.controller) return;

    if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(creep.room.controller, {
        reusePath: 8,
        range: 3,
      });
    }
  },

  getWithdrawalTarget(creep, thinkInterval) {
    const cached = this.getCachedWithdrawalTarget(creep);

    if (cached && !this.shouldThink(creep, thinkInterval, "upgraderWithdraw")) {
      return cached;
    }

    const target = utils.getGeneralEnergyWithdrawalTarget(creep.room, creep);

    if (target && target.id) {
      creep.memory.withdrawTargetId = target.id;
    } else {
      delete creep.memory.withdrawTargetId;
    }

    return target;
  },

  getCachedWithdrawalTarget(creep) {
    if (!creep.memory.withdrawTargetId) return null;

    const target = Game.getObjectById(creep.memory.withdrawTargetId);
    if (!target) {
      delete creep.memory.withdrawTargetId;
      return null;
    }

    if (
      (target.structureType === STRUCTURE_STORAGE ||
        target.structureType === STRUCTURE_CONTAINER) &&
      (target.store[RESOURCE_ENERGY] || 0) <= 0
    ) {
      delete creep.memory.withdrawTargetId;
      return null;
    }

    if (target.energy !== undefined && target.energy <= 0) {
      delete creep.memory.withdrawTargetId;
      return null;
    }

    return target;
  },

  shouldThink(creep, interval, key) {
    if (interval <= 1) return true;

    const memoryKey = key + "ThinkAt";
    if (!creep.memory[memoryKey] || Game.time >= creep.memory[memoryKey]) {
      creep.memory[memoryKey] = Game.time + interval;
      return true;
    }

    return false;
  },
};
