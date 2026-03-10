module.exports = {
  run(roomManager) {
    const room = roomManager.room;
    const state = roomManager.state;
    const visual = room.visual;

    this.drawRoomSummary(room, state, visual);
    this.drawSpawnBanner(room, visual);

    if (Game.time % 3 === 0) {
      this.drawCreepLabels(room, visual);
    }

    if (Game.time % 25 === 0) {
      this.printConsoleSummary(room, state);
    }
  },

  drawRoomSummary(room, state, visual) {
    const counts = state.roleCounts || {};
    const priority = this.getPriority(state);
    const milestone = this.getNextMilestone(state);

    const cpuText =
      Memory.stats && Memory.stats.last && Memory.stats.last.cpu
        ? Memory.stats.last.cpu.used.toFixed(1)
        : "?";

    const spawnQueue = this.getSpawnQueue(room);
    const nextQueued =
      spawnQueue && spawnQueue.length > 0
        ? (spawnQueue[0].role || "NONE").toUpperCase()
        : "NONE";

    const lines = [
      `[SECTOR:${room.name}]  CPU ${cpuText}  EN ${room.energyAvailable}/${room.energyCapacityAvailable}  UNIT ${room.find(FIND_MY_CREEPS).length}`,
      `[PHASE:${(state.phase || "UNKNOWN").toUpperCase()}]  [GOAL:${priority}]`,
      `[NEXT:${milestone}]  [QUEUE:${nextQueued}]`,
      `[ROLES H:${counts.harvester || 0} M:${counts.miner || 0} Ha:${counts.hauler || 0} U:${counts.upgrader || 0} B:${counts.builder || 0}]`,
    ];

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

    // subtle top scanline accent
    visual.line(x, y - 0.35, x + 12.5, y - 0.35, {
      color: "#6ee7f2",
      width: 0.03,
      opacity: 0.45,
      lineStyle: "solid",
    });
  },

  drawSpawnBanner(room, visual) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    if (!spawn) return;

    const spawnQueue = this.getSpawnQueue(room);

    let spawning = "IDLE";
    if (spawn.spawning) {
      spawning = spawn.spawning.name.toUpperCase();
    }

    let next = "NONE";
    if (spawnQueue && spawnQueue.length > 0) {
      next = (spawnQueue[0].role || "UNKNOWN").toUpperCase();
    }

    const text = `[SPAWN:${spawning}] [NEXT:${next}] [EN:${room.energyAvailable}/${room.energyCapacityAvailable}]`;

    visual.text(text, spawn.pos.x, spawn.pos.y - 1.25, {
      align: "center",
      color: "#7ef7ff",
      font: 0.75,
      strokeWidth: 0.15,
      opacity: 0.82,
      stroke: "#000000",
      strokeWidth: 0.08,
      backgroundColor: "#000000",
      backgroundPadding: 0.12,
    });
  },

  drawCreepLabels(room, visual) {
    const creeps = room.find(FIND_MY_CREEPS);

    for (const creep of creeps) {
      const label = this.getCreepLabel(creep);

      const style = {
        align: "center",
        font: 0.48,
        opacity: 0.8,
        stroke: "#000000",
        strokeWidth: 0.1,
        backgroundColor: "#000000",
        backgroundPadding: 0.08,
      };

      if (creep.ticksToLive && creep.ticksToLive < 100) {
        style.color = "#ff7a7a";
      } else {
        style.color = "#d8fbff";
      }

      visual.text(label, creep.pos.x, creep.pos.y - 0.55, style);
    }
  },

  getSpawnQueue(room) {
    if (
      Memory.rooms &&
      Memory.rooms[room.name] &&
      Memory.rooms[room.name].spawnQueue
    ) {
      return Memory.rooms[room.name].spawnQueue;
    }

    return null;
  },

  getCreepLabel(creep) {
    const roleMap = {
      harvester: "H",
      miner: "M",
      hauler: "HA",
      upgrader: "U",
      builder: "B",
    };

    const role = roleMap[creep.memory.role] || "?";
    const state = this.getCreepStateIcon(creep);

    return `${role}-${state}`;
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
