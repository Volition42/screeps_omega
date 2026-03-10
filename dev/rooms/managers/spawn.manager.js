const bodies = require("config/bodies");

module.exports = {
  plan(roomManager) {
    // spawn requests are added by other managers
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
        working: false,
      },
    });

    if (result === OK) {
      roomManager.requests.spawns = roomManager.requests.spawns.filter(
        (r) => r !== request,
      );
    }
  },
};
