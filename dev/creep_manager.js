const harvester = require("role_harvester");
const miner = require("role_miner");
const hauler = require("role_hauler");
const upgrader = require("role_upgrader");
const builder = require("role_builder");

module.exports = {
  runAll(profiler) {
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];

      const role = creep.memory.role;

      if (!role) continue;

      const label = `role.${role}`;

      profiler.start(label);

      try {
        switch (role) {
          case "harvester":
            require("role_harvester").run(creep);
            break;

          case "miner":
            require("role_miner").run(creep);
            break;

          case "hauler":
            require("role_hauler").run(creep);
            break;

          case "upgrader":
            require("role_upgrader").run(creep);
            break;

          case "builder":
            require("role_builder").run(creep);
            break;
        }
      } finally {
        profiler.end(label);
      }
    }
  },
};
