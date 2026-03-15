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
- Workers no longer prefer controller containers for withdrawal
- Shared helper keeps worker energy logic aligned with repair creeps
*/

const utils = require("utils");

module.exports = {
  run(creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
      delete creep.memory.withdrawTargetId;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
      delete creep.memory.withdrawTargetId;
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
        if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target);
        }
        return;
      }

      if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target);
      }

      return;
    }

    const spawnTarget = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_SPAWN &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });

    if (spawnTarget) {
      if (creep.transfer(spawnTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(spawnTarget);
      }
      return;
    }

    const site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) {
        creep.moveTo(site);
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
