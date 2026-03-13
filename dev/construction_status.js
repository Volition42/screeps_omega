const config = require("config");

module.exports = {
  /*
  Developer Note:
  Shared construction roadmap / checklist calculator.

  Purpose:
  - Keep phase handling, HUD, directives, and construction planning in sync
  - Provide one source of truth for "what should exist right now"

  Current roadmap intent:
  - bootstrap_jr:
      no formal construction requirements
  - bootstrap:
      source containers, controller container, backbone roads
  - developing:
      current-RCL extensions, defense baseline, tower at RCL3
  - stable:
      same roadmap, but room should be mostly caught up
  */

  getStatus(room, state) {
    if (!room.controller) {
      return this.getEmptyStatus();
    }

    const sourceContainersBuilt = state.sourceContainers
      ? state.sourceContainers.length
      : 0;
    const sourceContainersNeeded = state.sources ? state.sources.length : 0;

    const controllerContainersBuilt = this.countControllerContainers(room);
    const controllerContainersNeeded = 1;

    const extensionsAllowed =
      CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][room.controller.level] || 0;
    const extensionsBuilt = this.countBuiltAndSites(room, STRUCTURE_EXTENSION);

    const towersAllowed =
      CONTROLLER_STRUCTURES[STRUCTURE_TOWER][room.controller.level] || 0;
    const towersBuilt = this.countBuiltAndSites(room, STRUCTURE_TOWER);

    const roadsBuilt = this.countBuiltAndSites(room, STRUCTURE_ROAD);
    const roadGoal = this.getRoadGoal(room, state);

    const defenseGoal = this.getDefenseGoal(room, state);
    const wallsBuilt = this.countBuiltAndSites(room, STRUCTURE_WALL);
    const rampartsBuilt = this.countBuiltAndSites(room, STRUCTURE_RAMPART);

    const sites = room.find(FIND_CONSTRUCTION_SITES).length;

    const status = {
      phase: state.phase,
      sites: sites,

      sourceContainersBuilt: sourceContainersBuilt,
      sourceContainersNeeded: sourceContainersNeeded,

      controllerContainersBuilt: controllerContainersBuilt,
      controllerContainersNeeded: controllerContainersNeeded,

      extensionsBuilt: extensionsBuilt,
      extensionsNeeded: extensionsAllowed,

      towersBuilt: towersBuilt,
      towersNeeded: towersAllowed,

      roadsBuilt: roadsBuilt,
      roadsNeeded: roadGoal,

      wallsBuilt: wallsBuilt,
      wallsNeeded: defenseGoal.walls,

      rampartsBuilt: rampartsBuilt,
      rampartsNeeded: defenseGoal.ramparts,
    };

    status.bootstrapComplete =
      status.sourceContainersBuilt >= status.sourceContainersNeeded &&
      status.controllerContainersBuilt >= status.controllerContainersNeeded &&
      status.roadsBuilt >= status.roadsNeeded;

    status.developingComplete =
      status.extensionsBuilt >= status.extensionsNeeded &&
      status.towersBuilt >= status.towersNeeded &&
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

      roadsBuilt: 0,
      roadsNeeded: 0,

      wallsBuilt: 0,
      wallsNeeded: 0,

      rampartsBuilt: 0,
      rampartsNeeded: 0,

      bootstrapComplete: false,
      developingComplete: false,
      stableReady: false,
    };
  },

  countControllerContainers(room) {
    return (
      room.find(FIND_STRUCTURES, {
        filter: function (s) {
          return (
            s.structureType === STRUCTURE_CONTAINER &&
            room.controller &&
            s.pos.getRangeTo(room.controller) <= 4
          );
        },
      }).length +
      room.find(FIND_CONSTRUCTION_SITES, {
        filter: function (s) {
          return (
            s.structureType === STRUCTURE_CONTAINER &&
            room.controller &&
            s.pos.getRangeTo(room.controller) <= 4
          );
        },
      }).length
    );
  },

  countBuiltAndSites(room, structureType) {
    const built = room.find(FIND_STRUCTURES, {
      filter: function (s) {
        return s.structureType === structureType;
      },
    }).length;

    const sites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: function (s) {
        return s.structureType === structureType;
      },
    }).length;

    return built + sites;
  },

  getRoadGoal(room, state) {
    const spawn = state.spawns && state.spawns[0];
    if (!spawn) return 0;

    let estimate = 0;

    const sourceContainers = state.sourceContainers || [];
    const controllerContainers = state.controllerContainers || [];

    for (let i = 0; i < sourceContainers.length; i++) {
      const sourceContainer = sourceContainers[i];
      estimate += Math.max(1, sourceContainer.pos.getRangeTo(spawn.pos));

      for (let j = 0; j < controllerContainers.length; j++) {
        const controllerContainer = controllerContainers[j];
        estimate += Math.max(
          1,
          sourceContainer.pos.getRangeTo(controllerContainer.pos),
        );
      }
    }

    const extensions = room.find(FIND_STRUCTURES, {
      filter: function (s) {
        return s.structureType === STRUCTURE_EXTENSION;
      },
    });

    for (let i = 0; i < extensions.length; i++) {
      estimate += Math.max(1, extensions[i].pos.getRangeTo(spawn.pos));
    }

    return estimate;
  },

  getDefenseGoal(room, state) {
    const spawn = state.spawns && state.spawns[0];
    const controller = room.controller;

    if (!spawn || !controller || !config.DEFENSE.ENABLED) {
      return { walls: 0, ramparts: 0 };
    }

    if (controller.level < config.DEFENSE.MIN_CONTROLLER_LEVEL) {
      return { walls: 0, ramparts: 0 };
    }

    const paddingX = config.DEFENSE.PADDING_X || 5;
    const paddingY = config.DEFENSE.PADDING_Y || 5;

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

    let walls = 0;
    let ramparts = 0;

    const northGateX = Math.floor((minX + maxX) / 2);
    const southGateX = northGateX;
    const westGateY = Math.floor((minY + maxY) / 2);
    const eastGateY = westGateY;

    for (let x = minX; x <= maxX; x++) {
      if (terrain.get(x, minY) !== TERRAIN_MASK_WALL) {
        if (x === northGateX) ramparts++;
        else walls++;
      }

      if (terrain.get(x, maxY) !== TERRAIN_MASK_WALL) {
        if (x === southGateX) ramparts++;
        else walls++;
      }
    }

    for (let y = minY + 1; y <= maxY - 1; y++) {
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
};
