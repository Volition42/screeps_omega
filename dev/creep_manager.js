const harvester = require("role_harvester");
const upgrader = require("role_upgrader");
const builder = require("role_builder");

module.exports = {
  runAll() {
    for (const name in Game.creeps) {
      const creep = Game.creeps[name];

      switch (creep.memory.role) {
        case "harvester":
          harvester.run(creep);
          break;
        case "upgrader":
          upgrader.run(creep);
          break;
        case "builder":
          builder.run(creep);
          break;
      }
    }
  },
};
