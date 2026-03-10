module.exports = {
  plan(roomManager) {
    const counts = roomManager.state.roleCounts;
    const totalCreeps = roomManager.state.creeps.length;

    if (totalCreeps === 0) {
      roomManager.requestSpawn({ priority: 1000, role: "harvester" });
      return;
    }

    if ((counts.harvester || 0) < 2) {
      roomManager.requestSpawn({ priority: 100, role: "harvester" });
    }

    if ((counts.upgrader || 0) < 1) {
      roomManager.requestSpawn({ priority: 80, role: "upgrader" });
    }

    if (roomManager.state.sites.length > 0 && (counts.builder || 0) < 1) {
      roomManager.requestSpawn({ priority: 70, role: "builder" });
    }
  },

  getLeastAssignedSource(room) {
    const sources = room.find(FIND_SOURCES);
    if (!sources.length) return null;

    const assignedCounts = {};
    for (const source of sources) {
      assignedCounts[source.id] = 0;
    }

    for (const name in Game.creeps) {
      const creep = Game.creeps[name];
      if (
        creep.memory &&
        creep.memory.role === "harvester" &&
        creep.memory.room === room.name &&
        creep.memory.sourceId &&
        assignedCounts[creep.memory.sourceId] !== undefined
      ) {
        assignedCounts[creep.memory.sourceId]++;
      }
    }

    let bestSource = sources[0];
    let bestCount = assignedCounts[bestSource.id];

    for (const source of sources) {
      const count = assignedCounts[source.id];
      if (count < bestCount) {
        bestSource = source;
        bestCount = count;
      }
    }

    return bestSource;
  },
};
