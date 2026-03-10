const layoutManager = require("layout_manager");
const roomState = require("room_state");
const spawnManager = require("spawn_manager");
const economyManager = require("economy_manager");
const buildManager = require("build_manager");
const upgradeManager = require("upgrade_manager");
const defenseManager = require("defense_manager");

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

      plan() {
        layoutManager.plan(this);
        defenseManager.plan(this);
        economyManager.plan(this);
        buildManager.plan(this);
        upgradeManager.plan(this);
        spawnManager.plan(this);
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
