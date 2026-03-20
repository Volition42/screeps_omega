/*
Developer Summary:
vCORP Corporate Directive System

Purpose:
- Provide themed room-level console output
- Announce one-time operational events
- Report recurring performance, growth, and construction status

Announcement priority:
1. One-time phase transition directives
2. One-time milestone directives
3. Performance directives
4. Progress / ETA directives
5. Construction checklist directives
6. General operational directives

Memory used:
Memory.rooms[room.name].directiveTracker

Tracked one-time events:
- phase changes
- bootstrap completion
- defense baseline completion
- tower readiness
- stable readiness

Design goal:
Feel like polished corporate reporting without spamming noise.
*/

const config = require("config");

const OPERATIONAL_REPEAT_INTERVAL = 100;

module.exports = {
  run(room, state) {
    if (!config.DIRECTIVES.ENABLED) return;

    const roomMemory = this.getRoomMemory(room);
    const tracker = this.ensureTracker(roomMemory);

    this.updateProgressTrackerIfNeeded(room, roomMemory);

    const immediateLines = this.getImmediateDirectiveLines(room, state, tracker);
    if (immediateLines) {
      this.printLines(immediateLines);
      return;
    }

    if (Game.time % config.DIRECTIVES.INTERVAL !== 0) return;

    const lines = this.getRecurringDirectiveLines(room, state, roomMemory, tracker);
    if (lines) {
      this.printLines(lines);
    }
  },

  printLines(lines) {
    for (let i = 0; i < lines.length; i++) {
      console.log(lines[i]);
    }
  },

  getRoomMemory(room) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};

    return Memory.rooms[room.name];
  },

  ensureTracker(roomMemory) {
    if (!roomMemory.directiveTracker) {
      roomMemory.directiveTracker = {
        lastPhase: null,
        lastOperationalSignature: null,
        lastOperationalTick: 0,
        announced: {
          bootstrapComplete: false,
          defenseComplete: false,
          towerReady: false,
          stableReady: false,
        },
      };
    }

    return roomMemory.directiveTracker;
  },

  getImmediateDirectiveLines(room, state, tracker) {
    const phaseLines = this.getPhaseTransitionDirectiveLines(room, state, tracker);
    if (phaseLines) return phaseLines;

    const milestoneLines = this.getMilestoneDirectiveLines(room, state, tracker);
    if (milestoneLines) return milestoneLines;

    return null;
  },

  getPhaseTransitionDirectiveLines(room, state, tracker) {
    if (!config.DIRECTIVES.SHOW_PHASE_TRANSITION_DIRECTIVES) return null;
    const currentPhase = state.phase;

    if (tracker.lastPhase === null) {
      tracker.lastPhase = currentPhase;
      return null;
    }

    if (tracker.lastPhase === currentPhase) {
      return null;
    }

    const previousPhase = tracker.lastPhase;
    tracker.lastPhase = currentPhase;

    const header = `[vCORP Directive Update] [Sector:${room.name}]`;

    if (currentPhase === "bootstrap") {
      return [
        header,
        "Early market entry objectives have been satisfied.",
        `Sector operations have transitioned from ${previousPhase} to bootstrap infrastructure deployment.`,
        "Foundational assets are now authorized for structured expansion.",
        `[vCORP Phase] ${previousPhase} -> ${currentPhase}`,
      ];
    }

    if (currentPhase === "developing") {
      return [
        header,
        "Infrastructure seeding program completed.",
        `Sector operations have transitioned from ${previousPhase} to active development.`,
        "Expansion assets are now prioritized for structured growth and defensive preparation.",
        `[vCORP Phase] ${previousPhase} -> ${currentPhase}`,
      ];
    }

    if (currentPhase === "stable") {
      return [
        header,
        "Stable operations authorized.",
        `Sector operations have transitioned from ${previousPhase} to stable performance status.`,
        "Capacity may now be redirected toward fortification, optimization, and revenue extraction.",
        `[vCORP Phase] ${previousPhase} -> ${currentPhase}`,
      ];
    }

    return [
      header,
      "Administrative phase transition recorded.",
      `Sector operations have transitioned from ${previousPhase} to ${currentPhase}.`,
      "Department leads are expected to align with the updated operating profile.",
      `[vCORP Phase] ${previousPhase} -> ${currentPhase}`,
    ];
  },

  getMilestoneDirectiveLines(room, state, tracker) {
    if (!config.DIRECTIVES.SHOW_MILESTONE_DIRECTIVES) return null;

    const buildStatus = state.buildStatus;
    if (!buildStatus) return null;
    const header = `[vCORP Directive Update] [Sector:${room.name}]`;

    if (!tracker.announced.bootstrapComplete && buildStatus.bootstrapComplete) {
      tracker.announced.bootstrapComplete = true;

      return [
        header,
        "Bootstrap infrastructure baseline achieved.",
        "Source logistics, controller support, and initial transport lanes are now online.",
        "The sector is authorized to proceed into higher-value development programs.",
        "[vCORP Milestone] bootstrapComplete=true",
      ];
    }

    if (
      !tracker.announced.defenseComplete &&
      buildStatus.wallsNeeded > 0 &&
      buildStatus.wallsBuilt >= buildStatus.wallsNeeded &&
      buildStatus.rampartsBuilt >= buildStatus.rampartsNeeded
    ) {
      tracker.announced.defenseComplete = true;

      return [
        header,
        "Defense baseline achieved.",
        "Perimeter controls and controlled-access rampart gates are now in place.",
        "Security posture has been upgraded from optimistic to professionally suspicious.",
        "[vCORP Milestone] defenseComplete=true",
      ];
    }

    if (
      !tracker.announced.towerReady &&
      buildStatus.towersNeeded > 0 &&
      buildStatus.towersBuilt >= buildStatus.towersNeeded
    ) {
      tracker.announced.towerReady = true;

      return [
        header,
        "Automated security platform commissioned.",
        "Tower construction objectives have been fulfilled and response coverage is now active.",
        "Operational continuity is expected to improve under hostile labor conditions.",
        "[vCORP Milestone] towerReady=true",
      ];
    }

    if (!tracker.announced.stableReady && buildStatus.stableReady) {
      tracker.announced.stableReady = true;

      return [
        header,
        "Sector maturity review approved.",
        "Construction roadmap targets for the current operating profile have been satisfied.",
        "Future labor may now be reassigned toward optimization, expansion, or strategic overreach.",
        "[vCORP Milestone] stableReady=true",
      ];
    }

    return null;
  },

  getRecurringDirectiveLines(room, state, roomMemory, tracker) {
    const performanceLines = this.getPerformanceDirectiveLines(room);
    if (performanceLines) return performanceLines;

    const progressLines = this.getProgressDirectiveLines(room, roomMemory);
    if (progressLines) return progressLines;

    const constructionLines = this.getConstructionDirectiveLines(room, state);
    if (constructionLines) return constructionLines;

    return this.getOperationalDirectiveLines(room, state, tracker);
  },

  getPerformanceDirectiveLines(room) {
    if (!config.DIRECTIVES.SHOW_PERFORMANCE_DIRECTIVES) return null;
    if (!Memory.stats || !Memory.stats.last || !Memory.stats.averages)
      return null;

    const last = Memory.stats.last;
    const avgCpu = Memory.stats.averages.cpuUsed || last.cpu.used;
    const cpuSpikeMultiplier = config.DIRECTIVES.CPU_SPIKE_MULTIPLIER || 1.5;
    const bucketWarningThreshold =
      config.DIRECTIVES.BUCKET_WARNING_THRESHOLD || 8000;
    const healthyReportInterval =
      config.DIRECTIVES.HEALTHY_REPORT_INTERVAL || 100;

    const header = `[vCORP Directive Update] [Sector:${room.name}]`;
    const footer =
      `[vCORP Performance] cpu=${last.cpu.used.toFixed(2)} ` +
      `avg=${avgCpu.toFixed(2)} bucket=${last.cpu.bucket}`;

    if (avgCpu > 0 && last.cpu.used >= avgCpu * cpuSpikeMultiplier) {
      return [
        header,
        "Operational variance has exceeded acceptable corporate tolerances.",
        "Compute overhead has risen above projected throughput targets.",
        "All departments are instructed to maintain productivity while diagnostics proceed.",
        footer,
      ];
    }

    if (last.cpu.bucket <= bucketWarningThreshold) {
      return [
        header,
        "Resource conservation protocol initiated.",
        "CPU reserve capacity has fallen below preferred operating threshold.",
        "Non-essential activity is to remain under review until reserves recover.",
        footer,
      ];
    }

    if (Game.time % healthyReportInterval === 0) {
      return [
        header,
        "Performance review complete.",
        "Compute expenditure remains within approved operational margins.",
        "Reserve capacity is stable and market activities may continue as scheduled.",
        footer,
      ];
    }

    return null;
  },

  getProgressDirectiveLines(room, roomMemory) {
    if (!config.DIRECTIVES.SHOW_PROGRESS_DIRECTIVES) return null;
    if (!room.controller || !room.controller.my) return null;
    if (!room.controller.progressTotal) return null;

    const progress = roomMemory.progressTracker;
    if (!progress) return null;

    const reportInterval = config.DIRECTIVES.PROGRESS_REPORT_INTERVAL || 100;
    if (Game.time % reportInterval !== 0) return null;

    const header = `[vCORP Directive Update] [Sector:${room.name}]`;
    const pct = Math.round(
      (room.controller.progress / room.controller.progressTotal) * 100,
    );

    if (progress.rate <= 0) {
      return [
        header,
        "Controller advancement review submitted.",
        `Current progress remains at ${pct}% with no measurable acceleration in this reporting window.`,
        "Labor allocation is to maintain output until growth velocity improves.",
        `[vCORP Growth] rcl=${room.controller.level} progress=${room.controller.progress}/${room.controller.progressTotal} eta=undetermined`,
      ];
    }

    return [
      header,
      "Controller advancement review submitted.",
      `Current progress stands at ${pct}% toward RCL${room.controller.level + 1}.`,
      `Projected advancement window: ${this.formatTicksAsDhM(progress.etaTicks)} at ${progress.rate.toFixed(2)} progress/tick.`,
      `[vCORP Growth] rcl=${room.controller.level} progress=${room.controller.progress}/${room.controller.progressTotal} eta=${this.formatTicksAsDhM(progress.etaTicks)}`,
    ];
  },

  getConstructionDirectiveLines(room, state) {
    if (!config.DIRECTIVES.SHOW_CONSTRUCTION_DIRECTIVES) return null;

    const interval = config.DIRECTIVES.CONSTRUCTION_REPORT_INTERVAL || 75;
    if (Game.time % interval !== 0) return null;

    const checklist = state.buildStatus;
    if (!checklist) return null;

    const header = `[vCORP Directive Update] [Sector:${room.name}]`;

    if (
      checklist.extensionsBuilt >= checklist.extensionsNeeded &&
      checklist.towersBuilt >= checklist.towersNeeded &&
      checklist.storageBuilt >= checklist.storageNeeded &&
      checklist.roadsBuilt >= checklist.roadsNeeded &&
      checklist.wallsBuilt >= checklist.wallsNeeded &&
      checklist.rampartsBuilt >= checklist.rampartsNeeded &&
      checklist.sites === 0
    ) {
      return null;
    }

    return [
      header,
      "Infrastructure progress review submitted.",
      checklist.sites > 0
        ? "Current build program remains active."
        : "Additional infrastructure capacity has been identified for future allocation.",
      `Checklist: EXT ${checklist.extensionsBuilt}/${checklist.extensionsNeeded} | ` +
        `TOWER ${checklist.towersBuilt}/${checklist.towersNeeded} | ` +
        `STORAGE ${checklist.storageBuilt}/${checklist.storageNeeded} | ` +
        `ROADS ${checklist.roadsBuilt}/${checklist.roadsNeeded} | ` +
        `WALL ${checklist.wallsBuilt}/${checklist.wallsNeeded} | ` +
        `RAMP ${checklist.rampartsBuilt}/${checklist.rampartsNeeded}`,
      `[vCORP Build] phase=${state.phase} sites=${checklist.sites}`,
    ];
  },

  updateProgressTrackerIfNeeded(room, roomMemory) {
    if (!config.DIRECTIVES.SHOW_PROGRESS_DIRECTIVES) return;
    if (!room.controller || !room.controller.my) return;
    if (!room.controller.progressTotal) return;

    const tracker = roomMemory.progressTracker;
    const sampleInterval = config.DIRECTIVES.PROGRESS_SAMPLE_INTERVAL || 25;

    if (!tracker || Game.time - tracker.lastTick >= sampleInterval) {
      this.updateProgressTracker(room, roomMemory);
    }
  },

  updateProgressTracker(room, roomMemory) {
    const sampleInterval = config.DIRECTIVES.PROGRESS_SAMPLE_INTERVAL || 25;

    if (!roomMemory.progressTracker) {
      roomMemory.progressTracker = {
        lastTick: Game.time,
        lastProgress: room.controller.progress,
        rate: 0,
        etaTicks: 0,
      };
      return {
        rate: 0,
        etaTicks: 0,
      };
    }

    const tracker = roomMemory.progressTracker;

    if (Game.time - tracker.lastTick >= sampleInterval) {
      const deltaTicks = Game.time - tracker.lastTick;
      const deltaProgress = room.controller.progress - tracker.lastProgress;
      const instantRate = deltaTicks > 0 ? deltaProgress / deltaTicks : 0;

      if (tracker.rate && tracker.rate > 0) {
        tracker.rate = Number(
          (tracker.rate * 0.7 + instantRate * 0.3).toFixed(3),
        );
      } else {
        tracker.rate = Number(instantRate.toFixed(3));
      }

      const remaining =
        room.controller.progressTotal - room.controller.progress;
      tracker.etaTicks =
        tracker.rate > 0 ? Math.ceil(remaining / tracker.rate) : 0;

      tracker.lastTick = Game.time;
      tracker.lastProgress = room.controller.progress;
    }

    return tracker;
  },

  getOperationalDirectiveLines(room, state, tracker) {
    const roomName = room.name;
    const controllerLevel = room.controller ? room.controller.level : 0;
    const hostiles = state.hostileCreeps ? state.hostileCreeps.length : 0;
    const constructionSites = state.sites ? state.sites.length : 0;
    const sourceContainers = state.sourceContainers
      ? state.sourceContainers.length
      : 0;
    const energyLine = `${room.energyAvailable}/${room.energyCapacityAvailable}`;

    const operationalSignature =
      state.phase +
      "|" +
      controllerLevel +
      "|" +
      hostiles +
      "|" +
      constructionSites +
      "|" +
      sourceContainers;

    // Developer note:
    // Operational directives are informative only, so identical room state is
    // reported less often to cut repeated string assembly and console noise.
    if (
      tracker.lastOperationalSignature === operationalSignature &&
      Game.time - tracker.lastOperationalTick < OPERATIONAL_REPEAT_INTERVAL
    ) {
      return null;
    }

    tracker.lastOperationalSignature = operationalSignature;
    tracker.lastOperationalTick = Game.time;

    const header = `[vCORP Directive Update] [Sector:${roomName}]`;
    const footer =
      `[vCORP Status] phase=${state.phase} rcl=${controllerLevel} energy=${energyLine}`;

    if (hostiles > 0) {
      return [
        header,
        "Security escalation authorized.",
        `Hostile workforce detected: ${hostiles}.`,
        "Defensive assets are to prioritize threat suppression and continuity of operations.",
        footer,
      ];
    }

    if (state.phase === "bootstrap_jr") {
      return [
        header,
        "Early market entry protocol active.",
        "Junior labor assets are conducting direct extraction and controller investment.",
        "Short-term growth is prioritized over operational elegance.",
        footer,
      ];
    }

    if (state.phase === "bootstrap") {
      return [
        header,
        "Infrastructure seeding program initiated.",
        `Source container coverage: ${sourceContainers}/${state.sources.length}.`,
        "Shared hauler and upgrader logistics are replacing dedicated controller feed paths.",
        "Foundational logistics are being positioned for scalable growth.",
        footer,
      ];
    }

    if (state.phase === "developing") {
      if (constructionSites > 0) {
        return [
          header,
          "Market Expansion Program initiated.",
          `Active construction packages: ${constructionSites}.`,
          "Resource acquisition priority increased to support structured development.",
          footer,
        ];
      }

      return [
        header,
        "Regional development remains on schedule.",
        "Infrastructure deployment has entered an efficiency optimization cycle.",
        "Energy flow is being redirected toward strategic growth targets.",
        footer,
      ];
    }

    if (state.phase === "stable") {
      return [
        header,
        "Operational stability confirmed.",
        "Core infrastructure is performing within acceptable corporate tolerances.",
        "Excess capacity may be redirected toward expansion, fortification, or revenue extraction.",
        footer,
      ];
    }

    return [
      header,
      "Administrative review in progress.",
      "No special directive was generated for this cycle.",
      footer,
    ];
  },

  formatTicksAsDhM(ticks) {
    const tickSeconds = this.getTickSeconds();
    const totalSeconds = Math.max(0, Math.floor(ticks * tickSeconds));

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m`;
  },

  getTickSeconds() {
    if (
      typeof runtimeData !== "undefined" &&
      runtimeData &&
      runtimeData.tickDuration
    ) {
      return runtimeData.tickDuration / 1000;
    }

    return 2.5;
  },
};
