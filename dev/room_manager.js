const roomState = require("room_state");
const utils = require("utils");
const constructionManager = require("construction_manager");
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
    this.captureLiveSnapshot(room, state);

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
    state.advancedOps = runStep(
      "advancedOps",
      advancedStructureManager.run,
      advancedStructureManager,
      room,
      state,
    );
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

  captureLiveSnapshot(room, state) {
    if (!Memory.runtime) Memory.runtime = {};
    if (!Memory.runtime.rooms) Memory.runtime.rooms = {};

    const roomMemory = Memory.runtime.rooms[room.name] || {};
    const creeps = state && state.homeCreeps ? state.homeCreeps : [];
    const creepSnapshots = [];

    for (let i = 0; i < creeps.length; i++) {
      const creep = creeps[i];
      creepSnapshots.push({
        name: creep.name,
        role: creep.memory && creep.memory.role ? creep.memory.role : null,
        x: creep.pos ? creep.pos.x : null,
        y: creep.pos ? creep.pos.y : null,
        energy: creep.store ? creep.store[RESOURCE_ENERGY] || 0 : 0,
        fatigue: creep.fatigue || 0,
        working: creep.memory ? !!creep.memory.working : false,
      });
    }

    Memory.runtime.rooms[room.name] = Object.assign(roomMemory, {
      tick: Game.time,
      phase: state && state.phase ? state.phase : null,
      energyAvailable: room.energyAvailable,
      energyCapacityAvailable: room.energyCapacityAvailable,
      spawnEnergy:
        state && state.spawns && state.spawns[0] && state.spawns[0].store
          ? state.spawns[0].store[RESOURCE_ENERGY] || 0
          : null,
      controllerProgress: room.controller ? room.controller.progress || 0 : null,
      controllerLevel: room.controller ? room.controller.level : null,
      creeps: creepSnapshots,
    });
  },
};
