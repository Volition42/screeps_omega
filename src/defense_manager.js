/*
Developer Summary:
Reactive home-room defense escalation planner.

Purpose:
- Evaluate immediate hostile pressure in owned rooms
- Translate visible home threats into simple defender demand for spawning
- Keep the first defense pass narrow, reactive, and CPU-cheap

Important Notes:
- This planner is home-room only
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
      };
    }

    var homeThreat = this.getOwnedRoomThreat(room, state, reaction);
    var activeThreats = homeThreat.active ? [homeThreat] : [];

    return {
      enabled: reaction.ENABLED,
      homeThreat: homeThreat,
      activeThreats: activeThreats,
      hasThreats: activeThreats.length > 0,
      requiredDefenders: homeThreat.desiredDefenders || 0,
      threatenedRooms: activeThreats.length > 0 ? [room.name] : [],
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
      INVADER_CORE_BASE_SCORE: 4,
      INVADER_CORE_LEVEL_SCORE: 2,
      INVADER_CORE_HITS_STEP: 100000,
      THREAT_MEMORY_TTL: 25,
      TOWER_BREAKTHROUGH_DAMAGE: 50,
      TOWER_SCORE_PER_ACTIVE_TOWER: 6,
      EDGE_BUFFER: 2,
    };

    return Object.assign(defaults, config.DEFENSE && config.DEFENSE.REACTION);
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
      hostileCombatPower: activeDefense.hostileCombatPower,
      hostileHealingPower: activeDefense.hostileHealingPower,
    });
  },

  getDesiredDefenderCount(activeDefense, reaction) {
    if (!activeDefense || !activeDefense.hostiles || activeDefense.hostiles.length === 0) {
      return 0;
    }

    if (activeDefense.towerCanHandle) {
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
    }

    return Math.max(score, hostiles.length);
  },

  getHostileThreatValue(hostile, reaction) {
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

    return (
      (reaction.HOSTILE_CREEP_BASE_SCORE || 1) +
      getActiveBodyparts(hostile, ATTACK) * (reaction.ATTACK_PART_SCORE || 1) +
      getActiveBodyparts(hostile, RANGED_ATTACK) *
        (reaction.RANGED_PART_SCORE || 1) +
      getActiveBodyparts(hostile, HEAL) * (reaction.HEAL_PART_SCORE || 2) +
      getActiveBodyparts(hostile, CLAIM) * (reaction.CLAIM_PART_SCORE || 2)
    );
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
    var threatScore = this.getThreatScore(hostiles, reaction);
    var hostileCombatPower = this.getHostileCombatPower(hostiles);
    var hostileHealingPower = this.getHostileHealingPower(hostiles);
    var dangerousTargets = _.filter(targetProfiles, function (profile) {
      return profile.dangerScore > 0;
    });
    var activeTowerCount = towers.length;
    var readyTowerCount = readyTowers.length;
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
      responseMode = towerCanHandle
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
      hostileCombatPower: hostileCombatPower,
      hostileHealingPower: hostileHealingPower,
      threatScore: threatScore,
      targetProfiles: targetProfiles,
    };
  },

  getTowerTargetProfiles(room, state, hostiles, towers, reaction) {
    if (!hostiles || hostiles.length === 0) return [];

    var protectedPositions = this.getProtectedPositions(room, state, towers);
    var defenders =
      state && state.roleMap && state.roleMap.defender
        ? state.roleMap.defender
        : [];
    var profiles = [];

    for (var i = 0; i < hostiles.length; i++) {
      var hostile = hostiles[i];
      if (!hostile || !hostile.pos) continue;

      var dangerScore = this.getHostileThreatValue(hostile, reaction);
      var healing = this.getHostileHealingAtTarget(hostile, hostiles);
      var towerDamage = this.getTowerDamageAtPos(hostile.pos, towers);
      var defenderSupport = this.getFriendlyDefenseDamageAtTarget(hostile, defenders);
      var protectedRange = this.getNearestProtectedRange(
        hostile.pos,
        protectedPositions,
      );
      var isEdgeTarget = this.isEdgeTarget(hostile.pos, reaction.EDGE_BUFFER || 2);
      var healParts = getActiveBodyparts(hostile, HEAL);
      var claimParts = getActiveBodyparts(hostile, CLAIM);
      var netFocusDamage = towerDamage + defenderSupport - healing;
      var score =
        dangerScore * 25 +
        Math.max(0, 20 - Math.min(20, protectedRange)) * 12 +
        Math.max(0, netFocusDamage) +
        (healParts > 0 ? 120 : 0) +
        (claimParts > 0 ? 90 : 0);

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
      var hostile = hostiles[i];
      if (!hostile) continue;

      if (hostile.structureType === STRUCTURE_INVADER_CORE) {
        power += 150;
        continue;
      }

      power += getActiveBodyparts(hostile, ATTACK) * ATTACK_POWER_VALUE;
      power += getActiveBodyparts(hostile, RANGED_ATTACK) * RANGED_ATTACK_POWER_VALUE;
      power += getActiveBodyparts(hostile, CLAIM) * 40;
    }

    return power;
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
    var threatScore = this.getThreatScore(hostiles, options.reaction || {});
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
      hostileCombatPower: options.hostileCombatPower || 0,
      hostileHealingPower: options.hostileHealingPower || 0,
    };
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
