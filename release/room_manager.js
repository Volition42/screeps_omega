const roomState = require("room_state");
const constructionManager = require("construction_manager");
const spawnManager = require("spawn_manager");
const creepManager = require("creep_manager");
const towerManager = require("tower_manager");
const controllerSigner = require("controller_signer");
const directiveManager = require("directive_manager");
const hud = require("hud");

module.exports = {
  run(room) {
    const state = roomState.collect(room);

    Memory.rooms = Memory.rooms || {};
    Memory.rooms[room.name] = Memory.rooms[room.name] || {};
    Memory.rooms[room.name].stateCache = state;

    constructionManager.plan(room, state);
    towerManager.run(room);
    spawnManager.run(room, state);
    creepManager.run(room);
    controllerSigner.run(room);
    directiveManager.run(room, state);
    hud.run(room, state);
  },
};
