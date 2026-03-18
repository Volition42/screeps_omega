/*
Developer Summary:
Remote Worker

Phase 2 remote setup role.

Purpose:
- Seed remote containers and roads
- Repair early remote infrastructure
- Fall back to local harvesting in the remote room when setup work is active

Important Notes:
- This role stays focused on containers and roads only in Phase B
- It can refill from home storage first, but once on-site it can sustain itself
  by harvesting remote sources to avoid long idle return trips
*/

const config = require("config");

const MOVE_OPTIONS = {
  reusePath: 20,
};

module.exports = {
  run(creep, options) {
    var targetRoom = creep.memory.targetRoom;
    var homeRoom = creep.memory.homeRoom || creep.memory.room;
    var thinkInterval =
      options && options.thinkInterval ? options.thinkInterval : 1;
    if (!targetRoom || !homeRoom) return;

    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
    }

    if (!creep.memory.working) {
      this.runGather(creep, targetRoom, homeRoom, thinkInterval);
      return;
    }

    this.runWork(creep, targetRoom, thinkInterval);
  },

  runGather(creep, targetRoom, homeRoom, thinkInterval) {
    if (creep.room.name === homeRoom) {
      var target = this.getHomeEnergyTarget(creep, thinkInterval);

      if (!target) {
        if (targetRoom !== homeRoom) {
          this.moveToRoom(creep, targetRoom, "#89ffb4");
        }
        return;
      }

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

    if (creep.room.name !== targetRoom) {
      this.moveToRoom(creep, targetRoom, "#89ffb4");
      return;
    }

    var pickup = this.getRemoteGatherTarget(creep, thinkInterval);

    if (pickup) {
      if (pickup.resourceType === RESOURCE_ENERGY) {
        if (creep.pickup(pickup) === ERR_NOT_IN_RANGE) {
          creep.moveTo(pickup, MOVE_OPTIONS);
        }
      } else if (creep.harvest(pickup) === ERR_NOT_IN_RANGE) {
        creep.moveTo(pickup, MOVE_OPTIONS);
      }
      return;
    }
  },

  runWork(creep, targetRoom, thinkInterval) {
    if (creep.room.name !== targetRoom) {
      this.moveToRoom(creep, targetRoom, "#7befff");
      return;
    }

    var target = this.getWorkTarget(creep, thinkInterval);

    if (target) {
      if (target.progressTotal !== undefined) {
        if (creep.build(target) === ERR_NOT_IN_RANGE) {
          creep.moveTo(target, MOVE_OPTIONS);
        }
      } else if (creep.repair(target) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target, MOVE_OPTIONS);
      }
      return;
    }

    var source = this.getHarvestSource(creep);
    if (source && creep.store.getFreeCapacity() > 0) {
      creep.memory.working = false;
      if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, MOVE_OPTIONS);
      }
    }
  },

  getHomeEnergyTarget(creep, thinkInterval) {
    var cached = this.getCachedTarget(creep, "remoteWorkerHomeTargetId");

    if (cached && !this.shouldThink(creep, thinkInterval, "remoteWorkerHome")) {
      return cached;
    }

    var target = null;

    if (
      creep.room.storage &&
      (creep.room.storage.store[RESOURCE_ENERGY] || 0) > 0
    ) {
      target = creep.room.storage;
    }

    if (!target) {
      target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: function (structure) {
          return (
            structure.structureType === STRUCTURE_CONTAINER &&
            (structure.store[RESOURCE_ENERGY] || 0) > 0
          );
        },
      });
    }

    if (!target) {
      target = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    }

    this.storeCachedTarget(creep, "remoteWorkerHomeTargetId", target);
    return target;
  },

  getHarvestSource(creep) {
    var source = null;

    if (creep.memory.sourceId) {
      source = Game.getObjectById(creep.memory.sourceId);

      if (
        !source ||
        source.room.name !== creep.room.name ||
        source.energy <= 0
      ) {
        source = null;
      }
    }

    if (!source) {
      source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
      if (!source) {
        source = creep.pos.findClosestByPath(FIND_SOURCES);
      }
    }

    return source;
  },

  getRemoteGatherTarget(creep, thinkInterval) {
    var cached = this.getCachedTarget(creep, "remoteWorkerGatherTargetId");

    if (cached && !this.shouldThink(creep, thinkInterval, "remoteWorkerGather")) {
      return cached;
    }

    var target = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: function (resource) {
        return resource.resourceType === RESOURCE_ENERGY && resource.amount > 0;
      },
    });

    if (!target) {
      target = this.getHarvestSource(creep);
    }

    this.storeCachedTarget(creep, "remoteWorkerGatherTargetId", target);
    return target;
  },

  getWorkTarget(creep, thinkInterval) {
    var cached = this.getCachedTarget(creep, "remoteWorkerWorkTargetId");

    if (cached && !this.shouldThink(creep, thinkInterval, "remoteWorkerWork")) {
      return cached;
    }

    var target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {
      filter: function (constructionSite) {
        return (
          constructionSite.structureType === STRUCTURE_CONTAINER ||
          constructionSite.structureType === STRUCTURE_ROAD
        );
      },
    });

    if (!target) {
      target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: function (structure) {
          if (structure.structureType === STRUCTURE_CONTAINER) {
            return (
              structure.hits <
              structure.hitsMax * config.REPAIR.importantThreshold
            );
          }

          return (
            structure.structureType === STRUCTURE_ROAD &&
            structure.hits < structure.hitsMax * config.REPAIR.roadThreshold
          );
        },
      });
    }

    this.storeCachedTarget(creep, "remoteWorkerWorkTargetId", target);
    return target;
  },

  getCachedTarget(creep, memoryKey) {
    if (!creep.memory[memoryKey]) return null;

    var target = Game.getObjectById(creep.memory[memoryKey]);
    if (!target) {
      delete creep.memory[memoryKey];
      return null;
    }

    if (target.resourceType === RESOURCE_ENERGY && target.amount <= 0) {
      delete creep.memory[memoryKey];
      return null;
    }

    if (typeof target.energy === "number" && target.energy <= 0) {
      delete creep.memory[memoryKey];
      return null;
    }

    if (target.store && target.store[RESOURCE_ENERGY] !== undefined) {
      if ((target.store[RESOURCE_ENERGY] || 0) <= 0) {
        delete creep.memory[memoryKey];
        return null;
      }
    }

    if (
      target.hits !== undefined &&
      target.hitsMax !== undefined &&
      target.hits >= target.hitsMax
    ) {
      delete creep.memory[memoryKey];
      return null;
    }

    return target;
  },

  storeCachedTarget(creep, memoryKey, target) {
    if (target && target.id) {
      creep.memory[memoryKey] = target.id;
      return;
    }

    delete creep.memory[memoryKey];
  },

  shouldThink(creep, interval, key) {
    if (interval <= 1) return true;

    var memoryKey = key + "ThinkAt";
    if (!creep.memory[memoryKey] || Game.time >= creep.memory[memoryKey]) {
      creep.memory[memoryKey] = Game.time + interval;
      return true;
    }

    return false;
  },

  moveToRoom(creep, roomName, stroke) {
    creep.moveTo(new RoomPosition(25, 25, roomName), {
      reusePath: 50,
      range: 20,
      visualizePathStyle: { stroke: stroke },
    });
  },
};
