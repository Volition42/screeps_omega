const config = require("config");
const constructionStatus = require("construction_status");
const reservePolicy = require("economy_reserve_policy");
const roadmap = require("construction_roadmap");
const roomProgress = require("room_progress");
const roomState = require("room_state");
const statsManager = require("stats_manager");
const observerManager = require("observer_manager");
const opsLogisticsManager = require("ops_logistics_manager");
const pclManager = require("pcl_manager");
const roleIntentDiagnostics = require("role_intent_diagnostics");

const SECTION_ORDER = [
  "overview",
  "economy",
  "build",
  "defense",
  "creeps",
  "roles",
  "sources",
  "resources",
  "factory",
  "labs",
  "labor",
  "logistics",
  "advanced",
  "power",
  "observer",
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
    { label: "mRoad", built: "mineralAccessRoadsBuilt", needed: "mineralAccessRoadsNeeded" },
  ],
  development: [
    { label: "ext", built: "extensionsBuilt", needed: "extensionsNeeded" },
    { label: "tower", built: "towersBuilt", needed: "towersNeeded" },
    { label: "storage", built: "storageBuilt", needed: "storageNeeded" },
    { label: "roads", built: "roadsBuilt", needed: "roadsNeeded" },
    { label: "mRoad", built: "mineralAccessRoadsBuilt", needed: "mineralAccessRoadsNeeded" },
  ],
  logistics: [
    { label: "ext", built: "extensionsBuilt", needed: "extensionsNeeded" },
    { label: "tower", built: "towersBuilt", needed: "towersNeeded" },
    { label: "storage", built: "storageBuilt", needed: "storageNeeded" },
    { label: "links", built: "linksBuilt", needed: "linksNeeded" },
    { label: "roads", built: "roadsBuilt", needed: "roadsNeeded" },
    { label: "mRoad", built: "mineralAccessRoadsBuilt", needed: "mineralAccessRoadsNeeded" },
  ],
  specialization: [
    { label: "links", built: "linksBuilt", needed: "linksNeeded" },
    { label: "terminal", built: "terminalBuilt", needed: "terminalNeeded" },
    { label: "minCtr", built: "mineralContainersBuilt", needed: "mineralContainersNeeded" },
    { label: "extractor", built: "extractorBuilt", needed: "extractorNeeded" },
    { label: "mRoad", built: "mineralAccessRoadsBuilt", needed: "mineralAccessRoadsNeeded" },
    { label: "labs", built: "labsBuilt", needed: "labsNeeded" },
  ],
  fortification: [
    { label: "spawn", built: "spawnsBuilt", needed: "spawnsNeeded" },
    { label: "factory", built: "factoryBuilt", needed: "factoryNeeded" },
    { label: "labs", built: "labsBuilt", needed: "labsNeeded" },
    { label: "links", built: "linksBuilt", needed: "linksNeeded" },
    { label: "ramp", built: "rampartsBuilt", needed: "rampartsNeeded" },
    { label: "mRoad", built: "mineralAccessRoadsBuilt", needed: "mineralAccessRoadsNeeded" },
  ],
  command: [
    { label: "spawn", built: "spawnsBuilt", needed: "spawnsNeeded" },
    { label: "observer", built: "observerBuilt", needed: "observerNeeded" },
    { label: "pSpawn", built: "powerSpawnBuilt", needed: "powerSpawnNeeded" },
    { label: "nuker", built: "nukerBuilt", needed: "nukerNeeded" },
    { label: "factory", built: "factoryBuilt", needed: "factoryNeeded" },
    { label: "links", built: "linksBuilt", needed: "linksNeeded" },
    { label: "labs", built: "labsBuilt", needed: "labsNeeded" },
    { label: "ramp", built: "rampartsBuilt", needed: "rampartsNeeded" },
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
    "roads",
    "rcl5",
    "labor",
    "upgrader",
    "miners",
    "haulers",
  ],
  logistics: ["links", "rcl6"],
  specialization: ["links", "terminal", "mineralContainer", "extractor", "labs", "rcl7"],
  fortification: ["spawns", "factory", "links", "labs", "rcl8"],
  command: ["spawns", "links", "observer", "powerSpawn", "nuker"],
};

const MISSING_SUMMARY = {
  rcl2: "waiting on RCL2",
  rcl5: "waiting on RCL5",
  rcl6: "waiting on RCL6",
  rcl7: "waiting on RCL7",
  rcl8: "waiting on RCL8",
  economyBackbone: "economy backbone not stable",
  buildLabor: "worker needed for sites",
  labor: "worker labor thin",
  upgrader: "upgrader missing",
  miners: "miners below target",
  haulers: "haulers below target",
  sourceContainers: "source containers incomplete",
  hubContainer: "hub container missing",
  controllerContainer: "controller container missing",
  roads: "roads below target",
  extensions: "extensions incomplete",
  tower: "towers incomplete",
  storage: "storage missing",
  links: "link network incomplete",
  terminal: "terminal missing",
  mineralContainer: "mineral container missing",
  extractor: "extractor missing",
  labs: "labs incomplete",
  factory: "factory missing",
  spawns: "spawn network incomplete",
  observer: "observer missing",
  powerSpawn: "power spawn missing",
  nuker: "nuker missing",
  mineralAccessRoad: "mineral access road pending",
  ramparts: "defensive ramparts incomplete",
};

const NEXT_TASK_LABEL = {
  rcl2: "push controller to RCL2",
  rcl5: "push controller to RCL5",
  rcl6: "push controller to RCL6",
  rcl7: "push controller to RCL7",
  rcl8: "push controller to RCL8",
  economyBackbone: "stabilize the early economy backbone",
  buildLabor: "spawn build labor",
  labor: "restore worker labor coverage",
  upgrader: "restore upgrader coverage",
  miners: "restore miner coverage",
  haulers: "restore hauler coverage",
  sourceContainers: "finish source containers",
  hubContainer: "place or finish the hub container",
  controllerContainer: "place or finish the controller container",
  roads: "close remaining road targets",
  extensions: "finish remaining extensions",
  tower: "place or finish the next tower",
  storage: "place or finish storage",
  links: "finish planned links",
  terminal: "place or finish the terminal",
  mineralContainer: "place or finish the mineral container",
  extractor: "place or finish the extractor",
  labs: "place or finish the lab cluster",
  factory: "place or finish the factory",
  spawns: "place or finish the next spawn",
  observer: "place or finish the observer",
  powerSpawn: "place or finish the power spawn",
  nuker: "place or finish the nuker",
  mineralAccessRoad: "finish mineral access road",
  ramparts: "place defensive ramparts",
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
    pushIfShort(buildStatus.spawnsBuilt, buildStatus.spawnsNeeded, "spawns", missing);
    pushIfShort(buildStatus.factoryBuilt, buildStatus.factoryNeeded, "factory", missing);
    pushIfShort(buildStatus.rampartsBuilt, buildStatus.rampartsNeeded, "ramparts", missing);
    return uniqueLabels(missing);
  }

  missing.push.apply(missing, getPhaseCompletionMissing("fortification", buildStatus));

  if (phase === "command") {
    pushIfShort(buildStatus.linksBuilt, buildStatus.linksNeeded, "links", missing);
    pushIfShort(buildStatus.spawnsBuilt, buildStatus.spawnsNeeded, "spawns", missing);
    pushIfShort(buildStatus.observerBuilt, buildStatus.observerNeeded, "observer", missing);
    pushIfShort(
      buildStatus.powerSpawnBuilt,
      buildStatus.powerSpawnNeeded,
      "powerSpawn",
      missing,
    );
    pushIfShort(buildStatus.nukerBuilt, buildStatus.nukerNeeded, "nuker", missing);
    pushIfShort(buildStatus.rampartsBuilt, buildStatus.rampartsNeeded, "ramparts", missing);
  }

  return uniqueLabels(missing);
}

function getStableEconomyMissing(room, state, desiredTotalHaulers) {
  const roleCounts = state.roleCounts || {};
  const laborers = (roleCounts.worker || 0) + (roleCounts.jrworker || 0);
  const minimumHaulers = Math.max(
    1,
    Math.min(desiredTotalHaulers, state.sources ? state.sources.length || 1 : 1),
  );
  const missing = [];

  if (laborers < 1) missing.push("labor");
  if (
    (roleCounts.upgrader || 0) < 1 &&
    !reservePolicy.shouldHoldRcl8Upgrading(room, state)
  ) {
    missing.push("upgrader");
  }
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
      const roleCounts = state.roleCounts || {};
      const buildLabor = (roleCounts.worker || 0) + (roleCounts.jrworker || 0);
      if ((buildStatus.sites || 0) > 0 && buildLabor <= 0) {
        missing.push("buildLabor");
      } else {
        missing.push("economyBackbone");
      }
    }
    return uniqueLabels(missing);
  }

  if (phase === "development") {
    if (!room.controller || room.controller.level < 5) {
      missing.push("rcl5");
    }
    missing.push.apply(
      missing,
      getStableEconomyMissing(room, state, desiredTotalHaulers),
    );
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

function formatStorageRejectSummary(rejectCounts) {
  if (!rejectCounts) return "none";

  const reasonOrder = ["terrain", "occupied", "site", "border", "blocked", "existing"];
  const parts = [];

  for (let i = 0; i < reasonOrder.length; i++) {
    const reason = reasonOrder[i];
    if (!rejectCounts[reason]) continue;
    parts.push(`${reason} ${rejectCounts[reason]}`);
  }

  return parts.length > 0 ? parts.join(", ") : "none";
}

function formatStoragePlanningLine(buildStatus) {
  if (!buildStatus) return null;
  if ((buildStatus.storageNeeded || 0) <= (buildStatus.storageBuilt || 0)) return null;

  const futurePlan = buildStatus.futurePlan || null;
  const storagePlan = futurePlan && futurePlan.storagePlan ? futurePlan.storagePlan : null;
  if (!storagePlan) return null;

  const posLabel = storagePlan.pos
    ? `${storagePlan.pos.x},${storagePlan.pos.y}`
    : "none";
  const modeLabel = storagePlan.mode || "planned";
  const rejectLabel = formatStorageRejectSummary(storagePlan.fixedRejectCounts);
  const fitLabel =
    storagePlan.criticalOpen || storagePlan.roadOpen || storagePlan.utilityOpen
      ? `fit crit ${storagePlan.criticalOpen || 0}/3 | roads ${storagePlan.roadOpen || 0}/6 | util ${storagePlan.utilityOpen || 0}/3`
      : null;

  if (modeLabel === "fallback" || modeLabel === "blocked") {
    return `Storage plan ${modeLabel} ${posLabel} | fixed blocked ${storagePlan.fixedRejectedCount || 0}/${storagePlan.fixedCandidateCount || 0} | reject ${rejectLabel}${fitLabel ? ` | ${fitLabel}` : ""}`;
  }

  return `Storage plan ${modeLabel} ${posLabel}${fitLabel ? ` | ${fitLabel}` : ""}`;
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

function getRoleTargetCount(state, role, targetId) {
  if (
    !state.targetRoleMap ||
    !state.targetRoleMap[role] ||
    !state.targetRoleMap[role][targetId]
  ) {
    return 0;
  }

  return state.targetRoleMap[role][targetId].length;
}

function countQueuedForTarget(room, role, targetId) {
  const queue = getQueue(room);
  let total = 0;

  for (let i = 0; i < queue.length; i++) {
    if (queue[i].role === role && queue[i].targetId === targetId) {
      total++;
    }
  }

  return total;
}

function getSafeModeLabel(room) {
  if (!room.controller || !room.controller.safeMode) return "off";
  return `${room.controller.safeMode}`;
}

function getStorageEnergy(room) {
  return room.storage ? room.storage.store[RESOURCE_ENERGY] || 0 : 0;
}

function fmtAmount(value) {
  return Math.round(value || 0).toLocaleString();
}

function formatPolicyValue(value) {
  if (value === true) return "on";
  if (value === false) return "off";
  return "global";
}

function formatTerminalMinerals(summary) {
  const minerals = summary && summary.minerals ? summary.minerals : [];
  if (minerals.length === 0) return "none";

  return minerals
    .slice(0, 4)
    .map(function (row) {
      return `${row.resourceType} ${fmtAmount(row.amount)}/${fmtAmount(row.target)}`;
    })
    .join(", ");
}

function formatWaitingLogisticsLines(logistics) {
  if (!logistics || !logistics.waiting || logistics.waiting.length === 0) {
    return ["Waiting: none"];
  }

  return logistics.waiting.map(function (row) {
    return "Waiting: " + row.summary;
  });
}

function formatRecentLogisticsLines(logistics) {
  const recent =
    logistics && logistics.history && Array.isArray(logistics.history.recent)
      ? logistics.history.recent
      : [];

  if (recent.length === 0) {
    return ["Recent: none"];
  }

  return recent.map(function (snapshot) {
    return (
      "Recent " +
      snapshot.t +
      ": " +
      snapshot.state +
      ", open " +
      snapshot.open +
      ", blocked " +
      snapshot.blocked +
      ", unclaimed " +
      fmtAmount(snapshot.unclaimed)
    );
  });
}

function formatAdvancedBacklogLine(logistics) {
  const backlog = logistics && logistics.advancedBacklog
    ? logistics.advancedBacklog
    : null;

  return "Advanced Backlog " + (backlog ? backlog.summary : "none");
}

function getStoredAmount(target, resourceType) {
  if (!target || !target.store) return 0;
  if (typeof target.store.getUsedCapacity === "function") {
    const used = target.store.getUsedCapacity(resourceType);
    if (typeof used === "number" && used > 0) return used;
  }

  return target.store[resourceType] || 0;
}

function getStoreResourceTypes(target) {
  const resources = [];
  if (!target || !target.store) return resources;

  for (const resourceType in target.store) {
    if (!Object.prototype.hasOwnProperty.call(target.store, resourceType)) continue;
    if (getStoredAmount(target, resourceType) <= 0) continue;
    resources.push(resourceType);
  }

  return resources.sort();
}

function formatStoreSummary(target, limit) {
  const resources = getStoreResourceTypes(target);
  if (resources.length === 0) return "empty";

  const visibleLimit = typeof limit === "number" ? limit : 5;
  const parts = resources.slice(0, visibleLimit).map(function (resourceType) {
    return `${resourceType} ${fmtAmount(getStoredAmount(target, resourceType))}`;
  });
  if (resources.length > visibleLimit) {
    parts.push(`+${resources.length - visibleLimit} more`);
  }

  return parts.join(", ");
}

function findFirstStructure(state, structureType) {
  const structures =
    state && state.structuresByType && state.structuresByType[structureType]
      ? state.structuresByType[structureType]
      : [];
  return structures.length > 0 ? structures[0] : null;
}

function getFactorySettings() {
  return config.ADVANCED && config.ADVANCED.FACTORY
    ? config.ADVANCED.FACTORY
    : {};
}

function getFactoryRecipe(product) {
  return typeof COMMODITIES !== "undefined" && product
    ? COMMODITIES[product] || null
    : null;
}

function getAdvancedOpsMemory(room) {
  return Memory.rooms &&
    Memory.rooms[room.name] &&
    Memory.rooms[room.name].advancedOps
    ? Memory.rooms[room.name].advancedOps
    : {};
}

function getFactoryProduct(advanced, room) {
  const memory = getAdvancedOpsMemory(room);
  if (memory.batteryPolicy === "disabled") return null;

  const settings = getFactorySettings();
  if (advanced && advanced.factoryProduct) return advanced.factoryProduct;

  const products = settings.PRODUCT_PRIORITY || [];
  const storageEnergy = getStorageEnergy(room);
  for (let i = 0; i < products.length; i++) {
    if (
      products[i] === "battery" &&
      storageEnergy >= (settings.MIN_STORAGE_ENERGY || 50000) &&
      getFactoryRecipe(products[i])
    ) {
      return products[i];
    }
  }

  return products.length > 0 ? products[0] : null;
}

function getHubAmount(room, resourceType) {
  return getStoredAmount(room.storage, resourceType) +
    getStoredAmount(room.terminal, resourceType);
}

function getFactoryInputBottlenecks(room, factory, recipe) {
  const bottlenecks = [];
  if (!recipe || !recipe.components) return bottlenecks;

  for (const resourceType in recipe.components) {
    if (!Object.prototype.hasOwnProperty.call(recipe.components, resourceType)) continue;
    const need = recipe.components[resourceType] || 0;
    const inFactory = getStoredAmount(factory, resourceType);
    if (inFactory >= need) continue;
    const hub = getHubAmount(room, resourceType);
    bottlenecks.push({
      resourceType: resourceType,
      need: need,
      factory: inFactory,
      hub: hub,
      fillable: hub > 0,
    });
  }

  return bottlenecks;
}

function formatFactoryBottlenecks(bottlenecks) {
  if (!bottlenecks || bottlenecks.length === 0) return "none";

  return bottlenecks
    .slice(0, 4)
    .map(function (row) {
      return `${row.resourceType} ${fmtAmount(row.factory)}/${fmtAmount(row.need)} hub ${fmtAmount(row.hub)}`;
    })
    .join(", ");
}

function getFactoryOutputAccumulation(factory, product, recipe) {
  const settings = getFactorySettings();
  const exportBatch = settings.EXPORT_BATCH || 100;
  const resources = getStoreResourceTypes(factory);
  const rows = [];

  for (let i = 0; i < resources.length; i++) {
    const resourceType = resources[i];
    if (resourceType === RESOURCE_ENERGY) continue;
    const amount = getStoredAmount(factory, resourceType);
    const expectedInput = recipe && recipe.components && recipe.components[resourceType];
    if (resourceType === product && amount >= exportBatch) {
      rows.push(`${resourceType} ${fmtAmount(amount)}>=${fmtAmount(exportBatch)}`);
    } else if (resourceType !== product && !expectedInput) {
      rows.push(`${resourceType} ${fmtAmount(amount)} unexpected`);
    }
  }

  return rows;
}

function getBatteryUsefulness(room, factory) {
  const memory = getAdvancedOpsMemory(room);
  const settings = getFactorySettings();
  const products = settings.PRODUCT_PRIORITY || [];
  const battery = "battery";
  const configured = products.indexOf(battery) !== -1;
  const policy = ["reserve", "commodity", "disabled"].indexOf(memory.batteryPolicy) !== -1
    ? memory.batteryPolicy
    : "unknown";
  const stock =
    getStoredAmount(factory, battery) +
    getStoredAmount(room.storage, battery) +
    getStoredAmount(room.terminal, battery);
  let trend = "unavailable";
  let classification = policy;

  if (policy === "unknown") {
    classification = configured ? "unknown" : "disabled";
  }

  if (memory.batteryStockLast && typeof memory.batteryStockLast.amount === "number") {
    if (stock > memory.batteryStockLast.amount) trend = "up";
    else if (stock < memory.batteryStockLast.amount) trend = "down";
    else trend = "flat";
  }

  if (!configured) {
    return {
      status: "not-configured",
      policy: policy,
      classification: classification,
      stock: stock,
      trend: trend,
      reason: "battery is not in factory product priority",
    };
  }

  if (policy === "disabled") {
    return {
      status: "disabled",
      policy: policy,
      classification: "disabled",
      stock: stock,
      trend: trend,
      reason: "operator disabled battery production intent",
    };
  }

  if (policy === "reserve") {
    return {
      status: "reserve",
      policy: policy,
      classification: "reserve",
      stock: stock,
      trend: trend,
      reason: "batteries treated as compressed energy reserve",
    };
  }

  if (policy === "commodity") {
    return {
      status: "commodity",
      policy: policy,
      classification: "commodity",
      stock: stock,
      trend: trend,
      reason: "batteries reserved for future commodity chains",
    };
  }

  if (stock >= 10000) {
    return {
      status: "excessive",
      policy: policy,
      classification: classification,
      stock: stock,
      trend: trend,
      reason: "local battery stock is high and no local consumer is known",
    };
  }

  return {
    status: "unclear",
    policy: policy,
    classification: classification,
    stock: stock,
    trend: trend,
    reason: "configured factory fallback; no local battery consumer is known",
  };
}

function getProductionOwnership(room, backlog, labelPrefix, supplyLabels, withdrawLabels) {
  const supply = {};
  const withdraw = {};
  const active = [];

  for (let i = 0; i < supplyLabels.length; i++) supply[supplyLabels[i]] = true;
  for (let i = 0; i < withdrawLabels.length; i++) withdraw[withdrawLabels[i]] = true;

  let advancedSupply = false;
  let advancedWithdraw = false;

  for (let i = 0; i < backlog.length; i++) {
    const row = backlog[i];
    if (!row || !row.label || row.label.indexOf(labelPrefix) !== 0) continue;
    active.push(`${row.label} ${row.resourceType} ${fmtAmount(row.amount)}`);
    if (supply[row.label]) advancedSupply = true;
    if (withdraw[row.label]) advancedWithdraw = true;
  }

  const opsSupply = false;
  const opsWithdraw = false;
  const classify = function (advancedOwned, opsOwned) {
    if (advancedOwned && opsOwned) return "mixed";
    if (opsOwned) return "ops-logistics";
    if (advancedOwned) return "advanced-hauler";
    return "unknown";
  };
  const supplyOwner = classify(advancedSupply, opsSupply);
  const withdrawOwner = classify(advancedWithdraw, opsWithdraw);
  const activePath = supplyOwner === withdrawOwner
    ? supplyOwner
    : `${supplyOwner}/${withdrawOwner}`;
  let status = "bypasses request standards";

  if (activePath === "ops-logistics") status = "request aligned";
  else if (activePath.indexOf("mixed") !== -1 || activePath.indexOf("ops-logistics") !== -1) {
    status = "mixed ownership";
  } else if (activePath === "unknown") {
    status = "unknown";
  }

  return {
    supplyOwner: supplyOwner,
    withdrawOwner: withdrawOwner,
    activePath: activePath,
    status: status,
    active: active,
  };
}

function getRawOpsLogisticsRequests(roomName) {
  if (
    !Memory.ops ||
    !Memory.ops.logistics ||
    !Memory.ops.logistics.requests
  ) {
    return [];
  }

  const root = Memory.ops.logistics.requests;
  return Object.keys(root).map(function (id) {
    return root[id];
  }).filter(function (request) {
    return request && (!roomName || request.roomName === roomName);
  });
}

function hasOpsProductionRequest(room, endpointId, direction, resourceType) {
  if (!room || !endpointId) return false;

  const rows = opsLogisticsManager.listRequests(room.name).filter(function (row) {
    if (!row || row.status === "done" || row.status === "canceled") return false;
    if (resourceType && row.resourceType !== resourceType) return false;
    if (row.from === "factory" || row.to === "factory" || row.from === "lab" || row.to === "lab") return true;
    return false;
  });
  if (rows.length > 0) return true;

  const raw = getRawOpsLogisticsRequests(room.name);
  for (let i = 0; i < raw.length; i++) {
    const request = raw[i];
    if (!request || request.status === "done" || request.status === "canceled") continue;
    if (resourceType && request.resourceType !== resourceType) continue;
    if (direction === "source" && request.sourceId === endpointId) return true;
    if (direction === "target" && request.targetId === endpointId) return true;
  }

  return false;
}

function classifyProductionEndpointOwnership(executionOwned, opsVisible) {
  if (executionOwned && opsVisible) return "dual-owned";
  if (executionOwned) return "advanced-hauler";
  if (opsVisible) return "ops-logistics";
  return "request-visible";
}

function lifecycleForEndpoint(baseState, blockedReason, remaining) {
  if (baseState) return baseState;
  if (blockedReason && blockedReason !== "none" && blockedReason !== "ready") return "blocked";
  if ((remaining || 0) <= 0) return "satisfied";
  return "needed";
}

function createProductionEndpoint(room, settings) {
  const opts = settings || {};
  const endpointId = opts.endpointId || "unknown";
  const direction = opts.classification === "source" ? "source" : "target";
  const opsVisible = hasOpsProductionRequest(room, endpointId, direction, opts.resourceType);
  const executionOwned = opts.executionOwned !== false;
  const remaining = Math.max(0, opts.remaining || opts.amount || 0);
  const blockedReason = opts.blockedReason || "none";

  return {
    identity: `${room.name}:${opts.type || "production_endpoint"}:${opts.resourceType || "resource"}:${endpointId}`,
    type: opts.type || "production_endpoint",
    classification: opts.classification || "target",
    resourceType: opts.resourceType || "unknown",
    requestedAmount: Math.max(0, opts.amount || 0),
    remaining: remaining,
    endpointId: endpointId,
    lifecycle: lifecycleForEndpoint(opts.lifecycle, blockedReason, remaining),
    ownership: classifyProductionEndpointOwnership(executionOwned, opsVisible),
    blockedReason: blockedReason,
    executionOwner: executionOwned ? "advanced-hauler" : "none",
  };
}

function formatProductionEndpointRow(row) {
  return `${row.type} ${row.resourceType} need ${fmtAmount(row.requestedAmount)} remaining ${fmtAmount(row.remaining)} ${row.classification} ${String(row.endpointId).slice(-6)} lifecycle ${row.lifecycle} ownership ${row.ownership} blocked ${row.blockedReason} execution ${row.executionOwner}`;
}

function formatProductionEndpointLines(rows) {
  if (!rows || rows.length === 0) {
    return ["Production Requests none | visibility request-style only | no ops logistics requests created"];
  }

  const lines = [
    `Production Requests ${rows.length} | visibility request-style only | no ops logistics requests created`,
  ];
  for (let i = 0; i < rows.length && i < 5; i++) {
    lines.push(formatProductionEndpointRow(rows[i]));
  }
  const dual = rows.filter(function (row) {
    return row.ownership === "dual-owned";
  });
  lines.push(`Production Ownership Guard dual-owned ${dual.length}${dual.length > 0 ? " | " + dual.map(function (row) { return row.type + ":" + row.resourceType; }).join(", ") : ""}`);
  return lines;
}

function buildFactoryProductionEndpoints(room, diagnostics) {
  const rows = [];
  const factory = diagnostics.factory;
  const recipe = diagnostics.recipe;
  const settings = getFactorySettings();
  const product = diagnostics.configuredProduct;

  if (!factory) {
    return [
      createProductionEndpoint(room, {
        type: "factory_supply",
        classification: "target",
        resourceType: "unknown",
        endpointId: "factory_missing",
        amount: 0,
        remaining: 0,
        lifecycle: "blocked",
        blockedReason: "factory missing",
        executionOwned: false,
      }),
    ];
  }

  if (diagnostics.battery.policy === "disabled" && (settings.PRODUCT_PRIORITY || []).indexOf("battery") !== -1) {
    rows.push(createProductionEndpoint(room, {
      type: "factory_supply",
      classification: "target",
      resourceType: "battery",
      endpointId: factory.id,
      amount: 0,
      remaining: 0,
      lifecycle: "disabled",
      blockedReason: "battery policy disabled",
      executionOwned: false,
    }));
  }

  for (let i = 0; i < diagnostics.bottlenecks.length; i++) {
    const row = diagnostics.bottlenecks[i];
    const label = row.resourceType === RESOURCE_ENERGY ? "factory_energy" : "factory_input";
    rows.push(createProductionEndpoint(room, {
      type: label === "factory_energy" ? "factory_supply_energy" : "factory_supply",
      classification: "target",
      resourceType: row.resourceType,
      endpointId: factory.id,
      amount: Math.max(0, row.need - row.factory),
      remaining: Math.max(0, row.need - row.factory),
      blockedReason: row.fillable ? "none" : "missing source resource",
      executionOwned: true,
    }));
  }

  if (recipe && recipe.components) {
    const resources = getStoreResourceTypes(factory);
    const exportBatch = settings.EXPORT_BATCH || 100;
    for (let i = 0; i < resources.length; i++) {
      const resourceType = resources[i];
      if (resourceType === RESOURCE_ENERGY) continue;
      const amount = getStoredAmount(factory, resourceType);
      const expectedInput = recipe.components[resourceType];
      if (
        (resourceType === product && amount >= exportBatch) ||
        (resourceType !== product && !expectedInput && amount > 0)
      ) {
        rows.push(createProductionEndpoint(room, {
          type: "factory_withdraw",
          classification: "source",
          resourceType: resourceType,
          endpointId: factory.id,
          amount: amount,
          remaining: amount,
          blockedReason: "none",
          executionOwned: true,
        }));
      }
    }
  }

  return rows;
}

function getFactoryDiagnostics(room, state, advanced) {
  const factory = findFirstStructure(state, STRUCTURE_FACTORY);
  const memory = getAdvancedOpsMemory(room);
  const settings = getFactorySettings();
  const enabled = settings.ENABLED !== false;
  const product = enabled ? getFactoryProduct(advanced, room) : null;
  const recipe = getFactoryRecipe(product);
  const bottlenecks = getFactoryInputBottlenecks(room, factory, recipe);
  const output = getFactoryOutputAccumulation(factory, product, recipe);
  const battery = getBatteryUsefulness(room, factory);
  const ownership = getProductionOwnership(
    room,
    advanced && advanced.taskBacklog ? advanced.taskBacklog : [],
    "factory_",
    ["factory_input", "factory_energy"],
    ["factory_output"],
  );
  let classification = "missing";
  let blockedReason = "factory missing";

  if (factory && memory.factoryPaused === true) {
    classification = "idle";
    blockedReason = "operator paused";
  } else if (factory && !enabled) {
    classification = "idle";
    blockedReason = "factory config disabled";
  } else if (factory && output.length > 0) {
    classification = "accumulating";
    blockedReason = "output accumulation";
  } else if (factory && product && factory.cooldown > 0) {
    classification = "active";
    blockedReason = `cooldown ${factory.cooldown}`;
  } else if (factory && product && bottlenecks.some(function (row) { return !row.fillable; })) {
    classification = "blocked";
    blockedReason = "missing inputs";
  } else if (factory && product && bottlenecks.length > 0) {
    classification = "blocked";
    blockedReason = "awaiting input haul";
  } else if (factory && product) {
    classification = "active";
    blockedReason = "ready";
  } else if (factory) {
    classification = "idle";
    blockedReason = "no selected product";
  }

  return {
    exists: !!factory,
    factory: factory,
    cooldown: factory && typeof factory.cooldown === "number" ? factory.cooldown : 0,
    configuredProduct: product,
    recipe: recipe,
    battery: battery,
    ownership: ownership,
    energy: getStoredAmount(factory, RESOURCE_ENERGY),
    bottlenecks: bottlenecks,
    output: output,
    classification: classification,
    blockedReason: blockedReason,
    advancedStatus: memory.factoryPaused === true
      ? "paused"
      : advanced && advanced.factoryStatus
        ? advanced.factoryStatus
        : "inactive",
    taskBacklog: advanced && advanced.taskBacklog ? advanced.taskBacklog : [],
  };
}

function formatFactoryLines(room, diagnostics) {
  const lines = [`[OPS][${room.name}][FACTORY]`];
  const endpointLines = formatProductionEndpointLines(buildFactoryProductionEndpoints(room, diagnostics));
  if (!diagnostics.exists) {
    lines.push("Factory missing");
    lines.push("State missing | Blocked factory missing");
    lines.push("Battery policy unknown | Stock 0 | Trend unavailable | Classification unknown");
    lines.push("Ownership supply unknown | withdraw unknown | active unknown | alignment unknown");
    Array.prototype.push.apply(lines, endpointLines);
    lines.push("No market, terminal balancing, or production action performed.");
    return lines;
  }

  const recipeLabel = diagnostics.configuredProduct || "none";
  const outputLabel = diagnostics.output.length > 0 ? diagnostics.output.join(", ") : "none";
  const backlog = diagnostics.ownership.active;

  lines.push(
    `Factory exists | State ${diagnostics.classification} | Status ${diagnostics.advancedStatus} | Cooldown ${diagnostics.cooldown}`,
  );
  lines.push(`Recipe ${recipeLabel} | Last action not tracked`);
  lines.push(`Store ${formatStoreSummary(diagnostics.factory, 6)}`);
  lines.push(
    `Battery policy ${diagnostics.battery.policy} | Stock ${fmtAmount(diagnostics.battery.stock)} | Trend ${diagnostics.battery.trend} | Classification ${diagnostics.battery.classification}`,
  );
  lines.push(`Battery energy ${fmtAmount(diagnostics.energy)} | Usefulness ${diagnostics.battery.status}`);
  lines.push(`Battery note ${diagnostics.battery.reason}`);
  lines.push(`Input bottlenecks ${formatFactoryBottlenecks(diagnostics.bottlenecks)}`);
  lines.push(`Output accumulation ${outputLabel}`);
  lines.push(`Blocked ${diagnostics.blockedReason}`);
  lines.push(`Ownership supply ${diagnostics.ownership.supplyOwner} | withdraw ${diagnostics.ownership.withdrawOwner} | active ${diagnostics.ownership.activePath} | alignment ${diagnostics.ownership.status}`);
  lines.push(`Logistics alignment ${backlog.length > 0 ? backlog.join(", ") : "no factory advanced backlog"}`);
  Array.prototype.push.apply(lines, endpointLines);
  lines.push("No market, terminal balancing, or production action performed.");
  return lines;
}

function getLabSettings() {
  return config.ADVANCED && config.ADVANCED.LABS
    ? config.ADVANCED.LABS
    : {};
}

function getPrimaryMineral(target) {
  if (!target || !target.store) return null;
  if (target.mineralType && getStoredAmount(target, target.mineralType) > 0) {
    return target.mineralType;
  }

  const resources = getStoreResourceTypes(target);
  for (let i = 0; i < resources.length; i++) {
    if (resources[i] !== RESOURCE_ENERGY) return resources[i];
  }

  return null;
}

function getReactionProduct(reagentA, reagentB) {
  if (!reagentA || !reagentB || typeof REACTIONS === "undefined") return null;
  if (REACTIONS[reagentA] && REACTIONS[reagentA][reagentB]) return REACTIONS[reagentA][reagentB];
  if (REACTIONS[reagentB] && REACTIONS[reagentB][reagentA]) return REACTIONS[reagentB][reagentA];
  return null;
}

function getReactionInputs(product) {
  if (!product || typeof REACTIONS === "undefined") return null;

  for (const reagentA in REACTIONS) {
    if (!Object.prototype.hasOwnProperty.call(REACTIONS, reagentA)) continue;
    for (const reagentB in REACTIONS[reagentA]) {
      if (!Object.prototype.hasOwnProperty.call(REACTIONS[reagentA], reagentB)) continue;
      if (REACTIONS[reagentA][reagentB] === product) {
        return {
          reagentA: reagentA,
          reagentB: reagentB,
        };
      }
    }
  }

  return null;
}

function getLabLayoutMemory(room) {
  return Memory.rooms &&
    Memory.rooms[room.name] &&
    Memory.rooms[room.name].advancedOps &&
    Memory.rooms[room.name].advancedOps.labLayout
    ? Memory.rooms[room.name].advancedOps.labLayout
    : null;
}

function getObjectByIdSafe(id) {
  return id && Game.getObjectById ? Game.getObjectById(id) : null;
}

function getLabDiagnostics(room, state, advanced) {
  const labs =
    state && state.structuresByType && state.structuresByType[STRUCTURE_LAB]
      ? state.structuresByType[STRUCTURE_LAB]
      : [];
  const settings = getLabSettings();
  const memory = getAdvancedOpsMemory(room);
  const enabled = settings.ENABLED !== false;
  const layout = getLabLayoutMemory(room);
  const inputIds = layout && layout.inputIds ? layout.inputIds.slice(0, 2) : [];
  const reactorIds = layout && layout.reactorIds ? layout.reactorIds.slice() : [];
  const inputA = getObjectByIdSafe(inputIds[0]);
  const inputB = getObjectByIdSafe(inputIds[1]);
  const reagentA = getPrimaryMineral(inputA);
  const reagentB = getPrimaryMineral(inputB);
  const detectedProduct = getReactionProduct(reagentA, reagentB);
  const product = detectedProduct || (advanced && advanced.labProduct ? advanced.labProduct : null);
  const desiredInputs = product ? getReactionInputs(product) : null;
  const reactionAmount = settings.REACTION_AMOUNT || 5;
  const missing = [];
  const outputRows = [];
  const cooldowns = labs.filter(function (lab) { return lab.cooldown > 0; }).length;
  const backlog = advanced && advanced.taskBacklog ? advanced.taskBacklog : [];
  const ownership = getProductionOwnership(
    room,
    backlog,
    "lab_",
    ["lab_input"],
    ["lab_output", "lab_cleanup"],
  );

  if (desiredInputs) {
    const desiredA = desiredInputs.reagentA;
    const desiredB = desiredInputs.reagentB;
    const inputAAmount = getStoredAmount(inputA, desiredA);
    const inputBAmount = getStoredAmount(inputB, desiredB);
    if (inputAAmount < reactionAmount) {
      missing.push(`${desiredA} lab ${fmtAmount(inputAAmount)} hub ${fmtAmount(getHubAmount(room, desiredA))}`);
    }
    if (inputBAmount < reactionAmount) {
      missing.push(`${desiredB} lab ${fmtAmount(inputBAmount)} hub ${fmtAmount(getHubAmount(room, desiredB))}`);
    }
  }

  const outputUnloadAt = settings.OUTPUT_UNLOAD_AT || 250;
  for (let i = 0; i < reactorIds.length; i++) {
    const lab = getObjectByIdSafe(reactorIds[i]);
    if (!lab || !product) continue;
    const amount = getStoredAmount(lab, product);
    if (amount >= outputUnloadAt) {
      outputRows.push(`${lab.id.slice(-4)} ${product} ${fmtAmount(amount)}`);
    }
  }

  let classification = "missing";
  let blockedReason = "labs missing";
  if (labs.length > 0 && memory.labsPaused === true) {
    classification = "idle";
    blockedReason = "operator paused";
  } else if (labs.length > 0 && !enabled) {
    classification = "idle";
    blockedReason = "lab config disabled";
  } else if (labs.length > 0 && labs.length < 3) {
    classification = "blocked";
    blockedReason = "need at least 3 labs";
  } else if (labs.length > 0 && (!layout || inputIds.length < 2 || reactorIds.length <= 0)) {
    classification = "blocked";
    blockedReason = "input/output layout unavailable";
  } else if (labs.length > 0 && outputRows.length > 0) {
    classification = "accumulating";
    blockedReason = "output accumulation";
  } else if (labs.length > 0 && missing.length > 0) {
    classification = "blocked";
    blockedReason = "missing reagents";
  } else if (labs.length > 0 && product && cooldowns > 0) {
    classification = "active";
    blockedReason = `cooldowns ${cooldowns}`;
  } else if (labs.length > 0 && product) {
    classification = "active";
    blockedReason = "ready";
  } else if (labs.length > 0) {
    classification = "idle";
    blockedReason = advanced && advanced.labReason ? advanced.labReason : "no current reaction";
  }

  return {
    labs: labs,
    layout: layout,
    inputIds: inputIds,
    reactorIds: reactorIds,
    product: product,
    reagentA: reagentA || (desiredInputs ? desiredInputs.reagentA : null),
    reagentB: reagentB || (desiredInputs ? desiredInputs.reagentB : null),
    missing: missing,
    outputRows: outputRows,
    cooldowns: cooldowns,
    classification: classification,
    blockedReason: blockedReason,
    advancedStatus: memory.labsPaused === true
      ? "paused"
      : advanced && advanced.labStatus
        ? advanced.labStatus
        : "inactive",
    advancedReason: advanced && advanced.labReason ? advanced.labReason : null,
    ownership: ownership,
    taskBacklog: backlog,
  };
}

function getLabExpectedResource(diagnostics, labId) {
  if (!diagnostics || !labId) return null;
  if (diagnostics.inputIds[0] === labId) return diagnostics.reagentA;
  if (diagnostics.inputIds[1] === labId) return diagnostics.reagentB;
  if (diagnostics.reactorIds.indexOf(labId) !== -1) return diagnostics.product;
  return null;
}

function buildLabProductionEndpoints(room, diagnostics) {
  const rows = [];
  const settings = getLabSettings();
  const reactionAmount = settings.REACTION_AMOUNT || 5;
  const outputUnloadAt = settings.OUTPUT_UNLOAD_AT || 250;

  if (!diagnostics.labs || diagnostics.labs.length === 0) {
    return [
      createProductionEndpoint(room, {
        type: "lab_supply",
        classification: "target",
        resourceType: "unknown",
        endpointId: "labs_missing",
        amount: 0,
        remaining: 0,
        lifecycle: "blocked",
        blockedReason: "labs missing",
        executionOwned: false,
      }),
    ];
  }

  const inputLabs = diagnostics.inputIds.map(getObjectByIdSafe).filter(Boolean);
  for (let i = 0; i < inputLabs.length; i++) {
    const lab = inputLabs[i];
    const resourceType = getLabExpectedResource(diagnostics, lab.id);
    if (!resourceType) continue;
    const current = getStoredAmount(lab, resourceType);
    if (current >= reactionAmount) continue;
    const hub = getHubAmount(room, resourceType);
    rows.push(createProductionEndpoint(room, {
      type: "lab_supply",
      classification: "target",
      resourceType: resourceType,
      endpointId: lab.id,
      amount: Math.max(0, reactionAmount - current),
      remaining: Math.max(0, reactionAmount - current),
      blockedReason: hub > 0 ? "none" : "missing source resource",
      executionOwned: true,
    }));
  }

  const reactors = diagnostics.reactorIds.map(getObjectByIdSafe).filter(Boolean);
  for (let i = 0; i < reactors.length; i++) {
    const lab = reactors[i];
    if (!diagnostics.product) continue;
    const amount = getStoredAmount(lab, diagnostics.product);
    if (amount >= outputUnloadAt) {
      rows.push(createProductionEndpoint(room, {
        type: "lab_withdraw",
        classification: "source",
        resourceType: diagnostics.product,
        endpointId: lab.id,
        amount: amount,
        remaining: amount,
        blockedReason: "none",
        executionOwned: true,
      }));
    }
  }

  for (let i = 0; i < diagnostics.labs.length; i++) {
    const lab = diagnostics.labs[i];
    const primary = getPrimaryMineral(lab);
    const expected = getLabExpectedResource(diagnostics, lab.id);
    if (primary && expected && primary !== expected) {
      rows.push(createProductionEndpoint(room, {
        type: "lab_withdraw_cleanup",
        classification: "source",
        resourceType: primary,
        endpointId: lab.id,
        amount: getStoredAmount(lab, primary),
        remaining: getStoredAmount(lab, primary),
        blockedReason: "wrong lab mineral",
        executionOwned: true,
      }));
    }
  }

  return rows;
}

function formatLabStores(labs) {
  if (!labs || labs.length === 0) return "none";

  return labs
    .slice(0, 6)
    .map(function (lab) {
      return `${lab.id.slice(-4)} ${formatStoreSummary(lab, 3)}`;
    })
    .join(" | ");
}

function formatLabLines(room, diagnostics) {
  const lines = [`[OPS][${room.name}][LABS]`];
  const endpointLines = formatProductionEndpointLines(buildLabProductionEndpoints(room, diagnostics));
  if (diagnostics.labs.length === 0) {
    lines.push("Labs missing | Count 0");
    lines.push("State missing | Blocked labs missing");
    lines.push("Ownership supply unknown | withdraw unknown | active unknown | alignment unknown");
    Array.prototype.push.apply(lines, endpointLines);
    lines.push("No boost, combat, market, terminal, or reaction action performed.");
    return lines;
  }

  const backlog = diagnostics.ownership.active;
  const inputLabel = diagnostics.inputIds.length > 0 ? diagnostics.inputIds.join(", ") : "unknown";
  const reactorLabel = diagnostics.reactorIds.length > 0 ? diagnostics.reactorIds.join(", ") : "unknown";

  lines.push(
    `Labs ${diagnostics.labs.length} | State ${diagnostics.classification} | Status ${diagnostics.advancedStatus}`,
  );
  lines.push(`Inputs ${inputLabel} | Outputs ${reactorLabel}`);
  lines.push(`Reaction ${diagnostics.product || "none"} | Reagents ${diagnostics.reagentA || "?"} + ${diagnostics.reagentB || "?"}`);
  lines.push(`Stores ${formatLabStores(diagnostics.labs)}`);
  lines.push(`Energy ${fmtAmount(diagnostics.labs.reduce(function (sum, lab) { return sum + getStoredAmount(lab, RESOURCE_ENERGY); }, 0))} | Cooldowns ${diagnostics.cooldowns}`);
  lines.push(`Missing reagents ${diagnostics.missing.length > 0 ? diagnostics.missing.join(", ") : "none"}`);
  lines.push(`Output accumulation ${diagnostics.outputRows.length > 0 ? diagnostics.outputRows.join(", ") : "none"}`);
  lines.push(`Blocked ${diagnostics.blockedReason}${diagnostics.advancedReason ? " | reason " + diagnostics.advancedReason : ""}`);
  lines.push(`Ownership supply ${diagnostics.ownership.supplyOwner} | withdraw ${diagnostics.ownership.withdrawOwner} | active ${diagnostics.ownership.activePath} | alignment ${diagnostics.ownership.status}`);
  lines.push(`Logistics alignment ${backlog.length > 0 ? backlog.join(", ") : "no lab advanced backlog"}`);
  Array.prototype.push.apply(lines, endpointLines);
  lines.push("No boost, combat, market, terminal, or reaction action performed.");
  return lines;
}

function getWorkerBodyCost(room, state) {
  const queue = getQueue(room);
  for (let i = 0; i < queue.length; i++) {
    if (
      (queue[i].role === "worker" || queue[i].role === "jrworker") &&
      typeof queue[i].bodyCost === "number"
    ) {
      return queue[i].bodyCost;
    }
  }

  return room.energyCapacityAvailable >= 300 ? 300 : room.energyCapacityAvailable || 0;
}

function getLaborDesired(room, state, advanceMissing) {
  const spawnManager = require("spawn_manager");
  const phase = state.phase || "bootstrap";
  let desired = phase === "bootstrap"
    ? spawnManager.getDesiredBootstrapJrWorkers(room, state)
    : spawnManager.getDesiredWorkers(room, state);

  if (
    advanceMissing &&
    (advanceMissing.indexOf("labor") !== -1 || advanceMissing.indexOf("buildLabor") !== -1)
  ) {
    desired = Math.max(desired, 1);
  }

  return desired;
}

function classifyLaborBlocker(room, state, desired, current, queued, spawn) {
  if (desired <= current) return "covered";
  if (!state || !state.roleCounts) return "missing memory/state";

  const bodyCost = getWorkerBodyCost(room, state);
  const spawns = state.spawns || [];
  const busy = spawns.filter(function (item) { return !!item.spawning; }).length;
  const queue = getQueue(room);
  const laborQueued = queued > 0;
  const first = queue.length > 0 ? queue[0] : null;

  if (room.energyCapacityAvailable < bodyCost) return "body profile too expensive";
  if (room.energyAvailable < Math.min(bodyCost, room.energyCapacityAvailable || bodyCost)) {
    return "low energy";
  }
  if (spawns.length > 0 && busy >= spawns.length) return "busy spawn";
  if (
    laborQueued &&
    first &&
    first.role !== "worker" &&
    first.role !== "jrworker"
  ) {
    return "spawn priority";
  }
  if (!laborQueued && desired > current) return "role target mismatch";
  if (!spawn || spawns.length === 0) return "missing memory/state";

  return "unknown";
}

function getLaborDiagnostics(room, state, advanceMissing, nextTask) {
  const roleCounts = state.roleCounts || {};
  const current = (roleCounts.worker || 0) + (roleCounts.jrworker || 0);
  const desired = getLaborDesired(room, state, advanceMissing);
  const queue = getQueue(room);
  const queued = queue.filter(function (row) {
    return row.role === "worker" || row.role === "jrworker";
  }).length;
  const spawns = state.spawns || [];
  const busy = spawns.filter(function (spawn) { return !!spawn.spawning; }).length;
  const pending = queue.find(function (row) {
    return row.role === "worker" || row.role === "jrworker";
  }) || null;
  const reservePressure = reservePolicy.shouldBankStorageEnergy(room, state);
  const spawn = getSpawnSummary(room, state);
  const deficit = Math.max(0, desired - current);
  const pipelineDeficit = Math.max(0, desired - current - queued);

  return {
    current: current,
    desired: desired,
    deficit: deficit,
    queued: queued,
    pipelineDeficit: pipelineDeficit,
    roleCounts: roleCounts,
    phase: state.phase || "unknown",
    nextTask: nextTask || "unknown",
    spawns: spawns.length,
    busySpawns: busy,
    idleSpawns: Math.max(0, spawns.length - busy),
    pending: pending,
    energyAvailable: room.energyAvailable || 0,
    energyCapacity: room.energyCapacityAvailable || 0,
    reservePressure: reservePressure,
    blockedReason: classifyLaborBlocker(room, state, desired, current, queued, spawn),
    spawn: spawn,
  };
}

function formatLaborLines(room, labor) {
  return [
    `[OPS][${room.name}][LABOR]`,
    `Labor ${labor.current}/${labor.desired} | Deficit ${labor.deficit} | Queued ${labor.queued} | Pipeline deficit ${labor.pipelineDeficit}`,
    `Roles worker ${labor.roleCounts.worker || 0} | jrworker ${labor.roleCounts.jrworker || 0} | miner ${labor.roleCounts.miner || 0} | hauler ${labor.roleCounts.hauler || 0} | upgrader ${labor.roleCounts.upgrader || 0} | repair ${labor.roleCounts.repair || 0}`,
    `Phase ${labor.phase} | Next ${labor.nextTask}`,
    `Spawn idle ${labor.idleSpawns}/${labor.spawns} | Busy ${labor.busySpawns} | Queue ${labor.spawn.queueSize} | Pending ${labor.pending ? formatQueuedSpawn(labor.pending) : "none"}`,
    `Energy ${fmtAmount(labor.energyAvailable)}/${fmtAmount(labor.energyCapacity)} | Reserve pressure ${labor.reservePressure ? "yes" : "no"}`,
    `Blocked reason ${labor.blockedReason}`,
    "No spawn policy change or spawn action performed.",
  ];
}

function buildEmpireLaborRollup(reports) {
  const rooms = reports.map(function (report) {
    return report.labor;
  }).filter(function (row) {
    return !!row;
  });
  const deficitRooms = rooms.filter(function (row) { return row.deficit > 0; });
  const blockedBusy = rooms.filter(function (row) { return row.blockedReason === "busy spawn"; });
  const blockedEnergy = rooms.filter(function (row) { return row.blockedReason === "low energy"; });
  const repeatedNext = rooms.filter(function (row) {
    return row.nextTask === NEXT_TASK_LABEL.labor;
  });
  const largest = deficitRooms.slice().sort(function (a, b) {
    if (b.deficit !== a.deficit) return b.deficit - a.deficit;
    return a.room.localeCompare(b.room);
  });

  return {
    rooms: rooms,
    roomsEvaluated: rooms.length,
    deficitRooms: deficitRooms.length,
    blockedBusy: blockedBusy,
    blockedEnergy: blockedEnergy,
    repeatedNext: repeatedNext,
    largest: largest.slice(0, 5),
    topAttention: largest.slice(0, 5),
  };
}

function formatEmpireLaborRollup(rollup) {
  const lines = [
    "[OPS][EMPIRE][LABOR]",
    `Rooms evaluated ${rollup.roomsEvaluated} | Labor deficit rooms ${rollup.deficitRooms}`,
    `Spawn busy ${rollup.blockedBusy.length} | Energy insufficient ${rollup.blockedEnergy.length} | Repeated restore-next ${rollup.repeatedNext.length}`,
  ];

  if (rollup.largest.length === 0) {
    lines.push("Largest deficits none");
  } else {
    lines.push(
      "Largest deficits " +
        rollup.largest.map(function (row) {
          return `${row.room} ${row.deficit}`;
        }).join(", "),
    );
  }

  if (rollup.topAttention.length === 0) {
    lines.push("Top attention none");
  } else {
    for (let i = 0; i < rollup.topAttention.length; i++) {
      const row = rollup.topAttention[i];
      lines.push(
        `${i + 1}. ${row.room} | labor ${row.current}/${row.desired} | deficit ${row.deficit} | blocked ${row.blockedReason} | spawn idle ${row.idleSpawns}/${row.spawns} | energy ${fmtAmount(row.energyAvailable)}/${fmtAmount(row.energyCapacity)} | next ${row.nextTask}`,
      );
    }
  }

  lines.push("No spawn policy change or spawn action performed.");
  return lines;
}

function getExpansionPlanForRoom(roomName) {
  const plans =
    Memory.empire &&
    Memory.empire.expansion &&
    Memory.empire.expansion.plans
      ? Memory.empire.expansion.plans
      : null;
  const plan = plans && roomName ? plans[roomName] : null;

  if (!plan || plan.cancelled) return null;
  return plan;
}

function formatHudFocusLine(room, plan) {
  const expansionPlan = getExpansionPlanForRoom(room.name);
  if (expansionPlan) {
    return expansionPlan.parentRoom
      ? `Expansion | Parent ${expansionPlan.parentRoom}`
      : "Expansion | Independent";
  }

  return `Plan ${plan.focus}`;
}

function getContainerEnergy(container) {
  if (!container || !container.store) return 0;
  return container.store[RESOURCE_ENERGY] || 0;
}

function getSpawnSummary(room, state) {
  const queue = getQueue(room);
  const spawns = state.spawns || [];
  const primarySpawn = spawns.length > 0 ? spawns[0] : null;
  const busySpawns = spawns.filter(function (spawn) {
    return !!spawn.spawning;
  });
  let spawnLabel = "idle";

  if (spawns.length > 1) {
    spawnLabel = busySpawns.length > 0 ? `${busySpawns.length}/${spawns.length} busy` : "idle";
  } else if (primarySpawn && primarySpawn.spawning) {
    spawnLabel = primarySpawn.spawning.name;
  }

  return {
    queue: queue,
    queueSize: queue.length,
    nextQueued: formatQueuedSpawn(queue.length > 0 ? queue[0] : null),
    spawnLabel: spawnLabel,
  };
}

function formatQueuedSpawn(request) {
  if (!request) return "none";

  const age = typeof request.waitAge === "number" ? `${request.waitAge}t` : null;
  const energyAvailable = typeof request.energyAvailable === "number"
    ? request.energyAvailable
    : null;
  const energyCapacity = typeof request.energyCapacity === "number"
    ? request.energyCapacity
    : null;
  const cost = typeof request.bodyCost === "number"
    ? `cost ${request.bodyCost}${energyAvailable !== null ? `/${energyAvailable}` : ""}${energyCapacity !== null ? ` cap ${energyCapacity}` : ""}${request.energyFallback ? "*" : ""}`
    : null;
  const details = [];

  if (age) details.push(age);
  if (cost) details.push(cost);

  return details.length > 0
    ? `${request.role} ${details.join(" ")}`
    : request.role;
}

function getAlertSummary(room, state) {
  const defense = state.defense || {};
  const threat = defense.homeThreat || null;
  const active = !!(defense.hasThreats || (state.hostileCreeps || []).length > 0);
  const roleCounts = state.roleCounts || {};
  const towers =
    state.structuresByType && state.structuresByType[STRUCTURE_TOWER]
      ? state.structuresByType[STRUCTURE_TOWER]
      : [];
  const hostiles = threat ? threat.hostileCount || 0 : (state.hostileCreeps || []).length;
  const threatScore = threat ? threat.threatScore || 0 : 0;
  const threatLevel = threat ? threat.threatLevel || 0 : 0;
  const support = defense.support || null;
  const outgoingSupport = defense.outgoingSupport || [];
  const recovery = defense.recovery || null;

  return {
    active: active,
    recoveryActive: !!(recovery && recovery.active),
    recoveryBlockers: recovery && recovery.blockers ? recovery.blockers.slice() : [],
    recoveryReason: recovery && recovery.reason ? recovery.reason : null,
    recoveryAge: recovery && typeof recovery.age === "number" ? recovery.age : 0,
    recoveryStartedAt:
      recovery && typeof recovery.startedAt === "number" ? recovery.startedAt : null,
    recoveryLastThreatSeen:
      recovery && typeof recovery.lastThreatSeen === "number"
        ? recovery.lastThreatSeen
        : null,
    hostiles: hostiles,
    threatScore: threatScore,
    threatLevel: threatLevel,
    defenders: roleCounts.defender || 0,
    requiredDefenders: defense.requiredDefenders || 0,
    responseMode: threat ? threat.responseMode || "idle" : "idle",
    breachSeverity: threat ? threat.breachSeverity || "clear" : "clear",
    towerEnergyState: threat ? threat.towerEnergyState || "empty" : "empty",
    towerCanHandle: !!(threat && threat.towerCanHandle),
    towerTarget: threat ? threat.towerTargetSummary || "none" : "none",
    towerFocusDamage: threat ? threat.towerFocusDamage || 0 : 0,
    supportRequested: support ? support.requested || 0 : 0,
    supportAssigned: support ? support.assigned || 0 : 0,
    supportHelper: support ? support.helperRoom || "none" : "none",
    outgoingSupport:
      outgoingSupport && outgoingSupport.length > 0
        ? outgoingSupport.map(function (entry) {
            return entry.targetRoom;
          }).join(",")
        : "none",
    readyTowers: threat
      ? threat.readyTowerCount || 0
      : towers.filter(function (tower) {
          return tower.store ? (tower.store[RESOURCE_ENERGY] || 0) > 0 : tower.energy > 0;
        }).length,
    safeMode: getSafeModeLabel(room),
  };
}

function formatRecoveryLine(alert) {
  if (!alert.recoveryActive) return "Recovery inactive";

  const details = [];
  if (alert.recoveryReason) details.push(alert.recoveryReason);
  if (typeof alert.recoveryAge === "number") details.push(`age ${alert.recoveryAge}t`);
  if (typeof alert.recoveryLastThreatSeen === "number") {
    details.push(`last ${alert.recoveryLastThreatSeen}`);
  }

  const prefix = details.length > 0
    ? `Recovery ${details.join(" ")}`
    : "Recovery";

  return alert.recoveryBlockers.length > 0
    ? `${prefix} blocked ${alert.recoveryBlockers.join(", ")}`
    : `${prefix} ready to clear`;
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
  const roomCpu =
    Memory.stats.rooms &&
    Memory.stats.rooms[room.name] &&
    Memory.stats.rooms[room.name].cpu
      ? Memory.stats.rooms[room.name].cpu
      : null;

  return {
    available: true,
    current: roomCpu ? roomCpu.current : last.cpu.used,
    limit: last.cpu.limit,
    average: roomCpu ? roomCpu.average : averages.cpuUsed || last.cpu.used,
    peak:
      roomCpu && typeof roomCpu.peak === "number"
        ? roomCpu.peak
        : Memory.stats.max && typeof Memory.stats.max.cpuUsed === "number"
          ? Memory.stats.max.cpuUsed
          : last.cpu.used,
    minimum:
      roomCpu && typeof roomCpu.minimum === "number"
        ? roomCpu.minimum
        : roomCpu
          ? roomCpu.current
          : last.cpu.used,
    globalCurrent: last.cpu.used,
    globalAverage: averages.cpuUsed || last.cpu.used,
    bucket: last.cpu.bucket,
    pressure: roomCpu && roomCpu.pressure
      ? roomCpu.pressure
      : runtime.pressure || "normal",
    thinkIntervalMultiplier: runtime.thinkIntervalMultiplier || 1,
    constructionIntervalMultiplier: runtime.constructionIntervalMultiplier || 1,
    advancedOpsInterval: runtime.advancedOpsInterval || 1,
    roomScaleActive: !!runtime.roomScaleActive,
    skipDirectives: !!runtime.skipDirectives,
    skipHud: !!runtime.skipHud,
    sections: roomCpu && roomCpu.sections ? roomCpu.sections : [],
    hotspots: roomCpu && roomCpu.hotspots ? roomCpu.hotspots : [],
    pressureCounts:
      roomCpu && roomCpu.pressureCounts
        ? roomCpu.pressureCounts
        : null,
    scheduler: roomCpu && roomCpu.scheduler ? roomCpu.scheduler : null,
    tick: roomCpu ? roomCpu.tick : last.tick,
    creepCount:
      roomCpu && typeof roomCpu.creepCount === "number"
        ? roomCpu.creepCount
        : null,
    phase: roomCpu ? roomCpu.phase : null,
    rcl: roomCpu ? roomCpu.rcl : null,
    room: room.name,
  };
}

function getCpuTopSectionLimit() {
  const settings = config.STATS && config.STATS.ROOM_CPU
    ? config.STATS.ROOM_CPU
    : {};

  return typeof settings.TOP_SECTION_LIMIT === "number" &&
    settings.TOP_SECTION_LIMIT > 0
    ? settings.TOP_SECTION_LIMIT
    : 6;
}

function formatCpuValue(value) {
  return typeof value === "number" ? value.toFixed(3) : "--";
}

function formatCpuRatio(value) {
  return typeof value === "number" && isFinite(value) ? value.toFixed(3) : "--";
}

function getRemoteSiteCount(room) {
  const roomMemory =
    Memory.rooms && Memory.rooms[room.name] ? Memory.rooms[room.name] : null;
  if (!roomMemory) return null;

  const remoteSites = roomMemory.remoteSites || roomMemory.remoteMiningSites;
  if (Array.isArray(remoteSites)) return remoteSites.length;
  if (remoteSites && typeof remoteSites === "object") {
    return Object.keys(remoteSites).length;
  }

  return null;
}

function formatTrendLine(cpu) {
  return (
    `Trend cur ${formatCpuValue(cpu.current)} | avg ${formatCpuValue(cpu.average)} | ` +
    `peak ${formatCpuValue(cpu.peak)} | min ${formatCpuValue(cpu.minimum)}`
  );
}

function formatPressureHistoryLine(cpu) {
  const counts = cpu.pressureCounts || {};

  return (
    `Pressure history normal ${formatCpuRatio(counts.normal)} | ` +
    `tight ${formatCpuRatio(counts.tight)} | critical ${formatCpuRatio(counts.critical)}`
  );
}

function formatCpuEfficiencyLine(cpu, sourceCount, remoteSiteCount) {
  const creepCount =
    typeof cpu.creepCount === "number" && cpu.creepCount > 0
      ? cpu.creepCount
      : null;
  const perCreep = creepCount ? cpu.average / creepCount : null;
  const perRemote =
    typeof remoteSiteCount === "number" && remoteSiteCount > 0
      ? cpu.average / remoteSiteCount
      : null;
  const perSource =
    typeof sourceCount === "number" && sourceCount > 0
      ? cpu.average / sourceCount
      : null;

  return (
    `Efficiency creep ${formatCpuRatio(perCreep)} | ` +
    `remote ${formatCpuRatio(perRemote)} | source ${formatCpuRatio(perSource)}`
  );
}

function formatCpuHotspotLines(cpu) {
  const hotspots = cpu.hotspots && cpu.hotspots.length > 0
    ? cpu.hotspots
    : (cpu.sections || [])
        .filter(function (row) {
          return typeof row.average === "number";
        })
        .slice()
        .sort(function (a, b) {
          if (b.average !== a.average) return b.average - a.average;
          return String(a.label).localeCompare(String(b.label));
        });
  const limit = Math.min(hotspots.length, getCpuTopSectionLimit());
  const lines = [];

  if (limit === 0) return ["Hotspots unavailable"];

  lines.push("Hotspots by avg");
  for (let i = 0; i < limit; i++) {
    const row = hotspots[i];
    lines.push(`${row.label.padEnd(24, ".")} ${formatCpuValue(row.average)}`);
  }

  return lines;
}

function formatCpuSectionLines(cpu) {
  if (!cpu.sections || cpu.sections.length === 0) {
    return ["Top sections unavailable"];
  }

  const measured = cpu.sections.filter(function (row) {
    return typeof row.current === "number" || typeof row.average === "number";
  });
  const limit = Math.min(measured.length, getCpuTopSectionLimit());
  const lines = [];

  if (limit === 0) {
    return ["Top sections unavailable"];
  }

  for (let i = 0; i < limit; i++) {
    const row = measured[i];
    const stale =
      typeof row.lastTick === "number" && row.lastTick !== cpu.tick
        ? ` | last ${row.lastTick}`
        : "";

    lines.push(
      `${row.label} cur ${formatCpuValue(row.current)} avg ${formatCpuValue(row.average)}${stale}`,
    );
  }

  return lines;
}

function formatSchedulerSkipLine(cpu) {
  const scheduler = cpu.scheduler;
  if (!scheduler || !scheduler.tasks || scheduler.tasks.length === 0) {
    return "Scheduler skips none";
  }

  const skipped = scheduler.tasks.filter(function (task) {
    return task.lastSkipped === cpu.tick;
  });
  const recent = skipped.length > 0 ? skipped : scheduler.tasks.filter(function (task) {
    return task.lastSkipReason;
  });
  const parts = [];
  const limit = Math.min(recent.length, 3);

  for (let i = 0; i < limit; i++) {
    const task = recent[i];
    parts.push(
      `${task.key}:${task.lastSkipReason || "ran"}${task.lastSkipped ? `@${task.lastSkipped}` : ""}`,
    );
  }

  if (parts.length === 0) return "Scheduler skips none";

  return `Scheduler skips ${scheduler.skippedThisTick || 0} now | ${parts.join(" | ")}`;
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

function getObserverSummary(room, state) {
  if (state && state.observer) {
    return state.observer;
  }

  return observerManager.getStatus(room);
}

function getPowerSummary(room) {
  const power =
    Memory.rooms && Memory.rooms[room.name] && Memory.rooms[room.name].power
      ? Memory.rooms[room.name].power
      : {};
  const policy =
    Memory.rooms && Memory.rooms[room.name] && Memory.rooms[room.name].powerPolicy
      ? Memory.rooms[room.name].powerPolicy
      : {};
  const terminal = room.terminal || null;
  const globalEnabled = typeof power.globalEnabled === "boolean"
    ? power.globalEnabled
    : !!(config.POWER && config.POWER.ENABLED);
  const globalRefillEnabled = typeof power.globalRefillEnabled === "boolean"
    ? power.globalRefillEnabled
    : !!(config.POWER && config.POWER.REFILL_ENABLED);
  const processingOverride = typeof policy.processingEnabled === "boolean"
    ? policy.processingEnabled
    : typeof power.processingOverride === "boolean"
      ? power.processingOverride
      : null;
  const refillOverride = typeof policy.refillEnabled === "boolean"
    ? policy.refillEnabled
    : typeof power.refillOverride === "boolean"
      ? power.refillOverride
      : null;
  const minStorageEnergyOverride =
    typeof policy.minStorageEnergy === "number" && policy.minStorageEnergy >= 0
      ? Math.floor(policy.minStorageEnergy)
      : typeof power.minStorageEnergyOverride === "number"
        ? power.minStorageEnergyOverride
        : null;
  const generateOps = power.generateOps || {};

  return {
    globalEnabled: globalEnabled,
    globalRefillEnabled: globalRefillEnabled,
    processingOverride: processingOverride,
    refillOverride: refillOverride,
    effectiveProcessingEnabled: typeof power.effectiveProcessingEnabled === "boolean"
      ? power.effectiveProcessingEnabled
      : processingOverride === null
        ? globalEnabled
        : processingOverride,
    effectiveRefillEnabled: typeof power.effectiveRefillEnabled === "boolean"
      ? power.effectiveRefillEnabled
      : refillOverride === null
        ? globalRefillEnabled
        : refillOverride,
    minStorageEnergyOverride: minStorageEnergyOverride,
    powerSpawns: power.powerSpawns || 0,
    powerSpawnId: power.powerSpawnId || null,
    powerSpawnEnergy: power.powerSpawnEnergy || power.energy || 0,
    powerSpawnPower: power.powerSpawnPower || power.power || 0,
    storageEnergy: typeof power.storageEnergy === "number"
      ? power.storageEnergy
      : getStorageEnergy(room),
    terminalEnergy: typeof power.terminalEnergy === "number"
      ? power.terminalEnergy
      : terminal && terminal.store
        ? terminal.store[RESOURCE_ENERGY] || 0
        : 0,
    terminalPower: typeof power.terminalPower === "number"
      ? power.terminalPower
      : terminal && terminal.store
        ? terminal.store[RESOURCE_POWER] || 0
        : 0,
    storagePower: typeof power.storagePower === "number"
      ? power.storagePower
      : room.storage && room.storage.store
        ? room.storage.store[RESOURCE_POWER] || 0
        : 0,
    lastProcessed: typeof power.lastProcessed === "number"
      ? power.lastProcessed
      : null,
    totalProcessed: power.totalProcessed || 0,
    readiness: power.readiness || "UNKNOWN",
    blockedReason: power.blockedReason || power.reason || "none",
    lastSeen: typeof power.lastSeen === "number" ? power.lastSeen : null,
    minStorageEnergy: minStorageEnergyOverride !== null
      ? minStorageEnergyOverride
      : power.minStorageEnergy ||
      (config.POWER ? config.POWER.MIN_STORAGE_ENERGY || 0 : 0),
    minTerminalEnergy: power.minTerminalEnergy ||
      (config.POWER ? config.POWER.MIN_TERMINAL_ENERGY || 0 : 0),
    energyTarget: power.energyTarget ||
      (config.POWER ? config.POWER.POWER_SPAWN_ENERGY_TARGET || 0 : 0),
    powerTarget: power.powerTarget ||
      (config.POWER ? config.POWER.POWER_SPAWN_POWER_TARGET || 0 : 0),
    refillState: power.refillState || "REFILL_UNKNOWN",
    refillEnergyNeeded: power.refillEnergyNeeded || 0,
    refillPowerNeeded: power.refillPowerNeeded || 0,
    refillEnergyStorageAvailable: power.refillEnergyStorageAvailable || 0,
    refillEnergyTerminalAvailable: power.refillEnergyTerminalAvailable || 0,
    refillPowerStorageAvailable: power.refillPowerStorageAvailable || 0,
    refillPowerTerminalAvailable: power.refillPowerTerminalAvailable || 0,
    refillBlockedReason: power.refillBlockedReason || "none",
    refillPendingRequests: power.refillPendingRequests || 0,
    refillPendingSummary: power.refillPendingSummary || "none",
    refillLastSource: power.refillLastSource || "none",
    refillLastResource: power.refillLastResource || "none",
    refillLastRequestTick: typeof power.refillLastRequestTick === "number"
      ? power.refillLastRequestTick
      : null,
    refillLastCreated: !!power.refillLastCreated,
    generateOps: {
      name: generateOps.name || "Operator_GenOps",
      spawned: !!generateOps.spawned,
      currentRoom: generateOps.currentRoom || "unknown",
      ticksToLive: typeof generateOps.ticksToLive === "number" ? generateOps.ticksToLive : null,
      level: generateOps.level || 0,
      cooldown: generateOps.cooldown || 0,
      ops: generateOps.ops || 0,
      opsCapacity: typeof generateOps.opsCapacity === "number" ? generateOps.opsCapacity : null,
      homeRoom: generateOps.homeRoom || room.name,
      powerEnabled: !!generateOps.powerEnabled,
      lastAction: generateOps.lastAction || "none",
      lastResult: typeof generateOps.lastResult === "number" ? generateOps.lastResult : null,
      blockedReason: generateOps.blockedReason || "none",
      bankingAction: generateOps.bankingAction || "idle",
      bankingTarget: generateOps.bankingTarget || "none",
      bankingResult: typeof generateOps.bankingResult === "number" ? generateOps.bankingResult : null,
      bankingBlockedReason: generateOps.bankingBlockedReason || "none",
      status: generateOps.status || "UNKNOWN",
      lastTick: typeof generateOps.lastTick === "number" ? generateOps.lastTick : null,
    },
  };
}

function isPowerSpawnRefillRequest(row, powerSpawnId) {
  if (!row || row.status !== "open") return false;
  if (row.resourceType !== RESOURCE_ENERGY && row.resourceType !== RESOURCE_POWER) {
    return false;
  }

  return (
    row.to === "powerSpawn" ||
    row.to === "power_spawn" ||
    row.targetType === STRUCTURE_POWER_SPAWN ||
    (powerSpawnId && row.targetId === powerSpawnId)
  );
}

function getPowerRefillPendingSummary(room, power, advanced) {
  const summaries = [];
  let count = 0;

  const requests = opsLogisticsManager.listRequests(room.name).filter(function (row) {
    return isPowerSpawnRefillRequest(row, power.powerSpawnId);
  });

  count += requests.length;
  for (let i = 0; i < requests.length && summaries.length < 2; i++) {
    summaries.push(
      [
        requests[i].id,
        requests[i].resourceType,
        fmtAmount(requests[i].remaining || requests[i].amount || 0),
      ].join(" "),
    );
  }

  if (summaries.length === 0) summaries.push("none");

  return {
    count: count,
    summary: summaries.join("; "),
  };
}

function formatIntelAge(age) {
  return typeof age === "number" ? `${age}t` : "--";
}

function formatObserverTargets(observer) {
  const targets = observer && observer.targets ? observer.targets : [];
  if (targets.length === 0) return "none";

  const visible = targets.slice(0, 5).join(",");
  return targets.length > 5 ? `${visible},+${targets.length - 5}` : visible;
}

function getMineralMiningSummary(room, state) {
  const desiredMiners = Math.max(0, config.CREEPS.mineralMinersPerRoom || 0);
  if (desiredMiners <= 0) {
    return { available: false };
  }

  if (!room.controller || room.controller.level < 6) {
    return { available: false };
  }

  const minerals = state && state.minerals ? state.minerals : [];
  const mineral = minerals.length > 0 ? minerals[0] : null;
  if (!mineral) {
    return { available: false };
  }

  const buildStatus = state.buildStatus || {};
  const structuresByType = state.structuresByType || {};
  const extractors = structuresByType[STRUCTURE_EXTRACTOR] || [];
  const hasExtractor = _.some(extractors, function (extractor) {
    return extractor.pos.isEqualTo(mineral.pos);
  });
  const hasContainer = !!state.mineralContainer;
  const storageEnergy = getStorageEnergy(room);
  const minimumEnergy =
    config.ADVANCED &&
    typeof config.ADVANCED.MINERAL_MINING_MIN_STORAGE_ENERGY === "number"
      ? config.ADVANCED.MINERAL_MINING_MIN_STORAGE_ENERGY
      : 20000;
  const existingMiners = getRoleTargetCount(state, "mineral_miner", mineral.id);
  const queuedMiners = countQueuedForTarget(room, "mineral_miner", mineral.id);
  const totalMiners = existingMiners + queuedMiners;
  const mineralProgramUnlocked = constructionStatus.isMineralProgramUnlocked(
    room,
    state,
  );
  const roadBuilt = buildStatus.mineralAccessRoadsBuilt || 0;
  const roadNeeded = buildStatus.mineralAccessRoadsNeeded || 0;
  const display =
    state.phase === "specialization" ||
    state.phase === "fortification" ||
    state.phase === "command" ||
    mineralProgramUnlocked ||
    hasContainer ||
    hasExtractor ||
    totalMiners > 0;

  if (!display) {
    return { available: false };
  }

  if (!mineralProgramUnlocked) {
    return {
      available: true,
      status: "blocked",
      reason: "specialization incomplete",
      storageEnergy: storageEnergy,
      minimumEnergy: minimumEnergy,
      miners: totalMiners,
      desiredMiners: desiredMiners,
      roadBuilt: roadBuilt,
      roadNeeded: roadNeeded,
    };
  }

  if (mineral.mineralAmount <= 0) {
    return {
      available: true,
      status: "depleted",
      reason: "empty",
      storageEnergy: storageEnergy,
      minimumEnergy: minimumEnergy,
      miners: totalMiners,
      desiredMiners: desiredMiners,
      roadBuilt: roadBuilt,
      roadNeeded: roadNeeded,
    };
  }

  if (!room.storage) {
    return {
      available: true,
      status: "blocked",
      reason: "no storage",
      storageEnergy: storageEnergy,
      minimumEnergy: minimumEnergy,
      miners: totalMiners,
      desiredMiners: desiredMiners,
      roadBuilt: roadBuilt,
      roadNeeded: roadNeeded,
    };
  }

  if (!hasContainer) {
    return {
      available: true,
      status: "blocked",
      reason: "minCtr missing",
      storageEnergy: storageEnergy,
      minimumEnergy: minimumEnergy,
      miners: totalMiners,
      desiredMiners: desiredMiners,
      roadBuilt: roadBuilt,
      roadNeeded: roadNeeded,
    };
  }

  if (!hasExtractor) {
    return {
      available: true,
      status: "blocked",
      reason: "extractor missing",
      storageEnergy: storageEnergy,
      minimumEnergy: minimumEnergy,
      miners: totalMiners,
      desiredMiners: desiredMiners,
      roadBuilt: roadBuilt,
      roadNeeded: roadNeeded,
    };
  }

  if (state.hostileCreeps && state.hostileCreeps.length > 0) {
    return {
      available: true,
      status: "held",
      reason: `threat ${state.hostileCreeps.length}`,
      storageEnergy: storageEnergy,
      minimumEnergy: minimumEnergy,
      miners: totalMiners,
      desiredMiners: desiredMiners,
      roadBuilt: roadBuilt,
      roadNeeded: roadNeeded,
    };
  }

  if (storageEnergy < minimumEnergy) {
    return {
      available: true,
      status: "held",
      reason: "storage gate",
      storageEnergy: storageEnergy,
      minimumEnergy: minimumEnergy,
      miners: totalMiners,
      desiredMiners: desiredMiners,
      roadBuilt: roadBuilt,
      roadNeeded: roadNeeded,
    };
  }

  return {
    available: true,
    status: totalMiners >= desiredMiners ? "active" : "ready",
    reason: totalMiners >= desiredMiners ? "covered" : "spawn pending",
    storageEnergy: storageEnergy,
    minimumEnergy: minimumEnergy,
    miners: totalMiners,
    desiredMiners: desiredMiners,
    roadBuilt: roadBuilt,
    roadNeeded: roadNeeded,
  };
}

function getPendingMineralRoadSegment(summary) {
  if (!summary) return null;

  const roadBuilt = summary.roadBuilt || 0;
  const roadNeeded = summary.roadNeeded || 0;
  if (roadNeeded <= 0 || roadBuilt >= roadNeeded) return null;

  return `Road ${roadBuilt}/${roadNeeded}`;
}

function formatMineralMiningLine(summary) {
  if (!summary || !summary.available) return null;
  const roadSegment = getPendingMineralRoadSegment(summary);

  if (summary.status === "blocked") {
    return `Mineral blocked | ${summary.reason} | Miner ${summary.miners}/${summary.desiredMiners}`;
  }

  if (summary.status === "depleted") {
    return `Mineral depleted | Storage ${summary.storageEnergy}/${summary.minimumEnergy} | Miner ${summary.miners}/${summary.desiredMiners}${roadSegment ? ` | ${roadSegment}` : ""}`;
  }

  if (summary.status === "held") {
    return `Mineral held | Storage ${summary.storageEnergy}/${summary.minimumEnergy} | Miner ${summary.miners}/${summary.desiredMiners}${roadSegment ? ` | ${roadSegment}` : ""}`;
  }

  if (summary.status === "ready") {
    return `Mineral ready | Storage ${summary.storageEnergy}/${summary.minimumEnergy} | Miner ${summary.miners}/${summary.desiredMiners}${roadSegment ? ` | ${roadSegment}` : ""}`;
  }

  return `Mineral active | Storage ${summary.storageEnergy}/${summary.minimumEnergy} | Miner ${summary.miners}/${summary.desiredMiners}${roadSegment ? ` | ${roadSegment}` : ""}`;
}

function formatMineralHudLine(summary) {
  if (!summary || !summary.available) return null;
  const roadSegment = getPendingMineralRoadSegment(summary);

  if (summary.status === "blocked") {
    return `Mineral ${summary.reason}`;
  }

  if (summary.status === "depleted") {
    return `Mineral depleted | Miner ${summary.miners}/${summary.desiredMiners}${roadSegment ? ` | ${roadSegment}` : ""}`;
  }

  if (summary.status === "held") {
    return `Mineral held | Store ${summary.storageEnergy}/${summary.minimumEnergy} | Miner ${summary.miners}/${summary.desiredMiners}${roadSegment ? ` | ${roadSegment}` : ""}`;
  }

  if (summary.status === "ready") {
    return `Mineral ready | Store ${summary.storageEnergy}/${summary.minimumEnergy} | Miner ${summary.miners}/${summary.desiredMiners}${roadSegment ? ` | ${roadSegment}` : ""}`;
  }

  return `Mineral active | Miner ${summary.miners}/${summary.desiredMiners}${roadSegment ? ` | ${roadSegment}` : ""}`;
}

function formatUpgradeReserveLine(room, state) {
  if (!reservePolicy.shouldHoldRcl8Upgrading(room, state)) {
    return null;
  }

  const storageEnergy = reservePolicy.getStorageEnergy(room, state);
  const minimumEnergy = reservePolicy.getReserveBankMinStorageEnergy();
  const ticksToDowngrade =
    room.controller && typeof room.controller.ticksToDowngrade === "number"
      ? room.controller.ticksToDowngrade
      : null;

  return `Upgrade held | Store ${storageEnergy}/${minimumEnergy} | Downgrade ${ticksToDowngrade !== null ? ticksToDowngrade : "--"}`;
}

function formatBuildIntentLine(state) {
  const sites = state && state.buildStatus ? state.buildStatus.sites || 0 : 0;
  if (sites <= 0) return null;

  const roleCounts = state.roleCounts || {};
  const buildLabor = (roleCounts.worker || 0) + (roleCounts.jrworker || 0);
  return `Build mode active | Sites ${sites} | Labor ${buildLabor}`;
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
    const buildStatus = summaryState.buildStatus || {};
    const desiredTotalHaulers = roomState.getDesiredTotalHaulers(
      summaryState.sources || [],
    );
    const currentMissing = getPhaseCompletionMissing(
      summaryState.phase,
      buildStatus,
    );
    const advanceMissing = getAdvanceMissing(room, summaryState, desiredTotalHaulers);
    const statusLabel = getPhaseStatusLabel(summaryState.phase, room, summaryState);
    const nextPhase = getNextPhase(summaryState.phase);
    const mineralRoadPending =
      (buildStatus.mineralAccessRoadsNeeded || 0) >
      (buildStatus.mineralAccessRoadsBuilt || 0);
    const nextTask = mineralRoadPending
      ? NEXT_TASK_LABEL.mineralAccessRoad
      : getNextTask(summaryState.phase, advanceMissing, statusLabel);
    const isAdvanceReady = advanceMissing.length === 0;
    const spawn = getSpawnSummary(room, summaryState);
    const alert = getAlertSummary(room, summaryState);
    const cpu = getCpuSummary(room);
    const advanced = getAdvancedSummary(room, summaryState);
    const roleIntent = roleIntentDiagnostics.build(room, summaryState);
    const observer = getObserverSummary(room, summaryState);
    const power = getPowerSummary(room);
    const powerEnablement = pclManager.getRoomEnablementReadiness(room.name);
    const powerRefillPending = getPowerRefillPendingSummary(room, power, advanced);
    const refillState =
      powerRefillPending.count > 0 &&
      (power.refillEnergyNeeded > 0 || power.refillPowerNeeded > 0)
        ? "REFILL_REQUEST_PENDING"
        : power.refillState;
    const terminalBalance = summaryState.terminalBalance || {};
    const roleCounts = summaryState.roleCounts || {};
    const sources = summaryState.sources || [];
    const logistics = opsLogisticsManager.getRoomDiagnostics(room.name, {
      currentHaulers: roleCounts.hauler || 0,
      desiredHaulers: desiredTotalHaulers,
      advanced: advanced,
    });
    const factoryDiagnostics = getFactoryDiagnostics(room, summaryState, advanced);
    const labDiagnostics = getLabDiagnostics(room, summaryState, advanced);
    const laborDiagnostics = getLaborDiagnostics(
      room,
      summaryState,
      advanceMissing,
      nextTask,
    );
    laborDiagnostics.room = room.name;
    const roleIntentLines = roleIntentDiagnostics.formatLines(roleIntent);
    roleIntentLines.splice(
      roleIntentLines.length - 1,
      0,
      `Request Alignment: ops open ${logistics.openRequests} | blocked ${logistics.blockedRequests} | advanced ${logistics.advancedBacklog.summary}`,
    );
    const mineralMining = getMineralMiningSummary(room, summaryState);
    const mineralLine = formatMineralMiningLine(mineralMining);
    const mineralHudLine = formatMineralHudLine(mineralMining);
    const upgradeReserveLine = formatUpgradeReserveLine(room, summaryState);
    const buildIntentLine = formatBuildIntentLine(summaryState);
    const storagePlanningLine = formatStoragePlanningLine(buildStatus);
    const infrastructure = summaryState.infrastructure || {};
    const remoteSiteCount = getRemoteSiteCount(room);
    const shortBuild = formatBuildLine(summaryState.phase, buildStatus, 3);
    const progressLabel = progress && progress.targetLevel
      ? `RCL ${progress.level} ${progress.pct}%`
      : `RCL ${room.controller ? room.controller.level : 0}`;
    const etaLabel = progress && progress.eta ? progress.eta : "--";

    const overviewLines = [
      `[OPS][${room.name}][OVERVIEW]`,
      `Phase ${summaryState.phase} | ${progressLabel} | ETA ${etaLabel}`,
      `Energy ${room.energyAvailable}/${room.energyCapacityAvailable} | Spawn ${spawn.spawnLabel} | Queue ${spawn.nextQueued}`,
      `Alert ${alert.active ? `active ${alert.hostiles}` : alert.recoveryActive ? "recovery" : "clear"} | Sites ${buildStatus.sites || 0} | CPU ${cpu.pressure}`,
    ];
    if (mineralLine) {
      overviewLines.push(mineralLine);
    }
    if (upgradeReserveLine) {
      overviewLines.push(upgradeReserveLine);
    }
    overviewLines.push(`Next ${nextTask}`);

    const buildLines = [
      `[OPS][${room.name}][BUILD]`,
      `Roadmap ${buildStatus.roadmapPhase || summaryState.phase} | Status ${statusLabel} | Sites ${buildStatus.sites || 0}`,
      `Current ${formatBuildLine(summaryState.phase, buildStatus)}`,
      `Future ${buildStatus.futurePlanReady ? "ready" : "planning"} | Advance ${nextPhase || "complete"} ${isAdvanceReady ? "ready" : "blocked"}`,
    ];
    if (storagePlanningLine) {
      buildLines.push(storagePlanningLine);
    }
    if (mineralLine) {
      buildLines.push(mineralLine);
    }
    if (upgradeReserveLine) {
      buildLines.push(upgradeReserveLine);
    }
    buildLines.push(`Next ${nextTask}`);

    const pendingImport =
      Memory.empire &&
      Memory.empire.minerals &&
      Memory.empire.minerals.pendingByRoom
        ? Memory.empire.minerals.pendingByRoom[room.name] || null
        : null;
    const labGoalLine = `LabGoal ${advanced.labGoal || "none"} need ${
      advanced.labNeed || 0
    } ${advanced.labReason || ""}${
      pendingImport
        ? ` import ${pendingImport.resourceType} ${pendingImport.missing || 0}`
        : ""
    }`.trim();
    const advancedLines = [
      `[OPS][${room.name}][ADVANCED]`,
      `Labs ${String(advanced.labStatus || "inactive")} ${advanced.labProduct || ""}`.trim(),
      labGoalLine,
      `Factory ${String(advanced.factoryStatus || "inactive")} ${advanced.factoryProduct || ""}`.trim(),
      `PowerSpawn ${String(advanced.powerSpawnStatus || "inactive")} refill owner ${advanced.powerSpawnRefillOwner || "power_manager"} | Nuker ${String(advanced.nukerStatus || "inactive")}`,
    ];
    if (mineralLine) {
      advancedLines.push(mineralLine);
    }
    advancedLines.push(`Task ${advanced.taskLabel || "none"}`);

    const sections = {
      overview: overviewLines,
      economy: [
        `[OPS][${room.name}][ECONOMY]`,
        `Stage ${infrastructure.economyStage || "unknown"} | Energy ${room.energyAvailable}/${room.energyCapacityAvailable} | Storage ${getStorageEnergy(room)}`,
        `Hub ${getContainerEnergy(summaryState.hubContainer)} | Ctrl ${getContainerEnergy(summaryState.controllerContainer)} | Upgrade ${progress && progress.rate > 0 ? progress.rate.toFixed(2) : "0.00"}/t`,
        upgradeReserveLine || buildIntentLine || `Upgrade mode ${room.controller && room.controller.level >= 8 ? "maintenance" : "active"}`,
        `Spawn ${spawn.spawnLabel} | Queue ${spawn.queueSize} | Hauler ${summaryState.logistics ? summaryState.logistics.haulerMode : "normal"}`,
      ],
      build: buildLines,
      defense: [
        `[OPS][${room.name}][DEFENSE]`,
        `Alert ${alert.active ? "active" : alert.recoveryActive ? "recovery" : "clear"} | SafeMode ${alert.safeMode}`,
        `Hostiles ${alert.hostiles} | Threat ${alert.threatScore} | Level ${alert.threatLevel}`,
        `Mode ${alert.responseMode} | Breach ${alert.breachSeverity} | Towers ${alert.towerEnergyState}`,
        `Defenders ${alert.defenders}/${alert.requiredDefenders} | Ready towers ${alert.readyTowers}/${summaryState.structuresByType && summaryState.structuresByType[STRUCTURE_TOWER] ? summaryState.structuresByType[STRUCTURE_TOWER].length : 0}`,
        `Support in ${alert.supportAssigned}/${alert.supportRequested} from ${alert.supportHelper} | out ${alert.outgoingSupport}`,
        `Target ${alert.towerTarget} | Focus ${alert.towerFocusDamage} | Hold ${alert.towerCanHandle ? "yes" : "no"}`,
        formatRecoveryLine(alert),
      ],
      creeps: [
        `[OPS][${room.name}][CREEPS]`,
        `J ${roleCounts.jrworker || 0} | D ${roleCounts.defender || 0} | W ${roleCounts.worker || 0} | M ${roleCounts.miner || 0} | MM ${roleCounts.mineral_miner || 0} | H ${roleCounts.hauler || 0} | U ${roleCounts.upgrader || 0} | R ${roleCounts.repair || 0}`,
        `Labor ${(roleCounts.worker || 0) + (roleCounts.jrworker || 0)} | Miners ${roleCounts.miner || 0}/${sources.length * config.CREEPS.minersPerSource} | Haulers ${roleCounts.hauler || 0}/${desiredTotalHaulers}`,
        `Advance ${mineralRoadPending ? MISSING_SUMMARY.mineralAccessRoad : advanceMissing.length > 0 ? summarizeMissing(advanceMissing) : "room steady"}`,
      ],
      roles: roleIntentLines,
      sources: [
        `[OPS][${room.name}][SOURCES]`,
      ],
      factory: formatFactoryLines(room, factoryDiagnostics),
      labs: formatLabLines(room, labDiagnostics),
      labor: formatLaborLines(room, laborDiagnostics),
      advanced: advancedLines,
      power: [
        `[OPS][${room.name}][POWER]`,
        `Global process ${power.globalEnabled ? "on" : "off"} refill ${power.globalRefillEnabled ? "on" : "off"} | Override process ${formatPolicyValue(power.processingOverride)} refill ${formatPolicyValue(power.refillOverride)} | Effective process ${power.effectiveProcessingEnabled ? "on" : "off"} refill ${power.effectiveRefillEnabled ? "on" : "off"}`,
        `Readiness ${power.readiness} | Blocked ${power.blockedReason || "none"}`,
        `Enablement ${powerEnablement.status} | Next ${powerEnablement.nextSteps[0] || "none"}`,
        `PowerSpawns ${power.powerSpawns} | Energy ${fmtAmount(power.powerSpawnEnergy)}/${fmtAmount(power.energyTarget)} | Power ${fmtAmount(power.powerSpawnPower)}/${fmtAmount(power.powerTarget)}`,
        `Refill owner power_manager | execution ops_logistics`,
        `Storage Energy ${fmtAmount(power.storageEnergy)}/${fmtAmount(power.minStorageEnergy)} | Terminal Energy ${fmtAmount(power.terminalEnergy)}/${fmtAmount(power.minTerminalEnergy)}`,
        `Terminal Power ${fmtAmount(power.terminalPower)} | Balance ${terminalBalance.state || "unknown"} | pending ${terminalBalance.pendingMoves || 0}`,
        `Refill ${refillState} | Energy need ${fmtAmount(power.refillEnergyNeeded)} | Power need ${fmtAmount(power.refillPowerNeeded)}`,
        `Refill sources energy storage ${fmtAmount(power.refillEnergyStorageAvailable)} terminal ${fmtAmount(power.refillEnergyTerminalAvailable)} | power storage ${fmtAmount(power.refillPowerStorageAvailable)} terminal ${fmtAmount(power.refillPowerTerminalAvailable)} | selected ${power.refillLastResource} from ${power.refillLastSource}`,
        `Refill pending ${powerRefillPending.count} | ${powerRefillPending.summary} | blocked ${power.refillBlockedReason || "none"}`,
        `Refill recent ${power.refillLastCreated ? "created" : "idle"} | tick ${power.refillLastRequestTick !== null ? power.refillLastRequestTick : "--"}`,
        `PowerCreep ${power.generateOps.name} | State ${power.generateOps.spawned ? "spawned" : "unspawned"} | Room ${power.generateOps.currentRoom} | TTL ${power.generateOps.ticksToLive !== null ? power.generateOps.ticksToLive : "--"}`,
        `Generate Ops level ${power.generateOps.level} cooldown ${power.generateOps.cooldown} | Store ops ${fmtAmount(power.generateOps.ops)}${power.generateOps.opsCapacity !== null ? "/" + fmtAmount(power.generateOps.opsCapacity) : ""} | Home ${power.generateOps.homeRoom} | Power Enabled ${power.generateOps.powerEnabled ? "yes" : "no"}`,
        `Generate Ops last action ${power.generateOps.lastAction} | result ${power.generateOps.lastResult !== null ? power.generateOps.lastResult : "--"} | blocked ${power.generateOps.blockedReason || "none"}`,
        `Ops banking action ${power.generateOps.bankingAction} | target ${power.generateOps.bankingTarget} | result ${power.generateOps.bankingResult !== null ? power.generateOps.bankingResult : "--"} | blocked ${power.generateOps.bankingBlockedReason || "none"}`,
        `Last processed ${power.lastProcessed !== null ? power.lastProcessed : "--"} | Total ${fmtAmount(power.totalProcessed)} | Last seen ${power.lastSeen !== null ? power.lastSeen : "--"}`,
      ],
      observer: [
        `[OPS][${room.name}][OBSERVER]`,
        `Enabled ${observer.enabled ? "yes" : "no"} | Observers ${observer.observerCount || 0}`,
        `Last ${observer.lastObservedTarget || "none"} | Result ${observer.lastResult || "none"} | Reason ${observer.lastReason || "none"}`,
        `Queued ${observer.queuedTargets || 0}/${observer.maxTargetsPerRoom || 0} | Targets ${formatObserverTargets(observer)}`,
        `Intel ${observer.intelCount || 0} | Newest ${formatIntelAge(observer.newestIntelAge)} | Oldest ${formatIntelAge(observer.oldestIntelAge)}`,
        `Interval ${observer.runInterval || 0}t | Last run ${observer.lastRun || "--"}`,
      ],
      cpu: [
        `[OPS][${room.name}][CPU]`,
        cpu.available
          ? `Room current ${cpu.current.toFixed(3)} | Avg ${cpu.average.toFixed(3)} | Global ${cpu.globalCurrent.toFixed(2)}/${cpu.limit} | Bucket ${cpu.bucket}`
          : "CPU stats unavailable",
        cpu.available ? formatTrendLine(cpu) : "Trend unavailable",
        cpu.available
          ? `Pressure ${cpu.pressure} | Phase ${cpu.phase || summaryState.phase} | RCL ${cpu.rcl || (room.controller ? room.controller.level : 0)} | Creeps ${cpu.creepCount !== null ? cpu.creepCount : Object.keys(Game.creeps).length}`
          : "Pressure unknown",
        cpu.available ? formatPressureHistoryLine(cpu) : "Pressure history unavailable",
        cpu.available
          ? formatCpuEfficiencyLine(cpu, sources.length, remoteSiteCount)
          : "Efficiency unavailable",
        cpu.available
          ? `Shedding think x${cpu.thinkIntervalMultiplier} | build x${cpu.constructionIntervalMultiplier} | advanced every ${cpu.advancedOpsInterval}t`
          : "Room scale off | advanced every 1t",
        cpu.available
          ? `Skip directives ${cpu.skipDirectives ? "yes" : "no"} | skip HUD ${cpu.skipHud ? "yes" : "no"}`
          : "Skip directives no | skip HUD no",
        cpu.available ? formatSchedulerSkipLine(cpu) : "Scheduler skips unknown",
      ],
      resources: [
        `[OPS][${room.name}][RESOURCES]`,
        `Storage Energy ${fmtAmount(getStorageEnergy(room))}`,
        `Terminal Energy ${fmtAmount(terminalBalance.terminalEnergy)}/${fmtAmount(terminalBalance.terminalEnergyTarget)}`,
        `Terminal Power ${fmtAmount(terminalBalance.terminalPower)}/${fmtAmount(terminalBalance.terminalPowerTarget)} | Ghodium ${fmtAmount(terminalBalance.terminalGhodium)}/${fmtAmount(terminalBalance.terminalGhodiumTarget)}`,
        `Terminal Minerals ${formatTerminalMinerals(terminalBalance)} | target ${fmtAmount(terminalBalance.mineralTarget)}`,
        `Balance State ${terminalBalance.state || "unknown"} | pending ${terminalBalance.pendingMoves || 0}`,
      ],
      logistics: [
        `[OPS][${room.name}][LOGISTICS]`,
        `Open Requests ${logistics.openRequests} | Blocked Requests ${logistics.blockedRequests}`,
        `Remaining ${fmtAmount(logistics.totalRemaining)} | Claimed ${fmtAmount(logistics.totalClaimed)} | Unclaimed ${fmtAmount(logistics.totalUnclaimed)}`,
        `Oldest Open ${logistics.oldestOpenAge} ticks | Oldest Unclaimed ${logistics.oldestUnclaimedAge} ticks`,
        `Haulers ${logistics.haulers.current} / ${logistics.haulers.desired} | State ${logistics.state}`,
        `Trend ${logistics.history.trend} | Recent Samples ${logistics.history.starvationSamples}/${logistics.history.sampleCount} | Worst Recent State ${logistics.history.worstState}`,
        `Blocked Samples ${logistics.history.blockedSamples} | Unclaimed Aging Samples ${logistics.history.unclaimedAgingSamples} | Hauler Short Samples ${logistics.history.haulerShortSamples}`,
        formatAdvancedBacklogLine(logistics),
      ].concat(formatRecentLogisticsLines(logistics), formatWaitingLogisticsLines(logistics)),
    };

    if (cpu.available) {
      Array.prototype.push.apply(sections.cpu, formatCpuHotspotLines(cpu));
      Array.prototype.push.apply(sections.cpu, formatCpuSectionLines(cpu));
    }

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
          `${room.name} | ALERT`,
          `${progressLabel} | ETA ${etaLabel}`,
          `Hostiles ${alert.hostiles} | Threat ${alert.threatScore} | Def ${alert.defenders}/${alert.requiredDefenders}`,
          `Support ${alert.supportAssigned}/${alert.supportRequested} from ${alert.supportHelper}`,
          `Energy ${room.energyAvailable}/${room.energyCapacityAvailable} | Spawn ${spawn.spawnLabel} | Q ${spawn.nextQueued}`,
          `Safe ${alert.safeMode} | Next ${nextTask}`,
        ]
      : alert.recoveryActive
        ? [
            `${room.name} | RECOVERY`,
            `${progressLabel} | ETA ${etaLabel}`,
            `Energy ${room.energyAvailable}/${room.energyCapacityAvailable} | Spawn ${spawn.spawnLabel} | Q ${spawn.nextQueued}`,
            `Towers ${alert.readyTowers} ready | Mode ${alert.responseMode} | Breach ${alert.breachSeverity}`,
            `Recover core logistics | Next ${nextTask}`,
          ]
      : [
          `${room.name} | ${String(summaryState.phase).toUpperCase()}`,
          `${progressLabel} | ETA ${etaLabel}`,
          `Energy ${room.energyAvailable}/${room.energyCapacityAvailable} | Spawn ${spawn.spawnLabel} | Q ${spawn.nextQueued}`,
          `${formatHudFocusLine(room, plan)} | Next ${nextTask}`,
          mineralHudLine || upgradeReserveLine || `Build ${shortBuild} | Sites ${buildStatus.sites || 0}`,
        ];

    return {
      room: room.name,
      state: summaryState,
      plan: plan,
      progress: progress,
      alert: alert,
      cpu: cpu,
      logistics: logistics,
      factory: factoryDiagnostics,
      labs: labDiagnostics,
      labor: laborDiagnostics,
      roleIntent: roleIntent,
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

  buildEmpireLaborRollup(reports) {
    return buildEmpireLaborRollup(reports);
  },

  formatEmpireLaborRollup(rollup) {
    return formatEmpireLaborRollup(rollup);
  },
};
