const RoomManager = require("rooms/room.manager");

class EmpireManager {
  constructor() {
    this.rooms = [];
    this.stats = {
      tick: Game.time,
      creepCount: Object.keys(Game.creeps).length,
    };
  }

  observe() {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (!room.controller || !room.controller.my) continue;

      const roomManager = new RoomManager(room, this);
      roomManager.observe();
      this.rooms.push(roomManager);
    }
  }

  plan() {
    for (const roomManager of this.rooms) {
      roomManager.plan();
    }
  }

  runStructures() {
    for (const roomManager of this.rooms) {
      roomManager.runStructures();
    }
  }

  finalize() {
    Memory.empire.stats = {
      tick: Game.time,
      rooms: this.rooms.length,
      creeps: Object.keys(Game.creeps).length,
    };
  }
}

module.exports = {
  create() {
    return new EmpireManager();
  },
};
