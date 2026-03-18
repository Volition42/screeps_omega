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
  run(room, state) {
    const creeps = state && state.homeCreeps ? state.homeCreeps : [];

    for (let i = 0; i < creeps.length; i++) {
      const creep = creeps[i];

      if (this.runDefenseRetreat(creep, state)) {
        continue;
      }

      switch (creep.memory.role) {
        case "jrworker":
          roleJrWorker.run(creep);
          break;

        case "remotejrworker":
          roleRemoteJrWorker.run(creep);
          break;

        case "remoteworker":
          roleRemoteWorker.run(creep);
          break;

        case "remoteminer":
          roleRemoteMiner.run(creep);
          break;

        case "remotehauler":
          roleRemoteHauler.run(creep);
          break;

        case "reserver":
          roleReserver.run(creep);
          break;

        case "worker":
          roleWorker.run(creep);
          break;

        case "miner":
          roleMiner.run(creep);
          break;

        case "hauler":
          roleHauler.run(creep);
          break;

        case "upgrader":
          roleUpgrader.run(creep);
          break;

        case "repair":
          roleRepair.run(creep);
          break;

        case "defender":
          roleDefender.run(creep, state);
          break;

        case "rangeddefender":
          roleRangedDefender.run(creep, state);
          break;
      }
    }
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
