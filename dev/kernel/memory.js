module.exports = {
  cleanup() {
    if (!Memory.creeps) Memory.creeps = {};
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.empire) Memory.empire = {};

    for (const name in Memory.creeps) {
      if (!Game.creeps[name]) {
        delete Memory.creeps[name];
      }
    }
  },
};
