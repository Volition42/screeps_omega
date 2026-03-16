/*
Developer Summary:
Spawn Manager

Purpose:
- Maintain the room workforce by phase
- Support normal role-based spawning
- Recover automatically from colony collapse
- Maintain configured remote mining workers
- Maintain configured remote reservers

Recovery behavior:
- If the room loses its working economy, spawn JrWorkers first
- JrWorkers are the emergency bootstrap role
- Once energy flow returns, normal spawning resumes

Remote mining:
- Manual remote room config
- Remote spawning is allowed only when the home room is developing or stable
- Remote spawning pauses automatically if the home room falls back into bootstrap

Remote reservation:
- Maintain reserver creeps for configured remote rooms
- Reservation is fully controlled per remote room config
- Spawn only up to desired reserver count
- For visible rooms, replace only when reservation is missing / not yours / below threshold
- For unseen rooms, maintain only baseline reserver coverage
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
        targetRoom: request.targetRoom || null,
        homeRoom: request.homeRoom || null,
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
        homeRoom: request.homeRoom || room.name,
        working: false,
        delivering: false,
        sourceId: request.sourceId || null,
        targetId: request.targetId || null,
        targetRoom: request.targetRoom || null,
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

      for (
        var minerIndex = existingMiners + queuedMiners;
        minerIndex < minersPerSource;
        minerIndex++
      ) {
        requests.push({
          role: "miner",
          priority: 90,
          sourceId: source.id,
        });
      }
    }

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

    this.addRemoteReservationRequests(room, state, requests);
    this.addRemotePhaseOneRequests(room, state, requests);

    requests.sort(function (a, b) {
      return b.priority - a.priority;
    });

    return requests;
  },

  addRemoteReservationRequests(room, state, requests) {
    if (!config.REMOTE_MINING || !config.REMOTE_MINING.ENABLED) return;
    if (state.phase !== "developing" && state.phase !== "stable") return;

    var sites = config.REMOTE_MINING.SITES || {};

    for (var targetRoom in sites) {
      if (!Object.prototype.hasOwnProperty.call(sites, targetRoom)) continue;

      var site = sites[targetRoom];
      if (!site || !site.enabled) continue;
      if (site.homeRoom !== room.name) continue;
      if (!site.reservation || site.reservation.enabled !== true) continue;

      var desiredReservers = site.reservation.reservers || 1;
      var renewBelow = site.reservation.renewBelow || 2000;

      var existingReservers = _.filter(Game.creeps, function (creep) {
        if (
          creep.memory.role !== "reserver" ||
          creep.memory.room !== room.name ||
          creep.memory.targetRoom !== targetRoom
        ) {
          return false;
        }

        return creep.ticksToLive === undefined || creep.ticksToLive > 80;
      }).length;

      var queuedReservers = this.countQueuedForTargetRoom(
        room,
        "reserver",
        targetRoom,
      );
      var totalReservers = existingReservers + queuedReservers;

      if (totalReservers >= desiredReservers) {
        continue;
      }

      var shouldSpawn = this.shouldSpawnReserver(
        room,
        targetRoom,
        renewBelow,
        totalReservers,
      );

      if (shouldSpawn) {
        requests.push({
          role: "reserver",
          priority: 55,
          targetRoom: targetRoom,
          homeRoom: room.name,
        });
      }
    }
  },

  shouldSpawnReserver(homeRoom, targetRoom, renewBelow, totalReservers) {
    var remoteRoom = Game.rooms[targetRoom];

    // Developer note:
    // If the room is not visible, only maintain baseline coverage.
    // Do not keep spawning blindly.
    if (!remoteRoom || !remoteRoom.controller) {
      return totalReservers === 0;
    }

    var reservationState = this.getRemoteReservationState(homeRoom, remoteRoom);

    if (!reservationState.hasMyReservation) {
      return true;
    }

    return reservationState.ticksToEnd < renewBelow;
  },

  getRemoteReservationState(homeRoom, remoteRoom) {
    var myUsername = this.getMyUsername(homeRoom);

    if (!remoteRoom || !remoteRoom.controller || !myUsername) {
      return {
        hasMyReservation: false,
        ticksToEnd: 0,
      };
    }

    var reservation = remoteRoom.controller.reservation;
    if (!reservation) {
      return {
        hasMyReservation: false,
        ticksToEnd: 0,
      };
    }

    if (reservation.username !== myUsername) {
      return {
        hasMyReservation: false,
        ticksToEnd: reservation.ticksToEnd || 0,
      };
    }

    return {
      hasMyReservation: true,
      ticksToEnd: reservation.ticksToEnd || 0,
    };
  },

  addRemotePhaseOneRequests(room, state, requests) {
    if (!config.REMOTE_MINING || !config.REMOTE_MINING.ENABLED) return;
    if (state.phase !== "developing" && state.phase !== "stable") return;

    var sites = config.REMOTE_MINING.SITES || {};

    for (var targetRoom in sites) {
      if (!Object.prototype.hasOwnProperty.call(sites, targetRoom)) continue;

      var site = sites[targetRoom];
      if (!site || !site.enabled) continue;
      if (site.homeRoom !== room.name) continue;
      if (site.phase !== 1) continue;

      var desired = site.jrWorkers || 0;

      var existing = _.filter(Game.creeps, function (creep) {
        return (
          creep.memory.role === "remotejrworker" &&
          creep.memory.room === room.name &&
          creep.memory.targetRoom === targetRoom
        );
      }).length;

      var queued = this.countQueuedForTargetRoom(
        room,
        "remotejrworker",
        targetRoom,
      );

      for (var i = existing + queued; i < desired; i++) {
        requests.push({
          role: "remotejrworker",
          priority: 50,
          targetRoom: targetRoom,
          homeRoom: room.name,
        });
      }
    }
  },

  getMyUsername(room) {
    if (!room || !room.controller) return null;
    if (room.controller.owner && room.controller.owner.username) {
      return room.controller.owner.username;
    }

    for (var name in Game.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Game.rooms, name)) continue;
      var testRoom = Game.rooms[name];
      if (
        testRoom.controller &&
        testRoom.controller.my &&
        testRoom.controller.owner &&
        testRoom.controller.owner.username
      ) {
        return testRoom.controller.owner.username;
      }
    }

    return null;
  },

  needsRecovery(state) {
    var roleCounts = state.roleCounts || {};

    var jrWorkers = roleCounts.jrworker || 0;
    var workers = roleCounts.worker || 0;
    var miners = roleCounts.miner || 0;
    var haulers = roleCounts.hauler || 0;
    var totalEconomyCreeps = jrWorkers + workers + miners + haulers;

    if (totalEconomyCreeps === 0) return true;

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

  countQueuedForTargetRoom(room, role, targetRoom) {
    var queue =
      Memory.rooms &&
      Memory.rooms[room.name] &&
      Memory.rooms[room.name].spawnQueue
        ? Memory.rooms[room.name].spawnQueue
        : [];

    return _.filter(queue, function (item) {
      return item.role === role && item.targetRoom === targetRoom;
    }).length;
  },
};
