/*
Developer Summary:
Spawn Manager

Purpose:
- Maintain the room workforce by phase
- Support normal role-based spawning
- Recover automatically from colony collapse

Recovery behavior:
- If the room has no useful worker economy, spawn JrWorkers first
- JrWorkers are the emergency bootstrap role
- Once energy flow returns, normal spawning resumes

Important Notes:
- Recovery mode is intentionally simple and aggressive
- It is better to recover with small creeps than stall waiting for ideal bodies
- This keeps the colony self-healing after attacks or wipes
*/

const bodies = require("bodies");
const utils = require("utils");
const config = require("config");

module.exports = {
  run(room, state) {
    var spawn = state.spawns[0];
    if (!spawn) return;

    var requests = this.getSpawnRequests(room, state);

    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};

    Memory.rooms[room.name].spawnQueue = _.map(requests, function (request) {
      return {
        role: request.role,
        priority: request.priority,
        sourceId: request.sourceId || null,
        targetId: request.targetId || null,
      };
    });

    if (spawn.spawning || requests.length === 0) return;

    var request = requests[0];
    var body = bodies.get(request.role, room);
    var name = request.role + "_" + Game.time;

    var result = spawn.spawnCreep(body, name, {
      memory: {
        role: request.role,
        room: room.name,
        working: false,
        delivering: false,
        sourceId: request.sourceId || null,
        targetId: request.targetId || null,
      },
    });

    if (
      result !== OK &&
      result !== ERR_NOT_ENOUGH_ENERGY &&
      Game.time % 25 === 0
    ) {
      console.log(
        "[SPAWN " +
          spawn.name +
          "] failed role=" +
          request.role +
          " result=" +
          result,
      );
    }
  },

  getSpawnRequests(room, state) {
    var requests = [];
    var roleCounts = state.roleCounts || {};

    // =========================================================
    // HARD RECOVERY MODE
    // =========================================================
    // Developer note:
    // If the colony loses its working economy, force JrWorkers until
    // energy flow comes back. This prevents deadlock after wipes.
    if (this.needsRecovery(state)) {
      var recoveryTarget = this.getRecoveryJrWorkerTarget(room, state);
      var currentJrWorkers = roleCounts.jrworker || 0;
      var queuedJrWorkers = this.countQueued(room, "jrworker");

      while (
        currentJrWorkers +
          queuedJrWorkers +
          requests.filter(function (r) {
            return r.role === "jrworker";
          }).length <
        recoveryTarget
      ) {
        requests.push({ role: "jrworker", priority: 1000 });
      }

      requests.sort(function (a, b) {
        return b.priority - a.priority;
      });

      return requests;
    }

    // =========================================================
    // PRE INFRASTRUCTURE BOOTSTRAP
    // =========================================================
    if (state.phase === "bootstrap_jr") {
      var desiredJrWorkers = config.CREEPS.jrWorkers;
      var currentBootJrWorkers = roleCounts.jrworker || 0;
      var queuedBootJrWorkers = this.countQueued(room, "jrworker");

      while (
        currentBootJrWorkers +
          queuedBootJrWorkers +
          requests.filter(function (r) {
            return r.role === "jrworker";
          }).length <
        desiredJrWorkers
      ) {
        requests.push({ role: "jrworker", priority: 100 });
      }

      requests.sort(function (a, b) {
        return b.priority - a.priority;
      });

      return requests;
    }

    // =========================================================
    // NORMAL WORKER
    // =========================================================
    var desiredWorkers = config.CREEPS.workers;
    var currentWorkers = roleCounts.worker || 0;
    var queuedWorkers = this.countQueued(room, "worker");

    while (
      currentWorkers +
        queuedWorkers +
        requests.filter(function (r) {
          return r.role === "worker";
        }).length <
      desiredWorkers
    ) {
      requests.push({ role: "worker", priority: 100 });
    }

    // =========================================================
    // MINERS
    // =========================================================
    var minersPerSource = config.CREEPS.minersPerSource;

    for (var i = 0; i < state.sources.length; i++) {
      var source = state.sources[i];
      var sourceContainer = utils.getSourceContainerBySource(room, source.id);
      if (!sourceContainer) continue;

      var existingMiners = _.filter(Game.creeps, function (creep) {
        return (
          creep.memory.role === "miner" &&
          creep.memory.room === room.name &&
          creep.memory.sourceId === source.id
        );
      }).length;

      var queuedMiners = this.countQueuedForSource(room, "miner", source.id);
      var desiredMinersForSource = minersPerSource;

      for (
        var minerIndex = existingMiners + queuedMiners;
        minerIndex < desiredMinersForSource;
        minerIndex++
      ) {
        requests.push({
          role: "miner",
          priority: 90,
          sourceId: source.id,
        });
      }
    }

    // =========================================================
    // HAULERS
    // =========================================================
    for (var j = 0; j < state.sources.length; j++) {
      var haulSource = state.sources[j];
      var haulContainer = utils.getSourceContainerBySource(room, haulSource.id);
      if (!haulContainer) continue;

      var desiredHaulersForSource = this.getDesiredHaulersForSource(
        haulSource.id,
      );

      var existingHaulers = _.filter(Game.creeps, function (creep) {
        return (
          creep.memory.role === "hauler" &&
          creep.memory.room === room.name &&
          creep.memory.sourceId === haulSource.id
        );
      }).length;

      var queuedHaulers = this.countQueuedForSource(
        room,
        "hauler",
        haulSource.id,
      );

      for (
        var haulerIndex = existingHaulers + queuedHaulers;
        haulerIndex < desiredHaulersForSource;
        haulerIndex++
      ) {
        requests.push({
          role: "hauler",
          priority: 80,
          sourceId: haulSource.id,
        });
      }
    }

    // =========================================================
    // UPGRADERS
    // =========================================================
    var desiredUpgraders = config.CREEPS.upgraders;

    if (state.controllerContainers.length > 0) {
      var controllerContainer = state.controllerContainers[0];

      var existingUpgraders = _.filter(Game.creeps, function (creep) {
        return (
          creep.memory.role === "upgrader" &&
          creep.memory.room === room.name &&
          creep.memory.targetId === controllerContainer.id
        );
      }).length;

      var queuedUpgraders = this.countQueuedForTarget(
        room,
        "upgrader",
        controllerContainer.id,
      );

      for (
        var upgraderIndex = existingUpgraders + queuedUpgraders;
        upgraderIndex < desiredUpgraders;
        upgraderIndex++
      ) {
        requests.push({
          role: "upgrader",
          priority: 70,
          targetId: controllerContainer.id,
        });
      }
    }

    // =========================================================
    // REPAIRS
    // =========================================================
    var desiredRepairs = config.CREEPS.repairs;
    var currentRepairs = roleCounts.repair || 0;
    var queuedRepairs = this.countQueued(room, "repair");

    while (
      currentRepairs +
        queuedRepairs +
        requests.filter(function (r) {
          return r.role === "repair";
        }).length <
      desiredRepairs
    ) {
      requests.push({ role: "repair", priority: 60 });
    }

    requests.sort(function (a, b) {
      return b.priority - a.priority;
    });

    return requests;
  },

  needsRecovery(state) {
    var roleCounts = state.roleCounts || {};

    var jrWorkers = roleCounts.jrworker || 0;
    var workers = roleCounts.worker || 0;
    var miners = roleCounts.miner || 0;
    var haulers = roleCounts.hauler || 0;

    var totalEconomyCreeps = jrWorkers + workers + miners + haulers;

    // Developer note:
    // Trigger recovery if we have effectively lost the room economy.
    if (totalEconomyCreeps === 0) return true;

    // If the room has almost no available energy and no bootstrap-capable workers,
    // allow JrWorkers to kickstart things again.
    if (
      state.energyAvailable < 300 &&
      jrWorkers === 0 &&
      workers === 0 &&
      miners === 0
    ) {
      return true;
    }

    return false;
  },

  getRecoveryJrWorkerTarget(room, state) {
    // Developer note:
    // Keep recovery target small and cheap.
    // Two JrWorkers is usually enough to restart harvesting and refilling.
    if (state.energyCapacityAvailable >= 550) {
      return 2;
    }

    return 1;
  },

  getDesiredHaulersForSource(sourceId) {
    var overrides = config.CREEPS.haulersPerSourceBySourceId || {};

    if (Object.prototype.hasOwnProperty.call(overrides, sourceId)) {
      return overrides[sourceId];
    }

    return config.CREEPS.haulersPerSourceDefault;
  },

  countQueued(room, role) {
    var queue =
      Memory.rooms &&
      Memory.rooms[room.name] &&
      Memory.rooms[room.name].spawnQueue
        ? Memory.rooms[room.name].spawnQueue
        : [];

    return _.filter(queue, function (item) {
      return item.role === role;
    }).length;
  },

  countQueuedForSource(room, role, sourceId) {
    var queue =
      Memory.rooms &&
      Memory.rooms[room.name] &&
      Memory.rooms[room.name].spawnQueue
        ? Memory.rooms[room.name].spawnQueue
        : [];

    return _.filter(queue, function (item) {
      return item.role === role && item.sourceId === sourceId;
    }).length;
  },

  countQueuedForTarget(room, role, targetId) {
    var queue =
      Memory.rooms &&
      Memory.rooms[room.name] &&
      Memory.rooms[room.name].spawnQueue
        ? Memory.rooms[room.name].spawnQueue
        : [];

    return _.filter(queue, function (item) {
      return item.role === role && item.targetId === targetId;
    }).length;
  },
};
