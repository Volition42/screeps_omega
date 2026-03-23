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
    development roadmap complete and room economy is healthy

Important Notes:
- Legacy / migrated rooms should still advance phases if their real operating
  state matches the expected phase, even if build symmetry is imperfect
*/

const config = require("config");
const constructionStatus = require("construction_status");
const defenseManager = require("defense_manager");
const logisticsManager = require("logistics_manager");

module.exports = {
  collect(room, profiler, roomLabelPrefix) {
    var creeps = room.find(FIND_MY_CREEPS);
    var homeCreeps = this.getHomeCreeps(room.name);
    var spawns = room.find(FIND_MY_SPAWNS);
    var sources = room.find(FIND_SOURCES);
    var sites = room.find(FIND_CONSTRUCTION_SITES);
    var structures = room.find(FIND_STRUCTURES);
    var hostileCreeps = room.find(FIND_HOSTILE_CREEPS);
    var structuresByType = this.groupStructuresByType(structures);
    var sitesByType = this.groupStructuresByType(sites);
    var roleMap = this.groupCreepsByRole(homeCreeps);
    var roleCounts = this.countRoleMap(roleMap);
    var sourceRoleMap = this.groupCreepsByKey(homeCreeps, "sourceId");
    var targetRoleMap = this.groupCreepsByKey(homeCreeps, "targetId");
    var creepsByCurrentRoom = this.groupCreepsByCurrentRoom(homeCreeps);
    var sourceContainers = this.getSourceContainers(structures, sources);
    var sourceContainersBySourceId = this.getSourceContainersBySourceId(
      sourceContainers,
      sources,
    );
    var extensions = structuresByType[STRUCTURE_EXTENSION] || [];

    // Developer note:
    // Cache both local room creeps and home-room-owned creeps once so spawn/HUD
    // logic can reuse the same role and assignment maps without rescanning
    // Game.creeps throughout the tick.
    var sharedState = {
      roomName: room.name,
      room: room,
      creeps: creeps,
      homeCreeps: homeCreeps,
      creepsByCurrentRoom: creepsByCurrentRoom,
      spawns: spawns,
      sources: sources,
      sites: sites,
      sitesByType: sitesByType,
      structures: structures,
      structuresByType: structuresByType,
      hostileCreeps: hostileCreeps,
      sourceContainers: sourceContainers,
      sourceContainersBySourceId: sourceContainersBySourceId,
      extensions: extensions,
      roleMap: roleMap,
      roleCounts: roleCounts,
      sourceRoleMap: sourceRoleMap,
      targetRoleMap: targetRoleMap,
      energyAvailable: room.energyAvailable,
      energyCapacityAvailable: room.energyCapacityAvailable,
      controllerLevel: room.controller ? room.controller.level : 0,
    };

    var phase = "bootstrap_jr";

    if (room.controller && room.controller.level >= 2) {
      phase = "bootstrap";
    }

    var provisionalState = this.createState(sharedState, phase);
    var desiredTotalHaulers = this.getDesiredTotalHaulers(sources);
    var buildStatus = constructionStatus.getStatus(room, provisionalState);

    if (
      phase !== "bootstrap_jr" &&
      this.shouldEnterDeveloping(
        room,
        provisionalState,
        buildStatus,
        desiredTotalHaulers,
      )
    ) {
      phase = "developing";
    }

    if (
      phase === "developing" &&
      this.shouldEnterStable(
        room,
        provisionalState,
        buildStatus,
        desiredTotalHaulers,
      )
    ) {
      phase = "stable";
    }

    var finalState = this.createState(sharedState, phase);
    finalState.defense = defenseManager.collect(room, finalState);
    finalState.logistics = logisticsManager.getRoomPlan(room, finalState);
    finalState.buildStatus = constructionStatus.getStatus(room, finalState);
    finalState.infrastructure = this.getInfrastructureState(room, finalState);

    return finalState;
  },

  createState(sharedState, phase) {
    return Object.assign({}, sharedState, {
      phase: phase,
    });
  },

  getHomeCreeps(roomName) {
    return _.filter(Game.creeps, function (creep) {
      return creep.memory && creep.memory.room === roomName;
    });
  },

  groupStructuresByType(objects) {
    var grouped = {};

    for (var i = 0; i < objects.length; i++) {
      var object = objects[i];
      var type = object.structureType;

      if (!type) continue;
      if (!grouped[type]) grouped[type] = [];

      grouped[type].push(object);
    }

    return grouped;
  },

  groupCreepsByRole(creeps) {
    var grouped = {};

    for (var i = 0; i < creeps.length; i++) {
      var creep = creeps[i];
      var role = creep.memory && creep.memory.role ? creep.memory.role : "none";

      if (!grouped[role]) grouped[role] = [];
      grouped[role].push(creep);
    }

    return grouped;
  },

  countRoleMap(roleMap) {
    var counts = {};

    for (var role in roleMap) {
      if (!Object.prototype.hasOwnProperty.call(roleMap, role)) continue;
      counts[role] = roleMap[role].length;
    }

    return counts;
  },

  groupCreepsByKey(creeps, memoryKey) {
    var grouped = {};

    for (var i = 0; i < creeps.length; i++) {
      var creep = creeps[i];
      var role = creep.memory && creep.memory.role ? creep.memory.role : "none";
      var key = creep.memory ? creep.memory[memoryKey] : null;

      if (!key) continue;
      if (!grouped[role]) grouped[role] = {};
      if (!grouped[role][key]) grouped[role][key] = [];

      grouped[role][key].push(creep);
    }

    return grouped;
  },

  groupCreepsByCurrentRoom(creeps) {
    var grouped = {};

    for (var i = 0; i < creeps.length; i++) {
      var creep = creeps[i];
      var roomName = creep.pos ? creep.pos.roomName : null;

      if (!roomName) continue;
      if (!grouped[roomName]) grouped[roomName] = [];

      grouped[roomName].push(creep);
    }

    return grouped;
  },

  getSourceContainers(structures, sources) {
    return _.filter(structures, function (structure) {
      if (structure.structureType !== STRUCTURE_CONTAINER) return false;

      return _.some(sources, function (source) {
        return structure.pos.getRangeTo(source) <= 1;
      });
    });
  },

  getSourceContainersBySourceId(sourceContainers, sources) {
    var bySourceId = {};

    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      bySourceId[source.id] =
        _.find(sourceContainers, function (container) {
          return container.pos.getRangeTo(source) <= 1;
        }) || null;
    }

    return bySourceId;
  },

  shouldEnterDeveloping(room, state, buildStatus, desiredTotalHaulers) {
    if (!this.hasDevelopingEconomyBackbone(state, desiredTotalHaulers)) {
      return false;
    }

    if (buildStatus.bootstrapComplete) return true;

    // Developer note:
    // Legacy room tolerance:
    // if RCL3+ and the minimum economy backbone exists, treat the room as developing.
    if (
      room.controller &&
      room.controller.level >= 3 &&
      buildStatus.sourceContainersBuilt >= buildStatus.sourceContainersNeeded
    ) {
      return true;
    }

    return false;
  },

  hasDevelopingEconomyBackbone(state, desiredTotalHaulers) {
    var roleCounts = state.roleCounts || {};
    var workers = roleCounts.worker || 0;
    var jrWorkers = roleCounts.jrworker || 0;
    var miners = roleCounts.miner || 0;
    var haulers = roleCounts.hauler || 0;
    var laborers = workers + jrWorkers;
    var totalEconomyCreeps = laborers + miners + haulers;
    var minimumEnergy = Math.min(300, state.energyCapacityAvailable || 300);

    if (laborers <= 0) return false;
    if (totalEconomyCreeps <= 0) return false;
    if (state.energyAvailable < minimumEnergy && totalEconomyCreeps <= 1) {
      return false;
    }

    return true;
  },

  shouldEnterStable(room, state, buildStatus, desiredTotalHaulers) {
    var roleCounts = state.roleCounts || {};
    var laborers = (roleCounts.worker || 0) + (roleCounts.jrworker || 0);
    var minimumHaulers = Math.max(1, Math.min(desiredTotalHaulers, state.sources.length || 1));

    var economyHealthy =
      laborers >= 1 &&
      (roleCounts.upgrader || 0) >= 1 &&
      (roleCounts.miner || 0) >=
        state.sources.length * config.CREEPS.minersPerSource &&
      (roleCounts.hauler || 0) >= minimumHaulers;

    if (!economyHealthy) return false;

    if (buildStatus.developingComplete) return true;

    // Developer note:
    // Legacy room tolerance:
    // if RCL3+, no construction backlog, required extensions/tower are in place,
    // and economy is healthy, allow stable even if defense/roads are not perfect.
    if (
      room.controller &&
      room.controller.level >= 3 &&
      buildStatus.sites === 0 &&
      buildStatus.extensionsBuilt >= buildStatus.extensionsNeeded &&
      buildStatus.towersBuilt >= buildStatus.towersNeeded
    ) {
      return true;
    }

    return false;
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

  getInfrastructureState(room, state) {
    var structuresByType = state.structuresByType || {};
    var links = structuresByType[STRUCTURE_LINK] || [];
    var storage = room.storage || null;
    var controller = room.controller || null;
    var controllerLink = null;
    var storageLink = null;
    var sourceLinksBySourceId = {};
    var builtSourceLinks = 0;

    if (controller) {
      controllerLink =
        _.find(links, function (link) {
          return link.pos.getRangeTo(controller) <= 2;
        }) || null;
    }

    if (storage) {
      storageLink =
        _.find(links, function (link) {
          return link.pos.getRangeTo(storage) <= 2;
        }) || null;
    }

    for (var i = 0; i < state.sources.length; i++) {
      var source = state.sources[i];
      var sourceLink =
        _.find(links, function (link) {
          return link.pos.getRangeTo(source) <= 2;
        }) || null;

      sourceLinksBySourceId[source.id] = sourceLink;

      if (sourceLink) {
        builtSourceLinks++;
      }
    }

    return {
      hasStorage: !!storage,
      storageEnergy: storage ? storage.store[RESOURCE_ENERGY] || 0 : 0,
      controllerLink: controllerLink,
      hasControllerLink: !!controllerLink,
      storageLink: storageLink,
      hasStorageLink: !!storageLink,
      sourceLinksBySourceId: sourceLinksBySourceId,
      builtSourceLinks: builtSourceLinks,
      sourceLinksNeeded: state.buildStatus
        ? state.buildStatus.sourceLinksNeeded || 0
        : 0,
      roadmapPhase: state.buildStatus
        ? state.buildStatus.roadmapPhase || state.phase
        : state.phase,
      economyStage: this.getEconomyStage(room, state, {
        hasStorage: !!storage,
        hasControllerLink: !!controllerLink,
        hasStorageLink: !!storageLink,
        builtSourceLinks: builtSourceLinks,
      }),
    };
  },

  getEconomyStage(room, state, infrastructure) {
    if (state.phase === "bootstrap_jr") return "bootstrap_jr";
    if (state.phase === "bootstrap") return "container_bootstrap";
    if (!infrastructure.hasStorage) return "container_economy";

    if (
      room.controller &&
      room.controller.level >= 6 &&
      infrastructure.hasControllerLink &&
      infrastructure.hasStorageLink
    ) {
      return "advanced_logistics";
    }

    if (
      room.controller &&
      room.controller.level >= 5 &&
      infrastructure.hasControllerLink
    ) {
      return "controller_link_ready";
    }

    return "storage_economy";
  },
};
