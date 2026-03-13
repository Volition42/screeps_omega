const bodies = require("bodies");
const utils = require("utils");
const config = require("config");

module.exports = {
  run(room, state) {
    const spawn = state.spawns[0];
    if (!spawn) return;

    const requests = this.getSpawnRequests(room, state);

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

    const request = requests[0];

    // Developer note:
    // Body generation now scales by room.energyCapacityAvailable.
    // We still let Screeps naturally wait until enough current energy exists.
    const body = bodies.get(request.role, room);
    const name = `${request.role}_${Game.time}`;

    const result = spawn.spawnCreep(body, name, {
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
        `[SPAWN ${spawn.name}] failed role=${request.role} result=${result}`,
      );
    }
  },

  getSpawnRequests(room, state) {
    const requests = [];
    const roleCounts = state.roleCounts;

    // =========================
    // PRE-INFRASTRUCTURE BOOTSTRAP
    // =========================
    if (state.phase === "bootstrap_jr") {
      const desiredJrWorkers = config.CREEPS.jrWorkers;
      const currentJrWorkers = roleCounts.jrworker || 0;
      const queuedJrWorkers = this.countQueued(room, "jrworker");

      while (
        currentJrWorkers +
          queuedJrWorkers +
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

    // =========================
    // NORMAL INFRASTRUCTURE LOGIC
    // =========================

    // WORKERS
    const desiredWorkers = config.CREEPS.workers;
    const currentWorkers = roleCounts.worker || 0;
    const queuedWorkers = this.countQueued(room, "worker");

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

    // MINERS
    const minersPerSource = config.CREEPS.minersPerSource;

    for (const source of state.sources) {
      const sourceContainer = utils.getSourceContainerBySource(room, source.id);
      if (!sourceContainer) continue;

      const existingMiners = _.filter(Game.creeps, function (creep) {
        return (
          creep.memory.role === "miner" &&
          creep.memory.room === room.name &&
          creep.memory.sourceId === source.id
        );
      }).length;

      const queuedMiners = this.countQueuedForSource(room, "miner", source.id);
      const desiredMinersForSource = minersPerSource;

      for (
        let i = existingMiners + queuedMiners;
        i < desiredMinersForSource;
        i++
      ) {
        requests.push({
          role: "miner",
          priority: 90,
          sourceId: source.id,
        });
      }
    }

    // HAULERS
    for (const source of state.sources) {
      const sourceContainer = utils.getSourceContainerBySource(room, source.id);
      if (!sourceContainer) continue;

      const desiredHaulersForSource = this.getDesiredHaulersForSource(
        source.id,
      );

      const existingHaulers = _.filter(Game.creeps, function (creep) {
        return (
          creep.memory.role === "hauler" &&
          creep.memory.room === room.name &&
          creep.memory.sourceId === source.id
        );
      }).length;

      const queuedHaulers = this.countQueuedForSource(
        room,
        "hauler",
        source.id,
      );

      for (
        let i = existingHaulers + queuedHaulers;
        i < desiredHaulersForSource;
        i++
      ) {
        requests.push({
          role: "hauler",
          priority: 80,
          sourceId: source.id,
        });
      }
    }

    // UPGRADERS
    const desiredUpgraders = config.CREEPS.upgraders;

    if (state.controllerContainers.length > 0) {
      const controllerContainer = state.controllerContainers[0];

      const existingUpgraders = _.filter(Game.creeps, function (creep) {
        return (
          creep.memory.role === "upgrader" &&
          creep.memory.room === room.name &&
          creep.memory.targetId === controllerContainer.id
        );
      }).length;

      const queuedUpgraders = this.countQueuedForTarget(
        room,
        "upgrader",
        controllerContainer.id,
      );

      for (
        let i = existingUpgraders + queuedUpgraders;
        i < desiredUpgraders;
        i++
      ) {
        requests.push({
          role: "upgrader",
          priority: 70,
          targetId: controllerContainer.id,
        });
      }
    }

    // REPAIRS
    const desiredRepairs = config.CREEPS.repairs;
    const currentRepairs = roleCounts.repair || 0;
    const queuedRepairs = this.countQueued(room, "repair");

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

  getDesiredHaulersForSource(sourceId) {
    const overrides = config.CREEPS.haulersPerSourceBySourceId || {};

    if (Object.prototype.hasOwnProperty.call(overrides, sourceId)) {
      return overrides[sourceId];
    }

    return config.CREEPS.haulersPerSourceDefault;
  },

  isQueued(room, role, sourceId, targetId) {
    const queue =
      Memory.rooms &&
      Memory.rooms[room.name] &&
      Memory.rooms[room.name].spawnQueue
        ? Memory.rooms[room.name].spawnQueue
        : [];

    return _.some(queue, function (item) {
      return (
        item.role === role &&
        (item.sourceId || null) === (sourceId || null) &&
        (item.targetId || null) === (targetId || null)
      );
    });
  },

  countQueued(room, role) {
    const queue =
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
    const queue =
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
    const queue =
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
