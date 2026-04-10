/*
Developer Summary:
Critical room directive system.

Purpose:
- Keep console output event-driven instead of chatty
- Announce only critical room changes
- Leave detail reads to ops commands
*/

const config = require("config");
const opsState = require("ops_state");
const roomProgress = require("room_progress");

module.exports = {
  run(room, state) {
    if (!opsState.getReportsEnabled()) return;

    const roomMemory = roomProgress.getRoomMemory(room);
    const tracker = this.ensureTracker(roomMemory);

    roomProgress.updateProgressTrackerIfNeeded(room, roomMemory);
    if (!tracker.initialized) {
      this.primeTracker(room, state, tracker);
      return;
    }

    const lines = this.getCriticalDirectiveLines(room, state, tracker);
    if (lines) {
      this.printLines(lines);
    }
  },

  printLines(lines) {
    for (let i = 0; i < lines.length; i++) {
      console.log(lines[i]);
    }

    if (config.DIRECTIVES && config.DIRECTIVES.SEPARATOR_LINE) {
      console.log(config.DIRECTIVES.SEPARATOR_LINE);
    }
  },

  ensureTracker(roomMemory) {
    if (!roomMemory.directiveTracker) {
      roomMemory.directiveTracker = {
        initialized: false,
        lastPhase: null,
        lastThreatActive: null,
        lastThreatScore: 0,
        lastRcl: null,
        announced: {
          foundationComplete: false,
          defenseComplete: false,
          towerReady: false,
          specializationComplete: false,
          commandComplete: false,
        },
      };
    }

    return roomMemory.directiveTracker;
  },

  primeTracker(room, state, tracker) {
    const buildStatus = state.buildStatus || {};
    const defense = state.defense || {};
    const threat = defense.homeThreat || null;

    tracker.initialized = true;
    tracker.lastPhase = state.phase || null;
    tracker.lastThreatActive = !!defense.hasThreats;
    tracker.lastThreatScore = threat ? threat.threatScore || 0 : 0;
    tracker.lastRcl = room.controller ? room.controller.level : null;
    tracker.announced.foundationComplete = !!buildStatus.foundationComplete;
    tracker.announced.defenseComplete = true;
    tracker.announced.towerReady =
      buildStatus.towersNeeded > 0 &&
      buildStatus.towersBuilt >= buildStatus.towersNeeded;
    tracker.announced.specializationComplete = !!buildStatus.specializationComplete;
    tracker.announced.commandComplete = !!buildStatus.commandComplete;
  },

  getCriticalDirectiveLines(room, state, tracker) {
    const alertLines = this.getAlertDirectiveLines(room, state, tracker);
    if (alertLines) return alertLines;

    const phaseLines = this.getPhaseDirectiveLines(room, state, tracker);
    if (phaseLines) return phaseLines;

    const rclLines = this.getRclDirectiveLines(room, tracker);
    if (rclLines) return rclLines;

    return this.getMilestoneDirectiveLines(room, state, tracker);
  },

  getAlertDirectiveLines(room, state, tracker) {
    if (
      !config.DIRECTIVES ||
      config.DIRECTIVES.SHOW_ALERT_DIRECTIVES === false
    ) {
      return null;
    }

    const defense = state.defense || {};
    const threat = defense.homeThreat || null;
    const active = !!defense.hasThreats;
    const threatScore = threat ? threat.threatScore || 0 : 0;

    if (tracker.lastThreatActive === active) {
      tracker.lastThreatScore = threatScore;
      return null;
    }

    tracker.lastThreatActive = active;
    tracker.lastThreatScore = threatScore;

    if (active) {
      return [
        `[CRIT][${room.name}][ALERT]`,
        `Hostiles ${threat ? threat.hostileCount || 0 : 0} | Threat ${threatScore} | Defenders ${state.roleCounts ? state.roleCounts.defender || 0 : 0}/${defense.requiredDefenders || 0}`,
      ];
    }

    return [
      `[CRIT][${room.name}][CLEAR]`,
      "Room threat cleared.",
    ];
  },

  getPhaseDirectiveLines(room, state, tracker) {
    if (
      !config.DIRECTIVES ||
      config.DIRECTIVES.SHOW_PHASE_TRANSITION_DIRECTIVES === false
    ) {
      return null;
    }

    const currentPhase = state.phase || null;
    if (tracker.lastPhase === currentPhase) {
      return null;
    }

    const previousPhase = tracker.lastPhase;
    tracker.lastPhase = currentPhase;

    return [
      `[CRIT][${room.name}][PHASE]`,
      `${previousPhase || "unknown"} -> ${currentPhase}`,
    ];
  },

  getRclDirectiveLines(room, tracker) {
    if (
      !config.DIRECTIVES ||
      config.DIRECTIVES.SHOW_RCL_DIRECTIVES === false
    ) {
      return null;
    }

    const currentRcl = room.controller ? room.controller.level : null;
    if (tracker.lastRcl === currentRcl) {
      return null;
    }

    tracker.lastRcl = currentRcl;

    return [
      `[CRIT][${room.name}][RCL]`,
      `Room reached RCL ${currentRcl}.`,
    ];
  },

  getMilestoneDirectiveLines(room, state, tracker) {
    if (
      !config.DIRECTIVES ||
      config.DIRECTIVES.SHOW_MILESTONE_DIRECTIVES === false
    ) {
      return null;
    }

    const buildStatus = state.buildStatus;
    if (!buildStatus) return null;

    if (!tracker.announced.foundationComplete && buildStatus.foundationComplete) {
      tracker.announced.foundationComplete = true;
      return [
        `[CRIT][${room.name}][MILESTONE]`,
        "Foundation baseline completed.",
      ];
    }

    if (
      !tracker.announced.towerReady &&
      buildStatus.towersNeeded > 0 &&
      buildStatus.towersBuilt >= buildStatus.towersNeeded
    ) {
      tracker.announced.towerReady = true;
      return [
        `[CRIT][${room.name}][MILESTONE]`,
        "Tower baseline completed.",
      ];
    }

    if (
      !tracker.announced.specializationComplete &&
      buildStatus.specializationComplete
    ) {
      tracker.announced.specializationComplete = true;
      return [
        `[CRIT][${room.name}][MILESTONE]`,
        "Specialization baseline completed.",
      ];
    }

    if (!tracker.announced.commandComplete && buildStatus.commandComplete) {
      tracker.announced.commandComplete = true;
      return [
        `[CRIT][${room.name}][MILESTONE]`,
        "Command phase completed.",
      ];
    }

    return null;
  },

  getRoomMemory(room) {
    return roomProgress.getRoomMemory(room);
  },

  updateProgressTrackerIfNeeded(room, roomMemory) {
    return roomProgress.updateProgressTrackerIfNeeded(room, roomMemory);
  },

  updateProgressTracker(room, roomMemory) {
    return roomProgress.updateProgressTracker(room, roomMemory);
  },

  formatTicksAsDhM(ticks) {
    return roomProgress.formatTicksAsDhM(ticks);
  },
};
