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

    const lines = [
      `Room: ${room.name}  -  CPU: ${Memory.stats && Memory.stats.last ? Memory.stats.last.cpu.used.toFixed(1) : "?"}  -  E: ${room.energyAvailable}/${room.energyCapacityAvailable}  -  Creeps H:${counts.harvester || 0} M:${counts.miner || 0} Ha:${counts.hauler || 0} U:${counts.upgrader || 0} B:${counts.builder || 0}`,
      `Phase: ${state.phase || "unknown"}  -  Goal: ${priority}  -  Next: ${milestone}`,
    ];

    const x = 1;
    const y = 1;

    for (let i = 0; i < lines.length; i++) {
      visual.text(lines[i], x, y + i * 0.9, {
        align: "left",
        color: "#ffffff",
        font: 0.7,
        opacity: 0.7,
      });
    }
  },

drawSpawnBanner(room, visual) {
  const spawn = room.find(FIND_MY_SPAWNS)[0];
  if (!spawn) return;

  let spawnManagerMemory = null;

  if (Memory.rooms &&
      Memory.rooms[room.name] &&
      Memory.rooms[room.name].spawnQueue) {

    spawnManagerMemory = Memory.rooms[room.name].spawnQueue;
  }

  let spawning = "idle";

  if (spawn.spawning) {
    const creep = Game.creeps[spawn.spawning.name];
    spawning = creep && creep.memory ? creep.memory.role : spawn.spawning.name;
  }

  let next = "none";

  if (spawnManagerMemory && spawnManagerMemory.length > 0) {
    next = spawnManagerMemory[0].role || "unknown";
  }

  const energy = `${room.energyAvailable}/${room.energyCapacityAvailable}`;

  const text = `Spawn: ${spawning} | Next: ${next} | E:${energy}`;

  visual.text(text, spawn.pos.x, spawn.pos.y - 1.2, {
    align: "center",
    color: "#aaffff",
    font: 0.7,
    opacity: 0.8,
    backgroundColor: "#000000"
  });
}

  getCreepTarget(creep) {
    switch (creep.memory.role) {
      case "harvester": {
        if (!creep.memory.working) {
          if (creep.memory.sourceId) {
            return Game.getObjectById(creep.memory.sourceId);
          }
          return creep.pos.findClosestByRange(FIND_SOURCES);
        }

        const energyTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: (s) =>
            (s.structureType === STRUCTURE_SPAWN ||
              s.structureType === STRUCTURE_EXTENSION) &&
            s.store &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
        });

        return energyTarget || creep.room.controller;
      }

      case "miner": {
        if (creep.memory.sourceId) {
          return Game.getObjectById(creep.memory.sourceId);
        }
        return creep.pos.findClosestByRange(FIND_SOURCES);
      }

      case "hauler": {
        if (!creep.memory.delivering) {
          const container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s) =>
              s.structureType === STRUCTURE_CONTAINER &&
              s.store &&
              s.store[RESOURCE_ENERGY] > 0,
          });

          if (container) return container;

          return creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {
            filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 25,
          });
        }

        const deliveryTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
          filter: (s) =>
            (s.structureType === STRUCTURE_SPAWN ||
              s.structureType === STRUCTURE_EXTENSION) &&
            s.store &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
        });

        return deliveryTarget || creep.room.controller;
      }

      case "builder": {
        if (!creep.memory.working) {
          return creep.pos.findClosestByRange(FIND_SOURCES);
        }

        const site = creep.pos.findClosestByRange(FIND_CONSTRUCTION_SITES);
        return site || creep.room.controller;
      }

      case "upgrader": {
        if (!creep.memory.working) {
          return creep.pos.findClosestByRange(FIND_SOURCES);
        }

        return creep.room.controller;
      }

      default:
        return null;
    }
  },

  getCreepLineColor(creep) {
    switch (creep.memory.role) {
      case "harvester":
      case "miner":
        return "#ffd166"; // yellow-ish
      case "hauler":
        return "#ffffff"; // white
      case "builder":
        return "#06d6a0"; // green-ish
      case "upgrader":
        return "#4dabf7"; // blue-ish
      default:
        return "#cccccc";
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
    ) {
      return "BUILD EXTENSIONS";
    }
    if (
      !state.containers ||
      state.containers.length < Math.min(2, state.sources.length)
    ) {
      return "SOURCE CONTAINERS";
    }
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
