const memory = require("kernel_memory");
const roomManager = require("room_manager");

module.exports = {
  run() {
    memory.cleanup();

    const ownedRooms = _.filter(Game.rooms, function (room) {
      return room.controller && room.controller.my;
    });

    for (const room of ownedRooms) {
      roomManager.run(room);
    }
  },
};
