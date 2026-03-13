/*
Developer Summary:
Room State Collector

Purpose:
- Gather current room facts in one place
- Determine high-level room phase
- Attach synced construction/build status for HUD, directives, and planning

Phase logic:
- bootstrap_jr:
    room below RCL2
- bootstrap:
    room is RCL2+ but bootstrap roadmap is not complete
- developing:
    bootstrap roadmap complete
- stable:
    development roadmap complete and role counts are healthy
*/

const utils = require("utils");
const config = require("config");
const constructionStatus = require("construction_status");

module.exports = {
  collect(room) {
    var creeps = room.find(FIND_MY_CREEPS);
    var spawns = room.find(FIND_MY_SPAWNS);
    var sources = room.find(FIND_SOURCES);
    var sites = room.find(FIND_CONSTRUCTION_SITES);
    var structures = room.find(FIND_STRUCTURES);
    var hostileCreeps = room.find(FIND_HOSTILE_CREEPS);

    var roleCounts = _.countBy(creeps, function (creep) {
      return creep.memory.role;
    });

    var sourceContainers = utils.getSourceContainers(room);
    var controllerContainers = utils.getControllerContainers(room);
    var extensions = _.filter(structures, function (s) {
      return s.structureType === STRUCTURE_EXTENSION;
    });

    var phase = "bootstrap_jr";

    if (room.controller && room.controller.level >= 2) {
      phase = "bootstrap";
    }

    var provisionalState = {
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

    var buildStatus = constructionStatus.getStatus(room, provisionalState);

    if (phase !== "bootstrap_jr" && buildStatus.bootstrapComplete) {
      phase = "developing";
    }

    var desiredTotalHaulers = this.getDesiredTotalHaulers(sources);

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

    var finalState = {
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
    var total = 0;
    var overrides = config.CREEPS.haulersPerSourceBySourceId || {};

    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];

      if (Object.prototype.hasOwnProperty.call(overrides, source.id)) {
        total += overrides[source.id];
      } else {
        total += config.CREEPS.haulersPerSourceDefault;
      }
    }

    return total;
  },
};
