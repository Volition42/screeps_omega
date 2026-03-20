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

function getActiveBodyparts(target, partType) {
  if (!target || typeof target.getActiveBodyparts !== "function") {
    return 0;
  }

  return target.getActiveBodyparts(partType);
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
    };

    return Object.assign(defaults, config.DEFENSE && config.DEFENSE.REACTION);
  },

  getOwnedRoomThreat(room, state, reaction) {
    var hostiles = utils.getDefenseIntruders(
      room,
      state && state.hostileCreeps ? state.hostileCreeps : null,
      typeof FIND_HOSTILE_POWER_CREEPS !== "undefined"
        ? room.find(FIND_HOSTILE_POWER_CREEPS)
        : [],
      typeof FIND_HOSTILE_STRUCTURES !== "undefined"
        ? room.find(FIND_HOSTILE_STRUCTURES)
        : [],
    );
    var classification = hostiles.length > 0 ? "home_invasion" : "clear";

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
      desiredDefenders: this.getDesiredDefenderCount(hostiles, reaction),
      reaction: reaction,
      responseRole: "defender",
      spawnCooldown: reaction.HOME_SPAWN_COOLDOWN,
      visible: true,
    });
  },

  getDesiredDefenderCount(hostiles, reaction) {
    if (!hostiles || hostiles.length === 0) {
      return 0;
    }

    var threatScore = this.getThreatScore(hostiles, reaction);
    var scorePerDefender = Math.max(1, reaction.SCORE_PER_HOME_DEFENDER || 6);
    var desired = Math.ceil(threatScore / scorePerDefender);

    return Math.min(reaction.MAX_HOME_DEFENDERS || 3, Math.max(1, desired));
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
