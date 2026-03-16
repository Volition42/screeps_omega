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
*/

const config = require("config");
const utils = require("utils");
const constructionStatus = require("construction_status");
const roadmap = require("construction_roadmap");
const stamps = require("stamp_library");

module.exports = {
  plan(room, state) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].construction) {
      Memory.rooms[room.name].construction = {};
    }

    var mem = Memory.rooms[room.name].construction;
    if (!mem.lastPlan) mem.lastPlan = 0;

    if (Game.time - mem.lastPlan < config.CONSTRUCTION.PLAN_INTERVAL) return;
    mem.lastPlan = Game.time;

    var context = this.createPlanContext(room, state);
    var plan = roadmap.getPlan(
      state.phase,
      room.controller ? room.controller.level : 0,
    );
    if (!plan || !plan.actions) return;

    for (var i = 0; i < plan.actions.length; i++) {
      if (this.isSiteCapReached(context)) return;

      var action = plan.actions[i];

      switch (action) {
        case "sourceContainers":
          this.placeSourceContainers(context);
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

        case "defense":
          this.placeDefense(context);
          break;
      }
    }
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

    const spawn = state.spawns[0];
    if (!spawn) return;

    const candidates = [
      { x: spawn.pos.x + 2, y: spawn.pos.y },
      { x: spawn.pos.x - 2, y: spawn.pos.y },
      { x: spawn.pos.x, y: spawn.pos.y + 2 },
      { x: spawn.pos.x, y: spawn.pos.y - 2 },
    ];

    for (const c of candidates) {
      const pos = new RoomPosition(c.x, c.y, room.name);

      if (context.terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) continue;

      const blocked =
        pos.lookFor(LOOK_STRUCTURES).length ||
        pos.lookFor(LOOK_CONSTRUCTION_SITES).length;

      if (!blocked) {
        this.createSite(context, pos, STRUCTURE_STORAGE);
        return;
      }
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

      var pos = utils.getSourceContainerPosition(room, source);
      if (pos) {
        this.createSite(context, pos, STRUCTURE_CONTAINER);
      }
    }
  },

  placeControllerContainer(context) {
    var room = context.room;
    if (!room.controller) return;

    var existing = context.state.controllerContainers.length;
    var existingSites = _.filter(
      this.getSitesByType(context, STRUCTURE_CONTAINER),
      function (site) {
        return room.controller && site.pos.getRangeTo(room.controller) <= 4;
      },
    ).length;

    if (existing + existingSites >= 1) return;

    var positions = utils.getControllerContainerPositions(room, 1);

    for (var i = 0; i < positions.length; i++) {
      if (this.isSiteCapReached(context)) return;

      if (this.createSite(context, positions[i], STRUCTURE_CONTAINER)) return;
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
    var controllerContainers = state.controllerContainers || [];

    for (var i = 0; i < sourceContainers.length; i++) {
      if (this.isSiteCapReached(context)) return;

      var sourceContainer = sourceContainers[i];
      this.placeRoadPath(context, sourceContainer.pos, spawn.pos, 1);

      for (var j = 0; j < controllerContainers.length; j++) {
        if (this.isSiteCapReached(context)) return;
        this.placeRoadPath(
          context,
          sourceContainer.pos,
          controllerContainers[j].pos,
          0,
        );
      }
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
    if (pos.x < 2 || pos.x > 47 || pos.y < 2 || pos.y > 47) return false;
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
    var room = context.room;
    var state = context.state;
    var spawn = state.spawns[0];
    var controller = room.controller;
    if (!spawn || !controller) return null;

    var paddingX = config.DEFENSE.PADDING_X;
    var paddingY = config.DEFENSE.PADDING_Y;

    var minX = Math.max(2, Math.min(spawn.pos.x, controller.pos.x) - paddingX);
    var maxX = Math.min(47, Math.max(spawn.pos.x, controller.pos.x) + paddingX);
    var minY = Math.max(2, Math.min(spawn.pos.y, controller.pos.y) - paddingY);
    var maxY = Math.min(47, Math.max(spawn.pos.y, controller.pos.y) + paddingY);

    var terrain = context.terrain;
    var walls = [];
    var gates = [];

    var northGateX = Math.floor((minX + maxX) / 2);
    var southGateX = northGateX;
    var westGateY = Math.floor((minY + maxY) / 2);
    var eastGateY = westGateY;

    for (var x = minX; x <= maxX; x++) {
      var top = new RoomPosition(x, minY, room.name);
      var bottom = new RoomPosition(x, maxY, room.name);

      if (terrain.get(top.x, top.y) !== TERRAIN_MASK_WALL) {
        if (x === northGateX) gates.push(top);
        else walls.push(top);
      }

      if (terrain.get(bottom.x, bottom.y) !== TERRAIN_MASK_WALL) {
        if (x === southGateX) gates.push(bottom);
        else walls.push(bottom);
      }
    }

    for (var y = minY + 1; y <= maxY - 1; y++) {
      var left = new RoomPosition(minX, y, room.name);
      var right = new RoomPosition(maxX, y, room.name);

      if (terrain.get(left.x, left.y) !== TERRAIN_MASK_WALL) {
        if (y === westGateY) gates.push(left);
        else walls.push(left);
      }

      if (terrain.get(right.x, right.y) !== TERRAIN_MASK_WALL) {
        if (y === eastGateY) gates.push(right);
        else walls.push(right);
      }
    }

    return { walls: walls, gates: gates };
  },
};
