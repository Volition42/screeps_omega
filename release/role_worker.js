/*
Developer Summary:
Worker Role

Purpose:
- Withdraw energy from shared colony buffers
- Fill spawn first
- Build second
- Upgrade controller last

Withdrawal priority:
- storage
- source containers
- harvest source as fallback

Important Notes:
- Workers pull from the shared room energy buffers
- Shared helper keeps worker energy logic aligned with repair creeps
*/

const utils = require("utils");

const MOVE_OPTIONS = {
  reusePath: 10,
};

const INTERACT_MOVE_OPTIONS = {
  reusePath: 10,
  range: 1,
};

const HARVEST_SPOT_MOVE_OPTIONS = {
  reusePath: 10,
  range: 0,
};

module.exports = {
  run(creep, options) {
    var thinkInterval =
      options && options.thinkInterval ? options.thinkInterval : 1;

    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
      delete creep.memory.withdrawTargetId;
      delete creep.memory.workTargetId;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
      delete creep.memory.withdrawTargetId;
      delete creep.memory.workTargetId;
      utils.clearAssignedHarvestPosition(creep);
    }

    if (!creep.memory.working) {
      let target = null;

      if (creep.memory.withdrawTargetId) {
        target = Game.getObjectById(creep.memory.withdrawTargetId);

        if (
          !target ||
          ((target.structureType === STRUCTURE_STORAGE ||
            target.structureType === STRUCTURE_CONTAINER) &&
            (target.store[RESOURCE_ENERGY] || 0) <= 0)
        ) {
          target = null;
          delete creep.memory.withdrawTargetId;
        }
      }

      if (!target) {
        target = utils.getGeneralEnergyWithdrawalTarget(creep.room, creep);

        if (target && target.id) {
          creep.memory.withdrawTargetId = target.id;
        } else {
          delete creep.memory.withdrawTargetId;
        }
      }

      if (!target) return;

      if (
        target.structureType === STRUCTURE_STORAGE ||
        target.structureType === STRUCTURE_CONTAINER
      ) {
        utils.clearAssignedHarvestPosition(creep);
        if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          utils.moveTo(creep, target, MOVE_OPTIONS);
        }
        return;
      }

      if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
        const harvestPos = utils.getAssignedHarvestPosition(creep, target);
        utils.moveTo(
          creep,
          harvestPos || target.pos,
          harvestPos
            ? HARVEST_SPOT_MOVE_OPTIONS
            : INTERACT_MOVE_OPTIONS,
        );
      }

      return;
    }

    const workTarget = this.getWorkTarget(creep, thinkInterval);

    if (workTarget && workTarget.structureType === STRUCTURE_SPAWN) {
      if (creep.transfer(workTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, workTarget, MOVE_OPTIONS);
      }
      return;
    }

    if (workTarget && workTarget.progressTotal !== undefined) {
      if (creep.build(workTarget) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, workTarget, MOVE_OPTIONS);
      }
      return;
    }

    if (creep.room.controller) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, creep.room.controller.pos, INTERACT_MOVE_OPTIONS);
      }
    }
  },

  getWorkTarget(creep, thinkInterval) {
    const cached = this.getCachedWorkTarget(creep);

    if (cached && !this.shouldThink(creep, thinkInterval, "workerWork")) {
      return cached;
    }

    let target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_SPAWN &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });

    if (!target) {
      target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    }

    this.storeWorkTarget(creep, target);
    return target;
  },

  getCachedWorkTarget(creep) {
    if (!creep.memory.workTargetId) return null;

    const target = Game.getObjectById(creep.memory.workTargetId);
    if (!target) {
      delete creep.memory.workTargetId;
      return null;
    }

    if (
      target.structureType === STRUCTURE_SPAWN &&
      target.store.getFreeCapacity(RESOURCE_ENERGY) <= 0
    ) {
      delete creep.memory.workTargetId;
      return null;
    }

    return target;
  },

  storeWorkTarget(creep, target) {
    if (target && target.id) {
      creep.memory.workTargetId = target.id;
      return;
    }

    delete creep.memory.workTargetId;
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
