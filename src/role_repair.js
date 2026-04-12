/*
Developer Summary:
Repair Role

Purpose:
- Withdraw energy from shared colony buffers
- Maintain critical infrastructure and defenses
- Build when repair pressure is low
- Upgrade as final fallback

Withdrawal priority:
- dropped energy
- storage
- source containers
- harvest source as fallback

Important Notes:
- Miners and upgraders are unchanged
- Repairers now follow the same withdrawal order as workers
*/

const config = require("config");
const reservePolicy = require("economy_reserve_policy");
const utils = require("utils");

const MOVE_OPTIONS = {
  reusePath: 10,
};

const INTERACT_MOVE_OPTIONS = {
  reusePath: 10,
  range: 1,
};

module.exports = {
  run(creep) {
    const state = this.getRuntimeState(creep.room);

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
          (
            target.resourceType === RESOURCE_ENERGY &&
            (
              !target.pos ||
              target.pos.roomName !== creep.room.name ||
              (target.amount || 0) <= 0
            )
          ) ||
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
          utils.moveTo(creep, target, MOVE_OPTIONS);
        }
        return;
      }

      if (target.resourceType === RESOURCE_ENERGY) {
        if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
          utils.moveTo(creep, target, MOVE_OPTIONS);
        }
        return;
      }

      if (creep.harvest(target) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, target.pos, INTERACT_MOVE_OPTIONS);
      }

      return;
    }

    const workTarget = this.getWorkTarget(creep);
    if (!workTarget) return;

    if (
      workTarget.kind === "upgrade" &&
      reservePolicy.shouldBankStorageEnergy(creep.room, state)
    ) {
      this.runReserveHold(creep);
      return;
    }

    this.runWorkTarget(creep, workTarget);
  },

  getRuntimeState(room) {
    const cache = room ? utils.getRoomRuntimeCache(room) : null;
    return cache && cache.state ? cache.state : null;
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
    // Developer note:
    // Preserve the existing repair priority order, but prefilter candidate
    // groups once per room/tick so first acquisition avoids repeated full-room
    // structure scans.
    const groups = utils.getRepairTargetGroups(creep.room);
    const criticalContainer = this.findClosestTarget(
      creep,
      groups.criticalContainers,
    );

    if (criticalContainer) {
      return this.storeWorkTarget(creep, criticalContainer, "criticalRepair");
    }

    const importantRepairTarget = this.findClosestTarget(
      creep,
      groups.importantStructures,
    );

    if (importantRepairTarget) {
      return this.storeWorkTarget(creep, importantRepairTarget, "importantRepair");
    }

    const lowRampart = this.findClosestTarget(creep, groups.lowRamparts);

    if (lowRampart) {
      return this.storeWorkTarget(creep, lowRampart, "rampartRepair");
    }

    const lowWall = this.findClosestTarget(creep, groups.lowWalls);

    if (lowWall) {
      return this.storeWorkTarget(creep, lowWall, "wallRepair");
    }

    const roadRepairTarget = this.findClosestTarget(creep, groups.roadRepairs);

    if (roadRepairTarget) {
      return this.storeWorkTarget(creep, roadRepairTarget, "roadRepair");
    }

    const site = this.findClosestTarget(creep, groups.sites);
    if (site) {
      return this.storeWorkTarget(creep, site, "build");
    }

    if (creep.room.controller) {
      return this.storeWorkTarget(creep, creep.room.controller, "upgrade");
    }

    return null;
  },

  findClosestTarget(creep, targets) {
    if (!targets || targets.length === 0) return null;
    return creep.pos.findClosestByPath(targets);
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

    const defenseTargets =
      target.room && target.room.name
        ? utils.getDefenseMaintenanceTargets(target.room)
        : {
            rampartMinHits: config.REPAIR.rampartMinHits,
            wallMinHits: config.REPAIR.wallMinHits,
          };

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
          target.hits < defenseTargets.rampartMinHits
        );
      case "wallRepair":
        return (
          target.structureType === STRUCTURE_WALL &&
          target.hits < defenseTargets.wallMinHits
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
        utils.moveTo(creep, workTarget.target, MOVE_OPTIONS);
      }
      return;
    }

    if (workTarget.kind === "upgrade") {
      if (creep.upgradeController(workTarget.target) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, workTarget.target.pos, INTERACT_MOVE_OPTIONS);
      }
      return;
    }

    if (creep.repair(workTarget.target) === ERR_NOT_IN_RANGE) {
      utils.moveTo(creep, workTarget.target, MOVE_OPTIONS);
    }
  },

  runReserveHold(creep) {
    creep.memory.working = false;
    delete creep.memory.withdrawTargetId;
    delete creep.memory.workTargetId;
    delete creep.memory.workTargetKind;

    if (!creep.room.storage) return;

    if ((creep.store[RESOURCE_ENERGY] || 0) > 0) {
      if (creep.transfer(creep.room.storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, creep.room.storage, MOVE_OPTIONS);
      }
      return;
    }

    if (creep.pos.getRangeTo(creep.room.storage) > 2) {
      utils.moveTo(creep, creep.room.storage, {
        reusePath: 8,
        range: 2,
      });
    }
  },
};
