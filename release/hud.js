/*
Developer Summary:
vCORP Command HUD

Purpose:
- Fast visual state awareness
- Minimal CPU overhead
- Clean sci-fi aesthetic with a polished corporate dashboard feel

Displayed data:
- Home room:
  - Room / phase header
  - Grid energy, spawn state, queue preview
  - Creep role counts
  - Controller container status
  - Safe mode status / ETA
  - Optional performance line
  - Optional construction checklist
  - Optional remote site status
  - Source utilization lines

- Remote room:
  - Remote room header
  - Configured remote phase
  - Remote JrWorker count
  - Reserver count
  - Source energy summary
  - Reservation summary
  - Hostile presence
  - Same creep label overlay style

Important Notes:
- Keep the current watermark position and lower text baseline unless explicitly changed
- Avoid adding expensive visual effects here
- Remote phase 1 creeps are shown as RJ in the role header and creep labels
- Reservers are shown as RV in the role header and creep labels
*/

const config = require("config");

const REMOTE_HUD_SCAN_INTERVAL = 5;

var remoteHudScanCache = {};

module.exports = {
  run(room, state) {
    if (!config.HUD.ENABLED) return;

    const remoteSummaries = this.getRemoteSiteSummaries(room, state);

    this.drawSummary(room, state, remoteSummaries);
    this.drawRemoteRoomHuds(room, state, remoteSummaries);

    if (
      config.HUD.CREEP_LABELS &&
      Game.time % config.HUD.LABEL_INTERVAL === 0
    ) {
      this.drawCreepLabels(room, state);
      this.drawRemoteCreepLabels(room, state);
    }

    if (Game.time % config.HUD.CONSOLE_INTERVAL === 0) {
      this.printConsole(room, state);
    }
  },

  drawSummary(room, state, remoteSummaries) {
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
    const remoteLines = this.getRemoteSiteLines(room, state, remoteSummaries);

    const sourceLines = _.map(
      state.sources,
      function (source) {
        const sourceContainer = state.sourceContainersBySourceId[source.id];
        const minerCount = this.getRoleSourceCount(state, "miner", source.id);
        const haulerCount = this.getRoleSourceCount(state, "hauler", source.id);

        const desiredMiners = config.CREEPS.minersPerSource;
        const desiredHaulers = this.getDesiredHaulersForSource(source.id);

        const shortId = source.id.slice(-4).toUpperCase();
        const node = sourceContainer
          ? "BOX:" + (sourceContainer.store[RESOURCE_ENERGY] || 0)
          : "RAW";

        const energyPct =
          source.energyCapacity > 0
            ? Math.round((source.energy / source.energyCapacity) * 100)
            : 0;

        return (
          "SRC " +
          shortId +
          "   " +
          "EN " +
          energyPct +
          "%   " +
          "M " +
          minerCount +
          "/" +
          desiredMiners +
          "   " +
          "H " +
          haulerCount +
          "/" +
          desiredHaulers +
          "   " +
          node
        );
      },
      this,
    );

    const controllerContainerLine =
      "CTRL BOX " + state.controllerContainers.length + "/1";

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
        " RJ:" +
        (counts.remotejrworker || 0) +
        " RV:" +
        (counts.reserver || 0) +
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
      controllerContainerLine,
      safeModeLine,
    ];

    if (performanceLine) {
      lines.push(performanceLine);
    }

    if (checklistLines && checklistLines.length > 0) {
      Array.prototype.push.apply(lines, checklistLines);
    }

    if (remoteLines && remoteLines.length > 0) {
      Array.prototype.push.apply(lines, remoteLines);
    }

    Array.prototype.push.apply(lines, sourceLines);

    this.drawPanel(room, lines, state, {
      hasPerformanceLine: !!performanceLine,
      checklistCount: checklistLines ? checklistLines.length : 0,
      remoteCount: remoteLines ? remoteLines.length : 0,
    });
  },

  drawRemoteRoomHuds(homeRoom, state, remoteSummaries) {
    if (!config.HUD.SHOW_REMOTE_SITES) return;
    if (!config.REMOTE_MINING || !config.REMOTE_MINING.ENABLED) return;

    for (let i = 0; i < remoteSummaries.length; i++) {
      const summary = remoteSummaries[i];

      if (!summary.visible || !summary.remoteRoom) continue;

      this.drawRemoteRoomPanel(homeRoom, summary);
    }
  },

  drawRemoteRoomPanel(homeRoom, summary) {
    const remoteRoom = summary.remoteRoom;
    const site = summary.site;

    const lines = [
      "vCORP // REMOTE // " + remoteRoom.name,
      "PHASE " + site.phase + "   STATUS " + summary.status + "   " + summary.threat,
      "RJ " +
        summary.remoteJrWorkers +
        "/" +
        (site.jrWorkers || 0) +
        "   RV " +
        summary.reservers +
        "/" +
        ((site.reservation && site.reservation.reservers) || 0),
      "ENERGY " + summary.sourcePct + "%   DROP " + summary.droppedEnergy,
      summary.reservationLine,
    ];

    this.drawRemotePanel(remoteRoom, lines, {
      hostile: summary.hostiles > 0,
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
    const remoteStart = checklistEnd + 1;
    const remoteEnd = remoteStart + meta.remoteCount;

    for (let i = 0; i < lines.length; i++) {
      const isPerfLine = meta.hasPerformanceLine && i === perfIndex;
      const isChecklistLine =
        meta.checklistCount > 0 && i >= checklistStart && i <= checklistEnd;
      const isRemoteLine =
        meta.remoteCount > 0 && i >= remoteStart && i < remoteEnd;

      room.visual.text(lines[i], x + 0.4, y + 1.2 + i * 0.82, {
        align: "left",
        color: isRemoteLine
          ? "#ffd166"
          : isChecklistLine
            ? "#7ff7d4"
            : isPerfLine
              ? "#7bdcff"
              : i === 0
                ? "#b9f8ff"
                : "#8fe9ff",
        font: isRemoteLine
          ? 0.6
          : isChecklistLine
            ? 0.6
            : isPerfLine
              ? 0.56
              : i === 0
                ? 0.82
                : 0.68,
        opacity: isRemoteLine
          ? 0.82
          : isChecklistLine
            ? 0.8
            : isPerfLine
              ? 0.72
              : i === 0
                ? 0.98
                : 0.88,
        stroke: "#021018",
        strokeWidth: isRemoteLine
          ? 0.12
          : isChecklistLine
            ? 0.12
            : isPerfLine
              ? 0.12
              : 0.14,
      });
    }
  },

  drawRemotePanel(room, lines, meta) {
    const x = 0.6;
    const y = 0.45;
    const width = 16.6;
    const height = lines.length * 0.88 + 1.0;

    const accent = meta.hostile ? "#ff3b3b" : "#ffd166";

    room.visual.rect(x, y, width, height, {
      fill: "#06131f",
      opacity: 0.18,
      stroke: accent,
      strokeWidth: 0.05,
    });

    room.visual.rect(x - 0.18, y, 0.14, height, {
      fill: accent,
      opacity: 0.85,
      stroke: accent,
      strokeWidth: 0.02,
    });

    room.visual.rect(x, y, width, 0.22, {
      fill: accent,
      opacity: 0.35,
      stroke: accent,
      strokeWidth: 0.02,
    });

    room.visual.text("vCORP", x + width + 0.6, y + 1.0, {
      align: "right",
      color: "#ffd166",
      font: 0.8,
      opacity: 0.22,
      stroke: "#000000",
      strokeWidth: 0.08,
    });

    for (let i = 0; i < lines.length; i++) {
      room.visual.text(lines[i], x + 0.4, y + 1.15 + i * 0.82, {
        align: "left",
        color: i === 0 ? "#ffe29a" : "#ffd166",
        font: i === 0 ? 0.78 : 0.62,
        opacity: i === 0 ? 0.96 : 0.88,
        stroke: "#021018",
        strokeWidth: 0.12,
      });
    }
  },

  getRemoteReservationLine(remoteRoom) {
    if (!remoteRoom.controller) {
      return "RESERVATION UNKNOWN";
    }

    const reservation = remoteRoom.controller.reservation;
    if (!reservation) {
      return "RESERVATION NONE";
    }

    return "RES " + reservation.username + " " + reservation.ticksToEnd;
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
      "PERF CPU " +
      last.cpu.used.toFixed(2) +
      "   " +
      "AVG " +
      avg.toFixed(2) +
      "   " +
      "BUCKET " +
      last.cpu.bucket
    );
  },

  getConstructionChecklistLines(state) {
    if (!config.HUD.SHOW_CONSTRUCTION_CHECKLIST) return [];

    const checklist = state.buildStatus;
    if (!checklist) return [];

    const mode = config.HUD.CONSTRUCTION_CHECKLIST_MODE || "detailed";

    if (mode === "compact") {
      return [
        "BUILD EXT " +
          checklist.extensionsBuilt +
          "/" +
          checklist.extensionsNeeded +
          "   " +
          "TWR " +
          checklist.towersBuilt +
          "/" +
          checklist.towersNeeded +
          "   " +
          "RD " +
          checklist.roadsBuilt +
          "/" +
          checklist.roadsNeeded +
          "   " +
          "W " +
          checklist.wallsBuilt +
          "/" +
          checklist.wallsNeeded +
          "   " +
          "R " +
          checklist.rampartsBuilt +
          "/" +
          checklist.rampartsNeeded,
      ];
    }

    return [
      "BUILD EXT " +
        checklist.extensionsBuilt +
        "/" +
        checklist.extensionsNeeded +
        "   " +
        "TWR " +
        checklist.towersBuilt +
        "/" +
        checklist.towersNeeded +
        "   " +
        "SITES " +
        checklist.sites,
      "BUILD RD " +
        checklist.roadsBuilt +
        "/" +
        checklist.roadsNeeded +
        "   " +
        "W " +
        checklist.wallsBuilt +
        "/" +
        checklist.wallsNeeded +
        "   " +
        "R " +
        checklist.rampartsBuilt +
        "/" +
        checklist.rampartsNeeded,
    ];
  },

  getRemoteSiteLines(room, state, remoteSummaries) {
    if (!config.HUD.SHOW_REMOTE_SITES) return [];
    if (!config.REMOTE_MINING || !config.REMOTE_MINING.ENABLED) return [];

    const mode = config.HUD.REMOTE_SITE_MODE || "detailed";
    const lines = [];

    for (let i = 0; i < remoteSummaries.length; i++) {
      const summary = remoteSummaries[i];
      const site = summary.site;
      const targetRoom = summary.targetRoom;

      if (mode === "compact") {
        lines.push(
          "REMOTE " +
            targetRoom +
            " P" +
            site.phase +
            " RJ " +
            summary.remoteJrWorkers +
            "/" +
            (site.jrWorkers || 0) +
            " RV " +
            summary.reservers +
            "/" +
            ((site.reservation && site.reservation.reservers) || 0) +
            " " +
            summary.status,
        );
      } else {
        lines.push(
          "REMOTE " +
            targetRoom +
            "   PHASE " +
            site.phase +
            "   RJ " +
            summary.remoteJrWorkers +
            "/" +
            (site.jrWorkers || 0) +
            "   RV " +
            summary.reservers +
            "/" +
            ((site.reservation && site.reservation.reservers) || 0) +
            "   " +
            summary.status,
        );
      }
    }

    return lines;
  },

  getSafeModeLine(room) {
    if (!room.controller) return "SAFE MODE N/A";

    if (room.controller.safeMode && room.controller.safeMode > 0) {
      return (
        "SAFE MODE ACTIVE " + this.formatTicksAsDhM(room.controller.safeMode)
      );
    }

    if (
      (!room.controller.safeModeAvailable ||
        room.controller.safeModeAvailable <= 0) &&
      room.controller.safeModeCooldown &&
      room.controller.safeModeCooldown > 0
    ) {
      return (
        "SAFE MODE COOLDOWN " +
        this.formatTicksAsDhM(room.controller.safeModeCooldown)
      );
    }

    if (
      room.controller.safeModeAvailable &&
      room.controller.safeModeAvailable > 0
    ) {
      return "SAFE MODE READY x" + room.controller.safeModeAvailable;
    }

    return "SAFE MODE UNAVAILABLE";
  },

  formatTicksAsDhM(ticks) {
    const tickSeconds = this.getTickSeconds();
    const totalSeconds = Math.max(0, Math.floor(ticks * tickSeconds));

    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    return days + "d " + hours + "h " + minutes + "m";
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

  drawCreepLabels(room, state) {
    const creeps = state.creeps || [];

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

  drawRemoteCreepLabels(homeRoom, state) {
    if (!config.REMOTE_MINING || !config.REMOTE_MINING.ENABLED) return;

    const sites = config.REMOTE_MINING.SITES || {};

    for (const targetRoom in sites) {
      if (!Object.prototype.hasOwnProperty.call(sites, targetRoom)) continue;

      const site = sites[targetRoom];
      if (!site || !site.enabled) continue;
      if (site.homeRoom !== homeRoom.name) continue;

      const remoteRoom = Game.rooms[targetRoom];
      if (!remoteRoom) continue;

      const creeps =
        (state.creepsByCurrentRoom && state.creepsByCurrentRoom[targetRoom]) ||
        [];

      for (let i = 0; i < creeps.length; i++) {
        const creep = creeps[i];
        const label = this.getLabel(creep);

        remoteRoom.visual.text(label, creep.pos.x, creep.pos.y - 0.75, {
          align: "center",
          font: 0.9,
          opacity: 0.95,
          stroke: "#001018",
          strokeWidth: 0.18,
          color: this.getLabelColor(creep),
        });
      }
    }
  },

  getLabel(creep) {
    switch (creep.memory.role) {
      case "jrworker":
        return "J ⛏";
      case "remotejrworker":
        return "RJ 🌐";
      case "reserver":
        return "RV 🏳";
      case "worker":
        return "W " + (creep.memory.working ? "🔧" : "⛏");
      case "miner":
        return "M ⚡";
      case "hauler":
        return "H " + (creep.memory.delivering ? "📦" : "↩");
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
      case "remotejrworker":
        return "#ffd166";
      case "reserver":
        return "#c77dff";
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
      "[ROOM " +
        room.name +
        "] phase=" +
        state.phase +
        " " +
        "energy=" +
        room.energyAvailable +
        "/" +
        room.energyCapacityAvailable +
        " " +
        "roles J:" +
        (counts.jrworker || 0) +
        " RJ:" +
        (counts.remotejrworker || 0) +
        " RV:" +
        (counts.reserver || 0) +
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

  getRemoteSiteSummaries(homeRoom, state) {
    if (!config.REMOTE_MINING || !config.REMOTE_MINING.ENABLED) return [];

    const sites = config.REMOTE_MINING.SITES || {};
    const summaries = [];

    for (const targetRoom in sites) {
      if (!Object.prototype.hasOwnProperty.call(sites, targetRoom)) continue;

      const site = sites[targetRoom];
      if (!site || !site.enabled) continue;
      if (site.homeRoom !== homeRoom.name) continue;

      const remoteRoom = Game.rooms[targetRoom] || null;
      const scan = this.getRemoteRoomScan(homeRoom.name, targetRoom, remoteRoom);
      const remoteJrWorkers = this.getRoleTargetRoomCount(
        state,
        "remotejrworker",
        targetRoom,
      );
      const reservers = this.getRoleTargetRoomCount(
        state,
        "reserver",
        targetRoom,
      );

      summaries.push({
        targetRoom: targetRoom,
        site: site,
        remoteRoom: remoteRoom,
        visible: !!remoteRoom,
        remoteJrWorkers: remoteJrWorkers,
        reservers: reservers,
        status: remoteJrWorkers > 0 || reservers > 0 ? "ACTIVE" : "IDLE",
        threat: scan.hostiles > 0 ? "HOSTILES" : "CLEAR",
        sourcePct: scan.sourcePct,
        droppedEnergy: scan.droppedEnergy,
        hostiles: scan.hostiles,
        reservationLine: scan.reservationLine,
      });
    }

    return summaries;
  },

  getRemoteRoomScan(homeRoomName, targetRoom, remoteRoom) {
    const cacheKey = homeRoomName + ":" + targetRoom;
    const cached = remoteHudScanCache[cacheKey];

    if (cached && Game.time - cached.tick < REMOTE_HUD_SCAN_INTERVAL) {
      return cached.scan;
    }

    if (!remoteRoom) {
      if (cached) {
        return cached.scan;
      }

      return {
        sourcePct: 0,
        droppedEnergy: 0,
        hostiles: 0,
        reservationLine: "RESERVATION UNKNOWN",
      };
    }

    const sources = remoteRoom.find(FIND_SOURCES);
    const dropped = remoteRoom.find(FIND_DROPPED_RESOURCES, {
      filter: function (resource) {
        return resource.resourceType === RESOURCE_ENERGY;
      },
    });
    const hostiles = remoteRoom.find(FIND_HOSTILE_CREEPS);

    let sourceEnergy = 0;
    let sourceCapacity = 0;
    for (let i = 0; i < sources.length; i++) {
      sourceEnergy += sources[i].energy;
      sourceCapacity += sources[i].energyCapacity;
    }

    let droppedEnergy = 0;
    for (let j = 0; j < dropped.length; j++) {
      droppedEnergy += dropped[j].amount;
    }

    const scan = {
      sourcePct:
        sourceCapacity > 0
          ? Math.round((sourceEnergy / sourceCapacity) * 100)
          : 0,
      droppedEnergy: droppedEnergy,
      hostiles: hostiles.length,
      reservationLine: this.getRemoteReservationLine(remoteRoom),
    };

    // Developer note:
    // Remote HUD room scans are intentionally throttled. The HUD keeps drawing
    // every tick, but expensive remote room.find calls refresh only periodically.
    remoteHudScanCache[cacheKey] = {
      tick: Game.time,
      scan: scan,
    };

    return scan;
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

  getRoleTargetRoomCount(state, role, targetRoom) {
    if (
      !state.targetRoomRoleMap ||
      !state.targetRoomRoleMap[role] ||
      !state.targetRoomRoleMap[role][targetRoom]
    ) {
      return 0;
    }

    return state.targetRoomRoleMap[role][targetRoom].length;
  },
};
