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
- Typed containers are used deliberately:
  - hub container smooths early spawn/worker flow before storage
  - controller container accelerates upgrading until a controller link exists
- All helpers consume room/state inputs and avoid extra global scans
*/

const config = require("config");

module.exports = {
  getRoomPlan(room, state) {
    const storage = room.storage;
    const storageEnergy = storage ? storage.store[RESOURCE_ENERGY] || 0 : 0;
    const useStorageFirst = !!storage && storageEnergy > 0;
    const useControllerBuffer =
      !!(
        state &&
        state.controllerContainer &&
        !(
          state.infrastructure &&
          state.infrastructure.hasControllerLink
        )
      );
    const useHubBuffer = !!(state && state.hubContainer && !storage);

    return {
      mode: useStorageFirst ? "storage_first" : "container_first",
      storageEnergy: storageEnergy,
      hasStorage: !!storage,
      withdrawPriority: [
        "storage",
        "hub_container",
        "source_container",
        "active_source",
      ],
      haulerMode: this.hasHostilePressure(room, state)
        ? "hostile"
        : this.hasEmergencyTowerNeed(room, state)
          ? "tower_emergency"
          : "normal",
      useControllerBuffer: useControllerBuffer,
      useHubBuffer: useHubBuffer,
    };
  },

  getGeneralEnergyWithdrawalTarget(room, creep, state) {
    const storage = this.getStorageEnergyTarget(room);
    if (storage) {
      return storage;
    }

    const hubContainer = this.getHubContainerEnergyTarget(state);
    if (hubContainer) {
      return hubContainer;
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

  getUpgraderEnergyWithdrawalTarget(room, creep, state) {
    const controllerLink = this.getControllerLinkEnergyTarget(state);
    if (controllerLink) {
      return controllerLink;
    }

    const controllerContainer = this.getControllerContainerEnergyTarget(state);
    if (controllerContainer) {
      return controllerContainer;
    }

    return this.getGeneralEnergyWithdrawalTarget(room, creep, state);
  },

  getStorageEnergyTarget(room) {
    if (!room.storage) return null;
    if ((room.storage.store[RESOURCE_ENERGY] || 0) <= 0) return null;
    return room.storage;
  },

  getControllerLinkEnergyTarget(state) {
    if (!state || !state.infrastructure || !state.infrastructure.controllerLink) {
      return null;
    }

    const controllerLink = state.infrastructure.controllerLink;
    if ((controllerLink.store[RESOURCE_ENERGY] || 0) <= 0) return null;
    return controllerLink;
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

  getHubContainerEnergyTarget(state) {
    if (!state || !state.hubContainer) return null;
    if ((state.hubContainer.store[RESOURCE_ENERGY] || 0) <= 0) return null;
    return state.hubContainer;
  },

  getControllerContainerEnergyTarget(state) {
    if (!state || !state.controllerContainer) return null;
    if (
      state.infrastructure &&
      state.infrastructure.hasControllerLink
    ) {
      return null;
    }
    if ((state.controllerContainer.store[RESOURCE_ENERGY] || 0) <= 0) return null;
    return state.controllerContainer;
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

  hasHostilePressure(room, state) {
    return !!(state && state.hostileCreeps && state.hostileCreeps.length > 0);
  },

  hasEmergencyTowerNeed(room, state) {
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

  shouldUseThreatTowerPriority(room, state) {
    return (
      this.hasHostilePressure(room, state) ||
      this.hasEmergencyTowerNeed(room, state)
    );
  },

  getTowerCapacityTarget() {
    return typeof TOWER_CAPACITY === "number" ? TOWER_CAPACITY : 1000;
  },

  getHaulerDeliveryTarget(room, creep, state) {
    const spawnTarget = this.getSpawnDeliveryTarget(room, creep);
    if (spawnTarget) return spawnTarget;

    const hostilePressure = this.hasHostilePressure(room, state);
    const towerEmergency = this.hasEmergencyTowerNeed(room, state);

    if (hostilePressure) {
      const emergencyTower = this.getLowTowerTarget(
        room,
        this.getTowerCapacityTarget(),
        creep,
      );
      if (emergencyTower) return emergencyTower;
    }

    const extensionTarget = this.getExtensionDeliveryTarget(room, creep);
    if (extensionTarget) return extensionTarget;

    if (!hostilePressure && towerEmergency) {
      const emergencyTower = this.getLowTowerTarget(
        room,
        config.LOGISTICS.towerEmergencyThreshold,
        creep,
      );
      if (emergencyTower) return emergencyTower;
    }

    const sourceLink = this.getSourceLinkDeliveryTarget(state, creep);
    if (sourceLink) return sourceLink;

    const controllerContainer = this.getControllerContainerDeliveryTarget(state);
    if (controllerContainer) return controllerContainer;

    const hubContainer = this.getHubContainerDeliveryTarget(state);
    if (hubContainer) return hubContainer;

    const storageTarget = this.getStorageDeliveryTarget(room);
    if (storageTarget) return storageTarget;

    const reserveTower = this.getLowTowerTarget(
      room,
      hostilePressure
        ? this.getTowerCapacityTarget()
        : config.LOGISTICS.towerReserveThreshold,
      creep,
    );
    if (reserveTower) return reserveTower;

    return null;
  },

  getSourceLinkDeliveryTarget(state, creep) {
    if (!state || !state.infrastructure || !creep) return null;

    const infrastructure = state.infrastructure;
    if (!this.shouldFillSourceLinks(infrastructure)) {
      return null;
    }

    const bySourceId = infrastructure.sourceLinksBySourceId || {};
    const candidates = [];

    for (const sourceId in bySourceId) {
      if (!Object.prototype.hasOwnProperty.call(bySourceId, sourceId)) continue;

      const link = bySourceId[sourceId];
      if (!link) continue;
      if (link.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) continue;
      candidates.push(link);
    }

    if (candidates.length === 0) return null;

    return (
      creep.pos.findClosestByPath(candidates) ||
      creep.pos.findClosestByRange(candidates)
    );
  },

  shouldFillSourceLinks(infrastructure) {
    if (!infrastructure) return false;

    const storageLink = infrastructure.storageLink || null;
    if (
      storageLink &&
      storageLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    ) {
      return true;
    }

    const controllerLink = infrastructure.controllerLink || null;
    if (
      controllerLink &&
      controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    ) {
      return true;
    }

    return false;
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

  getHubContainerDeliveryTarget(state) {
    if (!state || !state.hubContainer) return null;
    if (state.infrastructure && state.infrastructure.hasStorage) return null;
    if (
      state.hubContainer.store.getFreeCapacity(RESOURCE_ENERGY) <= 0
    ) {
      return null;
    }
    if (
      (state.hubContainer.store[RESOURCE_ENERGY] || 0) >=
      (config.LOGISTICS.hubContainerTarget || 0)
    ) {
      return null;
    }
    return state.hubContainer;
  },

  getControllerContainerDeliveryTarget(state) {
    if (!state || !state.controllerContainer) return null;
    if (
      state.infrastructure &&
      state.infrastructure.hasControllerLink
    ) {
      return null;
    }
    if (
      state.controllerContainer.store.getFreeCapacity(RESOURCE_ENERGY) <= 0
    ) {
      return null;
    }
    if (
      (state.controllerContainer.store[RESOURCE_ENERGY] || 0) >=
      (config.LOGISTICS.controllerContainerTarget || 0)
    ) {
      return null;
    }
    return state.controllerContainer;
  },
};
