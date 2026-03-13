/*
Developer Note:
Rolling CPU / colony stats recorder.

Purpose:
- Keep a short performance history in Memory
- Store last snapshot and rolling averages
- Print readable CPU summaries on an interval

Memory layout:
Memory.stats.last
Memory.stats.history
Memory.stats.averages
Memory.stats.max
*/

module.exports = {
  record(snapshot) {
    if (!Memory.stats) Memory.stats = {};
    if (!Memory.stats.history) Memory.stats.history = [];
    if (!Memory.stats.averages) Memory.stats.averages = {};
    if (!Memory.stats.max) Memory.stats.max = {};

    const history = Memory.stats.history;

    history.push({
      tick: snapshot.tick,
      cpuUsed: snapshot.cpu.used,
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
  },

  print(snapshot) {
    if (Game.time % 25 !== 0) return;

    const avgCpu =
      Memory.stats &&
      Memory.stats.averages &&
      typeof Memory.stats.averages.cpuUsed === "number"
        ? Memory.stats.averages.cpuUsed
        : snapshot.cpu.used;

    console.log(
      `[CPU] tick=${snapshot.tick} used=${snapshot.cpu.used.toFixed(2)} ` +
        `avg=${avgCpu.toFixed(3)} bucket=${snapshot.cpu.bucket} creeps=${Object.keys(Game.creeps).length}`,
    );

    const sectionParts = [];
    const sections = snapshot.sections || {};

    for (const label in sections) {
      const section = sections[label];
      sectionParts.push(`${label}:${section.total}`);
    }

    if (sectionParts.length > 0) {
      console.log(`[CPU:sections] ${sectionParts.join(" | ")}`);
    }
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
};
