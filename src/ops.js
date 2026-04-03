const config = require("config");
const roadmap = require("construction_roadmap");
const directiveManager = require("directive_manager");
const opsState = require("ops_state");
const roomState = require("room_state");
const statsManager = require("stats_manager");

const PHASE_COMPLETION_FLAG = {
  foundation: "foundationComplete",
  development: "developmentComplete",
  logistics: "logisticsComplete",
  specialization: "specializationComplete",
  fortification: "fortificationComplete",
  command: "commandComplete",
};

const PHASE_BUILD_FIELDS = {
  bootstrap: [],
  foundation: [
    { label: "srcCtr", built: "sourceContainersBuilt", needed: "sourceContainersNeeded" },
    { label: "hubCtr", built: "hubContainersBuilt", needed: "hubContainersNeeded" },
    { label: "ctrlCtr", built: "controllerContainersBuilt", needed: "controllerContainersNeeded" },
    { label: "roads", built: "roadsBuilt", needed: "roadsNeeded" },
  ],
  development: [
    { label: "ext", built: "extensionsBuilt", needed: "extensionsNeeded" },
    { label: "tower", built: "towersBuilt", needed: "towersNeeded" },
    { label: "storage", built: "storageBuilt", needed: "storageNeeded" },
    { label: "roads", built: "roadsBuilt", needed: "roadsNeeded" },
    { label: "walls", built: "wallsBuilt", needed: "wallsNeeded" },
    { label: "ramparts", built: "rampartsBuilt", needed: "rampartsNeeded" },
  ],
  logistics: [
    { label: "ext", built: "extensionsBuilt", needed: "extensionsNeeded" },
    { label: "tower", built: "towersBuilt", needed: "towersNeeded" },
    { label: "storage", built: "storageBuilt", needed: "storageNeeded" },
    { label: "links", built: "linksBuilt", needed: "linksNeeded" },
    { label: "roads", built: "roadsBuilt", needed: "roadsNeeded" },
    { label: "walls", built: "wallsBuilt", needed: "wallsNeeded" },
    { label: "ramparts", built: "rampartsBuilt", needed: "rampartsNeeded" },
  ],
  specialization: [
    { label: "links", built: "linksBuilt", needed: "linksNeeded" },
    { label: "terminal", built: "terminalBuilt", needed: "terminalNeeded" },
    { label: "minCtr", built: "mineralContainersBuilt", needed: "mineralContainersNeeded" },
    { label: "extractor", built: "extractorBuilt", needed: "extractorNeeded" },
    { label: "labs", built: "labsBuilt", needed: "labsNeeded" },
  ],
  fortification: [
    { label: "factory", built: "factoryBuilt", needed: "factoryNeeded" },
    { label: "labs", built: "labsBuilt", needed: "labsNeeded" },
    { label: "links", built: "linksBuilt", needed: "linksNeeded" },
    { label: "walls", built: "wallsBuilt", needed: "wallsNeeded" },
    { label: "ramparts", built: "rampartsBuilt", needed: "rampartsNeeded" },
  ],
  command: [
    { label: "observer", built: "observerBuilt", needed: "observerNeeded" },
    { label: "pSpawn", built: "powerSpawnBuilt", needed: "powerSpawnNeeded" },
    { label: "nuker", built: "nukerBuilt", needed: "nukerNeeded" },
    { label: "factory", built: "factoryBuilt", needed: "factoryNeeded" },
    { label: "labs", built: "labsBuilt", needed: "labsNeeded" },
  ],
};

const PHASE_EXPECTATIONS = {
  bootstrap: ["direct harvest survival", "controller progress to RCL2"],
  foundation: [
    "source containers online",
    "hub/controller containers placed",
    "backbone roads usable",
  ],
  development: [
    "extensions and tower online",
    "storage placed",
    "defense baseline met",
  ],
  logistics: [
    "link backbone online",
    "hauling pressure reduced",
    "controller feed improved",
  ],
  specialization: [
    "terminal online",
    "mineral access online",
    "first lab cluster online",
  ],
  fortification: [
    "factory online",
    "mature core hardened",
    "late-room infrastructure stable",
  ],
  command: [
    "observer online",
    "power spawn online",
    "nuker online",
  ],
};

const PHASE_TASK_PRIORITY = {
  bootstrap: ["rcl2"],
  foundation: [
    "sourceContainers",
    "hubContainer",
    "controllerContainer",
    "roads",
    "economyBackbone",
  ],
  development: [
    "extensions",
    "tower",
    "storage",
    "walls",
    "ramparts",
    "roads",
    "rcl5",
    "labor",
    "upgrader",
    "miners",
    "haulers",
  ],
  logistics: ["links", "rcl6"],
  specialization: ["terminal", "mineralContainer", "extractor", "labs", "rcl7"],
  fortification: ["factory", "rcl8"],
  command: ["observer", "powerSpawn", "nuker"],
};

const MISSING_SUMMARY = {
  rcl2: "waiting on RCL2",
  rcl5: "waiting on RCL5",
  rcl6: "waiting on RCL6",
  rcl7: "waiting on RCL7",
  rcl8: "waiting on RCL8",
  economyBackbone: "economy backbone not stable",
  labor: "worker labor thin",
  upgrader: "upgrader missing",
  miners: "miners below target",
  haulers: "haulers below target",
  sourceContainers: "source containers incomplete",
  hubContainer: "hub container missing",
  controllerContainer: "controller container missing",
  roads: "roads below target",
  extensions: "extensions incomplete",
  tower: "tower missing",
  storage: "storage missing",
  walls: "walls below target",
  ramparts: "ramparts below target",
  links: "link network incomplete",
  terminal: "terminal missing",
  mineralContainer: "mineral container missing",
  extractor: "extractor missing",
  labs: "labs incomplete",
  factory: "factory missing",
  observer: "observer missing",
  powerSpawn: "power spawn missing",
  nuker: "nuker missing",
};

const NEXT_TASK_LABEL = {
  rcl2: "push controller to RCL2",
  rcl5: "push controller to RCL5",
  rcl6: "push controller to RCL6",
  rcl7: "push controller to RCL7",
  rcl8: "push controller to RCL8",
  economyBackbone: "stabilize the early economy backbone",
  labor: "restore worker labor coverage",
  upgrader: "restore upgrader coverage",
  miners: "restore miner coverage",
  haulers: "restore hauler coverage",
  sourceContainers: "finish source containers",
  hubContainer: "place or finish the hub container",
  controllerContainer: "place or finish the controller container",
  roads: "close remaining road targets",
  extensions: "finish remaining extensions",
  tower: "place or finish the first tower",
  storage: "place or finish storage",
  walls: "finish the wall baseline",
  ramparts: "finish the rampart baseline",
  links: "finish planned links",
  terminal: "place or finish the terminal",
  mineralContainer: "place or finish the mineral container",
  extractor: "place or finish the extractor",
  labs: "place or finish the lab cluster",
  factory: "place or finish the factory",
  observer: "place or finish the observer",
  powerSpawn: "place or finish the power spawn",
  nuker: "place or finish the nuker",
};

function getOwnedRooms() {
  const ownedRooms = [];

  for (const roomName in Game.rooms) {
    if (!Object.prototype.hasOwnProperty.call(Game.rooms, roomName)) continue;

    const room = Game.rooms[roomName];
    if (!room.controller || !room.controller.my) continue;

    ownedRooms.push(room);
  }

  ownedRooms.sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });

  return ownedRooms;
}

function resolveOwnedRoom(roomName) {
  if (roomName) {
    const room = Game.rooms[roomName];
    if (room && room.controller && room.controller.my) {
      return room;
    }

    return null;
  }

  const ownedRooms = getOwnedRooms();
  return ownedRooms.length > 0 ? ownedRooms[0] : null;
}

function parseToggleMode(mode, currentEnabled) {
  if (typeof mode === "undefined") {
    return !currentEnabled;
  }

  if (typeof mode === "boolean") {
    return mode;
  }

  if (typeof mode === "number") {
    if (mode === 1) return true;
    if (mode === 0) return false;
    return null;
  }

  if (typeof mode === "string") {
    const normalized = mode.trim().toLowerCase();

    if (
      normalized === "on" ||
      normalized === "true" ||
      normalized === "enable" ||
      normalized === "enabled"
    ) {
      return true;
    }

    if (
      normalized === "off" ||
      normalized === "false" ||
      normalized === "disable" ||
      normalized === "disabled"
    ) {
      return false;
    }
  }

  return null;
}

function getModeLabel(enabled) {
  return enabled ? "ON" : "OFF";
}

function printLine(line) {
  console.log(line);
  return line;
}

function printBlock(lines) {
  for (let i = 0; i < lines.length; i++) {
    console.log(lines[i]);
  }
}

function getTargetRoomOrPrintError(roomName, commandLabel) {
  const room = resolveOwnedRoom(roomName);

  if (room) {
    return room;
  }

  if (roomName) {
    printLine(`[OPS] ${commandLabel}: owned room "${roomName}" not found.`);
    return null;
  }

  printLine(`[OPS] ${commandLabel}: no owned room available.`);
  return null;
}

function buildToggleResult(label, enabled) {
  return {
    enabled: enabled,
    label: label,
  };
}

function getConsoleCommandHelp() {
  return [
    {
      command: 'view(on|off)',
      description: "Toggle HUD and reports together.",
      example: 'view(on)',
    },
    {
      command: 'ops.hud(on|off)',
      description: "Toggle the HUD overlay.",
      example: 'ops.hud(on)',
    },
    {
      command: 'ops.reports(on|off)',
      description: "Toggle directive/report output.",
      example: 'ops.reports(off)',
    },
    {
      command: "ops.nextRCL([roomName])",
      description: "Show controller progress and ETA.",
      example: 'ops.nextRCL(W5N5)',
    },
    {
      command: "ops.cpuStatus([roomName])",
      description: "Show current CPU and runtime pressure.",
      example: 'ops.cpuStatus(W5N5)',
    },
    {
      command: "ops.phase([roomName])",
      description: "Show the current phase quick reference.",
      example: 'ops.phase(W5N5)',
    },
  ];
}

function formatBuildLine(phase, buildStatus) {
  const fields = PHASE_BUILD_FIELDS[phase] || [];
  const parts = [];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const built = buildStatus[field.built] || 0;
    const needed = buildStatus[field.needed] || 0;

    if (needed <= 0 && built <= 0) continue;
    parts.push(`${field.label} ${built}/${needed}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "none";
}

function formatGoalsLine(plan) {
  const goals = plan.goals || {};
  const advanced = goals.advancedStructures || {};
  const lateGame = goals.lateGameStructures || {};
  const linkPlanning = goals.linkPlanning || {};
  const parts = [
    `logistics=${goals.logisticsTier || "none"}`,
    `links=${formatLinkGoal(linkPlanning)}`,
    `terminal=${advanced.terminal ? "yes" : "no"}`,
    `extractor=${advanced.extractor ? "yes" : "no"}`,
    `labs=${advanced.labs || 0}`,
  ];

  if (Object.prototype.hasOwnProperty.call(lateGame, "factory")) {
    parts.push(`factory=${lateGame.factory ? "yes" : "no"}`);
  }
  if (Object.prototype.hasOwnProperty.call(lateGame, "observer")) {
    parts.push(`observer=${lateGame.observer ? "yes" : "no"}`);
  }
  if (Object.prototype.hasOwnProperty.call(lateGame, "powerSpawn")) {
    parts.push(`pSpawn=${lateGame.powerSpawn ? "yes" : "no"}`);
  }
  if (Object.prototype.hasOwnProperty.call(lateGame, "nuker")) {
    parts.push(`nuker=${lateGame.nuker ? "yes" : "no"}`);
  }

  return parts.join(" | ");
}

function formatLinkGoal(linkPlanning) {
  if (!linkPlanning.enabled) {
    return "off";
  }

  const parts = [];
  if (linkPlanning.controllerLink) parts.push("ctrl");
  if (linkPlanning.sourceLinks > 0) parts.push(`${linkPlanning.sourceLinks}src`);
  if (linkPlanning.storageLink) parts.push("store");

  return parts.length > 0 ? parts.join("+") : "planned";
}

function getNextPhase(phase) {
  const index = roadmap.PHASE_ORDER.indexOf(phase);
  if (index === -1 || index >= roadmap.PHASE_ORDER.length - 1) {
    return null;
  }

  return roadmap.PHASE_ORDER[index + 1];
}

function getPhaseStatusLabel(phase, room, state) {
  if (phase === "command") {
    return state.buildStatus.commandComplete ? "COMPLETE" : "IN PROGRESS";
  }

  const flag = PHASE_COMPLETION_FLAG[phase];
  if (phase === "bootstrap") {
    return room.controller && room.controller.level >= 2 ? "READY" : "IN PROGRESS";
  }

  return flag && state.buildStatus[flag] ? "READY" : "IN PROGRESS";
}

function getPhaseCompletionMissing(phase, buildStatus) {
  const missing = [];

  if (phase === "bootstrap") {
    return missing;
  }

  if (phase === "foundation") {
    pushIfShort(buildStatus.sourceContainersBuilt, buildStatus.sourceContainersNeeded, "sourceContainers", missing);
    pushIfShort(buildStatus.hubContainersBuilt, buildStatus.hubContainersNeeded, "hubContainer", missing);
    pushIfShort(buildStatus.controllerContainersBuilt, buildStatus.controllerContainersNeeded, "controllerContainer", missing);
    if (!buildStatus.foundationComplete) {
      pushIfShort(buildStatus.roadsBuilt, buildStatus.roadsNeeded, "roads", missing);
    }
    return missing;
  }

  missing.push.apply(missing, getPhaseCompletionMissing("foundation", buildStatus));

  if (phase === "development") {
    pushIfShort(buildStatus.extensionsBuilt, buildStatus.extensionsNeeded, "extensions", missing);
    pushIfShort(buildStatus.towersBuilt, buildStatus.towersNeeded, "tower", missing);
    pushIfShort(buildStatus.storageBuilt, buildStatus.storageNeeded, "storage", missing);
    pushIfShort(buildStatus.wallsBuilt, buildStatus.wallsNeeded, "walls", missing);
    pushIfShort(buildStatus.rampartsBuilt, buildStatus.rampartsNeeded, "ramparts", missing);
    return uniqueLabels(missing);
  }

  missing.push.apply(missing, getPhaseCompletionMissing("development", buildStatus));

  if (phase === "logistics") {
    pushIfShort(buildStatus.linksBuilt, buildStatus.linksNeeded, "links", missing);
    return uniqueLabels(missing);
  }

  missing.push.apply(missing, getPhaseCompletionMissing("logistics", buildStatus));

  if (phase === "specialization") {
    pushIfShort(buildStatus.terminalBuilt, buildStatus.terminalNeeded, "terminal", missing);
    pushIfShort(buildStatus.mineralContainersBuilt, buildStatus.mineralContainersNeeded, "mineralContainer", missing);
    pushIfShort(buildStatus.extractorBuilt, buildStatus.extractorNeeded, "extractor", missing);
    pushIfShort(buildStatus.labsBuilt, buildStatus.labsNeeded, "labs", missing);
    return uniqueLabels(missing);
  }

  missing.push.apply(missing, getPhaseCompletionMissing("specialization", buildStatus));

  if (phase === "fortification") {
    pushIfShort(buildStatus.factoryBuilt, buildStatus.factoryNeeded, "factory", missing);
    return uniqueLabels(missing);
  }

  missing.push.apply(missing, getPhaseCompletionMissing("fortification", buildStatus));

  if (phase === "command") {
    pushIfShort(buildStatus.observerBuilt, buildStatus.observerNeeded, "observer", missing);
    pushIfShort(buildStatus.powerSpawnBuilt, buildStatus.powerSpawnNeeded, "powerSpawn", missing);
    pushIfShort(buildStatus.nukerBuilt, buildStatus.nukerNeeded, "nuker", missing);
  }

  return uniqueLabels(missing);
}

function getStableEconomyMissing(state, desiredTotalHaulers) {
  const roleCounts = state.roleCounts || {};
  const laborers = (roleCounts.worker || 0) + (roleCounts.jrworker || 0);
  const minimumHaulers = Math.max(
    1,
    Math.min(desiredTotalHaulers, state.sources ? state.sources.length || 1 : 1),
  );
  const missing = [];

  if (laborers < 1) missing.push("labor");
  if ((roleCounts.upgrader || 0) < 1) missing.push("upgrader");
  if (
    (roleCounts.miner || 0) <
    (state.sources ? state.sources.length : 0) * config.CREEPS.minersPerSource
  ) {
    missing.push("miners");
  }
  if ((roleCounts.hauler || 0) < minimumHaulers) {
    missing.push("haulers");
  }

  return missing;
}

function getAdvanceMissing(room, state, desiredTotalHaulers) {
  const buildStatus = state.buildStatus;
  const phase = state.phase;
  const missing = getPhaseCompletionMissing(phase, buildStatus);

  if (phase === "bootstrap") {
    if (!room.controller || room.controller.level < 2) {
      missing.push("rcl2");
    }
    return uniqueLabels(missing);
  }

  if (phase === "foundation") {
    if (!roomState.hasDevelopingEconomyBackbone(state, desiredTotalHaulers)) {
      missing.push("economyBackbone");
    }
    return uniqueLabels(missing);
  }

  if (phase === "development") {
    if (!room.controller || room.controller.level < 5) {
      missing.push("rcl5");
    }
    missing.push.apply(missing, getStableEconomyMissing(state, desiredTotalHaulers));
    return uniqueLabels(missing);
  }

  if (phase === "logistics") {
    if (!room.controller || room.controller.level < 6) {
      missing.push("rcl6");
    }
    return uniqueLabels(missing);
  }

  if (phase === "specialization") {
    if (!room.controller || room.controller.level < 7) {
      missing.push("rcl7");
    }
    return uniqueLabels(missing);
  }

  if (phase === "fortification") {
    if (!room.controller || room.controller.level < 8) {
      missing.push("rcl8");
    }
    return uniqueLabels(missing);
  }

  return uniqueLabels(missing);
}

function getCurrentSummary(phase, currentMissing, statusLabel) {
  if (phase === "bootstrap") {
    return statusLabel === "READY" ? "phase targets met" : "waiting on RCL2";
  }

  if (currentMissing.length === 0) {
    if (phase === "command" && statusLabel === "COMPLETE") {
      return "final phase targets met";
    }

    if (statusLabel === "READY") {
      return "phase targets met";
    }

    return "phase operating cleanly";
  }

  return summarizeMissing(currentMissing);
}

function getNextTask(phase, advanceMissing, statusLabel) {
  if (advanceMissing.length === 0) {
    if (phase === "command" && statusLabel === "COMPLETE") {
      return "no further phase work";
    }

    return "hold the room steady";
  }

  const priority = PHASE_TASK_PRIORITY[phase] || [];
  for (let i = 0; i < priority.length; i++) {
    const label = priority[i];
    if (advanceMissing.indexOf(label) !== -1) {
      return NEXT_TASK_LABEL[label] || label;
    }
  }

  return NEXT_TASK_LABEL[advanceMissing[0]] || advanceMissing[0];
}

function getAdvanceLabel(phase) {
  if (phase === "command") return "finalComplete";

  const nextPhase = getNextPhase(phase);
  return `${nextPhase}Ready`;
}

function summarizeMissing(labels) {
  const parts = [];
  const limit = Math.min(labels.length, 2);

  for (let i = 0; i < limit; i++) {
    parts.push(MISSING_SUMMARY[labels[i]] || labels[i]);
  }

  if (labels.length > limit) {
    parts.push(`+${labels.length - limit} more`);
  }

  return parts.join("; ");
}

function uniqueLabels(labels) {
  const seen = {};
  const result = [];

  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    if (!label || seen[label]) continue;
    seen[label] = true;
    result.push(label);
  }

  return result;
}

function pushIfShort(built, needed, label, missing) {
  if ((needed || 0) > (built || 0)) {
    missing.push(label);
  }
}

module.exports = {
  registerGlobals() {
    global.on = true;
    global.off = false;

    global.ops = {
      hud: function (mode) {
        return module.exports.hud(mode);
      },
      reports: function (mode) {
        return module.exports.reports(mode);
      },
      help: function () {
        return module.exports.help();
      },
      nextRCL: function (roomName) {
        return module.exports.nextRCL(roomName);
      },
      cpuStatus: function (roomName) {
        return module.exports.cpuStatus(roomName);
      },
      phase: function (roomName) {
        return module.exports.phase(roomName);
      },
    };

    global.view = function (mode) {
      return module.exports.view(mode);
    };
  },

  help() {
    const rows = getConsoleCommandHelp();
    const lines = ["[OPS] Available console commands"];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      lines.push(`${row.command} - ${row.description} Example: ${row.example}`);
    }

    printBlock(lines);
    return rows;
  },

  hud(mode) {
    const currentEnabled = opsState.getHudEnabled();
    const nextEnabled = parseToggleMode(mode, currentEnabled);

    if (nextEnabled === null) {
      return printLine('[OPS] HUD: invalid mode. Use "on" or "off".');
    }

    opsState.setHudEnabled(nextEnabled);
    printLine(`[OPS] HUD ${getModeLabel(nextEnabled)}`);

    return buildToggleResult("hud", nextEnabled);
  },

  reports(mode) {
    const currentEnabled = opsState.getReportsEnabled();
    const nextEnabled = parseToggleMode(mode, currentEnabled);

    if (nextEnabled === null) {
      return printLine('[OPS] Reports: invalid mode. Use "on" or "off".');
    }

    opsState.setReportsEnabled(nextEnabled);
    printLine(`[OPS] Reports ${getModeLabel(nextEnabled)}`);

    return buildToggleResult("reports", nextEnabled);
  },

  nextRCL(roomName) {
    const room = getTargetRoomOrPrintError(roomName, "nextRCL");
    if (!room) return null;

    if (!room.controller || !room.controller.my) {
      printLine(`[OPS] nextRCL: room ${room.name} is not owned.`);
      return null;
    }

    if (!room.controller.progressTotal || room.controller.level >= 8) {
      printBlock([
        `[OPS] [Growth] [Room:${room.name}]`,
        `RCL ${room.controller.level} is already at the current maximum.`,
      ]);
      return {
        room: room.name,
        rcl: room.controller.level,
        eta: null,
        rate: 0,
      };
    }

    const roomMemory = directiveManager.getRoomMemory(room);
    const progress = directiveManager.updateProgressTracker(room, roomMemory);
    const pct = Math.round(
      (room.controller.progress / room.controller.progressTotal) * 100,
    );

    const lines = [
      `[OPS] [Growth] [Room:${room.name}]`,
      `RCL ${room.controller.level} -> ${room.controller.level + 1}: ${pct}% (${room.controller.progress}/${room.controller.progressTotal})`,
    ];

    if (!progress || progress.rate <= 0) {
      lines.push("Avg upgrade speed: 0.00 progress/tick");
      lines.push("ETA: undetermined");
      printBlock(lines);

      return {
        room: room.name,
        rcl: room.controller.level,
        progress: room.controller.progress,
        progressTotal: room.controller.progressTotal,
        rate: 0,
        eta: null,
      };
    }

    const eta = directiveManager.formatTicksAsDhM(progress.etaTicks);
    lines.push(`Avg upgrade speed: ${progress.rate.toFixed(2)} progress/tick`);
    lines.push(`ETA: ${eta}`);
    printBlock(lines);

    return {
      room: room.name,
      rcl: room.controller.level,
      progress: room.controller.progress,
      progressTotal: room.controller.progressTotal,
      rate: progress.rate,
      eta: eta,
      etaTicks: progress.etaTicks,
    };
  },

  cpuStatus(roomName) {
    const room = getTargetRoomOrPrintError(roomName, "cpuStatus");
    if (!room) return null;

    if (!Memory.stats || !Memory.stats.last) {
      printLine(`[OPS] cpuStatus: CPU stats are not available yet for ${room.name}.`);
      return null;
    }

    const last = Memory.stats.last;
    const averages = Memory.stats.averages || {};
    const runtime = Memory.stats.runtime || statsManager.getRuntimeMode();
    const policy =
      config.STATS && config.STATS.RUNTIME_POLICY
        ? config.STATS.RUNTIME_POLICY
        : {};

    const lines = [
      `[OPS] [CPU] [Room:${room.name}]`,
      `Current ${last.cpu.used.toFixed(2)}/${last.cpu.limit} | Avg ${Number(averages.cpuUsed || last.cpu.used).toFixed(2)} | Bucket ${last.cpu.bucket} | Pressure ${runtime.pressure.toUpperCase()}`,
      `Shedding think x${runtime.thinkIntervalMultiplier} | build x${runtime.constructionIntervalMultiplier} | skipDirectives ${runtime.skipDirectives ? "yes" : "no"} | skipHud ${runtime.skipHud ? "yes" : "no"}`,
      `Policy skipDirectivesAt=${policy.SKIP_DIRECTIVES_AT || "never"} | skipHudAt=${policy.SKIP_HUD_AT || "never"} | forceOverview ${runtime.forceOverview ? "yes" : "no"}`,
    ];

    printBlock(lines);

    return {
      room: room.name,
      current: last.cpu.used,
      average: averages.cpuUsed || last.cpu.used,
      bucket: last.cpu.bucket,
      pressure: runtime.pressure,
      thinkIntervalMultiplier: runtime.thinkIntervalMultiplier,
      constructionIntervalMultiplier: runtime.constructionIntervalMultiplier,
      skipDirectives: runtime.skipDirectives,
      skipHud: runtime.skipHud,
      forceOverview: runtime.forceOverview,
    };
  },

  phase(roomName) {
    const room = getTargetRoomOrPrintError(roomName, "phase");
    if (!room) return null;

    const state = roomState.collect(room, null, null);
    const plan = roadmap.getPlan(
      state.phase,
      room.controller ? room.controller.level : 0,
    );
    const nextPhase = getNextPhase(state.phase);
    const desiredTotalHaulers = roomState.getDesiredTotalHaulers(state.sources || []);
    const currentMissing = getPhaseCompletionMissing(state.phase, state.buildStatus);
    const advanceMissing = getAdvanceMissing(room, state, desiredTotalHaulers);
    const statusLabel = getPhaseStatusLabel(state.phase, room, state);
    const currentLine = getCurrentSummary(
      state.phase,
      currentMissing,
      statusLabel,
    );
    const expectedLine = (PHASE_EXPECTATIONS[state.phase] || ["none"]).join("; ");
    const nextTask = getNextTask(state.phase, advanceMissing, statusLabel);
    const advanceLabel = getAdvanceLabel(state.phase);
    const isAdvanceReady = advanceMissing.length === 0;
    const lines = [
      `[OPS] [Phase] [Room:${room.name}]`,
      `Now: ${state.phase} | Next: ${nextPhase || "complete"} | Status: ${statusLabel}`,
      `Focus: ${plan.focus} | RCL ${room.controller ? room.controller.level : 0} | Sites ${state.buildStatus.sites}`,
      `Intent: ${plan.summary}`,
      `Build: ${formatBuildLine(state.phase, state.buildStatus)}`,
      `Goals: ${formatGoalsLine(plan)}`,
      `Current: ${currentLine}`,
      `Expected: ${expectedLine}`,
      `Next task: ${nextTask}`,
      `Advance gate: ${advanceLabel}=${isAdvanceReady} | missing=${advanceMissing.length > 0 ? advanceMissing.join(",") : "none"}`,
    ];

    printBlock(lines);

    return {
      room: room.name,
      phase: state.phase,
      nextPhase: nextPhase,
      statusLabel: statusLabel,
      focus: plan.focus,
      intent: plan.summary,
      build: formatBuildLine(state.phase, state.buildStatus),
      goals: formatGoalsLine(plan),
      current: currentLine,
      expected: PHASE_EXPECTATIONS[state.phase] || [],
      nextTask: nextTask,
      advanceGate: {
        label: advanceLabel,
        ready: isAdvanceReady,
        missing: advanceMissing,
      },
      missing: advanceMissing,
    };
  },

  view(mode) {
    const currentEnabled = opsState.getViewEnabled();
    const nextEnabled = parseToggleMode(mode, currentEnabled);

    if (nextEnabled === null) {
      return printLine('[OPS] view: invalid mode. Use "on" or "off".');
    }

    if (nextEnabled) {
      this.hud(true);
      this.reports(true);
      this.nextRCL();
      this.cpuStatus();
    } else {
      this.hud(false);
      this.reports(false);
    }

    return {
      enabled: nextEnabled,
      hud: opsState.getHudEnabled(),
      reports: opsState.getReportsEnabled(),
    };
  },
};
