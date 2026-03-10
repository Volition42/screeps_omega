module.exports = {
  plan(roomManager) {
    const state = roomManager.state;
    const counts = state.roleCounts;
    const totalCreeps = state.creeps.length;

    if (totalCreeps === 0) {
      roomManager.requestSpawn({ priority: 1000, role: "harvester" });
      return;
    }

    if (state.phase === "bootstrap") {
      if ((counts.harvester || 0) < 2) {
        roomManager.requestSpawn({ priority: 100, role: "harvester" });
      }
      if ((counts.upgrader || 0) < 1) {
        roomManager.requestSpawn({ priority: 80, role: "upgrader" });
      }
      if (state.sites.length > 0 && (counts.builder || 0) < 1) {
        roomManager.requestSpawn({ priority: 70, role: "builder" });
      }
      return;
    }

    // developing / stabilized
    if ((counts.miner || 0) < Math.min(2, state.sources.length)) {
      roomManager.requestSpawn({ priority: 110, role: "miner" });
    }

    if ((counts.hauler || 0) < 2) {
      roomManager.requestSpawn({ priority: 100, role: "hauler" });
    }

    if ((counts.upgrader || 0) < 1) {
      roomManager.requestSpawn({ priority: 80, role: "upgrader" });
    }

    if (state.sites.length > 0 && (counts.builder || 0) < 1) {
      roomManager.requestSpawn({ priority: 75, role: "builder" });
    }

    if (state.phase === "stabilized" && (counts.upgrader || 0) < 2) {
      roomManager.requestSpawn({ priority: 60, role: "upgrader" });
    }
  },

  getLeastAssignedSource(room, roleName) {
    const sources = room.find(FIND_SOURCES);
    if (!sources.length) return null;

    const assignedCounts = {};
    for (const source of sources) assignedCounts[source.id] = 0;

    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (
        creep.memory &&
        creep.memory.role === roleName &&
        creep.memory.room === room.name &&
        creep.memory.sourceId &&
        assignedCounts[creep.memory.sourceId] !== undefined
      ) {
        assignedCounts[creep.memory.sourceId]++;
      }
    }

    let best = sources[0];
    let bestCount = assignedCounts[best.id];

    for (const source of sources) {
      if (assignedCounts[source.id] < bestCount) {
        best = source;
        bestCount = assignedCounts[source.id];
      }
    }

    return best;
  },
};
