const roomManager = require("room_manager");

module.exports = {
  create() {
    return {
      rooms: [],
      stats: {
        tick: Game.time,
        creepCount: Object.keys(Game.creeps).length,
      },

      observe() {
        this.rooms = [];

        for (const roomName in Game.rooms) {
          const room = Game.rooms[roomName];
          if (!room.controller || !room.controller.my) continue;

          const manager = roomManager.create(room, this);
          manager.observe();
          this.rooms.push(manager);
        }
      },

      plan() {
        for (const manager of this.rooms) {
          manager.plan();
        }
      },

      runStructures() {
        for (const manager of this.rooms) {
          manager.runStructures();
        }
      },

      finalize() {
        Memory.empire.stats = {
          tick: Game.time,
          rooms: this.rooms.length,
          creeps: Object.keys(Game.creeps).length,
        };
      },
    };
  },
};
