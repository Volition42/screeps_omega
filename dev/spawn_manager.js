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
const config = require("config");
const defenseManager = require("defense_manager");
const remoteManager = require("remote_manager");

const RESERVATION_CHECK_INTERVAL = 10;

var remoteReservationCache = {};
var usernameCache = {
  tick: 0,
  username: null,
};

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
        threatLevel: request.threatLevel || null,
        threatScore: request.threatScore || null,
        sourceId: request.sourceId || null,
        targetId: request.targetId || null,
        targetRoom: request.targetRoom || null,
        homeRoom: request.homeRoom || null,
      };
    });

    if (spawn.spawning || requests.length === 0) return;

    var request = requests[0];
    var body = bodies.get(request.role, room, request);
    var name = request.role + "_" + Game.time;

    var result = spawn.spawnCreep(body, name, {
      memory: {
        role: request.role,
        room: room.name,
        homeRoom: request.homeRoom || room.name,
        working: false,
        delivering: false,
        threatLevel: request.threatLevel || null,
        threatScore: request.threatScore || null,
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
    var reaction = defenseManager.getReactionConfig();

    if (this.needsRecovery(state)) {
      this.addDefenseRequests(room, state, requests, reaction, {
        homeOnly: true,
      });

      if (this.isBootstrapPhase(state.phase)) {
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
      }

      requests.sort(function (a, b) {
        return b.priority - a.priority;
      });

      return requests;
    }

    if (state.phase === "bootstrap_jr") {
      this.addDefenseRequests(room, state, requests, reaction, {
        homeOnly: true,
      });

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

    if (state.phase === "bootstrap") {
      this.addDefenseRequests(room, state, requests, reaction, {
        homeOnly: true,
      });

      var desiredBootstrapWorkers = Math.max(1, config.CREEPS.workers || 1);
      var currentBootstrapWorkers = roleCounts.worker || 0;
      var queuedBootstrapWorkers = this.countQueued(room, "worker");

      while (
        currentBootstrapWorkers +
          queuedBootstrapWorkers +
          requests.filter(function (r) {
            return r.role === "worker";
          }).length <
        desiredBootstrapWorkers
      ) {
        requests.push({ role: "worker", priority: 100 });
      }

      requests.sort(function (a, b) {
        return b.priority - a.priority;
      });

      return requests;
    }

    this.addDefenseRequests(room, state, requests, reaction, {
      homeOnly: false,
    });

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
      var sourceContainer = state.sourceContainersBySourceId[source.id];
      if (!sourceContainer) continue;

      var existingMiners = this.getRoleSourceCount(state, "miner", source.id);

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
      var haulContainer = state.sourceContainersBySourceId[haulSource.id];
      if (!haulContainer) continue;

      var desiredHaulersForSource = this.getDesiredHaulersForSource(
        haulSource.id,
      );

      var existingHaulers = this.getRoleSourceCount(
        state,
        "hauler",
        haulSource.id,
      );

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

      var existingUpgraders = this.getRoleTargetCount(
        state,
        "upgrader",
        controllerContainer.id,
      );

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
    this.addRemotePhaseTwoRequests(room, state, requests);
    this.addRemotePhaseOneRequests(room, state, requests);

    requests.sort(function (a, b) {
      return b.priority - a.priority;
    });

    return requests;
  },

  isBootstrapPhase(phase) {
    return phase === "bootstrap_jr" || phase === "bootstrap";
  },

  addDefenseRequests(room, state, requests, reaction, options) {
    if (!reaction.ENABLED) return;

    var defenseState =
      state && state.defense ? state.defense : defenseManager.collect(room, state);
    var threats = defenseState.activeThreats || [];
    var settings = options || {};
    var defenseMemory = this.getDefenseSpawnMemory(room);

    this.pruneStaleDefenseLocks(defenseMemory, reaction);

    for (var i = 0; i < threats.length; i++) {
      var threat = threats[i];
      var role = threat.responseRole || "defender";
      var cooldown = threat.spawnCooldown || 0;
      var requestKey = this.getDefenseRequestKey(role, threat.roomName);
      var activeLock = defenseMemory.spawnLocks[requestKey] || null;

      if (settings.homeOnly && threat.scope !== "home") {
        continue;
      }

      var existingDefenders = _.filter(
        this.getRoleTargetRoomCreeps(state, role, threat.roomName),
        function (creep) {
          return (
            creep.memory.role === role &&
            (creep.ticksToLive === undefined ||
              creep.ticksToLive > reaction.REPLACE_TTL)
          );
        },
      ).length;
      var queuedDefenders = this.countQueuedForTargetRoom(
        room,
        role,
        threat.roomName,
      );
      var plannedDefenders = 0;

      if (
        activeLock &&
        Game.time - activeLock.lastSeen <= (reaction.THREAT_MEMORY_TTL || 25)
      ) {
        activeLock.lastSeen = Game.time;
      }

      for (
        var defenderIndex = existingDefenders + queuedDefenders;
        defenderIndex < (threat.desiredDefenders || 0);
        defenderIndex++
      ) {
        if (
          plannedDefenders > 0 ||
          !this.canQueueDefenseSpawn(defenseMemory, requestKey, cooldown)
        ) {
          break;
        }

        requests.push({
          role: role,
          priority: threat.priority,
          threatLevel: threat.threatLevel || 1,
          threatScore: threat.threatScore || 0,
          targetRoom: threat.roomName,
          homeRoom: room.name,
        });

        plannedDefenders++;
        defenseMemory.spawnLocks[requestKey] = {
          lastQueued: Game.time,
          lastSeen: Game.time,
        };
      }
    }
  },

  addRemoteReservationRequests(room, state, requests) {
    if (!config.REMOTE_MINING || !config.REMOTE_MINING.ENABLED) return;
    if (state.phase !== "developing" && state.phase !== "stable") return;

    var sites =
      state.remoteSites || remoteManager.getHomeRoomSites(room.name);

    for (var i = 0; i < sites.length; i++) {
      var site = sites[i];
      if (!site.reservation || site.reservation.enabled !== true) continue;

      var targetRoom = site.targetRoom;
      var desiredReservers = site.reservation.reservers || 1;
      var renewBelow = site.reservation.renewBelow || 2000;

      var existingReservers = _.filter(
        this.getRoleTargetRoomCreeps(state, "reserver", targetRoom),
        function (creep) {
          if (creep.memory.role !== "reserver") {
            return false;
          }

          return creep.ticksToLive === undefined || creep.ticksToLive > 80;
        },
      ).length;

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

    var reservationState = this.getCachedRemoteReservationState(
      homeRoom,
      targetRoom,
      remoteRoom,
    );

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

    var sites =
      state.remoteSites || remoteManager.getHomeRoomSites(room.name);

    for (var i = 0; i < sites.length; i++) {
      var site = sites[i];
      var targetRoom = site.targetRoom;
      if (!site.phaseHooks || !site.phaseHooks.phaseOneReady) continue;
      if (site.phase !== 1) continue;

      var desired = site.jrWorkers || 0;

      var existing = this.getRoleTargetRoomCount(
        state,
        "remotejrworker",
        targetRoom,
      );

      var queued = this.countQueuedForTargetRoom(
        room,
        "remotejrworker",
        targetRoom,
      );

      for (var count = existing + queued; count < desired; count++) {
        requests.push({
          role: "remotejrworker",
          priority: 50,
          targetRoom: targetRoom,
          homeRoom: room.name,
        });
      }
    }
  },

  addRemotePhaseTwoRequests(room, state, requests) {
    if (!config.REMOTE_MINING || !config.REMOTE_MINING.ENABLED) return;
    if (state.phase !== "developing" && state.phase !== "stable") return;

    var sites =
      state.remoteSites || remoteManager.getHomeRoomSites(room.name, state);

    for (var i = 0; i < sites.length; i++) {
      var site = sites[i];
      var targetRoom = site.targetRoom;
      if (!site.phaseHooks || !site.phaseHooks.phaseTwoReady) continue;
      if (site.phase === 1) continue;

      var desiredRemoteWorkers =
        site.phaseTargets && typeof site.phaseTargets.remoteWorkers === "number"
          ? site.phaseTargets.remoteWorkers
          : 0;
      var existingRemoteWorkers = this.getRoleTargetRoomCount(
        state,
        "remoteworker",
        targetRoom,
      );
      var queuedRemoteWorkers = this.countQueuedForTargetRoom(
        room,
        "remoteworker",
        targetRoom,
      );

      for (
        var workerIndex = existingRemoteWorkers + queuedRemoteWorkers;
        workerIndex < desiredRemoteWorkers;
        workerIndex++
      ) {
        requests.push({
          role: "remoteworker",
          priority: 58,
          targetRoom: targetRoom,
          homeRoom: room.name,
        });
      }

      var sourceDetails = site.sourceDetails || [];

      for (var j = 0; j < sourceDetails.length; j++) {
        var sourceDetail = sourceDetails[j];
        if (!sourceDetail.containerBuilt) continue;

        var existingRemoteMiners = this.getRoleSourceCount(
          state,
          "remoteminer",
          sourceDetail.sourceId,
        );
        var queuedRemoteMiners = this.countQueuedForSource(
          room,
          "remoteminer",
          sourceDetail.sourceId,
        );

        for (
          var minerIndex = existingRemoteMiners + queuedRemoteMiners;
          minerIndex < 1;
          minerIndex++
        ) {
          requests.push({
            role: "remoteminer",
            priority: 54,
            sourceId: sourceDetail.sourceId,
            targetRoom: targetRoom,
            homeRoom: room.name,
          });
        }

        var desiredRemoteHaulers = sourceDetail.desiredRemoteHaulers || 1;
        var existingRemoteHaulers = this.getRoleSourceCount(
          state,
          "remotehauler",
          sourceDetail.sourceId,
        );
        var queuedRemoteHaulers = this.countQueuedForSource(
          room,
          "remotehauler",
          sourceDetail.sourceId,
        );

        for (
          var haulerIndex = existingRemoteHaulers + queuedRemoteHaulers;
          haulerIndex < desiredRemoteHaulers;
          haulerIndex++
        ) {
          requests.push({
            role: "remotehauler",
            priority: 53,
            sourceId: sourceDetail.sourceId,
            targetRoom: targetRoom,
            homeRoom: room.name,
          });
        }
      }
    }
  },

  getMyUsername(room) {
    if (usernameCache.tick === Game.time) {
      return usernameCache.username;
    }

    if (!room || !room.controller) return null;
    if (room.controller.owner && room.controller.owner.username) {
      usernameCache.tick = Game.time;
      usernameCache.username = room.controller.owner.username;
      return usernameCache.username;
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
        usernameCache.tick = Game.time;
        usernameCache.username = testRoom.controller.owner.username;
        return usernameCache.username;
      }
    }

    usernameCache.tick = Game.time;
    usernameCache.username = null;
    return null;
  },

  getCachedRemoteReservationState(homeRoom, targetRoom, remoteRoom) {
    var cacheKey = homeRoom.name + ":" + targetRoom;
    var cached = remoteReservationCache[cacheKey];

    // Developer note:
    // Reservation state only needs coarse refreshes. Keeping a short-lived
    // cache avoids controller reservation checks every tick for each remote.
    if (cached && Game.time - cached.tick < RESERVATION_CHECK_INTERVAL) {
      return cached.state;
    }

    var state = this.getRemoteReservationState(homeRoom, remoteRoom);

    remoteReservationCache[cacheKey] = {
      tick: Game.time,
      state: state,
    };

    return state;
  },

  getRoleSourceCount(state, role, sourceId) {
    return this.getRoleSourceCreeps(state, role, sourceId).length;
  },

  getRoleSourceCreeps(state, role, sourceId) {
    if (
      !state.sourceRoleMap ||
      !state.sourceRoleMap[role] ||
      !state.sourceRoleMap[role][sourceId]
    ) {
      return [];
    }

    return state.sourceRoleMap[role][sourceId];
  },

  getRoleTargetCount(state, role, targetId) {
    if (
      !state.targetRoleMap ||
      !state.targetRoleMap[role] ||
      !state.targetRoleMap[role][targetId]
    ) {
      return 0;
    }

    return state.targetRoleMap[role][targetId].length;
  },

  getRoleTargetRoomCount(state, role, targetRoom) {
    return this.getRoleTargetRoomCreeps(state, role, targetRoom).length;
  },

  getRoleTargetRoomCreeps(state, role, targetRoom) {
    if (
      !state.targetRoomRoleMap ||
      !state.targetRoomRoleMap[role] ||
      !state.targetRoomRoleMap[role][targetRoom]
    ) {
      return [];
    }

    return state.targetRoomRoleMap[role][targetRoom];
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

  getDefenseSpawnMemory(room) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].defense) {
      Memory.rooms[room.name].defense = {};
    }
    if (!Memory.rooms[room.name].defense.spawnLocks) {
      Memory.rooms[room.name].defense.spawnLocks = {};
    }

    return Memory.rooms[room.name].defense;
  },

  getDefenseRequestKey(role, targetRoom) {
    return role + ":" + targetRoom;
  },

  canQueueDefenseSpawn(defenseMemory, requestKey, cooldown) {
    if (!cooldown || cooldown <= 0) return true;

    var lock = defenseMemory.spawnLocks[requestKey];
    if (!lock || typeof lock.lastQueued !== "number") return true;

    return Game.time - lock.lastQueued >= cooldown;
  },

  pruneStaleDefenseLocks(defenseMemory, reaction) {
    var locks = defenseMemory.spawnLocks || {};
    var ttl = Math.max(reaction.THREAT_MEMORY_TTL || 25, reaction.REPLACE_TTL || 90);

    for (var key in locks) {
      if (!Object.prototype.hasOwnProperty.call(locks, key)) continue;

      var lock = locks[key];
      var lastSeen = lock && typeof lock.lastSeen === "number" ? lock.lastSeen : 0;
      var lastQueued =
        lock && typeof lock.lastQueued === "number" ? lock.lastQueued : 0;
      var anchor = Math.max(lastSeen, lastQueued);

      if (Game.time - anchor > ttl) {
        delete locks[key];
      }
    }
  },
};
