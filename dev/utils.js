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
  - Threat mode or low tower energy: spawn -> towers -> extensions -> storage
  - Normal mode: spawn -> extensions -> storage -> towers below reserve
*/

const config = require("config");
const logisticsManager = require("logistics_manager");

// Developer note:
// Tick-local room cache. room_manager registers collected room_state once, then
// hot helpers reuse those arrays/maps instead of rebuilding room.find/Game.creeps
// scans in each caller.
var runtimeCacheTick = null;
var runtimeStateByRoom = {};
var runtimeCacheByRoom = {};
var sourceHarvestCapacityById = {};
var sourceHarvestPositionsById = {};

function resetRuntimeCachesIfNeeded() {
  if (runtimeCacheTick === Game.time) return;

  runtimeCacheTick = Game.time;
  runtimeStateByRoom = {};
  runtimeCacheByRoom = {};
  sourceHarvestCapacityById = {};
  sourceHarvestPositionsById = {};
}

function groupObjectsByType(objects) {
  var grouped = {};

  for (var i = 0; i < objects.length; i++) {
    var object = objects[i];
    var type = object.structureType;

    if (!type) continue;
    if (!grouped[type]) grouped[type] = [];

    grouped[type].push(object);
  }

  return grouped;
}

function getRegisteredState(room) {
  resetRuntimeCachesIfNeeded();
  return runtimeStateByRoom[room.name] || null;
}

function getHomeCreeps(room, state) {
  if (state && state.homeCreeps) return state.homeCreeps;

  return _.filter(Game.creeps, function (creep) {
    return creep.memory && creep.memory.room === room.name;
  });
}

function getSourceContainers(structures, sources) {
  return _.filter(structures, function (structure) {
    if (structure.structureType !== STRUCTURE_CONTAINER) return false;

    return _.some(sources, function (source) {
      return structure.pos.getRangeTo(source) <= 1;
    });
  });
}

function getSourceContainersBySourceId(sourceContainers, sources) {
  var bySourceId = {};

  for (var i = 0; i < sources.length; i++) {
    var source = sources[i];
    bySourceId[source.id] =
      _.find(sourceContainers, function (container) {
        return container.pos.getRangeTo(source) <= 1;
      }) || null;
  }

  return bySourceId;
}

function getWithdrawUsersByTargetId(creeps) {
  var usersByTargetId = {};

  for (var i = 0; i < creeps.length; i++) {
    var creep = creeps[i];
    var targetId = creep.memory ? creep.memory.withdrawTargetId : null;

    if (!targetId) continue;

    usersByTargetId[targetId] = (usersByTargetId[targetId] || 0) + 1;
  }

  return usersByTargetId;
}

function getDefenseMaintenanceTargets(room) {
  const controllerLevel = room.controller ? room.controller.level : 0;
  const configured = config.DEFENSE.maintenanceByControllerLevel || {};

  let target = configured[controllerLevel];

  if (typeof target !== "number") {
    if (controllerLevel >= 6) target = 100000;
    else if (controllerLevel >= 5) target = 50000;
    else if (controllerLevel >= 4) target = 25000;
    else if (controllerLevel >= 3) target = 10000;
    else target = Math.max(
      config.REPAIR.wallMinHits || 5000,
      config.REPAIR.rampartMinHits || 5000,
    );
  }

  return {
    wallMinHits: target,
    rampartMinHits: target,
    towerRepairFloor: Math.max(2000, Math.floor(target * 0.4)),
  };
}

function buildRuntimeCache(room) {
  var state = getRegisteredState(room);
  var structures = state && state.structures ? state.structures : room.find(FIND_STRUCTURES);
  var sources = state && state.sources ? state.sources : room.find(FIND_SOURCES);
  var sites =
    state && state.sites ? state.sites : room.find(FIND_CONSTRUCTION_SITES);
  var creeps = state && state.creeps ? state.creeps : room.find(FIND_MY_CREEPS);
  var hostileCreeps =
    state && state.hostileCreeps
      ? state.hostileCreeps
      : room.find(FIND_HOSTILE_CREEPS);
  var hostilePowerCreeps =
    state && state.hostilePowerCreeps
      ? state.hostilePowerCreeps
      : typeof FIND_HOSTILE_POWER_CREEPS !== "undefined"
        ? room.find(FIND_HOSTILE_POWER_CREEPS)
        : [];
  var hostileStructures =
    state && state.hostileStructures
      ? state.hostileStructures
      : typeof FIND_HOSTILE_STRUCTURES !== "undefined"
        ? room.find(FIND_HOSTILE_STRUCTURES)
        : [];
  var structuresByType =
    state && state.structuresByType
      ? state.structuresByType
      : groupObjectsByType(structures);
  var sourceContainers =
    state && state.sourceContainers
      ? state.sourceContainers
      : getSourceContainers(structures, sources);
  var sourceContainersBySourceId =
    state && state.sourceContainersBySourceId
      ? state.sourceContainersBySourceId
      : getSourceContainersBySourceId(sourceContainers, sources);
  var homeCreeps = getHomeCreeps(room, state);

  return {
    state: state,
    structures: structures,
    structuresByType: structuresByType,
    sources: sources,
    sites: sites,
    creeps: creeps,
    hostileCreeps: hostileCreeps,
    hostilePowerCreeps: hostilePowerCreeps,
    hostileStructures: hostileStructures,
    sourceContainers: sourceContainers,
    sourceContainersBySourceId: sourceContainersBySourceId,
    homeCreeps: homeCreeps,
  };
}

function getRuntimeCache(room) {
  resetRuntimeCachesIfNeeded();

  if (!runtimeCacheByRoom[room.name]) {
    runtimeCacheByRoom[room.name] = buildRuntimeCache(room);
  }

  return runtimeCacheByRoom[room.name];
}

module.exports = {
  setRoomRuntimeState(room, state) {
    resetRuntimeCachesIfNeeded();
    runtimeStateByRoom[room.name] = state;
    delete runtimeCacheByRoom[room.name];
  },

  getRoomRuntimeCache(room) {
    return getRuntimeCache(room);
  },

  moveTo(creep, target, options) {
    if (!creep || !target) return ERR_INVALID_TARGET;

    var pos = target.pos ? target.pos : target;
    if (!pos) return ERR_INVALID_TARGET;

    var settings = options || {};
    var range = typeof settings.range === "number" ? settings.range : 1;
    var cacheKey = settings.cacheKey || "moveCache";
    var destKey = `${pos.roomName}:${pos.x}:${pos.y}:${range}`;

    if (creep.pos.inRangeTo(pos, range)) {
      this.clearMoveCache(creep, cacheKey);
      if (creep.memory) {
        creep.memory.lastMoveDest = destKey;
        creep.memory.lastMoveResult = OK;
        creep.memory.lastMoveDir = null;
      }
      return OK;
    }
    this.clearMoveCache(creep, cacheKey);

    if (typeof creep.moveTo === "function") {
      var moveOptions = Object.assign({}, settings);
      var moveResult = creep.moveTo(pos, moveOptions);

      if (creep.memory) {
        creep.memory.lastMoveDest = destKey;
        creep.memory.lastMoveDir = null;
        creep.memory.lastMoveResult = moveResult;
      }

      return moveResult;
    }

    var search = PathFinder.search(
      creep.pos,
      { pos: pos, range: range },
      {
        maxRooms:
          settings.maxRooms ||
          (creep.room && creep.room.name === pos.roomName ? 1 : 16),
        plainCost: 2,
        swampCost: 10,
      },
    );

    if (!search.path || search.path.length === 0) {
      if (creep.memory) {
        creep.memory.lastMoveDest = destKey;
        creep.memory.lastMoveDir = null;
        creep.memory.lastMoveResult = ERR_NO_PATH;
      }
      return ERR_NO_PATH;
    }

    var nextStep = search.path[0];
    var direction = creep.pos.getDirectionTo(nextStep.x, nextStep.y);
    var moveResult = creep.move(direction);

    if (creep.memory) {
      creep.memory.lastMoveDest = destKey;
      creep.memory.lastMoveDir = direction;
      creep.memory.lastMoveResult = moveResult;
    }

    return moveResult;
  },

  clearMoveCache(creep, cacheKey) {
    if (!creep || !creep.memory) return;
    delete creep.memory[cacheKey || "moveCache"];
  },

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

  getSourceHarvestCapacity(source) {
    if (!source || !source.id || !source.pos) return 0;

    resetRuntimeCachesIfNeeded();

    if (typeof sourceHarvestCapacityById[source.id] === "number") {
      return sourceHarvestCapacityById[source.id];
    }

    const terrain = Game.map.getRoomTerrain(source.pos.roomName);
    let count = 0;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const x = source.pos.x + dx;
        const y = source.pos.y + dy;

        if (x < 1 || x > 48 || y < 1 || y > 48) continue;
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

        count += 1;
      }
    }

    sourceHarvestCapacityById[source.id] = count;
    return count;
  },

  getSourceHarvestPositions(source) {
    if (!source || !source.id || !source.pos) return [];

    resetRuntimeCachesIfNeeded();

    if (sourceHarvestPositionsById[source.id]) {
      return sourceHarvestPositionsById[source.id];
    }

    const positions = this.getWalkableAdjacentPositions(source.pos).filter(
      function (pos) {
        const structures = pos.lookFor(LOOK_STRUCTURES);
        const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

        for (let i = 0; i < structures.length; i++) {
          const structureType = structures[i].structureType;
          if (
            structureType !== STRUCTURE_ROAD &&
            structureType !== STRUCTURE_CONTAINER &&
            structureType !== STRUCTURE_RAMPART
          ) {
            return false;
          }
        }

        for (let i = 0; i < sites.length; i++) {
          const structureType = sites[i].structureType;
          if (
            structureType !== STRUCTURE_ROAD &&
            structureType !== STRUCTURE_CONTAINER &&
            structureType !== STRUCTURE_RAMPART
          ) {
            return false;
          }
        }

        return true;
      },
    );

    sourceHarvestPositionsById[source.id] = positions;
    return positions;
  },

  getHarvestPositionKey(pos) {
    if (!pos) return null;
    return `${pos.roomName}:${pos.x}:${pos.y}`;
  },

  getHarvestPositionFromKey(key) {
    if (!key || typeof key !== "string") return null;

    const parts = key.split(":");
    if (parts.length !== 3) return null;

    const x = Number(parts[1]);
    const y = Number(parts[2]);
    if (!Number.isInteger(x) || !Number.isInteger(y)) return null;

    return new RoomPosition(x, y, parts[0]);
  },

  getAssignedHarvestPosition(creep, source) {
    if (!creep || !creep.memory || !source || !source.pos) return null;

    const positions = this.getSourceHarvestPositions(source);
    if (positions.length === 0) return null;

    const cached = this.getHarvestPositionFromKey(creep.memory.harvestPosKey);
    if (cached && cached.roomName === source.pos.roomName && cached.getRangeTo(source) <= 1) {
      return cached;
    }

    const cache = getRuntimeCache(creep.room);
    const homeCreeps = cache && cache.homeCreeps ? cache.homeCreeps : creep.room.find(FIND_MY_CREEPS);
    const reservedByKey = {};

    for (let i = 0; i < homeCreeps.length; i++) {
      const other = homeCreeps[i];
      if (!other || other.name === creep.name || !other.memory) continue;
      if (other.memory.harvestSourceId && other.memory.harvestSourceId !== source.id) {
        continue;
      }

      const reservedKey = other.memory.harvestPosKey;
      if (!reservedKey) continue;
      reservedByKey[reservedKey] = (reservedByKey[reservedKey] || 0) + 1;
    }

    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      const key = this.getHarvestPositionKey(pos);
      const occupants = pos.lookFor(LOOK_CREEPS).filter(function (other) {
        return other && other.name !== creep.name;
      }).length;
      const powerOccupants =
        typeof LOOK_POWER_CREEPS !== "undefined"
          ? pos.lookFor(LOOK_POWER_CREEPS).length
          : 0;
      const reserved = reservedByKey[key] || 0;
      const score =
        (occupants + powerOccupants) * 1000 +
        reserved * 100 +
        creep.pos.getRangeTo(pos);

      if (score < bestScore) {
        best = pos;
        bestScore = score;
      }
    }

    if (best) {
      creep.memory.harvestPosKey = this.getHarvestPositionKey(best);
    }

    return best;
  },

  clearAssignedHarvestPosition(creep) {
    if (!creep || !creep.memory) return;
    delete creep.memory.harvestPosKey;
  },

  getSourceContainerPositions(room, source) {
    const state = getRegisteredState(room);
    const spawn = state && state.spawns ? state.spawns[0] : room.find(FIND_MY_SPAWNS)[0];
    const positions = this.getWalkableAdjacentPositions(source.pos);

    positions.sort(function (a, b) {
      const aCreeps = a.lookFor(LOOK_CREEPS).length;
      const bCreeps = b.lookFor(LOOK_CREEPS).length;
      const aPowerCreeps =
        typeof LOOK_POWER_CREEPS !== "undefined" ? a.lookFor(LOOK_POWER_CREEPS).length : 0;
      const bPowerCreeps =
        typeof LOOK_POWER_CREEPS !== "undefined" ? b.lookFor(LOOK_POWER_CREEPS).length : 0;
      const aOccupied = aCreeps + aPowerCreeps;
      const bOccupied = bCreeps + bPowerCreeps;
      const aScore = (spawn ? a.getRangeTo(spawn) : 0) + aOccupied * 100;
      const bScore = (spawn ? b.getRangeTo(spawn) : 0) + bOccupied * 100;
      return aScore - bScore;
    });

    return positions;
  },

  getSourceContainerPosition(room, source) {
    const positions = this.getSourceContainerPositions(room, source);

    for (const pos of positions) {
      const blocked = pos.lookFor(LOOK_STRUCTURES).length > 0;
      const siteBlocked = pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0;

      if (!blocked && !siteBlocked) {
        return pos;
      }
    }

    return positions.length > 0 ? positions[0] : null;
  },

  getSourceContainerBySource(room, sourceId) {
    const cache = getRuntimeCache(room);

    if (
      cache.sourceContainersBySourceId &&
      Object.prototype.hasOwnProperty.call(cache.sourceContainersBySourceId, sourceId)
    ) {
      return cache.sourceContainersBySourceId[sourceId];
    }

    return null;
  },

  getControllerContainers(room) {
    if (!room.controller) return [];

    const cache = getRuntimeCache(room);

    return _.filter(cache.structures, function (structure) {
      return (
        structure.structureType === STRUCTURE_CONTAINER &&
        structure.pos.getRangeTo(room.controller) <= 4
      );
    });
  },

  getSourceContainers(room) {
    return getRuntimeCache(room).sourceContainers;
  },

  getBalancedSourceContainer(room, creep) {
    const cache = getRuntimeCache(room);
    if (!cache.withdrawUsersByTargetId) {
      cache.withdrawUsersByTargetId = getWithdrawUsersByTargetId(cache.homeCreeps);
    }
    const containers = cache.sourceContainers.filter(
      function (container) {
        return (container.store[RESOURCE_ENERGY] || 0) > 0;
      },
    );

    if (containers.length === 0) return null;

    const scored = _.map(containers, function (container) {
      var users = cache.withdrawUsersByTargetId[container.id] || 0;

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

  hasThreats(room) {
    return getRuntimeCache(room).hostileCreeps.length > 0;
  },

  isDefenseHostile(creep) {
    if (!creep) return false;
    if (creep.my) return false;

    var username =
      creep.owner && creep.owner.username ? creep.owner.username : null;

    if (username === "Source Keeper") return false;

    return true;
  },

  isDefenseStructure(structure) {
    if (!structure) return false;
    if (structure.my) return false;

    return structure.structureType === STRUCTURE_INVADER_CORE;
  },

  getDefenseHostiles(room, hostiles) {
    var candidates = hostiles;

    if (!candidates) {
      candidates = room ? getRuntimeCache(room).hostileCreeps : [];
    }

    return _.filter(candidates, function (creep) {
      return module.exports.isDefenseHostile(creep);
    });
  },

  getDefenseStructures(room, structures) {
    var groups = [];
    var seen = {};
    var results = [];
    var cache = room ? getRuntimeCache(room) : null;

    if (structures && structures.length > 0) {
      groups.push(structures);
    } else if (cache && cache.hostileStructures) {
      groups.push(cache.hostileStructures);
    }

    for (var i = 0; i < groups.length; i++) {
      var group = groups[i] || [];

      for (var j = 0; j < group.length; j++) {
        var structure = group[j];
        var id = structure && structure.id ? structure.id : null;

        if (!module.exports.isDefenseStructure(structure)) continue;
        if (id && seen[id]) continue;
        if (id) seen[id] = true;

        results.push(structure);
      }
    }

    return results;
  },

  getDefenseIntruders(room, hostiles, powerCreeps, structures) {
    var merged = [];
    var seen = {};
    var groups = [];
    var cache = room ? getRuntimeCache(room) : null;
    var hostilePowerCreeps = powerCreeps;

    if (
      cache &&
      !hostiles &&
      !powerCreeps &&
      !structures &&
      cache.defenseIntruders
    ) {
      return cache.defenseIntruders;
    }

    groups.push(this.getDefenseHostiles(room, hostiles));

    if (!hostilePowerCreeps && cache && cache.hostilePowerCreeps) {
      hostilePowerCreeps = cache.hostilePowerCreeps;
    }

    groups.push(
      _.filter(hostilePowerCreeps || [], function (creep) {
        return module.exports.isDefenseHostile(creep);
      }),
    );

    groups.push(this.getDefenseStructures(room, structures));

    for (var i = 0; i < groups.length; i++) {
      var group = groups[i] || [];

      for (var j = 0; j < group.length; j++) {
        var creep = group[j];
        var id = creep && creep.id ? creep.id : null;

        if (id && seen[id]) continue;
        if (id) seen[id] = true;

        merged.push(creep);
      }
    }

    if (cache && !hostiles && !powerCreeps && !structures) {
      cache.defenseIntruders = merged;
    }

    return merged;
  },

  getDefenseMaintenanceTargets(room) {
    return getDefenseMaintenanceTargets(room);
  },

  getStorageEnergyTarget(room) {
    if (!room.storage) return null;
    if ((room.storage.store[RESOURCE_ENERGY] || 0) <= 0) return null;
    return room.storage;
  },

  getGeneralEnergyWithdrawalTarget(room, creep) {
    const state = getRegisteredState(room) || getRuntimeCache(room).state;
    return logisticsManager.getGeneralEnergyWithdrawalTarget(room, creep, state);
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
    if (
      (room.storage.store[RESOURCE_ENERGY] || 0) >=
      (config.LOGISTICS.storageEnergyCap || Infinity)
    ) {
      return null;
    }
    if (room.storage.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) return null;
    return room.storage;
  },

  shouldUseThreatTowerPriority(room) {
    if (this.hasThreats(room)) return true;

    const cache = getRuntimeCache(room);
    const emergencyThreshold = config.LOGISTICS.towerEmergencyThreshold;
    const towers = cache.structuresByType[STRUCTURE_TOWER] || [];

    return _.some(towers, function (tower) {
      return (tower.store[RESOURCE_ENERGY] || 0) < emergencyThreshold;
    });
  },

  getDroppedEnergyResources(room) {
    const cache = getRuntimeCache(room);

    if (!cache.droppedEnergy) {
      cache.droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
        filter: function (resource) {
          return resource.resourceType === RESOURCE_ENERGY;
        },
      });
    }

    return cache.droppedEnergy;
  },

  getRepairTargetGroups(room) {
    const cache = getRuntimeCache(room);

    if (!cache.repairTargetGroups) {
      const structures = cache.structures;
      const thresholds = getDefenseMaintenanceTargets(room);

      cache.repairTargetGroups = {
        criticalContainers: _.filter(structures, function (structure) {
          return (
            structure.structureType === STRUCTURE_CONTAINER &&
            structure.hits < structure.hitsMax * config.REPAIR.criticalContainerThreshold
          );
        }),
        importantStructures: _.filter(structures, function (structure) {
          if (structure.structureType === STRUCTURE_CONTAINER) {
            return structure.hits < structure.hitsMax * config.REPAIR.importantThreshold;
          }

          return (
            (structure.structureType === STRUCTURE_EXTENSION ||
              structure.structureType === STRUCTURE_SPAWN ||
              structure.structureType === STRUCTURE_TOWER) &&
            structure.hits < structure.hitsMax * config.REPAIR.spawnExtensionThreshold
          );
        }),
        lowRamparts: _.filter(structures, function (structure) {
          return (
            structure.structureType === STRUCTURE_RAMPART &&
            structure.hits < thresholds.rampartMinHits
          );
        }),
        lowWalls: _.filter(structures, function (structure) {
          return (
            structure.structureType === STRUCTURE_WALL &&
            structure.hits < thresholds.wallMinHits
          );
        }),
        roadRepairs: _.filter(structures, function (structure) {
          return (
            structure.structureType === STRUCTURE_ROAD &&
            structure.hits < structure.hitsMax * config.REPAIR.roadThreshold
          );
        }),
        sites: cache.sites,
      };
    }

    return cache.repairTargetGroups;
  },

  getTowerRepairTargets(room) {
    const cache = getRuntimeCache(room);

    if (!cache.towerRepairTargets) {
      const thresholds = getDefenseMaintenanceTargets(room);

      cache.towerRepairTargets = _.filter(cache.structures, function (structure) {
        return (
          (structure.structureType === STRUCTURE_ROAD &&
            structure.hits < structure.hitsMax * 0.5) ||
          (structure.structureType === STRUCTURE_WALL &&
            structure.hits < thresholds.towerRepairFloor) ||
          (structure.structureType === STRUCTURE_RAMPART &&
            structure.hits < thresholds.towerRepairFloor)
        );
      });
    }

    return cache.towerRepairTargets;
  },

  getHaulerDeliveryTarget(room, creep) {
    const state = getRegisteredState(room) || getRuntimeCache(room).state;
    return logisticsManager.getHaulerDeliveryTarget(room, creep, state);
  },
};
