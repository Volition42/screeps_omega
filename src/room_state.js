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
    var droppedEnergy =
      typeof FIND_DROPPED_RESOURCES !== "undefined"
        ? _.filter(room.find(FIND_DROPPED_RESOURCES), function (resource) {
            return (
              resource.resourceType === RESOURCE_ENERGY &&
              (resource.amount || 0) > 0
            );
          })
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
      droppedEnergy: droppedEnergy,
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
    var resolution = this.resolveRoomPhase(
      room,
      sharedState,
      phase,
      desiredTotalHaulers,
    );
    var finalState =
      resolution && resolution.state
        ? resolution.state
        : this.hydrateDerivedState(
            room,
            this.createState(sharedState, resolution.phase),
          );

    finalState.defense = defenseManager.collect(room, finalState);
    finalState.logistics = logisticsManager.getRoomPlan(room, finalState);

    return finalState;
  },

  createState(sharedState, phase) {
    return Object.assign({}, sharedState, {
      phase: roadmap.normalizePhase(phase),
    });
  },

  resolveRoomPhase(room, sharedState, initialPhase, desiredTotalHaulers) {
    var phase = roadmap.normalizePhase(initialPhase);
    var phaseCache = {};
    var provisionalState = this.getDerivedPhaseState(
      room,
      sharedState,
      phase,
      phaseCache,
    );
    var buildStatus = provisionalState.buildStatus;

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
      provisionalState = this.getDerivedPhaseState(
        room,
        sharedState,
        phase,
        phaseCache,
      );
      buildStatus = provisionalState.buildStatus;
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
      provisionalState = this.getDerivedPhaseState(
        room,
        sharedState,
        phase,
        phaseCache,
      );
      buildStatus = provisionalState.buildStatus;
    }

    if (
      phase === "logistics" &&
      this.shouldEnterSpecialization(room, provisionalState, buildStatus)
    ) {
      phase = "specialization";
      provisionalState = this.getDerivedPhaseState(
        room,
        sharedState,
        phase,
        phaseCache,
      );
      buildStatus = provisionalState.buildStatus;
    }

    if (
      phase === "specialization" &&
      this.shouldEnterFortification(room, provisionalState, buildStatus)
    ) {
      phase = "fortification";
      provisionalState = this.getDerivedPhaseState(
        room,
        sharedState,
        phase,
        phaseCache,
      );
      buildStatus = provisionalState.buildStatus;
    }

    if (
      phase === "fortification" &&
      this.shouldEnterCommand(room, provisionalState, buildStatus)
    ) {
      phase = "command";
      provisionalState = this.getDerivedPhaseState(
        room,
        sharedState,
        phase,
        phaseCache,
      );
    }

    return {
      phase: phase,
      state: provisionalState,
    };
  },

  getDerivedPhaseState(room, sharedState, phase, phaseCache) {
    var key = roadmap.normalizePhase(phase);
    if (phaseCache[key]) {
      return phaseCache[key];
    }

    var state = this.hydrateDerivedState(
      room,
      this.createState(sharedState, key),
    );
    phaseCache[key] = state;
    return state;
  },

  hydrateDerivedState(room, state) {
    if (!state) return state;

    // Developer note:
    // Build status depends on infrastructure (for example storage/link-aware
    // container goals), and infrastructure exposes a few status-derived fields.
    // Run this in two passes so both views stay in sync for ops/HUD/planning.
    state.infrastructure = this.getInfrastructureState(room, state);
    state.buildStatus = constructionStatus.getStatus(room, state);
    state.infrastructure = this.getInfrastructureState(room, state);

    return state;
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

    if (!hubContainer && controllerContainer && hubAnchor) {
      var canReuseControllerContainer =
        controllerContainer.pos.getRangeTo(hubAnchor) <= 4;

      for (
        var controllerSourceIndex = 0;
        canReuseControllerContainer && controllerSourceIndex < sources.length;
        controllerSourceIndex++
      ) {
        if (
          controllerContainer.pos.getRangeTo(sources[controllerSourceIndex]) <= 1
        ) {
          canReuseControllerContainer = false;
        }
      }

      if (canReuseControllerContainer) {
        hubContainer = controllerContainer;
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

    if (buildStatus.logisticsComplete) return true;

    return (
      buildStatus.extensionsBuilt >= buildStatus.extensionsNeeded &&
      buildStatus.towersBuilt >= buildStatus.towersNeeded &&
      buildStatus.storageBuilt >= buildStatus.storageNeeded &&
      buildStatus.linksBuilt >= buildStatus.linksNeeded
    );
  },

  shouldEnterFortification(room, state, buildStatus) {
    if (!room.controller || room.controller.level < 7) return false;

    if (buildStatus.specializationComplete) return true;

    return (
      this.shouldEnterSpecialization(room, state, buildStatus) &&
      buildStatus.terminalBuilt >= buildStatus.terminalNeeded &&
      buildStatus.mineralContainersBuilt >= buildStatus.mineralContainersNeeded &&
      buildStatus.extractorBuilt >= buildStatus.extractorNeeded &&
      buildStatus.labsBuilt >= buildStatus.labsNeeded
    );
  },

  shouldEnterCommand(room, state, buildStatus) {
    if (!room.controller || room.controller.level < 8) return false;

    if (buildStatus.fortificationComplete) return true;

    return (
      this.shouldEnterFortification(room, state, buildStatus) &&
      buildStatus.spawnsBuilt >= buildStatus.spawnsNeeded &&
      buildStatus.factoryBuilt >= buildStatus.factoryNeeded
    );
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
    var terminal = room.terminal || null;
    var mineralContainer = state.mineralContainer || null;
    var futurePlan =
      state &&
      state.buildStatus &&
      state.buildStatus.futurePlan &&
      state.buildStatus.futurePlan.links
        ? state.buildStatus.futurePlan.links
        : null;
    var remainingLinks = links.slice();
    var controllerLink = null;
    var storageLink = null;
    var terminalLink = null;
    var mineralLink = null;
    var sourceLinksBySourceId = {};
    var builtSourceLinks = 0;

    if (controller) {
      controllerLink = this.takePlannedLink(
        remainingLinks,
        futurePlan && futurePlan.controller,
      ) || this.takeMatchingLink(remainingLinks, function (link) {
        return link.pos.getRangeTo(controller) <= 2;
      });
    }

    if (storage) {
      storageLink = this.takePlannedLink(
        remainingLinks,
        futurePlan && futurePlan.storage,
      ) || this.takeMatchingLink(remainingLinks, function (link) {
        return link.pos.getRangeTo(storage) <= 2;
      });
    }

    if (terminal) {
      terminalLink = this.takePlannedLink(
        remainingLinks,
        futurePlan && futurePlan.terminal,
      ) || this.takeMatchingLink(remainingLinks, function (link) {
        return link.pos.getRangeTo(terminal) <= 2;
      });
    }

    if (mineralContainer) {
      mineralLink = this.takePlannedLink(
        remainingLinks,
        futurePlan && futurePlan.mineral,
      ) || this.takeMatchingLink(remainingLinks, function (link) {
        return link.pos.getRangeTo(mineralContainer) <= 2;
      });
    }

    for (var i = 0; i < state.sources.length; i++) {
      var source = state.sources[i];
      var sourcePlan = futurePlan && futurePlan.sources
        ? _.find(futurePlan.sources, function (entry) {
            return entry && entry.sourceId === source.id;
          })
        : null;
      var sourceLink = this.takePlannedLink(
        remainingLinks,
        sourcePlan ? sourcePlan.pos : null,
      ) || this.takeMatchingLink(remainingLinks, function (link) {
        return link.pos.getRangeTo(source) <= 2;
      });

      sourceLinksBySourceId[source.id] = sourceLink;

      if (sourceLink) {
        builtSourceLinks++;
      }
    }

    if (!terminalLink && terminal) {
      terminalLink = this.takeClosestLink(remainingLinks, terminal);
    }

    if (!mineralLink && mineralContainer) {
      mineralLink = this.takeClosestLink(remainingLinks, mineralContainer);
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
      terminalLink: terminalLink,
      hasTerminalLink: !!terminalLink,
      mineralLink: mineralLink,
      hasMineralLink: !!mineralLink,
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

  takePlannedLink(links, serializedPos) {
    if (!serializedPos || !links || links.length <= 0) return null;

    return this.takeMatchingLink(links, function (link) {
      return (
        link.pos &&
        link.pos.x === serializedPos.x &&
        link.pos.y === serializedPos.y &&
        link.pos.roomName === serializedPos.roomName
      );
    });
  },

  takeMatchingLink(links, predicate) {
    if (!links || links.length <= 0) return null;

    for (var i = 0; i < links.length; i++) {
      if (!predicate(links[i])) continue;

      return links.splice(i, 1)[0];
    }

    return null;
  },

  takeClosestLink(links, target) {
    if (!links || links.length <= 0 || !target || !target.pos) return null;

    var bestIndex = -1;
    var bestRange = Infinity;

    for (var i = 0; i < links.length; i++) {
      var range = links[i].pos.getRangeTo(target);
      if (range < bestRange) {
        bestRange = range;
        bestIndex = i;
      }
    }

    if (bestIndex === -1) return null;

    return links.splice(bestIndex, 1)[0];
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
