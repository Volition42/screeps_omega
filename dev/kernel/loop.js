const memory = require("kernel/memory");
const empireManager = require("empire/empire.manager");
const creepManager = require("creeps/creep.manager");

module.exports = {
  run() {
    memory.cleanup();

    const empire = empireManager.create();

    empire.observe();
    empire.plan();
    empire.runStructures();

    creepManager.runAll(empire);

    empire.finalize();
  },
};
