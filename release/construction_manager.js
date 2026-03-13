const config = require("config");
const utils = require("utils");
const constructionStatus = require("construction_status");

module.exports = {
  /*
  Developer Note:
  Construction is phase-driven and synced to construction_status.js.

  This file decides what to place.
  construction_status decides what "done enough" means.
  */

  plan(room, state) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].construction) {
      Memory.rooms[room.name].construction = {};
    }

    const mem = Memory.rooms[room.name].construction;
    if (!mem.lastPlan) mem.lastPlan = 0;

    if (Game.time - mem.lastPlan < config.CONSTRUCTION.PLAN_INTERVAL) return;
    mem.lastPlan = Game.time;

    switch (state.phase) {
      case "bootstrap_jr":
        this.planBootstrapJr(room, state);
        break;

      case "bootstrap":
        this.planBootstrap(room, state);
        break;

      case "developing":
        this.planDeveloping(room, state);
        break;

      case "stable":
        this.planStable(room, state);
        break;

      default:
        this.planBootstrap(room, state);
        break;
    }
  },

  planBootstrapJr(room, state) {},

  planBootstrap(room, state) {
    if (this.isSiteCapReached(room)) return;
    this.placeSourceContainers(room, state);

    if (this.isSiteCapReached(room)) return;
    this.placeControllerContainers(room);

    const status = constructionStatus.getStatus(room, state);

    if (
      status.sourceContainersBuilt >= status.sourceContainersNeeded &&
      status.controllerContainersBuilt >= status.controllerContainersNeeded
    ) {
      if (this.isSiteCapReached(room)) return;
      this.placeRoads(room, state);
    }
  },

  planDeveloping(room, state) {
    if (this.isSiteCapReached(room)) return;
    this.placeSourceContainers(room, state);

    if (this.isSiteCapReached(room)) return;
    this.placeControllerContainers(room);

    const status = constructionStatus.getStatus(room, state);

    if (
      status.sourceContainersBuilt >= status.sourceContainersNeeded &&
      status.controllerContainersBuilt >= status.controllerContainersNeeded
    ) {
      if (this.isSiteCapReached(room)) return;
      this.placeRoads(room, state);
    }

    if (this.isSiteCapReached(room)) return;
    this.placeExtensions(room, state);

    if (this.isSiteCapReached(room)) return;
    this.placeInternalRoads(room, state);

    if (
      config.DEFENSE.ENABLED &&
      room.controller &&
      room.controller.level >= config.DEFENSE.MIN_CONTROLLER_LEVEL
    ) {
      if (this.isSiteCapReached(room)) return;
      this.placeDefense(room, state);
    }

    if (room.controller && room.controller.level >= 3) {
      if (this.isSiteCapReached(room)) return;
      this.placeTower(room, state);
    }
  },

  planStable(room, state) {
    if (this.isSiteCapReached(room)) return;
    this.placeExtensions(room, state);

    if (this.isSiteCapReached(room)) return;
    this.placeInternalRoads(room, state);

    if (
      config.DEFENSE.ENABLED &&
      room.controller &&
      room.controller.level >= config.DEFENSE.MIN_CONTROLLER_LEVEL
    ) {
      if (this.isSiteCapReached(room)) return;
      this.placeDefense(room, state);
    }

    if (room.controller && room.controller.level >= 3) {
      if (this.isSiteCapReached(room)) return;
      this.placeTower(room, state);
    }
  },

  isSiteCapReached(room) {
    return (
      room.find(FIND_CONSTRUCTION_SITES).length >= config.CONSTRUCTION.MAX_SITES
    );
  },

  placeSourceContainers(room, state) {
    for (let i = 0; i < state.sources.length; i++) {
      if (this.isSiteCapReached(room)) return;

      const source = state.sources[i];

      const existing = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: function (s) {
          return s.structureType === STRUCTURE_CONTAINER;
        },
      })[0];

      const existingSite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
        filter: function (s) {
          return s.structureType === STRUCTURE_CONTAINER;
        },
      })[0];

      if (existing || existingSite) continue;

      const pos = utils.getSourceContainerPosition(room, source);
      if (pos) {
        pos.createConstructionSite(STRUCTURE_CONTAINER);
      }
    }
  },

  placeControllerContainers(room) {
    if (!room.controller) return;

    const existing = room.find(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          s.pos.getRangeTo(room.controller) <= 4
        );
      },
    }).length;

    const existingSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          s.pos.getRangeTo(room.controller) <= 4
        );
      },
    }).length;

    if (existing + existingSites >= 1) return;

    const positions = utils.getControllerContainerPositions(room, 1);

    for (let i = 0; i < positions.length; i++) {
      if (this.isSiteCapReached(room)) return;

      const result = positions[i].createConstructionSite(STRUCTURE_CONTAINER);
      if (result === OK) return;
    }
  },

  placeRoads(room, state) {
    const spawn = state.spawns[0];
    if (!spawn) return;

    const sourceContainers = state.sourceContainers;
    const controllerContainers = state.controllerContainers;

    for (let i = 0; i < sourceContainers.length; i++) {
      if (this.isSiteCapReached(room)) return;

      const container = sourceContainers[i];
      this.placeRoadPath(room, container.pos, spawn.pos, 1);

      for (let j = 0; j < controllerContainers.length; j++) {
        if (this.isSiteCapReached(room)) return;
        this.placeRoadPath(room, container.pos, controllerContainers[j].pos, 0);
      }
    }
  },

  placeInternalRoads(room, state) {
    const spawn = state.spawns[0];
    const controller = room.controller;
    if (!spawn || !controller) return;

    const controllerContainers = state.controllerContainers || [];
    for (let i = 0; i < controllerContainers.length; i++) {
      if (this.isSiteCapReached(room)) return;
      this.placeRoadPath(room, spawn.pos, controllerContainers[i].pos, 1);
    }

    const extensions = room.find(FIND_MY_STRUCTURES, {
      filter: function (s) {
        return s.structureType === STRUCTURE_EXTENSION;
      },
    });

    for (let i = 0; i < extensions.length; i++) {
      if (this.isSiteCapReached(room)) return;
      this.placeRoadPath(room, spawn.pos, extensions[i].pos, 1);
    }
  },

  placeRoadPath(room, fromPos, toPos, range) {
    const path = fromPos.findPathTo(toPos, {
      ignoreCreeps: true,
      range: range,
    });

    for (let i = 0; i < path.length; i++) {
      if (this.isSiteCapReached(room)) return;

      const step = path[i];
      const pos = new RoomPosition(step.x, step.y, room.name);

      const structureHere = pos.lookFor(LOOK_STRUCTURES);
      const siteHere = pos.lookFor(LOOK_CONSTRUCTION_SITES);

      const blockedByStructure = _.some(structureHere, function (s) {
        return (
          s.structureType !== STRUCTURE_ROAD &&
          s.structureType !== STRUCTURE_CONTAINER
        );
      });

      const roadExists = _.some(structureHere, function (s) {
        return s.structureType === STRUCTURE_ROAD;
      });

      const roadSiteExists = _.some(siteHere, function (s) {
        return s.structureType === STRUCTURE_ROAD;
      });

      if (!blockedByStructure && !roadExists && !roadSiteExists) {
        pos.createConstructionSite(STRUCTURE_ROAD);
      }
    }
  },

  placeExtensions(room, state) {
    if (!room.controller) return;

    const status = constructionStatus.getStatus(room, state);
    const needed = status.extensionsNeeded - status.extensionsBuilt;
    if (needed <= 0) return;

    const candidates = this.getExtensionPositions(room, state);

    let placed = 0;
    for (let i = 0; i < candidates.length; i++) {
      if (this.isSiteCapReached(room)) return;
      if (placed >= needed) return;

      const result = candidates[i].createConstructionSite(STRUCTURE_EXTENSION);
      if (result === OK) {
        placed++;
      }
    }
  },

  getExtensionPositions(room, state) {
    const spawn = state.spawns[0];
    const controller = room.controller;
    if (!spawn || !controller) return [];

    const terrain = room.getTerrain();
    const candidates = [];

    for (let x = spawn.pos.x - 6; x <= spawn.pos.x + 6; x++) {
      for (let y = spawn.pos.y - 6; y <= spawn.pos.y + 6; y++) {
        if (x < 2 || x > 47 || y < 2 || y > 47) continue;

        const pos = new RoomPosition(x, y, room.name);
        const spawnRange = pos.getRangeTo(spawn.pos);
        const controllerRange = pos.getRangeTo(controller.pos);

        if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
        if (spawnRange < 2) continue;
        if (spawnRange > 5) continue;
        if (controllerRange > 8) continue;

        const structures = pos.lookFor(LOOK_STRUCTURES);
        const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

        const blocked = _.some(structures, function (s) {
          return s.structureType !== STRUCTURE_ROAD;
        });

        if (blocked || sites.length > 0) continue;

        candidates.push(pos);
      }
    }

    candidates.sort(function (a, b) {
      const aScore = a.getRangeTo(spawn.pos) + a.getRangeTo(controller.pos);
      const bScore = b.getRangeTo(spawn.pos) + b.getRangeTo(controller.pos);
      return aScore - bScore;
    });

    return candidates;
  },

  placeDefense(room, state) {
    const plan = this.getDefenseRing(room, state);
    if (!plan) return;

    for (let i = 0; i < plan.gates.length; i++) {
      if (this.isSiteCapReached(room)) return;
      this.tryPlaceDefensiveSite(plan.gates[i], STRUCTURE_RAMPART);
    }

    for (let i = 0; i < plan.walls.length; i++) {
      if (this.isSiteCapReached(room)) return;
      this.tryPlaceDefensiveSite(plan.walls[i], STRUCTURE_WALL);
    }
  },

  getDefenseRing(room, state) {
    const spawn = state.spawns[0];
    const controller = room.controller;
    if (!spawn || !controller) return null;

    const paddingX = config.DEFENSE.PADDING_X;
    const paddingY = config.DEFENSE.PADDING_Y;

    const minX = Math.max(
      2,
      Math.min(spawn.pos.x, controller.pos.x) - paddingX,
    );
    const maxX = Math.min(
      47,
      Math.max(spawn.pos.x, controller.pos.x) + paddingX,
    );
    const minY = Math.max(
      2,
      Math.min(spawn.pos.y, controller.pos.y) - paddingY,
    );
    const maxY = Math.min(
      47,
      Math.max(spawn.pos.y, controller.pos.y) + paddingY,
    );

    const terrain = room.getTerrain();
    const walls = [];
    const gates = [];

    const northGateX = Math.floor((minX + maxX) / 2);
    const southGateX = northGateX;
    const westGateY = Math.floor((minY + maxY) / 2);
    const eastGateY = westGateY;

    for (let x = minX; x <= maxX; x++) {
      const top = new RoomPosition(x, minY, room.name);
      const bottom = new RoomPosition(x, maxY, room.name);

      if (terrain.get(top.x, top.y) !== TERRAIN_MASK_WALL) {
        if (x === northGateX) gates.push(top);
        else walls.push(top);
      }

      if (terrain.get(bottom.x, bottom.y) !== TERRAIN_MASK_WALL) {
        if (x === southGateX) gates.push(bottom);
        else walls.push(bottom);
      }
    }

    for (let y = minY + 1; y <= maxY - 1; y++) {
      const left = new RoomPosition(minX, y, room.name);
      const right = new RoomPosition(maxX, y, room.name);

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

  tryPlaceDefensiveSite(pos, structureType) {
    const structures = pos.lookFor(LOOK_STRUCTURES);
    const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

    const hasSameStructure = _.some(structures, function (s) {
      return s.structureType === structureType;
    });

    const hasSameSite = _.some(sites, function (s) {
      return s.structureType === structureType;
    });

    const blocked = _.some(structures, function (s) {
      return (
        s.structureType !== STRUCTURE_ROAD &&
        s.structureType !== STRUCTURE_CONTAINER &&
        s.structureType !== structureType
      );
    });

    if (hasSameStructure || hasSameSite || blocked) return;

    pos.createConstructionSite(structureType);
  },

  placeTower(room, state) {
    const status = constructionStatus.getStatus(room, state);
    if (status.towersBuilt >= status.towersNeeded) return;

    const spawn = state.spawns[0];
    const controller = room.controller;
    if (!spawn || !controller) return;

    const terrain = room.getTerrain();
    const candidates = [];

    for (let x = spawn.pos.x - 3; x <= spawn.pos.x + 3; x++) {
      for (let y = spawn.pos.y - 3; y <= spawn.pos.y + 3; y++) {
        if (x < 2 || x > 47 || y < 2 || y > 47) continue;

        const pos = new RoomPosition(x, y, room.name);
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
        if (pos.getRangeTo(spawn) < 2) continue;
        if (pos.getRangeTo(controller) > 6) continue;

        const structures = pos.lookFor(LOOK_STRUCTURES);
        const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

        if (structures.length > 0 || sites.length > 0) continue;

        candidates.push(pos);
      }
    }

    candidates.sort(function (a, b) {
      const aScore = a.getRangeTo(spawn) + a.getRangeTo(controller);
      const bScore = b.getRangeTo(spawn) + b.getRangeTo(controller);
      return aScore - bScore;
    });

    if (candidates.length > 0) {
      candidates[0].createConstructionSite(STRUCTURE_TOWER);
    }
  },
};
