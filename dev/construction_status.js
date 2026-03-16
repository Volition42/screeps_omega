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

module.exports = {
  getStatus(room, state) {
    if (!room.controller) {
      return this.getEmptyStatus();
    }

    var plan = roadmap.getPlan(state.phase, room.controller.level);
    var anchor = stamps.getAnchorOrigin(room, state);

    var sourceContainersBuilt = state.sourceContainers
      ? state.sourceContainers.length
      : 0;
    var sourceContainersNeeded = state.sources ? state.sources.length : 0;

    var controllerContainersBuilt = this.countControllerContainers(room, state);
    var controllerContainersNeeded = 1;

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

    var storageNeeded = this.hasAction(plan, "storage") ? 1 : 0;
    var storageBuilt = this.countBuiltAndSites(room, state, STRUCTURE_STORAGE);

    var roadsBuilt = this.countBuiltAndSites(room, state, STRUCTURE_ROAD);
    var roadsNeeded = this.getRoadGoal(room, state, plan, anchor);

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
      sites: sites,

      sourceContainersBuilt: sourceContainersBuilt,
      sourceContainersNeeded: sourceContainersNeeded,

      controllerContainersBuilt: controllerContainersBuilt,
      controllerContainersNeeded: controllerContainersNeeded,

      extensionsBuilt: extensionsBuilt,
      extensionsNeeded: extensionsNeeded,

      towersBuilt: towersBuilt,
      towersNeeded: towersNeeded,

      storageBuilt: storageBuilt,
      storageNeeded: storageNeeded,

      roadsBuilt: roadsBuilt,
      roadsNeeded: roadsNeeded,

      wallsBuilt: wallsBuilt,
      wallsNeeded: defenseGoal.walls,

      rampartsBuilt: rampartsBuilt,
      rampartsNeeded: defenseGoal.ramparts,
    };

    status.roadCompletionRatio =
      status.roadsNeeded > 0 ? status.roadsBuilt / status.roadsNeeded : 1;

    status.bootstrapComplete =
      status.sourceContainersBuilt >= status.sourceContainersNeeded &&
      status.controllerContainersBuilt >= status.controllerContainersNeeded &&
      this.hasEnoughRoadsForBootstrap(status, room);

    status.developingComplete =
      status.extensionsBuilt >= status.extensionsNeeded &&
      status.towersBuilt >= status.towersNeeded &&
      status.storageBuilt >= status.storageNeeded &&
      status.wallsBuilt >= status.wallsNeeded &&
      status.rampartsBuilt >= status.rampartsNeeded;

    status.stableReady = status.bootstrapComplete && status.developingComplete;

    return status;
  },

  getEmptyStatus() {
    return {
      phase: "bootstrap_jr",
      sites: 0,

      sourceContainersBuilt: 0,
      sourceContainersNeeded: 0,

      controllerContainersBuilt: 0,
      controllerContainersNeeded: 0,

      extensionsBuilt: 0,
      extensionsNeeded: 0,

      towersBuilt: 0,
      towersNeeded: 0,

      storageBuilt: 0,
      storageNeeded: 0,

      roadsBuilt: 0,
      roadsNeeded: 0,

      wallsBuilt: 0,
      wallsNeeded: 0,

      rampartsBuilt: 0,
      rampartsNeeded: 0,

      roadCompletionRatio: 0,

      bootstrapComplete: false,
      developingComplete: false,
      stableReady: false,
    };
  },

  hasEnoughRoadsForBootstrap(status, room) {
    // Developer note:
    // Migrated rooms may have useful but non-perfect road layouts.
    // Treat bootstrap as complete once roads are "good enough" for operation.
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

  countControllerContainers(room, state) {
    var built = state.controllerContainers
      ? state.controllerContainers.length
      : room.find(FIND_STRUCTURES, {
          filter: function (s) {
            return (
              s.structureType === STRUCTURE_CONTAINER &&
              room.controller &&
              s.pos.getRangeTo(room.controller) <= 4
            );
          },
        }).length;

    var sites = state.sites
      ? _.filter(state.sites, function (site) {
          return (
            site.structureType === STRUCTURE_CONTAINER &&
            room.controller &&
            site.pos.getRangeTo(room.controller) <= 4
          );
        }).length
      : room.find(FIND_CONSTRUCTION_SITES, {
          filter: function (s) {
            return (
              s.structureType === STRUCTURE_CONTAINER &&
              room.controller &&
              s.pos.getRangeTo(room.controller) <= 4
            );
          },
        }).length;

    return built + sites;
  },

  getRoadGoal(room, state, plan, anchor) {
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

    return total;
  },

  getBackboneRoadGoal(room, state) {
    var spawn = state.spawns && state.spawns[0];
    if (!spawn) return 0;

    var estimate = 0;
    var sourceContainers = state.sourceContainers || [];
    var controllerContainers = state.controllerContainers || [];

    for (var i = 0; i < sourceContainers.length; i++) {
      var sourceContainer = sourceContainers[i];
      estimate += Math.max(1, sourceContainer.pos.getRangeTo(spawn.pos));

      for (var j = 0; j < controllerContainers.length; j++) {
        var controllerContainer = controllerContainers[j];
        estimate += Math.max(
          1,
          sourceContainer.pos.getRangeTo(controllerContainer.pos),
        );
      }
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

  getDefenseGoal(room, state) {
    var spawn = state.spawns && state.spawns[0];
    var controller = room.controller;

    if (!spawn || !controller || !config.DEFENSE.ENABLED) {
      return { walls: 0, ramparts: 0 };
    }

    if (controller.level < config.DEFENSE.MIN_CONTROLLER_LEVEL) {
      return { walls: 0, ramparts: 0 };
    }

    var paddingX = config.DEFENSE.PADDING_X || 5;
    var paddingY = config.DEFENSE.PADDING_Y || 5;

    var minX = Math.max(2, Math.min(spawn.pos.x, controller.pos.x) - paddingX);
    var maxX = Math.min(47, Math.max(spawn.pos.x, controller.pos.x) + paddingX);
    var minY = Math.max(2, Math.min(spawn.pos.y, controller.pos.y) - paddingY);
    var maxY = Math.min(47, Math.max(spawn.pos.y, controller.pos.y) + paddingY);

    var terrain = room.getTerrain();
    var walls = 0;
    var ramparts = 0;

    var northGateX = Math.floor((minX + maxX) / 2);
    var southGateX = northGateX;
    var westGateY = Math.floor((minY + maxY) / 2);
    var eastGateY = westGateY;

    for (var x = minX; x <= maxX; x++) {
      if (terrain.get(x, minY) !== TERRAIN_MASK_WALL) {
        if (x === northGateX) ramparts++;
        else walls++;
      }

      if (terrain.get(x, maxY) !== TERRAIN_MASK_WALL) {
        if (x === southGateX) ramparts++;
        else walls++;
      }
    }

    for (var y = minY + 1; y <= maxY - 1; y++) {
      if (terrain.get(minX, y) !== TERRAIN_MASK_WALL) {
        if (y === westGateY) ramparts++;
        else walls++;
      }

      if (terrain.get(maxX, y) !== TERRAIN_MASK_WALL) {
        if (y === eastGateY) ramparts++;
        else walls++;
      }
    }

    return { walls: walls, ramparts: ramparts };
  },

  hasAction(plan, action) {
    if (!plan) return false;

    var buildList = plan.buildList || plan.actions || [];
    return buildList.indexOf(action) !== -1;
  },
};
