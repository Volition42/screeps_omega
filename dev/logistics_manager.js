/*
Developer Summary:
Logistics Manager

Purpose:
- Centralize shared room logistics policy
- Keep storage-first RCL4 behavior explicit
- Preserve emergency hauler delivery priorities
- Avoid duplicating withdrawal / delivery rules across roles

Important Notes:
- Workers and repairers use storage first whenever it has energy
- Upgraders now self-supply, so haulers no longer reserve energy for a
  controller-side container
- All helpers consume room/state inputs and avoid extra global scans
*/

const config = require("config");

module.exports = {
  getRoomPlan(room, state) {
    const storage = room.storage;
    const storageEnergy = storage ? storage.store[RESOURCE_ENERGY] || 0 : 0;
    const useStorageFirst = !!storage && storageEnergy > 0;

    return {
      mode: useStorageFirst ? "storage_first" : "container_first",
      storageEnergy: storageEnergy,
      hasStorage: !!storage,
      withdrawPriority: ["storage", "source_container", "active_source"],
      haulerMode: this.shouldUseThreatTowerPriority(room, state)
        ? "emergency"
        : "normal",
    };
  },

  getGeneralEnergyWithdrawalTarget(room, creep, state) {
    const storage = this.getStorageEnergyTarget(room);
    if (storage) {
      return storage;
    }

    const sourceContainer = this.getBalancedSourceContainer(state, creep);
    if (sourceContainer) {
      return sourceContainer;
    }

    let source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);
    if (!source) {
      source = creep.pos.findClosestByRange(FIND_SOURCES);
    }

    return source;
  },

  getStorageEnergyTarget(room) {
    if (!room.storage) return null;
    if ((room.storage.store[RESOURCE_ENERGY] || 0) <= 0) return null;
    return room.storage;
  },

  getBalancedSourceContainer(state, creep) {
    if (!state || !state.sourceContainers || state.sourceContainers.length === 0) {
      return null;
    }

    const withdrawUsersByTargetId = this.getWithdrawUsersByTargetId(
      state.homeCreeps || [],
    );
    const containers = _.filter(state.sourceContainers, function (container) {
      return (container.store[RESOURCE_ENERGY] || 0) > 0;
    });

    if (containers.length === 0) return null;

    const scored = _.map(containers, function (container) {
      let users = withdrawUsersByTargetId[container.id] || 0;

      if (creep.memory && creep.memory.withdrawTargetId === container.id) {
        users = Math.max(0, users - 1);
      }

      return {
        container: container,
        users: users,
        energy: container.store[RESOURCE_ENERGY] || 0,
        range: creep.pos.getRangeTo(container),
      };
    });

    scored.sort(function (a, b) {
      if (a.users !== b.users) return a.users - b.users;
      if (a.energy !== b.energy) return b.energy - a.energy;
      return a.range - b.range;
    });

    return scored[0].container;
  },

  getWithdrawUsersByTargetId(creeps) {
    const usersByTargetId = {};

    for (let i = 0; i < creeps.length; i++) {
      const creep = creeps[i];
      const targetId = creep.memory ? creep.memory.withdrawTargetId : null;

      if (!targetId) continue;
      usersByTargetId[targetId] = (usersByTargetId[targetId] || 0) + 1;
    }

    return usersByTargetId;
  },

  shouldUseThreatTowerPriority(room, state) {
    if (state && state.hostileCreeps && state.hostileCreeps.length > 0) {
      return true;
    }

    const towers =
      state && state.structuresByType
        ? state.structuresByType[STRUCTURE_TOWER] || []
        : room.find(FIND_MY_STRUCTURES, {
            filter: function (structure) {
              return structure.structureType === STRUCTURE_TOWER;
            },
          });

    const emergencyThreshold = config.LOGISTICS.towerEmergencyThreshold;

    return _.some(towers, function (tower) {
      return (tower.store[RESOURCE_ENERGY] || 0) < emergencyThreshold;
    });
  },

  getHaulerDeliveryTarget(room, creep, state) {
    const spawnTarget = this.getSpawnDeliveryTarget(room, creep);
    if (spawnTarget) return spawnTarget;

    const threatMode = this.shouldUseThreatTowerPriority(room, state);

    if (threatMode) {
      const emergencyTower = this.getLowTowerTarget(
        room,
        room.energyCapacityAvailable,
        creep,
      );
      if (emergencyTower) return emergencyTower;

      const extensionTarget = this.getExtensionDeliveryTarget(room, creep);
      if (extensionTarget) return extensionTarget;

      const storageTarget = this.getStorageDeliveryTarget(room);
      if (storageTarget) return storageTarget;

      return null;
    }

    const extensionTarget = this.getExtensionDeliveryTarget(room, creep);
    if (extensionTarget) return extensionTarget;

    const storageTarget = this.getStorageDeliveryTarget(room);
    if (storageTarget) return storageTarget;

    const reserveTower = this.getLowTowerTarget(
      room,
      config.LOGISTICS.towerReserveThreshold,
      creep,
    );
    if (reserveTower) return reserveTower;

    return null;
  },

  getLowTowerTarget(room, threshold, creep) {
    return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: function (structure) {
        return (
          structure.structureType === STRUCTURE_TOWER &&
          (structure.store[RESOURCE_ENERGY] || 0) < threshold &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });
  },

  getSpawnDeliveryTarget(room, creep) {
    return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: function (structure) {
        return (
          structure.structureType === STRUCTURE_SPAWN &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });
  },

  getExtensionDeliveryTarget(room, creep) {
    return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: function (structure) {
        return (
          structure.structureType === STRUCTURE_EXTENSION &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });
  },

  getStorageDeliveryTarget(room) {
    if (!room.storage) return null;
    if (
      (room.storage.store[RESOURCE_ENERGY] || 0) >=
      (config.LOGISTICS.storageEnergyCap || Infinity)
    ) {
      return null;
    }
    if (room.storage.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) return null;
    return room.storage;
  },
};
