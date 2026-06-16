const config = require("config");
const opsLogisticsManager = require("ops_logistics_manager");

const DEFAULTS = {
  ENABLED: true,
  RUN_INTERVAL: 25,
  MIN_RCL: 6,
  ENERGY_TARGET: 50000,
  MINERAL_TARGET: 5000,
  POWER_TARGET: 500,
  GHODIUM_TARGET: 5000,
  MIN_STORAGE_ENERGY: 50000,
  MOVE_BATCH: 10000,
  PRIORITY: 62,
};

function getSettings() {
  return Object.assign(
    {},
    DEFAULTS,
    config.TERMINAL_BALANCE || {},
  );
}

function getRoomMemory(room) {
  if (!Memory.rooms) Memory.rooms = {};
  if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
  if (!Memory.rooms[room.name].terminalBalance) {
    Memory.rooms[room.name].terminalBalance = {};
  }
  return Memory.rooms[room.name].terminalBalance;
}

function getStoredAmount(target, resourceType) {
  if (!target || !target.store) return 0;

  if (typeof target.store.getUsedCapacity === "function") {
    const used = target.store.getUsedCapacity(resourceType);
    if (typeof used === "number" && used > 0) return used;
  }

  return target.store[resourceType] || 0;
}

function getFreeCapacity(target, resourceType) {
  if (!target || !target.store) return 0;

  if (typeof target.store.getFreeCapacity === "function") {
    const free = target.store.getFreeCapacity(resourceType);
    if (typeof free === "number") return free;
  }

  return 0;
}

function getStoreResources(target) {
  if (!target || !target.store) return [];

  return Object.keys(target.store)
    .filter(function (resourceType) {
      return (target.store[resourceType] || 0) > 0;
    })
    .sort();
}

function getPowerResource() {
  return typeof RESOURCE_POWER !== "undefined" ? RESOURCE_POWER : "power";
}

function getGhodiumResource() {
  return typeof RESOURCE_GHODIUM !== "undefined" ? RESOURCE_GHODIUM : "G";
}

function isBaseMineral(resourceType) {
  if (!resourceType || resourceType === RESOURCE_ENERGY) return false;
  if (resourceType === getPowerResource() || resourceType === getGhodiumResource()) {
    return false;
  }

  return [
    "H",
    "O",
    "U",
    "L",
    "K",
    "Z",
    "X",
  ].indexOf(resourceType) !== -1;
}

function classifyState(summary) {
  if (!summary || !summary.ready) return "unavailable";
  if ((summary.pendingMoves || 0) > 0) return "balancing";
  if ((summary.deficits || 0) > 0) return "needs_resources";
  if ((summary.excesses || 0) > 0) return "excess";
  return "balanced";
}

function buildSummary(room, settings, intents, requestResults, reason) {
  const terminal = room.terminal || null;
  const storage = room.storage || null;
  const terminalEnergy = getStoredAmount(terminal, RESOURCE_ENERGY);
  const terminalPower = getStoredAmount(terminal, getPowerResource());
  const terminalGhodium = getStoredAmount(terminal, getGhodiumResource());
  const resources = getStoreResources(terminal);
  const mineralRows = resources
    .filter(isBaseMineral)
    .map(function (resourceType) {
      return {
        resourceType: resourceType,
        amount: getStoredAmount(terminal, resourceType),
        target: settings.MINERAL_TARGET,
      };
    });
  const deficits = intents.filter(function (intent) {
    return intent.direction === "storage_to_terminal";
  }).length;
  const excesses = intents.filter(function (intent) {
    return intent.direction === "terminal_to_storage";
  }).length;

  const summary = {
    tick: Game.time,
    roomName: room.name,
    ready: !!(storage && terminal),
    reason: reason || null,
    terminalEnergy: terminalEnergy,
    terminalEnergyTarget: settings.ENERGY_TARGET,
    terminalPower: terminalPower,
    terminalPowerTarget: settings.POWER_TARGET,
    terminalGhodium: terminalGhodium,
    terminalGhodiumTarget: settings.GHODIUM_TARGET,
    mineralTarget: settings.MINERAL_TARGET,
    minerals: mineralRows,
    pendingMoves: requestResults.length,
    deficits: deficits,
    excesses: excesses,
    state: null,
  };

  summary.state = classifyState(summary);
  return summary;
}

function addIntent(intents, resourceType, amount, from, to, reason) {
  if (!amount || amount <= 0) return;

  intents.push({
    resourceType: resourceType,
    amount: Math.floor(amount),
    from: from,
    to: to,
    reason: reason,
    direction: from === "storage" ? "storage_to_terminal" : "terminal_to_storage",
  });
}

function buildIntents(room, settings) {
  const storage = room.storage;
  const terminal = room.terminal;
  const intents = [];
  let projectedFree = getFreeCapacity(terminal);

  const terminalEnergy = getStoredAmount(terminal, RESOURCE_ENERGY);
  const storageEnergy = getStoredAmount(storage, RESOURCE_ENERGY);
  if (
    terminalEnergy < settings.ENERGY_TARGET &&
    storageEnergy > settings.MIN_STORAGE_ENERGY &&
    projectedFree > 0
  ) {
    const amount = Math.min(
      settings.ENERGY_TARGET - terminalEnergy,
      storageEnergy - settings.MIN_STORAGE_ENERGY,
      projectedFree,
      settings.MOVE_BATCH,
    );
    addIntent(intents, RESOURCE_ENERGY, amount, "storage", "terminal", "energy_target");
    projectedFree -= Math.max(0, amount);
  } else if (terminalEnergy > settings.ENERGY_TARGET) {
    const amount = Math.min(
      terminalEnergy - settings.ENERGY_TARGET,
      getFreeCapacity(storage, RESOURCE_ENERGY),
      settings.MOVE_BATCH,
    );
    addIntent(intents, RESOURCE_ENERGY, amount, "terminal", "storage", "energy_excess");
    projectedFree += Math.max(0, amount);
  }

  const stagedResources = [
    {
      resourceType: getPowerResource(),
      target: settings.POWER_TARGET,
      reason: "power_target",
    },
    {
      resourceType: getGhodiumResource(),
      target: settings.GHODIUM_TARGET,
      reason: "ghodium_target",
    },
  ];

  const storageResources = getStoreResources(storage);
  for (let i = 0; i < storageResources.length; i++) {
    const resourceType = storageResources[i];
    if (!isBaseMineral(resourceType)) continue;
    stagedResources.push({
      resourceType: resourceType,
      target: settings.MINERAL_TARGET,
      reason: "mineral_target",
    });
  }
  const terminalResources = getStoreResources(terminal);
  for (let i = 0; i < terminalResources.length; i++) {
    const resourceType = terminalResources[i];
    if (!isBaseMineral(resourceType)) continue;
    stagedResources.push({
      resourceType: resourceType,
      target: settings.MINERAL_TARGET,
      reason: "mineral_target",
    });
  }

  const seen = {};
  for (let j = 0; j < stagedResources.length; j++) {
    const policy = stagedResources[j];
    if (seen[policy.resourceType]) continue;
    seen[policy.resourceType] = true;

    const terminalAmount = getStoredAmount(terminal, policy.resourceType);
    const storageAmount = getStoredAmount(storage, policy.resourceType);
    if (terminalAmount < policy.target && storageAmount > 0 && projectedFree > 0) {
      const amount = Math.min(
        policy.target - terminalAmount,
        storageAmount,
        projectedFree,
        settings.MOVE_BATCH,
      );
      addIntent(
        intents,
        policy.resourceType,
        amount,
        "storage",
        "terminal",
        policy.reason,
      );
      projectedFree -= Math.max(0, amount);
    } else if (terminalAmount > policy.target) {
      const amount = Math.min(
        terminalAmount - policy.target,
        getFreeCapacity(storage, policy.resourceType),
        settings.MOVE_BATCH,
      );
      addIntent(
        intents,
        policy.resourceType,
        amount,
        "terminal",
        "storage",
        policy.reason.replace("_target", "_excess"),
      );
      projectedFree += Math.max(0, amount);
    }
  }

  return intents;
}

function createRequests(room, intents, settings) {
  const results = [];

  for (let i = 0; i < intents.length; i++) {
    const intent = intents[i];
    const result = opsLogisticsManager.createMoveRequest(
      intent.resourceType,
      intent.amount,
      room.name,
      intent.from,
      intent.to,
      {
        priority: settings.PRIORITY,
        reason: intent.reason,
      },
    );
    results.push(Object.assign({ intent: intent }, result));
  }

  return results;
}

module.exports = {
  VERSION: "1.0.0-terminal-balance",

  getSettings: getSettings,

  getStatus(room) {
    if (!room) return null;

    const memory =
      Memory.rooms && Memory.rooms[room.name]
        ? Memory.rooms[room.name].terminalBalance || null
        : null;

    if (memory && memory.summary) return memory.summary;

    return buildSummary(room, getSettings(), [], [], "not_evaluated");
  },

  evaluate(room, options) {
    const settings = getSettings();
    const opts = options || {};

    if (!room || !room.controller || !room.controller.my) {
      return {
        ok: false,
        roomName: room ? room.name : null,
        requests: [],
        message: "[OPS] terminal balance: invalid owned room.",
      };
    }

    if (settings.ENABLED === false) {
      return {
        ok: true,
        roomName: room.name,
        requests: [],
        summary: buildSummary(room, settings, [], [], "disabled"),
        message: "[OPS] terminal balance " + room.name + ": disabled.",
      };
    }

    if (!room.storage || !room.terminal) {
      const summary = buildSummary(room, settings, [], [], "missing_storage_or_terminal");
      getRoomMemory(room).summary = summary;
      return {
        ok: false,
        roomName: room.name,
        requests: [],
        summary: summary,
        message:
          "[OPS] terminal balance " +
          room.name +
          ": needs both storage and terminal.",
      };
    }

    if (
      room.controller &&
      room.controller.level &&
      room.controller.level < settings.MIN_RCL
    ) {
      const summary = buildSummary(room, settings, [], [], "rcl_below_min");
      getRoomMemory(room).summary = summary;
      return {
        ok: true,
        roomName: room.name,
        requests: [],
        summary: summary,
        message:
          "[OPS] terminal balance " +
          room.name +
          ": waiting for RCL " +
          settings.MIN_RCL +
          ".",
      };
    }

    const intents = buildIntents(room, settings);
    const requests = opts.dryRun ? [] : createRequests(room, intents, settings);
    const summary = buildSummary(room, settings, intents, requests);
    const memory = getRoomMemory(room);
    memory.lastRun = Game.time;
    memory.summary = summary;

    return {
      ok: true,
      roomName: room.name,
      requests: requests,
      intents: intents,
      summary: summary,
      message:
        "[OPS] terminal balance " +
        room.name +
        ": " +
        requests.length +
        " logistics request result(s).",
    };
  },

  run(room) {
    const settings = getSettings();
    if (!room || settings.ENABLED === false) return this.getStatus(room);

    const memory = getRoomMemory(room);
    if (
      memory.lastRun &&
      Game.time - memory.lastRun < settings.RUN_INTERVAL
    ) {
      return memory.summary || this.getStatus(room);
    }

    const result = this.evaluate(room);
    return result.summary;
  },
};
