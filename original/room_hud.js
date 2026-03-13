const HUD = {
  ENABLED: true,

  ROOM_SUMMARY: true,
  CREEP_LABELS: true,
  CONSOLE_SUMMARY: true,

  SHOW_CPU: true,
  SHOW_ROLES: true,
  SHOW_SPAWN_STATUS: true,
  SHOW_SOURCE_STATUS: true,
  SHOW_ETA: true,

  CREEP_LABEL_INTERVAL: 3,
  CONSOLE_SUMMARY_INTERVAL: 25,
};

module.exports = {
  run(roomManager) {
    if (!HUD.ENABLED) return;

    const room = roomManager.room;
    const state = roomManager.state;
    const visual = room.visual;

    if (HUD.SHOW_ETA) {
      this.trackUpgradeRate(room);
    }

    if (HUD.ROOM_SUMMARY) {
      this.drawRoomSummary(room, state, visual);
    }

    if (HUD.CREEP_LABELS && Game.time % HUD.CREEP_LABEL_INTERVAL === 0) {
      this.drawCreepLabels(room, visual);
    }

    if (HUD.CONSOLE_SUMMARY && Game.time % HUD.CONSOLE_SUMMARY_INTERVAL === 0) {
      this.printConsoleSummary(room, state);
    }
  },

  trackUpgradeRate(room) {
    if (!room.controller || !room.controller.my) return;

    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};

    const mem = Memory.rooms[room.name];

    if (!mem.rclTracker) {
      mem.rclTracker = {
        lastProgress: room.controller.progress,
        avgRate: 0,
      };
    }

    const tracker = mem.rclTracker;
    const delta = room.controller.progress - tracker.lastProgress;

    if (delta >= 0) {
      if (tracker.avgRate === 0) {
        tracker.avgRate = delta;
      } else {
        tracker.avgRate = tracker.avgRate * 0.9 + delta * 0.1;
      }
    }

    tracker.lastProgress = room.controller.progress;
  },

  getUpgradeETA(room) {
    if (
      !Memory.rooms ||
      !Memory.rooms[room.name] ||
      !Memory.rooms[room.name].rclTracker
    ) {
      return "--";
    }

    const mem = Memory.rooms[room.name].rclTracker;
    if (!mem.avgRate || mem.avgRate <= 0) return "--";

    const remaining = room.controller.progressTotal - room.controller.progress;

    const ticksRemaining = remaining / mem.avgRate;
    const seconds = ticksRemaining * 4;

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${hours}h ${minutes}m`;
  },

  drawRoomSummary(room, state, visual) {
    const counts = state.roleCounts || {};
    const priority = this.getPriority(state);
    const milestone = this.getNextMilestone(state);
    const eta = HUD.SHOW_ETA ? this.getUpgradeETA(room) : null;

    const cpuText =
      Memory.stats && Memory.stats.last && Memory.stats.last.cpu
        ? Memory.stats.last.cpu.used.toFixed(1)
        : "?";

    const spawnInfo = this.getSpawnStatus(room);
    const sourceInfo = this.getSourceStatus(room);

    const lines = [];

    let topLine = `[SECTOR:${room.name}] EN ${room.energyAvailable}/${room.energyCapacityAvailable} UNIT ${room.find(FIND_MY_CREEPS).length}`;
    if (HUD.SHOW_CPU) {
      topLine = `[SECTOR:${room.name}] CPU ${cpuText} EN ${room.energyAvailable}/${room.energyCapacityAvailable} UNIT ${room.find(FIND_MY_CREEPS).length}`;
    }
    lines.push(topLine);

    lines.push(
      `[PHASE:${(state.phase || "UNKNOWN").toUpperCase()}] [GOAL:${priority}]`,
    );

    let nextLine = `[NEXT:${milestone}`;
    if (HUD.SHOW_ETA && eta) {
      nextLine += ` ETA:${eta}`;
    }
    nextLine += `]`;

    if (HUD.SHOW_SPAWN_STATUS) {
      nextLine += ` [SPAWN:${spawnInfo.current}] [QUEUE:${spawnInfo.next}]`;
    }

    lines.push(nextLine);

    if (HUD.SHOW_ROLES) {
      lines.push(
        `[ROLES H:${counts.harvester || 0} M:${counts.miner || 0} HA:${counts.hauler || 0} U:${counts.upgrader || 0} B:${counts.builder || 0}]`,
      );
    }

    if (HUD.SHOW_SOURCE_STATUS) {
      for (let i = 0; i < sourceInfo.length; i++) {
        lines.push(sourceInfo[i]);
      }
    }

    const x = 1.0;
    const y = 1.0;

    for (let i = 0; i < lines.length; i++) {
      visual.text(lines[i], x, y + i * 0.9, {
        align: "left",
        color: i === 0 ? "#bff6ff" : "#d6fbff",
        font: 0.8,
        opacity: 0.9,
        stroke: "#000000",
        strokeWidth: 0.15,
      });
    }

    visual.line(x, y - 0.35, x + 14.5, y - 0.35, {
      color: "#6ee7f2",
      width: 0.03,
      opacity: 0.45,
      lineStyle: "solid",
    });
  },

  getSpawnStatus(room) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];

    let current = "IDLE";
    let next = "NONE";

    if (spawn && spawn.spawning) {
      current = spawn.spawning.name.toUpperCase();
    }

    if (
      Memory.rooms &&
      Memory.rooms[room.name] &&
      Memory.rooms[room.name].spawnQueue &&
      Memory.rooms[room.name].spawnQueue.length > 0
    ) {
      next = (
        Memory.rooms[room.name].spawnQueue[0].role || "UNKNOWN"
      ).toUpperCase();
    }

    return { current, next };
  },

  getSourceStatus(room) {
    const lines = [];
    const sources = room.find(FIND_SOURCES);

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];

      const miner = _.find(Game.creeps, function (creep) {
        return (
          creep.memory &&
          creep.memory.role === "miner" &&
          creep.memory.room === room.name &&
          creep.memory.sourceId === source.id
        );
      });

      const container = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: function (s) {
          return s.structureType === STRUCTURE_CONTAINER;
        },
      })[0];

      const containerSite = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
        filter: function (s) {
          return s.structureType === STRUCTURE_CONTAINER;
        },
      })[0];

      let minerState = "NONE";
      if (miner) minerState = "ACTIVE";

      let nodeState = "RAW";
      if (container) {
        nodeState = `BOX:${container.store[RESOURCE_ENERGY] || 0}`;
      } else if (containerSite) {
        nodeState = "SITE";
      }

      const shortId = source.id.slice(-4).toUpperCase();

      lines.push(
        `[SRC:${shortId}] [MINER:${minerState}] [NODE:${nodeState}] [EN:${source.energy}/${source.energyCapacity}]`,
      );
    }

    return lines;
  },

  drawCreepLabels(room, visual) {
    const creeps = room.find(FIND_MY_CREEPS);

    for (const creep of creeps) {
      const label = this.getCreepLabel(creep);

      const style = {
        align: "center",
        font: 0.9,
        opacity: 0.95,
        stroke: "#000000",
        strokeWidth: 0.18,
        color: this.getCreepLabelColor(creep),
      };

      if (creep.ticksToLive && creep.ticksToLive < 100) {
        style.color = "#ff7a7a";
      }

      visual.text(label, creep.pos.x, creep.pos.y - 0.9, style);
    }
  },

  getCreepLabel(creep) {
    const roleMap = {
      harvester: "H",
      builder: "B",
      upgrader: "U",
      hauler: "H",
      miner: "M",
    };

    const role = roleMap[creep.memory.role] || "?";
    const task = this.getCreepTaskIcon(creep);

    return `${role} ${task}`;
  },

  getCreepLabelColor(creep) {
    switch (creep.memory.role) {
      case "harvester":
        return "#ffd166";
      case "miner":
        return "#ff9f1c";
      case "hauler":
        return "#f1f5f9";
      case "builder":
        return "#80ed99";
      case "upgrader":
        return "#66c7ff";
      default:
        return "#d8fbff";
    }
  },

  getCreepTaskIcon(creep) {
    switch (creep.memory.role) {
      case "harvester":
        return creep.store.getFreeCapacity() > 0 ? "⛏" : "⚡";

      case "miner":
        return creep.store.getFreeCapacity() > 0 ? "⚡" : "⛏";

      case "hauler":
        return creep.memory.delivering ? "📦" : "↩";

      case "builder":
        return creep.memory.working ? "🔧" : "⛏";

      case "upgrader":
        return creep.memory.working ? "⬆" : "⛏";

      default:
        return "•";
    }
  },

  getCreepStateIcon(creep) {
    switch (creep.memory.role) {
      case "harvester":
      case "miner":
        return creep.store.getFreeCapacity() > 0 ? "⛏" : "⚡";

      case "hauler":
        return creep.memory.delivering ? "PK" : "IN";

      case "builder":
        return creep.memory.working ? "FX" : "IN";

      case "upgrader":
        return creep.memory.working ? "UP" : "IN";

      default:
        return "--";
    }
  },

  getPriority(state) {
    if (state.hostiles && state.hostiles.length > 0) return "DEFEND";

    if (
      !state.containers ||
      state.containers.length < Math.min(2, state.sources.length)
    ) {
      return "SOURCE_CONTAINERS";
    }

    if (
      state.extensions &&
      state.extensions.length < 5 &&
      state.controllerLevel >= 2
    ) {
      return "BUILD_EXTENSIONS";
    }

    if (state.sites && state.sites.length > 0) return "FINISH_CONSTRUCTION";
    if (state.controllerLevel < 3) return "RUSH_RCL3";

    return "STABILIZE_ECONOMY";
  },

  getNextMilestone(state) {
    if (state.controllerLevel < 2) return "RCL2>EXT";
    if (state.controllerLevel < 3) return "RCL3>TOWER";
    if (state.controllerLevel < 4) return "RCL4>EXT+";
    return "REMOTE_MINING";
  },

  printConsoleSummary(room, state) {
    const counts = state.roleCounts || {};
    const priority = this.getPriority(state);
    const milestone = this.getNextMilestone(state);

    console.log(
      `[ROOM ${room.name}] phase=${state.phase || "unknown"} ` +
        `goal="${priority}" next="${milestone}" ` +
        `energy=${room.energyAvailable}/${room.energyCapacityAvailable} ` +
        `roles H:${counts.harvester || 0} M:${counts.miner || 0} Ha:${counts.hauler || 0} U:${counts.upgrader || 0} B:${counts.builder || 0}`,
    );
  },
};
