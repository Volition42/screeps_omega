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

    this.drawSummary(room, state);

    if (
      config.HUD.CREEP_LABELS &&
      Game.time % config.HUD.LABEL_INTERVAL === 0
    ) {
      this.drawCreepLabels(room, state);
    }
  },

  drawSummary(room, state) {
    const report = roomReporting.build(room, state, { updateProgress: true });
    this.drawPanel(room, report.hudLines, report);
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
    if (line.indexOf("Safe") === 0) return "#ffd166";
    if (line.indexOf("Build") === 0) return "#caffbf";
    if (line.indexOf("Energy") === 0) return "#f8fafc";

    return "#d6f4ff";
  },

  drawCreepLabels(room, state) {
    const creeps = state.homeCreeps || [];

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

  getCreepLabel(role, creep) {
    switch (role) {
      case "jrworker":
        return "J";
      case "worker":
        return "W";
      case "miner":
        return "M";
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
      default:
        return "#e0fbff";
    }
  },
};
