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

    var plan = roadmap.getPlan(
      state.phase,
      room.controller ? room.controller.level : 0,
    );
    if (!plan || !plan.actions) return;

    for (var i = 0; i < plan.actions.length; i++) {
      if (this.isSiteCapReached(room)) return;

      var action = plan.actions[i];

      switch (action) {
        case "sourceContainers":
          this.placeSourceContainers(room, state);
          break;

        case "controllerContainer":
          this.placeControllerContainer(room);
          break;

        case "anchorRoads":
          this.placeAnchorRoads(room, state);
          break;

        case "backboneRoads":
          this.placeBackboneRoads(room, state);
          break;

        case "extensionStamps":
          this.placeExtensionStamps(room, state);
          break;

        case "towerStamp":
          this.placeTowerStamp(room, state);
          break;

        case "internalRoads":
          this.placeInternalRoads(room, state);
          break;

        case "defense":
          this.placeDefense(room, state);
          break;
      }
    }
  },

  isSiteCapReached(room) {
    return (
      room.find(FIND_CONSTRUCTION_SITES).length >= config.CONSTRUCTION.MAX_SITES
    );
  },

  placeSourceContainers(room, state) {
    for (var i = 0; i < state.sources.length; i++) {
      if (this.isSiteCapReached(room)) return;

      var source = state.sources[i];

      var existing = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: function (s) {
          return s.structureType === STRUCTURE_CONTAINER;
        },
      })[0];

      var existingSite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
        filter: function (s) {
          return s.structureType === STRUCTURE_CONTAINER;
        },
      })[0];

      if (existing || existingSite) continue;

      var pos = utils.getSourceContainerPosition(room, source);
      if (pos) {
        pos.createConstructionSite(STRUCTURE_CONTAINER);
      }
    }
  },

  placeControllerContainer(room) {
    if (!room.controller) return;

    var existing = room.find(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          s.pos.getRangeTo(room.controller) <= 4
        );
      },
    }).length;

    var existingSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          s.pos.getRangeTo(room.controller) <= 4
        );
      },
    }).length;

    if (existing + existingSites >= 1) return;

    var positions = utils.getControllerContainerPositions(room, 1);

    for (var i = 0; i < positions.length; i++) {
      if (this.isSiteCapReached(room)) return;

      var result = positions[i].createConstructionSite(STRUCTURE_CONTAINER);
      if (result === OK) return;
    }
  },

  placeAnchorRoads(room, state) {
    var origin = stamps.getAnchorOrigin(room, state);
    if (!origin) return;

    this.placeStampRoads(room, origin, "anchor_v1");
  },

  placeBackboneRoads(room, state) {
    var spawn = state.spawns[0];
    if (!spawn) return;

    var sourceContainers = state.sourceContainers || [];
    var controllerContainers = state.controllerContainers || [];

    for (var i = 0; i < sourceContainers.length; i++) {
      if (this.isSiteCapReached(room)) return;

      var sourceContainer = sourceContainers[i];
      this.placeRoadPath(room, sourceContainer.pos, spawn.pos, 1);

      for (var j = 0; j < controllerContainers.length; j++) {
        if (this.isSiteCapReached(room)) return;
        this.placeRoadPath(
          room,
          sourceContainer.pos,
          controllerContainers[j].pos,
          0,
        );
      }
    }
  },

  placeExtensionStamps(room, state) {
    if (!room.controller) return;

    var status = constructionStatus.getStatus(room, state);
    var remainingExtensions = status.extensionsNeeded - status.extensionsBuilt;
    if (remainingExtensions <= 0) return;

    var origin = stamps.getAnchorOrigin(room, state);
    if (!origin) return;

    var stampOrigins = stamps.getExtensionStampOrigins(origin);

    for (var i = 0; i < stampOrigins.length; i++) {
      if (this.isSiteCapReached(room)) return;
      if (remainingExtensions <= 0) return;

      // Roads first so the stamp network starts forming immediately.
      this.placeStampRoads(room, stampOrigins[i], "extension_plus_v1");

      // Then place extensions from the same stamp.
      remainingExtensions -= this.placeStampExtensions(
        room,
        stampOrigins[i],
        "extension_plus_v1",
        remainingExtensions,
      );
    }
  },

  placeTowerStamp(room, state) {
    if (!room.controller || room.controller.level < 3) return;

    var status = constructionStatus.getStatus(room, state);
    var remainingTowers = status.towersNeeded - status.towersBuilt;
    if (remainingTowers <= 0) return;

    var origin = stamps.getAnchorOrigin(room, state);
    if (!origin) return;

    var towerOrigins = stamps.getTowerStampOrigins(origin);

    for (var i = 0; i < towerOrigins.length; i++) {
      if (this.isSiteCapReached(room)) return;
      if (remainingTowers <= 0) return;

      this.placeStampRoads(room, towerOrigins[i], "tower_cluster_v1");
      remainingTowers -= this.placeStampTowers(
        room,
        towerOrigins[i],
        "tower_cluster_v1",
        remainingTowers,
      );
    }
  },

  placeInternalRoads(room, state) {
    var spawn = state.spawns[0];
    if (!spawn) return;

    var extensions = room.find(FIND_STRUCTURES, {
      filter: function (s) {
        return s.structureType === STRUCTURE_EXTENSION;
      },
    });

    var towers = room.find(FIND_STRUCTURES, {
      filter: function (s) {
        return s.structureType === STRUCTURE_TOWER;
      },
    });

    for (var i = 0; i < extensions.length; i++) {
      if (this.isSiteCapReached(room)) return;
      this.placeRoadPath(room, spawn.pos, extensions[i].pos, 1);
    }

    for (var j = 0; j < towers.length; j++) {
      if (this.isSiteCapReached(room)) return;
      this.placeRoadPath(room, spawn.pos, towers[j].pos, 1);
    }
  },

  placeDefense(room, state) {
    var plan = this.getDefenseRing(room, state);
    if (!plan) return;

    for (var i = 0; i < plan.gates.length; i++) {
      if (this.isSiteCapReached(room)) return;
      this.tryPlaceStructureSite(room, plan.gates[i], STRUCTURE_RAMPART);
    }

    for (var j = 0; j < plan.walls.length; j++) {
      if (this.isSiteCapReached(room)) return;
      this.tryPlaceStructureSite(room, plan.walls[j], STRUCTURE_WALL);
    }
  },

  placeStampRoads(room, origin, stampName) {
    stamps.forEachRoadPosition(
      origin,
      stampName,
      function (pos) {
        if (this.isSiteCapReached(room)) return;
        this.tryPlaceStructureSite(room, pos, STRUCTURE_ROAD);
      },
      this,
    );
  },

  placeStampExtensions(room, origin, stampName, limit) {
    var placed = 0;

    stamps.forEachExtensionPosition(
      origin,
      stampName,
      function (pos) {
        if (this.isSiteCapReached(room)) return;
        if (placed >= limit) return;

        if (this.tryPlaceStructureSite(room, pos, STRUCTURE_EXTENSION)) {
          placed++;
        }
      },
      this,
    );

    return placed;
  },

  placeStampTowers(room, origin, stampName, limit) {
    var placed = 0;

    stamps.forEachTowerPosition(
      origin,
      stampName,
      function (pos) {
        if (this.isSiteCapReached(room)) return;
        if (placed >= limit) return;

        if (this.tryPlaceStructureSite(room, pos, STRUCTURE_TOWER)) {
          placed++;
        }
      },
      this,
    );

    return placed;
  },

  placeRoadPath(room, fromPos, toPos, range) {
    var path = fromPos.findPathTo(toPos, {
      ignoreCreeps: true,
      range: range,
    });

    for (var i = 0; i < path.length; i++) {
      if (this.isSiteCapReached(room)) return;

      var step = path[i];
      var pos = new RoomPosition(step.x, step.y, room.name);
      this.tryPlaceStructureSite(room, pos, STRUCTURE_ROAD);
    }
  },

  tryPlaceStructureSite(room, pos, structureType) {
    if (pos.x < 2 || pos.x > 47 || pos.y < 2 || pos.y > 47) return false;
    if (room.getTerrain().get(pos.x, pos.y) === TERRAIN_MASK_WALL) return false;

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

    return pos.createConstructionSite(structureType) === OK;
  },

  getDefenseRing(room, state) {
    var spawn = state.spawns[0];
    var controller = room.controller;
    if (!spawn || !controller) return null;

    var paddingX = config.DEFENSE.PADDING_X;
    var paddingY = config.DEFENSE.PADDING_Y;

    var minX = Math.max(2, Math.min(spawn.pos.x, controller.pos.x) - paddingX);
    var maxX = Math.min(47, Math.max(spawn.pos.x, controller.pos.x) + paddingX);
    var minY = Math.max(2, Math.min(spawn.pos.y, controller.pos.y) - paddingY);
    var maxY = Math.min(47, Math.max(spawn.pos.y, controller.pos.y) + paddingY);

    var terrain = room.getTerrain();
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
