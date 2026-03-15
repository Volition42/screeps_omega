/*
Developer Summary:
Shared utility helpers.

Purpose:
- Keep repeated room and structure queries centralized
- Provide shared energy logistics helpers
- Support consistent targeting across multiple roles

Important Notes:
- General withdrawal logic now prefers storage first, then source containers,
  then direct harvesting as a fallback.
- Hauler delivery logic now supports conditional tower priority:
  - Threat mode or low tower energy: spawn -> towers -> extensions -> controller -> storage
  - Normal mode: spawn -> extensions -> controller -> storage -> towers below reserve
*/

const config = require("config");

module.exports = {
  getWalkableAdjacentPositions(pos) {
    const terrain = Game.map.getRoomTerrain(pos.roomName);
    const results = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const x = pos.x + dx;
        const y = pos.y + dy;

        if (x < 1 || x > 48 || y < 1 || y > 48) continue;
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

        results.push(new RoomPosition(x, y, pos.roomName));
      }
    }

    return results;
  },

  getControllerContainerPositions(room, count) {
    if (!room.controller) return [];

    const terrain = Game.map.getRoomTerrain(room.name);
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const candidates = [];

    for (
      let x = room.controller.pos.x - 3;
      x <= room.controller.pos.x + 3;
      x++
    ) {
      for (
        let y = room.controller.pos.y - 3;
        y <= room.controller.pos.y + 3;
        y++
      ) {
        if (x < 1 || x > 48 || y < 1 || y > 48) continue;

        const pos = new RoomPosition(x, y, room.name);
        const range = pos.getRangeTo(room.controller.pos);

        // Preferred controller container placement is 2-3 away.
        if (range < 2 || range > 3) continue;
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

        candidates.push(pos);
      }
    }

    candidates.sort(function (a, b) {
      const aScore = spawn ? a.getRangeTo(spawn) : 0;
      const bScore = spawn ? b.getRangeTo(spawn) : 0;
      return aScore - bScore;
    });

    const chosen = [];

    for (const pos of candidates) {
      const blocked = pos.lookFor(LOOK_STRUCTURES).length > 0;
      const siteBlocked = pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0;

      if (blocked || siteBlocked) continue;

      const tooClose = _.some(chosen, function (other) {
        return pos.getRangeTo(other) <= 1;
      });

      if (!tooClose) {
        chosen.push(pos);
      }

      if (chosen.length >= count) break;
    }

    return chosen;
  },

  getSourceContainerPosition(room, source) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const positions = this.getWalkableAdjacentPositions(source.pos);

    positions.sort(function (a, b) {
      const aScore = spawn ? a.getRangeTo(spawn) : 0;
      const bScore = spawn ? b.getRangeTo(spawn) : 0;
      return aScore - bScore;
    });

    for (const pos of positions) {
      const blocked = pos.lookFor(LOOK_STRUCTURES).length > 0;
      const siteBlocked = pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0;

      if (!blocked && !siteBlocked) {
        return pos;
      }
    }

    return null;
  },

  getSourceContainerBySource(room, sourceId) {
    const source = Game.getObjectById(sourceId);
    if (!source) return null;

    return (
      source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: function (s) {
          return s.structureType === STRUCTURE_CONTAINER;
        },
      })[0] || null
    );
  },

  getControllerContainers(room) {
    if (!room.controller) return [];

    return room.find(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          s.pos.getRangeTo(room.controller) <= 4
        );
      },
    });
  },

  getSourceContainers(room) {
    const sources = room.find(FIND_SOURCES);

    return room.find(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          _.some(sources, function (source) {
            return s.pos.getRangeTo(source) <= 1;
          })
        );
      },
    });
  },

  getUpgraderWorkPosition(room, container) {
    if (!room.controller || !container) return null;

    const terrain = Game.map.getRoomTerrain(room.name);
    const candidates = [];
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const around = [container.pos].concat(
      this.getWalkableAdjacentPositions(container.pos),
    );

    for (const pos of around) {
      if (pos.getRangeTo(container.pos) > 1) continue;
      if (pos.getRangeTo(room.controller.pos) > 3) continue;

      if (
        !pos.isEqualTo(container.pos) &&
        terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL
      ) {
        continue;
      }

      const structures = pos.lookFor(LOOK_STRUCTURES);
      const blockingStructure = _.some(structures, function (s) {
        return (
          s.structureType !== STRUCTURE_ROAD &&
          s.structureType !== STRUCTURE_CONTAINER
        );
      });

      if (blockingStructure) continue;

      candidates.push(pos);
    }

    if (candidates.length === 0) return null;

    candidates.sort(function (a, b) {
      const aScore = spawn ? a.getRangeTo(spawn) : 0;
      const bScore = spawn ? b.getRangeTo(spawn) : 0;
      return aScore - bScore;
    });

    return candidates[0];
  },

  getBalancedSourceContainer(room, creep) {
    const containers = this.getSourceContainers(room).filter(
      function (container) {
        return (container.store[RESOURCE_ENERGY] || 0) > 0;
      },
    );

    if (containers.length === 0) return null;

    const scored = _.map(containers, function (container) {
      const users = _.filter(Game.creeps, function (other) {
        return (
          other.name !== creep.name &&
          other.memory &&
          other.memory.room === room.name &&
          other.memory.withdrawTargetId === container.id
        );
      }).length;

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

  hasThreats(room) {
    return room.find(FIND_HOSTILE_CREEPS).length > 0;
  },

  getStorageEnergyTarget(room) {
    if (!room.storage) return null;
    if ((room.storage.store[RESOURCE_ENERGY] || 0) <= 0) return null;
    return room.storage;
  },

  getGeneralEnergyWithdrawalTarget(room, creep) {
    const storage = this.getStorageEnergyTarget(room);
    if (storage) {
      return storage;
    }

    const sourceContainer = this.getBalancedSourceContainer(room, creep);
    if (sourceContainer) {
      return sourceContainer;
    }

    return creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
  },

  getLowTowerTarget(room, threshold, creep) {
    return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_TOWER &&
          (s.store[RESOURCE_ENERGY] || 0) < threshold &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });
  },

  getSpawnDeliveryTarget(room, creep) {
    return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_SPAWN &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });
  },

  getExtensionDeliveryTarget(room, creep) {
    return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_EXTENSION &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });
  },

  getControllerContainerDeliveryTarget(room, creep, reserve) {
    return creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          room.controller &&
          s.pos.getRangeTo(room.controller) <= 4 &&
          s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 &&
          (s.store[RESOURCE_ENERGY] || 0) < reserve
        );
      },
    });
  },

  getStorageDeliveryTarget(room) {
    if (!room.storage) return null;
    if (room.storage.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) return null;
    return room.storage;
  },

  shouldUseThreatTowerPriority(room) {
    if (this.hasThreats(room)) return true;

    const emergencyThreshold = config.LOGISTICS.towerEmergencyThreshold;
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: function (s) {
        return s.structureType === STRUCTURE_TOWER;
      },
    });

    return _.some(towers, function (tower) {
      return (tower.store[RESOURCE_ENERGY] || 0) < emergencyThreshold;
    });
  },

  getHaulerDeliveryTarget(room, creep) {
    const spawnTarget = this.getSpawnDeliveryTarget(room, creep);
    if (spawnTarget) return spawnTarget;

    const threatMode = this.shouldUseThreatTowerPriority(room);

    if (threatMode) {
      const emergencyTower = this.getLowTowerTarget(
        room,
        room.energyCapacityAvailable,
        creep,
      );
      if (emergencyTower) return emergencyTower;

      const extensionTarget = this.getExtensionDeliveryTarget(room, creep);
      if (extensionTarget) return extensionTarget;

      const controllerContainer = this.getControllerContainerDeliveryTarget(
        room,
        creep,
        config.LOGISTICS.controllerContainerReserve,
      );
      if (controllerContainer) return controllerContainer;

      const storageTarget = this.getStorageDeliveryTarget(room);
      if (storageTarget) return storageTarget;

      return null;
    }

    const extensionTarget = this.getExtensionDeliveryTarget(room, creep);
    if (extensionTarget) return extensionTarget;

    const controllerContainer = this.getControllerContainerDeliveryTarget(
      room,
      creep,
      config.LOGISTICS.controllerContainerReserve,
    );
    if (controllerContainer) return controllerContainer;

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
};
