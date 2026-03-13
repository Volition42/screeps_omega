const roleJrWorker = require("role_jrworker");
const roleWorker = require("role_worker");
const roleMiner = require("role_miner");
const roleHauler = require("role_hauler");
const roleUpgrader = require("role_upgrader");
const roleRepair = require("role_repair");

module.exports = {
  run(room) {
    const creeps = _.filter(Game.creeps, function (creep) {
      return creep.memory.room === room.name;
    });

    for (const creep of creeps) {
      switch (creep.memory.role) {
        case "jrworker":
          roleJrWorker.run(creep);
          break;

        case "worker":
          roleWorker.run(creep);
          break;

        case "miner":
          roleMiner.run(creep);
          break;

        case "hauler":
          roleHauler.run(creep);
          break;

        case "upgrader":
          roleUpgrader.run(creep);
          break;

        case "repair":
          roleRepair.run(creep);
          break;
      }
    }
  },
};
