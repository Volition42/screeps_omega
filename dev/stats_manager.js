module.exports = {
  record(snapshot) {
    if (!Memory.stats) Memory.stats = {};
    if (!Memory.stats.history) Memory.stats.history = [];
    if (!Memory.stats.averages) Memory.stats.averages = {};
    if (!Memory.stats.max) Memory.stats.max = {};
    if (!Memory.stats.lastAlertTick) Memory.stats.lastAlertTick = 0;

    const history = Memory.stats.history;

    history.push({
      tick: snapshot.tick,
      cpuUsed: Number(snapshot.cpu.used.toFixed(3)),
      bucket: snapshot.cpu.bucket,
      creepCount: Object.keys(Game.creeps).length,
      roomCount: this.getOwnedRoomCount(),
    });

    const maxHistory = 100;
    while (history.length > maxHistory) {
      history.shift();
    }

    Memory.stats.last = snapshot;
    Memory.stats.averages = this.computeAverages(history);
    Memory.stats.max = this.computeMax(history);

    this.maybeNotify(snapshot);
  },

  getOwnedRoomCount() {
    let count = 0;

    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (room.controller && room.controller.my) {
        count++;
      }
    }

    return count;
  },

  computeAverages(history) {
    if (!history.length) {
      return {
        cpuUsed: 0,
        bucket: 0,
        creepCount: 0,
        roomCount: 0,
      };
    }

    let cpuUsed = 0;
    let bucket = 0;
    let creepCount = 0;
    let roomCount = 0;

    for (const row of history) {
      cpuUsed += row.cpuUsed;
      bucket += row.bucket;
      creepCount += row.creepCount;
      roomCount += row.roomCount;
    }

    return {
      cpuUsed: Number((cpuUsed / history.length).toFixed(3)),
      bucket: Math.round(bucket / history.length),
      creepCount: Number((creepCount / history.length).toFixed(2)),
      roomCount: Number((roomCount / history.length).toFixed(2)),
    };
  },

  computeMax(history) {
    let cpuUsed = 0;
    let creepCount = 0;

    for (const row of history) {
      if (row.cpuUsed > cpuUsed) cpuUsed = row.cpuUsed;
      if (row.creepCount > creepCount) creepCount = row.creepCount;
    }

    return {
      cpuUsed,
      creepCount,
    };
  },

  maybeNotify(snapshot) {
    const bucket = snapshot.cpu.bucket;
    const used = snapshot.cpu.used;
    const limit = snapshot.cpu.limit;

    const shouldAlert = bucket < 1000 || used > limit * 1.2;

    if (!shouldAlert) return;
    if (Game.time - Memory.stats.lastAlertTick < 500) return;

    Memory.stats.lastAlertTick = Game.time;

    Game.notify(
      `Screeps Omega CPU warning at tick ${Game.time}: used=${used.toFixed(2)}, limit=${limit}, bucket=${bucket}`,
      60,
    );
  },
};
