const roomManager = require("room_manager");

module.exports = {
  create() {
    return {
      rooms: [],
      stats: {
        tick: Game.time,
        creepCount: Object.keys(Game.creeps).length,
        cpuAtStart: Game.cpu.getUsed(),
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

      plan(profiler) {
        for (const manager of this.rooms) {
          profiler.start("room.plan");

          manager.plan(profiler);

          profiler.end("room.plan");
        }
      },

      runStructures() {
        for (const manager of this.rooms) {
          manager.runStructures();
        }
      },

      finalize() {
        let totalEnergyAvailable = 0;
        let totalEnergyCapacity = 0;

        for (const manager of this.rooms) {
          totalEnergyAvailable += manager.room.energyAvailable;
          totalEnergyCapacity += manager.room.energyCapacityAvailable;
        }

        Memory.empire.stats = {
          tick: Game.time,
          rooms: this.rooms.length,
          creeps: Object.keys(Game.creeps).length,
          totalEnergyAvailable,
          totalEnergyCapacity,
          cpuUsed: Number(Game.cpu.getUsed().toFixed(3)),
          cpuLimit: Game.cpu.limit,
          cpuBucket: Game.cpu.bucket,
        };
      },
    };
  },
};
