const config = require("config");

function getSettings() {
  const settings = config.SCHEDULING || {};
  return {
    enabled: settings.ENABLED !== false,
    optionalMinBucket:
      typeof settings.OPTIONAL_MIN_BUCKET === "number"
        ? settings.OPTIONAL_MIN_BUCKET
        : 3000,
    maxOptionalTasks: settings.MAX_OPTIONAL_TASKS || {
      normal: 4,
      tight: 2,
      critical: 0,
    },
    optionalCpuBudgetRatio: settings.OPTIONAL_CPU_BUDGET_RATIO || {
      normal: 0.18,
      tight: 0.08,
      critical: 0,
    },
    historySize:
      typeof settings.HISTORY_SIZE === "number"
        ? Math.max(5, settings.HISTORY_SIZE)
        : 25,
  };
}

function ensureMemory() {
  if (!Memory.runtime) Memory.runtime = {};
  if (!Memory.runtime.scheduler) {
    Memory.runtime.scheduler = {
      tick: 0,
      active: false,
      ran: 0,
      deferred: 0,
      skipped: 0,
      reasons: {},
      tasks: {},
      recent: [],
      summary: null,
      optionalCpuStart: 0,
    };
  }
  if (!Memory.runtime.scheduler.tasks) Memory.runtime.scheduler.tasks = {};
  if (!Memory.runtime.scheduler.reasons) Memory.runtime.scheduler.reasons = {};
  if (!Memory.runtime.scheduler.recent) Memory.runtime.scheduler.recent = [];

  return Memory.runtime.scheduler;
}

function getPressure() {
  return Memory.stats && Memory.stats.runtime && Memory.stats.runtime.pressure
    ? Memory.stats.runtime.pressure
    : "normal";
}

function getMaxOptionalTasks(settings, pressure) {
  const limits = settings.maxOptionalTasks || {};
  if (typeof limits[pressure] === "number") return Math.max(0, limits[pressure]);
  if (typeof limits.normal === "number") return Math.max(0, limits.normal);
  return 4;
}

function getCpuBudget(settings, pressure) {
  const ratios = settings.optionalCpuBudgetRatio || {};
  const ratio =
    typeof ratios[pressure] === "number"
      ? ratios[pressure]
      : typeof ratios.normal === "number"
        ? ratios.normal
        : 0.18;
  const limit = Game.cpu && Game.cpu.limit ? Game.cpu.limit : 20;
  return Math.max(0, limit * ratio);
}

function stableHash(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

module.exports = {
  beginTick() {
    const memory = ensureMemory();
    if (memory.tick === Game.time) return memory;

    memory.tick = Game.time;
    memory.active = false;
    memory.ran = 0;
    memory.deferred = 0;
    memory.skipped = 0;
    memory.reasons = {};
    memory.optionalCpuStart = Game.cpu ? Game.cpu.getUsed() : 0;
    memory.summary = {
      tick: Game.time,
      ran: 0,
      deferred: 0,
      skipped: 0,
      reasons: {},
      recent: memory.recent.slice(-5),
    };

    return memory;
  },

  startTick() {
    const memory = this.beginTick();
    memory.active = true;
    return memory;
  },

  getMemory() {
    return ensureMemory();
  },

  hash(value) {
    return stableHash(value);
  },

  getOffset(key, interval) {
    const safeInterval = Math.max(1, Math.floor(interval || 1));
    if (safeInterval <= 1) return 0;
    return stableHash(key) % safeInterval;
  },

  isPhaseTick(key, interval) {
    const safeInterval = Math.max(1, Math.floor(interval || 1));
    if (safeInterval <= 1) return true;
    return Game.time % safeInterval === this.getOffset(key, safeInterval);
  },

  isDue(key, interval) {
    const safeInterval = Math.max(1, Math.floor(interval || 1));
    if (safeInterval <= 1) return true;

    const memory = ensureMemory();
    const task = memory.tasks[key] || {};
    if (task.lastRun && Game.time - task.lastRun < safeInterval) {
      return false;
    }

    if (!task.lastRun) {
      return this.isPhaseTick(key, safeInterval);
    }

    return true;
  },

  canRunOptional(key, interval, options) {
    const settings = getSettings();
    if (!settings.enabled) return { ok: true, reason: "disabled" };
    if (!ensureMemory().active) return { ok: true, reason: "inactive" };
    if (!this.isDue(key, interval)) return { ok: false, reason: "interval" };

    const opts = options || {};
    const pressure = opts.pressure || getPressure();
    const memory = this.beginTick();
    const bucket =
      Game.cpu && typeof Game.cpu.bucket === "number" ? Game.cpu.bucket : 10000;
    const minBucket =
      typeof opts.minBucket === "number" ? opts.minBucket : settings.optionalMinBucket;

    if (bucket < minBucket) {
      return { ok: false, reason: "bucket" };
    }

    const maxTasks =
      typeof opts.maxTasks === "number"
        ? Math.max(0, opts.maxTasks)
        : getMaxOptionalTasks(settings, pressure);
    if (memory.ran >= maxTasks) {
      return { ok: false, reason: "count" };
    }

    const budget =
      typeof opts.cpuBudget === "number"
        ? Math.max(0, opts.cpuBudget)
        : getCpuBudget(settings, pressure);
    const used = Game.cpu ? Game.cpu.getUsed() - (memory.optionalCpuStart || 0) : 0;
    if (used >= budget) {
      return { ok: false, reason: "budget" };
    }

    return { ok: true, reason: "ready" };
  },

  recordSkip(key, reason) {
    const memory = this.beginTick();
    const task = memory.tasks[key] || {};
    task.lastSkipped = Game.time;
    task.lastSkipReason = reason || "skipped";
    memory.tasks[key] = task;

    if (reason === "interval") {
      memory.skipped++;
    } else {
      memory.deferred++;
    }
    memory.reasons[reason || "skipped"] =
      (memory.reasons[reason || "skipped"] || 0) + 1;
    this.updateSummary(memory);
  },

  recordRun(key, cpuUsed) {
    const settings = getSettings();
    const memory = this.beginTick();
    const task = memory.tasks[key] || {};
    task.lastRun = Game.time;
    task.lastCpu = Number((cpuUsed || 0).toFixed(3));
    task.lastSkipReason = null;
    memory.tasks[key] = task;
    memory.ran++;

    memory.recent.push({
      tick: Game.time,
      key: key,
      cpu: task.lastCpu,
    });
    while (memory.recent.length > settings.historySize) {
      memory.recent.shift();
    }

    this.updateSummary(memory);
  },

  runOptional(key, interval, fn, context) {
    const decision = this.canRunOptional(key, interval);
    if (!decision.ok) {
      this.recordSkip(key, decision.reason);
      return null;
    }

    const before = Game.cpu ? Game.cpu.getUsed() : 0;
    const result = fn.apply(context || null, Array.prototype.slice.call(arguments, 4));
    const after = Game.cpu ? Game.cpu.getUsed() : before;
    this.recordRun(key, Math.max(0, after - before));
    return result;
  },

  markOptionalRun(key, beforeCpu) {
    const after = Game.cpu ? Game.cpu.getUsed() : beforeCpu || 0;
    this.recordRun(key, Math.max(0, after - (beforeCpu || after)));
  },

  updateSummary(memory) {
    const target = memory || ensureMemory();
    target.summary = {
      tick: Game.time,
      ran: target.ran || 0,
      deferred: target.deferred || 0,
      skipped: target.skipped || 0,
      reasons: target.reasons || {},
      recent: (target.recent || []).slice(-5),
    };
    if (!Memory.stats) Memory.stats = {};
    Memory.stats.scheduler = target.summary;
    return target.summary;
  },

  getSummary() {
    const memory = ensureMemory();
    return memory.summary || this.updateSummary(memory);
  },
};
