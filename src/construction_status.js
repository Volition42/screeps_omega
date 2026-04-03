/*
Developer Summary:
Construction Status

Purpose:
- Shared source of truth for roadmap completion
- Keeps room_state, construction_manager, HUD, and directives in sync
- Calculates current construction targets based on phase + roadmap + stamp plans

Important Notes:
- Road goals include backbone roads plus stamp-road goals
- Legacy / migrated rooms may not match the stamp layout perfectly
- Phase completion should reflect real room readiness, not demand perfect symmetry
*/

const config = require("config");
const roadmap = require("construction_roadmap");
const stamps = require("stamp_library");
const defenseLayout = require("defense_layout");

module.exports = {
  getStatus(room, state) {
    if (!room.controller) {
      return this.getEmptyStatus();
    }

    var plan = roadmap.getPlan(state.phase, room.controller.level);
    var goals = plan.goals || {};
    var anchor = stamps.getAnchorOrigin(room, state);
    var futurePlan = this.getFuturePlan(room);

    var sourceContainersBuilt = this.getSourceContainerCount(room, state);
    var sourceContainersNeeded = state.sources ? state.sources.length : 0;
    var hubContainersNeeded = this.getHubContainerGoal(room, state, plan);
    var hubContainersBuilt = this.getHubContainerCount(room, state);
    var controllerContainersNeeded = this.getControllerContainerGoal(
      room,
      state,
      plan,
    );
    var controllerContainersBuilt = this.getControllerContainerCount(room, state);
    var mineralContainersNeeded = this.getMineralContainerGoal(room, state, plan);
    var mineralContainersBuilt = this.getMineralContainerCount(room, state);

    var extensionsNeeded = roadmap.getDesiredExtensionCount(
      room.controller.level,
    );
    var extensionsBuilt = this.countBuiltAndSites(
      room,
      state,
      STRUCTURE_EXTENSION,
    );

    var towersNeeded = roadmap.getDesiredTowerCount(room.controller.level);
    var towersBuilt = this.countBuiltAndSites(room, state, STRUCTURE_TOWER);

    var storageNeeded = this.hasAction(plan, "storage")
      ? roadmap.getDesiredStructureCount(room.controller.level, STRUCTURE_STORAGE)
      : 0;
    var storageBuilt = this.countBuiltAndSites(room, state, STRUCTURE_STORAGE);
    var spawnsNeeded = this.getStructureGoal(
      room,
      plan,
      "spawns",
      STRUCTURE_SPAWN,
    );
    var spawnsBuilt = this.countBuiltAndSites(room, state, STRUCTURE_SPAWN);
    var linkGoal = this.getLinkGoal(room, state, plan);
    var linksBuilt = this.countBuiltAndSites(room, state, STRUCTURE_LINK);
    var terminalNeeded = this.hasAction(plan, "terminal")
      ? roadmap.getDesiredStructureCount(room.controller.level, STRUCTURE_TERMINAL)
      : 0;
    var terminalBuilt = this.countBuiltAndSites(room, state, STRUCTURE_TERMINAL);
    var extractorNeeded = this.getExtractorGoal(room, plan);
    var extractorBuilt = this.countBuiltAndSites(room, state, STRUCTURE_EXTRACTOR);
    var mineralAccessRoadPath = this.getMineralAccessRoadPath(room, state, plan);
    var mineralAccessRoadsNeeded = mineralAccessRoadPath.length;
    var mineralAccessRoadsBuilt = this.countRoadCoverageOnPath(
      room,
      state,
      mineralAccessRoadPath,
    );
    var labsNeeded = this.hasAction(plan, "labs")
      ? Math.min(
          goals.advancedStructures && goals.advancedStructures.labs
            ? goals.advancedStructures.labs
            : roadmap.getDesiredLabCount(room.controller.level),
          roadmap.getDesiredLabCount(room.controller.level),
        )
      : 0;
    var labsBuilt = this.countBuiltAndSites(room, state, STRUCTURE_LAB);
    var factoryNeeded = this.getStructureGoal(
      room,
      plan,
      "factory",
      STRUCTURE_FACTORY,
    );
    var factoryBuilt = this.countBuiltAndSites(room, state, STRUCTURE_FACTORY);
    var observerNeeded = this.getStructureGoal(
      room,
      plan,
      "observer",
      STRUCTURE_OBSERVER,
    );
    var observerBuilt = this.countBuiltAndSites(room, state, STRUCTURE_OBSERVER);
    var powerSpawnNeeded = this.getStructureGoal(
      room,
      plan,
      "powerSpawn",
      STRUCTURE_POWER_SPAWN,
    );
    var powerSpawnBuilt = this.countBuiltAndSites(
      room,
      state,
      STRUCTURE_POWER_SPAWN,
    );
    var nukerNeeded = this.getStructureGoal(
      room,
      plan,
      "nuker",
      STRUCTURE_NUKER,
    );
    var nukerBuilt = this.countBuiltAndSites(room, state, STRUCTURE_NUKER);

    var roadsBuilt = this.countBuiltAndSites(room, state, STRUCTURE_ROAD);
    var roadsNeeded = this.getRoadGoal(room, state, plan, anchor, futurePlan);

    var defenseGoal = this.getDefenseGoal(room, state);
    var wallsBuilt = this.countBuiltAndSites(room, state, STRUCTURE_WALL);
    var rampartsBuilt = this.countBuiltAndSites(
      room,
      state,
      STRUCTURE_RAMPART,
    );

    var sites = state.sites ? state.sites.length : room.find(FIND_CONSTRUCTION_SITES).length;

    var status = {
      phase: state.phase,
      roadmapPhase: plan.roadmapPhase,
      sites: sites,

      sourceContainersBuilt: sourceContainersBuilt,
      sourceContainersNeeded: sourceContainersNeeded,
      hubContainersBuilt: hubContainersBuilt,
      hubContainersNeeded: hubContainersNeeded,
      controllerContainersBuilt: controllerContainersBuilt,
      controllerContainersNeeded: controllerContainersNeeded,
      mineralContainersBuilt: mineralContainersBuilt,
      mineralContainersNeeded: mineralContainersNeeded,
      extensionsBuilt: extensionsBuilt,
      extensionsNeeded: extensionsNeeded,

      towersBuilt: towersBuilt,
      towersNeeded: towersNeeded,

      storageBuilt: storageBuilt,
      storageNeeded: storageNeeded,

      spawnsBuilt: spawnsBuilt,
      spawnsNeeded: spawnsNeeded,

      linksBuilt: linksBuilt,
      linksNeeded: linkGoal.total,
      controllerLinksNeeded: linkGoal.controller,
      sourceLinksNeeded: linkGoal.source,
      storageLinksNeeded: linkGoal.storage,

      terminalBuilt: terminalBuilt,
      terminalNeeded: terminalNeeded,

      extractorBuilt: extractorBuilt,
      extractorNeeded: extractorNeeded,

      mineralAccessRoadsBuilt: mineralAccessRoadsBuilt,
      mineralAccessRoadsNeeded: mineralAccessRoadsNeeded,

      labsBuilt: labsBuilt,
      labsNeeded: labsNeeded,

      factoryBuilt: factoryBuilt,
      factoryNeeded: factoryNeeded,

      observerBuilt: observerBuilt,
      observerNeeded: observerNeeded,

      powerSpawnBuilt: powerSpawnBuilt,
      powerSpawnNeeded: powerSpawnNeeded,

      nukerBuilt: nukerBuilt,
      nukerNeeded: nukerNeeded,

      roadsBuilt: roadsBuilt,
      roadsNeeded: roadsNeeded,

      wallsBuilt: wallsBuilt,
      wallsNeeded: defenseGoal.walls,

      rampartsBuilt: rampartsBuilt,
      rampartsNeeded: defenseGoal.ramparts,

      futurePlan: futurePlan,
    };

    status.unlockedLabsNeeded = this.getUnlockedLabGoal(
      room,
      state,
      plan,
      status,
    );

    status.roadCompletionRatio =
      status.roadsNeeded > 0 ? status.roadsBuilt / status.roadsNeeded : 1;

    status.foundationComplete =
      status.sourceContainersBuilt >= status.sourceContainersNeeded &&
      status.hubContainersBuilt >= status.hubContainersNeeded &&
      status.controllerContainersBuilt >= status.controllerContainersNeeded &&
      this.hasEnoughRoadsForFoundation(status, room);

    status.developmentComplete =
      status.foundationComplete &&
      status.extensionsBuilt >= status.extensionsNeeded &&
      status.towersBuilt >= status.towersNeeded &&
      status.storageBuilt >= status.storageNeeded &&
      status.wallsBuilt >= status.wallsNeeded &&
      status.rampartsBuilt >= status.rampartsNeeded;

    status.logisticsComplete =
      status.developmentComplete &&
      status.linksBuilt >= status.linksNeeded;
    status.specializationComplete =
      status.logisticsComplete &&
      status.terminalBuilt >= status.terminalNeeded &&
      status.mineralContainersBuilt >= status.mineralContainersNeeded &&
      status.extractorBuilt >= status.extractorNeeded &&
      status.labsBuilt >= status.labsNeeded;
    status.fortificationComplete =
      status.specializationComplete &&
      status.factoryBuilt >= status.factoryNeeded;
    status.commandComplete =
      status.fortificationComplete &&
      status.spawnsBuilt >= status.spawnsNeeded &&
      status.observerBuilt >= status.observerNeeded &&
      status.powerSpawnBuilt >= status.powerSpawnNeeded &&
      status.nukerBuilt >= status.nukerNeeded;

    // Temporary compatibility aliases while downstream callers migrate to the
    // new phase vocabulary.
    status.bootstrapComplete = status.foundationComplete;
    status.developingComplete = status.developmentComplete;
    status.stableReady = status.developmentComplete;
    status.rcl5Ready = status.logisticsComplete;
    status.rcl6Ready = status.specializationComplete;
    status.currentRoadmapReady = this.isCurrentRoadmapReady(status);
    status.futurePlanReady =
      !!futurePlan &&
      (!status.linksNeeded || !!futurePlan.linkPlanReady) &&
      (!status.terminalNeeded || !!futurePlan.terminalPlanReady) &&
      (!status.mineralContainersNeeded || !!futurePlan.mineralContainerPlanReady) &&
      (!status.extractorNeeded || !!futurePlan.extractorPlanReady) &&
      (!status.labsNeeded || !!futurePlan.labPlanReady) &&
      (!status.factoryNeeded || !!futurePlan.factoryPlanReady) &&
      (!status.observerNeeded || !!futurePlan.observerPlanReady) &&
      (!status.powerSpawnNeeded || !!futurePlan.powerSpawnPlanReady) &&
      (!status.nukerNeeded || !!futurePlan.nukerPlanReady);

    return status;
  },

  getEmptyStatus() {
    return {
      phase: "bootstrap",
      sites: 0,

      sourceContainersBuilt: 0,
      sourceContainersNeeded: 0,
      hubContainersBuilt: 0,
      hubContainersNeeded: 0,
      controllerContainersBuilt: 0,
      controllerContainersNeeded: 0,
      mineralContainersBuilt: 0,
      mineralContainersNeeded: 0,
      extensionsBuilt: 0,
      extensionsNeeded: 0,

      towersBuilt: 0,
      towersNeeded: 0,

      storageBuilt: 0,
      storageNeeded: 0,

      spawnsBuilt: 0,
      spawnsNeeded: 0,

      linksBuilt: 0,
      linksNeeded: 0,
      controllerLinksNeeded: 0,
      sourceLinksNeeded: 0,
      storageLinksNeeded: 0,

      terminalBuilt: 0,
      terminalNeeded: 0,

      extractorBuilt: 0,
      extractorNeeded: 0,

      mineralAccessRoadsBuilt: 0,
      mineralAccessRoadsNeeded: 0,

      labsBuilt: 0,
      labsNeeded: 0,
      unlockedLabsNeeded: 0,

      factoryBuilt: 0,
      factoryNeeded: 0,

      observerBuilt: 0,
      observerNeeded: 0,

      powerSpawnBuilt: 0,
      powerSpawnNeeded: 0,

      nukerBuilt: 0,
      nukerNeeded: 0,

      roadsBuilt: 0,
      roadsNeeded: 0,

      wallsBuilt: 0,
      wallsNeeded: 0,

      rampartsBuilt: 0,
      rampartsNeeded: 0,

      roadCompletionRatio: 0,

      foundationComplete: false,
      developmentComplete: false,
      logisticsComplete: false,
      specializationComplete: false,
      fortificationComplete: false,
      commandComplete: false,
      bootstrapComplete: false,
      developingComplete: false,
      stableReady: false,
      rcl5Ready: false,
      rcl6Ready: false,
      currentRoadmapReady: false,
      futurePlanReady: false,
      roadmapPhase: "bootstrap",
      futurePlan: this.getEmptyFuturePlan(),
    };
  },

  hasEnoughRoadsForFoundation(status, room) {
    // Developer note:
    // Migrated rooms may have useful but non-perfect road layouts.
    // Treat foundation as complete once roads are "good enough" for operation.
    if (status.roadsNeeded <= 0) return true;

    if (status.roadsBuilt >= status.roadsNeeded) return true;

    if (status.roadCompletionRatio >= 0.6) return true;

    if (
      room.controller &&
      room.controller.level >= 3 &&
      status.roadsBuilt >= 8
    ) {
      return true;
    }

    return false;
  },

  countBuiltAndSites(room, state, structureType) {
    var built =
      state.structuresByType && state.structuresByType[structureType]
        ? state.structuresByType[structureType].length
        : room.find(FIND_STRUCTURES, {
            filter: function (s) {
              return s.structureType === structureType;
            },
          }).length;

    var sites =
      state.sitesByType && state.sitesByType[structureType]
        ? state.sitesByType[structureType].length
        : room.find(FIND_CONSTRUCTION_SITES, {
            filter: function (s) {
              return s.structureType === structureType;
            },
          }).length;

    return built + sites;
  },

  countContainerSites(room, state, predicate) {
    var sites =
      state.sitesByType && state.sitesByType[STRUCTURE_CONTAINER]
        ? state.sitesByType[STRUCTURE_CONTAINER]
        : room.find(FIND_CONSTRUCTION_SITES, {
            filter: function (site) {
              return site.structureType === STRUCTURE_CONTAINER;
            },
          });

    var total = 0;
    for (var i = 0; i < sites.length; i++) {
      if (predicate(sites[i])) total++;
    }

    return total;
  },

  getSourceContainerCount(room, state) {
    var built = state.sourceContainers ? state.sourceContainers.length : 0;
    var sources = state.sources || [];

    return (
      built +
      this.countContainerSites(room, state, function (site) {
        for (var i = 0; i < sources.length; i++) {
          if (site.pos.getRangeTo(sources[i]) <= 1) return true;
        }
        return false;
      })
    );
  },

  getHubContainerGoal(room, state, plan) {
    if (!this.hasAction(plan, "hubContainer")) return 0;
    if (state.infrastructure && state.infrastructure.hasStorage) return 0;
    return 1;
  },

  getHubContainerCount(room, state) {
    var built = state.hubContainer ? 1 : 0;
    var anchor = room.storage || (state.spawns && state.spawns[0]) || null;
    var sources = state.sources || [];
    var controller = room.controller || null;

    if (!anchor) return built;

    return (
      built +
      this.countContainerSites(room, state, function (site) {
        if (controller && site.pos.getRangeTo(controller) <= 4) return false;
        for (var i = 0; i < sources.length; i++) {
          if (site.pos.getRangeTo(sources[i]) <= 1) return false;
        }
        return site.pos.getRangeTo(anchor) <= 4;
      })
    );
  },

  getControllerContainerGoal(room, state, plan) {
    if (!room.controller || room.controller.level < 2) return 0;
    if (!this.hasAction(plan, "controllerContainer")) return 0;
    if (
      state.infrastructure &&
      state.infrastructure.hasControllerLink
    ) {
      return 0;
    }
    return 1;
  },

  getControllerContainerCount(room, state) {
    if (!room.controller) return 0;
    var built = state.controllerContainer ? 1 : 0;
    var sources = state.sources || [];

    return (
      built +
      this.countContainerSites(room, state, function (site) {
        if (site.pos.getRangeTo(room.controller) > 4) return false;
        for (var i = 0; i < sources.length; i++) {
          if (site.pos.getRangeTo(sources[i]) <= 1) return false;
        }
        return true;
      })
    );
  },

  getMineralContainerGoal(room, state, plan) {
    if (!this.hasAction(plan, "mineralContainer")) return 0;

    var minerals = state.minerals || room.find(FIND_MINERALS);
    return minerals && minerals.length > 0 ? 1 : 0;
  },

  getMineralContainerCount(room, state) {
    var minerals = state.minerals || room.find(FIND_MINERALS);
    if (!minerals || minerals.length === 0) return 0;

    var mineral = minerals[0];
    var built = state.mineralContainer ? 1 : 0;

    return (
      built +
      this.countContainerSites(room, state, function (site) {
        return site.pos.getRangeTo(mineral) <= 1;
      })
    );
  },

  getRoadGoal(room, state, plan, anchor, futurePlan) {
    var total = 0;

    total += this.getBackboneRoadGoal(room, state);

    if (anchor && this.hasAction(plan, "anchorRoads")) {
      total += this.countStampRoadCells(room, anchor, "anchor_v1");
    }

    if (anchor && this.hasAction(plan, "extensionStamps")) {
      var extensionStampsNeeded = Math.ceil(
        roadmap.getDesiredExtensionCount(room.controller.level) /
          Math.max(1, stamps.getExtensionCapacity("extension_plus_v1")),
      );

      var extensionOrigins = stamps.getExtensionStampOrigins(anchor);
      for (
        var i = 0;
        i < extensionOrigins.length && i < extensionStampsNeeded;
        i++
      ) {
        total += this.countStampRoadCells(
          room,
          extensionOrigins[i],
          "extension_plus_v1",
        );
      }
    }

    if (anchor && this.hasAction(plan, "towerStamp")) {
      var towerStampsNeeded =
        roadmap.getDesiredTowerCount(room.controller.level) > 0 ? 1 : 0;

      var towerOrigins = stamps.getTowerStampOrigins(anchor);
      for (var j = 0; j < towerOrigins.length && j < towerStampsNeeded; j++) {
        total += this.countStampRoadCells(
          room,
          towerOrigins[j],
          "tower_cluster_v1",
        );
      }
    }

    if (this.hasAction(plan, "storage")) {
      var storageOrigin =
        futurePlan && futurePlan.storagePos
          ? this.deserializePos(futurePlan.storagePos)
          : this.getStorageOrigin(room, state);

      if (storageOrigin) {
        total += this.countStampRoadCells(room, storageOrigin, "storage_hub_v1");
      }
    }

    if (
      this.hasAction(plan, "labs") &&
      futurePlan &&
      futurePlan.labs &&
      futurePlan.labs.origin
    ) {
      total += this.countStampRoadCells(
        room,
        this.deserializePos(futurePlan.labs.origin),
        "lab_cluster_v1",
      );
    }

    return total;
  },

  getMineralAccessRoadPath(room, state, plan) {
    if (!room.controller || room.controller.level < 6) return [];
    if (!this.hasAction(plan, "mineralAccessRoad")) return [];
    if (!this.isMineralAccessRoadUnlocked(room, state)) return [];

    var mineralContainer = state.mineralContainer || null;
    var anchor = this.getMineralRoadAnchor(room, state);

    if (!mineralContainer || !anchor) return [];

    return anchor.pos.findPathTo(mineralContainer.pos, {
      ignoreCreeps: true,
      range: 1,
    });
  },

  countRoadCoverageOnPath(room, state, path) {
    if (!path || path.length === 0) return 0;

    var roads =
      state.structuresByType && state.structuresByType[STRUCTURE_ROAD]
        ? state.structuresByType[STRUCTURE_ROAD]
        : room.find(FIND_STRUCTURES, {
            filter: function (structure) {
              return structure.structureType === STRUCTURE_ROAD;
            },
          });
    var roadSites =
      state.sitesByType && state.sitesByType[STRUCTURE_ROAD]
        ? state.sitesByType[STRUCTURE_ROAD]
        : room.find(FIND_CONSTRUCTION_SITES, {
            filter: function (site) {
              return site.structureType === STRUCTURE_ROAD;
            },
          });
    var covered = {};
    var total = 0;

    for (var i = 0; i < roads.length; i++) {
      covered[this.getPosKey(roads[i].pos)] = true;
    }
    for (var j = 0; j < roadSites.length; j++) {
      covered[this.getPosKey(roadSites[j].pos)] = true;
    }

    for (var k = 0; k < path.length; k++) {
      if (covered[path[k].x + ":" + path[k].y]) {
        total++;
      }
    }

    return total;
  },

  getBackboneRoadGoal(room, state) {
    var spawn = state.spawns && state.spawns[0];
    if (!spawn) return 0;

    var estimate = 0;
    var sourceContainers = state.sourceContainers || [];

    for (var i = 0; i < sourceContainers.length; i++) {
      var sourceContainer = sourceContainers[i];
      estimate += Math.max(1, sourceContainer.pos.getRangeTo(spawn.pos));
    }

    if (room.controller) {
      estimate += Math.max(1, spawn.pos.getRangeTo(room.controller.pos) - 2);
    }

    return estimate;
  },

  countStampRoadCells(room, origin, stampName) {
    var terrain = room.getTerrain();
    var count = 0;

    stamps.forEachRoadPosition(
      origin,
      stampName,
      function (pos) {
        if (pos.x < 2 || pos.x > 47 || pos.y < 2 || pos.y > 47) return;
        if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) return;
        count++;
      },
      this,
    );

    return count;
  },

  getPosKey(pos) {
    return pos.x + ":" + pos.y;
  },

  deserializePos(pos) {
    if (!pos) return null;

    return new RoomPosition(pos.x, pos.y, pos.roomName);
  },

  getMineralRoadAnchor(room, state) {
    var storage = room.storage || null;
    var terminal = room.terminal || null;
    var spawn = state.spawns && state.spawns[0] ? state.spawns[0] : null;

    return storage || terminal || spawn || null;
  },

  isMineralAccessRoadUnlocked(room, state) {
    if (this.getActiveMineralMinerCount(room, state) > 0) return true;

    return !!(
      Memory.rooms &&
      Memory.rooms[room.name] &&
      Memory.rooms[room.name].construction &&
      Memory.rooms[room.name].construction.mineralAccessRoadUnlocked
    );
  },

  hasMatureMineralInfrastructure(room, state) {
    if (!room.controller || room.controller.level < 6) return false;
    if (!room.storage || !state || !state.mineralContainer) return false;

    var minerals = state.minerals || room.find(FIND_MINERALS);
    if (!minerals || minerals.length === 0) return false;

    var mineral = minerals[0];
    var structuresByType = state.structuresByType || {};
    var extractors = structuresByType[STRUCTURE_EXTRACTOR] || [];
    var labs = structuresByType[STRUCTURE_LAB] || [];
    var terminals = structuresByType[STRUCTURE_TERMINAL] || [];
    var factories = structuresByType[STRUCTURE_FACTORY] || [];
    var observers = structuresByType[STRUCTURE_OBSERVER] || [];
    var powerSpawns = structuresByType[STRUCTURE_POWER_SPAWN] || [];
    var nukers = structuresByType[STRUCTURE_NUKER] || [];

    var hasExtractor = _.some(extractors, function (extractor) {
      return extractor.pos.isEqualTo(mineral.pos);
    });
    var hasAdvancedInfra =
      terminals.length > 0 ||
      labs.length >= 3 ||
      factories.length > 0 ||
      observers.length > 0 ||
      powerSpawns.length > 0 ||
      nukers.length > 0;

    return hasExtractor && hasAdvancedInfra;
  },

  isMineralProgramUnlocked(room, state) {
    if (!room.controller || room.controller.level < 6) return false;
    if (state && state.buildStatus && state.buildStatus.specializationComplete) {
      return true;
    }
    if (this.getActiveMineralMinerCount(room, state) > 0) return true;
    if (this.hasMatureMineralInfrastructure(room, state)) return true;

    return !!(
      Memory.rooms &&
      Memory.rooms[room.name] &&
      Memory.rooms[room.name].construction &&
      Memory.rooms[room.name].construction.mineralProgramUnlocked
    );
  },

  getActiveMineralMinerCount(room, state) {
    var roleCounts = state && state.roleCounts ? state.roleCounts : {};
    if ((roleCounts.mineral_miner || 0) > 0) {
      return roleCounts.mineral_miner;
    }

    return room.find(FIND_MY_CREEPS, {
      filter: function (creep) {
        return creep.memory && creep.memory.role === "mineral_miner";
      },
    }).length;
  },

  getStorageOrigin(room, state) {
    var storages =
      state.structuresByType && state.structuresByType[STRUCTURE_STORAGE]
        ? state.structuresByType[STRUCTURE_STORAGE]
        : [];
    if (storages.length > 0) {
      return storages[0].pos;
    }

    var storageSites =
      state.sitesByType && state.sitesByType[STRUCTURE_STORAGE]
        ? state.sitesByType[STRUCTURE_STORAGE]
        : [];
    if (storageSites.length > 0) {
      return storageSites[0].pos;
    }

    return null;
  },

  getDefenseGoal(room, state) {
    var plan = defenseLayout.getPlan(room, state);

    if (!plan) {
      return { walls: 0, ramparts: 0 };
    }

    return {
      walls: plan.walls.length,
      ramparts: plan.gates.length,
    };
  },

  hasAction(plan, action) {
    if (!plan) return false;

    var buildList = plan.buildList || [];
    return buildList.indexOf(action) !== -1;
  },

  getLinkGoal(room, state, plan) {
    if (!this.hasAction(plan, "links")) {
      return { total: 0, controller: 0, source: 0, storage: 0 };
    }

    var maxLinks = roadmap.getDesiredLinkCount(
      room.controller ? room.controller.level : 0,
    );
    var goal = plan.goals && plan.goals.linkPlanning ? plan.goals.linkPlanning : {};
    var controllerLinks = goal.controllerLink ? 1 : 0;
    var sourceLinks = Math.min(
      state.sources ? state.sources.length : 0,
      goal.sourceLinks || 0,
    );
    var storageLinks = goal.storageLink ? 1 : 0;
    var total = Math.min(maxLinks, controllerLinks + sourceLinks + storageLinks);
    var controllerTarget = Math.min(controllerLinks, total);
    var sourceTarget = Math.max(
      0,
      Math.min(sourceLinks, total - controllerTarget),
    );
    var storageTarget = Math.max(0, total - controllerTarget - sourceTarget);

    return {
      total: total,
      controller: controllerTarget,
      source: sourceTarget,
      storage: storageTarget,
    };
  },

  getExtractorGoal(room, plan) {
    if (!this.hasAction(plan, "extractor")) return 0;

    var minerals = room.find(FIND_MINERALS);
    if (!minerals || minerals.length === 0) return 0;

    return roadmap.getDesiredStructureCount(
      room.controller ? room.controller.level : 0,
      STRUCTURE_EXTRACTOR,
    );
  },

  getStructureGoal(room, plan, action, structureType) {
    if (!this.hasAction(plan, action)) return 0;

    return roadmap.getDesiredStructureCount(
      room.controller ? room.controller.level : 0,
      structureType,
    );
  },

  getUnlockedLabGoal(room, state, plan, status) {
    if (!room.controller) return 0;

    var controllerLevel = room.controller.level || 0;
    var desiredByController = roadmap.getDesiredLabCount(controllerLevel);
    var baseGoal = status && typeof status.labsNeeded === "number"
      ? status.labsNeeded
      : this.hasAction(plan, "labs")
        ? Math.min(
            plan.goals &&
              plan.goals.advancedStructures &&
              plan.goals.advancedStructures.labs
              ? plan.goals.advancedStructures.labs
              : desiredByController,
            desiredByController,
          )
        : 0;

    if (!status) return baseGoal;

    var unlockedGoal = baseGoal;
    var matureSpecialization =
      (status.terminalBuilt || 0) >= 1 &&
      (status.extractorBuilt || 0) >= 1 &&
      (status.labsBuilt || 0) >= 3;
    var matureFortification =
      (status.factoryBuilt || 0) >= 1 || (status.labsBuilt || 0) >= 6;

    if (controllerLevel >= 7 && (matureSpecialization || status.specializationComplete)) {
      unlockedGoal = Math.max(unlockedGoal, Math.min(6, desiredByController));
    }

    if (controllerLevel >= 8 && (matureFortification || status.fortificationComplete)) {
      unlockedGoal = Math.max(unlockedGoal, desiredByController);
    }

    return unlockedGoal;
  },

  isCurrentRoadmapReady(status) {
    if (status.roadmapPhase === "command") return status.commandComplete;
    if (status.roadmapPhase === "fortification") {
      return status.fortificationComplete;
    }
    if (status.roadmapPhase === "specialization") {
      return status.specializationComplete;
    }
    if (status.roadmapPhase === "logistics") return status.logisticsComplete;
    if (status.roadmapPhase === "development") return status.developmentComplete;
    if (status.roadmapPhase === "foundation") return status.foundationComplete;
    return true;
  },

  getFuturePlan(room) {
    if (!Memory.rooms) return this.getEmptyFuturePlan();
    if (!Memory.rooms[room.name]) return this.getEmptyFuturePlan();

    var construction = Memory.rooms[room.name].construction;
    if (!construction || !construction.futurePlan) {
      return this.getEmptyFuturePlan();
    }

    return Object.assign(this.getEmptyFuturePlan(), construction.futurePlan);
  },

  getEmptyFuturePlan() {
    return {
      tick: 0,
      roadmapPhase: "bootstrap",
      linkPlanReady: false,
      terminalPlanReady: false,
      mineralContainerPlanReady: false,
      extractorPlanReady: false,
      labPlanReady: false,
      factoryPlanReady: false,
      observerPlanReady: false,
      powerSpawnPlanReady: false,
      nukerPlanReady: false,
      links: null,
      terminal: null,
      mineralContainer: null,
      extractor: null,
      labs: null,
      factory: null,
      observer: null,
      powerSpawn: null,
      nuker: null,
    };
  },
};
