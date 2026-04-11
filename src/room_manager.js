const roomState = require("room_state");
const utils = require("utils");
const constructionManager = require("construction_manager");
const linkManager = require("link_manager");
const spawnManager = require("spawn_manager");
const creepManager = require("creep_manager");
const towerManager = require("tower_manager");
const advancedStructureManager = require("advanced_structure_manager");
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
    this.captureLiveSnapshot(room, state, runtimeMode);

    runStep(
      "construction",
      constructionManager.plan,
      constructionManager,
      room,
      state,
      detailCpu ? profiler : null,
      detailCpu ? roomLabel : null,
    );
    runStep("links", linkManager.run, linkManager, room, state);
    runStep("towers", towerManager.run, towerManager, room, state);
    if (
      !statsManager.isPastSoftCpuLimit(2) &&
      this.shouldRunAdvancedOps(runtimeMode)
    ) {
      state.advancedOps = runStep(
        "advancedOps",
        advancedStructureManager.run,
        advancedStructureManager,
        room,
        state,
      );
    } else {
      state.advancedOps = advancedStructureManager.getStatus(room, state);
    }
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
    if (
      !statsManager.isPastSoftCpuLimit(1) &&
      this.shouldRunControllerSign(runtimeMode)
    ) {
      runStep("sign", controllerSigner.run, controllerSigner, room);
    }
    if (!runtimeMode.skipDirectives && !statsManager.isPastSoftCpuLimit(1)) {
      runStep("directives", directiveManager.run, directiveManager, room, state);
    }
    if (!runtimeMode.skipHud && !statsManager.isPastSoftCpuLimit(1)) {
      runStep("hud", hud.run, hud, room, state);
    }

    return state;
  },

  shouldRunAdvancedOps(runtimeMode) {
    const scaledInterval =
      runtimeMode && runtimeMode.advancedOpsInterval
        ? runtimeMode.advancedOpsInterval
        : 1;

    if (scaledInterval > 1 && Game.time % scaledInterval !== 0) return false;
    if (!runtimeMode || runtimeMode.pressure === "normal") return true;
    if (runtimeMode.pressure === "tight") return Game.time % 5 === 0;
    return Game.time % 10 === 0;
  },

  shouldRunControllerSign(runtimeMode) {
    if (!runtimeMode || runtimeMode.pressure === "normal") return true;
    if (runtimeMode.pressure === "tight") return Game.time % 10 === 0;
    return Game.time % 25 === 0;
  },

  captureLiveSnapshot(room, state, runtimeMode) {
    if (!Memory.runtime) Memory.runtime = {};
    if (!Memory.runtime.rooms) Memory.runtime.rooms = {};

    const pressure = runtimeMode && runtimeMode.pressure ? runtimeMode.pressure : "normal";
    const snapshotInterval =
      pressure === "critical" ? 50 : pressure === "tight" ? 20 : 10;
    const previous = Memory.runtime.rooms[room.name] || {};

    if (
      previous.tick &&
      previous.phase === (state && state.phase ? state.phase : null) &&
      Game.time - previous.tick < snapshotInterval
    ) {
      return;
    }

    Memory.runtime.rooms[room.name] = {
      tick: Game.time,
      phase: state && state.phase ? state.phase : null,
      pressure: pressure,
      energyAvailable: room.energyAvailable,
      energyCapacityAvailable: room.energyCapacityAvailable,
      spawnEnergy:
        state && state.spawns && state.spawns[0] && state.spawns[0].store
          ? state.spawns[0].store[RESOURCE_ENERGY] || 0
          : null,
      controllerProgress: room.controller ? room.controller.progress || 0 : null,
      controllerLevel: room.controller ? room.controller.level : null,
      roleCounts: state && state.roleCounts ? state.roleCounts : {},
      hostileCount: state && state.defense && state.defense.homeThreat
        ? state.defense.homeThreat.hostileCount || 0
        : 0,
    };
  },
};
