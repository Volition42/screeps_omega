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
const attackManager = require("attack_manager");
const invasionLog = require("invasion_log");
const scheduler = require("scheduler");

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
    invasionLog.recordOwned(room, state);
    invasionLog.closeStaleRemotes();

    if (!attackManager.isRoomInAttackMode(room.name)) {
      runStep(
        "construction",
        constructionManager.plan,
        constructionManager,
        room,
        state,
        detailCpu ? profiler : null,
        detailCpu ? roomLabel : null,
      );
    }
    runStep("links", linkManager.run, linkManager, room, state);
    runStep("towers", towerManager.run, towerManager, room, state);
    const advancedKey = `room.${room.name}.advancedOps`;
    const advancedInterval = this.getAdvancedOpsInterval(runtimeMode);
    const advancedDecision = !statsManager.isPastSoftCpuLimit(2)
      ? this.getOptionalDecision(advancedKey, advancedInterval, runtimeMode)
      : { ok: false, reason: "soft_cpu" };
    if (advancedDecision.ok) {
      const beforeAdvanced = Game.cpu ? Game.cpu.getUsed() : 0;
      state.advancedOps = runStep(
        "advancedOps",
        advancedStructureManager.run,
        advancedStructureManager,
        room,
        state,
      );
      if (advancedDecision.reason !== "direct") {
        scheduler.markOptionalRun(advancedKey, beforeAdvanced);
      }
    } else {
      scheduler.recordSkip(advancedKey, advancedDecision.reason);
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
    const signKey = `room.${room.name}.sign`;
    const signDecision = !statsManager.isPastSoftCpuLimit(1)
      ? this.getOptionalDecision(
          signKey,
          this.getControllerSignInterval(runtimeMode),
          runtimeMode,
        )
      : { ok: false, reason: "soft_cpu" };
    if (signDecision.ok) {
      const beforeSign = Game.cpu ? Game.cpu.getUsed() : 0;
      runStep("sign", controllerSigner.run, controllerSigner, room);
      if (signDecision.reason !== "direct") {
        scheduler.markOptionalRun(signKey, beforeSign);
      }
    } else {
      scheduler.recordSkip(signKey, signDecision.reason);
    }
    if (!runtimeMode.skipDirectives && !statsManager.isPastSoftCpuLimit(1)) {
      runStep("directives", directiveManager.run, directiveManager, room, state);
    }
    const hudKey = `room.${room.name}.hud`;
    const hudDecision = !runtimeMode.skipHud && !statsManager.isPastSoftCpuLimit(1)
      ? this.getOptionalDecision(hudKey, this.getHudInterval(runtimeMode), runtimeMode)
      : { ok: false, reason: runtimeMode.skipHud ? "pressure" : "soft_cpu" };
    if (hudDecision.ok) {
      const beforeHud = Game.cpu ? Game.cpu.getUsed() : 0;
      runStep("hud", hud.run, hud, room, state);
      if (hudDecision.reason !== "direct") {
        scheduler.markOptionalRun(hudKey, beforeHud);
      }
    } else {
      scheduler.recordSkip(hudKey, hudDecision.reason);
    }

    return state;
  },

  getAdvancedOpsInterval(runtimeMode) {
    const scaledInterval =
      runtimeMode && runtimeMode.advancedOpsInterval
        ? runtimeMode.advancedOpsInterval
        : 1;

    if (!runtimeMode || runtimeMode.pressure === "normal") {
      return scaledInterval;
    }
    if (runtimeMode.pressure === "tight") return Math.max(scaledInterval, 5);
    return Math.max(scaledInterval, 10);
  },

  getOptionalDecision(key, interval, runtimeMode) {
    const pressure = runtimeMode && runtimeMode.pressure
      ? runtimeMode.pressure
      : "normal";
    if (pressure === "normal" && interval <= 1) {
      return { ok: true, reason: "direct" };
    }
    return scheduler.canRunOptional(key, interval);
  },

  getControllerSignInterval(runtimeMode) {
    if (!runtimeMode || runtimeMode.pressure === "normal") return 1;
    if (runtimeMode.pressure === "tight") return 10;
    return 25;
  },

  getHudInterval(runtimeMode) {
    if (!runtimeMode || runtimeMode.pressure === "normal") return 1;
    if (runtimeMode.pressure === "tight") return 10;
    return 25;
  },

  captureLiveSnapshot(room, state, runtimeMode) {
    if (!Memory.runtime) Memory.runtime = {};
    if (!Memory.runtime.rooms) Memory.runtime.rooms = {};

    const pressure = runtimeMode && runtimeMode.pressure ? runtimeMode.pressure : "normal";
    const snapshotInterval =
      pressure === "critical" ? 50 : pressure === "tight" ? 20 : 10;
    const previous = Memory.runtime.rooms[room.name] || {};

    const phase = state && state.phase ? state.phase : null;
    if (previous.tick && previous.phase === phase && Game.time - previous.tick < snapshotInterval) {
      return;
    }
    if (
      previous.tick &&
      previous.phase === phase &&
      !scheduler.isPhaseTick(`room.${room.name}.snapshot`, snapshotInterval)
    ) {
      return;
    }

    Memory.runtime.rooms[room.name] = {
      tick: Game.time,
      phase: phase,
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
