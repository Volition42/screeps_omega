const FULL_CLEANUP_INTERVAL = 500;
const ROOM_MEMORY_STALE_AGE = 5000;

var lastFullCleanupTick = 0;

module.exports = {
  cleanup() {
    if (!Memory.creeps) Memory.creeps = {};
    if (!Memory.rooms) Memory.rooms = {};

    for (const name in Memory.creeps) {
      if (!Game.creeps[name]) {
        delete Memory.creeps[name];
      }
    }

    if (Game.time - lastFullCleanupTick < FULL_CLEANUP_INTERVAL) return;

    lastFullCleanupTick = Game.time;
    this.runFullCleanup();
  },

  runFullCleanup() {
    for (const roomName in Game.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Game.rooms, roomName)) continue;

      if (!Memory.rooms[roomName]) {
        Memory.rooms[roomName] = {};
      }

      Memory.rooms[roomName].lastSeen = Game.time;
    }

    for (const roomName in Memory.rooms) {
      if (!Object.prototype.hasOwnProperty.call(Memory.rooms, roomName)) {
        continue;
      }

      const roomMemory = Memory.rooms[roomName];

      if (!roomMemory || typeof roomMemory !== "object") {
        delete Memory.rooms[roomName];
        continue;
      }

      if (roomMemory.stateCache) {
        delete roomMemory.stateCache;
      }

      if (Game.rooms[roomName]) continue;

      const lastSeen = roomMemory.lastSeen || 0;

      // Developer note:
      // Room memory ages out only on periodic full cleanup so normal ticks
      // do not keep paying for broad room-memory sweeps.
      if (lastSeen > 0 && Game.time - lastSeen < ROOM_MEMORY_STALE_AGE) {
        continue;
      }

      delete Memory.rooms[roomName];
    }
  },
};
