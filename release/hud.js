/*
Developer Summary:
vCORP Command HUD
Codename: INFRASTRUCTURE

Purpose:
- Fast visual state awareness
- Minimal CPU overhead
- Clean sci-fi aesthetic with a polished corporate dashboard feel

Displayed data:
- Room / phase header
- Grid energy, spawn state, queue preview
- Creep role counts
- Controller container status
- Safe mode status / ETA
- Optional performance line
- Optional construction checklist
- Source utilization lines

Important Notes:
- Keep the current watermark position and lower text baseline unless explicitly changed.
- Avoid adding expensive visual effects here.
- HUD construction checklist reads from state.buildStatus so it stays synced with
  room_state, construction_manager, and directive_manager.

- ... 
*/

const config = require("config");
const utils = require("utils");

module.exports = {
  run(room, state) {
    if (!config.HUD.ENABLED) return;

    this.drawSummary(room, state);

    if (
      config.HUD.CREEP_LABELS &&
      Game.time % config.HUD.LABEL_INTERVAL === 0
    ) {
      this.drawCreepLabels(room);
    }

    if (Game.time % config.HUD.CONSOLE_INTERVAL === 0) {
      this.printConsole(room, state);
    }
  },

  drawSummary(room, state) {
    const counts = state.roleCounts || {};

    const queue =
      Memory.rooms &&
      Memory.rooms[room.name] &&
      Memory.rooms[room.name].spawnQueue
        ? Memory.rooms[room.name].spawnQueue
        : [];

    const nextQueued = queue.length > 0 ? queue[0].role.toUpperCase() : "NONE";
    const spawn = state.spawns[0];
    const spawning =
      spawn && spawn.spawning ? spawn.spawning.name.toUpperCase() : "IDLE";

    const safeModeLine = this.getSafeModeLine(room);
    const performanceLine = this.getPerformanceLine();
    const checklistLines = this.getConstructionChecklistLines(state);

    const sourceLines = _.map(
      state.sources,
      function (source) {
        const sourceContainer = utils.getSourceContainerBySource(
          room,
          source.id,
        );

        const minerCount = _.filter(Game.creeps, function (creep) {
          return (
            creep.memory.role === "miner" &&
            creep.memory.room === room.name &&
            creep.memory.sourceId === source.id
          );
        }).length;

        const haulerCount = _.filter(Game.creeps, function (creep) {
          return (
            creep.memory.role === "hauler" &&
            creep.memory.room === room.name &&
            creep.memory.sourceId === source.id
          );
        }).length;

        const desiredMiners = config.CREEPS.minersPerSource;
        const desiredHaulers = this.getDesiredHaulersForSource(source.id);

        const shortId = source.id.slice(-4).toUpperCase();
        const node = sourceContainer
          ? `BOX:${sourceContainer.store[RESOURCE_ENERGY] || 0}`
          : "RAW";

        const energyPct =
          source.energyCapacity > 0
            ? Math.round((source.energy / source.energyCapacity) * 100)
            : 0;

        return (
          `SRC ${shortId}   ` +
          `EN ${energyPct}%   ` +
          `M ${minerCount}/${desiredMiners}   ` +
          `H ${haulerCount}/${desiredHaulers}   ` +
          `${node}`
        );
      },
      this,
    );

    const controllerContainerLine = `CTRL BOX ${state.controllerContainers.length}/1`;

    const lines = [
      `vCORP // ${room.name} // ${state.phase.toUpperCase()}`,
      `GRID ${room.energyAvailable}/${room.energyCapacityAvailable}   SPAWN ${spawning}   QUEUE ${nextQueued}`,
      `ROLES J:${counts.jrworker || 0} W:${counts.worker || 0} M:${counts.miner || 0} H:${counts.hauler || 0} U:${counts.upgrader || 0} R:${counts.repair || 0}`,
      controllerContainerLine,
      safeModeLine,
    ];

    if (performanceLine) {
      lines.push(performanceLine);
    }

    if (checklistLines && checklistLines.length > 0) {
      Array.prototype.push.apply(lines, checklistLines);
    }

    Array.prototype.push.apply(lines, sourceLines);

    this.drawPanel(room, lines, state, {
      hasPerformanceLine: !!performanceLine,
      checklistCount: checklistLines ? checklistLines.length : 0,
    });
  },

  drawPanel(room, lines, state, meta) {
    const hostiles = room.find(FIND_HOSTILE_CREEPS).length > 0;
    const phase = state.phase || "bootstrap";

    const phaseColor = hostiles
      ? "#ff3b3b"
      : phase === "bootstrap_jr"
        ? "#ffb347"
        : phase === "stable"
          ? "#38ff9c"
          : "#39d5ff";

    const x = 0.6;
    const y = 0.45;
    const width = 17.8;
    const height = lines.length * 0.88 + 1.1;

    room.visual.rect(x, y, width, height, {
      fill: "#06131f",
      opacity: 0.18,
      stroke: "#3be7ff",
      strokeWidth: 0.05,
    });

    room.visual.rect(x - 0.18, y, 0.14, height, {
      fill: phaseColor,
      opacity: 0.85,
      stroke: phaseColor,
      strokeWidth: 0.02,
    });

    room.visual.rect(x, y, width, 0.22, {
      fill: "#39d5ff",
      opacity: 0.35,
      stroke: "#39d5ff",
      strokeWidth: 0.02,
    });

    // Watermark
    room.visual.text("vCORP", x + width + 1 - 1.2, y + 1.1, {
      align: "right",
      color: "#7befff",
      font: 0.9,
      opacity: 0.22,
      stroke: "#000000",
      strokeWidth: 0.08,
    });

    const perfIndex = meta.hasPerformanceLine ? 5 : -1;
    const checklistStart = meta.hasPerformanceLine ? 6 : 5;
    const checklistEnd = checklistStart + meta.checklistCount - 1;

    for (let i = 0; i < lines.length; i++) {
      const isPerfLine = meta.hasPerformanceLine && i === perfIndex;
      const isChecklistLine =
        meta.checklistCount > 0 && i >= checklistStart && i <= checklistEnd;

      room.visual.text(lines[i], x + 0.4, y + 1.2 + i * 0.82, {
        align: "left",
        color: isChecklistLine
          ? "#7ff7d4"
          : isPerfLine
            ? "#7bdcff"
            : i === 0
              ? "#b9f8ff"
              : "#8fe9ff",
        font: isChecklistLine ? 0.6 : isPerfLine ? 0.56 : i === 0 ? 0.82 : 0.68,
        opacity: isChecklistLine
          ? 0.8
          : isPerfLine
            ? 0.72
            : i === 0
              ? 0.98
              : 0.88,
        stroke: "#021018",
        strokeWidth: isChecklistLine ? 0.12 : isPerfLine ? 0.12 : 0.14,
      });
    }
  },

  getPerformanceLine() {
    if (!config.HUD.SHOW_PERFORMANCE) return null;
    if (!Memory.stats || !Memory.stats.last) {
      return "PERF CPU --.-- AVG --.-- BUCKET -----";
    }

    const last = Memory.stats.last;
    const avg =
      Memory.stats.averages && typeof Memory.stats.averages.cpuUsed === "number"
        ? Memory.stats.averages.cpuUsed
        : last.cpu.used;

    return (
      `PERF CPU ${last.cpu.used.toFixed(2)}   ` +
      `AVG ${avg.toFixed(2)}   ` +
      `BUCKET ${last.cpu.bucket}`
    );
  },

  getConstructionChecklistLines(state) {
    if (!config.HUD.SHOW_CONSTRUCTION_CHECKLIST) return [];

    const checklist = state.buildStatus;
    if (!checklist) return [];

    const mode = config.HUD.CONSTRUCTION_CHECKLIST_MODE || "detailed";

    if (mode === "compact") {
      return [
        `BUILD EXT ${checklist.extensionsBuilt}/${checklist.extensionsNeeded}   ` +
          `TWR ${checklist.towersBuilt}/${checklist.towersNeeded}   ` +
          `RD ${checklist.roadsBuilt}/${checklist.roadsNeeded}   ` +
          `W ${checklist.wallsBuilt}/${checklist.wallsNeeded}   ` +
          `R ${checklist.rampartsBuilt}/${checklist.rampartsNeeded}`,
      ];
    }

    return [
      `BUILD EXT ${checklist.extensionsBuilt}/${checklist.extensionsNeeded}   ` +
        `TWR ${checklist.towersBuilt}/${checklist.towersNeeded}   ` +
        `SITES ${checklist.sites}`,
      `BUILD RD ${checklist.roadsBuilt}/${checklist.roadsNeeded}   ` +
        `W ${checklist.wallsBuilt}/${checklist.wallsNeeded}   ` +
        `R ${checklist.rampartsBuilt}/${checklist.rampartsNeeded}`,
    ];
  },

  getSafeModeLine(room) {
    if (!room.controller) return "SAFE MODE N/A";

    if (room.controller.safeMode && room.controller.safeMode > 0) {
      return `SAFE MODE ACTIVE ${this.formatTicksAsDhM(room.controller.safeMode)}`;
    }

    if (
      (!room.controller.safeModeAvailable ||
        room.controller.safeModeAvailable <= 0) &&
      room.controller.safeModeCooldown &&
      room.controller.safeModeCooldown > 0
    ) {
      return `SAFE MODE COOLDOWN ${this.formatTicksAsDhM(room.controller.safeModeCooldown)}`;
    }

    if (
      room.controller.safeModeAvailable &&
      room.controller.safeModeAvailable > 0
    ) {
      return `SAFE MODE READY x${room.controller.safeModeAvailable}`;
    }

    return "SAFE MODE UNAVAILABLE";
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

  getDesiredHaulersForSource(sourceId) {
    const overrides = config.CREEPS.haulersPerSourceBySourceId || {};

    if (Object.prototype.hasOwnProperty.call(overrides, sourceId)) {
      return overrides[sourceId];
    }

    return config.CREEPS.haulersPerSourceDefault;
  },

  drawCreepLabels(room) {
    const creeps = room.find(FIND_MY_CREEPS);

    for (let i = 0; i < creeps.length; i++) {
      const creep = creeps[i];
      const label = this.getLabel(creep);

      room.visual.text(label, creep.pos.x, creep.pos.y - 0.75, {
        align: "center",
        font: 0.9,
        opacity: 0.95,
        stroke: "#001018",
        strokeWidth: 0.18,
        color: this.getLabelColor(creep),
      });
    }
  },

  getLabel(creep) {
    switch (creep.memory.role) {
      case "jrworker":
        return "J ⛏";
      case "worker":
        return `W ${creep.memory.working ? "🔧" : "⛏"}`;
      case "miner":
        return "M ⚡";
      case "hauler":
        return `H ${creep.memory.delivering ? "📦" : "↩"}`;
      case "upgrader":
        return "U ⬆";
      case "repair":
        return "R 🛠";
      default:
        return "? •";
    }
  },

  getLabelColor(creep) {
    switch (creep.memory.role) {
      case "jrworker":
        return "#d9fb8c";
      case "worker":
        return "#89ffb4";
      case "miner":
        return "#62d8ff";
      case "hauler":
        return "#e7fcff";
      case "upgrader":
        return "#7aaeff";
      case "repair":
        return "#7befff";
      default:
        return "#ffffff";
    }
  },

  printConsole(room, state) {
    const counts = state.roleCounts || {};

    console.log(
      `[ROOM ${room.name}] phase=${state.phase} ` +
        `energy=${room.energyAvailable}/${room.energyCapacityAvailable} ` +
        `roles J:${counts.jrworker || 0} W:${counts.worker || 0} M:${counts.miner || 0} H:${counts.hauler || 0} U:${counts.upgrader || 0} R:${counts.repair || 0}`,
    );
  },
};
