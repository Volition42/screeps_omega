/*
Developer Summary:
Expansion Pioneer

Purpose:
- Bootstrap a newly claimed room before its first spawn is built
- Harvest locally, place the initial spawn site, build, then upgrade

Important Notes:
- The first spawn placement is intentionally simple and local. Once the spawn
  exists, normal room construction planning takes over from the room manager.
*/

const utils = require("utils");

const ROOM_TRAVEL_OPTIONS = {
  reusePath: 30,
  range: 20,
};

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
  run(creep) {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) return;

    if (creep.room.name !== targetRoom) {
      utils.moveTo(
        creep,
        new RoomPosition(25, 25, targetRoom),
        ROOM_TRAVEL_OPTIONS,
      );
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
      this.collectEnergy(creep);
      return;
    }

    this.work(creep);
  },

  collectEnergy(creep) {
    const cached = this.getCachedWithdrawalTarget(creep);
    const target = cached || this.findWithdrawalTarget(creep);

    if (target && target.resourceType === RESOURCE_ENERGY) {
      if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, target, MOVE_OPTIONS);
      }
      return;
    }

    if (target && target.store) {
      if (creep.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, target, MOVE_OPTIONS);
      }
      return;
    }

    const source = this.findHarvestSource(creep);
    if (!source) return;

    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      const harvestPos = utils.getAssignedHarvestPosition(creep, source);
      utils.moveTo(
        creep,
        harvestPos || source.pos,
        harvestPos ? HARVEST_SPOT_MOVE_OPTIONS : INTERACT_MOVE_OPTIONS,
      );
    }
  },

  work(creep) {
    this.ensureInitialSpawnSite(creep.room);

    const spawn = creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
      filter: function (structure) {
        return (
          structure.structureType === STRUCTURE_SPAWN &&
          structure.store &&
          structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        );
      },
    });
    if (spawn) {
      if (creep.transfer(spawn, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, spawn, MOVE_OPTIONS);
      }
      return;
    }

    const site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, site, MOVE_OPTIONS);
      }
      return;
    }

    if (creep.room.controller && creep.room.controller.my) {
      if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, creep.room.controller, INTERACT_MOVE_OPTIONS);
      }
    }
  },

  getCachedWithdrawalTarget(creep) {
    if (!creep.memory.withdrawTargetId) return null;

    const target = Game.getObjectById(creep.memory.withdrawTargetId);
    if (
      !target ||
      !target.pos ||
      target.pos.roomName !== creep.room.name ||
      (
        target.resourceType === RESOURCE_ENERGY
          ? (target.amount || 0) <= 0
          : (!target.store || (target.store[RESOURCE_ENERGY] || 0) <= 0)
      )
    ) {
      delete creep.memory.withdrawTargetId;
      return null;
    }

    return target;
  },

  findWithdrawalTarget(creep) {
    let target = null;
    const cache = utils.getRoomRuntimeCache(creep.room);
    const state = cache && cache.state ? cache.state : null;

    target = creep.pos.findClosestByPath(
      state && state.droppedEnergy
        ? state.droppedEnergy
        : utils.getDroppedEnergyResources(creep.room),
    );

    if (!target) {
      target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: function (structure) {
          return (
            (
              structure.structureType === STRUCTURE_CONTAINER ||
              structure.structureType === STRUCTURE_STORAGE
            ) &&
            structure.store &&
            (structure.store[RESOURCE_ENERGY] || 0) > 0
          );
        },
      });
    }

    if (target && target.id) {
      creep.memory.withdrawTargetId = target.id;
    }

    return target;
  },

  findHarvestSource(creep) {
    let source = null;

    if (creep.memory.harvestSourceId) {
      source = Game.getObjectById(creep.memory.harvestSourceId);
      if (
        !source ||
        !source.pos ||
        source.pos.roomName !== creep.room.name ||
        source.energy <= 0
      ) {
        source = null;
        delete creep.memory.harvestSourceId;
      }
    }

    if (!source) {
      source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
      if (!source) {
        source = creep.pos.findClosestByPath(FIND_SOURCES);
      }
      if (source) {
        creep.memory.harvestSourceId = source.id;
      }
    }

    return source;
  },

  ensureInitialSpawnSite(room) {
    if (!room || !room.controller || !room.controller.my) return null;

    const existingSpawn = room.find(FIND_MY_SPAWNS)[0];
    if (existingSpawn) return existingSpawn;

    const existingSite = room.find(FIND_CONSTRUCTION_SITES, {
      filter: function (site) {
        return site.structureType === STRUCTURE_SPAWN && site.my;
      },
    })[0];
    if (existingSite) return existingSite;

    const pos = this.findInitialSpawnPosition(room);
    if (!pos) return null;

    const result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_SPAWN);
    return result === OK ? pos : null;
  },

  findInitialSpawnPosition(room) {
    const controller = room.controller;
    const center = new RoomPosition(25, 25, room.name);
    const terrain = room.getTerrain();
    let best = null;
    let bestScore = Infinity;

    for (let x = 3; x <= 46; x++) {
      for (let y = 3; y <= 46; y++) {
        const pos = new RoomPosition(x, y, room.name);
        if (!this.isInitialSpawnPositionOpen(room, terrain, pos)) continue;

        const controllerRange = controller ? pos.getRangeTo(controller) : 10;
        const score =
          Math.abs(controllerRange - 5) * 10 +
          pos.getRangeTo(center);

        if (score < bestScore) {
          best = pos;
          bestScore = score;
        }
      }
    }

    return best;
  },

  isInitialSpawnPositionOpen(room, terrain, pos) {
    if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) return false;
    if (room.controller && pos.getRangeTo(room.controller) <= 2) return false;

    const structures = pos.lookFor(LOOK_STRUCTURES);
    if (structures.length > 0) return false;

    const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);
    if (sites.length > 0) return false;

    const sources = room.find(FIND_SOURCES);
    for (let i = 0; i < sources.length; i++) {
      if (pos.getRangeTo(sources[i]) <= 1) return false;
    }

    const minerals = room.find(FIND_MINERALS);
    for (let j = 0; j < minerals.length; j++) {
      if (pos.getRangeTo(minerals[j]) <= 1) return false;
    }

    return true;
  },
};
