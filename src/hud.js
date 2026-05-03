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
const reservationManager = require("reservation_manager");
const attackManager = require("attack_manager");
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

  runReservedRooms() {
    if (!opsState.getHudEnabled()) return;

    const entries = reservationManager.getVisibleReservedRooms();
    for (let i = 0; i < entries.length; i++) {
      const room = entries[i].room;
      const report = reservationManager.getReservedRoomHudReport(room);
      if (!report) continue;

      if (this.isRoomSummaryEnabled()) {
        this.drawPanel(room, report.hudLines, report);
      }

      if (this.isCreepLabelsEnabled() && this.shouldDrawCreepLabels()) {
        this.drawCreepLabels(room, {
          creeps: room.find(FIND_MY_CREEPS),
          homeCreeps: [],
        });
      }
    }
  },

  runAttackRooms() {
    if (!opsState.getHudEnabled()) return;

    const entries = attackManager.getVisibleAttackRooms();
    for (let i = 0; i < entries.length; i++) {
      const room = entries[i].room;
      const report = attackManager.getAttackRoomHudReport(room);
      if (!report) continue;

      if (this.isRoomSummaryEnabled()) {
        this.drawPanel(room, report.hudLines, report);
        this.drawAttackMarkers(room, report);
      }

      if (this.isCreepLabelsEnabled() && this.shouldDrawCreepLabels()) {
        this.drawCreepLabels(room, {
          creeps: room.find(FIND_MY_CREEPS),
          homeCreeps: [],
        });
      }
    }
  },

  drawSummary(room, state) {
    const report = this.getSummaryReport(room, state);
    this.drawPanel(room, report.hudLines, report);
    this.drawAttackMarkers(room, report);
  },

  getSummaryReport(room, state) {
    const attackReport = attackManager.getOwnedRoomHudReport(room, state);
    if (attackReport) return attackReport;

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
    if (line.indexOf("RCL ") === 0) return "#bde0fe";
    if (line.indexOf("Hostiles") === 0) return "#ffadad";
    if (line.indexOf("Expansion") === 0) return "#a7f3d0";
    if (line.indexOf("Reserved") === 0) return "#a7f3d0";
    if (line.indexOf("Attack") === 0) return "#ff8fab";
    if (line.indexOf("Target") === 0) return "#ffb3c6";
    if (line.indexOf("Economy") === 0) return "#ffd166";
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
      case "remoteminer":
        return "RM";
      case "mineral_miner":
        return "Mm";
      case "hauler":
        return "H";
      case "remotehauler":
        return "RH";
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
      case "reserver":
        return "Rs";
      case "pioneer":
        return "Pi";
      case "remoteworker":
        return "RW";
      case "dismantler":
        return "Di";
      case "assault":
        return "A";
      case "combat_healer":
        return "He";
      case "controller_attacker":
        return "CA";
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
      case "remoteminer":
        return "#ffd166";
      case "mineral_miner":
        return "#fb8500";
      case "hauler":
        return "#90be6d";
      case "remotehauler":
        return "#52b788";
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
      case "reserver":
        return "#b7e4c7";
      case "pioneer":
        return "#4cc9f0";
      case "remoteworker":
        return "#48cae4";
      case "dismantler":
        return "#ff595e";
      case "assault":
        return "#ff006e";
      case "combat_healer":
        return "#f15bb5";
      case "controller_attacker":
        return "#ffbe0b";
      default:
        return "#e0fbff";
    }
  },

  drawAttackMarkers(room, report) {
    if (!report || !report.attack || !report.attack.plan) return;

    const plan = report.attack.plan;
    if (plan.targetRoom !== room.name) return;

    const controller = room.controller || null;
    const target = attackManager.getPrimaryTarget(room);
    if (controller) {
      room.visual.rect(controller.pos.x - 0.45, controller.pos.y - 0.45, 0.9, 0.9, {
        fill: "#ffbe0b",
        opacity: 0.12,
        stroke: "#ffbe0b",
        strokeWidth: 0.08,
      });
      room.visual.text("CTRL", controller.pos.x, controller.pos.y - 0.95, {
        align: "center",
        color: "#ffbe0b",
        font: 0.42,
        opacity: 0.9,
      });
    }

    if (target && target.pos && (!controller || !target.pos.isEqualTo(controller.pos))) {
      room.visual.rect(target.pos.x - 0.42, target.pos.y - 0.42, 0.84, 0.84, {
        fill: "#ff006e",
        opacity: 0.12,
        stroke: "#ff006e",
        strokeWidth: 0.08,
      });
      room.visual.text("TGT", target.pos.x, target.pos.y - 0.9, {
        align: "center",
        color: "#ff8fab",
        font: 0.42,
        opacity: 0.9,
      });
    }

    room.visual.text(`Rally ${plan.parentRoom || "?"}`, 25, 24.25, {
      align: "center",
      color: "#ffb3c6",
      font: 0.45,
      opacity: 0.75,
    });
  },
};
