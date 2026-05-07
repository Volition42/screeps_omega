const memory = require("kernel_memory");
const empireManager = require("empire_manager");
const reservationManager = require("reservation_manager");
const attackManager = require("attack_manager");
const roomManager = require("room_manager");
const hud = require("hud");
const kernelProfiler = require("kernel_profiler");
const statsManager = require("stats_manager");
const scheduler = require("scheduler");

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
    scheduler.startTick();

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

    profiler.wrap("memory.roomReview", function () {
      return scheduler.runOptional(
        "memory.roomReview",
        memory.getRoomReviewInterval(),
        memory.reviewOwnedRooms,
        memory,
        ownedRooms,
        roomStates,
      );
    }, this);

    profiler.wrap(
      "reservation.run",
      reservationManager.run,
      reservationManager,
      ownedRooms,
      roomStates,
    );

    profiler.wrap(
      "attack.run",
      attackManager.run,
      attackManager,
      ownedRooms,
      roomStates,
    );

    const runtimeMode = statsManager.getRuntimeMode();
    if (!runtimeMode.skipHud && !statsManager.isPastSoftCpuLimit(1)) {
      profiler.wrap("reservation.hud", function () {
        return scheduler.runOptional(
          "hud.reservation",
          hud.getReservedRoomsInterval ? hud.getReservedRoomsInterval() : 25,
          hud.runReservedRooms,
          hud,
        );
      }, this);
      profiler.wrap("attack.hud", function () {
        return scheduler.runOptional(
          "hud.attack",
          hud.getAttackRoomsInterval ? hud.getAttackRoomsInterval() : 25,
          hud.runAttackRooms,
          hud,
        );
      }, this);
    }

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
