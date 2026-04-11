/*
Developer Summary:
Lean room HUD.

Purpose:
- Keep room visuals short and phase-focused
- Surface only the information that matters at a glance
- Leave detailed reads to ops.room(...)
*/

const config = require("config");
const opsState = require("ops_state");
const roomReporting = require("room_reporting");

module.exports = {
  run(room, state) {
    if (!opsState.getHudEnabled()) return;

    if (this.isRoomSummaryEnabled()) {
      this.drawSummary(room, state);
    }

    if (this.isCreepLabelsEnabled() && this.shouldDrawCreepLabels()) {
      this.drawCreepLabels(room, state);
    }
  },

  drawSummary(room, state) {
    const report = this.getSummaryReport(room, state);
    this.drawPanel(room, report.hudLines, report);
  },

  getSummaryReport(room, state) {
    const cache = this.getHudCache(room);
    const interval = this.getRoomSummaryInterval();
    const phase = state && state.phase ? state.phase : null;
    const rcl = room.controller ? room.controller.level : 0;
    const alertActive = this.hasAlert(state);
    const needsRefresh =
      !cache.tick ||
      !cache.hudLines ||
      Game.time - cache.tick >= interval ||
      cache.phase !== phase ||
      cache.rcl !== rcl ||
      alertActive ||
      cache.alertActive;

    if (needsRefresh) {
      const report = roomReporting.build(room, state, { updateProgress: true });
      cache.tick = Game.time;
      cache.hudLines = report.hudLines;
      cache.phase = report.state && report.state.phase ? report.state.phase : phase;
      cache.rcl = rcl;
      cache.alertActive = report.alert ? report.alert.active : false;

      return report;
    }

    return {
      hudLines: cache.hudLines,
      alert: {
        active: !!cache.alertActive,
      },
      state: {
        phase: cache.phase || phase || "bootstrap",
      },
    };
  },

  getHudCache(room) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].hud) {
      Memory.rooms[room.name].hud = {};
    }

    return Memory.rooms[room.name].hud;
  },

  isRoomSummaryEnabled() {
    return !(config.HUD && config.HUD.ROOM_SUMMARY === false);
  },

  isCreepLabelsEnabled() {
    return !!(config.HUD && config.HUD.CREEP_LABELS);
  },

  getRoomSummaryInterval() {
    return config.HUD && config.HUD.ROOM_SUMMARY_INTERVAL
      ? Math.max(1, config.HUD.ROOM_SUMMARY_INTERVAL)
      : 1;
  },

  hasAlert(state) {
    if (!state) return false;
    if (state.defense && state.defense.hasThreats) return true;
    return !!(
      state.defense &&
      state.defense.homeThreat &&
      state.defense.homeThreat.hostileCount > 0
    );
  },

  drawPanel(room, lines, report) {
    const alertActive = report && report.alert ? report.alert.active : false;
    const phase = report && report.state ? report.state.phase || "bootstrap" : "bootstrap";
    const phaseColor = alertActive
      ? "#ff4d4d"
      : phase === "bootstrap"
        ? "#ffb347"
        : phase === "command"
          ? "#38ff9c"
          : "#39d5ff";
    const width = 17.2;
    const x = 0.6;
    const y = 0.45;
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
      fill: alertActive ? "#ff4d4d" : "#39d5ff",
      opacity: 0.35,
      stroke: alertActive ? "#ff4d4d" : "#39d5ff",
      strokeWidth: 0,
    });

    for (let i = 0; i < lines.length; i++) {
      const isHeader = i === 0;
      const yPos = y + 0.75 + i * 0.88;

      room.visual.text(lines[i], x + 0.4, yPos, {
        align: "left",
        color: this.getPanelLineColor(lines[i], isHeader),
        font: isHeader ? 0.82 : 0.6,
        opacity: isHeader ? 1 : 0.94,
      });
    }
  },

  getPanelLineColor(line, isHeader) {
    if (isHeader) return "#e0fbff";
    if (line.indexOf("Hostiles") === 0) return "#ffadad";
    if (line.indexOf("Focus") === 0) return "#a7f3d0";
    if (line.indexOf("Mineral") === 0) return "#ffd166";
    if (line.indexOf("Safe") === 0) return "#ffd166";
    if (line.indexOf("Build") === 0) return "#caffbf";
    if (line.indexOf("Energy") === 0) return "#f8fafc";

    return "#d6f4ff";
  },

  drawCreepLabels(room, state) {
    const creeps = state.creeps || state.homeCreeps || [];

    for (let i = 0; i < creeps.length; i++) {
      const creep = creeps[i];
      if (!creep.pos || creep.pos.roomName !== room.name) continue;

      room.visual.text(
        this.getCreepLabel(creep.memory.role, creep),
        creep.pos.x,
        creep.pos.y - 0.75,
        {
          align: "center",
          color: this.getCreepLabelColor(creep.memory.role, creep),
          font: 0.42,
          opacity: 0.9,
        },
      );
    }
  },

  shouldDrawCreepLabels() {
    const interval =
      config.HUD && config.HUD.LABEL_INTERVAL ? config.HUD.LABEL_INTERVAL : 1;
    if (interval <= 1) return true;

    return Game.time % interval === 0;
  },

  getCreepLabel(role, creep) {
    switch (role) {
      case "jrworker":
        return "J";
      case "worker":
        return "W";
      case "miner":
        return "M";
      case "mineral_miner":
        return "Mm";
      case "hauler":
        return "H";
      case "upgrader":
        return "U";
      case "repair":
        return "R";
      case "defender":
        return creep && creep.memory && creep.memory.defenseType === "home_invasion"
          ? "D!"
          : "D";
      case "claimer":
        return "Cl";
      case "pioneer":
        return "Pi";
      default:
        return "?";
    }
  },

  getCreepLabelColor(role, creep) {
    switch (role) {
      case "jrworker":
        return "#ffd166";
      case "worker":
        return "#8ecae6";
      case "miner":
        return "#ffb703";
      case "mineral_miner":
        return "#fb8500";
      case "hauler":
        return "#90be6d";
      case "upgrader":
        return "#c77dff";
      case "repair":
        return "#f28482";
      case "defender":
        return creep && creep.memory && creep.memory.defenseType === "home_invasion"
          ? "#ff4d4d"
          : "#ff8fa3";
      case "claimer":
        return "#80ed99";
      case "pioneer":
        return "#4cc9f0";
      default:
        return "#e0fbff";
    }
  },
};
