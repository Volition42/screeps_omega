const config = require("config");
const utils = require("utils");

module.exports = {
  plan(room, state) {
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].construction) {
      Memory.rooms[room.name].construction = {};
    }

    const mem = Memory.rooms[room.name].construction;
    if (!mem.lastPlan) mem.lastPlan = 0;

    if (Game.time - mem.lastPlan < config.CONSTRUCTION.PLAN_INTERVAL) return;
    mem.lastPlan = Game.time;

    if (
      room.find(FIND_CONSTRUCTION_SITES).length >= config.CONSTRUCTION.MAX_SITES
    ) {
      return;
    }

    this.placeSourceContainers(room, state);
    this.placeControllerContainers(room, state);

    if (this.isReadyForRoads(room, state)) {
      this.placeRoads(room, state);
    }

    if (this.isReadyForDefense(room, state)) {
      this.placeDefense(room, state);
    }

    if (this.isReadyForTower(room, state)) {
      this.placeTower(room, state);
    }
  },

  isReadyForRoads(room, state) {
    const allSourceContainersBuilt =
      state.sourceContainers.length >= state.sources.length;

    const controllerContainerBuilt = state.controllerContainers.length >= 1;

    return allSourceContainersBuilt && controllerContainerBuilt;
  },

  isReadyForDefense(room, state) {
    if (!config.DEFENSE.ENABLED) return false;
    if (!room.controller) return false;
    if (room.controller.level < config.DEFENSE.MIN_CONTROLLER_LEVEL)
      return false;

    return this.isReadyForRoads(room, state);
  },

  isReadyForTower(room, state) {
    if (!room.controller) return false;
    if (room.controller.level < 3) return false;

    return this.isReadyForDefense(room, state);
  },

  placeSourceContainers(room, state) {
    for (const source of state.sources) {
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

  placeControllerContainers(room, state) {
    if (!room.controller) return;

    const desiredControllerContainers = 1;

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

    const needed = desiredControllerContainers - existing - existingSites;
    if (needed <= 0) return;

    const nearbyControllerContainer = room.find(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          s.pos.getRangeTo(room.controller) <= 4
        );
      },
    })[0];

    const nearbyControllerContainerSite = room.find(FIND_CONSTRUCTION_SITES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          s.pos.getRangeTo(room.controller) <= 4
        );
      },
    })[0];

    if (nearbyControllerContainer || nearbyControllerContainerSite) return;

    const positions = utils.getControllerContainerPositions(
      room,
      desiredControllerContainers,
    );

    let placed = 0;

    for (const pos of positions) {
      const result = pos.createConstructionSite(STRUCTURE_CONTAINER);
      if (result === OK) {
        placed++;
      }

      if (placed >= needed) break;
    }
  },

  placeRoads(room, state) {
    const spawn = state.spawns[0];
    if (!spawn) return;

    const sourceContainers = state.sourceContainers;
    const controllerContainers = state.controllerContainers;

    for (const container of sourceContainers) {
      this.placeRoadPath(room, container.pos, spawn.pos, 1);

      for (const controllerContainer of controllerContainers) {
        this.placeRoadPath(room, container.pos, controllerContainer.pos, 0);
      }
    }
  },

  placeRoadPath(room, fromPos, toPos, range) {
    const path = fromPos.findPathTo(toPos, {
      ignoreCreeps: true,
      range: range,
    });

    for (const step of path) {
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

  placeDefense(room, state) {
    const plan = this.getDefenseRing(room, state);
    if (!plan) return;

    for (const gate of plan.gates) {
      this.tryPlaceDefensiveSite(gate, STRUCTURE_RAMPART);
    }

    for (const wall of plan.walls) {
      this.tryPlaceDefensiveSite(wall, STRUCTURE_WALL);
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

    return { walls, gates };
  },

  placeTower(room, state) {
    const existingTowers = room.find(FIND_MY_STRUCTURES, {
      filter: function (s) {
        return s.structureType === STRUCTURE_TOWER;
      },
    }).length;

    const existingTowerSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: function (s) {
        return s.structureType === STRUCTURE_TOWER;
      },
    }).length;

    const desiredTowers = config.DEFENSE.towerCountAtRCL3;

    if (existingTowers + existingTowerSites >= desiredTowers) return;

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
};
