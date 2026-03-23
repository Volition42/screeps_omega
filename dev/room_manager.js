const roomState = require("room_state");
const utils = require("utils");
const constructionManager = require("construction_manager");
const spawnManager = require("spawn_manager");
const creepManager = require("creep_manager");
const towerManager = require("tower_manager");
const controllerSigner = require("controller_signer");
const directiveManager = require("directive_manager");
const hud = require("hud");
const statsManager = require("stats_manager");

module.exports = {
  run(room, profiler) {
    const roomLabel = `room.${room.name}`;
    const detailCpu =
      profiler &&
      statsManager.shouldProfileSections &&
      statsManager.shouldProfileSections();
    const runtimeMode = statsManager.getRuntimeMode();
    const runStep = function (suffix, fn, context, ...args) {
      if (!detailCpu) {
        return fn.apply(context, args);
      }

      return profiler.wrap(`${roomLabel}.${suffix}`, fn, context, ...args);
    };

    const state = runStep(
      "state.collect",
      roomState.collect,
      roomState,
      room,
      detailCpu ? profiler : null,
      detailCpu ? roomLabel : null,
    );
    utils.setRoomRuntimeState(room, state);

    runStep(
      "construction",
      constructionManager.plan,
      constructionManager,
      room,
      state,
      detailCpu ? profiler : null,
      detailCpu ? roomLabel : null,
    );
    runStep("towers", towerManager.run, towerManager, room, state);
    runStep("spawn", spawnManager.run, spawnManager, room, state);
    runStep(
      "creeps",
      creepManager.run,
      creepManager,
      room,
      state,
      detailCpu ? profiler : null,
      detailCpu ? roomLabel : null,
      runtimeMode,
    );
    runStep("sign", controllerSigner.run, controllerSigner, room);
    if (!runtimeMode.skipDirectives) {
      runStep("directives", directiveManager.run, directiveManager, room, state);
    }
    if (!runtimeMode.skipHud) {
      runStep("hud", hud.run, hud, room, state);
    }
  },
};
