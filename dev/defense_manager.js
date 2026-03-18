/*
Developer Summary:
Reactive defense escalation planner.

Purpose:
- Evaluate immediate hostile pressure in owned rooms
- Evaluate immediate hostile pressure in active configured remote rooms
- Translate visible threats into simple defender demand for spawning

Important Notes:
- This pass is intentionally narrow and defensive only
- Remote escalation reacts to visible hostiles plus hostile reservation / claim
  pressure on active remote rooms
- Defender demand stays capped to avoid broad combat overreach
*/

const config = require("config");
const remoteManager = require("remote_manager");
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
        remoteThreats: [],
        activeThreats: [],
        hasThreats: false,
        requiredDefenders: 0,
        threatenedRooms: [],
      };
    }

    var sites =
      state && state.remoteSites
        ? state.remoteSites
        : remoteManager.getHomeRoomSites(room.name, state);
    var homeThreat = this.getOwnedRoomThreat(room, state, reaction);
    var remoteThreats = reaction.REMOTE_ENABLED
      ? this.getRemoteThreats(room, state, sites, reaction)
      : [];
    var activeThreats = [];

    if (homeThreat.active) {
      activeThreats.push(homeThreat);
    }

    for (var i = 0; i < remoteThreats.length; i++) {
      if (remoteThreats[i].active) {
        activeThreats.push(remoteThreats[i]);
      }
    }

    activeThreats.sort(function (a, b) {
      if (a.priority !== b.priority) {
        return b.priority - a.priority;
      }

      if (a.hostileCount !== b.hostileCount) {
        return b.hostileCount - a.hostileCount;
      }

      if (a.threatScore !== b.threatScore) {
        return b.threatScore - a.threatScore;
      }

      return a.roomName.localeCompare(b.roomName);
    });

    return {
      enabled: reaction.ENABLED,
      homeThreat: homeThreat,
      remoteThreats: remoteThreats,
      activeThreats: activeThreats,
      hasThreats: activeThreats.length > 0,
      requiredDefenders: _.sum(
        _.map(activeThreats, function (threat) {
          return threat.desiredDefenders || 0;
        }),
      ),
      threatenedRooms: _.map(activeThreats, function (threat) {
        return threat.roomName;
      }),
    };
  },

  getReactionConfig() {
    var defaults = {
      ENABLED: true,
      REMOTE_ENABLED: true,
      MAX_DEFENDERS_PER_ROOM: 4,
      HOME_SPAWN_PRIORITY: 1100,
      REMOTE_HOSTILE_PRIORITY: 95,
      REMOTE_STRUCTURE_PRIORITY: 100,
      REMOTE_RESERVATION_PRIORITY: 85,
      REPLACE_TTL: 90,
      SCORE_PER_DEFENDER: 5,
      HOSTILE_CREEP_BASE_SCORE: 1,
      ATTACK_PART_SCORE: 1,
      RANGED_PART_SCORE: 1,
      HEAL_PART_SCORE: 2,
      CLAIM_PART_SCORE: 2,
      INVADER_CORE_BASE_SCORE: 4,
      INVADER_CORE_LEVEL_SCORE: 2,
      INVADER_CORE_HITS_STEP: 100000,
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

    return this.createThreatDescriptor({
      roomName: room.name,
      scope: "home",
      type: "hostiles",
      priority: reaction.HOME_SPAWN_PRIORITY,
      hostiles: hostiles,
      hostileReservation: false,
      desiredDefenders: this.getDesiredDefenderCount(
        hostiles,
        false,
        reaction,
      ),
      reaction: reaction,
      visible: true,
    });
  },

  getRemoteThreats(homeRoom, state, sites, reaction) {
    var threats = [];

    for (var i = 0; i < sites.length; i++) {
      var site = sites[i];

      if (!this.isActiveRemoteSite(site)) continue;

      threats.push(this.getRemoteThreat(homeRoom, state, site, reaction));
    }

    return threats;
  },

  isActiveRemoteSite(site) {
    if (!site || site.enabled === false) return false;
    if (!site.phaseHooks || site.phaseHooks.phaseOneReady !== true) return false;

    return (
      (site.jrWorkers || 0) > 0 ||
      (site.remoteWorkers || 0) > 0 ||
      (site.reservation && site.reservation.enabled === true) ||
      (site.assignedRoleCounts &&
        (site.assignedRoleCounts.remotejrworker > 0 ||
          site.assignedRoleCounts.remoteworker > 0 ||
          site.assignedRoleCounts.remoteminer > 0 ||
          site.assignedRoleCounts.remotehauler > 0 ||
          site.assignedRoleCounts.reserver > 0))
    );
  },

  getRemoteThreat(homeRoom, state, site, reaction) {
    var remoteRoom = site.remoteRoom || Game.rooms[site.targetRoom] || null;
    var hostiles = remoteRoom
      ? utils.getDefenseIntruders(
          remoteRoom,
          remoteRoom.find(FIND_HOSTILE_CREEPS),
          typeof FIND_HOSTILE_POWER_CREEPS !== "undefined"
            ? remoteRoom.find(FIND_HOSTILE_POWER_CREEPS)
            : [],
          typeof FIND_HOSTILE_STRUCTURES !== "undefined"
            ? remoteRoom.find(FIND_HOSTILE_STRUCTURES)
            : [],
        )
      : [];
    var hostileReservation = this.hasHostileReservation(site, remoteRoom, homeRoom);
    var claimPressure = this.hasClaimPressure(hostiles);
    var structureThreat = this.hasStructureThreat(hostiles);
    var type = hostileReservation && hostiles.length === 0 ? "reservation" : "hostiles";
    var priority =
      structureThreat
        ? reaction.REMOTE_STRUCTURE_PRIORITY
        : hostiles.length > 0 || claimPressure
        ? reaction.REMOTE_HOSTILE_PRIORITY
        : reaction.REMOTE_RESERVATION_PRIORITY;

    return this.createThreatDescriptor({
      roomName: site.targetRoom,
      scope: "remote",
      type: type,
      priority: priority,
      hostiles: hostiles,
      hostileReservation: hostileReservation,
      reaction: reaction,
      desiredDefenders: this.getDesiredDefenderCount(
        hostiles,
        hostileReservation,
        reaction,
      ),
      visible: !!remoteRoom,
    });
  },

  hasStructureThreat(hostiles) {
    for (var i = 0; i < hostiles.length; i++) {
      if (hostiles[i] && hostiles[i].structureType) {
        return true;
      }
    }

    return false;
  },

  hasHostileReservation(site, remoteRoom, homeRoom) {
    if (remoteRoom && remoteRoom.controller && remoteRoom.controller.reservation) {
      var reservation = remoteRoom.controller.reservation;
      var myUsername = this.getMyUsername(homeRoom);

      return !!myUsername && reservation.username !== myUsername;
    }

    return !!(
      site &&
      site.reservationStatus &&
      site.reservationStatus.status === "other"
    );
  },

  hasClaimPressure(hostiles) {
    for (var i = 0; i < hostiles.length; i++) {
      if (getActiveBodyparts(hostiles[i], CLAIM) > 0) {
        return true;
      }
    }

    return false;
  },

  getDesiredDefenderCount(hostiles, hostileReservation, reaction) {
    if (!hostiles || hostiles.length === 0) {
      return hostileReservation ? 1 : 0;
    }

    var threatScore = this.getThreatScore(hostiles, hostileReservation, reaction);
    var scorePerDefender = Math.max(1, reaction.SCORE_PER_DEFENDER || 5);
    var desired = Math.ceil(threatScore / scorePerDefender);

    return Math.min(reaction.MAX_DEFENDERS_PER_ROOM || 4, Math.max(1, desired));
  },

  getThreatScore(hostiles, hostileReservation, reaction) {
    var score = hostileReservation ? 2 : 0;

    for (var i = 0; i < hostiles.length; i++) {
      score += this.getTargetThreatScore(hostiles[i], reaction);
    }

    return Math.max(score, hostiles.length > 0 ? 1 : 0);
  },

  getTargetThreatScore(target, reaction) {
    if (!target) return 0;

    if (target.structureType === STRUCTURE_INVADER_CORE) {
      return this.getInvaderCoreThreatScore(target, reaction);
    }

    if (typeof target.getActiveBodyparts === "function") {
      return (
        (reaction.HOSTILE_CREEP_BASE_SCORE || 1) +
        getActiveBodyparts(target, ATTACK) * (reaction.ATTACK_PART_SCORE || 1) +
        getActiveBodyparts(target, RANGED_ATTACK) *
          (reaction.RANGED_PART_SCORE || 1) +
        getActiveBodyparts(target, HEAL) * (reaction.HEAL_PART_SCORE || 2) +
        getActiveBodyparts(target, CLAIM) * (reaction.CLAIM_PART_SCORE || 2)
      );
    }

    return 1;
  },

  getInvaderCoreThreatScore(target, reaction) {
    var score = reaction.INVADER_CORE_BASE_SCORE || 4;
    var level = typeof target.level === "number" ? target.level : 0;
    var hitsStep = Math.max(1, reaction.INVADER_CORE_HITS_STEP || 100000);
    var hitsScore =
      typeof target.hits === "number" && target.hits > 0
        ? Math.max(0, Math.ceil(target.hits / hitsStep) - 1)
        : 0;

    score += level * (reaction.INVADER_CORE_LEVEL_SCORE || 2);
    score += hitsScore;

    return score;
  },

  createThreatDescriptor(details) {
    var hostiles = details.hostiles || [];
    var combatParts = 0;
    var claimParts = 0;
    var structureCount = 0;
    var threatScore = this.getThreatScore(
      hostiles,
      details.hostileReservation === true,
      details.reaction || this.getReactionConfig(),
    );

    for (var i = 0; i < hostiles.length; i++) {
      combatParts += getActiveBodyparts(hostiles[i], ATTACK);
      combatParts += getActiveBodyparts(hostiles[i], RANGED_ATTACK);
      claimParts += getActiveBodyparts(hostiles[i], CLAIM);
      if (hostiles[i] && hostiles[i].structureType) {
        structureCount++;
      }
    }

    var active =
      hostiles.length > 0 ||
      details.hostileReservation === true ||
      claimParts > 0;

    return {
      roomName: details.roomName,
      scope: details.scope,
      type: details.type,
      priority: details.priority,
      active: active,
      visible: details.visible === true,
      hostiles: hostiles,
      hostileCount: hostiles.length,
      structureCount: structureCount,
      combatParts: combatParts,
      claimParts: claimParts,
      threatScore: threatScore,
      threatLevel: active
        ? Math.min(
            4,
            Math.max(
              1,
              details.desiredDefenders || 0,
              Math.ceil(
                threatScore /
                  Math.max(
                    1,
                    (details.reaction || this.getReactionConfig()).SCORE_PER_DEFENDER ||
                      5,
                  ),
              ),
            ),
          )
        : 0,
      hostileReservation: details.hostileReservation === true,
      desiredDefenders: active ? details.desiredDefenders || 1 : 0,
      label: this.getThreatLabel(details.scope, hostiles.length, details.hostileReservation),
    };
  },

  getThreatLabel(scope, hostileCount, hostileReservation) {
    if (hostileCount > 0 && hostileReservation) {
      return scope === "home" ? "HOME HOSTILES" : "REMOTE HOSTILES+RES";
    }

    if (hostileCount > 0) {
      return scope === "home" ? "HOME HOSTILES" : "REMOTE HOSTILES";
    }

    if (hostileReservation) {
      return "REMOTE RESERVATION";
    }

    return "CLEAR";
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

  getPreferredThreat(defenseState, preferredRoom) {
    var preferredThreat = this.getThreatByRoom(defenseState, preferredRoom);

    if (preferredThreat) {
      return preferredThreat;
    }

    if (
      !defenseState ||
      !defenseState.activeThreats ||
      defenseState.activeThreats.length === 0
    ) {
      return null;
    }

    return defenseState.activeThreats[0];
  },

  getMyUsername(room) {
    if (
      room &&
      room.controller &&
      room.controller.my &&
      room.controller.owner &&
      room.controller.owner.username
    ) {
      return room.controller.owner.username;
    }

    return remoteManager.getMyUsername();
  },
};
