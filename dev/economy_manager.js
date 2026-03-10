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
};
