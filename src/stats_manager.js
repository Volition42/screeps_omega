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
*/

module.exports = {
  record(snapshot) {
    if (!Memory.stats) Memory.stats = {};
    if (!Memory.stats.history) Memory.stats.history = [];
    if (!Memory.stats.averages) Memory.stats.averages = {};
    if (!Memory.stats.max) Memory.stats.max = {};

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

    this.printDebugCpu(snapshot);
  },

  shouldProfileSections() {
    const directives = config.DIRECTIVES || {};

    if (!directives.DEBUG_CPU_CONSOLE_ENABLED) return false;
    if (!directives.DEBUG_CPU_SHOW_SECTIONS) return false;

    const runtime = this.getRuntimeMode();
    if (runtime && runtime.forceOverview === true) {
      return false;
    }

    return true;
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
    };
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

    if (!this.shouldProfileSections()) return;

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
    return {
      pressure: "normal",
      effectiveLimit: this.getSoftCpuLimit(),
      actualLimit: Game.cpu && Game.cpu.limit ? Game.cpu.limit : 20,
      forceOverview: false,
      thinkIntervalMultiplier: 1,
      constructionIntervalMultiplier: 1,
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
    const thinkMultiplier = policy.THINK_INTERVAL_MULTIPLIER || {};
    const constructionMultiplier = policy.CONSTRUCTION_INTERVAL_MULTIPLIER || {};

    return {
      pressure: pressure,
      effectiveLimit: limit,
      actualLimit: actualLimit,
      forceOverview:
        pressure !== "normal" &&
        policy.DETAIL_DOWNGRADE_AT_TIGHT === true,
      thinkIntervalMultiplier:
        Object.prototype.hasOwnProperty.call(thinkMultiplier, pressureKey)
          ? thinkMultiplier[pressureKey]
          : 1,
      constructionIntervalMultiplier:
        Object.prototype.hasOwnProperty.call(constructionMultiplier, pressureKey)
          ? constructionMultiplier[pressureKey]
          : 1,
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
