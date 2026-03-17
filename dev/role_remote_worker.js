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
  run(creep) {
    var targetRoom = creep.memory.targetRoom;
    var homeRoom = creep.memory.homeRoom || creep.memory.room;
    if (!targetRoom || !homeRoom) return;

    if (creep.memory.working && creep.store[RESOURCE_ENERGY] === 0) {
      creep.memory.working = false;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
    }

    if (!creep.memory.working) {
      this.runGather(creep, targetRoom, homeRoom);
      return;
    }

    this.runWork(creep, targetRoom);
  },

  runGather(creep, targetRoom, homeRoom) {
    if (creep.room.name === homeRoom) {
      var target = this.getHomeEnergyTarget(creep);

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

    var pickup = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: function (resource) {
        return resource.resourceType === RESOURCE_ENERGY && resource.amount > 0;
      },
    });

    if (pickup) {
      if (creep.pickup(pickup) === ERR_NOT_IN_RANGE) {
        creep.moveTo(pickup, MOVE_OPTIONS);
      }
      return;
    }

    var source = this.getHarvestSource(creep);
    if (!source) return;

    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveTo(source, MOVE_OPTIONS);
    }
  },

  runWork(creep, targetRoom) {
    if (creep.room.name !== targetRoom) {
      this.moveToRoom(creep, targetRoom, "#7befff");
      return;
    }

    var site = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {
      filter: function (constructionSite) {
        return (
          constructionSite.structureType === STRUCTURE_CONTAINER ||
          constructionSite.structureType === STRUCTURE_ROAD
        );
      },
    });

    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) {
        creep.moveTo(site, MOVE_OPTIONS);
      }
      return;
    }

    var repairTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
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

    if (repairTarget) {
      if (creep.repair(repairTarget) === ERR_NOT_IN_RANGE) {
        creep.moveTo(repairTarget, MOVE_OPTIONS);
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

  getHomeEnergyTarget(creep) {
    if (
      creep.room.storage &&
      (creep.room.storage.store[RESOURCE_ENERGY] || 0) > 0
    ) {
      return creep.room.storage;
    }

    var container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (structure) {
        return (
          structure.structureType === STRUCTURE_CONTAINER &&
          (structure.store[RESOURCE_ENERGY] || 0) > 0
        );
      },
    });

    if (container) return container;

    return creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
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

  moveToRoom(creep, roomName, stroke) {
    creep.moveTo(new RoomPosition(25, 25, roomName), {
      reusePath: 50,
      range: 20,
      visualizePathStyle: { stroke: stroke },
    });
  },
};
