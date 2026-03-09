// colony.js
module.exports = {
  cleanupMemory() {
    for (const name in Memory.creeps) {
      if (!Game.creeps[name]) {
        delete Memory.creeps[name];
      }
    }
  },
};
