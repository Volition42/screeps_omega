/*
Developer Summary:
Room Snapshot Directive System

Purpose:
- Provide room-level console snapshots
- Announce one-time operational state changes
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
Read like a concise analyst snapshot without spamming noise.
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

    if (config.DIRECTIVES.SEPARATOR_LINE) {
      console.log(config.DIRECTIVES.SEPARATOR_LINE);
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

    const header = this.getHeader(room.name, "Phase");

    if (currentPhase === "bootstrap") {
      return [
        header,
        `Phase changed: ${previousPhase} -> ${currentPhase}.`,
        "Bootstrap logistics are now the active room priority.",
        `[Room Phase] from=${previousPhase} to=${currentPhase}`,
      ];
    }

    if (currentPhase === "developing") {
      return [
        header,
        `Phase changed: ${previousPhase} -> ${currentPhase}.`,
        "The room has cleared bootstrap construction and can build out its core economy.",
        `[Room Phase] from=${previousPhase} to=${currentPhase}`,
      ];
    }

    if (currentPhase === "stable") {
      return [
        header,
        `Phase changed: ${previousPhase} -> ${currentPhase}.`,
        "The current room build plan is satisfied and the economy is stable.",
        `[Room Phase] from=${previousPhase} to=${currentPhase}`,
      ];
    }

    return [
      header,
      `Phase changed: ${previousPhase} -> ${currentPhase}.`,
      "Room phase state has been updated.",
      `[Room Phase] from=${previousPhase} to=${currentPhase}`,
    ];
  },

  getMilestoneDirectiveLines(room, state, tracker) {
    if (!config.DIRECTIVES.SHOW_MILESTONE_DIRECTIVES) return null;

    const buildStatus = state.buildStatus;
    if (!buildStatus) return null;
    const header = this.getHeader(room.name, "Milestone");

    if (!tracker.announced.bootstrapComplete && buildStatus.bootstrapComplete) {
      tracker.announced.bootstrapComplete = true;

      return [
        header,
        "Bootstrap baseline completed.",
        "Source containers and the early road backbone are in place.",
        "[Room Milestone] bootstrapComplete=true",
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
        "Defense baseline completed.",
        "Walls and ramparts now meet the current room target.",
        "[Room Milestone] defenseComplete=true",
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
        "Tower baseline completed.",
        "Tower coverage is now available for room defense and support.",
        "[Room Milestone] towerReady=true",
      ];
    }

    if (!tracker.announced.stableReady && buildStatus.stableReady) {
      tracker.announced.stableReady = true;

      return [
        header,
        "Stable-room baseline completed.",
        "Current roadmap targets are satisfied for this operating profile.",
        "[Room Milestone] stableReady=true",
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

    const header = this.getHeader(room.name, "CPU");
    const footer =
      `[Room CPU] cpu=${last.cpu.used.toFixed(2)} ` +
      `avg=${avgCpu.toFixed(2)} bucket=${last.cpu.bucket}`;

    if (avgCpu > 0 && last.cpu.used >= avgCpu * cpuSpikeMultiplier) {
      return [
        header,
        "CPU spike detected above the configured threshold.",
        "This tick used significantly more CPU than the recent average.",
        footer,
      ];
    }

    if (last.cpu.bucket <= bucketWarningThreshold) {
      return [
        header,
        "CPU bucket is below the configured warning threshold.",
        "Runtime shedding may activate until reserves recover.",
        footer,
      ];
    }

    if (Game.time % healthyReportInterval === 0) {
      return [
        header,
        "CPU usage is within the configured operating range.",
        "No CPU pressure action is currently required.",
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

    const header = this.getHeader(room.name, "Growth");
    const pct = Math.round(
      (room.controller.progress / room.controller.progressTotal) * 100,
    );

    if (progress.rate <= 0) {
      return [
        header,
        `Controller progress is ${pct}% toward RCL${room.controller.level + 1}.`,
        "Upgrade rate was flat during the current sample window.",
        `[Room Growth] rcl=${room.controller.level} progress=${room.controller.progress}/${room.controller.progressTotal} eta=undetermined`,
      ];
    }

    return [
      header,
      `Controller progress is ${pct}% toward RCL${room.controller.level + 1}.`,
      `Estimated completion: ${this.formatTicksAsDhM(progress.etaTicks)} at ${progress.rate.toFixed(2)} progress/tick.`,
      `[Room Growth] rcl=${room.controller.level} progress=${room.controller.progress}/${room.controller.progressTotal} eta=${this.formatTicksAsDhM(progress.etaTicks)}`,
    ];
  },

  getConstructionDirectiveLines(room, state) {
    if (!config.DIRECTIVES.SHOW_CONSTRUCTION_DIRECTIVES) return null;

    const interval = config.DIRECTIVES.CONSTRUCTION_REPORT_INTERVAL || 75;
    if (Game.time % interval !== 0) return null;

    const checklist = state.buildStatus;
    if (!checklist) return null;

    const header = this.getHeader(room.name, "Build");

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
      "Construction snapshot for the current room phase.",
      checklist.sites > 0
        ? "Active construction sites are present."
        : "The current phase still has unmet structure targets.",
      `Checklist: EXT ${checklist.extensionsBuilt}/${checklist.extensionsNeeded} | ` +
        `TOWER ${checklist.towersBuilt}/${checklist.towersNeeded} | ` +
        `STORAGE ${checklist.storageBuilt}/${checklist.storageNeeded} | ` +
        `ROADS ${checklist.roadsBuilt}/${checklist.roadsNeeded} | ` +
        `WALL ${checklist.wallsBuilt}/${checklist.wallsNeeded} | ` +
        `RAMP ${checklist.rampartsBuilt}/${checklist.rampartsNeeded}`,
      `[Room Build] phase=${state.phase} sites=${checklist.sites}`,
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

    const header = this.getHeader(roomName, "Status");
    const footer =
      `[Room Status] phase=${state.phase} rcl=${controllerLevel} energy=${energyLine}`;

    if (hostiles > 0) {
      return [
        header,
        `Hostiles detected: ${hostiles}.`,
        "Room safety response is active and civilian movement may be restricted.",
        footer,
      ];
    }

    if (state.phase === "bootstrap_jr") {
      return [
        header,
        "Early bootstrap state is active.",
        "Junior workers are handling direct harvest and early controller progress.",
        footer,
      ];
    }

    if (state.phase === "bootstrap") {
      return [
        header,
        "Bootstrap construction is active.",
        `Source container coverage: ${sourceContainers}/${state.sources.length}.`,
        "Core economy roles should come online as soon as source containers are ready.",
        footer,
      ];
    }

    if (state.phase === "developing") {
      if (constructionSites > 0) {
        return [
          header,
          `Active construction sites: ${constructionSites}.`,
          "The room is still filling out its developing-phase build targets.",
          footer,
        ];
      }

      return [
        header,
        "Developing-phase economy is active.",
        "The room is operating without active construction pressure this cycle.",
        footer,
      ];
    }

    if (state.phase === "stable") {
      return [
        header,
        "Stable-phase room state confirmed.",
        "Core infrastructure is built and the room can bias toward upgrades and maintenance.",
        footer,
      ];
    }

    return [
      header,
      "No special room-state change was detected for this cycle.",
      footer,
    ];
  },

  getHeader(roomName, section) {
    const label = config.DIRECTIVES.HEADER_LABEL || "Room Snapshot";
    return `[${label}] [${section}] [Room:${roomName}]`;
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
