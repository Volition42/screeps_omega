/*
Developer Summary:
Construction Manager

Purpose:
- Execute the current phase construction roadmap
- Place structures from reusable stamps / tile-sets
- Keep room buildout aligned with construction_status.js

Current stamp behavior:
- Anchor uses the first spawn as the base origin
- Extension fields use compact hallway-style pods around the anchor
- Tower uses a compact tower cluster stamp near the anchor

Important Notes:
- This manager places toward the roadmap, not just ad-hoc nearest spots
- Site cap is respected at every stage
- Status/phase truth lives in construction_status.js
- Advanced-phase structures are placed from a cached future plan to keep CPU stable
*/

const config = require("config");
const utils = require("utils");
const constructionStatus = require("construction_status");
const roadmap = require("construction_roadmap");
const statsManager = require("stats_manager");
const stamps = require("stamp_library");

module.exports = {
  plan(room, state, profiler, roomLabelPrefix) {
    var mem = this.getRoomConstructionMemory(room);
    if (!mem.lastPlan) mem.lastPlan = 0;
    var runtimeMode = statsManager.getRuntimeMode();
    var intervalMultiplier =
      runtimeMode && runtimeMode.constructionIntervalMultiplier
        ? runtimeMode.constructionIntervalMultiplier
        : 1;
    var planInterval = Math.max(
      1,
      (config.CONSTRUCTION.PLAN_INTERVAL || 50) * intervalMultiplier,
    );

    if (Game.time - mem.lastPlan < planInterval) return;
    mem.lastPlan = Game.time;

    this.updateOperationalUnlocks(room, state, mem);
    var context = this.createPlanContext(room, state);
    context.constructionMemory = mem;
    context.mineralAccessRoadUnlocked = this.isMineralAccessRoadUnlocked(
      room,
      state,
      mem,
    );
    var plan = roadmap.getPlan(
      state.phase,
      room.controller ? room.controller.level : 0,
    );
    var planningPlan = this.getPlanningPlan(room, state, plan);
    if (!planningPlan || !planningPlan.buildList) return;
    context.planningPlan = planningPlan;

    this.refreshCoreLayoutPlan(context, planningPlan, mem);
    this.refreshFuturePlan(context, planningPlan, mem);
    context.futurePlan = mem.futurePlan || null;

    for (var i = 0; i < planningPlan.buildList.length; i++) {
      if (this.isSiteCapReached(context)) break;

      var action = planningPlan.buildList[i];
      switch (action) {
        case "sourceContainers":
          this.placeSourceContainers(context);
          break;

        case "hubContainer":
          this.placeHubContainer(context);
          break;

        case "controllerContainer":
          this.placeControllerContainer(context);
          break;

        case "anchorRoads":
          this.placeAnchorRoads(context);
          break;

        case "backboneRoads":
          this.placeBackboneRoads(context);
          break;

        case "extensionStamps":
          this.placeExtensionStamps(context);
          break;

        case "towerStamp":
          this.placeTowerStamp(context);
          break;

        case "internalRoads":
          this.placeInternalRoads(context);
          break;
        case "storage":
          this.placeStorage(context);
          break;

        case "spawns":
          this.placeSpawns(context);
          break;

        case "links":
          this.placeLinks(context);
          break;

        case "terminal":
          this.placeTerminal(context);
          break;

        case "mineralContainer":
          this.placeMineralContainer(context);
          break;

        case "extractor":
          this.placeExtractor(context);
          break;

        case "labs":
          this.placeLabs(context);
          break;

        case "mineralAccessRoad":
          this.placeMineralAccessRoad(context);
          break;

        case "factory":
          this.placeFactory(context);
          break;

        case "observer":
          this.placeObserver(context);
          break;

        case "powerSpawn":
          this.placePowerSpawn(context);
          break;

        case "nuker":
          this.placeNuker(context);
          break;

        case "defense":
          this.placeDefense(context);
          break;
      }
    }

  },

  getPlanningPlan(room, state, basePlan) {
    var planningPlan = {
      phase: basePlan.phase,
      roadmapPhase: basePlan.roadmapPhase,
      focus: basePlan.focus,
      summary: basePlan.summary,
      buildList: basePlan.buildList.slice(),
      goals: roadmap.cloneGoals(basePlan.goals || {}),
    };
    var buildStatus = state && state.buildStatus ? state.buildStatus : null;
    var unlockedLabGoal = buildStatus
      ? buildStatus.unlockedLabsNeeded || buildStatus.labsNeeded || 0
      : 0;
    var currentLabGoal =
      planningPlan.goals &&
      planningPlan.goals.advancedStructures &&
      typeof planningPlan.goals.advancedStructures.labs === "number"
        ? planningPlan.goals.advancedStructures.labs
        : 0;

    if (unlockedLabGoal > currentLabGoal) {
      if (!planningPlan.goals.advancedStructures) {
        planningPlan.goals.advancedStructures = {};
      }

      planningPlan.goals.advancedStructures.labs = unlockedLabGoal;
      if (planningPlan.buildList.indexOf("labs") === -1) {
        planningPlan.buildList.push("labs");
      }
    }

    planningPlan.buildList = this.prioritizeCatchupBuildActions(
      planningPlan.buildList,
      state,
      unlockedLabGoal,
    );

    return planningPlan;
  },

  prioritizeCatchupBuildActions(buildList, state, unlockedLabGoal) {
    if (!buildList || buildList.length === 0 || !state || !state.buildStatus) {
      return buildList;
    }

    var status = state.buildStatus;
    var priorityActions = [];

    if ((status.towersNeeded || 0) >= 3 && status.towersBuilt < status.towersNeeded) {
      priorityActions.push("towerStamp");
    }
    if (unlockedLabGoal > (status.labsBuilt || 0)) {
      priorityActions.push("labs");
    }
    if (priorityActions.length === 0) return buildList;

    var ordered = [];
    var seen = {};
    var bootstrapActions = [
      "sourceContainers",
      "hubContainer",
      "controllerContainer",
    ];

    function pushAction(action) {
      if (!action || seen[action]) return;
      if (buildList.indexOf(action) === -1) return;
      ordered.push(action);
      seen[action] = true;
    }

    for (var i = 0; i < bootstrapActions.length; i++) {
      pushAction(bootstrapActions[i]);
    }
    for (var j = 0; j < priorityActions.length; j++) {
      pushAction(priorityActions[j]);
    }
    for (var k = 0; k < buildList.length; k++) {
      pushAction(buildList[k]);
    }

    return ordered;
  },

  getRoomConstructionMemory(room) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].construction) {
      Memory.rooms[room.name].construction = {};
    }

    return Memory.rooms[room.name].construction;
  },

  updateOperationalUnlocks(room, state, memory) {
    memory = memory || this.getRoomConstructionMemory(room);
    if (!memory || !state) return;

    if (constructionStatus.isMineralProgramUnlocked(room, state)) {
      memory.mineralProgramUnlocked = true;
    }
    if (this.getActiveMineralMinerCount(room, state) > 0) {
      memory.mineralProgramUnlocked = true;
      memory.mineralAccessRoadUnlocked = true;
    }
  },

  isMineralAccessRoadUnlocked(room, state, memory) {
    if (this.getActiveMineralMinerCount(room, state) > 0) return true;

    memory = memory || this.getRoomConstructionMemory(room);
    return !!(memory && memory.mineralAccessRoadUnlocked);
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

  createPlanContext(room, state) {
    return {
      room: room,
      state: state,
      terrain: room.getTerrain(),
      siteCount: state.sites ? state.sites.length : 0,
      buildStatus: state.buildStatus || constructionStatus.getStatus(room, state),
      plannedSitesByType: {},
      anchorOrigin: undefined,
      storagePlanningPosition: undefined,
      storagePlanningDetails: undefined,
      roadmapPhase: roadmap.getPlan(
        state.phase,
        room.controller ? room.controller.level : 0,
      ).roadmapPhase,
    };
  },

  isSiteCapReached(context) {
    return context.siteCount >= config.CONSTRUCTION.MAX_SITES;
  },

  getAnchorOrigin(context) {
    if (context.anchorOrigin === undefined) {
      context.anchorOrigin = stamps.getAnchorOrigin(context.room, context.state);
    }

    return context.anchorOrigin;
  },

  refreshCoreLayoutPlan(context, plan, memory) {
    memory = memory || this.getRoomConstructionMemory(context.room);
    if (!memory.futurePlan) memory.futurePlan = {};

    var extensionPlan = this.buildExtensionStampPlan(context, plan);
    memory.futurePlan.extensionStampPlanReady = !!extensionPlan.ready;
    memory.futurePlan.extensionStamps = extensionPlan;
  },

  refreshFuturePlan(context, plan, memory) {
    if (!context.room.controller) return;

    // Developer note:
    // RCL5+ planning is cached on a slower interval so status/HUD/directives can
    // read future structure intent without adding new every-tick room scans.
    var interval = Math.max(
      config.CONSTRUCTION.ADVANCED_PLAN_INTERVAL || 250,
      config.CONSTRUCTION.PLAN_INTERVAL || 50,
    );

    var signature = this.getFuturePlanSignature(context, plan);
    var cacheConfig =
      config.CONSTRUCTION && config.CONSTRUCTION.ADVANCED_ACTIONS
        ? config.CONSTRUCTION.ADVANCED_ACTIONS
        : {};

    if (
      memory.futurePlan &&
      memory.lastAdvancedPlan &&
      Game.time - memory.lastAdvancedPlan < interval &&
      memory.futurePlan.roadmapPhase === plan.roadmapPhase &&
      (
        cacheConfig.REPLAN_ON_LAYOUT_CHANGE === false ||
        memory.futurePlan.signature === signature
      )
    ) {
      return;
    }

    memory.lastAdvancedPlan = Game.time;
    memory.futurePlan = Object.assign(
      {},
      memory.futurePlan || {},
      this.buildFuturePlan(context, plan),
    );
    memory.futurePlan.signature = signature;
  },

  getFuturePlanSignature(context, plan) {
    var controllerLevel = context.room.controller
      ? context.room.controller.level
      : 0;
    var storagePos = this.getStoragePlanningPosition(context);
    var storageCount =
      context.state.structuresByType && context.state.structuresByType[STRUCTURE_STORAGE]
        ? context.state.structuresByType[STRUCTURE_STORAGE].length
        : 0;
    var sourceCount = context.state.sources ? context.state.sources.length : 0;
    var anchor = this.getAnchorOrigin(context);
    var labGoal =
      plan &&
      plan.goals &&
      plan.goals.advancedStructures &&
      typeof plan.goals.advancedStructures.labs === "number"
        ? plan.goals.advancedStructures.labs
        : 0;

    return [
      plan.roadmapPhase,
      controllerLevel,
      storageCount,
      sourceCount,
      labGoal,
      storagePos ? storagePos.x : "na",
      storagePos ? storagePos.y : "na",
      anchor ? anchor.x : "na",
      anchor ? anchor.y : "na",
    ].join(":");
  },

  buildFuturePlan(context, plan) {
    var room = context.room;
    var storagePos = this.getStoragePlanningPosition(context);
    var storagePlan = this.getStoragePlanningDebug(context);
    var linkPlan = this.buildLinkPlan(context, plan, storagePos);
    var used = {};
    var terminalPlan = this.buildTerminalPlan(
      context,
      plan,
      storagePos,
      linkPlan,
      used,
    );
    var mineralContainerPlan = this.buildMineralContainerPlan(context, plan);
    linkPlan = this.extendLinkPlanWithUtilities(
      context,
      plan,
      linkPlan,
      terminalPlan,
      mineralContainerPlan,
    );
    var extractorPlan = this.buildExtractorPlan(context, plan);
    var labPlan = this.buildLabPlan(
      context,
      plan,
      storagePos,
      terminalPlan,
      used,
    );
    var factoryPlan = this.buildFactoryPlan(
      context,
      plan,
      storagePos,
      terminalPlan,
      linkPlan,
      used,
    );
    var powerSpawnPlan = this.buildPowerSpawnPlan(
      context,
      plan,
      storagePos,
      terminalPlan,
      factoryPlan,
      used,
    );
    var observerPlan = this.buildObserverPlan(context, plan, used);
    var nukerPlan = this.buildNukerPlan(context, plan, used);

    return {
      tick: Game.time,
      roadmapPhase: plan.roadmapPhase,
      storagePos: this.serializePos(storagePos),
      storagePlan: storagePlan,
      linkPlanReady: !!linkPlan.ready,
      terminalPlanReady: !!terminalPlan.ready,
      mineralContainerPlanReady: !!mineralContainerPlan.ready,
      extractorPlanReady: !!extractorPlan.ready,
      labPlanReady: !!labPlan.ready,
      factoryPlanReady: !!factoryPlan.ready,
      observerPlanReady: !!observerPlan.ready,
      powerSpawnPlanReady: !!powerSpawnPlan.ready,
      nukerPlanReady: !!nukerPlan.ready,
      links: linkPlan,
      terminal: terminalPlan,
      mineralContainer: mineralContainerPlan,
      extractor: extractorPlan,
      labs: labPlan,
      factory: factoryPlan,
      observer: observerPlan,
      powerSpawn: powerSpawnPlan,
      nuker: nukerPlan,
    };
  },

  buildExtensionStampPlan(context, plan) {
    var room = context.room;
    var anchor = this.getAnchorOrigin(context);
    var desiredExtensions = room.controller
      ? roadmap.getDesiredExtensionCount(room.controller.level)
      : 0;

    if (!anchor || !this.hasPlanAction(plan, "extensionStamps") || desiredExtensions <= 0) {
      return {
        enabled: false,
        ready: false,
        desiredExtensions: desiredExtensions,
        plannedCapacity: 0,
        origins: [],
      };
    }

    var stampName = stamps.getDefaultExtensionStampName();
    var candidates = stamps.getExtensionStampOrigins(anchor);
    var selected = [];
    var plannedCapacity = 0;
    var anchorPos = new RoomPosition(anchor.x, anchor.y, anchor.roomName);
    var used = {};
    var remaining = [];

    for (var i = 0; i < candidates.length; i++) {
      remaining.push({
        origin: candidates[i],
        index: i,
      });
    }

    while (remaining.length > 0 && plannedCapacity < desiredExtensions) {
      var best = null;
      var bestIndex = -1;

      for (var j = 0; j < remaining.length; j++) {
        var summary = this.getExtensionStampCandidateSummary(
          context,
          remaining[j].origin,
          stampName,
          anchorPos,
          remaining[j].index,
          used,
        );

        if (summary.placeableExtensions <= 0) continue;
        if (!best || this.isBetterExtensionStampCandidate(summary, best)) {
          best = summary;
          bestIndex = j;
        }
      }

      if (!best) break;

      selected.push(this.serializePos(best.origin));
      plannedCapacity += best.placeableExtensions;
      this.markStampPlanningCellsUsed(used, best.origin, stampName);
      remaining.splice(bestIndex, 1);
    }

    return {
      enabled: true,
      ready: plannedCapacity >= desiredExtensions,
      desiredExtensions: desiredExtensions,
      plannedCapacity: plannedCapacity,
      origins: selected,
    };
  },

  getExtensionStampCandidateSummary(context, origin, stampName, anchorPos, index, used) {
    var placeableExtensions = 0;
    var placeableRoads = 0;
    var originPos = new RoomPosition(origin.x, origin.y, origin.roomName);
    var self = this;

    stamps.forEachExtensionPosition(origin, stampName, function (pos) {
      if (used && self.isPosUsed(used, pos)) return;
      if (self.canPlaceStructureSite(context, pos, STRUCTURE_EXTENSION, true)) {
        placeableExtensions++;
      }
    });

    stamps.forEachRoadPosition(origin, stampName, function (pos) {
      if (used && self.isPosUsed(used, pos)) return;
      if (self.canPlaceStructureSite(context, pos, STRUCTURE_ROAD, true)) {
        placeableRoads++;
      }
    });

    return {
      index: index,
      origin: originPos,
      anchorRange: anchorPos ? anchorPos.getRangeTo(originPos) : 0,
      placeableExtensions: placeableExtensions,
      placeableRoads: placeableRoads,
      score:
        placeableExtensions * 45 -
        placeableRoads * 2 -
        (anchorPos ? anchorPos.getRangeTo(originPos) * 30 : 0) -
        index,
    };
  },

  isBetterExtensionStampCandidate(candidate, currentBest) {
    if (!currentBest) return true;
    if (candidate.score !== currentBest.score) return candidate.score > currentBest.score;
    if (candidate.anchorRange !== currentBest.anchorRange) {
      return candidate.anchorRange < currentBest.anchorRange;
    }
    if (candidate.placeableExtensions !== currentBest.placeableExtensions) {
      return candidate.placeableExtensions > currentBest.placeableExtensions;
    }
    if (candidate.placeableRoads !== currentBest.placeableRoads) {
      return candidate.placeableRoads > currentBest.placeableRoads;
    }
    return candidate.index < currentBest.index;
  },

  markStampPlanningCellsUsed(used, origin, stampName) {
    if (!used || !origin) return;

    stamps.forEachExtensionPosition(origin, stampName, function (pos) {
      this.markPosUsed(used, pos);
    }, this);
    stamps.forEachRoadPosition(origin, stampName, function (pos) {
      this.markPosUsed(used, pos);
    }, this);
  },

  buildLinkPlan(context, plan, storagePos) {
    var room = context.room;
    var linkGoals = plan.goals && plan.goals.linkPlanning ? plan.goals.linkPlanning : {};
    var totalLinks = roadmap.getDesiredLinkCount(
      room.controller ? room.controller.level : 0,
    );
    var used = {};
    var sourceLinks = [];
    var controllerLinkPos = null;
    var storageLinkPos = null;

    if (!linkGoals.enabled || totalLinks <= 0) {
      return {
        enabled: false,
        ready: false,
        totalTarget: 0,
        controller: null,
        sources: [],
        storage: null,
        terminal: null,
        mineral: null,
      };
    }

    controllerLinkPos = room.controller
      ? this.pickOpenPositionNear(
          context,
          room.controller.pos,
          1,
          config.CONSTRUCTION.FUTURE_INFRA.LINK_CONTROLLER_RANGE || 2,
          used,
          STRUCTURE_LINK,
        )
      : null;

    var sourceTarget = Math.min(
      linkGoals.sourceLinks || 0,
      context.state.sources ? context.state.sources.length : 0,
      Math.max(0, totalLinks - (controllerLinkPos ? 1 : 0)),
    );

    for (
      var i = 0;
      context.state.sources && i < context.state.sources.length && sourceLinks.length < sourceTarget;
      i++
    ) {
      var source = context.state.sources[i];
      var container = context.state.sourceContainersBySourceId
        ? context.state.sourceContainersBySourceId[source.id]
        : null;
      var anchorPos = container ? container.pos : source.pos;
      var linkPos = this.pickOpenPositionNear(
        context,
        anchorPos,
        1,
        config.CONSTRUCTION.FUTURE_INFRA.LINK_SOURCE_RANGE || 2,
        used,
        STRUCTURE_LINK,
      );

      if (linkPos) {
        sourceLinks.push({
          sourceId: source.id,
          pos: this.serializePos(linkPos),
        });
      }
    }

    if (
      storagePos &&
      linkGoals.storageLink &&
      controllerLinkPos &&
      sourceLinks.length + 1 < totalLinks
    ) {
      storageLinkPos = this.pickPreferredStorageSlot(
        context,
        storagePos,
        used,
        "storage_link_slot",
        STRUCTURE_LINK,
      );

      if (!storageLinkPos) {
        storageLinkPos = this.pickOpenPositionNear(
          context,
          storagePos,
          1,
          config.CONSTRUCTION.FUTURE_INFRA.STORAGE_LINK_RANGE || 2,
          used,
          STRUCTURE_LINK,
        );
      }
    }

    var ready =
      (!linkGoals.controllerLink || !!controllerLinkPos) &&
      sourceLinks.length >= sourceTarget &&
      (!linkGoals.storageLink || !!storageLinkPos);

    return {
      enabled: true,
      ready: ready,
      totalTarget: totalLinks,
      controller: this.serializePos(controllerLinkPos),
      sources: sourceLinks,
      storage: this.serializePos(storageLinkPos),
      terminal: null,
      mineral: null,
    };
  },

  extendLinkPlanWithUtilities(context, plan, linkPlan, terminalPlan, mineralContainerPlan) {
    if (!linkPlan || !linkPlan.enabled) {
      return linkPlan;
    }

    var room = context.room;
    var linkGoals = plan.goals && plan.goals.linkPlanning ? plan.goals.linkPlanning : {};
    var totalLinks = roadmap.getDesiredLinkCount(
      room.controller ? room.controller.level : 0,
    );
    var used = {};

    this.markSerializedPosUsed(used, linkPlan.controller);
    this.markSerializedPosUsed(used, linkPlan.storage);
    if (linkPlan.sources) {
      for (var i = 0; i < linkPlan.sources.length; i++) {
        this.markSerializedPosUsed(used, linkPlan.sources[i].pos);
      }
    }
    this.markSerializedPosUsed(used, terminalPlan && terminalPlan.pos);
    this.markSerializedPosUsed(used, mineralContainerPlan && mineralContainerPlan.pos);

    var plannedCount =
      (linkPlan.controller ? 1 : 0) +
      (linkPlan.sources ? linkPlan.sources.length : 0) +
      (linkPlan.storage ? 1 : 0);
    var terminalLinkPos = null;
    var mineralLinkPos = null;

    if (
      linkGoals.terminalLink &&
      plannedCount < totalLinks &&
      terminalPlan &&
      terminalPlan.pos
    ) {
      terminalLinkPos = this.pickOpenPositionNear(
        context,
        this.deserializePos(terminalPlan.pos),
        1,
        config.CONSTRUCTION.FUTURE_INFRA.TERMINAL_RANGE_FROM_STORAGE || 2,
        used,
        STRUCTURE_LINK,
      );

      if (terminalLinkPos) {
        plannedCount++;
      }
    }

    if (
      linkGoals.mineralLink &&
      plannedCount < totalLinks
    ) {
      var mineralAnchor = mineralContainerPlan && mineralContainerPlan.pos
        ? this.deserializePos(mineralContainerPlan.pos)
        : null;

      if (!mineralAnchor) {
        var minerals = context.state.minerals || room.find(FIND_MINERALS);
        mineralAnchor = minerals && minerals.length > 0 ? minerals[0].pos : null;
      }

      if (mineralAnchor) {
        mineralLinkPos = this.pickOpenPositionNear(
          context,
          mineralAnchor,
          1,
          config.CONSTRUCTION.FUTURE_INFRA.LINK_SOURCE_RANGE || 2,
          used,
          STRUCTURE_LINK,
        );
      }
    }

    linkPlan.terminal = this.serializePos(terminalLinkPos);
    linkPlan.mineral = this.serializePos(mineralLinkPos);
    linkPlan.ready =
      !!linkPlan.ready &&
      (!linkGoals.terminalLink || !!terminalLinkPos) &&
      (!linkGoals.mineralLink || !!mineralLinkPos);

    return linkPlan;
  },

  buildTerminalPlan(context, plan, storagePos, linkPlan, used) {
    var advancedGoals =
      plan.goals && plan.goals.advancedStructures
        ? plan.goals.advancedStructures
        : {};

    if (!advancedGoals.terminal) {
      return {
        enabled: false,
        ready: false,
        pos: null,
      };
    }

    used = used || {};
    this.markSerializedPosUsed(used, linkPlan && linkPlan.controller);
    this.markSerializedPosUsed(used, linkPlan && linkPlan.storage);
    if (linkPlan && linkPlan.sources) {
      for (var i = 0; i < linkPlan.sources.length; i++) {
        this.markSerializedPosUsed(used, linkPlan.sources[i].pos);
      }
    }

    var terminalPos =
      this.pickPreferredStorageSlot(
        context,
        storagePos,
        used,
        "terminal_slot",
        STRUCTURE_TERMINAL,
      ) ||
      this.pickOpenPositionNear(
        context,
        storagePos,
        1,
        config.CONSTRUCTION.FUTURE_INFRA.TERMINAL_RANGE_FROM_STORAGE || 2,
        used,
        STRUCTURE_TERMINAL,
      );

    return {
      enabled: true,
      ready: !!terminalPos,
      pos: this.serializePos(terminalPos),
    };
  },

  buildExtractorPlan(context, plan) {
    if (!this.hasPlanAction(plan, "extractor")) {
      return {
        enabled: false,
        ready: false,
        mineralId: null,
        pos: null,
      };
    }

    var minerals = context.room.find(FIND_MINERALS);
    var mineral = minerals && minerals.length > 0 ? minerals[0] : null;
    var ready = !!mineral
      && this.canPlaceStructureSite(
        context,
        mineral ? mineral.pos : null,
        STRUCTURE_EXTRACTOR,
        true,
      );

    return {
      enabled: !!mineral,
      ready: ready,
      mineralId: mineral ? mineral.id : null,
      pos: this.serializePos(mineral ? mineral.pos : null),
    };
  },

  buildMineralContainerPlan(context, plan) {
    if (!this.hasPlanAction(plan, "mineralContainer")) {
      return {
        enabled: false,
        ready: false,
        mineralId: null,
        pos: null,
      };
    }

    var minerals = context.state.minerals || context.room.find(FIND_MINERALS);
    var mineral = minerals && minerals.length > 0 ? minerals[0] : null;
    var existing = context.state.mineralContainer || null;
    var pos = existing
      ? existing.pos
      : mineral
        ? this.pickOpenPositionNear(
            context,
            mineral.pos,
            1,
            1,
            {},
            STRUCTURE_CONTAINER,
          )
        : null;

    return {
      enabled: !!mineral,
      ready: !!pos,
      mineralId: mineral ? mineral.id : null,
      pos: this.serializePos(pos),
    };
  },

  buildLabPlan(context, plan, storagePos, terminalPlan, used) {
    var advancedGoals =
      plan.goals && plan.goals.advancedStructures
        ? plan.goals.advancedStructures
        : {};
    var targetCount = Math.min(
      advancedGoals.labs || 0,
      roadmap.getDesiredLabCount(
        context.room.controller ? context.room.controller.level : 0,
      ),
    );

    if (targetCount <= 0) {
      return {
        enabled: false,
        ready: false,
        targetCount: 0,
        positions: [],
      };
    }

    used = used || {};
    this.markSerializedPosUsed(used, terminalPlan && terminalPlan.pos);
    var centerPos = storagePos || (context.state.spawns && context.state.spawns[0]
      ? context.state.spawns[0].pos
      : null);
    var stampPlan = this.getCompactLabStampPlan(
      context,
      storagePos,
      targetCount,
      used,
    );
    var stampOrigin = stampPlan ? stampPlan.origin : null;
    var stampName = stampPlan ? stampPlan.stampName : null;
    var positions = stampPlan ? stampPlan.positions : [];

    if (positions.length < targetCount) {
      positions = this.pickLabCompoundPositions(
        context,
        centerPos,
        targetCount,
        config.CONSTRUCTION.FUTURE_INFRA.LAB_RANGE_FROM_STORAGE || 6,
        used,
        STRUCTURE_LAB,
      );
      stampOrigin = null;
      stampName = null;
    }

    return {
      enabled: true,
      ready: positions.length >= targetCount,
      targetCount: targetCount,
      origin: this.serializePos(stampOrigin),
      stampName: stampName,
      positions: _.map(positions, this.serializePos, this),
    };
  },

  getCompactLabStampPlan(context, storagePos, targetCount, used) {
    if (!storagePos || targetCount <= 0) return null;

    if (targetCount <= 3) {
      var clusterOrigin = this.pickPreferredStorageSlot(
        context,
        storagePos,
        used,
        "lab_anchor_slot",
        STRUCTURE_LAB,
      );

      if (!clusterOrigin) return null;

      var clusterUsed = Object.assign({}, used);
      var clusterPositions = this.getStampLabPositions(
        context,
        clusterOrigin,
        "lab_cluster_v1",
        targetCount,
        clusterUsed,
      );

      if (clusterPositions.length < targetCount) return null;

      Object.assign(used, clusterUsed);
      return {
        origin: clusterOrigin,
        stampName: "lab_cluster_v1",
        positions: clusterPositions,
      };
    }

    var origins = stamps.getLabCompactStampOrigins(storagePos);
    var best = null;

    for (var i = 0; i < origins.length; i++) {
      var origin = new RoomPosition(origins[i].x, origins[i].y, origins[i].roomName);
      var candidateUsed = Object.assign({}, used);
      var positions = this.getStampLabPositions(
        context,
        origin,
        "lab_compact_v1",
        targetCount,
        candidateUsed,
      );

      if (positions.length < targetCount) continue;

      var roadOpen = 0;
      stamps.forEachRoadPosition(origin, "lab_compact_v1", function (pos) {
        if (this.canPlaceStructureSite(context, pos, STRUCTURE_ROAD, true)) {
          roadOpen++;
        }
      }, this);

      var summary = {
        origin: origin,
        positions: positions,
        used: candidateUsed,
        anchorRange: storagePos.getRangeTo(origin),
        roadOpen: roadOpen,
      };

      if (
        !best ||
        summary.roadOpen > best.roadOpen ||
        (
          summary.roadOpen === best.roadOpen &&
          summary.anchorRange < best.anchorRange
        )
      ) {
        best = summary;
      }
    }

    if (!best) return null;

    Object.assign(used, best.used);
    return {
      origin: best.origin,
      stampName: "lab_compact_v1",
      positions: best.positions,
    };
  },

  buildFactoryPlan(context, plan, storagePos, terminalPlan, linkPlan, used) {
    return this.buildAdvancedUtilityStructurePlan(
      context,
      plan,
      "factory",
      storagePos,
      used,
      {
        structureType: STRUCTURE_FACTORY,
        storageTag: "utility_slot",
        storageRange:
          config.CONSTRUCTION.FUTURE_INFRA.FACTORY_RANGE_FROM_STORAGE || 3,
        block: [
          terminalPlan && terminalPlan.pos,
          linkPlan && linkPlan.storage,
        ],
      },
    );
  },

  buildPowerSpawnPlan(context, plan, storagePos, terminalPlan, factoryPlan, used) {
    return this.buildAdvancedUtilityStructurePlan(
      context,
      plan,
      "powerSpawn",
      storagePos,
      used,
      {
        structureType: STRUCTURE_POWER_SPAWN,
        storageTag: "utility_slot",
        storageRange:
          config.CONSTRUCTION.FUTURE_INFRA.POWER_SPAWN_RANGE_FROM_STORAGE || 4,
        anchorTag: "utility_slot",
        anchorRange:
          config.CONSTRUCTION.FUTURE_INFRA.POWER_SPAWN_RANGE_FROM_STORAGE || 4,
        block: [
          terminalPlan && terminalPlan.pos,
          factoryPlan && factoryPlan.pos,
        ],
      },
    );
  },

  buildObserverPlan(context, plan, used) {
    return this.buildAdvancedAnchorStructurePlan(
      context,
      plan,
      "observer",
      used,
      {
        structureType: STRUCTURE_OBSERVER,
        anchorTag: "late_slot",
        anchorRange:
          config.CONSTRUCTION.FUTURE_INFRA.OBSERVER_RANGE_FROM_ANCHOR || 6,
      },
    );
  },

  buildNukerPlan(context, plan, used) {
    return this.buildAdvancedAnchorStructurePlan(
      context,
      plan,
      "nuker",
      used,
      {
        structureType: STRUCTURE_NUKER,
        anchorTag: "late_slot",
        anchorRange:
          config.CONSTRUCTION.FUTURE_INFRA.NUKER_RANGE_FROM_ANCHOR || 7,
      },
    );
  },

  buildAdvancedUtilityStructurePlan(context, plan, action, storagePos, used, options) {
    var lateGoals =
      plan.goals && plan.goals.lateGameStructures
        ? plan.goals.lateGameStructures
        : {};

    if (!this.hasPlanAction(plan, action) || !lateGoals[action]) {
      return {
        enabled: false,
        ready: false,
        pos: null,
      };
    }

    used = used || {};
    options = options || {};
    this.markSerializedListUsed(used, options.block);

    var pos = storagePos && options.storageTag
      ? this.pickPreferredStorageSlot(
          context,
          storagePos,
          used,
          options.storageTag,
          options.structureType,
        )
      : null;

    if (!pos && storagePos) {
      pos = this.pickOpenPositionNear(
        context,
        storagePos,
        1,
        options.storageRange || 3,
        used,
        options.structureType,
      );
    }

    if (!pos && options.anchorTag) {
      var fallbackCenter = storagePos || (context.state.spawns && context.state.spawns[0]
        ? context.state.spawns[0].pos
        : null);
      pos = this.pickPreferredAnchorSlot(
        context,
        fallbackCenter,
        used,
        options.anchorTag,
        options.structureType,
      );
    }

    if (!pos && options.anchorRange) {
      var anchor = this.getAnchorOrigin(context);
      pos = anchor
        ? this.pickOpenPositionNear(
            context,
            new RoomPosition(anchor.x, anchor.y, anchor.roomName),
            2,
            options.anchorRange,
            used,
            options.structureType,
          )
        : null;
    }

    return {
      enabled: true,
      ready: !!pos,
      pos: this.serializePos(pos),
    };
  },

  buildAdvancedAnchorStructurePlan(context, plan, action, used, options) {
    var lateGoals =
      plan.goals && plan.goals.lateGameStructures
        ? plan.goals.lateGameStructures
        : {};

    if (!this.hasPlanAction(plan, action) || !lateGoals[action]) {
      return {
        enabled: false,
        ready: false,
        pos: null,
      };
    }

    used = used || {};
    options = options || {};
    var anchor = this.getAnchorOrigin(context);
    var anchorPos = anchor
      ? new RoomPosition(anchor.x, anchor.y, anchor.roomName)
      : null;
    var pos = this.pickPreferredAnchorSlot(
      context,
      anchorPos,
      used,
      options.anchorTag,
      options.structureType,
    );

    if (!pos && anchorPos) {
      pos = this.pickOpenPositionNear(
        context,
        anchorPos,
        2,
        options.anchorRange || 6,
        used,
        options.structureType,
      );
    }

    return {
      enabled: true,
      ready: !!pos,
      pos: this.serializePos(pos),
    };
  },

  getStoragePlanningPosition(context) {
    if (context.storagePlanningPosition !== undefined) {
      return context.storagePlanningPosition;
    }

    var storage = context.state.structuresByType[STRUCTURE_STORAGE];
    if (storage && storage.length > 0) {
      context.storagePlanningPosition = storage[0].pos;
      context.storagePlanningDetails = {
        mode: "existing",
        fixedCandidateCount: 0,
        fixedRejectedCount: 0,
        fixedRejectCounts: {},
      };
      return context.storagePlanningPosition;
    }

    var storageSites = this.getSitesByType(context, STRUCTURE_STORAGE);
    if (storageSites.length > 0) {
      context.storagePlanningPosition = storageSites[0].pos;
      context.storagePlanningDetails = {
        mode: "site",
        fixedCandidateCount: 0,
        fixedRejectedCount: 0,
        fixedRejectCounts: {},
      };
      return context.storagePlanningPosition;
    }

    var anchor = this.getAnchorOrigin(context);
    var best = null;
    var fixedRejectCounts = {};
    var anchorPos = anchor
      ? new RoomPosition(anchor.x, anchor.y, anchor.roomName)
      : null;
    var fixedCandidates = anchor
      ? _.map(stamps.getStorageStampOrigins(anchor), function (origin) {
          return new RoomPosition(origin.x, origin.y, origin.roomName);
        })
      : [];

    for (var i = 0; i < fixedCandidates.length; i++) {
      var summary = this.getStorageCandidateSummary(
        context,
        fixedCandidates[i],
        anchorPos,
        i,
      );
      if (!summary) {
        this.incrementStorageRejectCount(
          fixedRejectCounts,
          this.getStorageCandidateBlockReason(context, fixedCandidates[i]),
        );
        continue;
      }
      if (!best || this.isBetterStorageCandidate(summary, best)) {
        best = summary;
      }
    }

    if (best) {
      context.storagePlanningPosition = best.pos;
      context.storagePlanningDetails = {
        mode: "fixed",
        fixedCandidateCount: fixedCandidates.length,
        fixedRejectedCount: this.getStorageRejectCountTotal(fixedRejectCounts),
        fixedRejectCounts: fixedRejectCounts,
        criticalOpen: best.criticalOpen,
        roadOpen: best.roadOpen,
        utilityOpen: best.utilityOpen,
      };
      return context.storagePlanningPosition;
    }

    var candidates = this.getStorageOriginCandidates(context, anchor);
    var fallbackScanned = 0;
    for (var j = 0; j < candidates.length; j++) {
      fallbackScanned++;
      var fallbackSummary = this.getStorageCandidateSummary(
        context,
        candidates[j],
        anchorPos,
        j,
      );
      if (!fallbackSummary) continue;
      if (!best || this.isBetterStorageCandidate(fallbackSummary, best)) {
        best = fallbackSummary;
      }
    }

    context.storagePlanningPosition = best ? best.pos : null;
    context.storagePlanningDetails = {
      mode: best ? "fallback" : "blocked",
      fixedCandidateCount: fixedCandidates.length,
      fixedRejectedCount: fixedCandidates.length,
      fixedRejectCounts: fixedRejectCounts,
      fallbackScanned: fallbackScanned,
      criticalOpen: best ? best.criticalOpen : 0,
      roadOpen: best ? best.roadOpen : 0,
      utilityOpen: best ? best.utilityOpen : 0,
    };
    return context.storagePlanningPosition;
  },

  getStoragePlanningDebug(context) {
    var pos = this.getStoragePlanningPosition(context);
    var details = context.storagePlanningDetails || {};

    return {
      mode: details.mode || (pos ? "planned" : "blocked"),
      pos: this.serializePos(pos),
      fixedCandidateCount: details.fixedCandidateCount || 0,
      fixedRejectedCount: details.fixedRejectedCount || 0,
      fixedRejectCounts: details.fixedRejectCounts || {},
      fallbackScanned: details.fallbackScanned || 0,
      criticalOpen: details.criticalOpen || 0,
      roadOpen: details.roadOpen || 0,
      utilityOpen: details.utilityOpen || 0,
    };
  },

  getStorageOriginCandidates(context, anchor) {
    if (!anchor) return [];

    var results = [];
    var seen = {};
    var fixed = stamps.getStorageStampOrigins(anchor);
    var anchorPos = new RoomPosition(anchor.x, anchor.y, anchor.roomName);
    var nearby = this.getNearbyPositions(anchorPos, 3, 10);

    function push(pos) {
      if (!pos) return;
      var key = pos.x + ":" + pos.y;
      if (seen[key]) return;
      seen[key] = true;
      results.push(pos);
    }

    for (var i = 0; i < fixed.length; i++) {
      seen[fixed[i].x + ":" + fixed[i].y] = true;
    }
    for (var j = 0; j < nearby.length; j++) {
      push(nearby[j]);
    }

    return results;
  },

  getStorageCandidateSummary(context, pos, anchorPos, index) {
    if (!this.canPlaceStructureSite(context, pos, STRUCTURE_STORAGE, true)) {
      return null;
    }

    var roadOpen = 0;
    var roadBlocked = 0;
    var reservedOpen = 0;
    var criticalOpen = 0;
    var utilityOpen = 0;
    var self = this;
    var criticalTags = {
      storage_link_slot: true,
      terminal_slot: true,
      lab_anchor_slot: true,
    };

    stamps.forEachRoadPosition(pos, "storage_hub_v1", function (roadPos) {
      if (self.canPlaceStructureSite(context, roadPos, STRUCTURE_ROAD, true)) {
        roadOpen++;
      } else {
        roadBlocked++;
      }
    });

    stamps.forEachReservedPosition(pos, "storage_hub_v1", function (reservedPos, cell) {
      if (!self.isPlanningPositionOpen(context, reservedPos, {})) return;
      reservedOpen++;
      if (criticalTags[cell.tag]) {
        criticalOpen++;
      } else if (cell.tag === "utility_slot") {
        utilityOpen++;
      }
    });

    return {
      pos: pos,
      index: index,
      anchorRange: anchorPos ? anchorPos.getRangeTo(pos) : 0,
      roadOpen: roadOpen,
      roadBlocked: roadBlocked,
      reservedOpen: reservedOpen,
      criticalOpen: criticalOpen,
      utilityOpen: utilityOpen,
      score:
        criticalOpen * 120 +
        utilityOpen * 35 +
        roadOpen * 12 +
        reservedOpen * 6 -
        roadBlocked * 8 -
        (anchorPos ? anchorPos.getRangeTo(pos) * 18 : 0) -
        index,
    };
  },

  isBetterStorageCandidate(candidate, currentBest) {
    if (!currentBest) return true;
    if (candidate.score !== currentBest.score) return candidate.score > currentBest.score;
    if (candidate.criticalOpen !== currentBest.criticalOpen) {
      return candidate.criticalOpen > currentBest.criticalOpen;
    }
    if (candidate.roadOpen !== currentBest.roadOpen) {
      return candidate.roadOpen > currentBest.roadOpen;
    }
    if (candidate.anchorRange !== currentBest.anchorRange) {
      return candidate.anchorRange < currentBest.anchorRange;
    }
    return candidate.index < currentBest.index;
  },

  incrementStorageRejectCount(counts, reason) {
    if (!counts || !reason) return;
    counts[reason] = (counts[reason] || 0) + 1;
  },

  getStorageRejectCountTotal(counts) {
    if (!counts) return 0;

    var total = 0;
    for (var key in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, key)) continue;
      total += counts[key] || 0;
    }

    return total;
  },

  getStorageCandidateBlockReason(context, pos) {
    if (!pos) return "invalid";
    if (pos.x < 2 || pos.x > 47 || pos.y < 2 || pos.y > 47) return "border";
    if (!this.hasBorderSupportWalls(context, pos, STRUCTURE_STORAGE)) return "border";
    if (context.terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) return "terrain";

    var structures = pos.lookFor(LOOK_STRUCTURES);
    var sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

    if (_.some(structures, function (s) {
      return s.structureType === STRUCTURE_STORAGE;
    })) {
      return "existing";
    }
    if (_.some(sites, function (s) {
      return s.structureType === STRUCTURE_STORAGE;
    })) {
      return "site";
    }

    var self = this;
    if (_.some(structures, function (s) {
      if (
        s.structureType === STRUCTURE_ROAD &&
        self.canReplaceRoadWithStructure(STRUCTURE_STORAGE)
      ) {
        return false;
      }

      return !self.canStructureTypesShareTile(STRUCTURE_STORAGE, s.structureType);
    })) {
      return "occupied";
    }

    if (_.some(sites, function (s) {
      return !self.canStructureTypesShareTile(STRUCTURE_STORAGE, s.structureType);
    })) {
      return "site";
    }

    return "blocked";
  },

  pickPreferredStorageSlot(context, storagePos, used, tag, structureType) {
    if (!storagePos) return null;

    var reserved = stamps.getReservedPositions(
      storagePos,
      "storage_hub_v1",
      tag,
    );

    for (var i = 0; i < reserved.length; i++) {
      if (
        this.isStructurePlanningPositionOpen(
          context,
          reserved[i],
          structureType,
          used,
        )
      ) {
        this.markPosUsed(used, reserved[i]);
        return reserved[i];
      }
    }

    return null;
  },

  pickPreferredAnchorSlot(context, fallbackCenterPos, used, tag, structureType) {
    var anchor = this.getAnchorOrigin(context);
    if (!anchor) return null;

    var reserved = stamps.getReservedPositions(anchor, "anchor_v1", tag);
    if (!fallbackCenterPos) fallbackCenterPos = new RoomPosition(anchor.x, anchor.y, anchor.roomName);

    reserved.sort(function (a, b) {
      return a.getRangeTo(fallbackCenterPos) - b.getRangeTo(fallbackCenterPos);
    });

    for (var i = 0; i < reserved.length; i++) {
      if (
        this.isStructurePlanningPositionOpen(
          context,
          reserved[i],
          structureType,
          used,
        )
      ) {
        this.markPosUsed(used, reserved[i]);
        return reserved[i];
      }
    }

    return null;
  },

  pickOpenPositionNear(context, centerPos, minRange, maxRange, used, structureType) {
    if (!centerPos) return null;

    var positions = this.getNearbyPositions(centerPos, minRange, maxRange);

    for (var i = 0; i < positions.length; i++) {
      if (
        this.isStructurePlanningPositionOpen(
          context,
          positions[i],
          structureType,
          used,
        )
      ) {
        this.markPosUsed(used, positions[i]);
        return positions[i];
      }
    }

    return null;
  },

  tryPlaceFirstCandidate(context, candidates, structureType, predicate) {
    for (var i = 0; i < candidates.length; i++) {
      if (this.isSiteCapReached(context)) return false;
      var pos = candidates[i];
      if (predicate && !predicate(pos)) continue;
      if (this.tryPlaceStructureSite(context, pos, structureType)) {
        return true;
      }
    }

    return false;
  },

  isHubContainerCandidate(context, pos, hubAnchorPos) {
    if (!pos || !hubAnchorPos) return false;
    if (!this.matchesHubContainerProfile(context, pos, hubAnchorPos)) return false;
    if (!this.isPlanningPositionOpen(context, pos, {})) return false;
    return true;
  },

  isControllerContainerCandidate(context, pos) {
    if (!pos || !context.room.controller) return false;
    if (!this.matchesControllerContainerProfile(context, pos)) return false;
    if (!this.isPlanningPositionOpen(context, pos, {})) return false;
    return true;
  },

  isMineralContainerCandidate(context, pos) {
    if (!pos) return false;
    if (!this.matchesMineralContainerProfile(context, pos)) return false;
    if (!this.isPlanningPositionOpen(context, pos, {})) return false;
    return true;
  },

  matchesHubContainerProfile(context, pos, hubAnchorPos) {
    if (!pos || !hubAnchorPos) return false;
    if (pos.getRangeTo(hubAnchorPos) > 4) return false;
    if (context.room.controller && pos.getRangeTo(context.room.controller) <= 4) {
      return false;
    }

    var sources = context.state.sources || [];
    for (var i = 0; i < sources.length; i++) {
      if (pos.getRangeTo(sources[i]) <= 1) return false;
    }

    return true;
  },

  matchesControllerContainerProfile(context, pos) {
    if (!pos || !context.room.controller) return false;
    if (pos.getRangeTo(context.room.controller) > 4) return false;

    var sources = context.state.sources || [];
    for (var i = 0; i < sources.length; i++) {
      if (pos.getRangeTo(sources[i]) <= 1) return false;
    }

    return true;
  },

  matchesMineralContainerProfile(context, pos) {
    if (!pos) return false;

    var minerals = context.state.minerals || context.room.find(FIND_MINERALS);
    if (!minerals || minerals.length === 0) return false;

    return pos.getRangeTo(minerals[0]) <= 1;
  },

  findPlannedHubContainer(context) {
    var spawn = context.state.spawns && context.state.spawns[0] ? context.state.spawns[0] : null;
    if (!spawn || context.room.storage) return null;

    var sites = this.getSitesByType(context, STRUCTURE_CONTAINER);
    for (var i = 0; i < sites.length; i++) {
      if (this.matchesHubContainerProfile(context, sites[i].pos, spawn.pos)) {
        return sites[i];
      }
    }

    return null;
  },

  findPlannedControllerContainer(context) {
    if (!context.room.controller) return null;

    var sites = this.getSitesByType(context, STRUCTURE_CONTAINER);
    for (var i = 0; i < sites.length; i++) {
      if (this.matchesControllerContainerProfile(context, sites[i].pos)) {
        return sites[i];
      }
    }

    return null;
  },

  findPlannedMineralContainer(context) {
    var sites = this.getSitesByType(context, STRUCTURE_CONTAINER);
    for (var i = 0; i < sites.length; i++) {
      if (this.matchesMineralContainerProfile(context, sites[i].pos)) {
        return sites[i];
      }
    }

    return null;
  },

  pickClusterPositions(context, centerPos, count, maxRange, used, structureType) {
    if (!centerPos || count <= 0) return [];

    var candidates = this.getNearbyPositions(centerPos, 1, maxRange);
    var open = [];

    for (var i = 0; i < candidates.length; i++) {
      if (
        this.isStructurePlanningPositionOpen(
          context,
          candidates[i],
          structureType,
          used,
        )
      ) {
        open.push(candidates[i]);
      }
    }

    for (var a = 0; a < open.length; a++) {
      for (var b = a + 1; b < open.length; b++) {
        for (var c = b + 1; c < open.length; c++) {
          var cluster = [open[a], open[b], open[c]];

          if (count < 3) {
            cluster = cluster.slice(0, count);
          }

          if (this.isTightCluster(cluster)) {
            for (var j = 0; j < cluster.length; j++) {
              this.markPosUsed(used, cluster[j]);
            }
            return cluster;
          }
        }
      }
    }

    var fallback = [];
    for (var k = 0; k < open.length && fallback.length < count; k++) {
      this.markPosUsed(used, open[k]);
      fallback.push(open[k]);
    }

    return fallback;
  },

  pickLabCompoundPositions(context, centerPos, count, maxRange, used, structureType) {
    if (!centerPos || count <= 0) return [];
    if (count <= 3) {
      return this.pickClusterPositions(
        context,
        centerPos,
        count,
        maxRange,
        used,
        structureType,
      );
    }

    var candidates = this.getNearbyPositions(centerPos, 1, maxRange);
    var open = [];

    for (var i = 0; i < candidates.length; i++) {
      if (
        this.isStructurePlanningPositionOpen(
          context,
          candidates[i],
          structureType,
          used,
        )
      ) {
        open.push(candidates[i]);
      }
    }

    var bestPair = null;
    var bestFollowers = [];
    var bestCapacity = 0;
    var bestDistanceScore = Infinity;

    for (var a = 0; a < open.length; a++) {
      for (var b = a + 1; b < open.length; b++) {
        if (open[a].getRangeTo(open[b]) > 2) continue;

        var followers = [];
        for (var c = 0; c < open.length; c++) {
          if (c === a || c === b) continue;
          if (
            open[c].getRangeTo(open[a]) <= 2 &&
            open[c].getRangeTo(open[b]) <= 2
          ) {
            followers.push(open[c]);
          }
        }

        var capacity = 2 + followers.length;
        var distanceScore =
          centerPos.getRangeTo(open[a]) + centerPos.getRangeTo(open[b]);

        if (
          !bestPair ||
          capacity > bestCapacity ||
          (capacity === bestCapacity && distanceScore < bestDistanceScore)
        ) {
          bestPair = [open[a], open[b]];
          bestFollowers = followers;
          bestCapacity = capacity;
          bestDistanceScore = distanceScore;
        }
      }
    }

    if (!bestPair) {
      return this.pickClusterPositions(
        context,
        centerPos,
        count,
        maxRange,
        used,
        structureType,
      );
    }

    bestFollowers.sort(function (left, right) {
      var leftScore =
        left.getRangeTo(bestPair[0]) +
        left.getRangeTo(bestPair[1]) +
        centerPos.getRangeTo(left);
      var rightScore =
        right.getRangeTo(bestPair[0]) +
        right.getRangeTo(bestPair[1]) +
        centerPos.getRangeTo(right);
      return leftScore - rightScore;
    });

    var selection = [bestPair[0], bestPair[1]];

    for (
      var j = 0;
      j < bestFollowers.length && selection.length < count;
      j++
    ) {
      selection.push(bestFollowers[j]);
    }

    for (var k = 0; k < selection.length; k++) {
      this.markPosUsed(used, selection[k]);
    }

    return selection;
  },

  getStampLabPositions(context, origin, stampName, count, used) {
    var positions = [];

    stamps.forEachLabPosition(
      origin,
      stampName,
      function (pos) {
        if (positions.length >= count) return;
        if (
          !this.isStructurePlanningPositionOpen(
            context,
            pos,
            STRUCTURE_LAB,
            used,
          )
        ) {
          return;
        }

        this.markPosUsed(used, pos);
        positions.push(pos);
      },
      this,
    );

    return positions;
  },

  isTightCluster(positions) {
    for (var i = 0; i < positions.length; i++) {
      for (var j = i + 1; j < positions.length; j++) {
        if (positions[i].getRangeTo(positions[j]) > 2) {
          return false;
        }
      }
    }

    return positions.length > 0;
  },

  getNearbyPositions(centerPos, minRange, maxRange) {
    var positions = [];

    for (var dx = -maxRange; dx <= maxRange; dx++) {
      for (var dy = -maxRange; dy <= maxRange; dy++) {
        if (dx === 0 && dy === 0) continue;

        var x = centerPos.x + dx;
        var y = centerPos.y + dy;
        var range = Math.max(Math.abs(dx), Math.abs(dy));

        if (range < minRange || range > maxRange) continue;
        if (x < 2 || x > 47 || y < 2 || y > 47) continue;

        positions.push(new RoomPosition(x, y, centerPos.roomName));
      }
    }

    positions.sort(function (a, b) {
      return centerPos.getRangeTo(a) - centerPos.getRangeTo(b);
    });

    return positions;
  },

  isPlanningPositionOpen(context, pos, used) {
    if (!pos) return false;
    if (context.terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) return false;
    if (this.isPosUsed(used, pos)) return false;

    var structures = pos.lookFor(LOOK_STRUCTURES);
    var sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

    if (sites.length > 0) return false;

    return !_.some(structures, function (structure) {
      return (
        structure.structureType !== STRUCTURE_ROAD &&
        structure.structureType !== STRUCTURE_RAMPART
      );
    });
  },

  isStructurePlanningPositionOpen(context, pos, structureType, used) {
    if (!structureType) {
      return this.isPlanningPositionOpen(context, pos, used);
    }
    if (!pos) return false;
    if (this.isPosUsed(used, pos)) return false;

    return this.canPlaceStructureSite(context, pos, structureType, true);
  },

  isPosUsed(used, pos) {
    return !!used[this.toPosKey(pos)];
  },

  markPosUsed(used, pos) {
    if (!pos) return;
    used[this.toPosKey(pos)] = true;
  },

  markSerializedPosUsed(used, pos) {
    if (!pos) return;
    used[pos.x + ":" + pos.y] = true;
  },

  markSerializedListUsed(used, positions) {
    if (!positions || positions.length === 0) return;

    for (var i = 0; i < positions.length; i++) {
      this.markSerializedPosUsed(used, positions[i]);
    }
  },

  toPosKey(pos) {
    return pos.x + ":" + pos.y;
  },

  serializePos(pos) {
    if (!pos) return null;

    return {
      x: pos.x,
      y: pos.y,
      roomName: pos.roomName,
    };
  },

  hasPlanAction(plan, action) {
    return !!plan && !!plan.buildList && plan.buildList.indexOf(action) !== -1;
  },

  getCachedFuturePlan(context) {
    var plan = context.planningPlan || roadmap.getPlan(
      context.state.phase,
      context.room.controller ? context.room.controller.level : 0,
    );
    var advancedConfig =
      config.CONSTRUCTION && config.CONSTRUCTION.ADVANCED_ACTIONS
        ? config.CONSTRUCTION.ADVANCED_ACTIONS
        : {};

    if (advancedConfig.USE_CACHED_FUTURE_PLAN === false) {
      var livePlan = this.buildFuturePlan(
        context,
        plan,
      );
      livePlan.extensionStamps = this.buildExtensionStampPlan(context, plan);
      livePlan.extensionStampPlanReady = !!livePlan.extensionStamps.ready;
      return livePlan;
    }

    if (context.futurePlan) return context.futurePlan;

    var memory = this.getRoomConstructionMemory(context.room);
    context.futurePlan = memory.futurePlan || null;
    return context.futurePlan;
  },

  getPlannedExtensionStampOrigins(context) {
    var futurePlan = this.getCachedFuturePlan(context);
    var extensionPlan =
      futurePlan && futurePlan.extensionStamps ? futurePlan.extensionStamps : null;

    if (extensionPlan && extensionPlan.origins && extensionPlan.origins.length > 0) {
      var plannedOrigins = [];
      for (var i = 0; i < extensionPlan.origins.length; i++) {
        var plannedOrigin = this.deserializePos(extensionPlan.origins[i]);
        if (plannedOrigin) plannedOrigins.push(plannedOrigin);
      }
      return plannedOrigins;
    }

    var anchor = this.getAnchorOrigin(context);
    return anchor ? stamps.getExtensionStampOrigins(anchor) : [];
  },

  deserializePos(serializedPos) {
    if (!serializedPos) return null;

    return new RoomPosition(
      serializedPos.x,
      serializedPos.y,
      serializedPos.roomName,
    );
  },

  placeLinks(context) {
    var room = context.room;
    if (!room.controller || room.controller.level < 5) return;

    var status = context.buildStatus;
    if (!status || status.linksBuilt >= status.linksNeeded) return;

    var futurePlan = this.getCachedFuturePlan(context);
    var linkPlan = futurePlan && futurePlan.links ? futurePlan.links : null;
    if (!linkPlan || !linkPlan.enabled) return;

    var candidates = [];

    if (linkPlan.controller) {
      candidates.push(linkPlan.controller);
    }

    if (linkPlan.sources && linkPlan.sources.length > 0) {
      for (var i = 0; i < linkPlan.sources.length; i++) {
        candidates.push(linkPlan.sources[i].pos);
      }
    }

    if (linkPlan.storage) {
      candidates.push(linkPlan.storage);
    }

    if (linkPlan.terminal) {
      candidates.push(linkPlan.terminal);
    }

    if (linkPlan.mineral) {
      candidates.push(linkPlan.mineral);
    }

    this.placePlannedStructureList(
      context,
      candidates,
      STRUCTURE_LINK,
      status.linksNeeded - status.linksBuilt,
    );
  },

  placeTerminal(context) {
    var room = context.room;
    if (!room.controller || room.controller.level < 6) return;

    var status = context.buildStatus;
    if (!status || status.terminalBuilt >= status.terminalNeeded) return;

    var futurePlan = this.getCachedFuturePlan(context);
    var terminalPlan = futurePlan && futurePlan.terminal ? futurePlan.terminal : null;
    if (!terminalPlan || !terminalPlan.enabled || !terminalPlan.pos) return;

    this.placePlannedStructureList(
      context,
      [terminalPlan.pos],
      STRUCTURE_TERMINAL,
      status.terminalNeeded - status.terminalBuilt,
    );
  },

  placeMineralContainer(context) {
    var room = context.room;
    var state = context.state;
    var self = this;
    var minerals = state.minerals || room.find(FIND_MINERALS);
    var mineral = minerals && minerals.length > 0 ? minerals[0] : null;

    if (!room.controller || room.controller.level < 6) return;
    if (!mineral || state.mineralContainer) return;

    var existingSite = _.find(
      this.getSitesByType(context, STRUCTURE_CONTAINER),
      function (site) {
        return self.matchesMineralContainerProfile(context, site.pos);
      },
    );
    if (existingSite) return;

    var futurePlan = this.getCachedFuturePlan(context);
    var mineralContainerPlan = futurePlan && futurePlan.mineralContainer
      ? futurePlan.mineralContainer
      : null;
    var candidates = [];

    if (mineralContainerPlan && mineralContainerPlan.pos) {
      candidates.push(this.deserializePos(mineralContainerPlan.pos));
    }

    var nearby = this.getNearbyPositions(mineral.pos, 1, 1);
    for (var i = 0; i < nearby.length; i++) {
      candidates.push(nearby[i]);
    }

    var placed = this.tryPlaceFirstCandidate(
      context,
      candidates,
      STRUCTURE_CONTAINER,
      function (pos) {
        return this.isMineralContainerCandidate(context, pos);
      }.bind(this),
    );
    if (!placed || this.isSiteCapReached(context)) return;
  },

  placeExtractor(context) {
    var room = context.room;
    if (!room.controller || room.controller.level < 6) return;

    var status = context.buildStatus;
    if (!status || status.extractorBuilt >= status.extractorNeeded) return;

    var futurePlan = this.getCachedFuturePlan(context);
    var extractorPlan = futurePlan && futurePlan.extractor
      ? futurePlan.extractor
      : null;
    if (!extractorPlan || !extractorPlan.enabled || !extractorPlan.pos) return;

    this.placePlannedStructureList(
      context,
      [extractorPlan.pos],
      STRUCTURE_EXTRACTOR,
      status.extractorNeeded - status.extractorBuilt,
    );
  },

  placeLabs(context) {
    var room = context.room;
    if (!room.controller || room.controller.level < 6) return;

    var status = context.buildStatus;
    var futurePlan = this.getCachedFuturePlan(context);
    var labPlan = futurePlan && futurePlan.labs ? futurePlan.labs : null;
    var targetLabs = labPlan && typeof labPlan.targetCount === "number"
      ? labPlan.targetCount
      : status && typeof status.unlockedLabsNeeded === "number"
        ? status.unlockedLabsNeeded
        : status && typeof status.labsNeeded === "number"
          ? status.labsNeeded
          : 0;

    if (!status || status.labsBuilt >= targetLabs) return;
    var roadAnchor = null;
    if (!labPlan || !labPlan.enabled || !labPlan.positions) return;

    if (labPlan.origin) {
      this.placeStampRoads(
        context,
        this.deserializePos(labPlan.origin),
        labPlan.stampName || "lab_cluster_v1",
      );
    } else {
      var storagePos = futurePlan && futurePlan.storagePos
        ? this.deserializePos(futurePlan.storagePos)
        : this.getStoragePlanningPosition(context);
      roadAnchor = storagePos || (context.state.spawns && context.state.spawns[0]
        ? context.state.spawns[0].pos
        : null);
    }

    this.placePlannedStructureList(
      context,
      labPlan.positions,
      STRUCTURE_LAB,
      targetLabs - status.labsBuilt,
    );

    if (!labPlan.origin && !this.isSiteCapReached(context)) {
      if (roadAnchor) {
        for (var i = 0; i < labPlan.positions.length; i++) {
          if (this.isSiteCapReached(context)) return;

          var labPos = this.deserializePos(labPlan.positions[i]);
          if (!labPos) continue;
          this.placeRoadPath(context, roadAnchor, labPos, 1);
        }
      }
    }
  },

  getMineralRoadAnchor(context) {
    var room = context.room;
    var state = context.state;
    var structuresByType = state.structuresByType || {};
    var storage = room.storage || (structuresByType[STRUCTURE_STORAGE] || [])[0] || null;
    var terminal = room.terminal || (structuresByType[STRUCTURE_TERMINAL] || [])[0] || null;
    var spawn = state.spawns && state.spawns[0] ? state.spawns[0] : null;

    return storage || terminal || spawn || null;
  },

  placeMineralAccessRoad(context) {
    var room = context.room;
    var state = context.state;
    var minerals = state.minerals || room.find(FIND_MINERALS);
    var mineral = minerals && minerals.length > 0 ? minerals[0] : null;
    var mineralContainer = state.mineralContainer || null;
    var extractors = state.structuresByType
      ? state.structuresByType[STRUCTURE_EXTRACTOR] || []
      : [];
    var hasExtractor = !!mineral && _.some(extractors, function (extractor) {
      return extractor.pos.isEqualTo(mineral.pos);
    });
    var roadAnchor = this.getMineralRoadAnchor(context);

    if (!room.controller || room.controller.level < 6) return;
    if (!context.mineralAccessRoadUnlocked) return;
    if (!mineralContainer || !hasExtractor || !roadAnchor) return;

    this.placeRoadPath(
      context,
      roadAnchor.pos ? roadAnchor.pos : roadAnchor,
      mineralContainer.pos,
      1,
    );
  },

  placeFactory(context) {
    this.placeSinglePlannedAdvancedStructure(context, {
      minControllerLevel: 7,
      structureType: STRUCTURE_FACTORY,
      planKey: "factory",
      builtKey: "factoryBuilt",
      neededKey: "factoryNeeded",
      roadOrigin: "storage",
    });
  },

  placeObserver(context) {
    this.placeSinglePlannedAdvancedStructure(context, {
      minControllerLevel: 8,
      structureType: STRUCTURE_OBSERVER,
      planKey: "observer",
      builtKey: "observerBuilt",
      neededKey: "observerNeeded",
      roadOrigin: "anchor",
    });
  },

  placePowerSpawn(context) {
    this.placeSinglePlannedAdvancedStructure(context, {
      minControllerLevel: 8,
      structureType: STRUCTURE_POWER_SPAWN,
      planKey: "powerSpawn",
      builtKey: "powerSpawnBuilt",
      neededKey: "powerSpawnNeeded",
      roadOrigin: "storage",
    });
  },

  placeNuker(context) {
    this.placeSinglePlannedAdvancedStructure(context, {
      minControllerLevel: 8,
      structureType: STRUCTURE_NUKER,
      planKey: "nuker",
      builtKey: "nukerBuilt",
      neededKey: "nukerNeeded",
      roadOrigin: "anchor",
    });
  },

  placeSinglePlannedAdvancedStructure(context, options) {
    var room = context.room;
    if (!room.controller || room.controller.level < options.minControllerLevel) {
      return;
    }

    var status = context.buildStatus;
    if (!status || status[options.builtKey] >= status[options.neededKey]) return;

    var futurePlan = this.getCachedFuturePlan(context);
    var structurePlan = futurePlan && futurePlan[options.planKey]
      ? futurePlan[options.planKey]
      : null;
    if (!structurePlan || !structurePlan.enabled || !structurePlan.pos) return;

    var pos = this.deserializePos(structurePlan.pos);
    if (!pos) return;

    var roadOrigin = null;
    if (options.roadOrigin === "storage") {
      roadOrigin = futurePlan && futurePlan.storagePos
        ? this.deserializePos(futurePlan.storagePos)
        : this.getStoragePlanningPosition(context);
    } else if (options.roadOrigin === "anchor") {
      var anchor = this.getAnchorOrigin(context);
      roadOrigin = anchor
        ? new RoomPosition(anchor.x, anchor.y, anchor.roomName)
        : null;
    }

    if (!roadOrigin && context.state.spawns && context.state.spawns[0]) {
      roadOrigin = context.state.spawns[0].pos;
    }

    this.placePlannedStructureList(
      context,
      [structurePlan.pos],
      options.structureType,
      status[options.neededKey] - status[options.builtKey],
    );

    if (roadOrigin && !this.isSiteCapReached(context)) {
      this.placeRoadPath(context, roadOrigin, pos, 1);
    }
  },

  placePlannedStructureList(context, serializedPositions, structureType, limit) {
    if (!serializedPositions || serializedPositions.length === 0 || limit <= 0) {
      return;
    }

    var placed = 0;

    for (var i = 0; i < serializedPositions.length; i++) {
      if (this.isSiteCapReached(context)) return;
      if (placed >= limit) return;

      var pos = this.deserializePos(serializedPositions[i]);
      if (!pos) continue;

      if (this.tryPlaceStructureSite(context, pos, structureType)) {
        placed++;
      }
    }
  },

  getSitesByType(context, structureType) {
    var existing =
      context.state.sitesByType && context.state.sitesByType[structureType]
        ? context.state.sitesByType[structureType]
        : [];
    var planned = context.plannedSitesByType[structureType] || [];

    return existing.concat(planned);
  },

  recordSitePlacement(context, pos, structureType) {
    if (!context.plannedSitesByType[structureType]) {
      context.plannedSitesByType[structureType] = [];
    }

    context.plannedSitesByType[structureType].push({
      pos: pos,
      structureType: structureType,
    });
    context.siteCount++;
  },

  createSite(context, pos, structureType) {
    if (pos.createConstructionSite(structureType) !== OK) return false;

    this.recordSitePlacement(context, pos, structureType);
    return true;
  },

  placeStorage(context) {
    var room = context.room;
    var state = context.state;
    if (!room.controller || room.controller.level < 4) return;

    const existing = state.structuresByType[STRUCTURE_STORAGE]
      ? state.structuresByType[STRUCTURE_STORAGE].length
      : 0;
    const sites = this.getSitesByType(context, STRUCTURE_STORAGE).length;

    if (existing + sites > 0) return;

    var storagePos = this.getStoragePlanningPosition(context);
    if (!storagePos) return;

    this.placeStampRoads(context, storagePos, "storage_hub_v1");

    stamps.forEachStoragePosition(
      storagePos,
      "storage_hub_v1",
      function (pos) {
        if (this.isSiteCapReached(context)) return;
        this.tryPlaceStructureSite(context, pos, STRUCTURE_STORAGE);
      },
      this,
    );
  },

  placeSpawns(context) {
    var room = context.room;
    if (!room.controller || room.controller.level < 7) return;

    var status = context.buildStatus;
    if (!status || status.spawnsBuilt >= status.spawnsNeeded) return;

    var anchor = this.getAnchorOrigin(context);
    if (!anchor) return;

    var remainingSpawns = status.spawnsNeeded - status.spawnsBuilt;
    var reserved = stamps.getReservedPositions(anchor, "anchor_v1", "spawn_slot");

    for (var i = 0; i < reserved.length; i++) {
      if (this.isSiteCapReached(context)) return;
      if (remainingSpawns <= 0) return;

      if (this.tryPlaceStructureSite(context, reserved[i], STRUCTURE_SPAWN)) {
        remainingSpawns--;
      }
    }

    if (remainingSpawns > 0 && !this.isSiteCapReached(context)) {
      this.placeFallbackSpawns(context, remainingSpawns);
    }
  },

  placeSourceContainers(context) {
    var room = context.room;
    var state = context.state;

    for (var i = 0; i < state.sources.length; i++) {
      if (this.isSiteCapReached(context)) return;

      var source = state.sources[i];
      var existing = state.sourceContainersBySourceId[source.id];
      var existingSite = _.find(
        this.getSitesByType(context, STRUCTURE_CONTAINER),
        function (site) {
          return site.pos.getRangeTo(source) <= 1;
        },
      );

      if (existing || existingSite) continue;

      var positions = utils.getSourceContainerPositions(room, source);
      for (var j = 0; j < positions.length; j++) {
        if (this.tryPlaceStructureSite(context, positions[j], STRUCTURE_CONTAINER)) {
          break;
        }
      }
    }
  },

  placeHubContainer(context) {
    var room = context.room;
    var state = context.state;
    var hubAnchor = state.spawns && state.spawns[0] ? state.spawns[0] : null;
    var self = this;
    if (!hubAnchor) return;
    if (room.storage) return;
    if (state.hubContainer) return;

    var existingSite = _.find(
      this.getSitesByType(context, STRUCTURE_CONTAINER),
      function (site) {
        return self.matchesHubContainerProfile(context, site.pos, hubAnchor.pos);
      },
    );
    if (existingSite) return;

    var candidates = [];
    var preferredHub = this.pickPreferredAnchorSlot(
      context,
      hubAnchor.pos,
      {},
      "hub_slot",
    );
    var preferredUtility = this.pickPreferredAnchorSlot(
      context,
      hubAnchor.pos,
      {},
      "utility_slot",
    );

    if (preferredHub) candidates.push(preferredHub);
    if (preferredUtility) candidates.push(preferredUtility);

    var nearby = this.getNearbyPositions(hubAnchor.pos, 1, 4);
    for (var i = 0; i < nearby.length; i++) {
      candidates.push(nearby[i]);
    }

    this.tryPlaceFirstCandidate(
      context,
      candidates,
      STRUCTURE_CONTAINER,
      function (pos) {
        return this.isHubContainerCandidate(context, pos, hubAnchor.pos);
      }.bind(this),
    );
  },

  placeControllerContainer(context) {
    var room = context.room;
    var state = context.state;
    var self = this;
    if (!room.controller || room.controller.level < 2) return;
    if (
      state.infrastructure &&
      state.infrastructure.hasControllerLink
    ) {
      return;
    }
    if (state.controllerContainer) return;

    var existingSite = _.find(
      this.getSitesByType(context, STRUCTURE_CONTAINER),
      function (site) {
        return self.matchesControllerContainerProfile(context, site.pos);
      },
    );
    if (existingSite) return;

    this.tryPlaceFirstCandidate(
      context,
      this.getNearbyPositions(room.controller.pos, 2, 4),
      STRUCTURE_CONTAINER,
      function (pos) {
        return this.isControllerContainerCandidate(context, pos);
      }.bind(this),
    );
  },

  placeAnchorRoads(context) {
    var origin = this.getAnchorOrigin(context);
    if (!origin) return;

    this.placeStampRoads(context, origin, "anchor_v1");
  },

  placeBackboneRoads(context) {
    var room = context.room;
    var state = context.state;
    var spawn = state.spawns[0];
    if (!spawn) return;

    var sourceContainers = state.sourceContainers || [];

    for (var i = 0; i < sourceContainers.length; i++) {
      if (this.isSiteCapReached(context)) return;

      var sourceContainer = sourceContainers[i];
      this.placeRoadPath(context, sourceContainer.pos, spawn.pos, 1);
    }

    var controllerContainer =
      state.controllerContainer || this.findPlannedControllerContainer(context);
    if (room.controller && !this.isSiteCapReached(context)) {
      this.placeRoadPath(
        context,
        spawn.pos,
        controllerContainer ? controllerContainer.pos : room.controller.pos,
        controllerContainer ? 0 : 2,
      );
    }

    var hubContainer = state.hubContainer || this.findPlannedHubContainer(context);
    if (hubContainer && !this.isSiteCapReached(context)) {
      this.placeRoadPath(context, spawn.pos, hubContainer.pos, 0);
    }
  },

  placeExtensionStamps(context) {
    var room = context.room;
    if (!room.controller) return;

    var status = context.buildStatus;
    var remainingExtensions = status.extensionsNeeded - status.extensionsBuilt;
    if (remainingExtensions <= 0) return;

    var origin = this.getAnchorOrigin(context);
    if (!origin) return;

    var stampOrigins = this.getPlannedExtensionStampOrigins(context);

    for (var i = 0; i < stampOrigins.length; i++) {
      if (this.isSiteCapReached(context)) return;
      if (remainingExtensions <= 0) return;

      // Prioritize extension sites so low site caps do not let road churn starve
      // the actual economy unlocks.
      var placed = this.placeStampExtensions(
        context,
        stampOrigins[i],
        stamps.getDefaultExtensionStampName(),
        remainingExtensions,
      );

      remainingExtensions -= placed;

      if (!this.isSiteCapReached(context) && placed > 0) {
        this.placeStampRoads(
          context,
          stampOrigins[i],
          stamps.getDefaultExtensionStampName(),
        );
      }
    }

    if (remainingExtensions > 0 && !this.isSiteCapReached(context)) {
      this.placeFallbackExtensions(context, remainingExtensions);
    }
  },

  placeTowerStamp(context) {
    var room = context.room;
    if (!room.controller || room.controller.level < 3) return;

    var status = context.buildStatus;
    var remainingTowers = status.towersNeeded - status.towersBuilt;
    if (remainingTowers <= 0) return;

    var origin = this.getAnchorOrigin(context);
    if (!origin) return;

    var towerOrigins = stamps.getTowerStampOrigins(origin);

    for (var i = 0; i < towerOrigins.length; i++) {
      if (this.isSiteCapReached(context)) return;
      if (remainingTowers <= 0) return;

      remainingTowers -= this.placeStampTowers(
        context,
        towerOrigins[i],
        "tower_cluster_v1",
        remainingTowers,
      );
    }

    if (remainingTowers > 0 && !this.isSiteCapReached(context)) {
      this.placeFallbackTowers(context, remainingTowers);
    }
  },

  placeInternalRoads(context) {
    var state = context.state;
    var spawn = state.spawns[0];
    if (!spawn) return;
    var origin = this.getAnchorOrigin(context);
    if (!origin) return;

    var targets = [];
    var used = {};

    function pushTarget(pos) {
      if (!pos) return;
      var key = pos.x + ":" + pos.y;
      if (used[key]) return;
      used[key] = true;
      targets.push(pos);
    }

    var extensionOrigins = this.getPlannedExtensionStampOrigins(context);
    for (var i = 0; i < extensionOrigins.length; i++) {
      pushTarget(
        extensionOrigins[i],
      );
    }

    var desiredTowers = context.room.controller
      ? roadmap.getDesiredTowerCount(context.room.controller.level)
      : 0;
    var towerStampCapacity = Math.max(1, stamps.getTowerCapacity("tower_cluster_v1"));
    var towerStampsNeeded = Math.ceil(desiredTowers / towerStampCapacity);
    var towerOrigins = stamps.getTowerStampOrigins(origin);
    for (var j = 0; j < towerOrigins.length && j < towerStampsNeeded; j++) {
      pushTarget(
        new RoomPosition(
          towerOrigins[j].x,
          towerOrigins[j].y,
          towerOrigins[j].roomName,
        ),
      );
    }

    var roadNodes = [spawn.pos];

    for (var k = 0; k < targets.length; k++) {
      if (this.isSiteCapReached(context)) return;
      this.connectRoadTargetToSharedNetwork(context, roadNodes, targets[k], 1);
    }
  },

  connectRoadTargetToSharedNetwork(context, roadNodes, targetPos, range) {
    if (!targetPos) return;
    if (!roadNodes || roadNodes.length <= 0) {
      roadNodes = [];
    }

    var bestSource = roadNodes.length > 0 ? roadNodes[0] : null;
    var bestRange = bestSource ? bestSource.getRangeTo(targetPos) : Infinity;

    for (var i = 1; i < roadNodes.length; i++) {
      var candidateSource = roadNodes[i];
      var candidateRange = candidateSource.getRangeTo(targetPos);

      if (candidateRange < bestRange) {
        bestSource = candidateSource;
        bestRange = candidateRange;
      }
    }

    if (bestSource) {
      this.placeRoadPath(context, bestSource, targetPos, range);
    }

    roadNodes.push(targetPos);
  },

  placeDefense(context) {
    return;
  },

  pruneOffPlanDefenseStructures(context, plan) {
    if (!context || !plan || !plan.gates || !plan.walls) return;

    var allowed = this.getDefensePlanTypeMap(plan);
    var structures = context.room.find(FIND_STRUCTURES, {
      filter: function (structure) {
        return (
          structure.structureType === STRUCTURE_RAMPART ||
          structure.structureType === STRUCTURE_WALL
        );
      },
    });

    for (var i = 0; i < structures.length; i++) {
      var structure = structures[i];
      if (!structure || !structure.pos) continue;

      var expectedType = allowed[this.toPosKey(structure.pos)];
      if (expectedType === structure.structureType) continue;
      if (typeof structure.destroy !== "function") continue;

      if (structure.destroy() === OK) {
        this.removeDestroyedDefenseFromContext(context, structure);
      }
    }
  },

  pruneOffPlanDefenseSites(context, plan) {
    if (!context || !plan || !plan.gates || !plan.walls) return;

    var allowed = this.getDefensePlanTypeMap(plan);

    var defenseTypes = [STRUCTURE_RAMPART, STRUCTURE_WALL];
    for (var t = 0; t < defenseTypes.length; t++) {
      var structureType = defenseTypes[t];
      var sites = this.getSitesByType(context, structureType);

      for (var s = 0; s < sites.length; s++) {
        var site = sites[s];
        if (!site || !site.pos) continue;
        if (allowed[this.toPosKey(site.pos)] === structureType) continue;
        if (typeof site.remove !== "function") continue;

        if (site.remove() === OK) {
          this.removeDefenseSiteFromContext(context, site);
        }
      }
    }
  },

  getDefensePlanTypeMap(plan) {
    var allowed = {};

    for (var i = 0; i < plan.gates.length; i++) {
      allowed[this.toPosKey(plan.gates[i])] = STRUCTURE_RAMPART;
    }
    for (var j = 0; j < plan.walls.length; j++) {
      allowed[this.toPosKey(plan.walls[j])] = STRUCTURE_WALL;
    }

    return allowed;
  },

  removeDestroyedDefenseFromContext(context, structure) {
    if (!context || !structure) return;

    if (
      context.state &&
      context.state.structuresByType &&
      context.state.structuresByType[structure.structureType]
    ) {
      context.state.structuresByType[structure.structureType] =
        context.state.structuresByType[structure.structureType].filter(function (entry) {
          return entry.id !== structure.id;
        });
    }

    if (context.buildStatus) {
      if (
        structure.structureType === STRUCTURE_RAMPART &&
        context.buildStatus.rampartsBuilt > 0
      ) {
        context.buildStatus.rampartsBuilt -= 1;
      } else if (
        structure.structureType === STRUCTURE_WALL &&
        context.buildStatus.wallsBuilt > 0
      ) {
        context.buildStatus.wallsBuilt -= 1;
      }
    }
  },

  removeDefenseSiteFromContext(context, site) {
    if (!context || !site) return;

    context.siteCount = Math.max(0, context.siteCount - 1);

    if (
      context.state &&
      context.state.sitesByType &&
      context.state.sitesByType[site.structureType]
    ) {
      context.state.sitesByType[site.structureType] =
        context.state.sitesByType[site.structureType].filter(function (entry) {
          return entry.id !== site.id;
        });
    }

    if (context.buildStatus) {
      if (site.structureType === STRUCTURE_RAMPART && context.buildStatus.rampartsBuilt > 0) {
        context.buildStatus.rampartsBuilt -= 1;
      } else if (site.structureType === STRUCTURE_WALL && context.buildStatus.wallsBuilt > 0) {
        context.buildStatus.wallsBuilt -= 1;
      }
    }
  },

  placeStampRoads(context, origin, stampName) {
    stamps.forEachRoadPosition(
      origin,
      stampName,
      function (pos) {
        if (this.isSiteCapReached(context)) return;
        this.tryPlaceStructureSite(context, pos, STRUCTURE_ROAD);
      },
      this,
    );
  },

  placeStampExtensions(context, origin, stampName, limit) {
    var placed = 0;

    stamps.forEachExtensionPosition(
      origin,
      stampName,
      function (pos) {
        if (this.isSiteCapReached(context)) return;
        if (placed >= limit) return;

        if (this.tryPlaceStructureSite(context, pos, STRUCTURE_EXTENSION)) {
          placed++;
        }
      },
      this,
    );

    return placed;
  },

  placeStampTowers(context, origin, stampName, limit) {
    var placed = 0;

    stamps.forEachTowerPosition(
      origin,
      stampName,
      function (pos) {
        if (this.isSiteCapReached(context)) return;
        if (placed >= limit) return;

        if (this.tryPlaceStructureSite(context, pos, STRUCTURE_TOWER)) {
          placed++;
        }
      },
      this,
    );

    return placed;
  },

  placeFallbackTowers(context, limit) {
    var anchor = this.getAnchorOrigin(context);
    if (!anchor || limit <= 0) return 0;

    var placed = 0;
    var centerPos = new RoomPosition(anchor.x, anchor.y, anchor.roomName);
    var candidates = this.getNearbyPositions(centerPos, 3, 8);

    for (var i = 0; i < candidates.length; i++) {
      if (this.isSiteCapReached(context)) return placed;
      if (placed >= limit) return placed;
      if (!this.isFallbackTowerCandidate(context, candidates[i])) continue;

      if (this.tryPlaceStructureSite(context, candidates[i], STRUCTURE_TOWER)) {
        placed++;
      }
    }

    return placed;
  },

  placeFallbackSpawns(context, limit) {
    var anchor = this.getAnchorOrigin(context);
    if (!anchor || limit <= 0) return 0;

    var placed = 0;
    var centerPos = new RoomPosition(anchor.x, anchor.y, anchor.roomName);
    var candidates = this.getNearbyPositions(centerPos, 2, 6);

    for (var i = 0; i < candidates.length; i++) {
      if (this.isSiteCapReached(context)) return placed;
      if (placed >= limit) return placed;
      if (!this.isFallbackSpawnCandidate(context, candidates[i])) continue;

      if (this.tryPlaceStructureSite(context, candidates[i], STRUCTURE_SPAWN)) {
        placed++;
      }
    }

    return placed;
  },

  isFallbackTowerCandidate(context, pos) {
    if (!pos) return false;

    var room = context.room;
    var state = context.state;
    var spawn = state.spawns && state.spawns[0] ? state.spawns[0] : null;
    var storage = room.storage || null;
    var controller = room.controller || null;
    var sources = state.sources || [];
    var minerals = state.minerals || [];

    if (spawn && pos.getRangeTo(spawn) <= 1) return false;
    if (controller && pos.getRangeTo(controller) <= 2) return false;
    if (storage && pos.getRangeTo(storage) <= 1) return false;

    for (var i = 0; i < sources.length; i++) {
      if (pos.getRangeTo(sources[i]) <= 1) return false;
    }

    for (var j = 0; j < minerals.length; j++) {
      if (pos.isEqualTo(minerals[j].pos)) return false;
    }

    return this.canPlaceStructureSite(context, pos, STRUCTURE_TOWER);
  },

  isFallbackSpawnCandidate(context, pos) {
    if (!pos) return false;

    var room = context.room;
    var state = context.state;
    var spawns = state.spawns || [];
    var storage = room.storage || null;
    var controller = room.controller || null;
    var sources = state.sources || [];
    var minerals = state.minerals || [];

    for (var i = 0; i < spawns.length; i++) {
      if (pos.getRangeTo(spawns[i]) <= 1) return false;
    }
    if (controller && pos.getRangeTo(controller) <= 2) return false;
    if (storage && pos.getRangeTo(storage) <= 1) return false;

    for (var j = 0; j < sources.length; j++) {
      if (pos.getRangeTo(sources[j]) <= 1) return false;
    }

    for (var k = 0; k < minerals.length; k++) {
      if (pos.isEqualTo(minerals[k].pos)) return false;
    }

    return this.canPlaceStructureSite(context, pos, STRUCTURE_SPAWN);
  },

  placeFallbackExtensions(context, limit) {
    var anchor = this.getAnchorOrigin(context);
    if (!anchor || limit <= 0) return 0;

    var placed = 0;
    var centerPos = new RoomPosition(anchor.x, anchor.y, anchor.roomName);
    var candidates = this.getNearbyPositions(centerPos, 4, 12);

    for (var i = 0; i < candidates.length; i++) {
      if (this.isSiteCapReached(context)) return placed;
      if (placed >= limit) return placed;
      if (!this.isFallbackExtensionCandidate(context, candidates[i])) continue;

      if (this.tryPlaceStructureSite(context, candidates[i], STRUCTURE_EXTENSION)) {
        placed++;
      }
    }

    return placed;
  },

  isFallbackExtensionCandidate(context, pos) {
    if (!pos) return false;

    var room = context.room;
    var state = context.state;
    var storage = room.storage || null;
    var controller = room.controller || null;
    var sources = state.sources || [];

    for (var i = 0; i < sources.length; i++) {
      if (pos.getRangeTo(sources[i]) <= 1) return false;
    }

    if (controller && pos.getRangeTo(controller) <= 2) return false;
    if (storage && pos.getRangeTo(storage) <= 1) return false;

    return true;
  },

  placeRoadPath(context, fromPos, toPos, range) {
    var room = context.room;
    var path = fromPos.findPathTo(toPos, {
      ignoreCreeps: true,
      range: range,
    });

    for (var i = 0; i < path.length; i++) {
      if (this.isSiteCapReached(context)) return;

      var step = path[i];
      var pos = new RoomPosition(step.x, step.y, room.name);
      this.tryPlaceStructureSite(context, pos, STRUCTURE_ROAD);
    }
  },

  tryPlaceStructureSite(context, pos, structureType) {
    if (!this.canPlaceStructureSite(context, pos, structureType)) return false;
    if (pos.createConstructionSite(structureType) !== OK) return false;

    this.recordSitePlacement(context, pos, structureType);
    return true;
  },

  hasMineralAt(context, pos) {
    if (!context || !pos) return false;

    var minerals =
      context.state && context.state.minerals
        ? context.state.minerals
        : context.room.find(FIND_MINERALS);

    for (var i = 0; i < minerals.length; i++) {
      if (minerals[i].pos.isEqualTo(pos)) return true;
    }

    return false;
  },

  canPlaceStructureSite(context, pos, structureType, allowExistingSame) {
    var isDefenseStructure =
      structureType === STRUCTURE_WALL || structureType === STRUCTURE_RAMPART;
    var extractorOnMineral =
      structureType === STRUCTURE_EXTRACTOR && this.hasMineralAt(context, pos);
    var minCoord = isDefenseStructure ? 1 : 2;
    var maxCoord = isDefenseStructure ? 48 : 47;

    if (!pos) return false;
    if (pos.x < minCoord || pos.x > maxCoord || pos.y < minCoord || pos.y > maxCoord) {
      return false;
    }
    if (!this.hasBorderSupportWalls(context, pos, structureType)) {
      return false;
    }
    if (context.terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL && !extractorOnMineral) {
      return false;
    }
    if (structureType === STRUCTURE_EXTRACTOR && !extractorOnMineral) return false;

    var structures = pos.lookFor(LOOK_STRUCTURES);
    var sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

    var hasSameStructure = _.some(structures, function (s) {
      return s.structureType === structureType;
    });

    var hasSameSite = _.some(sites, function (s) {
      return s.structureType === structureType;
    });

    if (hasSameStructure || hasSameSite) {
      return !!allowExistingSame;
    }

    var self = this;
    var blocked = _.some(structures, function (s) {
      // Legacy road coverage should not block later catch-up placement for the
      // major permanent structures that commonly arrive after the road grid.
      if (
        s.structureType === STRUCTURE_ROAD &&
        self.canReplaceRoadWithStructure(structureType)
      ) {
        return false;
      }

      return !self.canStructureTypesShareTile(structureType, s.structureType);
    });

    if (!blocked) {
      blocked = _.some(sites, function (s) {
        return !self.canStructureTypesShareTile(structureType, s.structureType);
      });
    }

    return !blocked;
  },

  hasBorderSupportWalls(context, pos, structureType) {
    if (!context || !context.terrain || !pos) return false;
    if (
      structureType === STRUCTURE_ROAD ||
      structureType === STRUCTURE_CONTAINER
    ) {
      return true;
    }

    var borderTiles = this.getBorderSupportTiles(pos.x, pos.y);
    if (!borderTiles) return true;

    for (var i = 0; i < borderTiles.length; i++) {
      if (
        context.terrain.get(borderTiles[i][0], borderTiles[i][1]) !==
        TERRAIN_MASK_WALL
      ) {
        return false;
      }
    }

    return true;
  },

  getBorderSupportTiles(x, y) {
    if (x === 1) return [[0, y - 1], [0, y], [0, y + 1]];
    if (x === 48) return [[49, y - 1], [49, y], [49, y + 1]];
    if (y === 1) return [[x - 1, 0], [x, 0], [x + 1, 0]];
    if (y === 48) return [[x - 1, 49], [x, 49], [x + 1, 49]];
    return null;
  },

  canStructureTypesShareTile(plannedType, existingType) {
    if (plannedType === existingType) return true;
    if (!plannedType || !existingType) return false;

    if (plannedType === STRUCTURE_RAMPART || existingType === STRUCTURE_RAMPART) {
      return true;
    }

    if (plannedType === STRUCTURE_ROAD) {
      return existingType === STRUCTURE_CONTAINER;
    }

    if (plannedType === STRUCTURE_CONTAINER) {
      return existingType === STRUCTURE_ROAD;
    }

    return false;
  },

  canReplaceRoadWithStructure(structureType) {
    return (
      structureType === STRUCTURE_STORAGE ||
      structureType === STRUCTURE_TOWER ||
      structureType === STRUCTURE_SPAWN ||
      structureType === STRUCTURE_LINK ||
      structureType === STRUCTURE_TERMINAL ||
      structureType === STRUCTURE_LAB ||
      structureType === STRUCTURE_FACTORY ||
      structureType === STRUCTURE_OBSERVER ||
      structureType === STRUCTURE_POWER_SPAWN ||
      structureType === STRUCTURE_NUKER
    );
  },

  getDefenseRing(context) {
    return null;
  },
};
