const loop = require("kernel_loop");

global.runUpgradeNOW = function () {
  const creep = Game.creeps["UpgradeNOW"];
  if (!creep) return;

  const source = creep.room.find(FIND_SOURCES)[0];
  const controller = creep.room.controller;

  if (creep.store[RESOURCE_ENERGY] === 0) {
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveTo(source);
    }
  } else {
    if (creep.upgradeController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveTo(controller);
    }
  }
};

module.exports.loop = function () {
  loop.run();
  runUpgradeNOW();
};
