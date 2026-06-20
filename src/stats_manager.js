const config = require("config");

/*
Developer Note:
Rolling CPU / colony stats recorder.

Purpose:
- Keep a short performance history in Memory
- Store last snapshot and rolling averages
- Feed directive-facing CPU summaries and optional debug console output

Memory layout:
Memory.stats.last
Memory.stats.history
Memory.stats.averages
Memory.stats.max
Memory.stats.rooms
*/

const ROOM_SECTION_LABELS = {
  "state.collect": "room_state",
  construction: "construction_manager",
  links: "link_manager",
  towers: "tower_manager",
  advancedOps: "advanced_structure_manager",
  spawn: "spawn_manager",
  creeps: "creep_manager",
  power: "power_manager",
  sign: "controller_signer",
  directives: "directive_manager",
  hud: "hud",
};

module.exports = {
  record(snapshot) {
    if (!Memory.stats) Memory.stats = {};
    if (!Memory.stats.history) Memory.stats.history = [];
    if (!Memory.stats.averages) Memory.stats.averages = {};
    if (!Memory.stats.max) Memory.stats.max = {};
    if (!Memory.stats.rooms) Memory.stats.rooms = {};

    const history = Memory.stats.history;
    const creepCount = Object.keys(Game.creeps).length;
    const roomCount = this.getOwnedRoomCount();

    history.push({
      tick: snapshot.tick,
      cpuUsed: snapshot.cpu.used,
      bucket: snapshot.cpu.bucket,
      creepCount: creepCount,
      roomCount: roomCount,
    });

    const maxHistory = 100;
    while (history.length > maxHistory) {
      history.shift();
    }

    this.finalizeCpuMeasurement(snapshot);
    history[history.length - 1].cpuUsed = snapshot.cpu.used;

    const averages = this.computeAverages(history);
    const runtime = this.computeRuntimeMode(snapshot, averages);

    Memory.stats.last = this.buildStoredSnapshot(
      snapshot,
      creepCount,
      roomCount,
      runtime,
    );
    Memory.stats.averages = averages;
    Memory.stats.max = this.computeMax(history);
    Memory.stats.runtime = runtime;
    this.recordRoomCpu(snapshot, runtime);

    this.printDebugCpu(snapshot);
  },

  shouldProfileSections() {
    const roomCpu = this.getRoomCpuSettings();
    if (roomCpu.enabled) return true;

    const directives = config.DIRECTIVES || {};

    if (!directives.DEBUG_CPU_CONSOLE_ENABLED) return false;
    if (!directives.DEBUG_CPU_SHOW_SECTIONS) return false;

    const runtime = this.getRuntimeMode();
    if (runtime && runtime.forceOverview === true) {
      return false;
    }

    return true;
  },

  getRoomCpuSettings() {
    const settings = config.STATS && config.STATS.ROOM_CPU
      ? config.STATS.ROOM_CPU
      : {};

    return {
      enabled: settings.ENABLED !== false,
      averageAlpha:
        typeof settings.AVERAGE_ALPHA === "number" &&
        settings.AVERAGE_ALPHA > 0 &&
        settings.AVERAGE_ALPHA <= 1
          ? settings.AVERAGE_ALPHA
          : 0.2,
      maxRoomAge:
        typeof settings.MAX_ROOM_AGE === "number" && settings.MAX_ROOM_AGE > 0
          ? settings.MAX_ROOM_AGE
          : 1000,
      pressureHistoryWindow:
        typeof settings.PRESSURE_HISTORY_WINDOW === "number" &&
        settings.PRESSURE_HISTORY_WINDOW > 1
          ? Math.floor(settings.PRESSURE_HISTORY_WINDOW)
          : 25,
    };
  },

  finalizeCpuMeasurement(snapshot) {
    if (!snapshot || !snapshot.cpu) return;

    const finalUsed = Number(Game.cpu.getUsed().toFixed(3));
    const delta = Math.max(0, finalUsed - (snapshot.cpu.used || 0));

    snapshot.cpu.used = finalUsed;
    snapshot.cpu.tickCost = Number(((snapshot.cpu.tickCost || 0) + delta).toFixed(3));
  },

  buildStoredSnapshot(snapshot, creepCount, roomCount, runtime) {
    return {
      tick: snapshot.tick,
      cpu: {
        used: snapshot.cpu.used,
        tickCost: snapshot.cpu.tickCost,
        limit: snapshot.cpu.limit,
        tickLimit: snapshot.cpu.tickLimit,
        bucket: snapshot.cpu.bucket,
      },
      creepCount: creepCount,
      roomCount: roomCount,
      pressure: runtime ? runtime.pressure : "normal",
      scheduler:
        Memory.stats && Memory.stats.scheduler
          ? Memory.stats.scheduler
          : null,
      hud:
        Memory.stats && Memory.stats.hud
          ? Memory.stats.hud
          : null,
      roomState:
        Memory.stats && Memory.stats.roomState
          ? Memory.stats.roomState
          : null,
    };
  },

  recordRoomCpu(snapshot, runtime) {
    const settings = this.getRoomCpuSettings();
    if (!settings.enabled || !snapshot || !snapshot.sections) return;
    if (!Memory.stats.rooms) Memory.stats.rooms = {};

    const sections = snapshot.sections;
    const activeRooms = {};

    for (const label in sections) {
      if (!Object.prototype.hasOwnProperty.call(sections, label)) continue;
      if (label.indexOf("room.") !== 0) continue;

      const parts = label.split(".");
      const roomName = parts[1];
      if (!roomName || parts.length < 2) continue;

      activeRooms[roomName] = true;
    }

    for (const roomName in activeRooms) {
      if (!Object.prototype.hasOwnProperty.call(activeRooms, roomName)) continue;
      this.recordOneRoomCpu(roomName, snapshot, runtime, settings);
    }

    this.pruneRoomCpu(settings.maxRoomAge);
  },

  recordOneRoomCpu(roomName, snapshot, runtime, settings) {
    const sections = snapshot.sections || {};
    const roomLabel = `room.${roomName}`;
    const total = sections[roomLabel] ? sections[roomLabel].total : 0;
    const previous =
      Memory.stats.rooms &&
      Memory.stats.rooms[roomName] &&
      Memory.stats.rooms[roomName].cpu
        ? Memory.stats.rooms[roomName].cpu
        : null;
    const average = this.updateAverage(
      previous ? previous.average : null,
      total,
      settings.averageAlpha,
    );
    const peak = this.updateRollingPeak(
      previous ? previous.peak : null,
      total,
      settings.pressureHistoryWindow,
    );
    const minimum = this.updateRollingMinimum(
      previous ? previous.minimum : null,
      total,
      settings.pressureHistoryWindow,
    );
    const pressure =
      runtime && runtime.pressure ? runtime.pressure : "normal";
    const sectionRows = this.buildRoomSectionCpuRows(
      roomName,
      sections,
      previous,
      settings.averageAlpha,
    );
    const liveRoom =
      Memory.runtime && Memory.runtime.rooms
        ? Memory.runtime.rooms[roomName] || null
        : null;
    const scheduler = this.buildRoomSchedulerCpuSummary(roomName);
    const hud = this.buildRoomHudCpuSummary(roomName);
    const roomStateCache = this.buildRoomStateCacheSummary();

    if (!Memory.stats.rooms[roomName]) Memory.stats.rooms[roomName] = {};
    Memory.stats.rooms[roomName].cpu = {
      tick: snapshot.tick,
      current: Number(total.toFixed(3)),
      average: average,
      peak: peak,
      minimum: minimum,
      pressure: pressure,
      pressureCounts: this.updatePressureCounts(
        previous ? previous.pressureCounts : null,
        pressure,
        settings.pressureHistoryWindow,
      ),
      creepCount: this.countRoomCreeps(liveRoom),
      phase: liveRoom ? liveRoom.phase : null,
      rcl: liveRoom ? liveRoom.controllerLevel : null,
      sections: sectionRows,
      hotspots: this.buildRoomHotspots(sectionRows, settings),
      scheduler: scheduler,
      hud: hud,
      roomStateCache: roomStateCache,
    };
  },

  buildRoomHudCpuSummary(roomName) {
    const hudStats =
      Memory.stats && Memory.stats.hud && Memory.stats.hud[roomName]
        ? Memory.stats.hud[roomName]
        : null;

    return hudStats
      ? {
          tick: hudStats.tick || null,
          status: hudStats.status || "unknown",
          reason: hudStats.reason || null,
        }
      : null;
  },

  buildRoomStateCacheSummary() {
    const stats =
      Memory.stats && Memory.stats.roomState ? Memory.stats.roomState : null;

    return stats
      ? {
          tick: stats.tick || null,
          hits: stats.hits || 0,
          misses: stats.misses || 0,
        }
      : null;
  },

  buildRoomSectionCpuRows(roomName, sections, previous, alpha) {
    const rows = [];
    const previousByLabel = {};
    const previousSections = previous && previous.sections ? previous.sections : [];

    for (let i = 0; i < previousSections.length; i++) {
      previousByLabel[previousSections[i].label] = previousSections[i];
    }

    for (const suffix in ROOM_SECTION_LABELS) {
      if (!Object.prototype.hasOwnProperty.call(ROOM_SECTION_LABELS, suffix)) {
        continue;
      }

      const label = ROOM_SECTION_LABELS[suffix];
      const profilerLabel = `room.${roomName}.${suffix}`;
      const measured = sections[profilerLabel] || null;
      const previousRow = previousByLabel[label] || null;
      const current = measured ? measured.total : null;
      const average =
        current === null
          ? previousRow && typeof previousRow.average === "number"
            ? previousRow.average
            : null
          : this.updateAverage(
              previousRow ? previousRow.average : null,
              current,
              alpha,
            );

      rows.push({
        label: label,
        current: current === null ? null : Number(current.toFixed(3)),
        average: average,
        calls: measured ? measured.calls : 0,
        lastTick: measured ? Game.time : previousRow ? previousRow.lastTick : null,
      });
    }

    rows.sort(function (a, b) {
      const aCost = typeof a.current === "number" ? a.current : -1;
      const bCost = typeof b.current === "number" ? b.current : -1;
      if (bCost !== aCost) return bCost - aCost;
      return String(a.label).localeCompare(String(b.label));
    });

    return rows;
  },

  updateAverage(previous, current, alpha) {
    const value = typeof current === "number" && isFinite(current) ? current : 0;
    if (typeof previous !== "number" || !isFinite(previous)) {
      return Number(value.toFixed(3));
    }

    return Number((previous * (1 - alpha) + value * alpha).toFixed(3));
  },

  updateRollingPeak(previous, current, window) {
    const value = typeof current === "number" && isFinite(current) ? current : 0;
    if (typeof previous !== "number" || !isFinite(previous)) {
      return Number(value.toFixed(3));
    }
    if (value >= previous) return Number(value.toFixed(3));

    const alpha = 1 / Math.max(2, window || 25);
    return Number((previous * (1 - alpha) + value * alpha).toFixed(3));
  },

  updateRollingMinimum(previous, current, window) {
    const value = typeof current === "number" && isFinite(current) ? current : 0;
    if (typeof previous !== "number" || !isFinite(previous)) {
      return Number(value.toFixed(3));
    }
    if (value <= previous) return Number(value.toFixed(3));

    const alpha = 1 / Math.max(2, window || 25);
    return Number((previous * (1 - alpha) + value * alpha).toFixed(3));
  },

  updatePressureCounts(previous, pressure, window) {
    const counts = {
      normal: 0,
      tight: 0,
      critical: 0,
    };
    const decay = (Math.max(2, window || 25) - 1) / Math.max(2, window || 25);

    for (const key in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, key)) continue;
      const previousValue =
        previous && typeof previous[key] === "number" && isFinite(previous[key])
          ? previous[key]
          : 0;
      counts[key] = previousValue * decay;
    }

    if (!Object.prototype.hasOwnProperty.call(counts, pressure)) {
      pressure = "normal";
    }
    counts[pressure] += 1;

    for (const key in counts) {
      if (!Object.prototype.hasOwnProperty.call(counts, key)) continue;
      counts[key] = Number(counts[key].toFixed(1));
    }

    return counts;
  },

  buildRoomHotspots(sectionRows, settings) {
    const limit =
      settings && typeof settings.TOP_SECTION_LIMIT === "number"
        ? Math.max(1, settings.TOP_SECTION_LIMIT)
        : 6;
    const rows = (sectionRows || [])
      .filter(function (row) {
        return typeof row.average === "number";
      })
      .slice()
      .sort(function (a, b) {
        if (b.average !== a.average) return b.average - a.average;
        return String(a.label).localeCompare(String(b.label));
      })
      .slice(0, limit);

    return rows.map(function (row) {
      return {
        label: row.label,
        average: row.average,
        current: typeof row.current === "number" ? row.current : null,
      };
    });
  },

  countRoomCreeps(liveRoom) {
    if (!liveRoom || !liveRoom.roleCounts) return 0;

    let total = 0;
    for (const role in liveRoom.roleCounts) {
      if (!Object.prototype.hasOwnProperty.call(liveRoom.roleCounts, role)) {
        continue;
      }
      total += liveRoom.roleCounts[role] || 0;
    }

    return total;
  },

  buildRoomSchedulerCpuSummary(roomName) {
    const scheduler =
      Memory.runtime && Memory.runtime.scheduler
        ? Memory.runtime.scheduler
        : null;
    const tasks = scheduler && scheduler.tasks ? scheduler.tasks : {};
    const prefix = `room.${roomName}.`;
    const rows = [];
    let skippedThisTick = 0;

    for (const key in tasks) {
      if (!Object.prototype.hasOwnProperty.call(tasks, key)) continue;
      if (key.indexOf(prefix) !== 0) continue;

      const task = tasks[key] || {};
      if (task.lastSkipped === Game.time) skippedThisTick++;
      rows.push({
        key: key.slice(prefix.length),
        lastRun: task.lastRun || null,
        lastCpu: typeof task.lastCpu === "number" ? task.lastCpu : null,
        lastSkipped: task.lastSkipped || null,
        lastSkipReason: task.lastSkipReason || null,
      });
    }

    rows.sort(function (a, b) {
      return String(a.key).localeCompare(String(b.key));
    });

    return {
      tick: Game.time,
      skippedThisTick: skippedThisTick,
      tasks: rows,
    };
  },

  pruneRoomCpu(maxRoomAge) {
    if (!Memory.stats || !Memory.stats.rooms) return;

    for (const roomName in Memory.stats.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Memory.stats.rooms, roomName)) {
        continue;
      }
      const cpu = Memory.stats.rooms[roomName].cpu;
      if (!cpu || !cpu.tick || Game.time - cpu.tick > maxRoomAge) {
        delete Memory.stats.rooms[roomName];
      }
    }
  },

  printDebugCpu(snapshot) {
    if (!this.shouldDebugCpuConsole()) return;
    if (Game.time % this.getDebugCpuConsoleInterval() !== 0) return;

    const avgCpu =
      Memory.stats &&
      Memory.stats.averages &&
      typeof Memory.stats.averages.cpuUsed === "number"
        ? Memory.stats.averages.cpuUsed
        : snapshot.cpu.used;

    console.log(
      `[DBG][CPU] tick=${snapshot.tick} used=${snapshot.cpu.used.toFixed(2)} ` +
        `avg=${avgCpu.toFixed(3)} bucket=${snapshot.cpu.bucket} creeps=${Object.keys(Game.creeps).length}`,
    );

    if (!this.shouldPrintDebugCpuSections()) return;

    const sections = snapshot.sections || {};
    const overviewSections = this.getOverviewSections(sections);
    const sectionParts = [];

    for (const label in overviewSections) {
      const section = overviewSections[label];
      sectionParts.push(`${label}:${section.total}`);
    }

    if (sectionParts.length > 0) {
      console.log(`[DBG][CPU][SECTIONS] ${sectionParts.join(" | ")}`);
    }

    this.printDetailedSections(sections);
  },

  shouldDebugCpuConsole() {
    return !!(config.DIRECTIVES && config.DIRECTIVES.DEBUG_CPU_CONSOLE_ENABLED);
  },

  shouldPrintDebugCpuSections() {
    return !!(
      config.DIRECTIVES &&
      config.DIRECTIVES.DEBUG_CPU_CONSOLE_ENABLED &&
      config.DIRECTIVES.DEBUG_CPU_SHOW_SECTIONS
    );
  },

  getDebugCpuConsoleInterval() {
    return config.DIRECTIVES && config.DIRECTIVES.DEBUG_CPU_CONSOLE_INTERVAL
      ? config.DIRECTIVES.DEBUG_CPU_CONSOLE_INTERVAL
      : 100;
  },

  getOverviewSections(sections) {
    const overview = {};

    for (const label in sections) {
      if (!Object.prototype.hasOwnProperty.call(sections, label)) continue;

      const parts = label.split(".");
      if (
        parts.length <= 2 ||
        (parts.length === 2 && parts[0] === "room")
      ) {
        overview[label] = sections[label];
      }
    }

    return overview;
  },

  printDetailedSections(sections) {
    const grouped = this.groupDetailedSections(sections);

    for (const roomName in grouped) {
      if (!Object.prototype.hasOwnProperty.call(grouped, roomName)) continue;

      const roomGroup = grouped[roomName];
      const parts = [];

      if (roomGroup.total) {
        parts.push(`total:${roomGroup.total.toFixed(3)}`);
      }

      for (let i = 0; i < roomGroup.steps.length; i++) {
        parts.push(`${roomGroup.steps[i].label}:${roomGroup.steps[i].total.toFixed(3)}`);
      }

      if (parts.length > 0) {
        console.log(`[DBG][CPU][ROOM ${roomName}] ${parts.join(" | ")}`);
      }

      if (roomGroup.roles && roomGroup.roles.length > 0) {
        const roleParts = [];

        for (let i = 0; i < roomGroup.roles.length; i++) {
          roleParts.push(
            `${roomGroup.roles[i].label}:${roomGroup.roles[i].total.toFixed(3)}`,
          );
        }

        console.log(`[DBG][CPU][ROLES ${roomName}] ${roleParts.join(" | ")}`);
      }
    }
  },

  groupDetailedSections(sections) {
    const grouped = {};

    for (const label in sections) {
      if (!Object.prototype.hasOwnProperty.call(sections, label)) continue;
      if (label.indexOf("room.") !== 0) continue;

      const parts = label.split(".");
      const roomName = parts[1];

      if (!grouped[roomName]) {
        grouped[roomName] = {
          total: null,
          steps: [],
        };
      }

      if (parts.length === 2) {
        grouped[roomName].total = sections[label].total;
        continue;
      }

      if (parts[2] === "creeps" && parts[3] === "role") {
        if (!grouped[roomName].roles) {
          grouped[roomName].roles = [];
        }

        grouped[roomName].roles.push({
          label: parts[4],
          total: sections[label].total,
        });
        continue;
      }

      const detailLabel = parts.slice(2).join(".");
      const row = {
        label: detailLabel,
        total: sections[label].total,
      };

      grouped[roomName].steps.push(row);
    }

    for (const roomName in grouped) {
      if (!Object.prototype.hasOwnProperty.call(grouped, roomName)) continue;

      grouped[roomName].steps.sort(function (a, b) {
        return b.total - a.total;
      });
      grouped[roomName].roles = grouped[roomName].roles || [];
      grouped[roomName].roles.sort(function (a, b) {
        return b.total - a.total;
      });
    }

    return grouped;
  },

  getRuntimeMode() {
    if (Memory.stats && Memory.stats.runtime) {
      return Memory.stats.runtime;
    }

    return this.getDefaultRuntimeMode();
  },

  getDefaultRuntimeMode() {
    const policy =
      config.STATS && config.STATS.RUNTIME_POLICY
        ? config.STATS.RUNTIME_POLICY
        : {};
    const scaled = this.getScaledRuntimeValues(
      policy,
      "normal",
      this.getOwnedRoomCount(),
    );

    return {
      pressure: "normal",
      effectiveLimit: this.getSoftCpuLimit(),
      actualLimit: Game.cpu && Game.cpu.limit ? Game.cpu.limit : 20,
      forceOverview: false,
      thinkIntervalMultiplier: scaled.thinkIntervalMultiplier,
      constructionIntervalMultiplier: scaled.constructionIntervalMultiplier,
      advancedOpsInterval: scaled.advancedOpsInterval,
      roomScaleActive: scaled.roomScaleActive,
      skipDirectives: false,
      skipHud: false,
    };
  },

  getSoftCpuLimit() {
    const policy =
      config.STATS && config.STATS.RUNTIME_POLICY
        ? config.STATS.RUNTIME_POLICY
        : {};
    const actualLimit = Game.cpu && Game.cpu.limit ? Game.cpu.limit : 20;
    const configured =
      typeof policy.SOFT_CPU_LIMIT === "number" && policy.SOFT_CPU_LIMIT > 0
        ? policy.SOFT_CPU_LIMIT
        : actualLimit;

    return Math.max(1, Math.min(actualLimit, configured));
  },

  isPastSoftCpuLimit(buffer) {
    const margin = typeof buffer === "number" ? buffer : 0;
    return Game.cpu.getUsed() >= this.getSoftCpuLimit() - margin;
  },

  computeRuntimeMode(snapshot, averages) {
    const policy =
      config.STATS && config.STATS.RUNTIME_POLICY
        ? config.STATS.RUNTIME_POLICY
        : {};
    const actualLimit = snapshot && snapshot.cpu && snapshot.cpu.limit
      ? snapshot.cpu.limit
      : 20;
    const softLimit =
      typeof policy.SOFT_CPU_LIMIT === "number" && policy.SOFT_CPU_LIMIT > 0
        ? policy.SOFT_CPU_LIMIT
        : actualLimit;
    const limit = Math.max(1, Math.min(actualLimit, softLimit));
    const used = snapshot && snapshot.cpu ? snapshot.cpu.used : 0;
    const avg = averages && typeof averages.cpuUsed === "number"
      ? averages.cpuUsed
      : used;
    const bucket = snapshot && snapshot.cpu ? snapshot.cpu.bucket : 10000;

    let pressure = "normal";

    if (
      used >= limit * (policy.CRITICAL_CPU_RATIO || 0.92) ||
      avg >= limit * (policy.CRITICAL_CPU_RATIO || 0.92) ||
      bucket <= (policy.CRITICAL_BUCKET || 4000)
    ) {
      pressure = "critical";
    } else if (
      used >= limit * (policy.TIGHT_CPU_RATIO || 0.8) ||
      avg >= limit * (policy.TIGHT_CPU_RATIO || 0.8) ||
      bucket <= (policy.TIGHT_BUCKET || 8000)
    ) {
      pressure = "tight";
    }

    const pressureKey = pressure;
    const roomCount =
      averages && typeof averages.roomCount === "number"
        ? averages.roomCount
        : this.getOwnedRoomCount();
    const scaled = this.getScaledRuntimeValues(policy, pressureKey, roomCount);

    return {
      pressure: pressure,
      effectiveLimit: limit,
      actualLimit: actualLimit,
      forceOverview:
        pressure !== "normal" &&
        policy.DETAIL_DOWNGRADE_AT_TIGHT === true,
      thinkIntervalMultiplier: scaled.thinkIntervalMultiplier,
      constructionIntervalMultiplier: scaled.constructionIntervalMultiplier,
      advancedOpsInterval: scaled.advancedOpsInterval,
      roomScaleActive: scaled.roomScaleActive,
      skipDirectives: this.shouldSkipAtPressure(
        pressure,
        policy.SKIP_DIRECTIVES_AT,
      ),
      skipHud: this.shouldSkipAtPressure(
        pressure,
        policy.SKIP_HUD_AT,
      ),
    };
  },

  getScaledRuntimeValues(policy, pressureKey, roomCount) {
    const thinkMultiplier = policy.THINK_INTERVAL_MULTIPLIER || {};
    const constructionMultiplier = policy.CONSTRUCTION_INTERVAL_MULTIPLIER || {};
    const baseThink = Object.prototype.hasOwnProperty.call(
      thinkMultiplier,
      pressureKey,
    )
      ? thinkMultiplier[pressureKey]
      : 1;
    const baseConstruction = Object.prototype.hasOwnProperty.call(
      constructionMultiplier,
      pressureKey,
    )
      ? constructionMultiplier[pressureKey]
      : 1;
    const roomScale = this.getRoomScale(policy, roomCount);

    return {
      thinkIntervalMultiplier: Math.max(baseThink, roomScale.thinkMultiplier),
      constructionIntervalMultiplier: Math.max(
        baseConstruction,
        roomScale.constructionMultiplier,
      ),
      advancedOpsInterval: Math.max(1, roomScale.advancedOpsInterval),
      roomScaleActive: roomScale.active,
    };
  },

  getRoomScale(policy, roomCount) {
    const scale = policy.ROOM_SCALE || {};
    const rooms = Math.max(0, Math.floor(roomCount || 0));
    const startRooms =
      typeof scale.START_ROOMS === "number" ? scale.START_ROOMS : 3;

    if (scale.ENABLED === false || rooms < startRooms) {
      return {
        active: false,
        thinkMultiplier: 1,
        constructionMultiplier: 1,
        advancedOpsInterval: 1,
      };
    }

    const extraRooms = rooms - startRooms + 1;
    const thinkStep =
      typeof scale.THINK_STEP === "number" ? scale.THINK_STEP : 0.5;
    const constructionStep =
      typeof scale.CONSTRUCTION_STEP === "number" ? scale.CONSTRUCTION_STEP : 1;
    const advancedOpsStep =
      typeof scale.ADVANCED_OPS_STEP === "number" ? scale.ADVANCED_OPS_STEP : 1;
    const maxThink =
      typeof scale.MAX_THINK_MULTIPLIER === "number"
        ? scale.MAX_THINK_MULTIPLIER
        : 3;
    const maxConstruction =
      typeof scale.MAX_CONSTRUCTION_MULTIPLIER === "number"
        ? scale.MAX_CONSTRUCTION_MULTIPLIER
        : 4;
    const maxAdvancedOps =
      typeof scale.MAX_ADVANCED_OPS_INTERVAL === "number"
        ? scale.MAX_ADVANCED_OPS_INTERVAL
        : 6;

    return {
      active: true,
      thinkMultiplier: Math.min(maxThink, 1 + extraRooms * thinkStep),
      constructionMultiplier: Math.min(
        maxConstruction,
        1 + extraRooms * constructionStep,
      ),
      advancedOpsInterval: Math.ceil(
        Math.min(maxAdvancedOps, 1 + extraRooms * advancedOpsStep),
      ),
    };
  },

  shouldSkipAtPressure(pressure, threshold) {
    if (!threshold) return false;
    if (threshold === "tight") {
      return pressure === "tight" || pressure === "critical";
    }

    if (threshold === "critical") {
      return pressure === "critical";
    }

    return false;
  },

  getOwnedRoomCount() {
    let count = 0;

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller && room.controller.my) {
        count++;
      }
    }

    return count;
  },

  computeAverages(history) {
    if (!history.length) {
      return {
        cpuUsed: 0,
        bucket: 0,
        creepCount: 0,
        roomCount: 0,
      };
    }

    let cpuUsed = 0;
    let bucket = 0;
    let creepCount = 0;
    let roomCount = 0;

    for (const row of history) {
      cpuUsed += row.cpuUsed;
      bucket += row.bucket;
      creepCount += row.creepCount;
      roomCount += row.roomCount;
    }

    return {
      cpuUsed: Number((cpuUsed / history.length).toFixed(3)),
      bucket: Math.round(bucket / history.length),
      creepCount: Number((creepCount / history.length).toFixed(2)),
      roomCount: Number((roomCount / history.length).toFixed(2)),
    };
  },

  computeMax(history) {
    let cpuUsed = 0;
    let creepCount = 0;

    for (const row of history) {
      if (row.cpuUsed > cpuUsed) cpuUsed = row.cpuUsed;
      if (row.creepCount > creepCount) creepCount = row.creepCount;
    }

    return {
      cpuUsed,
      creepCount,
    };
  },
};
