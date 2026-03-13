const bodies = require("bodies");

module.exports = {
  plan(roomManager) {
    // Other managers add spawn requests.
    // This module mainly fulfills them in run().
  },

  run(roomManager) {
    const room = roomManager.room;
    const spawns = roomManager.state.spawns;

    if (!spawns || !spawns.length) return;

    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};

    if (!roomManager.requests) {
      roomManager.requests = { spawns: [] };
    }

    if (!roomManager.requests.spawns) {
      roomManager.requests.spawns = [];
    }

    roomManager.requests.spawns.sort(function (a, b) {
      return b.priority - a.priority;
    });

    Memory.rooms[room.name].spawnQueue = roomManager.requests.spawns.map(
      function (request) {
        return {
          role: request.role,
          priority: request.priority,
        };
      },
    );

    const spawn = spawns.find(function (s) {
      return !s.spawning;
    });

    if (!spawn) return;
    if (!roomManager.requests.spawns.length) return;

    const request = roomManager.requests.spawns[0];
    if (!request) return;

    const body = bodies.getBody(request.role, room);
    const name = `${request.role}_${Game.time}`;

    const result = spawn.spawnCreep(body, name, {
      memory: {
        role: request.role,
        room: room.name,
        working: false,
        delivering: false,
        sourceId: null,
        task: null,
      },
    });

    if (result === OK) {
      roomManager.requests.spawns.shift();

      Memory.rooms[room.name].spawnQueue = roomManager.requests.spawns.map(
        function (queuedRequest) {
          return {
            role: queuedRequest.role,
            priority: queuedRequest.priority,
          };
        },
      );

      return;
    }

    // Optional light handling for common spawn failures.
    // We only stay quiet on normal "not enough energy yet" cases.
    if (result === ERR_NOT_ENOUGH_ENERGY) {
      return;
    }

    if (Game.time % 25 === 0) {
      console.log(
        `[SPAWN ${spawn.name}] failed role=${request.role} result=${result} ` +
          `energy=${room.energyAvailable}/${room.energyCapacityAvailable}`,
      );
    }
  },
};
