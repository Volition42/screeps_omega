const memory = require("kernel_memory");
const roomManager = require("room_manager");
const kernelProfiler = require("kernel_profiler");
const statsManager = require("stats_manager");

/*
Developer Note:
Kernel loop owns:
- memory cleanup
- owned room iteration
- top-level CPU profiling
- top-level stats recording

Keep this file simple.
Detailed colony behavior belongs in room_manager and role files.
*/

module.exports = {
  run() {
    const profiler = kernelProfiler.create();

    profiler.wrap("memory.cleanup", memory.cleanup, memory);

    const ownedRooms = profiler.wrap(
      "rooms.collectOwned",
      function () {
        return _.filter(Game.rooms, function (room) {
          return room.controller && room.controller.my;
        });
      },
      this,
    );

    profiler.wrap(
      "rooms.runAll",
      function () {
        for (const room of ownedRooms) {
          profiler.wrap(
            `room.${room.name}`,
            roomManager.run,
            roomManager,
            room,
            profiler,
          );
        }
      },
      this,
    );

    const snapshot = profiler.finalize();

    statsManager.record(snapshot);
    statsManager.print(snapshot);
  },
};
