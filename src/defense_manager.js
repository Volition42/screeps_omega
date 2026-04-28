/*
Developer Summary:
Reactive empire defense escalation planner.

Purpose:
- Evaluate immediate hostile pressure in owned rooms
- Translate visible home threats into simple defender demand for spawning
- Allow nearby owned rooms to provide one-room support when a target room needs help
- Keep the defense pass narrow, reactive, and CPU-cheap

Important Notes:
- No proactive combat escalation is included
- Defender demand stays capped to avoid broad combat overreach
*/

const config = require("config");
const utils = require("utils");

const ATTACK_POWER_VALUE = 30;
const RANGED_ATTACK_POWER_VALUE = 10;
const HEAL_POWER_VALUE = 12;
const RANGED_HEAL_POWER_VALUE = 4;
const TOWER_POWER_ATTACK_VALUE = 600;
const TOWER_OPTIMAL_RANGE_VALUE = 5;
const TOWER_FALLOFF_RANGE_VALUE = 20;
const TOWER_FALLOFF_VALUE = 0.75;
const DEFENDER_RESPONSE_POWER = 120;

function getActiveBodyparts(target, partType) {
  if (!target || typeof target.getActiveBodyparts !== "function") {
    return 0;
  }

  return target.getActiveBodyparts(partType);
}

function getStoredEnergy(structure) {
  if (!structure) return 0;
  if (structure.store) {
    return structure.store[RESOURCE_ENERGY] || 0;
  }
  if (typeof structure.energy === "number") {
    return structure.energy;
  }

  return 0;
}

function getControllerLevel(room) {
  return room && room.controller ? room.controller.level || 0 : 0;
}

module.exports = {
  collect(room, state) {
    var reaction = this.getReactionConfig();

    if (!reaction.ENABLED) {
      return {
        enabled: false,
        homeThreat: null,
        activeThreats: [],
        hasThreats: false,
        requiredDefenders: 0,
        threatenedRooms: [],
        support: null,
        outgoingSupport: null,
        recovery: {
          active: false,
          reason: null,
          startedAt: null,
          exitWhenReady: false,
        },
      };
    }

    var homeThreat = this.getOwnedRoomThreat(room, state, reaction);
    var activeThreats = homeThreat.active ? [homeThreat] : [];
    var recovery = this.updateRecoveryState(room, state, homeThreat, reaction);
    var support = this.getSupportSummary(room.name, reaction);
    if (
      support &&
      (!homeThreat.active || homeThreat.towerCanHandle || (homeThreat.desiredDefenders || 0) <= 0)
    ) {
      this.clearSupportRequest(room.name);
      support = null;
    }

    return {
      enabled: reaction.ENABLED,
      homeThreat: homeThreat,
      activeThreats: activeThreats,
      hasThreats: activeThreats.length > 0,
      requiredDefenders: homeThreat.desiredDefenders || 0,
      threatenedRooms: activeThreats.length > 0 ? [room.name] : [],
      support: support,
      outgoingSupport: this.getOutgoingSupportSummary(room.name, reaction),
      recovery: recovery,
    };
  },

  getReactionConfig() {
    var defaults = {
      ENABLED: true,
      MAX_HOME_DEFENDERS: 3,
      HOME_INVASION_PRIORITY: 1100,
      HOME_SPAWN_COOLDOWN: 5,
      REPLACE_TTL: 90,
      SCORE_PER_HOME_DEFENDER: 6,
      HOSTILE_CREEP_BASE_SCORE: 1,
      ATTACK_PART_SCORE: 1,
      RANGED_PART_SCORE: 1,
      HEAL_PART_SCORE: 2,
      CLAIM_PART_SCORE: 2,
      WORK_PART_SCORE: 1,
      DISMANTLE_ASSET_PART_SCORE: 2,
      DISMANTLE_CORE_PART_SCORE: 3,
      INVADER_CORE_BASE_SCORE: 4,
      INVADER_CORE_LEVEL_SCORE: 2,
      INVADER_CORE_HITS_STEP: 100000,
      THREAT_MEMORY_TTL: 25,
      RECOVERY_COOLDOWN_TICKS: 15,
      TOWER_BREAKTHROUGH_DAMAGE: 50,
      TOWER_SCORE_PER_ACTIVE_TOWER: 6,
      EDGE_BUFFER: 2,
      CROSS_ROOM_ENABLED: true,
      MAX_SUPPORT_DISTANCE: 2,
      MAX_SUPPORT_DEFENDERS: 1,
      SUPPORT_PRIORITY: 1050,
      SUPPORT_SPAWN_COOLDOWN: 25,
      SUPPORT_REQUEST_TTL: 75,
      SUPPORT_MIN_RCL: 3,
      SUPPORT_MIN_ENERGY_CAPACITY: 650,
    };

    return Object.assign(defaults, config.DEFENSE && config.DEFENSE.REACTION);
  },

  getCrossRoomSupportThreats(helperRoom, helperState, reaction) {
    if (!reaction.ENABLED || !reaction.CROSS_ROOM_ENABLED) return [];
    if (!this.isSupportHelperEligible(helperRoom, helperState, reaction)) return [];

    var threats = [];

    for (var roomName in Game.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Game.rooms, roomName)) continue;
      if (roomName === helperRoom.name) continue;

      var targetRoom = Game.rooms[roomName];
      if (!this.isOwnedRoom(targetRoom)) continue;
      if (!this.isSupportRouteAllowed(helperRoom.name, targetRoom.name, reaction)) continue;
      if (this.getBestSupportHelper(targetRoom, reaction, helperRoom, helperState) !== helperRoom.name) {
        continue;
      }

      var targetState = this.getCachedRoomState(targetRoom);
      var targetThreat = this.getOwnedRoomThreat(targetRoom, targetState, reaction);
      if (!this.needsCrossRoomSupport(targetRoom, targetState, targetThreat, reaction)) {
        continue;
      }

      var role = targetThreat.responseRole || "defender";
      var maxSupport = reaction.MAX_SUPPORT_DEFENDERS || 1;
      if (
        targetThreat.breachSeverity === "core_breach" &&
        helperRoom &&
        helperRoom.controller &&
        helperRoom.controller.level >= 6
      ) {
        maxSupport = Math.max(maxSupport, 2);
      }
      var coverage = this.countDefenseCoverage(targetRoom.name, role, reaction);
      var desiredSupport = Math.min(
        maxSupport,
        Math.max(0, (targetThreat.desiredDefenders || 0) - coverage),
      );

      if (desiredSupport <= 0) continue;

      var supportThreat = Object.assign({}, targetThreat, {
        scope: "support",
        classification: "cross_room_support",
        type: "cross_room_support",
        priority: Math.max(
          reaction.SUPPORT_PRIORITY || 1050,
          (targetThreat.priority || 0) - 25,
        ),
        desiredDefenders: desiredSupport,
        spawnCooldown: reaction.SUPPORT_SPAWN_COOLDOWN || 25,
        targetRoom: targetRoom.name,
        helperRoom: helperRoom.name,
        operation: "defense_support",
        responseMode: targetThreat.responseMode || "creep_only",
      });

      this.recordSupportRequest(targetRoom.name, helperRoom.name, supportThreat, coverage);
      threats.push(supportThreat);
    }

    return threats;
  },

  needsCrossRoomSupport(targetRoom, targetState, targetThreat, reaction) {
    if (!targetThreat || !targetThreat.active) return false;
    if (targetThreat.towerCanHandle) return false;
    if ((targetThreat.desiredDefenders || 0) <= 0) return false;

    var spawns =
      targetState && targetState.spawns
        ? targetState.spawns
        : targetRoom.find(FIND_MY_SPAWNS);
    var idleSpawns = _.filter(spawns, function (spawn) {
      return !spawn.spawning;
    });
    var localCanSpawn = !!(
      spawns.length > 0 &&
      idleSpawns.length > 0 &&
      targetRoom.energyCapacityAvailable >= 300
    );
    var localCanRespondQuickly = !!(
      localCanSpawn &&
      targetRoom.energyCapacityAvailable >= 430
    );

    if (targetThreat.responseMode === "tower_only") return false;

    if (targetThreat.breachSeverity === "edge_pressure") {
      return !localCanRespondQuickly;
    }

    if (targetThreat.breachSeverity === "interior_pressure") {
      return !localCanRespondQuickly;
    }

    if (targetThreat.breachSeverity === "core_breach") {
      return (
        !localCanRespondQuickly ||
        targetThreat.towerEnergyState !== "ready" ||
        (targetThreat.readyTowerCount || 0) <= 0
      );
    }

    if (!localCanSpawn) return true;

    return (
      (targetThreat.threatLevel || 1) >= 2 ||
      targetThreat.responseMode === "creep_only"
    );
  },

  isSupportHelperEligible(room, state, reaction) {
    if (!this.isOwnedRoom(room)) return false;
    if (getControllerLevel(room) < (reaction.SUPPORT_MIN_RCL || 3)) return false;
    if (room.energyCapacityAvailable < (reaction.SUPPORT_MIN_ENERGY_CAPACITY || 650)) {
      return false;
    }

    var spawns = state && state.spawns ? state.spawns : room.find(FIND_MY_SPAWNS);
    if (spawns.length <= 0) return false;
    if (!_.some(spawns, function (spawn) { return !spawn.spawning; })) return false;

    if (state && state.defense && state.defense.hasThreats) return false;
    if (state && state.defense && state.defense.recovery && state.defense.recovery.active) {
      return false;
    }
    if (this.getStoredRecoveryState(room).active) return false;

    var hostiles = utils.getDefenseIntruders(
      room,
      state && state.hostileCreeps ? state.hostileCreeps : null,
      state && state.hostilePowerCreeps ? state.hostilePowerCreeps : null,
      state && state.hostileStructures ? state.hostileStructures : null,
    );

    return hostiles.length === 0;
  },

  getBestSupportHelper(targetRoom, reaction, preferredRoom, preferredState) {
    var bestRoomName = null;
    var bestDistance = Infinity;

    for (var roomName in Game.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Game.rooms, roomName)) continue;
      if (roomName === targetRoom.name) continue;

      var room = Game.rooms[roomName];
      if (!this.isOwnedRoom(room)) continue;

      var state = preferredRoom && preferredRoom.name === room.name
        ? preferredState
        : this.getCachedRoomState(room);

      if (!this.isSupportHelperEligible(room, state, reaction)) continue;
      if (!this.isSupportRouteAllowed(room.name, targetRoom.name, reaction)) continue;

      var distance = this.getRoomDistance(room.name, targetRoom.name);
      if (
        distance < bestDistance ||
        (distance === bestDistance && (!bestRoomName || room.name < bestRoomName))
      ) {
        bestRoomName = room.name;
        bestDistance = distance;
      }
    }

    return bestRoomName;
  },

  isSupportRouteAllowed(fromRoom, toRoom, reaction) {
    var distance = this.getRoomDistance(fromRoom, toRoom);
    if (distance > (reaction.MAX_SUPPORT_DISTANCE || 2)) return false;

    if (Game.map && typeof Game.map.findRoute === "function") {
      var route = Game.map.findRoute(fromRoom, toRoom);
      if (route === ERR_NO_PATH) return false;
      if (
        route &&
        route.length &&
        route.length > (reaction.MAX_SUPPORT_DISTANCE || 2) + 1
      ) {
        return false;
      }
    }

    return true;
  },

  countDefenseCoverage(targetRoomName, role, reaction) {
    var count = 0;

    for (var creepName in Game.creeps) {
      if (!Object.prototype.hasOwnProperty.call(Game.creeps, creepName)) continue;

      var creep = Game.creeps[creepName];
      if (!creep || !creep.memory || creep.memory.role !== role) continue;
      if (
        creep.ticksToLive !== undefined &&
        creep.ticksToLive <= (reaction.REPLACE_TTL || 90)
      ) {
        continue;
      }

      var creepTarget = creep.memory.targetRoom || creep.memory.homeRoom || creep.memory.room;
      if (creepTarget === targetRoomName) count++;
    }

    if (Memory.rooms) {
      for (var roomName in Memory.rooms) {
        if (!Object.prototype.hasOwnProperty.call(Memory.rooms, roomName)) continue;
        var queue = Memory.rooms[roomName] ? Memory.rooms[roomName].spawnQueue : null;
        if (!queue) continue;

        for (var i = 0; i < queue.length; i++) {
          var item = queue[i];
          if (!item || item.role !== role) continue;
          var queueTarget = item.targetRoom || item.homeRoom || roomName;
          if (queueTarget === targetRoomName) count++;
        }
      }
    }

    return count;
  },

  isOwnedRoom(room) {
    return !!(room && room.controller && room.controller.my);
  },

  getCachedRoomState(room) {
    var cache = room ? utils.getRoomRuntimeCache(room) : null;
    return cache && cache.state ? cache.state : null;
  },

  getRoomDistance(roomA, roomB) {
    if (Game.map && typeof Game.map.getRoomLinearDistance === "function") {
      return Game.map.getRoomLinearDistance(roomA, roomB);
    }

    var parsedA = this.parseRoomName(roomA);
    var parsedB = this.parseRoomName(roomB);
    if (!parsedA || !parsedB) return roomA === roomB ? 0 : 50;

    return Math.max(
      Math.abs(parsedA.x - parsedB.x),
      Math.abs(parsedA.y - parsedB.y),
    );
  },

  parseRoomName(roomName) {
    var match = /^([WE])(\d+)([NS])(\d+)$/.exec(roomName || "");
    if (!match) return null;

    var x = parseInt(match[2], 10);
    var y = parseInt(match[4], 10);

    return {
      x: match[1] === "W" ? -x - 1 : x,
      y: match[3] === "N" ? -y - 1 : y,
    };
  },

  getEmpireDefenseMemory() {
    if (!Memory.empire) Memory.empire = {};
    if (!Memory.empire.defense) Memory.empire.defense = {};
    if (!Memory.empire.defense.support) Memory.empire.defense.support = {};

    return Memory.empire.defense;
  },

  getSupportSummary(roomName, reaction) {
    var memory = this.getEmpireDefenseMemory();
    var entry = memory.support[roomName] || null;
    if (!entry) return null;

    if (Game.time - (entry.lastSeen || 0) > (reaction.SUPPORT_REQUEST_TTL || 75)) {
      delete memory.support[roomName];
      return null;
    }

    return entry;
  },

  getOutgoingSupportSummary(helperRoomName, reaction) {
    var memory = this.getEmpireDefenseMemory();
    var result = [];

    for (var roomName in memory.support) {
      if (!Object.prototype.hasOwnProperty.call(memory.support, roomName)) continue;
      var entry = this.getSupportSummary(roomName, reaction);
      if (!entry || entry.helperRoom !== helperRoomName) continue;
      result.push(entry);
    }

    return result;
  },

  recordSupportRequest(targetRoomName, helperRoomName, threat, coverage) {
    var memory = this.getEmpireDefenseMemory();
    memory.support[targetRoomName] = {
      targetRoom: targetRoomName,
      helperRoom: helperRoomName,
      requested: threat.desiredDefenders || 0,
      assigned: coverage || 0,
      threatLevel: threat.threatLevel || 1,
      threatScore: threat.threatScore || 0,
      lastSeen: Game.time,
      expiresAt: Game.time + ((this.getReactionConfig().SUPPORT_REQUEST_TTL) || 75),
    };
  },

  clearSupportRequest(targetRoomName) {
    var memory = this.getEmpireDefenseMemory();
    delete memory.support[targetRoomName];
  },

  getOwnedRoomThreat(room, state, reaction) {
    var hostiles = utils.getDefenseIntruders(
      room,
      state && state.hostileCreeps ? state.hostileCreeps : null,
      state && state.hostilePowerCreeps ? state.hostilePowerCreeps : null,
      state && state.hostileStructures ? state.hostileStructures : null,
    );
    var classification = hostiles.length > 0 ? "home_invasion" : "clear";
    var activeDefense = this.getActiveDefenseProfile(
      room,
      state,
      hostiles,
      reaction,
    );

    return this.createThreatDescriptor({
      roomName: room.name,
      scope: "home",
      classification: classification,
      priority:
        classification === "home_invasion"
          ? reaction.HOME_INVASION_PRIORITY
          : 0,
      hostiles: hostiles,
      hostileReservation: false,
      desiredDefenders: this.getDesiredDefenderCount(activeDefense, reaction),
      reaction: reaction,
      threatScore: activeDefense.threatScore,
      responseRole: "defender",
      spawnCooldown: reaction.HOME_SPAWN_COOLDOWN,
      visible: true,
      towerTargetId: activeDefense.towerTargetId,
      towerTargetSummary: activeDefense.towerTargetSummary,
      towerFocusDamage: activeDefense.towerFocusDamage,
      towerCanHandle: activeDefense.towerCanHandle,
      activeTowerCount: activeDefense.activeTowerCount,
      readyTowerCount: activeDefense.readyTowerCount,
      responseMode: activeDefense.responseMode,
      breachSeverity: activeDefense.breachSeverity,
      towerEnergyState: activeDefense.towerEnergyState,
      recoveryEligible: activeDefense.recoveryEligible,
      hostileCombatPower: activeDefense.hostileCombatPower,
      hostileHealingPower: activeDefense.hostileHealingPower,
    });
  },

  getDesiredDefenderCount(activeDefense, reaction) {
    if (!activeDefense || !activeDefense.hostiles || activeDefense.hostiles.length === 0) {
      return 0;
    }

    if (
      activeDefense.towerCanHandle &&
      activeDefense.breachSeverity !== "core_breach"
    ) {
      return 0;
    }

    var towerOffset = Math.max(
      0,
      activeDefense.towerFocusDamage - (reaction.TOWER_BREAKTHROUGH_DAMAGE || 50),
    );
    var unhandledCombatPower = Math.max(
      0,
      activeDefense.hostileCombatPower +
        activeDefense.hostileHealingPower -
        towerOffset,
    );
    var desired = Math.max(
      1,
      Math.ceil(unhandledCombatPower / Math.max(1, DEFENDER_RESPONSE_POWER)),
    );

    return Math.min(reaction.MAX_HOME_DEFENDERS || 3, desired);
  },

  getThreatScore(hostiles, reaction) {
    var score = 0;

    for (var i = 0; i < hostiles.length; i++) {
      var hostile = hostiles[i];
      if (!hostile) continue;

      if (hostile.structureType === STRUCTURE_INVADER_CORE) {
        score += reaction.INVADER_CORE_BASE_SCORE || 4;
        score +=
          (typeof hostile.level === "number" ? hostile.level : 0) *
          (reaction.INVADER_CORE_LEVEL_SCORE || 2);
        score += Math.floor(
          (hostile.hits || 0) / Math.max(1, reaction.INVADER_CORE_HITS_STEP || 100000),
        );
        continue;
      }

      score += reaction.HOSTILE_CREEP_BASE_SCORE || 1;
      score += getActiveBodyparts(hostile, ATTACK) * (reaction.ATTACK_PART_SCORE || 1);
      score +=
        getActiveBodyparts(hostile, RANGED_ATTACK) *
        (reaction.RANGED_PART_SCORE || 1);
      score += getActiveBodyparts(hostile, HEAL) * (reaction.HEAL_PART_SCORE || 2);
      score += getActiveBodyparts(hostile, CLAIM) * (reaction.CLAIM_PART_SCORE || 2);
      score += getActiveBodyparts(hostile, WORK) * (reaction.WORK_PART_SCORE || 1);
    }

    return Math.max(score, hostiles.length);
  },

  getHostileThreatValue(hostile, reaction, protectedRange, coreRange) {
    if (!hostile) return 0;

    if (hostile.structureType === STRUCTURE_INVADER_CORE) {
      return (
        (reaction.INVADER_CORE_BASE_SCORE || 4) +
        (typeof hostile.level === "number" ? hostile.level : 0) *
          (reaction.INVADER_CORE_LEVEL_SCORE || 2) +
        Math.floor(
          (hostile.hits || 0) /
            Math.max(1, reaction.INVADER_CORE_HITS_STEP || 100000),
        )
      );
    }

    var score = (
      (reaction.HOSTILE_CREEP_BASE_SCORE || 1) +
      getActiveBodyparts(hostile, ATTACK) * (reaction.ATTACK_PART_SCORE || 1) +
      getActiveBodyparts(hostile, RANGED_ATTACK) *
        (reaction.RANGED_PART_SCORE || 1) +
      getActiveBodyparts(hostile, HEAL) * (reaction.HEAL_PART_SCORE || 2) +
      getActiveBodyparts(hostile, CLAIM) * (reaction.CLAIM_PART_SCORE || 2)
    );

    var workParts = getActiveBodyparts(hostile, WORK);
    if (workParts > 0) {
      if (coreRange <= 6) {
        score += workParts * (reaction.DISMANTLE_CORE_PART_SCORE || 3);
      } else if (protectedRange <= 8) {
        score += workParts * (reaction.DISMANTLE_ASSET_PART_SCORE || 2);
      } else {
        score += workParts * (reaction.WORK_PART_SCORE || 1);
      }
    }

    return score;
  },

  getActiveDefenseProfile(room, state, hostiles, reaction) {
    var towers = this.getTowers(room, state);
    var readyTowers = _.filter(towers, function (tower) {
      return getStoredEnergy(tower) > 0;
    });
    var targetProfiles = this.getTowerTargetProfiles(
      room,
      state,
      hostiles,
      readyTowers,
      reaction,
    );
    var focusProfile = targetProfiles.length > 0 ? targetProfiles[0] : null;
    var threatScore = targetProfiles.reduce(function (total, profile) {
      return total + (profile.dangerScore || 0);
    }, 0);
    if (hostiles && hostiles.length > 0) {
      threatScore = Math.max(threatScore, hostiles.length);
    }
    var hostileCombatPower = this.getHostileCombatPower(targetProfiles);
    var hostileHealingPower = this.getHostileHealingPower(hostiles);
    var dangerousTargets = _.filter(targetProfiles, function (profile) {
      return profile.dangerScore > 0;
    });
    var activeTowerCount = towers.length;
    var readyTowerCount = readyTowers.length;
    var towerEnergyState = this.getTowerEnergyState(
      towers,
      readyTowers,
    );
    var breachSeverity = this.getBreachSeverity(
      targetProfiles,
      reaction,
    );
    var towerCanHandle = !!(
      focusProfile &&
      readyTowerCount > 0 &&
      focusProfile.netFocusDamage >= (reaction.TOWER_BREAKTHROUGH_DAMAGE || 50) &&
      (
        dangerousTargets.length <= readyTowerCount ||
        threatScore <=
          readyTowerCount * (reaction.TOWER_SCORE_PER_ACTIVE_TOWER || 6)
      )
    );
    var responseMode = "idle";

    if (hostiles && hostiles.length > 0) {
      responseMode = breachSeverity === "core_breach"
        ? "core_breach"
        : towerCanHandle
          ? "tower_only"
          : readyTowerCount > 0
            ? "tower_support"
            : "creep_only";
    }

    return {
      hostiles: hostiles || [],
      activeTowerCount: activeTowerCount,
      readyTowerCount: readyTowerCount,
      towerTargetId: focusProfile ? focusProfile.id : null,
      towerTargetSummary: focusProfile ? this.getTargetSummary(focusProfile) : null,
      towerFocusDamage: focusProfile ? Math.max(0, Math.round(focusProfile.netFocusDamage)) : 0,
      towerCanHandle: towerCanHandle,
      responseMode: responseMode,
      breachSeverity: breachSeverity,
      towerEnergyState: towerEnergyState,
      recoveryEligible: breachSeverity === "interior_pressure" || breachSeverity === "core_breach",
      hostileCombatPower: hostileCombatPower,
      hostileHealingPower: hostileHealingPower,
      threatScore: threatScore,
      targetProfiles: targetProfiles,
    };
  },

  getTowerTargetProfiles(room, state, hostiles, towers, reaction) {
    if (!hostiles || hostiles.length === 0) return [];

    var protectedPositions = this.getProtectedPositions(room, state, towers);
    var coreProtectedPositions = this.getCoreProtectedPositions(room, state, towers);
    var defenders =
      state && state.roleMap && state.roleMap.defender
        ? state.roleMap.defender
        : [];
    var profiles = [];

    for (var i = 0; i < hostiles.length; i++) {
      var hostile = hostiles[i];
      if (!hostile || !hostile.pos) continue;

      var healing = this.getHostileHealingAtTarget(hostile, hostiles);
      var towerDamage = this.getTowerDamageAtPos(hostile.pos, towers);
      var defenderSupport = this.getFriendlyDefenseDamageAtTarget(hostile, defenders);
      var protectedRange = this.getNearestProtectedRange(
        hostile.pos,
        protectedPositions,
      );
      var coreRange = this.getNearestProtectedRange(
        hostile.pos,
        coreProtectedPositions,
      );
      var isEdgeTarget = this.isEdgeTarget(hostile.pos, reaction.EDGE_BUFFER || 2);
      var healParts = getActiveBodyparts(hostile, HEAL);
      var claimParts = getActiveBodyparts(hostile, CLAIM);
      var workParts = getActiveBodyparts(hostile, WORK);
      var dangerScore = this.getHostileThreatValue(
        hostile,
        reaction,
        protectedRange,
        coreRange,
      );
      var netFocusDamage = towerDamage + defenderSupport - healing;
      var score =
        dangerScore * 25 +
        Math.max(0, 20 - Math.min(20, protectedRange)) * 12 +
        Math.max(0, netFocusDamage) +
        (healParts > 0 ? 120 : 0) +
        (claimParts > 0 ? 90 : 0) +
        (workParts > 0 && coreRange <= 6 ? 160 : 0);

      if (netFocusDamage >= (reaction.TOWER_BREAKTHROUGH_DAMAGE || 50)) {
        score += 180;
      } else if (netFocusDamage > 0) {
        score += 60;
      }

      if (isEdgeTarget && netFocusDamage < (reaction.TOWER_BREAKTHROUGH_DAMAGE || 50)) {
        score -= 140;
      }

      profiles.push({
        id: hostile.id || null,
        hostile: hostile,
        score: score,
        dangerScore: dangerScore,
        healing: healing,
        towerDamage: towerDamage,
        defenderSupport: defenderSupport,
        netFocusDamage: netFocusDamage,
        protectedRange: protectedRange,
        coreRange: coreRange,
        isEdgeTarget: isEdgeTarget,
      });
    }

    profiles.sort(function (a, b) {
      if (a.score !== b.score) return b.score - a.score;
      if (a.netFocusDamage !== b.netFocusDamage) {
        return b.netFocusDamage - a.netFocusDamage;
      }
      if (a.protectedRange !== b.protectedRange) {
        return a.protectedRange - b.protectedRange;
      }
      return 0;
    });

    return profiles;
  },

  getProtectedPositions(room, state, towers) {
    var positions = [];
    var pushPos = function (pos) {
      if (!pos) return;
      positions.push(pos);
    };
    var spawns = state && state.spawns ? state.spawns : room.find(FIND_MY_SPAWNS);
    var sources = state && state.sources ? state.sources : room.find(FIND_SOURCES);

    for (var i = 0; i < spawns.length; i++) {
      pushPos(spawns[i].pos);
    }
    for (var j = 0; j < sources.length; j++) {
      pushPos(sources[j].pos);
    }
    for (var k = 0; k < towers.length; k++) {
      pushPos(towers[k].pos);
    }

    if (room.controller) pushPos(room.controller.pos);
    if (room.storage) pushPos(room.storage.pos);
    if (state && state.hubContainer) pushPos(state.hubContainer.pos);
    if (state && state.controllerContainer) pushPos(state.controllerContainer.pos);

    return positions;
  },

  getCoreProtectedPositions(room, state, towers) {
    var positions = [];
    var pushPos = function (pos) {
      if (!pos) return;
      positions.push(pos);
    };
    var spawns = state && state.spawns ? state.spawns : room.find(FIND_MY_SPAWNS);

    for (var i = 0; i < spawns.length; i++) {
      pushPos(spawns[i].pos);
    }
    for (var j = 0; j < towers.length; j++) {
      pushPos(towers[j].pos);
    }

    if (room.storage) pushPos(room.storage.pos);

    return positions;
  },

  getNearestProtectedRange(pos, protectedPositions) {
    if (!protectedPositions || protectedPositions.length === 0) return 25;

    var best = 25;
    for (var i = 0; i < protectedPositions.length; i++) {
      var range = pos.getRangeTo(protectedPositions[i]);
      if (range < best) {
        best = range;
      }
    }

    return best;
  },

  isEdgeTarget(pos, edgeBuffer) {
    if (!pos) return false;

    return (
      pos.x <= edgeBuffer ||
      pos.y <= edgeBuffer ||
      pos.x >= 49 - edgeBuffer ||
      pos.y >= 49 - edgeBuffer
    );
  },

  getTowers(room, state) {
    if (
      state &&
      state.structuresByType &&
      state.structuresByType[STRUCTURE_TOWER]
    ) {
      return state.structuresByType[STRUCTURE_TOWER];
    }

    return room.find(FIND_MY_STRUCTURES, {
      filter: function (structure) {
        return structure.structureType === STRUCTURE_TOWER;
      },
    });
  },

  getSingleTowerDamage(range) {
    if (range <= TOWER_OPTIMAL_RANGE_VALUE) {
      return TOWER_POWER_ATTACK_VALUE;
    }

    range = Math.min(range, TOWER_FALLOFF_RANGE_VALUE);

    var falloff =
      (range - TOWER_OPTIMAL_RANGE_VALUE) /
      (TOWER_FALLOFF_RANGE_VALUE - TOWER_OPTIMAL_RANGE_VALUE);

    return TOWER_POWER_ATTACK_VALUE * (1 - TOWER_FALLOFF_VALUE * falloff);
  },

  getTowerDamageAtPos(pos, towers) {
    var damage = 0;

    for (var i = 0; i < towers.length; i++) {
      if (getStoredEnergy(towers[i]) <= 0) continue;
      damage += this.getSingleTowerDamage(pos.getRangeTo(towers[i]));
    }

    return damage;
  },

  getHostileHealingAtTarget(target, hostiles) {
    var healing = 0;

    for (var i = 0; i < hostiles.length; i++) {
      var hostile = hostiles[i];
      if (!hostile || !hostile.pos) continue;

      var healParts = getActiveBodyparts(hostile, HEAL);
      if (healParts <= 0) continue;

      var range = hostile.pos.getRangeTo(target.pos);
      if (range <= 1) {
        healing += healParts * HEAL_POWER_VALUE;
      } else if (range <= 3) {
        healing += healParts * RANGED_HEAL_POWER_VALUE;
      }
    }

    return healing;
  },

  getFriendlyDefenseDamageAtTarget(target, defenders) {
    var damage = 0;

    for (var i = 0; i < defenders.length; i++) {
      var defender = defenders[i];
      if (!defender || !defender.pos) continue;
      if (defender.pos.roomName !== target.pos.roomName) continue;

      var range = defender.pos.getRangeTo(target.pos);
      var attackParts = getActiveBodyparts(defender, ATTACK);
      var rangedParts = getActiveBodyparts(defender, RANGED_ATTACK);

      if (range <= 1) {
        damage += attackParts * ATTACK_POWER_VALUE;
      }
      if (range <= 3) {
        damage += rangedParts * RANGED_ATTACK_POWER_VALUE;
      }
    }

    return damage;
  },

  getHostileCombatPower(hostiles) {
    var power = 0;

    for (var i = 0; i < hostiles.length; i++) {
      var profile = hostiles[i];
      var hostile = profile && profile.hostile ? profile.hostile : profile;
      if (!hostile) continue;

      if (hostile.structureType === STRUCTURE_INVADER_CORE) {
        power += 150;
        continue;
      }

      power += getActiveBodyparts(hostile, ATTACK) * ATTACK_POWER_VALUE;
      power += getActiveBodyparts(hostile, RANGED_ATTACK) * RANGED_ATTACK_POWER_VALUE;
      power += getActiveBodyparts(hostile, CLAIM) * 40;
      power += this.getDismantlePower(
        hostile,
        profile && typeof profile.protectedRange === "number" ? profile.protectedRange : 50,
        profile && typeof profile.coreRange === "number" ? profile.coreRange : 50,
      );
    }

    return power;
  },

  getDismantlePower(hostile, protectedRange, coreRange) {
    var workParts = getActiveBodyparts(hostile, WORK);
    if (workParts <= 0) return 0;
    if (coreRange <= 6) return workParts * 30;
    if (protectedRange <= 8) return workParts * 20;
    return workParts * 10;
  },

  getHostileHealingPower(hostiles) {
    var healing = 0;

    for (var i = 0; i < hostiles.length; i++) {
      healing += getActiveBodyparts(hostiles[i], HEAL) * HEAL_POWER_VALUE;
    }

    return healing;
  },

  getTargetSummary(profile) {
    if (!profile || !profile.hostile) return null;

    var hostile = profile.hostile;
    var label = hostile.structureType || "creep";

    if (getActiveBodyparts(hostile, HEAL) > 0) {
      label = "healer";
    } else if (getActiveBodyparts(hostile, CLAIM) > 0) {
      label = "claimer";
    } else if (getActiveBodyparts(hostile, RANGED_ATTACK) > 0) {
      label = "ranged";
    } else if (getActiveBodyparts(hostile, ATTACK) > 0) {
      label = "melee";
    }

    return (
      label +
      " " +
      hostile.pos.x +
      "," +
      hostile.pos.y +
      " net " +
      Math.max(0, Math.round(profile.netFocusDamage))
    );
  },

  createThreatDescriptor(options) {
    var hostiles = options.hostiles || [];
    var hostileCount = hostiles.length;
    var threatScore =
      typeof options.threatScore === "number"
        ? options.threatScore
        : this.getThreatScore(hostiles, options.reaction || {});
    var threatLevel = 1;

    if (threatScore >= 12) threatLevel = 3;
    else if (threatScore >= 6) threatLevel = 2;

    return {
      roomName: options.roomName,
      scope: options.scope,
      classification: options.classification,
      type: options.classification,
      priority: options.priority || 0,
      hostiles: hostiles,
      hostileCount: hostileCount,
      hostileReservation: !!options.hostileReservation,
      active: options.classification !== "clear",
      desiredDefenders: options.desiredDefenders || 0,
      threatScore: threatScore,
      threatLevel: threatLevel,
      responseRole: options.responseRole || "defender",
      spawnCooldown: options.spawnCooldown || 0,
      visible: options.visible !== false,
      towerTargetId: options.towerTargetId || null,
      towerTargetSummary: options.towerTargetSummary || null,
      towerFocusDamage: options.towerFocusDamage || 0,
      towerCanHandle: !!options.towerCanHandle,
      activeTowerCount: options.activeTowerCount || 0,
      readyTowerCount: options.readyTowerCount || 0,
      responseMode: options.responseMode || "idle",
      breachSeverity: options.breachSeverity || "clear",
      towerEnergyState: options.towerEnergyState || "empty",
      recoveryEligible: !!options.recoveryEligible,
      hostileCombatPower: options.hostileCombatPower || 0,
      hostileHealingPower: options.hostileHealingPower || 0,
    };
  },

  getTowerEnergyState(towers, readyTowers) {
    if (!towers || towers.length === 0) return "empty";

    var reserveThreshold =
      config.LOGISTICS && typeof config.LOGISTICS.towerReserveThreshold === "number"
        ? config.LOGISTICS.towerReserveThreshold
        : 700;
    var reserveReady = _.filter(towers, function (tower) {
      return getStoredEnergy(tower) >= reserveThreshold;
    }).length;

    if (
      readyTowers &&
      readyTowers.length > 0 &&
      reserveReady >= Math.ceil(towers.length / 2)
    ) {
      return "ready";
    }

    return readyTowers && readyTowers.length > 0 ? "low" : "empty";
  },

  getBreachSeverity(targetProfiles) {
    if (!targetProfiles || targetProfiles.length === 0) return "clear";

    for (var i = 0; i < targetProfiles.length; i++) {
      var profile = targetProfiles[i];
      var hostile = profile.hostile;
      if (!hostile) continue;

      if (
        profile.coreRange <= 4 ||
        (getActiveBodyparts(hostile, WORK) > 0 && profile.coreRange <= 6)
      ) {
        return "core_breach";
      }
    }

    for (var j = 0; j < targetProfiles.length; j++) {
      if (
        !targetProfiles[j].isEdgeTarget &&
        targetProfiles[j].protectedRange <= 8
      ) {
        return "interior_pressure";
      }
    }

    return "edge_pressure";
  },

  getRoomDefenseMemory(room) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].defense) Memory.rooms[room.name].defense = {};
    return Memory.rooms[room.name].defense;
  },

  getStoredRecoveryState(room) {
    var memory = this.getRoomDefenseMemory(room);
    var recovery = memory.recovery || {};
    return {
      active: !!recovery.active,
      reason: recovery.reason || null,
      startedAt: recovery.startedAt || null,
      exitWhenReady: !!recovery.exitWhenReady,
    };
  },

  updateRecoveryState(room, state, homeThreat, reaction) {
    var memory = this.getRoomDefenseMemory(room);
    if (!memory.recovery) {
      memory.recovery = {
        active: false,
        eligible: false,
        reason: null,
        startedAt: null,
        exitWhenReady: false,
        lastThreatSeen: null,
      };
    }

    var recovery = memory.recovery;
    var severeThreat = !!(
      homeThreat &&
      homeThreat.active &&
      (
        homeThreat.breachSeverity === "interior_pressure" ||
        homeThreat.breachSeverity === "core_breach"
      )
    );

    if (homeThreat && homeThreat.active) {
      recovery.lastThreatSeen = Game.time;
      if (severeThreat || homeThreat.recoveryEligible) {
        recovery.eligible = true;
      }
      recovery.active = false;
      recovery.reason = null;
      recovery.startedAt = null;
      recovery.exitWhenReady = false;
    } else if (recovery.eligible) {
      if (!recovery.active) {
        recovery.active = true;
        recovery.reason = "post_attack";
        recovery.startedAt = Game.time;
        recovery.exitWhenReady = true;
      }

      if (this.shouldExitRecovery(room, state, recovery, reaction)) {
        recovery.active = false;
        recovery.eligible = false;
        recovery.reason = null;
        recovery.startedAt = null;
        recovery.exitWhenReady = false;
      }
    }

    return {
      active: !!recovery.active,
      reason: recovery.reason || null,
      startedAt: recovery.startedAt || null,
      exitWhenReady: !!recovery.exitWhenReady,
    };
  },

  shouldExitRecovery(room, state, recovery, reaction) {
    var cooldown =
      reaction && typeof reaction.RECOVERY_COOLDOWN_TICKS === "number"
        ? reaction.RECOVERY_COOLDOWN_TICKS
        : 15;
    var lastThreatSeen =
      typeof recovery.lastThreatSeen === "number" ? recovery.lastThreatSeen : Game.time;
    if (Game.time - lastThreatSeen < cooldown) return false;
    if (room.energyAvailable !== room.energyCapacityAvailable) return false;
    if (this.hasQueuedDefenseRequests(room.name)) return false;

    var towers = this.getTowers(room, state);
    if (towers.length <= 0) return true;

    var emergencyThreshold =
      config.LOGISTICS && typeof config.LOGISTICS.towerEmergencyThreshold === "number"
        ? config.LOGISTICS.towerEmergencyThreshold
        : 400;
    var reserveThreshold =
      config.LOGISTICS && typeof config.LOGISTICS.towerReserveThreshold === "number"
        ? config.LOGISTICS.towerReserveThreshold
        : 700;
    var emergencyReady = _.some(towers, function (tower) {
      return getStoredEnergy(tower) >= emergencyThreshold;
    });
    if (!emergencyReady) return false;

    var reserveReady = _.filter(towers, function (tower) {
      return getStoredEnergy(tower) >= reserveThreshold;
    }).length;
    return reserveReady >= Math.ceil(towers.length / 2);
  },

  hasQueuedDefenseRequests(roomName) {
    var queue =
      Memory.rooms &&
      Memory.rooms[roomName] &&
      Memory.rooms[roomName].spawnQueue
        ? Memory.rooms[roomName].spawnQueue
        : [];

    for (var i = 0; i < queue.length; i++) {
      var item = queue[i];
      if (!item || item.role !== "defender") continue;
      var targetRoom = item.targetRoom || item.homeRoom || roomName;
      if (targetRoom === roomName) return true;
    }

    return false;
  },

  getThreatByRoom(defenseState, roomName) {
    if (!defenseState || !defenseState.activeThreats) return null;

    for (var i = 0; i < defenseState.activeThreats.length; i++) {
      if (defenseState.activeThreats[i].roomName === roomName) {
        return defenseState.activeThreats[i];
      }
    }

    return null;
  },
};
