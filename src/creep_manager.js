/*
Developer Summary:
Creep role dispatcher.

Purpose:
- Route creeps to the correct role logic
- Keep role execution simple and explicit

Important Notes:
- Non-defense creeps now yield to the room defense state and retreat before
  their normal role logic runs
*/

const config = require("config");
const defenseManager = require("defense_manager");
const roleJrWorker = require("role_jrworker");
const roleWorker = require("role_worker");
const roleMiner = require("role_miner");
const roleHauler = require("role_hauler");
const roleUpgrader = require("role_upgrader");
const roleRepair = require("role_repair");
const roleDefender = require("role_defender");
const roleClaimer = require("role_claimer");
const rolePioneer = require("role_pioneer");
const statsManager = require("stats_manager");
const utils = require("utils");

const RETREAT_MOVE_OPTIONS = {
  reusePath: 8,
};

module.exports = {
  run(room, state, profiler, roomLabelPrefix, runtimeMode) {
    const creeps = state && state.homeCreeps ? state.homeCreeps.slice() : [];
    const roleLabelPrefix =
      profiler && roomLabelPrefix ? `${roomLabelPrefix}.creeps.role.` : null;
    const thinkMultiplier =
      runtimeMode && runtimeMode.thinkIntervalMultiplier
        ? runtimeMode.thinkIntervalMultiplier
        : 1;

    creeps.sort(function (a, b) {
      return module.exports.getRoleCpuPriority(a.memory.role) -
        module.exports.getRoleCpuPriority(b.memory.role);
    });

    for (let i = 0; i < creeps.length; i++) {
      const creep = creeps[i];

      if (this.shouldSkipForCpuBudget(creep, runtimeMode)) {
        continue;
      }

      if (this.runDefenseRetreat(creep, state)) {
        continue;
      }

      const runRole = (roleName, fn, ...args) => {
        if (profiler && roleLabelPrefix) {
          return profiler.wrap(
            roleLabelPrefix + roleName,
            fn,
            null,
            ...args,
          );
        }

        return fn.apply(null, args);
      };
      const thinkInterval = this.getRoleThinkInterval(
        creep.memory.role,
        thinkMultiplier,
      );
      const roleOptions = {
        thinkInterval: thinkInterval,
      };

      switch (creep.memory.role) {
        case "jrworker":
          runRole("jrworker", roleJrWorker.run.bind(roleJrWorker), creep);
          break;

        case "worker":
          runRole(
            "worker",
            roleWorker.run.bind(roleWorker),
            creep,
            roleOptions,
          );
          break;

        case "miner":
          runRole("miner", roleMiner.run.bind(roleMiner), creep);
          break;

        case "mineral_miner":
          runRole("mineral_miner", roleMiner.runMineral.bind(roleMiner), creep);
          break;

        case "hauler":
          runRole(
            "hauler",
            roleHauler.run.bind(roleHauler),
            creep,
            roleOptions,
          );
          break;

        case "upgrader":
          runRole(
            "upgrader",
            roleUpgrader.run.bind(roleUpgrader),
            creep,
            roleOptions,
          );
          break;

        case "repair":
          runRole(
            "repair",
            roleRepair.run.bind(roleRepair),
            creep,
          );
          break;

        case "defender":
          runRole(
            "defender",
            roleDefender.run.bind(roleDefender),
            creep,
            state,
          );
          break;

        case "claimer":
          runRole("claimer", roleClaimer.run.bind(roleClaimer), creep);
          break;

        case "pioneer":
          runRole("pioneer", rolePioneer.run.bind(rolePioneer), creep);
          break;
      }
    }
  },

  getRoleThinkInterval(role, multiplier) {
    const configured =
      config.CREEPS &&
      config.CREEPS.THINK_INTERVALS &&
      Object.prototype.hasOwnProperty.call(config.CREEPS.THINK_INTERVALS, role)
        ? config.CREEPS.THINK_INTERVALS[role]
        : 1;

    return Math.max(1, Math.ceil(configured * Math.max(1, multiplier || 1)));
  },

  getRoleCpuPriority(role) {
    switch (role) {
      case "defender":
        return 0;
      case "hauler":
        return 1;
      case "miner":
        return 2;
      case "worker":
        return 3;
      case "jrworker":
        return 4;
      case "upgrader":
        return 5;
      case "repair":
        return 6;
      case "mineral_miner":
        return 7;
      case "claimer":
        return 8;
      case "pioneer":
        return 9;
      default:
        return 10;
    }
  },

  shouldSkipForCpuBudget(creep, runtimeMode) {
    if (!creep || !creep.memory) return false;
    if (!statsManager.isPastSoftCpuLimit(0)) return false;

    const role = creep.memory.role;
    if (role === "defender" || role === "claimer" || role === "pioneer") {
      return false;
    }

    if (!runtimeMode || runtimeMode.pressure === "normal") {
      return role !== "hauler" && role !== "miner";
    }

    if (runtimeMode.pressure === "tight") {
      return role !== "hauler" && role !== "miner";
    }

    return true;
  },

  runDefenseRetreat(creep, state) {
    if (!state || !state.defense || !state.defense.hasThreats) return false;
    if (creep.memory.role === "defender") {
      return false;
    }

    const homeRoomName = creep.memory.homeRoom || creep.memory.room || state.roomName;
    const currentThreat = defenseManager.getThreatByRoom(
      state.defense,
      creep.room.name,
    );
    if (!currentThreat) return false;

    this.retreatFromThreatRoom(creep, homeRoomName, currentThreat);
    return true;
  },

  retreatFromThreatRoom(creep, homeRoomName, threat) {
    if (creep.room.name !== homeRoomName) {
      this.moveToRoom(creep, homeRoomName);
      return;
    }

    const hostiles = utils.getDefenseHostiles(creep.room, threat.hostiles);
    const closestHostile =
      hostiles.length > 0 ? creep.pos.findClosestByRange(hostiles) : null;

    if (closestHostile && creep.pos.getRangeTo(closestHostile) <= 6) {
      if (this.fleeFromHostiles(creep, hostiles)) {
        return;
      }
    }

    this.holdAtHome(creep, homeRoomName);
  },

  holdAtHome(creep, homeRoomName) {
    if (creep.room.name !== homeRoomName) {
      this.moveToRoom(creep, homeRoomName);
      return;
    }

    const anchor = this.getSafeAnchor(creep.room);

    if (anchor && creep.pos.getRangeTo(anchor) > 4) {
      creep.moveTo(anchor, RETREAT_MOVE_OPTIONS);
    }
  },

  getSafeAnchor(room) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (spawn) return spawn;
    if (room.storage) return room.storage;
    if (room.controller) return room.controller;

    return new RoomPosition(25, 25, room.name);
  },

  fleeFromHostiles(creep, hostiles) {
    if (!hostiles || hostiles.length === 0) return false;

    const goals = _.map(hostiles, function (hostile) {
      return {
        pos: hostile.pos,
        range: hostile.getActiveBodyparts(ATTACK) > 0 ||
          hostile.getActiveBodyparts(RANGED_ATTACK) > 0 ||
          hostile.getActiveBodyparts(CLAIM) > 0
          ? 6
          : 4,
      };
    });

    const result = PathFinder.search(creep.pos, goals, {
      flee: true,
      maxRooms: 1,
    });

    if (!result.path || result.path.length === 0) return false;

    creep.moveTo(result.path[0], RETREAT_MOVE_OPTIONS);
    return true;
  },

  moveToRoom(creep, roomName) {
    creep.moveTo(new RoomPosition(25, 25, roomName), {
      reusePath: 30,
      range: 20,
      visualizePathStyle: { stroke: "#ffb703" },
    });
  },
};
