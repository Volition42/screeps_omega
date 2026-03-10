module.exports = {
  run(roomManager) {
    const room = roomManager.room;
    const state = roomManager.state;
    const visual = room.visual;

    this.drawCreepLabels(room, visual);

    if (Game.time % 5 === 0) {
      this.drawRoomSummary(room, state, visual);
    }

    if (Game.time % 25 === 0) {
      this.printConsoleSummary(room, state);
    }
  },

  drawRoomSummary(room, state, visual) {
    const counts = state.roleCounts || {};
    const priority = this.getPriority(state);
    const milestone = this.getNextMilestone(state);

    const lines = [
      `Room: ${room.name}`,
      `Phase: ${state.phase || "unknown"}`,
      `Goal: ${priority}`,
      `Next: ${milestone}`,
      `E: ${room.energyAvailable}/${room.energyCapacityAvailable}`,
      `Creeps H:${counts.harvester || 0} M:${counts.miner || 0} Ha:${counts.hauler || 0} U:${counts.upgrader || 0} B:${counts.builder || 0}`,
      `CPU: ${Memory.stats && Memory.stats.last ? Memory.stats.last.cpu.used.toFixed(1) : "?"}`,
    ];

    const x = 1;
    const y = 1;

    visual.rect(x - 0.3, y - 0.8, 13.8, lines.length * 0.9 + 0.4, {
      fill: "#111111",
      opacity: 0.35,
      stroke: "#555555",
      strokeWidth: 0.05,
    });

    for (let i = 0; i < lines.length; i++) {
      visual.text(lines[i], x, y + i * 0.9, {
        align: "left",
        color: "#ffffff",
        font: 0.7,
        opacity: 0.9,
      });
    }
  },

  drawCreepLabels(room, visual) {
    const creeps = room.find(FIND_MY_CREEPS);

    for (const creep of creeps) {
      const label = this.getCreepLabel(creep);

      visual.text(label, creep.pos.x, creep.pos.y - 0.55, {
        align: "center",
        color: "#ffffcc",
        font: 0.45,
        opacity: 0.9,
        backgroundColor: "#000000",
      });
    }
  },

  getCreepLabel(creep) {
    const roleMap = {
      harvester: "H",
      miner: "M",
      hauler: "Ha",
      upgrader: "U",
      builder: "B",
    };

    const role = roleMap[creep.memory.role] || "?";
    const state = this.getCreepStateIcon(creep);

    return `${role}${state}`;
  },

  getCreepStateIcon(creep) {
    switch (creep.memory.role) {
      case "harvester":
      case "miner":
        return creep.store.getFreeCapacity() > 0 ? "⛏" : "⚡";

      case "hauler":
        return creep.memory.delivering ? "📦" : "↩";

      case "builder":
        return creep.memory.working ? "🔧" : "⛏";

      case "upgrader":
        return creep.memory.working ? "⬆" : "⛏";

      default:
        return "";
    }
  },

  getPriority(state) {
    if (state.hostiles && state.hostiles.length > 0) return "DEFEND";
    if (
      state.extensions &&
      state.extensions.length < 5 &&
      state.controllerLevel >= 2
    )
      return "BUILD EXTENSIONS";
    if (
      !state.containers ||
      state.containers.length < Math.min(2, state.sources.length)
    )
      return "SOURCE CONTAINERS";
    if (state.sites && state.sites.length > 0) return "FINISH CONSTRUCTION";
    if (state.controllerLevel < 3) return "RUSH RCL3";
    return "STABILIZE ECONOMY";
  },

  getNextMilestone(state) {
    if (state.controllerLevel < 2) return "RCL2 + extensions";
    if (state.controllerLevel < 3) return "RCL3 + tower";
    if (state.controllerLevel < 4) return "RCL4 + more extensions";
    return "remote mining prep";
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
