const harvester = require("creeps/roles/role.harvester");
const upgrader = require("creeps/roles/role.upgrader");
const builder = require("creeps/roles/role.builder");

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
