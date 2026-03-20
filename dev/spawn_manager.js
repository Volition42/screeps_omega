/*
Developer Summary:
Spawn Manager

Purpose:
- Maintain the room workforce by phase
- Support normal role-based spawning
- Recover automatically from colony collapse

Recovery behavior:
- If the room loses its working economy, spawn JrWorkers first
- JrWorkers are the emergency bootstrap role
- Once energy flow returns, normal spawning resumes
*/

const bodies = require("bodies");
const config = require("config");
const defenseManager = require("defense_manager");

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
      this.addDefenseRequests(room, state, requests, reaction);

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
      this.addDefenseRequests(room, state, requests, reaction);

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
      this.addDefenseRequests(room, state, requests, reaction);

      if (!this.areSourceContainersReady(state)) {
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

      this.addCoreEconomyRequests(room, state, requests, {
        includeRepairs: false,
      });

      requests.sort(function (a, b) {
        return b.priority - a.priority;
      });

      return requests;
    }

    this.addDefenseRequests(room, state, requests, reaction);
    this.addCoreEconomyRequests(room, state, requests, {
      includeRepairs: true,
    });

    requests.sort(function (a, b) {
      return b.priority - a.priority;
    });

    return requests;
  },

  isBootstrapPhase(phase) {
    return phase === "bootstrap_jr" || phase === "bootstrap";
  },

  areSourceContainersReady(state) {
    if (state && state.buildStatus) {
      return (
        state.buildStatus.sourceContainersBuilt >=
        state.buildStatus.sourceContainersNeeded
      );
    }

    var sources = state && state.sources ? state.sources.length : 0;
    var built =
      state && state.sourceContainers ? state.sourceContainers.length : 0;

    return sources > 0 && built >= sources;
  },

  addCoreEconomyRequests(room, state, requests, options) {
    var roleCounts = state.roleCounts || {};
    var settings = options || {};
    var sources = state.sources || [];
    var sourceContainersBySourceId = state.sourceContainersBySourceId || {};

    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      var sourceContainer = sourceContainersBySourceId[source.id];
      if (!sourceContainer) continue;

      var existingMiners = this.getRoleSourceCount(state, "miner", source.id);
      var queuedMiners = this.countQueuedForSource(room, "miner", source.id);

      for (
        var minerIndex = existingMiners + queuedMiners;
        minerIndex < config.CREEPS.minersPerSource;
        minerIndex++
      ) {
        requests.push({
          role: "miner",
          priority: 100,
          sourceId: source.id,
        });
      }
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
      requests.push({ role: "worker", priority: 90 });
    }

    var desiredUpgraders = config.CREEPS.upgraders;
    var currentUpgraders = roleCounts.upgrader || 0;
    var queuedUpgraders = this.countQueued(room, "upgrader");

    while (
      currentUpgraders +
        queuedUpgraders +
        requests.filter(function (r) {
          return r.role === "upgrader";
        }).length <
      desiredUpgraders
    ) {
      requests.push({
        role: "upgrader",
        priority: 80,
      });
    }

    for (var j = 0; j < sources.length; j++) {
      var haulSource = sources[j];
      var haulContainer = sourceContainersBySourceId[haulSource.id];
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
          priority: 70,
          sourceId: haulSource.id,
        });
      }
    }

    if (!settings.includeRepairs) return;

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
  },

  addDefenseRequests(room, state, requests, reaction) {
    if (!reaction.ENABLED) return;

    var defenseState =
      state && state.defense ? state.defense : defenseManager.collect(room, state);
    var threats = defenseState.activeThreats || [];
    var defenseMemory = this.getDefenseSpawnMemory(room);

    this.pruneStaleDefenseLocks(defenseMemory, reaction);

    for (var i = 0; i < threats.length; i++) {
      var threat = threats[i];
      var role = threat.responseRole || "defender";
      var cooldown = threat.spawnCooldown || 0;
      var requestKey = this.getDefenseRequestKey(role, threat.roomName);
      var activeLock = defenseMemory.spawnLocks[requestKey] || null;

      var existingDefenders = _.filter(
        state.roleMap && state.roleMap[role] ? state.roleMap[role] : [],
        function (creep) {
          return (
            creep.memory.role === role &&
            (creep.ticksToLive === undefined ||
              creep.ticksToLive > reaction.REPLACE_TTL)
          );
        },
      ).length;
      var queuedDefenders = this.countQueued(room, role);
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

  getDefenseRequestKey(role, roomName) {
    return role + ":" + roomName;
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
