/*
Developer Summary:
Room State Collector

Purpose:
- Gather current room facts in one place
- Determine high-level room phase
- Attach synced construction/build status for HUD, directives, and planning

Phase logic:
- bootstrap:
    room below RCL2 and still in direct-survival mode
- foundation:
    room is RCL2+ and is establishing containers + backbone roads
- development:
    core economy buildout is underway
- logistics:
    first link backbone is the active room focus
- specialization:
    advanced room infrastructure is the active room focus
- fortification:
    late-game hardening is the active room focus
- command:
    final room-completion phase reserved for future RCL8 work

Important Notes:
- Legacy / migrated rooms should still advance phases if their real operating
  state matches the expected phase, even if build symmetry is imperfect
*/

const config = require("config");
const constructionStatus = require("construction_status");
const roadmap = require("construction_roadmap");
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
    var hostilePowerCreeps =
      typeof FIND_HOSTILE_POWER_CREEPS !== "undefined"
        ? room.find(FIND_HOSTILE_POWER_CREEPS)
        : [];
    var hostileStructures =
      typeof FIND_HOSTILE_STRUCTURES !== "undefined"
        ? room.find(FIND_HOSTILE_STRUCTURES)
        : [];
    var minerals = room.find(FIND_MINERALS);
    var structuresByType = this.groupStructuresByType(structures);
    var sitesByType = this.groupStructuresByType(sites);
    var roleMap = this.groupCreepsByRole(homeCreeps);
    var roleCounts = this.countRoleMap(roleMap);
    var sourceRoleMap = this.groupCreepsByKey(homeCreeps, "sourceId");
    var targetRoleMap = this.groupCreepsByKey(homeCreeps, "targetId");
    var creepsByCurrentRoom = this.groupCreepsByCurrentRoom(homeCreeps);
    var containers = structuresByType[STRUCTURE_CONTAINER] || [];
    var containerLayout = this.classifyContainers(
      room,
      containers,
      sources,
      minerals,
      spawns,
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
      minerals: minerals,
      sites: sites,
      sitesByType: sitesByType,
      structures: structures,
      structuresByType: structuresByType,
      hostileCreeps: hostileCreeps,
      hostilePowerCreeps: hostilePowerCreeps,
      hostileStructures: hostileStructures,
      containers: containers,
      sourceContainers: containerLayout.sourceContainers,
      sourceContainersBySourceId: containerLayout.sourceContainersBySourceId,
      hubContainer: containerLayout.hubContainer,
      controllerContainer: containerLayout.controllerContainer,
      mineralContainer: containerLayout.mineralContainer,
      supportContainers: containerLayout.supportContainers,
      extensions: extensions,
      roleMap: roleMap,
      roleCounts: roleCounts,
      sourceRoleMap: sourceRoleMap,
      targetRoleMap: targetRoleMap,
      energyAvailable: room.energyAvailable,
      energyCapacityAvailable: room.energyCapacityAvailable,
      controllerLevel: room.controller ? room.controller.level : 0,
    };

    var phase = room.controller && room.controller.level >= 2
      ? "foundation"
      : "bootstrap";
    var desiredTotalHaulers = this.getDesiredTotalHaulers(sources);
    phase = this.resolveRoomPhase(room, sharedState, phase, desiredTotalHaulers);

    var finalState = this.createState(sharedState, phase);
    finalState.defense = defenseManager.collect(room, finalState);
    finalState.logistics = logisticsManager.getRoomPlan(room, finalState);
    finalState.buildStatus = constructionStatus.getStatus(room, finalState);
    finalState.infrastructure = this.getInfrastructureState(room, finalState);

    return finalState;
  },

  createState(sharedState, phase) {
    return Object.assign({}, sharedState, {
      phase: roadmap.normalizePhase(phase),
    });
  },

  resolveRoomPhase(room, sharedState, initialPhase, desiredTotalHaulers) {
    var phase = roadmap.normalizePhase(initialPhase);
    var planningPhase = room.controller
      ? roadmap.getHighestPhaseForControllerLevel(room.controller.level)
      : phase;
    var provisionalState = this.createState(sharedState, planningPhase);
    var buildStatus = constructionStatus.getStatus(room, provisionalState);

    if (
      phase === "foundation" &&
      this.shouldEnterDevelopment(
        room,
        provisionalState,
        buildStatus,
        desiredTotalHaulers,
      )
    ) {
      phase = "development";
    }

    if (
      phase === "development" &&
      this.shouldEnterLogistics(
        room,
        provisionalState,
        buildStatus,
        desiredTotalHaulers,
      )
    ) {
      phase = "logistics";
    }

    if (
      phase === "logistics" &&
      this.shouldEnterSpecialization(room, provisionalState, buildStatus)
    ) {
      phase = "specialization";
    }

    if (
      phase === "specialization" &&
      this.shouldEnterFortification(room, provisionalState, buildStatus)
    ) {
      phase = "fortification";
    }

    if (
      phase === "fortification" &&
      this.shouldEnterCommand(room, provisionalState, buildStatus)
    ) {
      phase = "command";
    }

    return phase;
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

  classifyContainers(room, containers, sources, minerals, spawns) {
    var sourceContainers = [];
    var sourceContainersBySourceId = {};
    var assignedIds = {};
    var controllerContainer = null;
    var hubContainer = null;
    var mineralContainer = null;
    var primaryAnchor =
      room.storage || (spawns && spawns[0] ? spawns[0] : null) || null;

    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      var bestSourceContainer = null;
      var bestSourceRange = Infinity;

      for (var j = 0; j < containers.length; j++) {
        var sourceContainer = containers[j];
        if (assignedIds[sourceContainer.id]) continue;
        if (sourceContainer.pos.getRangeTo(source) > 1) continue;

        var sourceRange = sourceContainer.pos.getRangeTo(primaryAnchor || source);
        if (sourceRange < bestSourceRange) {
          bestSourceContainer = sourceContainer;
          bestSourceRange = sourceRange;
        }
      }

      sourceContainersBySourceId[source.id] = bestSourceContainer;
      if (bestSourceContainer) {
        sourceContainers.push(bestSourceContainer);
        assignedIds[bestSourceContainer.id] = true;
      }
    }

    if (room.controller) {
      controllerContainer = this.pickBestContainer(
        containers,
        assignedIds,
        function (container) {
          return container.pos.getRangeTo(room.controller) <= 4;
        },
        function (container) {
          return container.pos.getRangeTo(room.controller);
        },
      );
      if (controllerContainer) {
        assignedIds[controllerContainer.id] = true;
      }
    }

    if (minerals && minerals.length > 0) {
      var mineral = minerals[0];
      mineralContainer = this.pickBestContainer(
        containers,
        assignedIds,
        function (container) {
          return container.pos.getRangeTo(mineral) <= 1;
        },
        function (container) {
          return container.pos.getRangeTo(primaryAnchor || mineral);
        },
      );
      if (mineralContainer) {
        assignedIds[mineralContainer.id] = true;
      }
    }

    var hubAnchor = primaryAnchor;
    if (hubAnchor) {
      hubContainer = this.pickBestContainer(
        containers,
        assignedIds,
        function (container) {
          if (room.controller && container.pos.getRangeTo(room.controller) <= 4) {
            return false;
          }
          return container.pos.getRangeTo(hubAnchor) <= 4;
        },
        function (container) {
          return container.pos.getRangeTo(hubAnchor);
        },
      );
      if (hubContainer) {
        assignedIds[hubContainer.id] = true;
      }
    }

    var supportContainers = [];
    for (var k = 0; k < containers.length; k++) {
      if (!assignedIds[containers[k].id]) {
        supportContainers.push(containers[k]);
      }
    }

    return {
      sourceContainers: sourceContainers,
      sourceContainersBySourceId: sourceContainersBySourceId,
      controllerContainer: controllerContainer,
      hubContainer: hubContainer,
      mineralContainer: mineralContainer,
      supportContainers: supportContainers,
    };
  },

  pickBestContainer(containers, assignedIds, filter, scoreFn) {
    var best = null;
    var bestScore = Infinity;

    for (var i = 0; i < containers.length; i++) {
      var container = containers[i];
      if (assignedIds[container.id]) continue;
      if (filter && !filter(container)) continue;

      var score = scoreFn ? scoreFn(container) : 0;
      if (score < bestScore) {
        best = container;
        bestScore = score;
      }
    }

    return best;
  },

  shouldEnterDevelopment(room, state, buildStatus, desiredTotalHaulers) {
    if (!room.controller || room.controller.level < 2) {
      return false;
    }

    if (!this.hasDevelopingEconomyBackbone(state, desiredTotalHaulers)) {
      return false;
    }

    if (buildStatus.foundationComplete) return true;

    // Developer note:
    // Legacy room tolerance:
    // if RCL3+ and the minimum economy backbone exists, treat the room as development-ready.
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

    if (buildStatus.developmentComplete) return true;

    // Developer note:
    // Legacy room tolerance:
    // if RCL3+, no construction backlog, required extensions/tower are in place,
    // and economy is healthy, allow logistics focus even if defense/roads are not perfect.
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

  shouldEnterLogistics(room, state, buildStatus, desiredTotalHaulers) {
    if (!room.controller || room.controller.level < 5) return false;

    return this.shouldEnterStable(room, state, buildStatus, desiredTotalHaulers);
  },

  shouldEnterSpecialization(room, state, buildStatus) {
    if (!room.controller || room.controller.level < 6) return false;

    return !!buildStatus.logisticsComplete;
  },

  shouldEnterFortification(room, state, buildStatus) {
    if (!room.controller || room.controller.level < 7) return false;

    return !!buildStatus.specializationComplete;
  },

  shouldEnterCommand(room, state, buildStatus) {
    if (!room.controller || room.controller.level < 8) return false;

    return !!buildStatus.fortificationComplete;
  },

  getDesiredTotalHaulers(sources) {
    var total = 0;
    var overrides = config.CREEPS.haulersPerSourceBySourceId || {};

    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];

      if (Object.prototype.hasOwnProperty.call(overrides, source.id)) {
        total += overrides[source.id];
      } else {
        total += 1;
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
      hubContainer: state.hubContainer || null,
      hasHubContainer: !!state.hubContainer,
      controllerContainer: state.controllerContainer || null,
      hasControllerContainer: !!state.controllerContainer,
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
    if (state.phase === "bootstrap") return "bootstrap";
    if (state.phase === "foundation") return "container_bootstrap";
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
