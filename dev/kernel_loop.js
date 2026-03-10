const memory = require("kernel_memory");
const empireManager = require("empire_manager");
const creepManager = require("creep_manager");

module.exports = {
  run() {
    memory.cleanup();

    const empire = empireManager.create();

    empire.observe();
    empire.plan();
    empire.runStructures();
    creepManager.runAll();
    empire.finalize();
  },
};
