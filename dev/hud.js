/*
Developer Summary:
vCORP Command HUD

Purpose:
- Fast home-room state awareness
- Minimal CPU overhead
- Keep construction and role state readable at a glance

Displayed data:
- Home room only
- Room / phase header
- Grid energy, spawn state, queue preview
- Home creep role counts
- Safe mode status / ETA
- Optional performance line
- Optional construction checklist with roadmap and future-plan progress
- Source utilization lines

Important Notes:
- Remote-room HUD behavior has been removed from the current dev scope
- Keep the watermark position and lower text baseline stable unless needed
- Avoid adding expensive visual effects here
*/

const config = require("config");
const opsState = require("ops_state");

module.exports = {
  run(room, state) {
    if (!opsState.getHudEnabled()) return;

    const summaryInterval = Math.max(1, config.HUD.SUMMARY_INTERVAL || 1);
    const shouldDrawSummary =
      !config.HUD.LEAN_MODE || Game.time % summaryInterval === 0;

    if (shouldDrawSummary) {
      this.drawSummary(room, state);
    }

    if (
      config.HUD.CREEP_LABELS &&
      Game.time % config.HUD.LABEL_INTERVAL === 0
    ) {
      this.drawCreepLabels(room, state);
    }

    if (
      config.HUD.CONSOLE_ENABLED &&
      Game.time % config.HUD.CONSOLE_INTERVAL === 0
    ) {
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
    const spawn = state.spawns && state.spawns[0] ? state.spawns[0] : null;
    const spawning =
      spawn && spawn.spawning ? spawn.spawning.name.toUpperCase() : "IDLE";
    const safeModeLine = this.getSafeModeLine(room);
    const performanceLine = this.getPerformanceLine();
    const checklistLines = this.getConstructionChecklistLines(state);
    const sourceLines = this.getSourceLines(state);

    const lines = [
      "vCORP // " + room.name + " // " + state.phase.toUpperCase(),
      "GRID " +
        room.energyAvailable +
        "/" +
        room.energyCapacityAvailable +
        "   SPAWN " +
        spawning +
        "   QUEUE " +
        nextQueued,
      "ROLES J:" +
        (counts.jrworker || 0) +
        " D:" +
        (counts.defender || 0) +
        " W:" +
        (counts.worker || 0) +
        " M:" +
        (counts.miner || 0) +
        " H:" +
        (counts.hauler || 0) +
        " U:" +
        (counts.upgrader || 0) +
        " R:" +
        (counts.repair || 0),
      safeModeLine,
    ];

    if (performanceLine) {
      lines.push(performanceLine);
    }

    Array.prototype.push.apply(lines, checklistLines);
    Array.prototype.push.apply(lines, sourceLines);

    this.drawPanel(room, lines, state, {
      hasPerformanceLine: !!performanceLine,
      checklistCount: checklistLines.length,
    });
  },

  drawPanel(room, lines, state, meta) {
    const hostiles = state.hostileCreeps && state.hostileCreeps.length > 0;
    const phase = state.phase || "bootstrap";
    const phaseColor = hostiles
      ? "#ff3b3b"
      : phase === "bootstrap_jr"
        ? "#ffb347"
        : phase === "stable"
          ? "#38ff9c"
          : "#39d5ff";
    const width = 17.8;
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
      fill: "#39d5ff",
      opacity: 0.35,
      stroke: "#39d5ff",
      strokeWidth: 0,
    });

    room.visual.text("vCORP // HUD", x + width - 0.2, y + height + 0.28, {
      align: "right",
      color: "#4fc3f7",
      font: 0.45,
      opacity: 0.75,
    });

    for (let i = 0; i < lines.length; i++) {
      const isHeader = i === 0;
      const font = isHeader ? 0.85 : 0.6;
      const yPos = y + 0.75 + i * 0.88;
      const textColor = this.getPanelLineColor(lines[i], isHeader, meta);

      room.visual.text(lines[i], x + 0.4, yPos, {
        align: "left",
        color: textColor,
        font: font,
        opacity: isHeader ? 1 : 0.94,
      });
    }
  },

  getPanelLineColor(line, isHeader, meta) {
    if (isHeader) return "#e0fbff";
    if (line.indexOf("SAFE") === 0) return "#ffd166";
    if (line.indexOf("ROADMAP") === 0) return "#7befff";
    if (line.indexOf("BUILD") === 0) return "#89ffb4";
    if (line.indexOf("FUTURE") === 0) return "#a5f3fc";
    if (line.indexOf("ADV") === 0) return "#c4b5fd";
    if (line.indexOf("SRC") === 0) return "#caffbf";
    if (line.indexOf("CPU") === 0) return "#9ca3af";
    if (line.indexOf("ROLES") === 0) return "#f8fafc";

    return "#d6f4ff";
  },

  getSafeModeLine(room) {
    if (!room.controller || !room.controller.safeMode) {
      return "SAFE MODE OFF";
    }

    return "SAFE MODE " + room.controller.safeMode;
  },

  getPerformanceLine() {
    if (!config.HUD.SHOW_PERFORMANCE) return null;
    if (!Memory.stats || !Memory.stats.last || !Memory.stats.averages) return null;

    return (
      "CPU " +
      Memory.stats.last.cpu.used.toFixed(2) +
      " AVG " +
      Memory.stats.averages.cpuUsed.toFixed(2) +
      " BKT " +
      Memory.stats.last.cpu.bucket
    );
  },

  getConstructionChecklistLines(state) {
    if (!config.HUD.SHOW_CONSTRUCTION_CHECKLIST || !state.buildStatus) {
      return [];
    }

    const status = state.buildStatus;
    const mode = config.HUD.CONSTRUCTION_CHECKLIST_MODE || "detailed";
    const lines = [
      "ROADMAP " +
        String(status.roadmapPhase || state.phase || "bootstrap").toUpperCase() +
        "   " +
        (status.currentRoadmapReady ? "READY" : "BUILD"),
      "BUILD S:" +
        status.sourceContainersBuilt +
        "/" +
        status.sourceContainersNeeded +
        " E:" +
        status.extensionsBuilt +
        "/" +
        status.extensionsNeeded +
        " T:" +
        status.towersBuilt +
        "/" +
        status.towersNeeded,
      "FUTURE " + (status.futurePlanReady ? "READY" : "PLAN"),
    ];

    if (mode === "detailed") {
      lines.push(
        "ADV L:" +
          status.linksBuilt +
          "/" +
          status.linksNeeded +
          " TM:" +
          status.terminalBuilt +
          "/" +
          status.terminalNeeded +
          " LB:" +
          status.labsBuilt +
          "/" +
          status.labsNeeded,
      );
      lines.push(
        "ROADS " +
          status.roadsBuilt +
          "/" +
          status.roadsNeeded +
          " DEF " +
          status.wallsBuilt +
          "/" +
          status.wallsNeeded +
          " R " +
          status.rampartsBuilt +
          "/" +
          status.rampartsNeeded,
      );
    }

    return lines;
  },

  getSourceLines(state) {
    return _.map(
      state.sources || [],
      function (source) {
        const container = state.sourceContainersBySourceId[source.id];
        const miners = this.getRoleSourceCount(state, "miner", source.id);
        const haulers = this.getRoleSourceCount(state, "hauler", source.id);
        const desiredMiners = config.CREEPS.minersPerSource;
        const desiredHaulers = this.getDesiredHaulersForSource(source.id);
        const shortId = source.id.slice(-4).toUpperCase();
        const node = container
          ? "BOX:" + (container.store[RESOURCE_ENERGY] || 0)
          : "RAW";
        const energyPct =
          source.energyCapacity > 0
            ? Math.round((source.energy / source.energyCapacity) * 100)
            : 0;

        return (
          "SRC " +
          shortId +
          " EN " +
          energyPct +
          "% M " +
          miners +
          "/" +
          desiredMiners +
          " H " +
          haulers +
          "/" +
          desiredHaulers +
          " " +
          node
        );
      },
      this,
    );
  },

  drawCreepLabels(room, state) {
    const creeps = state.homeCreeps || [];

    for (let i = 0; i < creeps.length; i++) {
      const creep = creeps[i];
      if (!creep.pos || creep.pos.roomName !== room.name) continue;

      room.visual.text(
        this.getCreepLabel(creep.memory.role),
        creep.pos.x,
        creep.pos.y - 0.75,
        {
          align: "center",
          color: this.getCreepLabelColor(creep.memory.role),
          font: 0.42,
          opacity: 0.9,
        },
      );
    }
  },

  getCreepLabel(role) {
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
        return "D ⚔";
      default:
        return "?";
    }
  },

  getCreepLabelColor(role) {
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
        return "#ff6b6b";
      default:
        return "#e0fbff";
    }
  },

  printConsole(room, state) {
    const counts = state.roleCounts || {};

    console.log(
      "[ROOM " +
        room.name +
        "] phase=" +
        state.phase +
        " energy=" +
        room.energyAvailable +
        "/" +
        room.energyCapacityAvailable +
        " roles J:" +
        (counts.jrworker || 0) +
        " D:" +
        (counts.defender || 0) +
        " W:" +
        (counts.worker || 0) +
        " M:" +
        (counts.miner || 0) +
        " H:" +
        (counts.hauler || 0) +
        " U:" +
        (counts.upgrader || 0) +
        " R:" +
        (counts.repair || 0),
    );
  },

  getRoleSourceCount(state, role, sourceId) {
    if (
      !state.sourceRoleMap ||
      !state.sourceRoleMap[role] ||
      !state.sourceRoleMap[role][sourceId]
    ) {
      return 0;
    }

    return state.sourceRoleMap[role][sourceId].length;
  },

  getDesiredHaulersForSource(sourceId) {
    const overrides = config.CREEPS.haulersPerSourceBySourceId || {};

    if (Object.prototype.hasOwnProperty.call(overrides, sourceId)) {
      return overrides[sourceId];
    }

    return 1;
  },
};
