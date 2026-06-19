/*
Developer Summary:
Worker Role

Purpose:
- Withdraw energy from shared colony buffers
- Fill spawn first
- Build second
- Upgrade controller last

Withdrawal priority:
- dropped energy
- storage
- source containers
- harvest source as fallback

Important Notes:
- Workers pull from the shared room energy buffers
- Shared helper keeps worker energy logic aligned with repair creeps
*/

const reservePolicy = require("economy_reserve_policy");
const logisticsManager = require("logistics_manager");
const roleIntentDiagnostics = require("role_intent_diagnostics");
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

const ROOM_TRAVEL_OPTIONS = {
  reusePath: 30,
  range: 20,
};

const CRITICAL_CONSTRUCTION_PRIORITY = {
  spawn: 1,
  tower: 2,
  extension: 3,
  storage: 4,
  container: 5,
};

const CONSTRUCTION_PRIORITY = {
  spawn: 1,
  tower: 2,
  storage: 3,
  extension: 4,
  container: 5,
  link: 6,
  terminal: 7,
  road: 8,
  rampart: 9,
  constructedWall: 10,
};

module.exports = {
  run(creep, options) {
    var thinkInterval =
      options && options.thinkInterval ? options.thinkInterval : 1;

    if (this.travelToSupportTarget(creep)) {
      return;
    }

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
      let target = this.getWithdrawalTarget(creep, thinkInterval);

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

      if (target.resourceType === RESOURCE_ENERGY) {
        utils.clearAssignedHarvestPosition(creep);
        if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
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

    if (this.isRoomEnergyDeliveryTarget(workTarget)) {
      if (creep.transfer(workTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, workTarget, MOVE_OPTIONS);
      }
      return;
    }

    if (this.isReserveBankDeliveryTarget(workTarget)) {
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

  travelToSupportTarget(creep) {
    const targetRoom = creep.memory && creep.memory.targetRoom;
    if (!targetRoom || targetRoom === creep.room.name) return false;

    creep.memory.working = false;
    delete creep.memory.withdrawTargetId;
    delete creep.memory.workTargetId;
    utils.clearAssignedHarvestPosition(creep);
    utils.moveTo(
      creep,
      new RoomPosition(25, 25, targetRoom),
      ROOM_TRAVEL_OPTIONS,
    );
    return true;
  },

  getWithdrawalTarget(creep, thinkInterval) {
    const state = this.getRuntimeState(creep.room);
    let target = this.getCachedWithdrawalTarget(creep);
    const hasConstruction = !!(state && state.sites && state.sites.length > 0);

    if (target && hasConstruction && this.shouldThink(creep, 1, "workerWithdraw")) {
      delete creep.memory.withdrawTargetId;
      target = null;
    }

    if (!target) {
      if (hasConstruction && reservePolicy.shouldBankStorageEnergy(creep.room, state)) {
        roleIntentDiagnostics.recordDeferred(
          creep.room,
          "construction-reserve-pressure",
        );
      }

      const bankingReserve = reservePolicy.shouldBankStorageEnergy(creep.room, state);
      target = this.getClosestEnergyTarget(creep, state, bankingReserve) ||
        (bankingReserve
        ? this.getReserveWithdrawalTarget(creep, state)
        : utils.getGeneralEnergyWithdrawalTarget(creep.room, creep));

      if (target && target.energy !== undefined && target.pos) {
        target = utils.getBalancedHarvestSource(creep) || target;
      }

      if (target && target.id) {
        creep.memory.withdrawTargetId = target.id;
      } else {
        delete creep.memory.withdrawTargetId;
      }
    }

    return target;
  },

  getClosestEnergyTarget(creep, state, bankingReserve) {
    const candidates = [];

    const droppedEnergy =
      state && state.droppedEnergy
        ? state.droppedEnergy
        : creep.room.find(FIND_DROPPED_RESOURCES, {
            filter: function (resource) {
              return resource.resourceType === RESOURCE_ENERGY;
            },
          });
    for (let i = 0; i < droppedEnergy.length; i++) {
      const resource = droppedEnergy[i];
      if (
        resource &&
        resource.resourceType === RESOURCE_ENERGY &&
        (resource.amount || 0) > 0 &&
        resource.pos &&
        resource.pos.roomName === creep.room.name
      ) {
        candidates.push(resource);
      }
    }

    const storage = creep.room.storage || null;
    if (
      storage &&
      !bankingReserve &&
      (storage.store[RESOURCE_ENERGY] || 0) > 0
    ) {
      candidates.push(storage);
    }

    const containers = [];
    if (state && state.hubContainer) containers.push(state.hubContainer);
    if (state && state.sourceContainers) {
      for (let sourceIndex = 0; sourceIndex < state.sourceContainers.length; sourceIndex++) {
        containers.push(state.sourceContainers[sourceIndex]);
      }
    }

    for (let containerIndex = 0; containerIndex < containers.length; containerIndex++) {
      const container = containers[containerIndex];
      if (
        container &&
        container.store &&
        (container.store[RESOURCE_ENERGY] || 0) > 0 &&
        container.pos &&
        container.pos.roomName === creep.room.name
      ) {
        candidates.push(container);
      }
    }

    if (candidates.length <= 0) return null;

    return creep.pos.findClosestByPath(candidates) ||
      creep.pos.findClosestByRange(candidates);
  },

  getWorkTarget(creep, thinkInterval) {
    const state = this.getRuntimeState(creep.room);
    const cached = this.getCachedWorkTarget(creep);

    if (cached && !this.shouldThink(creep, thinkInterval, "workerWork")) {
      return cached;
    }

    const bankingReserve = reservePolicy.shouldBankStorageEnergy(creep.room, state);

    let target = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_SPAWN &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });

    if (!target && !this.hasRoomHauler(creep.room, state)) {
      target = logisticsManager.getExtensionDeliveryTarget(creep.room, creep);
    }

    if (!target && bankingReserve) {
      target = this.getConstructionTarget(creep, state, {
        pressureOnly: true,
      });
    }

    if (!target && bankingReserve) {
      target = utils.getStorageDeliveryTarget(creep.room);
    }

    if (!target) {
      target = this.getConstructionTarget(creep, state);
    }

    if (!target && bankingReserve) {
      target = utils.getStorageDeliveryTarget(creep.room);
    }

    this.storeWorkTarget(creep, target);
    return target;
  },

  getRuntimeState(room) {
    const cache = room ? utils.getRoomRuntimeCache(room) : null;
    return cache && cache.state ? cache.state : null;
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

    if (
      target.resourceType === RESOURCE_ENERGY &&
      (
        !target.pos ||
        target.pos.roomName !== creep.room.name ||
        (target.amount || 0) <= 0
      )
    ) {
      delete creep.memory.withdrawTargetId;
      return null;
    }

    if (
      target.energy !== undefined &&
      (
        !target.pos ||
        target.pos.roomName !== creep.room.name ||
        target.energy <= 0
      )
    ) {
      delete creep.memory.withdrawTargetId;
      return null;
    }

    if (
      target.structureType === STRUCTURE_STORAGE &&
      reservePolicy.shouldBankStorageEnergy(
        creep.room,
        this.getRuntimeState(creep.room),
      )
    ) {
      delete creep.memory.withdrawTargetId;
      return null;
    }

    return target;
  },

  getCachedWorkTarget(creep) {
    if (!creep.memory.workTargetId) return null;

    const target = Game.getObjectById(creep.memory.workTargetId);
    if (!target) {
      delete creep.memory.workTargetId;
      return null;
    }

    if (target.progressTotal !== undefined) {
      if (
        target.progress >= target.progressTotal ||
        !this.isConstructionAllowed(
          creep.room,
          this.getRuntimeState(creep.room),
          target,
        )
      ) {
        roleIntentDiagnostics.recordStaleRelease(
          creep.room,
          "cached-invalid-target",
        );
        if (
          target.progress < target.progressTotal &&
          reservePolicy.shouldBankStorageEnergy(
            creep.room,
            this.getRuntimeState(creep.room),
          )
        ) {
          roleIntentDiagnostics.recordDeferred(
            creep.room,
            "construction-reserve-pressure",
          );
        }
        delete creep.memory.workTargetId;
        return null;
      }
    }

    if (
      this.isRoomEnergyDeliveryTarget(target) &&
      target.store.getFreeCapacity(RESOURCE_ENERGY) <= 0
    ) {
      delete creep.memory.workTargetId;
      return null;
    }

    if (
      target.structureType === STRUCTURE_STORAGE &&
      (
        !reservePolicy.shouldBankStorageEnergy(
          creep.room,
          this.getRuntimeState(creep.room),
        ) ||
        target.store.getFreeCapacity(RESOURCE_ENERGY) <= 0
      )
    ) {
      delete creep.memory.workTargetId;
      return null;
    }

    return target;
  },

  getConstructionTarget(creep, state, options) {
    const settings = options || {};
    const sites =
      state && state.sites
        ? state.sites
        : creep.room.find(FIND_CONSTRUCTION_SITES);
    const candidates = [];

    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];
      if (!site || site.progress >= site.progressTotal) continue;
      if (
        settings.pressureOnly &&
        !this.isCriticalConstructionSite(site)
      ) {
        continue;
      }
      candidates.push(site);
    }

    return this.pickStableTarget(creep, candidates, function (site) {
      if (settings.pressureOnly) {
        return CRITICAL_CONSTRUCTION_PRIORITY[site.structureType] || 100;
      }
      return CONSTRUCTION_PRIORITY[site.structureType] || 100;
    });
  },

  isConstructionAllowed(room, state, site) {
    if (!site || site.progress >= site.progressTotal) return false;
    if (!reservePolicy.shouldBankStorageEnergy(room, state)) return true;

    return this.isCriticalConstructionSite(site);
  },

  isCriticalConstructionSite(site) {
    return !!(
      site &&
      Object.prototype.hasOwnProperty.call(
        CRITICAL_CONSTRUCTION_PRIORITY,
        site.structureType,
      )
    );
  },

  pickStableTarget(creep, targets, priorityFn) {
    if (!targets || targets.length === 0) return null;

    const scored = targets.slice();
    scored.sort(function (a, b) {
      const aPriority = priorityFn ? priorityFn(a) : 0;
      const bPriority = priorityFn ? priorityFn(b) : 0;
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aRange = creep.pos.getRangeTo(a);
      const bRange = creep.pos.getRangeTo(b);
      if (aRange !== bRange) return aRange - bRange;

      if (a.pos.y !== b.pos.y) return a.pos.y - b.pos.y;
      if (a.pos.x !== b.pos.x) return a.pos.x - b.pos.x;

      return String(a.id || "").localeCompare(String(b.id || ""));
    });

    return scored[0];
  },

  isRoomEnergyDeliveryTarget(target) {
    return !!(
      target &&
      (
        target.structureType === STRUCTURE_SPAWN ||
        target.structureType === STRUCTURE_EXTENSION
      ) &&
      target.store &&
      typeof target.store.getFreeCapacity === "function"
    );
  },

  isReserveBankDeliveryTarget(target) {
    return !!(
      target &&
      target.structureType === STRUCTURE_STORAGE &&
      target.store &&
      typeof target.store.getFreeCapacity === "function" &&
      target.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    );
  },

  hasRoomHauler(room, state) {
    const creeps = state && state.creeps ? state.creeps : room.find(FIND_MY_CREEPS);

    for (let i = 0; i < creeps.length; i++) {
      const creep = creeps[i];
      if (creep.memory && creep.memory.role === "hauler") {
        return true;
      }
    }

    return false;
  },

  getReserveWithdrawalTarget(creep, state) {
    const droppedEnergy = logisticsManager.getDroppedEnergyTarget(
      creep.room,
      creep,
      state,
    );
    if (droppedEnergy) {
      return droppedEnergy;
    }

    const hubContainer = logisticsManager.getHubContainerEnergyTarget(state);
    if (hubContainer) {
      return hubContainer;
    }

    const sourceContainer = logisticsManager.getBalancedSourceContainer(
      state,
      creep,
    );
    if (sourceContainer) {
      return sourceContainer;
    }

    // Prefer staged buffers first so haulers can keep room energy flow smooth,
    // but do not leave builders stranded on direct harvest when storage already
    // has energy available.
    const storage = logisticsManager.getStorageEnergyTarget(creep.room);
    if (storage) {
      return storage;
    }

    let source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
    if (!source) {
      source = creep.pos.findClosestByRange(FIND_SOURCES);
    }

    return source;
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
