const harvester = require("role_harvester");
const miner = require("role_miner");
const hauler = require("role_hauler");
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
        case "miner":
          miner.run(creep);
          break;
        case "hauler":
          hauler.run(creep);
          break;
        case "upgrader":
          upgrader.run(creep);
          break;
        case "builder":
          builder.run(creep);
          break;
        default:
          creep.say("?");
          break;
      }
    }
  },
};
