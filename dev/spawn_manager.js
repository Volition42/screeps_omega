const bodies = require("bodies");

module.exports = {
  plan(roomManager) {
    // other managers submit spawn requests
  },

  run(roomManager) {
    const spawn = roomManager.state.spawns.find((s) => !s.spawning);
    if (!spawn) return;

    if (!roomManager.requests.spawns.length) return;

    roomManager.requests.spawns.sort((a, b) => b.priority - a.priority);
    const request = roomManager.requests.spawns[0];

    const body = bodies.getBody(request.role, roomManager.room);
    const name = `${request.role}_${Game.time}`;

    const result = spawn.spawnCreep(body, name, {
      memory: {
        role: request.role,
        room: roomManager.room.name,
        working: false,
        sourceId: null,
        task: null,
      },
    });

    if (result === OK) {
      roomManager.requests.spawns.shift();
    }
  },
};
