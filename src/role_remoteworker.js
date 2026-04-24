/*
Developer Summary:
Reserved Room Remote Worker

Purpose:
- Build and repair reserved-room source containers and minimal roads
- Harvest locally so parent energy can stay focused on spawning
- Stay idle near the controller when there is no visible remote work
*/

const utils = require("utils");

const ROOM_TRAVEL_OPTIONS = {
  reusePath: 30,
  range: 20,
};

const MOVE_OPTIONS = {
  reusePath: 10,
};

const INTERACT_OPTIONS = {
  reusePath: 10,
  range: 1,
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
      delete creep.memory.workTargetId;
      delete creep.memory.harvestSourceId;
    }

    if (!creep.memory.working && creep.store.getFreeCapacity() === 0) {
      creep.memory.working = true;
      delete creep.memory.workTargetId;
      delete creep.memory.harvestSourceId;
      utils.clearAssignedHarvestPosition(creep);
    }

    if (!creep.memory.working) {
      this.collectEnergy(creep);
      return;
    }

    this.work(creep);
  },

  collectEnergy(creep) {
    const dropped = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: function (resource) {
        return resource.resourceType === RESOURCE_ENERGY && resource.amount > 0;
      },
    });
    if (dropped) {
      if (creep.pickup(dropped) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, dropped, MOVE_OPTIONS);
      }
      return;
    }

    const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: function (structure) {
        return (
          structure.structureType === STRUCTURE_CONTAINER &&
          structure.store &&
          (structure.store[RESOURCE_ENERGY] || 0) >= 200
        );
      },
    });
    if (container) {
      if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, container, MOVE_OPTIONS);
      }
      return;
    }

    const source = this.getHarvestSource(creep);
    if (!source) return;

    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      const harvestPos = utils.getAssignedHarvestPosition(creep, source);
      utils.moveTo(
        creep,
        harvestPos || source.pos,
        harvestPos ? Object.assign({}, MOVE_OPTIONS, { range: 0 }) : INTERACT_OPTIONS,
      );
    }
  },

  work(creep) {
    const site = this.getBuildTarget(creep);
    if (site) {
      if (creep.build(site) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, site, MOVE_OPTIONS);
      }
      return;
    }

    const repair = this.getRepairTarget(creep);
    if (repair) {
      if (creep.repair(repair) === ERR_NOT_IN_RANGE) {
        utils.moveTo(creep, repair, MOVE_OPTIONS);
      }
      return;
    }

    if (creep.room.controller && creep.pos.getRangeTo(creep.room.controller) > 3) {
      utils.moveTo(creep, creep.room.controller, {
        reusePath: 20,
        range: 3,
      });
    }
  },

  getBuildTarget(creep) {
    const cached = creep.memory.workTargetId
      ? Game.getObjectById(creep.memory.workTargetId)
      : null;
    if (cached && cached.progress < cached.progressTotal) return cached;

    const containerSite = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {
      filter: function (site) {
        return site.structureType === STRUCTURE_CONTAINER;
      },
    });
    const site =
      containerSite ||
      creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {
        filter: function (candidate) {
          return candidate.structureType === STRUCTURE_ROAD;
        },
      }) ||
      creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);

    if (site && site.id) creep.memory.workTargetId = site.id;
    else delete creep.memory.workTargetId;

    return site;
  },

  getRepairTarget(creep) {
    const targets = creep.room.find(FIND_STRUCTURES, {
      filter: function (structure) {
        return (
          (
            structure.structureType === STRUCTURE_CONTAINER ||
            structure.structureType === STRUCTURE_ROAD
          ) &&
          structure.hits < structure.hitsMax * 0.6
        );
      },
    });

    if (targets.length <= 0) return null;

    targets.sort(function (a, b) {
      return a.hits / a.hitsMax - b.hits / b.hitsMax;
    });
    return targets[0];
  },

  getHarvestSource(creep) {
    let source = creep.memory.harvestSourceId
      ? Game.getObjectById(creep.memory.harvestSourceId)
      : null;

    if (!source || source.energy <= 0) {
      source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE) ||
        creep.pos.findClosestByPath(FIND_SOURCES);
      if (source) creep.memory.harvestSourceId = source.id;
    }

    return source;
  },
};
