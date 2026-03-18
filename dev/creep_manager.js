/*
Developer Summary:
Creep role dispatcher.

Purpose:
- Route creeps to the correct role logic
- Keep role execution simple and explicit
- Allow home-room-owned remote creeps to run through the same manager

Important Notes:
- Remote creeps still use memory.room as their home room
- That allows the home room manager to continue owning their logic
- Non-defense creeps now yield to the room defense state and retreat before
  their normal role logic runs
*/

const config = require("config");
const defenseManager = require("defense_manager");
const roleJrWorker = require("role_jrworker");
const roleRemoteJrWorker = require("role_remote_jrworker");
const roleRemoteWorker = require("role_remote_worker");
const roleRemoteMiner = require("role_remote_miner");
const roleRemoteHauler = require("role_remote_hauler");
const roleReserver = require("role_reserver");
const roleWorker = require("role_worker");
const roleMiner = require("role_miner");
const roleHauler = require("role_hauler");
const roleUpgrader = require("role_upgrader");
const roleRepair = require("role_repair");
const roleDefender = require("role_defender");
const roleRangedDefender = require("role_ranged_defender");
const utils = require("utils");

const RETREAT_MOVE_OPTIONS = {
  reusePath: 8,
};

module.exports = {
  run(room, state, profiler, roomLabelPrefix, runtimeMode) {
    const creeps = state && state.homeCreeps ? state.homeCreeps : [];
    const roleLabelPrefix =
      profiler && roomLabelPrefix ? `${roomLabelPrefix}.creeps.role.` : null;
    const thinkMultiplier =
      runtimeMode && runtimeMode.thinkIntervalMultiplier
        ? runtimeMode.thinkIntervalMultiplier
        : 1;

    for (let i = 0; i < creeps.length; i++) {
      const creep = creeps[i];

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

        case "remotejrworker":
          runRole(
            "remotejrworker",
            roleRemoteJrWorker.run.bind(roleRemoteJrWorker),
            creep,
            roleOptions,
          );
          break;

        case "remoteworker":
          runRole(
            "remoteworker",
            roleRemoteWorker.run.bind(roleRemoteWorker),
            creep,
            roleOptions,
          );
          break;

        case "remoteminer":
          runRole(
            "remoteminer",
            roleRemoteMiner.run.bind(roleRemoteMiner),
            creep,
          );
          break;

        case "remotehauler":
          runRole(
            "remotehauler",
            roleRemoteHauler.run.bind(roleRemoteHauler),
            creep,
            roleOptions,
          );
          break;

        case "reserver":
          runRole("reserver", roleReserver.run.bind(roleReserver), creep);
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

        case "rangeddefender":
          runRole(
            "rangeddefender",
            roleRangedDefender.run.bind(roleRangedDefender),
            creep,
            state,
          );
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

    return Math.max(1, configured * Math.max(1, multiplier || 1));
  },

  runDefenseRetreat(creep, state) {
    if (!state || !state.defense || !state.defense.hasThreats) return false;
    if (
      creep.memory.role === "defender" ||
      creep.memory.role === "rangeddefender"
    ) {
      return false;
    }

    const homeRoomName = creep.memory.homeRoom || creep.memory.room || state.roomName;
    const currentThreat = defenseManager.getThreatByRoom(
      state.defense,
      creep.room.name,
    );
    const assignedThreat = creep.memory.targetRoom
      ? defenseManager.getThreatByRoom(state.defense, creep.memory.targetRoom)
      : null;

    if (!currentThreat && !assignedThreat) return false;

    if (currentThreat) {
      this.retreatFromThreatRoom(creep, homeRoomName, currentThreat);
      return true;
    }

    this.holdAtHome(creep, homeRoomName);
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
