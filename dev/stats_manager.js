const config = require("config");

/*
Developer Note:
Rolling CPU / colony stats recorder.

Purpose:
- Keep a short performance history in Memory
- Store last snapshot and rolling averages
- Print readable CPU summaries on an interval

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

    history.push({
      tick: snapshot.tick,
      cpuUsed: snapshot.cpu.used,
      bucket: snapshot.cpu.bucket,
      creepCount: Object.keys(Game.creeps).length,
      roomCount: this.getOwnedRoomCount(),
    });

    const maxHistory = 100;
    while (history.length > maxHistory) {
      history.shift();
    }

    Memory.stats.last = snapshot;
    Memory.stats.averages = this.computeAverages(history);
    Memory.stats.max = this.computeMax(history);
    Memory.stats.runtime = this.computeRuntimeMode(
      snapshot,
      Memory.stats.averages,
    );
  },

  print(snapshot) {
    var mode = this.getCpuConsoleMode();
    if (mode === "off") return;
    if (Game.time % this.getCpuPrintInterval() !== 0) return;

    const avgCpu =
      Memory.stats &&
      Memory.stats.averages &&
      typeof Memory.stats.averages.cpuUsed === "number"
        ? Memory.stats.averages.cpuUsed
        : snapshot.cpu.used;

    console.log(
      `[CPU] tick=${snapshot.tick} used=${snapshot.cpu.used.toFixed(2)} ` +
        `avg=${avgCpu.toFixed(3)} bucket=${snapshot.cpu.bucket} creeps=${Object.keys(Game.creeps).length}`,
    );

    const sections = snapshot.sections || {};
    const overviewSections = this.getOverviewSections(sections);
    const sectionParts = [];

    for (const label in overviewSections) {
      const section = overviewSections[label];
      sectionParts.push(`${label}:${section.total}`);
    }

    if (sectionParts.length > 0) {
      console.log(`[CPU:sections] ${sectionParts.join(" | ")}`);
    }

    if (mode !== "detail") return;

    this.printDetailedSections(sections);
  },

  getCpuConsoleMode() {
    var configured = config.STATS && config.STATS.CPU_CONSOLE_MODE
      ? config.STATS.CPU_CONSOLE_MODE
      : "overview";
    var runtime = this.getRuntimeMode();

    if (
      configured === "detail" &&
      runtime &&
      runtime.forceOverview === true
    ) {
      return "overview";
    }

    return configured;
  },

  getCpuPrintInterval() {
    return config.STATS && config.STATS.CPU_PRINT_INTERVAL
      ? config.STATS.CPU_PRINT_INTERVAL
      : 25;
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
        console.log(`[CPU:room ${roomName}] ${parts.join(" | ")}`);
      }

      if (roomGroup.roles && roomGroup.roles.length > 0) {
        const roleParts = [];

        for (let i = 0; i < roomGroup.roles.length; i++) {
          roleParts.push(
            `${roomGroup.roles[i].label}:${roomGroup.roles[i].total.toFixed(3)}`,
          );
        }

        console.log(`[CPU:roles ${roomName}] ${roleParts.join(" | ")}`);
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
      forceOverview: false,
      thinkIntervalMultiplier: 1,
      constructionIntervalMultiplier: 1,
      skipDirectives: false,
      skipHud: false,
    };
  },

  computeRuntimeMode(snapshot, averages) {
    const policy =
      config.STATS && config.STATS.RUNTIME_POLICY
        ? config.STATS.RUNTIME_POLICY
        : {};
    const limit = snapshot && snapshot.cpu && snapshot.cpu.limit
      ? snapshot.cpu.limit
      : 20;
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
