// spawn.manager.js
const BODY = {
  harvester: [WORK, CARRY, MOVE],
  upgrader: [WORK, CARRY, MOVE],
  builder: [WORK, CARRY, MOVE],
};

module.exports = {
  run(spawn) {
    if (spawn.spawning) return;

    const creeps = _.groupBy(Game.creeps, (c) => c.memory.role);

    const counts = {
      harvester: (creeps.harvester || []).length,
      upgrader: (creeps.upgrader || []).length,
      builder: (creeps.builder || []).length,
    };

    // Crash recovery first
    if (Object.keys(Game.creeps).length === 0) {
      this.spawn(spawn, "harvester");
      return;
    }

    if (counts.harvester < 2) {
      this.spawn(spawn, "harvester");
      return;
    }

    if (counts.upgrader < 1) {
      this.spawn(spawn, "upgrader");
      return;
    }

    if (counts.builder < 1) {
      this.spawn(spawn, "builder");
      return;
    }

    // After minimum workforce exists, bias toward harvesters early
    if (counts.harvester < 3) {
      this.spawn(spawn, "harvester");
    }
  },

  spawn(spawn, role) {
    const name = `${role}_${Game.time}`;
    spawn.spawnCreep(BODY[role], name, {
      memory: { role, working: false },
    });
  },
};
