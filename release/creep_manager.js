/*
Developer Summary:
Creep role dispatcher.

Purpose:
- Route creeps to the correct role logic
- Keep role execution simple and explicit
- Allow home-room-owned remote creeps to run through the same manager

Important Notes:
- Remote creeps still use memory.room as their home room
- That allows the home room manager to continue owning their logic
*/

const roleJrWorker = require("role_jrworker");
const roleRemoteJrWorker = require("role_remote_jrworker");
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

    for (let i = 0; i < creeps.length; i++) {
      const creep = creeps[i];

      switch (creep.memory.role) {
        case "jrworker":
          roleJrWorker.run(creep);
          break;

        case "remotejrworker":
          roleRemoteJrWorker.run(creep);
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
