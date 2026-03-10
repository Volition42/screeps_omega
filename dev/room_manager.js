const profilerFactory = require("kernel_profiler");
const roomState = require("room_state");
const spawnManager = require("spawn_manager");
const economyManager = require("economy_manager");
const buildManager = require("build_manager");
const upgradeManager = require("upgrade_manager");
const defenseManager = require("defense_manager");
const layoutManager = require("layout_manager");

module.exports = {
  create(room, empire) {
    return {
      room,
      empire,
      state: null,
      requests: {
        spawns: [],
      },

      observe() {
        this.state = roomState.collect(this.room);
      },

      plan(profiler) {
        profiler.wrap("plan.layout", layoutManager.plan, layoutManager, this);

        profiler.wrap(
          "plan.defense",
          defenseManager.plan,
          defenseManager,
          this,
        );

        profiler.wrap(
          "plan.economy",
          economyManager.plan,
          economyManager,
          this,
        );

        profiler.wrap("plan.build", buildManager.plan, buildManager, this);

        profiler.wrap(
          "plan.upgrade",
          upgradeManager.plan,
          upgradeManager,
          this,
        );

        profiler.wrap("plan.spawn", spawnManager.plan, spawnManager, this);
      },

      runStructures() {
        spawnManager.run(this);
        defenseManager.run(this);
      },

      requestSpawn(request) {
        this.requests.spawns.push(request);
      },
    };
  },
};
