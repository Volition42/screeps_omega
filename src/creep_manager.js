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
const roleReserver = require("role_reserver");
const roleRemoteWorker = require("role_remoteworker");
const roleRemoteMiner = require("role_remoteminer");
const roleRemoteHauler = require("role_remotehauler");
const empireManager = require("empire_manager");
const reservationManager = require("reservation_manager");
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

      if (this.shouldSuspendOperationCreep(creep)) {
        continue;
      }

      if (this.runDefenseRetreat(creep, state)) {
        continue;
      }

      if (this.runReservationRetreat(creep)) {
        continue;
      }

      if (this.runExpansionRetreat(creep)) {
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

        case "reserver":
          runRole("reserver", roleReserver.run.bind(roleReserver), creep);
          break;

        case "remoteworker":
          runRole("remoteworker", roleRemoteWorker.run.bind(roleRemoteWorker), creep);
          break;

        case "remoteminer":
          runRole("remoteminer", roleRemoteMiner.run.bind(roleRemoteMiner), creep);
          break;

        case "remotehauler":
          runRole(
            "remotehauler",
            roleRemoteHauler.run.bind(roleRemoteHauler),
            creep,
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

    return Math.max(1, Math.ceil(configured * Math.max(1, multiplier || 1)));
  },

  getRoleCpuPriority(role) {
    switch (role) {
      case "defender":
        return 0;
      case "hauler":
      case "remotehauler":
        return 1;
      case "miner":
      case "remoteminer":
        return 2;
      case "worker":
      case "remoteworker":
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
      case "reserver":
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
    if (
      role === "defender" ||
      role === "claimer" ||
      role === "reserver" ||
      role === "pioneer"
    ) {
      return false;
    }

    if (!runtimeMode || runtimeMode.pressure === "normal") {
      return role !== "hauler" &&
        role !== "miner" &&
        role !== "remotehauler" &&
        role !== "remoteminer";
    }

    if (runtimeMode.pressure === "tight") {
      return role !== "hauler" &&
        role !== "miner" &&
        role !== "remotehauler" &&
        role !== "remoteminer";
    }

    return true;
  },

  runReservationRetreat(creep) {
    if (!creep || !creep.memory) return false;
    if (creep.memory.operation !== "reservation") return false;
    if (creep.memory.role === "defender" || creep.memory.role === "reserver") {
      return false;
    }

    const targetRoom = creep.memory.targetRoom;
    const homeRoom = creep.memory.homeRoom || creep.memory.room;
    if (!targetRoom || !homeRoom) return false;
    if (creep.room.name !== targetRoom) return false;
    if (!reservationManager.isRoomThreatened(targetRoom)) return false;

    this.moveToRoom(creep, homeRoom);
    return true;
  },

  runExpansionRetreat(creep) {
    if (!creep || !creep.memory) return false;
    if (creep.memory.operation !== "expansion") return false;
    if (creep.memory.role === "defender") return false;

    const targetRoom = creep.memory.targetRoom;
    const homeRoom = creep.memory.homeRoom || creep.memory.room;
    if (!targetRoom || !homeRoom) return false;
    if (creep.room.name !== targetRoom) return false;
    if (!empireManager.getExpansionThreat(targetRoom)) return false;

    this.moveToRoom(creep, homeRoom);
    return true;
  },

  shouldSuspendOperationCreep(creep) {
    if (!creep || !creep.memory || !creep.memory.operation) return false;

    const operation = creep.memory.operation;
    const targetRoom = creep.memory.targetRoom;

    if (!targetRoom) return false;

    if (operation === "expansion") {
      return !empireManager.getActiveExpansion(targetRoom);
    }

    if (
      operation === "expansion_defense" ||
      operation === "expansion_defense_support"
    ) {
      return !empireManager.getActiveExpansion(targetRoom);
    }

    if (
      operation === "reservation" ||
      operation === "reservation_defense" ||
      operation === "reservation_defense_support"
    ) {
      return !reservationManager.getActiveReservation(targetRoom);
    }

    return false;
  },

  runDefenseRetreat(creep, state) {
    if (creep.memory.role === "defender") {
      return false;
    }

    const homeRoomName = creep.memory.homeRoom || creep.memory.room || state.roomName;
    const homeThreat =
      state && state.defense
        ? defenseManager.getThreatByRoom(state.defense, homeRoomName) ||
          state.defense.homeThreat ||
          null
        : null;

    if ((!state || !state.defense || !state.defense.hasThreats) && !creep.memory.retreatRoom) {
      this.clearDefenseRetreatMemory(creep);
      return false;
    }

    const currentThreat = defenseManager.getThreatByRoom(
      state.defense,
      creep.room.name,
    );
    if (!currentThreat) {
      if (
        creep.memory.retreatRoom &&
        homeThreat &&
        homeThreat.active &&
        homeThreat.breachSeverity === "core_breach"
      ) {
        this.holdRetreatRoom(creep, homeRoomName);
        return true;
      }

      this.clearDefenseRetreatMemory(creep);
      return false;
    }

    this.retreatFromThreatRoom(creep, homeRoomName, currentThreat, homeThreat);
    return true;
  },

  retreatFromThreatRoom(creep, homeRoomName, threat, homeThreat) {
    const breachSeverity = threat.breachSeverity || "edge_pressure";

    if (
      creep.room.name !== homeRoomName &&
      creep.memory.retreatRoom &&
      homeThreat &&
      homeThreat.active &&
      homeThreat.breachSeverity === "core_breach"
    ) {
      this.holdRetreatRoom(creep, homeRoomName);
      return;
    }

    const hostiles = utils.getDefenseHostiles(creep.room, threat.hostiles);
    const closestHostile =
      hostiles.length > 0 ? creep.pos.findClosestByRange(hostiles) : null;

    if (breachSeverity === "edge_pressure") {
      if (closestHostile && creep.pos.getRangeTo(closestHostile) <= 6) {
        creep.memory.retreatMode = "edge_pressure";
        if (this.fleeFromHostiles(creep, hostiles)) {
          return;
        }
      } else {
        this.clearDefenseRetreatMemory(creep);
        return;
      }

      this.holdAtHome(creep, homeRoomName);
      return;
    }

    if (breachSeverity === "interior_pressure") {
      creep.memory.retreatMode = "safe_edge";
      this.moveToSafeEdge(creep, hostiles);
      return;
    }

    if (breachSeverity === "core_breach") {
      const retreatRoom = this.getSafestRetreatRoom(creep, hostiles);
      if (retreatRoom) {
        creep.memory.retreatMode = "evacuate";
        creep.memory.retreatRoom = retreatRoom;
        this.moveToRoom(creep, retreatRoom);
        return;
      }

      creep.memory.retreatMode = "safe_edge";
      delete creep.memory.retreatRoom;
      this.moveToSafeEdge(creep, hostiles);
      return;
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

  holdRetreatRoom(creep) {
    creep.memory.retreatMode = "evacuate";
    if (creep.pos.x !== 25 || creep.pos.y !== 25) {
      creep.moveTo(new RoomPosition(25, 25, creep.room.name), RETREAT_MOVE_OPTIONS);
    }
  },

  moveToSafeEdge(creep, hostiles) {
    const fallback = this.getSafestEdgePosition(creep.room, hostiles);
    if (!fallback) {
      this.holdAtHome(creep, creep.memory.homeRoom || creep.memory.room || creep.room.name);
      return;
    }

    creep.memory.retreatEdge = `${fallback.x}:${fallback.y}:${fallback.roomName}`;
    creep.moveTo(fallback, RETREAT_MOVE_OPTIONS);
  },

  getSafestEdgePosition(room, hostiles) {
    if (!room) return null;

    const candidates = [];
    for (let x = 2; x <= 47; x += 3) {
      candidates.push(new RoomPosition(x, 2, room.name));
      candidates.push(new RoomPosition(x, 47, room.name));
    }
    for (let y = 5; y <= 44; y += 3) {
      candidates.push(new RoomPosition(2, y, room.name));
      candidates.push(new RoomPosition(47, y, room.name));
    }

    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < candidates.length; i++) {
      const pos = candidates[i];
      if (room.getTerrain().get(pos.x, pos.y) === TERRAIN_MASK_WALL) continue;

      let closestRange = 50;
      for (let h = 0; h < hostiles.length; h++) {
        closestRange = Math.min(closestRange, pos.getRangeTo(hostiles[h]));
      }
      const score = closestRange * 100 - Math.abs(25 - pos.x) - Math.abs(25 - pos.y);
      if (score > bestScore) {
        best = pos;
        bestScore = score;
      }
    }

    return best;
  },

  getSafestRetreatRoom(creep, hostiles) {
    const parsed = this.parseRoomName(creep.room.name);
    if (!parsed) return null;

    const edgeChoices = [
      { roomName: this.composeRoomName(parsed.x, parsed.y - 1), positions: [new RoomPosition(25, 2, creep.room.name)] },
      { roomName: this.composeRoomName(parsed.x, parsed.y + 1), positions: [new RoomPosition(25, 47, creep.room.name)] },
      { roomName: this.composeRoomName(parsed.x - 1, parsed.y), positions: [new RoomPosition(2, 25, creep.room.name)] },
      { roomName: this.composeRoomName(parsed.x + 1, parsed.y), positions: [new RoomPosition(47, 25, creep.room.name)] },
    ];

    let best = null;
    let bestScore = -Infinity;
    for (let i = 0; i < edgeChoices.length; i++) {
      const choice = edgeChoices[i];
      let score = 0;
      for (let p = 0; p < choice.positions.length; p++) {
        let minRange = 50;
        for (let h = 0; h < hostiles.length; h++) {
          minRange = Math.min(minRange, choice.positions[p].getRangeTo(hostiles[h]));
        }
        score += minRange;
      }

      if (score > bestScore) {
        best = choice.roomName;
        bestScore = score;
      }
    }

    return best;
  },

  parseRoomName(roomName) {
    return defenseManager.parseRoomName(roomName);
  },

  composeRoomName(x, y) {
    const horizontal = x < 0 ? `W${Math.abs(x + 1)}` : `E${x}`;
    const vertical = y < 0 ? `N${Math.abs(y + 1)}` : `S${y}`;
    return horizontal + vertical;
  },

  clearDefenseRetreatMemory(creep) {
    delete creep.memory.retreatMode;
    delete creep.memory.retreatRoom;
    delete creep.memory.retreatEdge;
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
