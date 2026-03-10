const memory = require("kernel_memory");
const profilerFactory = require("kernel_profiler");
const statsManager = require("stats_manager");
const empireManager = require("empire_manager");
const creepManager = require("creep_manager");

module.exports = {
  run() {
    const profiler = profilerFactory.create();

    profiler.wrap("memory.cleanup", memory.cleanup, memory);

    const empire = profiler.wrap(
      "empire.create",
      empireManager.create,
      empireManager,
    );

    profiler.wrap("empire.observe", empire.observe, empire);
    profiler.wrap("empire.plan", empire.plan, empire);
    profiler.wrap("empire.runStructures", empire.runStructures, empire);
    profiler.wrap("creeps.runAll", creepManager.runAll, creepManager);
    profiler.wrap("empire.finalize", empire.finalize, empire);

    const snapshot = profiler.finalize();

    profiler.wrap("stats.record", statsManager.record, statsManager, snapshot);

    if (Game.time % 25 === 0) {
      this.printSummary();
    }
  },

  printSummary() {
    if (!Memory.stats || !Memory.stats.last) return;

    const last = Memory.stats.last;
    const avg = Memory.stats.averages || {};

    console.log(
      `[CPU] tick=${last.tick} used=${last.cpu.used.toFixed(2)} ` +
        `avg=${avg.cpuUsed || 0} bucket=${last.cpu.bucket} creeps=${Object.keys(Game.creeps).length}`,
    );

    const sections = last.sections || {};
    const parts = [];

    for (const name in sections) {
      parts.push(`${name}:${sections[name].total}`);
    }

    console.log(`[CPU:sections] ${parts.join(" | ")}`);
  },
};
