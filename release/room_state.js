const utils = require("utils");
const config = require("config");

module.exports = {
  collect(room) {
    const creeps = room.find(FIND_MY_CREEPS);
    const spawns = room.find(FIND_MY_SPAWNS);
    const sources = room.find(FIND_SOURCES);
    const sites = room.find(FIND_CONSTRUCTION_SITES);
    const structures = room.find(FIND_STRUCTURES);
    const hostileCreeps = room.find(FIND_HOSTILE_CREEPS);

    const roleCounts = _.countBy(creeps, function (creep) {
      return creep.memory.role;
    });

    const sourceContainers = utils.getSourceContainers(room);
    const controllerContainers = utils.getControllerContainers(room);
    const extensions = _.filter(structures, function (s) {
      return s.structureType === STRUCTURE_EXTENSION;
    });

    let phase = "bootstrap_jr";

    if (room.controller && room.controller.level >= 2) {
      phase = "bootstrap";
    }

    if (
      phase !== "bootstrap_jr" &&
      sourceContainers.length >= sources.length &&
      controllerContainers.length >= 1
    ) {
      phase = "developing";
    }

    if (
      phase === "developing" &&
      (roleCounts.worker || 0) >= config.CREEPS.workers &&
      (roleCounts.upgrader || 0) >= config.CREEPS.upgraders &&
      (roleCounts.miner || 0) >=
        sources.length * config.CREEPS.minersPerSource &&
      (roleCounts.hauler || 0) >= this.getDesiredTotalHaulers(sources)
    ) {
      phase = "stable";
    }

    return {
      roomName: room.name,
      room,
      creeps,
      spawns,
      sources,
      sites,
      structures,
      hostileCreeps,
      sourceContainers,
      controllerContainers,
      extensions,
      roleCounts,
      energyAvailable: room.energyAvailable,
      energyCapacityAvailable: room.energyCapacityAvailable,
      controllerLevel: room.controller ? room.controller.level : 0,
      phase,
    };
  },

  getDesiredTotalHaulers(sources) {
    let total = 0;
    const overrides = config.CREEPS.haulersPerSourceBySourceId || {};

    for (const source of sources) {
      if (Object.prototype.hasOwnProperty.call(overrides, source.id)) {
        total += overrides[source.id];
      } else {
        total += config.CREEPS.haulersPerSourceDefault;
      }
    }

    return total;
  },
};
