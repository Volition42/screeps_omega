const memory = require("kernel_memory");
const empireManager = require("empire_manager");
const reservationManager = require("reservation_manager");
const roomManager = require("room_manager");
const kernelProfiler = require("kernel_profiler");
const statsManager = require("stats_manager");

/*
Developer Note:
Kernel loop owns:
- memory cleanup
- empire owned-room discovery
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
      "empire.collectOwned",
      empireManager.collectOwnedRooms,
      empireManager,
    );
    const roomStates = {};

    profiler.wrap(
      "rooms.runAll",
      function () {
        for (const room of ownedRooms) {
          const state = profiler.wrap(
            `room.${room.name}`,
            roomManager.run,
            roomManager,
            room,
            profiler,
          );
          if (state) {
            roomStates[room.name] = state;
          }
        }
      },
      this,
    );

    profiler.wrap(
      "reservation.run",
      reservationManager.run,
      reservationManager,
      ownedRooms,
      roomStates,
    );

    profiler.wrap(
      "empire.record",
      empireManager.record,
      empireManager,
      ownedRooms,
      roomStates,
    );

    const snapshot = profiler.finalize();

    statsManager.record(snapshot);
  },
};
