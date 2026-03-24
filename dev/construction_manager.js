/*
Developer Summary:
Construction Manager

Purpose:
- Execute the current phase construction roadmap
- Place structures from reusable stamps / tile-sets
- Keep room buildout aligned with construction_status.js

Current stamp behavior:
- Anchor uses the first spawn as the base origin
- Extension fields use tileable plus-shaped stamps around the anchor
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
const defenseLayout = require("defense_layout");

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

    var context = this.createPlanContext(room, state);
    var plan = roadmap.getPlan(
      state.phase,
      room.controller ? room.controller.level : 0,
    );
    if (!plan || !plan.buildList) return;

    this.refreshFuturePlan(context, plan, mem);
    context.futurePlan = mem.futurePlan || null;

    for (var i = 0; i < plan.buildList.length; i++) {
      if (this.isSiteCapReached(context)) break;

      var action = plan.buildList[i];

      switch (action) {
        case "sourceContainers":
          this.placeSourceContainers(context);
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

        case "links":
          this.placeLinks(context);
          break;

        case "terminal":
          this.placeTerminal(context);
          break;

        case "extractor":
          this.placeExtractor(context);
          break;

        case "labs":
          this.placeLabs(context);
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

  getRoomConstructionMemory(room) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].construction) {
      Memory.rooms[room.name].construction = {};
    }

    return Memory.rooms[room.name].construction;
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
    memory.futurePlan = this.buildFuturePlan(context, plan);
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

    return [
      plan.roadmapPhase,
      controllerLevel,
      storageCount,
      sourceCount,
      storagePos ? storagePos.x : "na",
      storagePos ? storagePos.y : "na",
      anchor ? anchor.x : "na",
      anchor ? anchor.y : "na",
    ].join(":");
  },

  buildFuturePlan(context, plan) {
    var room = context.room;
    var storagePos = this.getStoragePlanningPosition(context);
    var linkPlan = this.buildLinkPlan(context, plan, storagePos);
    var used = {};
    var terminalPlan = this.buildTerminalPlan(
      context,
      plan,
      storagePos,
      linkPlan,
      used,
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
      linkPlanReady: !!linkPlan.ready,
      terminalPlanReady: !!terminalPlan.ready,
      extractorPlanReady: !!extractorPlan.ready,
      labPlanReady: !!labPlan.ready,
      factoryPlanReady: !!factoryPlan.ready,
      observerPlanReady: !!observerPlan.ready,
      powerSpawnPlanReady: !!powerSpawnPlan.ready,
      nukerPlanReady: !!nukerPlan.ready,
      links: linkPlan,
      terminal: terminalPlan,
      extractor: extractorPlan,
      labs: labPlan,
      factory: factoryPlan,
      observer: observerPlan,
      powerSpawn: powerSpawnPlan,
      nuker: nukerPlan,
    };
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
      };
    }

    controllerLinkPos = room.controller
      ? this.pickOpenPositionNear(
          context,
          room.controller.pos,
          1,
          config.CONSTRUCTION.FUTURE_INFRA.LINK_CONTROLLER_RANGE || 2,
          used,
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
      );

      if (!storageLinkPos) {
        storageLinkPos = this.pickOpenPositionNear(
          context,
          storagePos,
          1,
          config.CONSTRUCTION.FUTURE_INFRA.STORAGE_LINK_RANGE || 2,
          used,
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
    };
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
      ) ||
      this.pickOpenPositionNear(
        context,
        storagePos,
        1,
        config.CONSTRUCTION.FUTURE_INFRA.TERMINAL_RANGE_FROM_STORAGE || 2,
        used,
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

    return {
      enabled: !!mineral,
      ready: !!mineral,
      mineralId: mineral ? mineral.id : null,
      pos: this.serializePos(mineral ? mineral.pos : null),
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
    var stampOrigin = storagePos
      ? this.pickPreferredStorageSlot(
          context,
          storagePos,
          used,
          "lab_anchor_slot",
        )
      : null;

    var centerPos = storagePos || (context.state.spawns && context.state.spawns[0]
      ? context.state.spawns[0].pos
      : null);
    var positions = stampOrigin && targetCount <= 3
      ? this.getStampLabPositions(
          context,
          stampOrigin,
          "lab_cluster_v1",
          targetCount,
          used,
        )
      : [];

    if (positions.length < targetCount) {
      positions = this.pickLabCompoundPositions(
        context,
        centerPos,
        targetCount,
        config.CONSTRUCTION.FUTURE_INFRA.LAB_RANGE_FROM_STORAGE || 6,
        used,
      );
      stampOrigin = null;
    }

    return {
      enabled: true,
      ready: positions.length >= targetCount,
      targetCount: targetCount,
      origin: this.serializePos(stampOrigin),
      positions: _.map(positions, this.serializePos, this),
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
        anchorTag: "hub_slot",
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
        anchorTag: "hub_slot",
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
        )
      : null;

    if (!pos && storagePos) {
      pos = this.pickOpenPositionNear(
        context,
        storagePos,
        1,
        options.storageRange || 3,
        used,
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
    );

    if (!pos && anchorPos) {
      pos = this.pickOpenPositionNear(
        context,
        anchorPos,
        2,
        options.anchorRange || 6,
        used,
      );
    }

    return {
      enabled: true,
      ready: !!pos,
      pos: this.serializePos(pos),
    };
  },

  getStoragePlanningPosition(context) {
    var storage = context.state.structuresByType[STRUCTURE_STORAGE];
    if (storage && storage.length > 0) {
      return storage[0].pos;
    }

    var storageSites = this.getSitesByType(context, STRUCTURE_STORAGE);
    if (storageSites.length > 0) {
      return storageSites[0].pos;
    }

    var anchor = this.getAnchorOrigin(context);
    var candidates = anchor
      ? _.map(stamps.getStorageStampOrigins(anchor), function (origin) {
          return new RoomPosition(origin.x, origin.y, origin.roomName);
        })
      : [];

    for (var i = 0; i < candidates.length; i++) {
      if (this.isPlanningPositionOpen(context, candidates[i], {})) {
        return candidates[i];
      }
    }

    return null;
  },

  pickPreferredStorageSlot(context, storagePos, used, tag) {
    if (!storagePos) return null;

    var reserved = stamps.getReservedPositions(
      storagePos,
      "storage_hub_v1",
      tag,
    );

    for (var i = 0; i < reserved.length; i++) {
      if (this.isPlanningPositionOpen(context, reserved[i], used)) {
        this.markPosUsed(used, reserved[i]);
        return reserved[i];
      }
    }

    return null;
  },

  pickPreferredAnchorSlot(context, fallbackCenterPos, used, tag) {
    var anchor = this.getAnchorOrigin(context);
    if (!anchor) return null;

    var reserved = stamps.getReservedPositions(anchor, "anchor_v1", tag);
    if (!fallbackCenterPos) fallbackCenterPos = new RoomPosition(anchor.x, anchor.y, anchor.roomName);

    reserved.sort(function (a, b) {
      return a.getRangeTo(fallbackCenterPos) - b.getRangeTo(fallbackCenterPos);
    });

    for (var i = 0; i < reserved.length; i++) {
      if (this.isPlanningPositionOpen(context, reserved[i], used)) {
        this.markPosUsed(used, reserved[i]);
        return reserved[i];
      }
    }

    return null;
  },

  pickOpenPositionNear(context, centerPos, minRange, maxRange, used) {
    if (!centerPos) return null;

    var positions = this.getNearbyPositions(centerPos, minRange, maxRange);

    for (var i = 0; i < positions.length; i++) {
      if (this.isPlanningPositionOpen(context, positions[i], used)) {
        this.markPosUsed(used, positions[i]);
        return positions[i];
      }
    }

    return null;
  },

  pickClusterPositions(context, centerPos, count, maxRange, used) {
    if (!centerPos || count <= 0) return [];

    var candidates = this.getNearbyPositions(centerPos, 1, maxRange);
    var open = [];

    for (var i = 0; i < candidates.length; i++) {
      if (this.isPlanningPositionOpen(context, candidates[i], used)) {
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

  pickLabCompoundPositions(context, centerPos, count, maxRange, used) {
    if (!centerPos || count <= 0) return [];
    if (count <= 3) {
      return this.pickClusterPositions(context, centerPos, count, maxRange, used);
    }

    var candidates = this.getNearbyPositions(centerPos, 1, maxRange);
    var open = [];

    for (var i = 0; i < candidates.length; i++) {
      if (this.isPlanningPositionOpen(context, candidates[i], used)) {
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
      return this.pickClusterPositions(context, centerPos, count, maxRange, used);
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
        if (!this.isPlanningPositionOpen(context, pos, used)) return;

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
    var advancedConfig =
      config.CONSTRUCTION && config.CONSTRUCTION.ADVANCED_ACTIONS
        ? config.CONSTRUCTION.ADVANCED_ACTIONS
        : {};

    if (advancedConfig.USE_CACHED_FUTURE_PLAN === false) {
      return this.buildFuturePlan(
        context,
        roadmap.getPlan(
          context.state.phase,
          context.room.controller ? context.room.controller.level : 0,
        ),
      );
    }

    if (context.futurePlan) return context.futurePlan;

    var memory = this.getRoomConstructionMemory(context.room);
    context.futurePlan = memory.futurePlan || null;
    return context.futurePlan;
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
    if (!status || status.labsBuilt >= status.labsNeeded) return;

    var futurePlan = this.getCachedFuturePlan(context);
    var labPlan = futurePlan && futurePlan.labs ? futurePlan.labs : null;
    var roadAnchor = null;
    if (!labPlan || !labPlan.enabled || !labPlan.positions) return;

    if (labPlan.origin) {
      this.placeStampRoads(
        context,
        this.deserializePos(labPlan.origin),
        "lab_cluster_v1",
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
      status.labsNeeded - status.labsBuilt,
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

      var pos = utils.getSourceContainerPosition(room, source);
      if (pos) {
        this.createSite(context, pos, STRUCTURE_CONTAINER);
      }
    }
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

    if (room.controller && !this.isSiteCapReached(context)) {
      this.placeRoadPath(context, spawn.pos, room.controller.pos, 2);
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

    var stampOrigins = stamps.getExtensionStampOrigins(origin);

    for (var i = 0; i < stampOrigins.length; i++) {
      if (this.isSiteCapReached(context)) return;
      if (remainingExtensions <= 0) return;

      // Roads first so the stamp network starts forming immediately.
      this.placeStampRoads(context, stampOrigins[i], "extension_plus_v1");

      // Then place extensions from the same stamp.
      remainingExtensions -= this.placeStampExtensions(
        context,
        stampOrigins[i],
        "extension_plus_v1",
        remainingExtensions,
      );
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

      this.placeStampRoads(context, towerOrigins[i], "tower_cluster_v1");
      remainingTowers -= this.placeStampTowers(
        context,
        towerOrigins[i],
        "tower_cluster_v1",
        remainingTowers,
      );
    }
  },

  placeInternalRoads(context) {
    var room = context.room;
    var state = context.state;
    var spawn = state.spawns[0];
    if (!spawn) return;

    var extensions = state.extensions || [];
    var towers = state.structuresByType[STRUCTURE_TOWER] || [];

    for (var i = 0; i < extensions.length; i++) {
      if (this.isSiteCapReached(context)) return;
      this.placeRoadPath(context, spawn.pos, extensions[i].pos, 1);
    }

    for (var j = 0; j < towers.length; j++) {
      if (this.isSiteCapReached(context)) return;
      this.placeRoadPath(context, spawn.pos, towers[j].pos, 1);
    }
  },

  placeDefense(context) {
    var plan = this.getDefenseRing(context);
    if (!plan) return;

    for (var i = 0; i < plan.gates.length; i++) {
      if (this.isSiteCapReached(context)) return;
      this.tryPlaceStructureSite(context, plan.gates[i], STRUCTURE_RAMPART);
    }

    for (var j = 0; j < plan.walls.length; j++) {
      if (this.isSiteCapReached(context)) return;
      this.tryPlaceStructureSite(context, plan.walls[j], STRUCTURE_WALL);
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
    var room = context.room;
    var isDefenseStructure =
      structureType === STRUCTURE_WALL || structureType === STRUCTURE_RAMPART;
    var minCoord = isDefenseStructure ? 1 : 2;
    var maxCoord = isDefenseStructure ? 48 : 47;

    if (pos.x < minCoord || pos.x > maxCoord || pos.y < minCoord || pos.y > maxCoord) {
      return false;
    }
    if (context.terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) return false;

    var structures = pos.lookFor(LOOK_STRUCTURES);
    var sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

    var hasSameStructure = _.some(structures, function (s) {
      return s.structureType === structureType;
    });

    var hasSameSite = _.some(sites, function (s) {
      return s.structureType === structureType;
    });

    if (hasSameStructure || hasSameSite) return false;

    var blocked = _.some(structures, function (s) {
      if (structureType === STRUCTURE_ROAD) {
        return (
          s.structureType !== STRUCTURE_ROAD &&
          s.structureType !== STRUCTURE_CONTAINER
        );
      }

      return (
        s.structureType !== STRUCTURE_ROAD &&
        s.structureType !== STRUCTURE_CONTAINER
      );
    });

    if (blocked) return false;

    if (pos.createConstructionSite(structureType) !== OK) return false;

    this.recordSitePlacement(context, pos, structureType);
    return true;
  },

  getDefenseRing(context) {
    return defenseLayout.getPlan(context.room, context.state);
  },
};
