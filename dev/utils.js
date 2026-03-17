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
const logisticsManager = require("logistics_manager");

// Developer note:
// Tick-local room cache. room_manager registers collected room_state once, then
// hot helpers reuse those arrays/maps instead of rebuilding room.find/Game.creeps
// scans in each caller.
var runtimeCacheTick = null;
var runtimeStateByRoom = {};
var runtimeCacheByRoom = {};
var routeDirectionCacheByKey = {};

function resetRuntimeCachesIfNeeded() {
  if (runtimeCacheTick === Game.time) return;

  runtimeCacheTick = Game.time;
  runtimeStateByRoom = {};
  runtimeCacheByRoom = {};
  routeDirectionCacheByKey = {};
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

function getRouteExitDirection(fromRoomName, targetRoomName) {
  resetRuntimeCachesIfNeeded();

  var cacheKey = fromRoomName + ":" + targetRoomName;
  if (Object.prototype.hasOwnProperty.call(routeDirectionCacheByKey, cacheKey)) {
    return routeDirectionCacheByKey[cacheKey];
  }

  var route = Game.map.findRoute(fromRoomName, targetRoomName);
  var direction =
    Array.isArray(route) && route.length > 0 ? route[0].exit : null;

  routeDirectionCacheByKey[cacheKey] = direction;
  return direction;
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
    const state = getRegisteredState(room);
    const spawn = state && state.spawns ? state.spawns[0] : room.find(FIND_MY_SPAWNS)[0];
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
    const state = getRegisteredState(room);
    const spawn = state && state.spawns ? state.spawns[0] : room.find(FIND_MY_SPAWNS)[0];
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

  getRemoteSourceContainerPosition(room, source, homeRoomName) {
    var anchor = this.getRemoteExitPosition(room, homeRoomName, source.pos);
    var positions = this.getWalkableAdjacentPositions(source.pos);

    if (positions.length === 0) return null;

    positions.sort(function (a, b) {
      var aScore = anchor ? a.getRangeTo(anchor) : a.getRangeTo(25, 25);
      var bScore = anchor ? b.getRangeTo(anchor) : b.getRangeTo(25, 25);
      return aScore - bScore;
    });

    for (var i = 0; i < positions.length; i++) {
      var pos = positions[i];
      var blocked = pos.lookFor(LOOK_STRUCTURES).length > 0;
      var siteBlocked = pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0;

      if (!blocked && !siteBlocked) {
        return pos;
      }
    }

    return positions[0];
  },

  getRemoteExitPosition(room, targetRoomName, startPos) {
    var direction = getRouteExitDirection(room.name, targetRoomName);
    if (!direction) return null;

    var exits = room.find(direction);
    if (!exits || exits.length === 0) return null;

    return startPos.findClosestByPath(exits);
  },

  getRemoteRoadPlanPositions(room, fromPos, targetRoomName) {
    var exitPos = this.getRemoteExitPosition(room, targetRoomName, fromPos);
    if (!exitPos) return [];

    var path = fromPos.findPathTo(exitPos, {
      ignoreCreeps: true,
      range: 1,
    });
    var positions = [];

    for (var i = 0; i < path.length; i++) {
      var step = path[i];

      if (step.x < 2 || step.x > 47 || step.y < 2 || step.y > 47) continue;
      positions.push(new RoomPosition(step.x, step.y, room.name));
    }

    return positions;
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

  getUpgraderWorkPosition(room, container) {
    if (!room.controller || !container) return null;

    const terrain = Game.map.getRoomTerrain(room.name);
    const candidates = [];
    const state = getRegisteredState(room);
    const spawn = state && state.spawns ? state.spawns[0] : room.find(FIND_MY_SPAWNS)[0];
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
