const roomState = require("room_state");
const utils = require("utils");
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
    utils.setRoomRuntimeState(room, state);

    constructionManager.plan(room, state);
    towerManager.run(room, state);
    spawnManager.run(room, state);
    creepManager.run(room, state);
    controllerSigner.run(room);
    directiveManager.run(room, state);
    hud.run(room, state);
  },
};
