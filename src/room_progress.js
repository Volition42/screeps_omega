const config = require("config");

function getSampleInterval() {
  return config.DIRECTIVES && config.DIRECTIVES.PROGRESS_SAMPLE_INTERVAL
    ? config.DIRECTIVES.PROGRESS_SAMPLE_INTERVAL
    : 100;
}

module.exports = {
  getRoomMemory(room) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};

    return Memory.rooms[room.name];
  },

  ensureProgressTracker(roomMemory) {
    if (!roomMemory.progressTracker) {
      roomMemory.progressTracker = {
        lastTick: Game.time,
        lastProgress: 0,
        rate: 0,
        etaTicks: 0,
      };
    }

    return roomMemory.progressTracker;
  },

  updateProgressTrackerIfNeeded(room, roomMemory) {
    if (!room.controller || !room.controller.my) return null;
    if (!room.controller.progressTotal) return null;

    const tracker = this.ensureProgressTracker(roomMemory);
    const sampleInterval = getSampleInterval();

    if (tracker.lastProgress === 0 && room.controller.progress > 0) {
      tracker.lastProgress = room.controller.progress;
    }

    if (Game.time - tracker.lastTick >= sampleInterval) {
      return this.updateProgressTracker(room, roomMemory);
    }

    return tracker;
  },

  updateProgressTracker(room, roomMemory) {
    if (!room.controller || !room.controller.my) return null;
    if (!room.controller.progressTotal) return null;

    const tracker = this.ensureProgressTracker(roomMemory);
    const deltaTicks = Math.max(1, Game.time - tracker.lastTick);
    const deltaProgress = room.controller.progress - tracker.lastProgress;
    const instantRate = deltaTicks > 0 ? deltaProgress / deltaTicks : 0;

    if (tracker.rate && tracker.rate > 0) {
      tracker.rate = Number((tracker.rate * 0.7 + instantRate * 0.3).toFixed(3));
    } else {
      tracker.rate = Number(instantRate.toFixed(3));
    }

    const remaining = room.controller.progressTotal - room.controller.progress;
    tracker.etaTicks =
      tracker.rate > 0 ? Math.ceil(remaining / tracker.rate) : 0;
    tracker.lastTick = Game.time;
    tracker.lastProgress = room.controller.progress;

    return tracker;
  },

  getProgressSummary(room, options) {
    if (!room.controller || !room.controller.my) return null;

    const level = room.controller.level || 0;
    const progressTotal = room.controller.progressTotal || 0;
    const progressValue = room.controller.progress || 0;
    if (!progressTotal || level >= 8) {
      return {
        level: level,
        targetLevel: null,
        progress: progressValue,
        progressTotal: progressTotal,
        pct: null,
        rate: 0,
        eta: null,
        etaTicks: null,
      };
    }

    const roomMemory = this.getRoomMemory(room);
    const updateTracker = !options || options.update !== false;
    const tracker = updateTracker
      ? this.updateProgressTrackerIfNeeded(room, roomMemory)
      : roomMemory.progressTracker || null;
    const pct = Math.round((progressValue / progressTotal) * 100);
    const rate = tracker && typeof tracker.rate === "number" ? tracker.rate : 0;
    const etaTicks =
      tracker && tracker.rate > 0 && tracker.etaTicks > 0
        ? tracker.etaTicks
        : null;

    return {
      level: level,
      targetLevel: level + 1,
      progress: progressValue,
      progressTotal: progressTotal,
      pct: pct,
      rate: rate,
      eta: etaTicks ? this.formatTicksAsDhM(etaTicks) : null,
      etaTicks: etaTicks,
    };
  },

  formatTicksAsDhM(ticks) {
    if (!ticks || ticks <= 0) return "undetermined";

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
