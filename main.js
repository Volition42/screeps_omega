// main.js
const colony = require("colony");
const spawnManager = require("spawn.manager");
const roleHarvester = require("role.harvester");
const roleUpgrader = require("role.upgrader");
const roleBuilder = require("role.builder");

module.exports.loop = function () {
  colony.cleanupMemory();

  for (const spawnName in Game.spawns) {
    spawnManager.run(Game.spawns[spawnName]);
  }

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    switch (creep.memory.role) {
      case "harvester":
        roleHarvester.run(creep);
        break;
      case "upgrader":
        roleUpgrader.run(creep);
        break;
      case "builder":
        roleBuilder.run(creep);
        break;
    }
  }
};
