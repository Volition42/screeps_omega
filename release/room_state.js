const utils = require("utils");
const config = require("config");
const constructionStatus = require("construction_status");

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

    const provisionalState = {
      roomName: room.name,
      room: room,
      creeps: creeps,
      spawns: spawns,
      sources: sources,
      sites: sites,
      structures: structures,
      hostileCreeps: hostileCreeps,
      sourceContainers: sourceContainers,
      controllerContainers: controllerContainers,
      extensions: extensions,
      roleCounts: roleCounts,
      energyAvailable: room.energyAvailable,
      energyCapacityAvailable: room.energyCapacityAvailable,
      controllerLevel: room.controller ? room.controller.level : 0,
      phase: phase,
    };

    const buildStatus = constructionStatus.getStatus(room, provisionalState);

    if (phase !== "bootstrap_jr" && buildStatus.bootstrapComplete) {
      phase = "developing";
    }

    const desiredTotalHaulers = this.getDesiredTotalHaulers(sources);

    if (
      phase === "developing" &&
      buildStatus.developingComplete &&
      (roleCounts.worker || 0) >= config.CREEPS.workers &&
      (roleCounts.upgrader || 0) >= config.CREEPS.upgraders &&
      (roleCounts.miner || 0) >=
        sources.length * config.CREEPS.minersPerSource &&
      (roleCounts.hauler || 0) >= desiredTotalHaulers
    ) {
      phase = "stable";
    }

    const finalState = {
      roomName: room.name,
      room: room,
      creeps: creeps,
      spawns: spawns,
      sources: sources,
      sites: sites,
      structures: structures,
      hostileCreeps: hostileCreeps,
      sourceContainers: sourceContainers,
      controllerContainers: controllerContainers,
      extensions: extensions,
      roleCounts: roleCounts,
      energyAvailable: room.energyAvailable,
      energyCapacityAvailable: room.energyCapacityAvailable,
      controllerLevel: room.controller ? room.controller.level : 0,
      phase: phase,
    };

    finalState.buildStatus = constructionStatus.getStatus(room, finalState);

    return finalState;
  },

  getDesiredTotalHaulers(sources) {
    let total = 0;
    const overrides = config.CREEPS.haulersPerSourceBySourceId || {};

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];

      if (Object.prototype.hasOwnProperty.call(overrides, source.id)) {
        total += overrides[source.id];
      } else {
        total += config.CREEPS.haulersPerSourceDefault;
      }
    }

    return total;
  },
};
