const config = require("config");
const roadmap = require("construction_roadmap");
const roomProgress = require("room_progress");
const roomState = require("room_state");
const statsManager = require("stats_manager");

const SECTION_ORDER = [
  "overview",
  "economy",
  "build",
  "defense",
  "creeps",
  "sources",
  "advanced",
  "cpu",
];

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

function getQueue(room) {
  return Memory.rooms &&
    Memory.rooms[room.name] &&
    Memory.rooms[room.name].spawnQueue
    ? Memory.rooms[room.name].spawnQueue
    : [];
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
    return state.buildStatus.commandComplete ? "complete" : "active";
  }

  const flag = PHASE_COMPLETION_FLAG[phase];
  if (phase === "bootstrap") {
    return room.controller && room.controller.level >= 2 ? "ready" : "active";
  }

  return flag && state.buildStatus[flag] ? "ready" : "active";
}

function pushIfShort(built, needed, label, missing) {
  if ((needed || 0) > (built || 0)) {
    missing.push(label);
  }
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

function getPhaseCompletionMissing(phase, buildStatus) {
  const missing = [];

  if (phase === "bootstrap") {
    return missing;
  }

  if (phase === "foundation") {
    pushIfShort(
      buildStatus.sourceContainersBuilt,
      buildStatus.sourceContainersNeeded,
      "sourceContainers",
      missing,
    );
    pushIfShort(
      buildStatus.hubContainersBuilt,
      buildStatus.hubContainersNeeded,
      "hubContainer",
      missing,
    );
    pushIfShort(
      buildStatus.controllerContainersBuilt,
      buildStatus.controllerContainersNeeded,
      "controllerContainer",
      missing,
    );
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
    pushIfShort(
      buildStatus.mineralContainersBuilt,
      buildStatus.mineralContainersNeeded,
      "mineralContainer",
      missing,
    );
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
    pushIfShort(
      buildStatus.powerSpawnBuilt,
      buildStatus.powerSpawnNeeded,
      "powerSpawn",
      missing,
    );
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

function getNextTask(phase, advanceMissing, statusLabel) {
  if (advanceMissing.length === 0) {
    if (phase === "command" && statusLabel === "complete") {
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

function formatBuildLine(phase, buildStatus, limit) {
  const fields = PHASE_BUILD_FIELDS[phase] || [];
  const parts = [];

  for (let i = 0; i < fields.length; i++) {
    const field = fields[i];
    const built = buildStatus[field.built] || 0;
    const needed = buildStatus[field.needed] || 0;

    if (needed <= 0 && built <= 0) continue;
    parts.push(`${field.label} ${built}/${needed}`);
  }

  if (typeof limit === "number" && limit > 0) {
    return parts.slice(0, limit).join(" | ") || "none";
  }

  return parts.length > 0 ? parts.join(" | ") : "none";
}

function getRoleSourceCount(state, role, sourceId) {
  if (
    !state.sourceRoleMap ||
    !state.sourceRoleMap[role] ||
    !state.sourceRoleMap[role][sourceId]
  ) {
    return 0;
  }

  return state.sourceRoleMap[role][sourceId].length;
}

function getDesiredHaulersForSource(sourceId) {
  const overrides = config.CREEPS.haulersPerSourceBySourceId || {};

  if (Object.prototype.hasOwnProperty.call(overrides, sourceId)) {
    return overrides[sourceId];
  }

  return 1;
}

function getSafeModeLabel(room) {
  if (!room.controller || !room.controller.safeMode) return "off";
  return `${room.controller.safeMode}`;
}

function getStorageEnergy(room) {
  return room.storage ? room.storage.store[RESOURCE_ENERGY] || 0 : 0;
}

function getContainerEnergy(container) {
  if (!container || !container.store) return 0;
  return container.store[RESOURCE_ENERGY] || 0;
}

function getSpawnSummary(room, state) {
  const queue = getQueue(room);
  const spawn = state.spawns && state.spawns[0] ? state.spawns[0] : null;

  return {
    queue: queue,
    queueSize: queue.length,
    nextQueued: queue.length > 0 ? queue[0].role : "none",
    spawnLabel: spawn && spawn.spawning ? spawn.spawning.name : "idle",
  };
}

function getAlertSummary(room, state) {
  const defense = state.defense || {};
  const threat = defense.homeThreat || null;
  const active = !!(defense.hasThreats || (state.hostileCreeps || []).length > 0);
  const roleCounts = state.roleCounts || {};
  const hostiles = threat ? threat.hostileCount || 0 : (state.hostileCreeps || []).length;
  const threatScore = threat ? threat.threatScore || 0 : 0;
  const threatLevel = threat ? threat.threatLevel || 0 : 0;

  return {
    active: active,
    hostiles: hostiles,
    threatScore: threatScore,
    threatLevel: threatLevel,
    defenders: roleCounts.defender || 0,
    requiredDefenders: defense.requiredDefenders || 0,
    safeMode: getSafeModeLabel(room),
  };
}

function getCpuSummary(room) {
  if (!Memory.stats || !Memory.stats.last) {
    return {
      available: false,
      pressure: "unknown",
    };
  }

  const last = Memory.stats.last;
  const averages = Memory.stats.averages || {};
  const runtime = Memory.stats.runtime || statsManager.getRuntimeMode();

  return {
    available: true,
    current: last.cpu.used,
    limit: last.cpu.limit,
    average: averages.cpuUsed || last.cpu.used,
    bucket: last.cpu.bucket,
    pressure: runtime.pressure || "normal",
    thinkIntervalMultiplier: runtime.thinkIntervalMultiplier || 1,
    constructionIntervalMultiplier: runtime.constructionIntervalMultiplier || 1,
    skipDirectives: !!runtime.skipDirectives,
    skipHud: !!runtime.skipHud,
    room: room.name,
  };
}

function getAdvancedSummary(room, state) {
  if (state.advancedOps) {
    return state.advancedOps;
  }

  if (
    Memory.rooms &&
    Memory.rooms[room.name] &&
    Memory.rooms[room.name].advancedOps &&
    Memory.rooms[room.name].advancedOps.summary
  ) {
    return Memory.rooms[room.name].advancedOps.summary;
  }

  return {
    labStatus: "inactive",
    labProduct: null,
    factoryStatus: "inactive",
    factoryProduct: null,
    powerSpawnStatus: "inactive",
    nukerStatus: "inactive",
    taskLabel: null,
  };
}

function normalizeSection(section) {
  if (!section) return "overview";

  const normalized = String(section).trim().toLowerCase();
  if (SECTION_ORDER.indexOf(normalized) !== -1 || normalized === "all") {
    return normalized;
  }

  return null;
}

module.exports = {
  SECTION_ORDER: SECTION_ORDER,

  normalizeSection(section) {
    return normalizeSection(section);
  },

  formatBuildLine(phase, buildStatus, limit) {
    return formatBuildLine(phase, buildStatus, limit);
  },

  build(room, state, options) {
    const summaryState = state || roomState.collect(room, null, null);
    const reportOptions = options || {};
    const plan = roadmap.getPlan(
      summaryState.phase,
      room.controller ? room.controller.level : 0,
    );
    const progress = roomProgress.getProgressSummary(room, {
      update: reportOptions.updateProgress !== false,
    });
    const desiredTotalHaulers = roomState.getDesiredTotalHaulers(
      summaryState.sources || [],
    );
    const currentMissing = getPhaseCompletionMissing(
      summaryState.phase,
      summaryState.buildStatus,
    );
    const advanceMissing = getAdvanceMissing(room, summaryState, desiredTotalHaulers);
    const statusLabel = getPhaseStatusLabel(summaryState.phase, room, summaryState);
    const nextPhase = getNextPhase(summaryState.phase);
    const nextTask = getNextTask(summaryState.phase, advanceMissing, statusLabel);
    const isAdvanceReady = advanceMissing.length === 0;
    const spawn = getSpawnSummary(room, summaryState);
    const alert = getAlertSummary(room, summaryState);
    const cpu = getCpuSummary(room);
    const advanced = getAdvancedSummary(room, summaryState);
    const buildStatus = summaryState.buildStatus || {};
    const infrastructure = summaryState.infrastructure || {};
    const roleCounts = summaryState.roleCounts || {};
    const sources = summaryState.sources || [];
    const shortBuild = formatBuildLine(summaryState.phase, buildStatus, 3);
    const progressLabel = progress && progress.targetLevel
      ? `RCL ${progress.level} ${progress.pct}%`
      : `RCL ${room.controller ? room.controller.level : 0}`;
    const etaLabel = progress && progress.eta ? progress.eta : "--";

    const sections = {
      overview: [
        `[OPS][${room.name}][OVERVIEW]`,
        `Phase ${summaryState.phase} | ${progressLabel} | ETA ${etaLabel}`,
        `Energy ${room.energyAvailable}/${room.energyCapacityAvailable} | Spawn ${spawn.spawnLabel} | Queue ${spawn.nextQueued}`,
        `Alert ${alert.active ? `active ${alert.hostiles}` : "clear"} | Sites ${buildStatus.sites || 0} | CPU ${cpu.pressure}`,
        `Next ${nextTask}`,
      ],
      economy: [
        `[OPS][${room.name}][ECONOMY]`,
        `Stage ${infrastructure.economyStage || "unknown"} | Energy ${room.energyAvailable}/${room.energyCapacityAvailable} | Storage ${getStorageEnergy(room)}`,
        `Hub ${getContainerEnergy(summaryState.hubContainer)} | Ctrl ${getContainerEnergy(summaryState.controllerContainer)} | Upgrade ${progress && progress.rate > 0 ? progress.rate.toFixed(2) : "0.00"}/t`,
        `Spawn ${spawn.spawnLabel} | Queue ${spawn.queueSize} | Hauler ${summaryState.logistics ? summaryState.logistics.haulerMode : "normal"}`,
      ],
      build: [
        `[OPS][${room.name}][BUILD]`,
        `Roadmap ${buildStatus.roadmapPhase || summaryState.phase} | Status ${statusLabel} | Sites ${buildStatus.sites || 0}`,
        `Current ${formatBuildLine(summaryState.phase, buildStatus)}`,
        `Future ${buildStatus.futurePlanReady ? "ready" : "planning"} | Advance ${nextPhase || "complete"} ${isAdvanceReady ? "ready" : "blocked"}`,
        `Next ${nextTask}`,
      ],
      defense: [
        `[OPS][${room.name}][DEFENSE]`,
        `Alert ${alert.active ? "active" : "clear"} | SafeMode ${alert.safeMode}`,
        `Hostiles ${alert.hostiles} | Threat ${alert.threatScore} | Level ${alert.threatLevel}`,
        `Defenders ${alert.defenders}/${alert.requiredDefenders} | Towers ${summaryState.structuresByType && summaryState.structuresByType[STRUCTURE_TOWER] ? summaryState.structuresByType[STRUCTURE_TOWER].length : 0}`,
      ],
      creeps: [
        `[OPS][${room.name}][CREEPS]`,
        `J ${roleCounts.jrworker || 0} | D ${roleCounts.defender || 0} | W ${roleCounts.worker || 0} | M ${roleCounts.miner || 0} | H ${roleCounts.hauler || 0} | U ${roleCounts.upgrader || 0} | R ${roleCounts.repair || 0}`,
        `Labor ${(roleCounts.worker || 0) + (roleCounts.jrworker || 0)} | Miners ${roleCounts.miner || 0}/${sources.length * config.CREEPS.minersPerSource} | Haulers ${roleCounts.hauler || 0}/${desiredTotalHaulers}`,
        `Advance ${advanceMissing.length > 0 ? summarizeMissing(advanceMissing) : "room steady"}`,
      ],
      sources: [
        `[OPS][${room.name}][SOURCES]`,
      ],
      advanced: [
        `[OPS][${room.name}][ADVANCED]`,
        `Labs ${String(advanced.labStatus || "inactive")} ${advanced.labProduct || ""}`.trim(),
        `Factory ${String(advanced.factoryStatus || "inactive")} ${advanced.factoryProduct || ""}`.trim(),
        `PowerSpawn ${String(advanced.powerSpawnStatus || "inactive")} | Nuker ${String(advanced.nukerStatus || "inactive")}`,
        `Task ${advanced.taskLabel || "none"}`,
      ],
      cpu: [
        `[OPS][${room.name}][CPU]`,
        cpu.available
          ? `Current ${cpu.current.toFixed(2)}/${cpu.limit} | Avg ${cpu.average.toFixed(2)} | Bucket ${cpu.bucket}`
          : "CPU stats unavailable",
        cpu.available
          ? `Pressure ${cpu.pressure} | Shedding think x${cpu.thinkIntervalMultiplier} | build x${cpu.constructionIntervalMultiplier}`
          : "Pressure unknown",
        cpu.available
          ? `Skip directives ${cpu.skipDirectives ? "yes" : "no"} | skip HUD ${cpu.skipHud ? "yes" : "no"}`
          : "Skip directives no | skip HUD no",
      ],
    };

    for (let i = 0; i < sources.length; i++) {
      const source = sources[i];
      const container = summaryState.sourceContainersBySourceId
        ? summaryState.sourceContainersBySourceId[source.id]
        : null;
      const shortId = source.id.slice(-4).toUpperCase();
      const energyPct = source.energyCapacity > 0
        ? Math.round((source.energy / source.energyCapacity) * 100)
        : 0;
      const miners = getRoleSourceCount(summaryState, "miner", source.id);
      const haulers = getRoleSourceCount(summaryState, "hauler", source.id);

      sections.sources.push(
        `${shortId} | src ${energyPct}% | miner ${miners}/${config.CREEPS.minersPerSource} | hauler ${haulers}/${getDesiredHaulersForSource(source.id)} | box ${getContainerEnergy(container)}`,
      );
    }

    if (sections.sources.length === 1) {
      sections.sources.push("No visible sources");
    }

    const hudLines = alert.active
      ? [
          `${room.name} | ALERT | RCL ${room.controller ? room.controller.level : 0}`,
          `Hostiles ${alert.hostiles} | Threat ${alert.threatScore} | Def ${alert.defenders}/${alert.requiredDefenders}`,
          `Energy ${room.energyAvailable}/${room.energyCapacityAvailable} | Spawn ${spawn.spawnLabel} | Q ${spawn.nextQueued}`,
          `Safe ${alert.safeMode} | Next ${nextTask}`,
        ]
      : [
          `${room.name} | ${String(summaryState.phase).toUpperCase()} | ${progressLabel} | ETA ${etaLabel}`,
          `Energy ${room.energyAvailable}/${room.energyCapacityAvailable} | Spawn ${spawn.spawnLabel} | Q ${spawn.nextQueued}`,
          `Focus ${plan.focus} | Next ${nextTask}`,
          `Build ${shortBuild} | Sites ${buildStatus.sites || 0}`,
        ];

    return {
      room: room.name,
      state: summaryState,
      plan: plan,
      progress: progress,
      alert: alert,
      cpu: cpu,
      nextPhase: nextPhase,
      statusLabel: statusLabel,
      nextTask: nextTask,
      advanceMissing: advanceMissing,
      currentMissing: currentMissing,
      isAdvanceReady: isAdvanceReady,
      sections: sections,
      hudLines: hudLines,
    };
  },

  getSectionLines(report, section) {
    const normalized = normalizeSection(section);
    if (!normalized) return null;

    if (normalized === "all") {
      const lines = [];

      for (let i = 0; i < SECTION_ORDER.length; i++) {
        const key = SECTION_ORDER[i];
        if (i > 0) lines.push("------------------------------------------------------------");
        Array.prototype.push.apply(lines, report.sections[key]);
      }

      return lines;
    }

    return report.sections[normalized] || null;
  },

  buildRoomsOverview(reports) {
    const lines = ["[OPS][ROOMS]"];

    for (let i = 0; i < reports.length; i++) {
      const report = reports[i];
      const progress = report.progress;
      const rclLabel = progress && progress.targetLevel
        ? `RCL ${progress.level} ${progress.pct}%`
        : `RCL ${Game.rooms[report.room] && Game.rooms[report.room].controller ? Game.rooms[report.room].controller.level : 0}`;

      lines.push(
        `${report.room} | ${report.state.phase} | ${rclLabel} | ETA ${progress && progress.eta ? progress.eta : "--"} | alert ${report.alert.active ? report.alert.hostiles : "clear"} | next ${report.nextTask}`,
      );
    }

    return lines;
  },
};
