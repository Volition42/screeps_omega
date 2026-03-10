const bodies = require("bodies");

module.exports = {
  plan(roomManager) {
    // other managers create requests; this module fulfills them
  },

  run(roomManager) {
    const spawn = roomManager.state.spawns.find((s) => !s.spawning);
    if (!spawn) return;

    const request = roomManager.requests.spawns.sort(
      (a, b) => b.priority - a.priority,
    )[0];

    if (!request) return;

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
      roomManager.requests.spawns = roomManager.requests.spawns.filter(
        (r) => r !== request,
      );
    }
  },
};
