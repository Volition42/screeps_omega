const roomState = require("rooms/room.state");
const spawnManager = require("rooms/managers/spawn.manager");
const economyManager = require("rooms/managers/economy.manager");
const buildManager = require("rooms/managers/build.manager");
const upgradeManager = require("rooms/managers/upgrade.manager");
const defenseManager = require("rooms/managers/defense.manager");

class RoomManager {
  constructor(room, empire) {
    this.room = room;
    this.empire = empire;
    this.state = null;
    this.requests = {
      spawns: [],
    };
  }

  observe() {
    this.state = roomState.collect(this.room);
  }

  plan() {
    defenseManager.plan(this);
    economyManager.plan(this);
    buildManager.plan(this);
    upgradeManager.plan(this);
    spawnManager.plan(this);
  }

  runStructures() {
    spawnManager.run(this);
    defenseManager.run(this);
  }

  requestSpawn(request) {
    this.requests.spawns.push(request);
  }
}

module.exports = RoomManager;
