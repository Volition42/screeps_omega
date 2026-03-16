/*
Developer Summary:
Repair Role

Purpose:
- Withdraw energy from shared colony buffers
- Maintain critical infrastructure and defenses
- Build when repair pressure is low
- Upgrade as final fallback

Withdrawal priority:
- storage
- source containers
- harvest source as fallback

Important Notes:
- Miners and upgraders are unchanged
- Repairers now follow the same withdrawal order as workers
*/

const config = require("config");
const utils = require("utils");

const MOVE_OPTIONS = {
  reusePath: 10,
};

module.exports = {
  run(creep) {
    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
      delete creep.memory.withdrawTargetId;
      delete creep.memory.workTargetId;
      delete creep.memory.workTargetKind;
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
          creep.moveTo(target, MOVE_OPTIONS);
        }
        return;
      }

      if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, MOVE_OPTIONS);
      }

      return;
    }

    const workTarget = this.getWorkTarget(creep);
    if (!workTarget) return;

    this.runWorkTarget(creep, workTarget);
  },

  getWorkTarget(creep) {
    const cached = this.getCachedWorkTarget(creep);
    if (cached) return cached;

    return this.findWorkTarget(creep);
  },

  getCachedWorkTarget(creep) {
    const targetId = creep.memory.workTargetId;
    const kind = creep.memory.workTargetKind;
    if (!targetId || !kind) return null;

    const target =
      kind === "upgrade"
        ? creep.room.controller
        : Game.getObjectById(targetId);

    if (!this.isValidWorkTarget(target, kind)) {
      delete creep.memory.workTargetId;
      delete creep.memory.workTargetKind;
      return null;
    }

    return {
      target: target,
      kind: kind,
    };
  },

  findWorkTarget(creep) {
    const criticalContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          s.hits < s.hitsMax * config.REPAIR.criticalContainerThreshold
        );
      },
    });

    if (criticalContainer) {
      return this.storeWorkTarget(creep, criticalContainer, "criticalRepair");
    }

    const importantRepairTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (s) {
        if (s.structureType === STRUCTURE_ROAD) return false;
        if (s.structureType === STRUCTURE_WALL) return false;
        if (s.structureType === STRUCTURE_RAMPART) return false;

        if (s.structureType === STRUCTURE_CONTAINER) {
          return s.hits < s.hitsMax * config.REPAIR.importantThreshold;
        }

        if (
          s.structureType === STRUCTURE_EXTENSION ||
          s.structureType === STRUCTURE_SPAWN ||
          s.structureType === STRUCTURE_TOWER
        ) {
          return s.hits < s.hitsMax * config.REPAIR.spawnExtensionThreshold;
        }

        return false;
      },
    });

    if (importantRepairTarget) {
      return this.storeWorkTarget(creep, importantRepairTarget, "importantRepair");
    }

    const lowRampart = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_RAMPART &&
          s.hits < config.REPAIR.rampartMinHits
        );
      },
    });

    if (lowRampart) {
      return this.storeWorkTarget(creep, lowRampart, "rampartRepair");
    }

    const lowWall = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_WALL &&
          s.hits < config.REPAIR.wallMinHits
        );
      },
    });

    if (lowWall) {
      return this.storeWorkTarget(creep, lowWall, "wallRepair");
    }

    const roadRepairTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_ROAD &&
          s.hits < s.hitsMax * config.REPAIR.roadThreshold
        );
      },
    });

    if (roadRepairTarget) {
      return this.storeWorkTarget(creep, roadRepairTarget, "roadRepair");
    }

    const site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    if (site) {
      return this.storeWorkTarget(creep, site, "build");
    }

    if (creep.room.controller) {
      return this.storeWorkTarget(creep, creep.room.controller, "upgrade");
    }

    return null;
  },

  storeWorkTarget(creep, target, kind) {
    creep.memory.workTargetId = target.id;
    creep.memory.workTargetKind = kind;

    return {
      target: target,
      kind: kind,
    };
  },

  isValidWorkTarget(target, kind) {
    if (!target) return false;

    switch (kind) {
      case "criticalRepair":
        return (
          target.structureType === STRUCTURE_CONTAINER &&
          target.hits < target.hitsMax * config.REPAIR.criticalContainerThreshold
        );
      case "importantRepair":
        if (target.structureType === STRUCTURE_CONTAINER) {
          return target.hits < target.hitsMax * config.REPAIR.importantThreshold;
        }

        return (
          (target.structureType === STRUCTURE_EXTENSION ||
            target.structureType === STRUCTURE_SPAWN ||
            target.structureType === STRUCTURE_TOWER) &&
          target.hits < target.hitsMax * config.REPAIR.spawnExtensionThreshold
        );
      case "rampartRepair":
        return (
          target.structureType === STRUCTURE_RAMPART &&
          target.hits < config.REPAIR.rampartMinHits
        );
      case "wallRepair":
        return (
          target.structureType === STRUCTURE_WALL &&
          target.hits < config.REPAIR.wallMinHits
        );
      case "roadRepair":
        return (
          target.structureType === STRUCTURE_ROAD &&
          target.hits < target.hitsMax * config.REPAIR.roadThreshold
        );
      case "build":
        return target.progress !== undefined && target.progress < target.progressTotal;
      case "upgrade":
        return !!target;
      default:
        return false;
    }
  },

  runWorkTarget(creep, workTarget) {
    if (workTarget.kind === "build") {
      if (creep.build(workTarget.target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(workTarget.target, MOVE_OPTIONS);
      }
      return;
    }

    if (workTarget.kind === "upgrade") {
      if (creep.upgradeController(workTarget.target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(workTarget.target, MOVE_OPTIONS);
      }
      return;
    }

    if (creep.repair(workTarget.target) === ERR_NOT_IN_RANGE) {
      creep.moveTo(workTarget.target, MOVE_OPTIONS);
    }
  },
};
