const opsLogisticsManager = require("ops_logistics_manager");
const marketRequestManager = require("market_request_manager");

const VERSION = "2.0.0-layer2-market-console";

const CONFIG = {
  terminalEnergyReserve: 30000,
  terminalEnergyTarget: 50000,
  storageEnergyReserve: 100000,
  mineralTarget: 10000,
  mineralSurplus: 25000,
  optionLimit: 5,
  allOptionLimitPerResource: 3,
  sampleAmount: 1000,
  energyCreditValue: 0.3,
  maxAllResourcesToScan: 80,
  readyEnergy: 1000,
  healthyEnergy: 10000,
  freeCapacityMinimum: 1000,
  congestedFreeCapacity: 20000,
  sellableMineralMinimum: 1000,
  intelligenceLimit: 8,
  planTtl: 5000,
  logPrefix: "[MARKET]",
};

const DEFAULT_EXECUTION_LIMITS = {
  maxSellAmount: 10000,
  maxBuyAmount: 10000,
  maxCreditsPerBuy: 1000000,
  minSellEffectivePrice: 0,
  maxBuyEffectivePrice: null,
  minTerminalEnergyReserve: 0,
};

const EXECUTION_LIMIT_NAMES = Object.keys(DEFAULT_EXECUTION_LIMITS);
const DEFAULT_HISTORY_LIMIT = 100;
const MIN_HISTORY_LIMIT = 10;

const BASE_RESOURCES = [
  RESOURCE_ENERGY,
  RESOURCE_POWER,
  RESOURCE_OPS,
  RESOURCE_HYDROGEN,
  RESOURCE_OXYGEN,
  RESOURCE_UTRIUM,
  RESOURCE_LEMERGIUM,
  RESOURCE_KEANIUM,
  RESOURCE_ZYNTHIUM,
  RESOURCE_CATALYST,
  RESOURCE_GHODIUM,
  RESOURCE_SILICON,
  RESOURCE_METAL,
  RESOURCE_BIOMASS,
  RESOURCE_MIST,
].filter(Boolean);

function resourceList() {
  if (typeof RESOURCES_ALL !== "undefined" && Array.isArray(RESOURCES_ALL)) {
    return RESOURCES_ALL.slice(0, CONFIG.maxAllResourcesToScan);
  }

  return BASE_RESOURCES.slice(0, CONFIG.maxAllResourcesToScan);
}

function printLine(line) {
  console.log(line);
  return line;
}

function printBlock(lines) {
  for (let i = 0; i < lines.length; i++) {
    console.log(lines[i]);
  }

  return lines.join("\n");
}

function fmt(value) {
  return Math.round(value || 0).toLocaleString();
}

function formatHelpGroups(title, groups) {
  const lines = [title, `[MARKET] Version ${VERSION}`];

  for (let i = 0; i < groups.length; i++) {
    lines.push("");
    lines.push(`[MARKET] ${groups[i].title}`);
    for (let j = 0; j < groups[i].commands.length; j++) {
      lines.push(`  - ${groups[i].commands[j]}`);
    }
  }

  return lines;
}

function getMemoryRoot() {
  if (!Memory.consoleTools) Memory.consoleTools = {};
  if (!Memory.consoleTools.market) Memory.consoleTools.market = {};
  return Memory.consoleTools.market;
}

function getPlanStore() {
  const memory = getMemoryRoot();
  if (!memory.plans) memory.plans = {};
  return memory.plans;
}

function getHistoryStore() {
  const memory = getMemoryRoot();
  if (!memory.history) memory.history = [];
  return memory.history;
}

function getHistoryLimitValue() {
  const memory = getMemoryRoot();
  const limit = Math.floor(Number(memory.historyLimit));

  if (!Number.isFinite(limit) || limit < MIN_HISTORY_LIMIT) {
    memory.historyLimit = DEFAULT_HISTORY_LIMIT;
    return DEFAULT_HISTORY_LIMIT;
  }

  memory.historyLimit = limit;
  return limit;
}

function trimHistoryToLimit() {
  const history = getHistoryStore();
  const limit = getHistoryLimitValue();

  if (history.length > limit) {
    history.splice(0, history.length - limit);
  }

  return history;
}

function getExecutionLimitStore() {
  const memory = getMemoryRoot();
  if (!memory.executionLimits) memory.executionLimits = {};

  for (const name of EXECUTION_LIMIT_NAMES) {
    if (!Object.prototype.hasOwnProperty.call(memory.executionLimits, name)) {
      memory.executionLimits[name] = DEFAULT_EXECUTION_LIMITS[name];
    }
  }

  return memory.executionLimits;
}

function touchMemory() {
  const memory = getMemoryRoot();

  if (!memory.installedAt) memory.installedAt = Game.time;

  memory.version = VERSION;
  memory.lastRegisteredAt = Game.time;
  memory.mode = "source-integrated";
  memory.commandRoot = "market.xxx";

  return memory;
}

function amountIn(store, resource) {
  if (!store) return 0;
  return store[resource] || 0;
}

function storeResources(store) {
  if (!store) return [];
  return Object.keys(store)
    .filter((resource) => amountIn(store, resource) > 0)
    .sort();
}

function ownedRooms() {
  return Object.values(Game.rooms)
    .filter((room) => room.controller && room.controller.my)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getOwnedRoom(roomName) {
  const room = Game.rooms[roomName];

  if (!room || !room.controller || !room.controller.my) {
    return null;
  }

  return room;
}

function roomResourceTotal(room, resource) {
  return (
    amountIn(room.storage && room.storage.store, resource) +
    amountIn(room.terminal && room.terminal.store, resource)
  );
}

function empireTotals() {
  const totals = {};

  for (const room of ownedRooms()) {
    for (const structure of [room.storage, room.terminal]) {
      if (!structure) continue;

      for (const resource of storeResources(structure.store)) {
        totals[resource] =
          (totals[resource] || 0) + amountIn(structure.store, resource);
      }
    }
  }

  return totals;
}

function terminalUsable(room) {
  return !!(room && room.terminal && room.terminal.my);
}

function terminalReady(room) {
  return terminalUsable(room) && room.terminal.cooldown === 0;
}

function terminalFreeCapacity(room) {
  if (!room || !room.terminal) return 0;

  if (room.terminal.store.getFreeCapacity) {
    return room.terminal.store.getFreeCapacity();
  }

  return 300000 - _.sum(room.terminal.store);
}

function terminalUsedCapacity(room) {
  if (!room || !room.terminal) return 0;

  if (room.terminal.store.getUsedCapacity) {
    return room.terminal.store.getUsedCapacity();
  }

  return _.sum(room.terminal.store);
}

function isKnownResource(resource) {
  if (!resource || typeof resource !== "string") return false;

  if (typeof RESOURCES_ALL !== "undefined" && Array.isArray(RESOURCES_ALL)) {
    return RESOURCES_ALL.indexOf(resource) >= 0;
  }

  return resourceList().indexOf(resource) >= 0 || resource.length > 0;
}

function sellableResources(room) {
  if (!room || !room.terminal) return [];

  return storeResources(room.terminal.store)
    .filter((resource) => resource !== RESOURCE_ENERGY)
    .map((resource) => ({
      resource,
      amount: amountIn(room.terminal.store, resource),
    }))
    .filter((row) => row.amount >= CONFIG.sellableMineralMinimum)
    .sort((a, b) => {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.resource.localeCompare(b.resource);
    });
}

function classifyRoomReadiness(room) {
  if (!room || !room.controller || !room.controller.my) {
    return null;
  }

  const terminal = room.terminal;
  const terminalEnergy = terminal ? amountIn(terminal.store, RESOURCE_ENERGY) : 0;
  const freeCapacity = terminal ? terminalFreeCapacity(room) : 0;
  const usedCapacity = terminal ? terminalUsedCapacity(room) : 0;
  const cooldown = terminal ? terminal.cooldown || 0 : 0;
  const blockers = [];
  let status = "READY";

  if (!terminal || !terminal.my) {
    status = "NO_TERMINAL";
    blockers.push("no terminal");
  } else if (!room.storage) {
    status = "NO_STORAGE";
    blockers.push("storage missing");
  } else if (freeCapacity <= 0) {
    status = "FULL";
    blockers.push("terminal full");
  } else if (terminalEnergy < CONFIG.readyEnergy) {
    status = "LOW_ENERGY";
    blockers.push("low terminal energy");
  } else if (freeCapacity < CONFIG.congestedFreeCapacity) {
    status = "CONGESTED";
    blockers.push("terminal congested");
  }

  if (terminal && cooldown > 0) {
    blockers.push(`cooldown ${cooldown}`);
  }

  if (terminal && freeCapacity < CONFIG.freeCapacityMinimum && status !== "FULL") {
    blockers.push("low terminal free capacity");
  }

  const sellable = sellableResources(room);

  return {
    room,
    roomName: room.name,
    status,
    terminalEnergy,
    freeCapacity,
    usedCapacity,
    cooldown,
    hasStorage: !!room.storage,
    sellable,
    topSellable: sellable[0] || null,
    blockers,
    ready: status === "READY" && cooldown === 0,
  };
}

function readinessRows() {
  return ownedRooms().map(classifyRoomReadiness).filter(Boolean);
}

function formatSellable(row) {
  return row ? `sellable ${row.resource} ${fmt(row.amount)}` : "sellable none";
}

function readinessCommand(input) {
  if (input && getOwnedRoom(input)) return roomReadiness(input);
  if (input && isKnownResource(input)) return resourceReadiness(input);
  if (input) return printLine(`${CONFIG.logPrefix} Invalid owned room or resource: ${input}`);

  const lines = ["[MARKET] Readiness:"];
  const rows = readinessRows();

  if (!rows.length) {
    lines.push("  no owned rooms visible");
    return printBlock(lines);
  }

  for (const row of rows) {
    lines.push(
      `  ${row.roomName} | ${row.status}` +
        ` | energy ${fmt(row.terminalEnergy)}` +
        ` | free ${fmt(row.freeCapacity)}` +
        ` | ${formatSellable(row.topSellable)}` +
        (row.blockers.length ? ` | blocker ${row.blockers.join(", ")}` : ""),
    );
  }

  return printBlock(lines);
}

function roomReadiness(roomName) {
  const room = getOwnedRoom(roomName);

  if (!room) {
    return printLine(`${CONFIG.logPrefix} Invalid owned room: ${roomName}`);
  }

  const row = classifyRoomReadiness(room);
  const lines = [
    `[MARKET] ${room.name} readiness:`,
    `  status ${row.status}`,
    `  terminal energy ${fmt(row.terminalEnergy)}`,
    `  terminal used/free ${fmt(row.usedCapacity)}/${fmt(row.freeCapacity)}`,
    `  storage ${row.hasStorage ? "exists" : "missing"}`,
    `  terminal cooldown ${fmt(row.cooldown)}`,
    "  sellable resources:",
  ];

  if (!row.sellable.length) {
    lines.push("    none above threshold");
  } else {
    for (const item of row.sellable.slice(0, CONFIG.optionLimit)) {
      lines.push(`    ${item.resource}: ${fmt(item.amount)}`);
    }
  }

  lines.push(`  blockers: ${row.blockers.length ? row.blockers.join(", ") : "none"}`);
  lines.push("  suggested commands:");

  const suggestions = readinessSuggestions(row);
  if (!suggestions.length) {
    lines.push("    none");
  } else {
    for (const suggestion of suggestions) {
      lines.push(`    ${suggestion}`);
    }
  }

  return printBlock(lines);
}

function resourceReadiness(resource) {
  const lines = [`[MARKET] ${resource} readiness:`];
  let seen = false;

  for (const row of readinessRows()) {
    if (!row.room.terminal) continue;

    const amount = amountIn(row.room.terminal.store, resource);
    if (amount <= 0) continue;
    seen = true;

    lines.push(
      `  ${row.roomName} | ${row.status}` +
        ` | terminal ${resource} ${fmt(amount)}` +
        ` | energy ${fmt(row.terminalEnergy)}` +
        ` | free ${fmt(row.freeCapacity)}` +
        (row.blockers.length ? ` | blocker ${row.blockers.join(", ")}` : ""),
    );
  }

  if (!seen) lines.push("  no owned terminals contain this resource");

  return printBlock(lines);
}

function readinessSuggestions(row) {
  const suggestions = [];

  if (row.status === "FULL" || row.status === "CONGESTED") {
    suggestions.push(`ops.clearTerminal("${row.roomName}")`);
  }

  if (
    row.room.terminal &&
    row.terminalEnergy < CONFIG.healthyEnergy &&
    row.freeCapacity > 0 &&
    (row.sellable.length || row.terminalEnergy < CONFIG.readyEnergy)
  ) {
    suggestions.push(`ops.fillTerminal("${row.roomName}", "energy", ${CONFIG.healthyEnergy})`);
  }

  if (row.ready && row.topSellable) {
    suggestions.push(`market.sellOptions("${row.topSellable.resource}")`);
  }

  return suggestions;
}

function getBuyOrders(resource) {
  return Game.market
    .getAllOrders({
      type: ORDER_BUY,
      resourceType: resource,
    })
    .filter((order) => order.amount > 0 && order.roomName);
}

function analyzeSellOpportunity(resource, room, orders) {
  const readiness = classifyRoomReadiness(room);
  const terminal = room.terminal;
  const available = terminal ? amountIn(terminal.store, resource) : 0;
  const terminalEnergy = terminal ? amountIn(terminal.store, RESOURCE_ENERGY) : 0;
  const blockers = readiness ? readiness.blockers.slice() : ["room unavailable"];

  if (!terminal) blockers.push("no terminal resource");
  if (available <= 0) blockers.push("no terminal resource");
  if (!orders.length) blockers.push("no buy orders");

  let best = null;

  for (const order of orders) {
    const sample = Math.min(CONFIG.sampleAmount, available, order.amount);
    if (sample <= 0) continue;

    const score = scoreSellOrder(order, room.name, sample);
    const maxByEnergy = maxAmountByTerminalEnergy(
      room.name,
      order.roomName,
      terminalEnergy,
      Math.min(order.amount, available),
    );
    const maxNow =
      readiness && readiness.ready
        ? Math.min(order.amount, available, maxByEnergy)
        : 0;
    const executable = maxNow > 0;

    if (readiness && readiness.ready && maxByEnergy <= 0) {
      blockers.push("energy short");
    }

    const candidate = {
      resource,
      room,
      readiness,
      order,
      available,
      terminalEnergy,
      maxNow,
      ready: executable,
      energyCost: score.energyCost,
      effectivePrice: score.effectivePrice,
      blockers: blockers.filter((reason, index, list) => list.indexOf(reason) === index),
    };

    if (
      !best ||
      (candidate.ready !== best.ready ? candidate.ready : false) ||
      candidate.effectivePrice > best.effectivePrice
    ) {
      best = candidate;
    }
  }

  if (best) return best;

  return {
    resource,
    room,
    readiness,
    order: null,
    available,
    terminalEnergy,
    maxNow: 0,
    ready: false,
    energyCost: 0,
    effectivePrice: 0,
    blockers: blockers.filter((reason, index, list) => list.indexOf(reason) === index),
  };
}

function opportunityResources() {
  const seen = {};
  const resources = [];

  for (const row of readinessRows()) {
    for (const item of row.sellable) {
      if (seen[item.resource]) continue;
      seen[item.resource] = true;
      resources.push(item.resource);
    }
  }

  return resources.slice(0, CONFIG.maxAllResourcesToScan);
}

function collectOpportunities(resource) {
  const resources = resource ? [resource] : opportunityResources();
  const rows = [];

  for (const res of resources) {
    const orders = getBuyOrders(res);

    for (const room of ownedRooms()) {
      if (!room.terminal) continue;
      const row = analyzeSellOpportunity(res, room, orders);
      if (resource || row.available > 0 || row.ready) rows.push(row);
    }
  }

  rows.sort((a, b) => {
    if (a.ready !== b.ready) return a.ready ? -1 : 1;
    if (b.effectivePrice !== a.effectivePrice) return b.effectivePrice - a.effectivePrice;
    return b.available - a.available;
  });

  return rows;
}

function hasActiveRequestsReadOnly() {
  const opsRequests =
    Memory.ops &&
    Memory.ops.logistics &&
    Memory.ops.logistics.requests
      ? Memory.ops.logistics.requests
      : {};
  const marketRequests =
    Memory.consoleTools &&
    Memory.consoleTools.market &&
    Memory.consoleTools.market.requests
      ? Memory.consoleTools.market.requests
      : {};

  for (const id in opsRequests) {
    if (!Object.prototype.hasOwnProperty.call(opsRequests, id)) continue;
    const request = opsRequests[id];
    if (request && (request.status === "open" || request.status === "blocked")) {
      return true;
    }
  }

  for (const roomName in marketRequests) {
    if (!Object.prototype.hasOwnProperty.call(marketRequests, roomName)) continue;
    const roomRequests = marketRequests[roomName] || {};

    for (const id in roomRequests) {
      if (!Object.prototype.hasOwnProperty.call(roomRequests, id)) continue;
      const request = roomRequests[id];
      if (request && (request.status === "open" || request.status === "blocked")) {
        return true;
      }
    }
  }

  return false;
}

function opportunities(resource) {
  const rows = collectOpportunities(resource);
  const lines = [
    resource
      ? `[MARKET] ${resource} opportunities:`
      : "[MARKET] Opportunities:",
  ];
  const limit = resource ? CONFIG.optionLimit : CONFIG.intelligenceLimit;
  const top = rows.slice(0, limit);

  if (!top.length) {
    lines.push("  no ready opportunities found");
    lines.push("  likely blockers: no terminal resource, no terminal energy, no buy orders, terminal cooldown");
    return printBlock(lines);
  }

  let readyCount = 0;
  for (const row of top) {
    if (row.ready) readyCount += 1;
    lines.push(
      `  ${row.room.name} | ${row.ready ? "ready" : "blocked " + row.blockers.join(", ")}` +
        ` | ${row.resource}` +
        ` | available ${fmt(row.available)}` +
        ` | maxNow ${fmt(row.maxNow)}` +
        ` | price ${row.order ? row.order.price.toFixed(4) : "n/a"}` +
        ` | effective ${row.order ? row.effectivePrice.toFixed(4) : "n/a"}` +
        ` | energy ${fmt(row.terminalEnergy)}`,
    );
  }

  if (readyCount === 0) {
    const blockers = {};
    for (const row of rows) {
      for (const reason of row.blockers) blockers[reason] = true;
    }
    lines.push(`  no ready opportunities; likely blockers: ${Object.keys(blockers).sort().join(", ") || "none"}`);
  }

  return printBlock(lines);
}

function recommendations() {
  const lines = ["[MARKET] Recommendations:"];
  const recs = [];

  for (const row of readinessRows()) {
    if (row.status === "FULL" || row.status === "CONGESTED") {
      recs.push({
        priority: 10,
        text: `CLEAR_TERMINAL | ${row.roomName} | run ops.clearTerminal("${row.roomName}")`,
      });
    }

    if (row.sellable.length && row.terminalEnergy < CONFIG.healthyEnergy && row.freeCapacity > 0) {
      recs.push({
        priority: 20,
        text: `FILL_ENERGY | ${row.roomName} | run ops.fillTerminal("${row.roomName}", "energy", ${CONFIG.healthyEnergy})`,
      });
    }
  }

  const readyOpportunities = collectOpportunities()
    .filter((row) => row.ready)
    .slice(0, 3);

  for (const row of readyOpportunities) {
    recs.push({
      priority: 30,
      text: `SELL_READY | ${row.room.name} | ${row.resource} | run market.sellOptions("${row.resource}")`,
    });
  }

  if (hasActiveRequestsReadOnly()) {
    recs.push({
      priority: 40,
      text: "REVIEW_REQUESTS | empire | run ops.requests()",
    });
  }

  recs.sort((a, b) => a.priority - b.priority);

  if (!recs.length) {
    lines.push("  none");
  } else {
    for (let i = 0; i < Math.min(recs.length, CONFIG.intelligenceLimit); i++) {
      lines.push(`  ${i + 1}. ${recs[i].text}`);
    }
  }

  return printBlock(lines);
}

function maxAmountByTerminalEnergy(roomName, orderRoomName, terminalEnergy, maxAmount) {
  let low = 0;
  let high = Math.max(0, Math.floor(maxAmount || 0));

  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    const energyCost = Game.market.calcTransactionCost(
      mid,
      roomName,
      orderRoomName,
    );

    if (energyCost <= terminalEnergy) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }

  return low;
}

function formatLimitReasons(reasons) {
  if (!reasons.length) return "not limited";
  return "limited by " + reasons.join(", ");
}

function scoreBuyOrder(order, roomName, amount) {
  const sampleAmount = Math.max(
    1,
    Math.min(
      amount || CONFIG.sampleAmount,
      order.amount || CONFIG.sampleAmount,
    ),
  );

  const energyCost = Game.market.calcTransactionCost(
    sampleAmount,
    roomName,
    order.roomName,
  );
  const energyCostPerUnit = energyCost / sampleAmount;
  const effectivePrice =
    order.price + energyCostPerUnit * CONFIG.energyCreditValue;

  return {
    order,
    energyCost,
    effectivePrice,
  };
}

function scoreSellOrder(order, roomName, amount) {
  const sampleAmount = Math.max(
    1,
    Math.min(
      amount || CONFIG.sampleAmount,
      order.amount || CONFIG.sampleAmount,
    ),
  );

  const energyCost = Game.market.calcTransactionCost(
    sampleAmount,
    roomName,
    order.roomName,
  );
  const energyCostPerUnit = energyCost / sampleAmount;
  const effectivePrice =
    order.price - energyCostPerUnit * CONFIG.energyCreditValue;

  return {
    order,
    energyCost,
    effectivePrice,
  };
}

function cleanPlanToken(value) {
  return String(value || "unknown").replace(/[^A-Za-z0-9]/g, "").slice(0, 12) || "unknown";
}

function makePlanId(type, resource, roomName) {
  const prefix = type === "buy" ? "mb" : "ms";
  const base =
    `${prefix}_${Game.time}_${cleanPlanToken(resource)}_${cleanPlanToken(roomName)}`;
  const plans = getPlanStore();

  if (!plans[base]) return base;

  let suffix = 2;
  while (plans[`${base}_${suffix}`]) suffix += 1;
  return `${base}_${suffix}`;
}

function uniqueReasons(reasons) {
  return reasons.filter((reason, index, list) => reason && list.indexOf(reason) === index);
}

function buildBasePlan(type, resource, amount, roomName) {
  const requestedAmount = Math.max(0, Math.floor(Number(amount) || 0));
  return {
    id: makePlanId(type, resource, roomName),
    type,
    status: "blocked",
    resourceType: resource,
    roomName,
    requestedAmount,
    executableAmount: 0,
    selectedOrderId: null,
    selectedOrderType: type === "buy" ? ORDER_SELL : ORDER_BUY,
    selectedOrderRoomName: null,
    selectedOrderPrice: 0,
    effectivePrice: 0,
    estimatedCredits: 0,
    estimatedEnergyCost: 0,
    terminalEnergy: 0,
    terminalResourceAmount: type === "sell" ? 0 : undefined,
    terminalFreeCapacity: type === "buy" ? 0 : undefined,
    blockers: [],
    createdAt: Game.time,
    updatedAt: Game.time,
    expiresAt: Game.time + CONFIG.planTtl,
  };
}

function savePlan(plan) {
  const plans = getPlanStore();
  plan.updatedAt = Game.time;
  plans[plan.id] = plan;
  return plan;
}

function findSelectedOrder(plan) {
  if (!plan || !plan.selectedOrderId) return null;

  const orders = Game.market.getAllOrders({
    type: plan.selectedOrderType,
    resourceType: plan.resourceType,
  });

  return orders.find((order) => order.id === plan.selectedOrderId) || null;
}

function finalizePlan(plan, order, executableAmount, effectivePrice) {
  const amount = Math.max(0, Math.floor(executableAmount || 0));
  plan.executableAmount = amount;
  plan.selectedOrderId = order ? order.id : null;
  plan.selectedOrderRoomName = order ? order.roomName : null;
  plan.selectedOrderPrice = order ? order.price : 0;
  plan.effectivePrice = effectivePrice || 0;

  if (order && amount > 0) {
    plan.estimatedEnergyCost = Game.market.calcTransactionCost(
      amount,
      plan.roomName,
      order.roomName,
    );
    plan.estimatedCredits = amount * order.price;
  } else {
    plan.estimatedEnergyCost = 0;
    plan.estimatedCredits = 0;
  }

  plan.blockers = uniqueReasons(plan.blockers);
  if (amount <= 0 && plan.blockers.indexOf("executable amount zero") === -1) {
    plan.blockers.push("executable amount zero");
  }
  plan.status = plan.blockers.length ? "blocked" : "ready";
  return savePlan(plan);
}

function formatPlanReport(plan, staleReasons) {
  const headerStatus =
    plan.status === "ready"
      ? "READY"
      : plan.status === "stale"
        ? "STALE"
        : plan.status === "deleted"
          ? "DELETED"
          : "BLOCKED";
  const lines = [
    `${CONFIG.logPrefix} ${plan.type === "buy" ? "Buy" : "Sell"} plan ${plan.id}: ${headerStatus}`,
    `  resource ${plan.resourceType}`,
    `  room ${plan.roomName}`,
    `  requested ${fmt(plan.requestedAmount)}`,
    `  executable ${fmt(plan.executableAmount)}`,
    `  order ${plan.selectedOrderId || "none"}`,
    `  price ${plan.selectedOrderId ? Number(plan.selectedOrderPrice).toFixed(4) : "n/a"}`,
    `  effective ${plan.selectedOrderId ? Number(plan.effectivePrice).toFixed(4) : "n/a"}`,
    `  estimated credits ${fmt(plan.estimatedCredits)}`,
    `  estimated energy ${fmt(plan.estimatedEnergyCost)}`,
  ];

  if (plan.type === "sell") {
    lines.push(`  terminal ${plan.resourceType} ${fmt(plan.terminalResourceAmount)}`);
  } else {
    lines.push(`  terminal free ${fmt(plan.terminalFreeCapacity)}`);
  }

  lines.push(`  terminal energy ${fmt(plan.terminalEnergy)}`);

  if (plan.blockers && plan.blockers.length) {
    lines.push(`  blockers ${plan.blockers.join(", ")}`);
  }
  if (staleReasons && staleReasons.length) {
    lines.push(`  stale ${staleReasons.join(", ")}`);
  }
  if (plan.status === "ready") {
    lines.push(
      `  next: market.${plan.type}("${plan.resourceType}", ${plan.executableAmount}, "${plan.roomName}")`,
    );
  }

  return printBlock(lines);
}

function selectSellPlanOrder(resource, room, requestedAmount, plan) {
  const orders = Game.market
    .getAllOrders({ type: ORDER_BUY, resourceType: resource })
    .filter((order) => order.amount > 0 && order.roomName);

  if (!orders.length) plan.blockers.push("no buy orders");

  let best = null;
  for (const order of orders) {
    const candidateLimit = Math.min(
      requestedAmount,
      order.amount,
      plan.terminalResourceAmount,
    );
    const sample = Math.min(CONFIG.sampleAmount, Math.max(1, candidateLimit));
    const score = scoreSellOrder(order, room.name, sample);
    const maxByEnergy = maxAmountByTerminalEnergy(
      room.name,
      order.roomName,
      plan.terminalEnergy,
      candidateLimit,
    );
    const executable = Math.min(candidateLimit, maxByEnergy);
    const candidate = {
      order,
      limit: candidateLimit,
      executable,
      effectivePrice: score.effectivePrice,
    };

    if (
      !best ||
      (candidate.executable > 0 !== best.executable > 0
        ? candidate.executable > 0
        : candidate.effectivePrice > best.effectivePrice)
    ) {
      best = candidate;
    }
  }

  return best;
}

function selectBuyPlanOrder(resource, room, requestedAmount, plan) {
  const orders = Game.market
    .getAllOrders({ type: ORDER_SELL, resourceType: resource })
    .filter((order) => order.amount > 0 && order.roomName);

  if (!orders.length) plan.blockers.push("no sell orders");

  let best = null;
  for (const order of orders) {
    const maxByCredits = order.price > 0
      ? Math.floor(Game.market.credits / order.price)
      : 0;
    const candidateLimit = Math.min(
      requestedAmount,
      order.amount,
      plan.terminalFreeCapacity,
      maxByCredits,
    );
    const sample = Math.min(CONFIG.sampleAmount, Math.max(1, candidateLimit));
    const score = scoreBuyOrder(order, room.name, sample);
    const maxByEnergy = maxAmountByTerminalEnergy(
      room.name,
      order.roomName,
      plan.terminalEnergy,
      candidateLimit,
    );
    const executable = Math.min(candidateLimit, maxByEnergy);
    const candidate = {
      order,
      limit: candidateLimit,
      executable,
      effectivePrice: score.effectivePrice,
      maxByCredits,
    };

    if (
      !best ||
      (candidate.executable > 0 !== best.executable > 0
        ? candidate.executable > 0
        : candidate.effectivePrice < best.effectivePrice)
    ) {
      best = candidate;
    }
  }

  return best;
}

function planSell(resource, amount, roomName) {
  const plan = buildBasePlan("sell", resource, amount, roomName);
  const room = getOwnedRoom(roomName);

  if (!room) plan.blockers.push("invalid room");
  if (!resource || !isKnownResource(resource)) plan.blockers.push("invalid resource");
  if (plan.requestedAmount <= 0) plan.blockers.push("invalid amount");

  if (room && !terminalUsable(room)) plan.blockers.push("no terminal");
  if (room && terminalUsable(room)) {
    plan.terminalEnergy = amountIn(room.terminal.store, RESOURCE_ENERGY);
    plan.terminalResourceAmount = amountIn(room.terminal.store, resource);
    if (!terminalReady(room)) plan.blockers.push("terminal cooldown");
    if (plan.terminalResourceAmount <= 0) plan.blockers.push("no resource in terminal");
  }

  let selected = null;
  if (room && terminalUsable(room) && resource && plan.requestedAmount > 0) {
    selected = selectSellPlanOrder(resource, room, plan.requestedAmount, plan);
    if (selected && selected.limit > 0 && selected.executable <= 0) {
      plan.blockers.push("insufficient terminal energy");
    }
  }

  return formatPlanReport(
    finalizePlan(
      plan,
      selected ? selected.order : null,
      selected && plan.blockers.length === 0 ? selected.executable : 0,
      selected ? selected.effectivePrice : 0,
    ),
  );
}

function planBuy(resource, amount, roomName) {
  const plan = buildBasePlan("buy", resource, amount, roomName);
  const room = getOwnedRoom(roomName);

  if (!room) plan.blockers.push("invalid room");
  if (!resource || !isKnownResource(resource)) plan.blockers.push("invalid resource");
  if (plan.requestedAmount <= 0) plan.blockers.push("invalid amount");

  if (room && !terminalUsable(room)) plan.blockers.push("no terminal");
  if (room && terminalUsable(room)) {
    plan.terminalEnergy = amountIn(room.terminal.store, RESOURCE_ENERGY);
    plan.terminalFreeCapacity = terminalFreeCapacity(room);
    if (!terminalReady(room)) plan.blockers.push("terminal cooldown");
    if (plan.terminalFreeCapacity <= 0) plan.blockers.push("no terminal capacity");
  }

  let selected = null;
  if (room && terminalUsable(room) && resource && plan.requestedAmount > 0) {
    selected = selectBuyPlanOrder(resource, room, plan.requestedAmount, plan);
    if (selected) {
      if (selected.maxByCredits <= 0) plan.blockers.push("insufficient credits");
      if (selected.limit > 0 && selected.executable <= 0) {
        plan.blockers.push("insufficient terminal energy");
      }
    }
  }

  return formatPlanReport(
    finalizePlan(
      plan,
      selected ? selected.order : null,
      selected && plan.blockers.length === 0 ? selected.executable : 0,
      selected ? selected.effectivePrice : 0,
    ),
  );
}

function planIsExpired(plan) {
  return plan && plan.expiresAt && plan.expiresAt <= Game.time;
}

function plans(mode) {
  const includeAll = mode === "all" || mode === "history";
  const rows = Object.values(getPlanStore())
    .filter((plan) => includeAll || (plan.status !== "deleted" && !planIsExpired(plan)))
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, CONFIG.intelligenceLimit);
  const lines = [
    `${CONFIG.logPrefix} Saved market plans${includeAll ? " (all)" : " (active)"}:`,
  ];

  if (!rows.length) {
    lines.push("  none");
    return printBlock(lines);
  }

  for (const item of rows) {
    lines.push(
      `  ${item.id} | ${item.status}` +
        ` | ${item.type}` +
        ` | ${item.resourceType}` +
        ` | ${item.roomName}` +
        ` | ${fmt(item.executableAmount)}/${fmt(item.requestedAmount)}` +
        ` | price ${item.selectedOrderId ? Number(item.selectedOrderPrice).toFixed(4) : "n/a"}` +
        ` | created ${item.createdAt}`,
    );
  }

  return printBlock(lines);
}

function recheckPlan(plan) {
  const review = reviewPlanState(plan);

  if (review.statusChanged) {
    plan.status = review.status;
    plan.updatedAt = Game.time;
  }

  return review.staleReasons;
}

function activePlanRows() {
  return Object.values(getPlanStore()).filter((saved) => saved.status !== "deleted");
}

function reviewPlanState(plan) {
  const staleReasons = [];
  const blockedReasons = [];
  const categories = [];

  if (!plan) {
    return {
      status: "blocked",
      staleReasons,
      blockedReasons: ["plan missing"],
      categories: ["blocked"],
      statusChanged: false,
    };
  }

  if (plan.status === "deleted") {
    return {
      status: "deleted",
      staleReasons,
      blockedReasons,
      categories,
      statusChanged: false,
    };
  }

  if (planIsExpired(plan)) staleReasons.push("plan expired");
  if (plan.executableAmount <= 0) blockedReasons.push("executable amount zero");

  const order = findSelectedOrder(plan);
  if (!plan.selectedOrderId || !order) {
    staleReasons.push("order missing");
    categories.push("missing-order");
  }

  if (order) {
    if (order.amount < plan.executableAmount) staleReasons.push("order amount lower");
    if (Number(order.price) !== Number(plan.selectedOrderPrice)) {
      staleReasons.push("order price changed");
    }
  }

  const room = getOwnedRoom(plan.roomName);
  if (!room || !terminalUsable(room)) {
    blockedReasons.push("terminal unavailable");
  } else {
    const currentEnergy = amountIn(room.terminal.store, RESOURCE_ENERGY);
    const cooldown = room.terminal.cooldown || 0;

    if (cooldown > 0) {
      blockedReasons.push("terminal cooldown");
      categories.push("cooldown-blocked");
    }

    if (order) {
      const checkAmount = Math.min(
        plan.executableAmount > 0 ? plan.executableAmount : plan.requestedAmount,
        order.amount,
      );
      const energyCost = Game.market.calcTransactionCost(
        checkAmount,
        room.name,
        order.roomName,
      );

      if (currentEnergy < energyCost) {
        blockedReasons.push("terminal energy too low");
      }
    }
  }

  if (room && terminalUsable(room) && plan.type === "sell") {
    const currentResource = amountIn(room.terminal.store, plan.resourceType);
    const checkAmount = order
      ? Math.min(plan.executableAmount > 0 ? plan.executableAmount : plan.requestedAmount, order.amount)
      : plan.executableAmount;
    if (currentResource < checkAmount) {
      blockedReasons.push("terminal resource too low");
      categories.push("insufficient-resource");
    }
  } else if (room && terminalUsable(room) && plan.type === "buy") {
    const currentFree = terminalFreeCapacity(room);
    const checkAmount = order
      ? Math.min(plan.executableAmount > 0 ? plan.executableAmount : plan.requestedAmount, order.amount)
      : plan.executableAmount;
    if (currentFree < checkAmount) {
      blockedReasons.push("terminal capacity too low");
    }

    if (order && Game.market.credits < checkAmount * order.price) {
      blockedReasons.push("credits too low");
      categories.push("unaffordable-buy");
    }
  }

  const uniqueStale = uniqueReasons(staleReasons);
  const uniqueBlocked = uniqueReasons(blockedReasons);
  const uniqueCategories = uniqueReasons(categories);
  const status = uniqueStale.length ? "stale" : uniqueBlocked.length ? "blocked" : "ready";

  return {
    status,
    staleReasons: uniqueStale,
    blockedReasons: uniqueBlocked,
    categories: uniqueCategories,
    statusChanged: plan.status !== status,
  };
}

function plan(planId) {
  const saved = getPlanStore()[planId];
  if (!saved) return printLine(`${CONFIG.logPrefix} Plan not found: ${planId}`);

  const staleReasons = recheckPlan(saved);
  return formatPlanReport(saved, staleReasons);
}

function planReview(planId) {
  const saved = getPlanStore()[planId];
  if (!saved) return printLine(`${CONFIG.logPrefix} Plan not found: ${planId}`);

  const review = reviewPlanState(saved);
  if (review.statusChanged) {
    saved.status = review.status;
    saved.updatedAt = Game.time;
  }

  const lines = [
    `${CONFIG.logPrefix} Plan Review ${planId}: ${review.status.toUpperCase()}`,
    `  type ${saved.type}`,
    `  resource ${saved.resourceType}`,
    `  room ${saved.roomName}`,
    `  order ${saved.selectedOrderId || "none"}`,
    `  executable ${fmt(saved.executableAmount)}/${fmt(saved.requestedAmount)}`,
  ];

  if (review.status === "ready") {
    lines.push("  Plan still executable.");
  }
  if (review.staleReasons.length) {
    lines.push(`  stale ${review.staleReasons.join(", ")}`);
  }
  if (review.blockedReasons.length) {
    lines.push(`  blocked ${review.blockedReasons.join(", ")}`);
  }

  return printBlock(lines);
}

function executionStatus() {
  return printBlock([
    `${CONFIG.logPrefix} Execution Status`,
    "  Engine: MANUAL_APPROVAL_GATED",
    "  Game.market.deal: available only through market.executePlan(planId)",
    "  Actual Deal Execution: manual only",
    "  Dry Run: available",
    "  Limits: available",
    "  History: available",
    "  Automation: none",
    "  Next: review market.executionDryRun(planId), then market.executePlan(planId)",
  ]);
}

function executionLimits() {
  const limits = getExecutionLimitStore();
  const lines = [
    `${CONFIG.logPrefix} Execution Limits`,
    "  defaults:",
  ];

  for (const name of EXECUTION_LIMIT_NAMES) {
    lines.push(`    ${name}: ${formatLimitValue(DEFAULT_EXECUTION_LIMITS[name])}`);
  }

  lines.push("  current:");
  for (const name of EXECUTION_LIMIT_NAMES) {
    lines.push(`    ${name}: ${formatLimitValue(limits[name])}`);
  }

  return printBlock(lines);
}

function formatLimitValue(value) {
  if (value === null) return "unlimited";
  return Number.isInteger(value) ? fmt(value) : String(value);
}

function parseExecutionLimitValue(name, value) {
  if (name === "maxBuyEffectivePrice" && value === "null") return { ok: true, value: null };
  if (name === "maxBuyEffectivePrice" && value === null) return { ok: true, value: null };

  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return { ok: false, message: `invalid value for ${name}: ${value}` };
  }

  return { ok: true, value: numeric };
}

function setExecutionLimit(name, value) {
  if (EXECUTION_LIMIT_NAMES.indexOf(name) === -1) {
    return printLine(`${CONFIG.logPrefix} Invalid execution limit: ${name}`);
  }

  const parsed = parseExecutionLimitValue(name, value);
  if (!parsed.ok) return printLine(`${CONFIG.logPrefix} ${parsed.message}`);

  const limits = getExecutionLimitStore();
  limits[name] = parsed.value;

  return printLine(`${CONFIG.logPrefix} Execution limit ${name} set to ${formatLimitValue(parsed.value)}.`);
}

function clearExecutionLimit(name) {
  if (EXECUTION_LIMIT_NAMES.indexOf(name) === -1) {
    return printLine(`${CONFIG.logPrefix} Invalid execution limit: ${name}`);
  }

  const limits = getExecutionLimitStore();
  limits[name] = DEFAULT_EXECUTION_LIMITS[name];

  return printLine(`${CONFIG.logPrefix} Execution limit ${name} reset to ${formatLimitValue(DEFAULT_EXECUTION_LIMITS[name])}.`);
}

function computeEffectivePrice(plan, order, amount, energyCost) {
  const energyPerUnit = amount > 0 ? energyCost / amount : 0;
  if (!order) return 0;
  if (plan.type === "buy") return order.price + energyPerUnit * CONFIG.energyCreditValue;
  return order.price - energyPerUnit * CONFIG.energyCreditValue;
}

function preflightExecution(planId) {
  const limits = getExecutionLimitStore();
  const plans = getPlanStore();
  const plan = plans[planId];
  const blockers = [];
  const staleReasons = [];
  const limitBlockers = [];
  let room = null;
  let terminal = null;
  let order = null;
  let plannedAmount = 0;
  let finalAmount = 0;
  let estimatedEnergy = 0;
  let estimatedCredits = 0;
  let effectivePrice = 0;

  if (!plan) {
    blockers.push("plan missing");
    return {
      plan: null,
      status: "BLOCKED",
      blockers,
      staleReasons,
      limitBlockers,
      plannedAmount,
      finalAmount,
      estimatedEnergy,
      estimatedCredits,
      effectivePrice,
      order,
    };
  }

  plannedAmount = Math.max(
    0,
    Math.floor(plan.executableAmount > 0 ? plan.executableAmount : plan.requestedAmount || 0),
  );

  if (plan.status === "deleted") blockers.push("plan deleted");
  if (plan.type !== "sell" && plan.type !== "buy") blockers.push("invalid plan type");

  room = getOwnedRoom(plan.roomName);
  if (!room) {
    blockers.push("room unavailable or not owned");
  } else if (!terminalUsable(room)) {
    blockers.push("terminal unavailable");
  } else {
    terminal = room.terminal;
    if ((terminal.cooldown || 0) !== 0) blockers.push("terminal cooldown");
  }

  order = findSelectedOrder(plan);
  if (!plan.selectedOrderId || !order) {
    staleReasons.push("order missing");
  } else if (plan.type === "sell" && order.type !== ORDER_BUY) {
    staleReasons.push("selected order is not buy");
  } else if (plan.type === "buy" && order.type !== ORDER_SELL) {
    staleReasons.push("selected order is not sell");
  }

  if (plan.type === "sell" && terminal) {
    const available = amountIn(terminal.store, plan.resourceType);
    if (available <= 0) blockers.push("terminal resource missing");
    plannedAmount = Math.min(plannedAmount, available);
  }

  if (plan.type === "buy" && terminal) {
    const freeCapacity = terminalFreeCapacity(room);
    if (freeCapacity <= 0) blockers.push("terminal capacity unavailable");
    plannedAmount = Math.min(plannedAmount, freeCapacity);
  }

  if (order) plannedAmount = Math.min(plannedAmount, order.amount || 0);
  plannedAmount = Math.max(0, Math.floor(plannedAmount));

  if (terminal && order && plannedAmount > 0) {
    const terminalEnergy = amountIn(terminal.store, RESOURCE_ENERGY);
    const energyReserve = Math.max(0, limits.minTerminalEnergyReserve || 0);
    const energyAvailableForDeal = Math.max(0, terminalEnergy - energyReserve);
    const maxByEnergy = maxAmountByTerminalEnergy(
      room.name,
      order.roomName,
      energyAvailableForDeal,
      plannedAmount,
    );

    if (maxByEnergy <= 0) blockers.push("terminal energy too low");
    if (energyReserve > 0 && maxByEnergy < plannedAmount) {
      limitBlockers.push("minTerminalEnergyReserve");
    }
    finalAmount = Math.min(plannedAmount, maxByEnergy);
  } else {
    finalAmount = plannedAmount;
  }

  if (plan.type === "sell") {
    finalAmount = Math.min(finalAmount, Math.max(0, Math.floor(limits.maxSellAmount || 0)));
    if (plannedAmount > (limits.maxSellAmount || 0)) limitBlockers.push("maxSellAmount");
  }

  if (plan.type === "buy") {
    finalAmount = Math.min(finalAmount, Math.max(0, Math.floor(limits.maxBuyAmount || 0)));
    if (plannedAmount > (limits.maxBuyAmount || 0)) limitBlockers.push("maxBuyAmount");

    if (order && order.price > 0) {
      const maxByCreditsLimit = Math.floor((limits.maxCreditsPerBuy || 0) / order.price);
      if (plannedAmount * order.price > (limits.maxCreditsPerBuy || 0)) limitBlockers.push("maxCreditsPerBuy");
      finalAmount = Math.min(finalAmount, maxByCreditsLimit);

      const maxByAccountCredits = Math.floor((Game.market.credits || 0) / order.price);
      if (maxByAccountCredits <= 0 || (plannedAmount > 0 && Game.market.credits < Math.min(plannedAmount, finalAmount || plannedAmount) * order.price)) {
        blockers.push("credits too low");
      }
      finalAmount = Math.min(finalAmount, maxByAccountCredits);
    }
  }

  finalAmount = Math.max(0, Math.floor(finalAmount));

  if (terminal && order && finalAmount > 0) {
    estimatedEnergy = Game.market.calcTransactionCost(
      finalAmount,
      room.name,
      order.roomName,
    );
    estimatedCredits = finalAmount * order.price;
    effectivePrice = computeEffectivePrice(plan, order, finalAmount, estimatedEnergy);

    const terminalEnergy = amountIn(terminal.store, RESOURCE_ENERGY);
    if (terminalEnergy - estimatedEnergy < (limits.minTerminalEnergyReserve || 0)) {
      limitBlockers.push("minTerminalEnergyReserve");
    }

    if (plan.type === "sell" && effectivePrice < (limits.minSellEffectivePrice || 0)) {
      limitBlockers.push("minSellEffectivePrice");
    }

    if (
      plan.type === "buy" &&
      limits.maxBuyEffectivePrice !== null &&
      effectivePrice > limits.maxBuyEffectivePrice
    ) {
      limitBlockers.push("maxBuyEffectivePrice");
    }
  }

  if (finalAmount <= 0 && staleReasons.length === 0) {
    blockers.push("final executable amount zero");
  }

  const uniqueStale = uniqueReasons(staleReasons);
  const uniqueBlockers = uniqueReasons(blockers);
  const uniqueLimitBlockers = uniqueReasons(limitBlockers);
  const status = uniqueStale.length
    ? "STALE"
    : uniqueLimitBlockers.length
      ? "LIMIT_BLOCKED"
      : uniqueBlockers.length
        ? "BLOCKED"
        : "READY";

  return {
    plan,
    status,
    blockers: uniqueBlockers,
    staleReasons: uniqueStale,
    limitBlockers: uniqueLimitBlockers,
    plannedAmount,
    finalAmount,
    estimatedEnergy,
    estimatedCredits,
    effectivePrice,
    order,
  };
}

function executionDryRun(planId) {
  const result = preflightExecution(planId);
  const plan = result.plan;
  const lines = [
    `${CONFIG.logPrefix} Execution Dry Run ${planId}: ${result.status}`,
  ];

  if (!plan) {
    lines.push("  blockers plan missing");
    lines.push("  No execution performed.");
    return printBlock(lines);
  }

  lines.push(`  plan id ${plan.id}`);
  lines.push(`  type ${plan.type}`);
  lines.push(`  resource ${plan.resourceType}`);
  lines.push(`  room ${plan.roomName}`);
  lines.push(`  requested amount ${fmt(plan.requestedAmount)}`);
  lines.push(`  planned executable amount ${fmt(result.plannedAmount)}`);
  lines.push(`  final executable amount ${fmt(result.finalAmount)}`);
  lines.push(`  selected order ${result.order ? result.order.id : plan.selectedOrderId || "none"}`);
  lines.push(`  price ${result.order ? Number(result.order.price).toFixed(4) : "n/a"}`);
  lines.push(`  effective price ${result.order && result.finalAmount > 0 ? Number(result.effectivePrice).toFixed(4) : "n/a"}`);
  lines.push(`  estimated credits ${fmt(result.estimatedCredits)}`);
  lines.push(`  estimated transaction energy ${fmt(result.estimatedEnergy)}`);
  lines.push(`  status ${result.status}`);
  lines.push(`  blockers ${result.blockers.length ? result.blockers.join(", ") : "none"}`);
  if (result.staleReasons.length) lines.push(`  stale ${result.staleReasons.join(", ")}`);
  lines.push(`  limit blockers ${result.limitBlockers.length ? result.limitBlockers.join(", ") : "none"}`);
  lines.push("  No execution performed.");

  return printBlock(lines);
}

function resultLabel(code) {
  const labels = {};
  labels[OK] = "OK";
  labels[ERR_NOT_OWNER] = "ERR_NOT_OWNER";
  labels[ERR_NO_PATH] = "ERR_NO_PATH";
  labels[ERR_NAME_EXISTS] = "ERR_NAME_EXISTS";
  labels[ERR_BUSY] = "ERR_BUSY";
  labels[ERR_NOT_FOUND] = "ERR_NOT_FOUND";
  labels[ERR_NOT_ENOUGH_RESOURCES] = "ERR_NOT_ENOUGH_RESOURCES";
  labels[ERR_INVALID_TARGET] = "ERR_INVALID_TARGET";
  labels[ERR_FULL] = "ERR_FULL";
  labels[ERR_NOT_IN_RANGE] = "ERR_NOT_IN_RANGE";
  labels[ERR_INVALID_ARGS] = "ERR_INVALID_ARGS";
  labels[ERR_TIRED] = "ERR_TIRED";
  labels[ERR_NO_BODYPART] = "ERR_NO_BODYPART";
  labels[ERR_RCL_NOT_ENOUGH] = "ERR_RCL_NOT_ENOUGH";

  if (code === null || code === undefined) return "NO_DEAL";
  return labels[code] || `RESULT_${code}`;
}

function executionStatusFromPreflight(status) {
  if (status === "STALE") return "stale";
  if (status === "LIMIT_BLOCKED") return "limit_blocked";
  return "blocked";
}

function executionReason(result, dealResult) {
  if (dealResult !== OK && dealResult !== null && dealResult !== undefined) {
    return resultLabel(dealResult);
  }
  if (result.staleReasons && result.staleReasons.length) {
    return result.staleReasons.join(", ");
  }
  if (result.limitBlockers && result.limitBlockers.length) {
    return result.limitBlockers.join(", ");
  }
  if (result.blockers && result.blockers.length) {
    return result.blockers.join(", ");
  }
  return "none";
}

function appendExecutionHistory(entry) {
  const history = getHistoryStore();
  history.push(entry);
  trimHistoryToLimit();

  return entry;
}

function updatePlanExecutionFields(plan, entry) {
  if (!plan) return;

  plan.executionStatus = entry.status;
  plan.executionReason = entry.reason;
  plan.executedAt = entry.executedAt;
  plan.executedAmount = entry.executedAmount;
  plan.requestedAmount = entry.requestedAmount;
  plan.plannedExecutableAmount = entry.plannedExecutableAmount;
  plan.finalExecutableAmount = entry.finalExecutableAmount;
  plan.finalOrderId = entry.orderId;
  plan.finalPrice = entry.price;
  plan.creditsDelta = entry.creditsDelta;
  plan.energyCost = entry.energyCost;
  plan.resultCode = entry.resultCode;
  plan.resultLabel = entry.resultLabel;
  plan.updatedAt = Game.time;
}

function buildExecutionEntry(planId, result, status, dealResult) {
  const plan = result.plan;
  const order = result.order;
  const executedAmount = dealResult === OK ? result.finalAmount : 0;
  const type = plan ? plan.type : null;
  const credits = result.estimatedCredits || 0;
  const creditsDelta = type === "buy" ? -credits : credits;

  return {
    id: `mx_${Game.time}_${getHistoryStore().length + 1}`,
    planId,
    type,
    roomName: plan ? plan.roomName : null,
    resourceType: plan ? plan.resourceType : null,
    requestedAmount: plan ? plan.requestedAmount || 0 : 0,
    plannedExecutableAmount: result.plannedAmount || 0,
    finalExecutableAmount: result.finalAmount || 0,
    executedAmount,
    orderId: order ? order.id : plan && plan.selectedOrderId ? plan.selectedOrderId : null,
    price: order ? order.price : 0,
    effectivePrice: result.effectivePrice || 0,
    creditsDelta,
    energyCost: result.estimatedEnergy || 0,
    resultCode: dealResult === undefined ? null : dealResult,
    resultLabel: resultLabel(dealResult),
    status,
    reason: executionReason(result, dealResult),
    blockers: uniqueReasons(
      (result.blockers || [])
        .concat(result.staleReasons || [])
        .concat(result.limitBlockers || []),
    ),
    createdAt: Game.time,
    executedAt: Game.time,
  };
}

function formatExecutionReport(entry) {
  const lines = [
    `${CONFIG.logPrefix} Execute Plan ${entry.planId}: ${entry.status.toUpperCase()}`,
    `  plan id ${entry.planId}`,
    `  status ${entry.status}`,
    `  type ${entry.type || "n/a"}`,
    `  room ${entry.roomName || "n/a"}`,
    `  resource ${entry.resourceType || "n/a"}`,
    `  requested amount ${fmt(entry.requestedAmount)}`,
    `  planned executable amount ${fmt(entry.plannedExecutableAmount)}`,
    `  final executable amount ${fmt(entry.finalExecutableAmount)}`,
    `  executed amount ${fmt(entry.executedAmount)}`,
    `  order id ${entry.orderId || "none"}`,
    `  price ${entry.price ? Number(entry.price).toFixed(4) : "n/a"}`,
    `  credits delta ${fmt(entry.creditsDelta)}`,
    `  energy cost ${fmt(entry.energyCost)}`,
    `  result ${entry.resultCode === null ? "n/a" : entry.resultCode}/${entry.resultLabel}`,
  ];

  if (entry.status !== "executed" && entry.status !== "partial") {
    lines.push(`  reason ${entry.reason || "none"}`);
    lines.push(`  blockers ${entry.blockers.length ? entry.blockers.join(", ") : "none"}`);
  }

  return printBlock(lines);
}

function executePlan(planId) {
  const preflight = preflightExecution(planId);

  if (preflight.status !== "READY") {
    const blockedStatus = executionStatusFromPreflight(preflight.status);
    const blockedEntry = buildExecutionEntry(planId, preflight, blockedStatus, null);
    appendExecutionHistory(blockedEntry);
    updatePlanExecutionFields(preflight.plan, blockedEntry);
    return formatExecutionReport(blockedEntry);
  }

  const dealResult = Game.market.deal(
    preflight.order.id,
    preflight.finalAmount,
    preflight.plan.roomName,
  );
  const executedAmount = dealResult === OK ? preflight.finalAmount : 0;
  let status = "failed";

  if (dealResult === OK) {
    status =
      executedAmount >= preflight.plan.requestedAmount ||
      preflight.finalAmount >= preflight.plan.requestedAmount
        ? "executed"
        : "partial";
  }

  const entry = buildExecutionEntry(planId, preflight, status, dealResult);
  appendExecutionHistory(entry);
  updatePlanExecutionFields(preflight.plan, entry);

  return formatExecutionReport(entry);
}

function history(filter) {
  const input = typeof filter === "string" ? filter.trim() : "";
  const lower = input.toLowerCase();
  const includeAll = lower === "all" || lower === "history";
  let rows = getHistoryStore().slice();
  let label = includeAll ? "all" : "recent";

  if (input && !includeAll) {
    const ownedRoom = getOwnedRoom(input);
    if (ownedRoom) {
      rows = rows.filter((entry) => entry.roomName === ownedRoom.name);
      label = ownedRoom.name;
    } else {
      rows = rows.filter((entry) => entry.resourceType === input);
      label = input;
    }
  }

  rows.sort((a, b) => (b.executedAt || b.createdAt || 0) - (a.executedAt || a.createdAt || 0));
  const limit = includeAll ? 50 : CONFIG.intelligenceLimit;
  const shown = rows.slice(0, limit);
  const lines = [
    `${CONFIG.logPrefix} Execution History (${label})` +
      ` | showing ${fmt(shown.length)}/${fmt(rows.length)}:`,
  ];

  if (!shown.length) {
    lines.push("  none");
    return printBlock(lines);
  }

  for (const entry of shown) {
    lines.push(
      `  ${entry.id} | ${entry.status}` +
        ` | ${entry.type}` +
        ` | ${entry.resourceType}` +
        ` | ${entry.roomName}` +
        ` | executed ${fmt(entry.executedAmount)}/${fmt(entry.requestedAmount)}` +
        ` | order ${entry.orderId || "none"}` +
        ` | result ${entry.resultLabel}` +
        ` | tick ${entry.executedAt}`,
    );
  }

  return printBlock(lines);
}

function historySummary() {
  const rows = getHistoryStore();
  const counts = {
    executed: 0,
    partial: 0,
    failed: 0,
    blocked: 0,
    stale: 0,
    limit_blocked: 0,
  };
  let creditsGained = 0;
  let creditsSpent = 0;
  let energySpent = 0;

  for (const entry of rows) {
    if (Object.prototype.hasOwnProperty.call(counts, entry.status)) {
      counts[entry.status] += 1;
    }

    if (entry.status === "executed" || entry.status === "partial") {
      const credits = Number(entry.creditsDelta) || 0;
      if (credits > 0) creditsGained += credits;
      if (credits < 0) creditsSpent += Math.abs(credits);
      energySpent += Number(entry.energyCost) || 0;
    }
  }

  return printBlock([
    `${CONFIG.logPrefix} History Summary`,
    "",
    `Entries: ${fmt(rows.length)}`,
    "",
    `Executed: ${fmt(counts.executed)}`,
    `Partial: ${fmt(counts.partial)}`,
    `Failed: ${fmt(counts.failed)}`,
    `Blocked: ${fmt(counts.blocked)}`,
    `Stale: ${fmt(counts.stale)}`,
    `Limit Blocked: ${fmt(counts.limit_blocked)}`,
    "",
    `Credits Gained: ${fmt(creditsGained)}`,
    `Credits Spent: ${fmt(creditsSpent)}`,
    `Energy Spent: ${fmt(energySpent)}`,
  ]);
}

function incrementCount(map, key) {
  if (!key) return;
  map[key] = (map[key] || 0) + 1;
}

function sortedRepeatedRows(map) {
  return Object.keys(map)
    .filter((key) => map[key] > 1)
    .sort((a, b) => {
      if (map[b] !== map[a]) return map[b] - map[a];
      return a.localeCompare(b);
    })
    .slice(0, CONFIG.intelligenceLimit);
}

function pushAuditList(lines, title, map) {
  const rows = sortedRepeatedRows(map);
  lines.push("");
  lines.push(`${title}:`);

  if (!rows.length) {
    lines.push("  none");
    return;
  }

  for (const key of rows) {
    lines.push(`  ${key} (${fmt(map[key])})`);
  }
}

function historyAudit() {
  const rows = getHistoryStore();
  const failures = {};
  const stale = {};
  const limitBlocks = {};
  const blocked = {};
  const resources = {};
  const rooms = {};
  let healthy = 0;

  for (const entry of rows) {
    const descriptor = [
      entry.roomName || "unknown",
      entry.resourceType || "unknown",
      entry.type || "plan",
    ].join(" ");
    const blockers = entry.blockers && entry.blockers.length
      ? entry.blockers
      : entry.reason && entry.reason !== "none"
        ? [entry.reason]
        : ["unspecified"];

    if (entry.status === "failed") {
      incrementCount(failures, `${entry.resourceType || "unknown"} ${entry.type || "plan"} plan`);
    }
    if (entry.status === "stale") {
      incrementCount(stale, descriptor);
    }
    if (entry.status === "limit_blocked") {
      for (const blocker of blockers) incrementCount(limitBlocks, blocker);
    }
    if (entry.status === "blocked") {
      for (const blocker of blockers) incrementCount(blocked, blocker);
    }
    if (entry.status === "executed" || entry.status === "partial") {
      healthy += 1;
      incrementCount(resources, entry.resourceType || "unknown");
      incrementCount(rooms, entry.roomName || "unknown");
    }
  }

  const lines = [`${CONFIG.logPrefix} History Audit`];
  pushAuditList(lines, "Repeated Failures", failures);
  pushAuditList(lines, "Repeated Limit Blocks", limitBlocks);
  pushAuditList(lines, "Repeated Stale Plans", stale);
  pushAuditList(lines, "Repeated Blocked Executions", blocked);
  pushAuditList(lines, "Top Traded Resources", resources);
  pushAuditList(lines, "Most Active Rooms", rooms);
  lines.push("");
  lines.push(`Healthy Executions: ${fmt(healthy)}`);

  return printBlock(lines);
}

function clearHistory(mode) {
  const input = typeof mode === "string" ? mode.trim().toLowerCase() : "";
  const supported = ["failed", "blocked", "stale", "deleted", "all"];

  if (supported.indexOf(input) === -1) {
    return printLine(`${CONFIG.logPrefix} Invalid history clear mode: ${mode}`);
  }

  const history = getHistoryStore();
  const plans = getPlanStore();
  const before = history.length;

  if (input === "all") {
    history.splice(0, history.length);
  } else {
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      const deletedPlan =
        entry.planId &&
        plans[entry.planId] &&
        plans[entry.planId].status === "deleted";
      const remove =
        (input === "failed" && entry.status === "failed") ||
        (input === "blocked" && (entry.status === "blocked" || entry.status === "limit_blocked")) ||
        (input === "stale" && entry.status === "stale") ||
        (input === "deleted" && deletedPlan);

      if (remove) history.splice(i, 1);
    }
  }

  return printLine(`${CONFIG.logPrefix} History entries removed: ${fmt(before - history.length)}.`);
}

function setHistoryLimit(limit) {
  const parsed = Math.floor(Number(limit));

  if (!Number.isFinite(parsed) || parsed < MIN_HISTORY_LIMIT) {
    return printLine(`${CONFIG.logPrefix} Invalid history limit: ${limit}. Minimum is ${MIN_HISTORY_LIMIT}.`);
  }

  const memory = getMemoryRoot();
  memory.historyLimit = parsed;
  trimHistoryToLimit();

  return printLine(`${CONFIG.logPrefix} History limit set to ${fmt(parsed)}.`);
}

function historyLimit() {
  return printLine(`${CONFIG.logPrefix} History Limit: ${fmt(getHistoryLimitValue())}`);
}

function clearPlan(planId) {
  if (planId === "all") {
    const planRows = activePlanRows();
    for (const saved of planRows) {
      saved.status = "deleted";
      saved.deletedAt = Game.time;
      saved.updatedAt = Game.time;
    }

    return printLine(`${CONFIG.logPrefix} ${fmt(planRows.length)} plans deleted.`);
  }

  const saved = getPlanStore()[planId];
  if (!saved) return printLine(`${CONFIG.logPrefix} Plan not found: ${planId}`);

  saved.status = "deleted";
  saved.deletedAt = Game.time;
  saved.updatedAt = Game.time;

  return printLine(`${CONFIG.logPrefix} Plan ${planId} deleted.`);
}

function deletePlan(planId) {
  console.log(`${CONFIG.logPrefix} deletePlan() is deprecated. Use market.clearPlan().`);
  return clearPlan(planId);
}

function removePlan(planId) {
  console.log(`${CONFIG.logPrefix} removePlan() is deprecated. Use market.clearPlan().`);
  return clearPlan(planId);
}

function clearPlans() {
  console.log(`${CONFIG.logPrefix} clearPlans() is deprecated. Use market.clearPlan("all").`);
  return clearPlan("all");
}

function planSummary() {
  const rows = Object.values(getPlanStore());
  const counts = {
    ready: 0,
    blocked: 0,
    stale: 0,
    deleted: 0,
    buy: 0,
    sell: 0,
  };

  for (const saved of rows) {
    if (saved.status === "deleted") {
      counts.deleted += 1;
      continue;
    }

    const review = reviewPlanState(saved);
    if (review.statusChanged) {
      saved.status = review.status;
      saved.updatedAt = Game.time;
    }

    counts[review.status] = (counts[review.status] || 0) + 1;
    if (saved.type === "buy") counts.buy += 1;
    if (saved.type === "sell") counts.sell += 1;
  }

  return printBlock([
    `${CONFIG.logPrefix} Plan Summary`,
    "",
    `Ready: ${fmt(counts.ready)}`,
    `Blocked: ${fmt(counts.blocked)}`,
    `Stale: ${fmt(counts.stale)}`,
    `Deleted: ${fmt(counts.deleted)}`,
    "",
    `Buy Plans: ${fmt(counts.buy)}`,
    `Sell Plans: ${fmt(counts.sell)}`,
  ]);
}

function duplicatePlanPairs(rows) {
  const byKey = {};
  const pairs = [];

  for (const saved of rows) {
    if (!saved.selectedOrderId) continue;

    const key = [
      saved.type,
      saved.roomName,
      saved.resourceType,
      saved.selectedOrderId,
    ].join("|");

    if (byKey[key]) {
      pairs.push([byKey[key].id, saved.id]);
    } else {
      byKey[key] = saved;
    }
  }

  return pairs;
}

function planAudit() {
  const rows = activePlanRows();
  const ready = [];
  const stale = [];
  const blocked = [];
  const missingOrder = [];
  const unaffordableBuy = [];
  const insufficientResource = [];
  const cooldownBlocked = [];

  for (const saved of rows) {
    const review = reviewPlanState(saved);
    if (review.statusChanged) {
      saved.status = review.status;
      saved.updatedAt = Game.time;
    }

    if (review.status === "ready") ready.push(saved.id);
    if (review.status === "stale") stale.push(saved.id);
    if (review.status === "blocked") {
      blocked.push({
        id: saved.id,
        reason: review.blockedReasons[0] || "blocked",
      });
    }
    if (review.categories.indexOf("missing-order") !== -1) missingOrder.push(saved.id);
    if (review.categories.indexOf("unaffordable-buy") !== -1) unaffordableBuy.push(saved.id);
    if (review.categories.indexOf("insufficient-resource") !== -1) insufficientResource.push(saved.id);
    if (review.categories.indexOf("cooldown-blocked") !== -1) cooldownBlocked.push(saved.id);
  }

  const duplicates = duplicatePlanPairs(rows).slice(0, CONFIG.intelligenceLimit);
  const lines = [`${CONFIG.logPrefix} Plan Audit`];
  const pushList = function (title, values, formatter) {
    if (!values.length) return;
    lines.push("");
    lines.push(`${title}:`);
    for (const value of values.slice(0, CONFIG.intelligenceLimit)) {
      lines.push(`  ${formatter ? formatter(value) : value}`);
    }
  };

  pushList("STALE", stale);
  pushList("BLOCKED", blocked, (row) => `${row.id} (${row.reason})`);
  pushList("DUPLICATES", duplicates, (pair) => `${pair[0]} and ${pair[1]}`);
  pushList("MISSING ORDER", missingOrder);
  pushList("UNAFFORDABLE BUY", unaffordableBuy);
  pushList("INSUFFICIENT RESOURCE SELL", insufficientResource);
  pushList("COOLDOWN BLOCKED", cooldownBlocked);

  lines.push("");
  lines.push(`READY: ${fmt(ready.length)} plans`);

  return printBlock(lines);
}

function bestOwnedRoomForBuy(amount, order) {
  let best = null;

  for (const room of ownedRooms()) {
    if (!terminalUsable(room)) continue;

    const sampleAmount = Math.min(amount, order.amount || amount);
    const energyCost = Game.market.calcTransactionCost(
      sampleAmount,
      room.name,
      order.roomName,
    );

    if (terminalFreeCapacity(room) < sampleAmount) continue;
    if (amountIn(room.terminal.store, RESOURCE_ENERGY) < energyCost) continue;

    if (!best || energyCost < best.energyCost) {
      best = {
        room,
        energyCost,
      };
    }
  }

  return best;
}

function help() {
  return printBlock(formatHelpGroups("[MARKET] Screeps Market Console Commands", [
    {
      title: "Runtime",
      commands: [
        "market.help()",
        "market.info()",
        "market.ping()",
        "market.install()",
        "market.restore()",
        "market.uninstall()",
      ],
    },
    {
      title: "Visibility",
      commands: [
        "market.rooms()",
        "market.stock()",
        "market.stock(roomName)",
        "market.needs()",
        "market.surplus()",
      ],
    },
    {
      title: "Terminal Logistics",
      commands: [
        "market.stage(resource, amount, roomName)",
        "market.unstage(resource, amount, roomName)",
        "market.requests()",
        "market.requests(roomName)",
        'market.requests("all"|"history")',
        'market.requests(roomName, "all"|"history")',
        "market.cancel(requestId)",
        "market.send(resource, amount, fromRoom, toRoom)",
      ],
    },
    {
      title: "Market Scans",
      commands: [
        "market.buyOptions()",
        "market.buyOptions(resource)",
        "market.sellOptions()",
        "market.sellOptions(resource)",
      ],
    },
    {
      title: "Intelligence",
      commands: [
        "market.readiness()",
        "market.readiness(roomName)",
        "market.readiness(resource)",
        "market.opportunities()",
        "market.opportunities(resource)",
        "market.recommendations()",
      ],
    },
    {
      title: "Dry-Run Plans",
      commands: [
        "market.planSell(resource, amount, roomName)",
        "market.planBuy(resource, amount, roomName)",
        "market.plans()",
        'market.plans("all"|"history")',
        "market.plan(planId)",
        "market.planSummary()",
        "market.planReview(planId)",
        "market.planAudit()",
        "market.clearPlan(planId)",
        'market.clearPlan("all")',
        "market.deletePlan(planId) [deprecated: use market.clearPlan(planId)]",
        "market.removePlan(planId) [deprecated: use market.clearPlan(planId)]",
        'market.clearPlans() [deprecated: use market.clearPlan("all")]',
      ],
    },
    {
      title: "Approval-Gated Execution",
      commands: [
        "market.executionStatus()",
        "market.executionDryRun(planId)",
        "market.executionLimits()",
        "market.setExecutionLimit(name, value)",
        "market.clearExecutionLimit(name)",
        "market.limits()",
        "market.setLimit(name, value)",
        "market.clearLimit(name)",
        "market.executePlan(planId)",
        "market.execute(planId) [alias: market.executePlan(planId)]",
        "market.history()",
        "market.history(resource)",
        "market.history(roomName)",
        'market.history("all")',
        "market.historySummary()",
        "market.historyAudit()",
        "market.clearHistory(mode)",
        "market.setHistoryLimit(limit)",
        "market.historyLimit()",
      ],
    },
    {
      title: "Manual Trading",
      commands: [
        "market.buy(resource, amount, roomName)",
        "market.sell(resource, amount, roomName)",
      ],
    },
    {
      title: "Legacy Planning",
      commands: [
        "market.planBuys()",
        "market.planSells()",
      ],
    },
  ]));
}

function info() {
  const memory = touchMemory();

  const lines = [
    "[MARKET] Helper info:",
    `  runtime object: ${global.market ? "loaded" : "missing"}`,
    "  memory object: exists",
    `  version: ${memory.version || "unknown"}`,
    `  mode: ${memory.mode || "unknown"}`,
    `  installedAt: ${memory.installedAt || "unknown"}`,
    `  lastRegisteredAt: ${memory.lastRegisteredAt || "unknown"}`,
    `  Game.time: ${Game.time}`,
    "  command root: market.xxx",
  ];

  printBlock(lines);

  return {
    runtimeLoaded: !!global.market,
    memory,
    lines,
  };
}

function ping() {
  return printLine(`[MARKET] pong at Game.time ${Game.time}`);
}

function install() {
  const memory = touchMemory();
  memory.installedAt = Game.time;
  memory.uninstalled = false;

  registerGlobals();

  return printLine("[MARKET] installed and registered as market.xxx");
}

function restore() {
  const memory = touchMemory();
  memory.uninstalled = false;

  registerGlobals();

  return printLine("[MARKET] restored as market.xxx");
}

function uninstall() {
  const memory = getMemoryRoot();
  memory.uninstalled = true;
  memory.uninstalledAt = Game.time;

  delete global.market;

  return printLine(
    "[MARKET] uninstalled from runtime. Source module remains available next upload.",
  );
}

function rooms() {
  const lines = ["[MARKET] Owned rooms:"];

  for (const room of ownedRooms()) {
    lines.push(
      `  ${room.name} | RCL ${room.controller.level}` +
        ` | storage: ${room.storage ? "yes" : "no"}` +
        ` | terminal: ${room.terminal ? "yes" : "no"}` +
        (room.terminal ? ` | cooldown: ${room.terminal.cooldown}` : ""),
    );
  }

  if (lines.length === 1) lines.push("  none visible");

  return printBlock(lines);
}

function stock(roomName) {
  if (roomName) {
    const room = getOwnedRoom(roomName);

    if (!room) {
      return printLine(`${CONFIG.logPrefix} Invalid owned room: ${roomName}`);
    }

    const lines = [`[MARKET] Stock for ${room.name}:`];

    for (const label of ["storage", "terminal"]) {
      const structure = room[label];

      lines.push("");
      lines.push(`  ${label}: ${structure ? "" : "missing"}`);

      if (!structure) continue;

      const resources = storeResources(structure.store);

      if (!resources.length) {
        lines.push("    empty");
      }

      for (const resource of resources) {
        lines.push(
          `    ${resource}: ${fmt(amountIn(structure.store, resource))}`,
        );
      }
    }

    return printBlock(lines);
  }

  const totals = empireTotals();
  const resources = Object.keys(totals).sort();
  const lines = ["[MARKET] Empire stock:"];

  if (!resources.length) lines.push("  empty");

  for (const resource of resources) {
    lines.push(`  ${resource}: ${fmt(totals[resource])}`);
  }

  return printBlock(lines);
}

function needs() {
  const lines = ["[MARKET] Empire needs:"];

  for (const room of ownedRooms()) {
    const roomNeeds = [];

    if (room.terminal) {
      const terminalEnergy = amountIn(room.terminal.store, RESOURCE_ENERGY);

      if (terminalEnergy < CONFIG.terminalEnergyTarget) {
        roomNeeds.push(
          `terminal energy +${fmt(CONFIG.terminalEnergyTarget - terminalEnergy)}`,
        );
      }
    } else {
      roomNeeds.push("terminal missing");
    }

    if (room.storage) {
      const storageEnergy = amountIn(room.storage.store, RESOURCE_ENERGY);

      if (storageEnergy < CONFIG.storageEnergyReserve) {
        roomNeeds.push(
          `storage energy +${fmt(CONFIG.storageEnergyReserve - storageEnergy)}`,
        );
      }
    } else {
      roomNeeds.push("storage missing");
    }

    const mineral = room.find(FIND_MINERALS)[0];

    if (mineral) {
      const total = roomResourceTotal(room, mineral.mineralType);

      if (total < CONFIG.mineralTarget) {
        roomNeeds.push(
          `${mineral.mineralType} +${fmt(CONFIG.mineralTarget - total)}`,
        );
      }
    }

    if (roomNeeds.length) {
      lines.push(`  ${room.name}: ${roomNeeds.join(", ")}`);
    }
  }

  if (lines.length === 1) lines.push("  no obvious room-level needs found");

  return printBlock(lines);
}

function surplus() {
  const lines = ["[MARKET] Empire surplus:"];

  for (const room of ownedRooms()) {
    const roomSurplus = [];

    if (room.terminal) {
      const terminalEnergy = amountIn(room.terminal.store, RESOURCE_ENERGY);

      if (terminalEnergy > CONFIG.terminalEnergyTarget) {
        roomSurplus.push(
          `terminal energy +${fmt(terminalEnergy - CONFIG.terminalEnergyTarget)}`,
        );
      }

      for (const resource of storeResources(room.terminal.store)) {
        if (resource === RESOURCE_ENERGY) continue;

        const amount = amountIn(room.terminal.store, resource);

        if (amount > CONFIG.mineralSurplus) {
          roomSurplus.push(
            `${resource} terminal +${fmt(amount - CONFIG.mineralSurplus)}`,
          );
        }
      }
    }

    if (room.storage) {
      for (const resource of storeResources(room.storage.store)) {
        if (resource === RESOURCE_ENERGY) continue;

        const total = roomResourceTotal(room, resource);

        if (total > CONFIG.mineralSurplus) {
          roomSurplus.push(
            `${resource} total +${fmt(total - CONFIG.mineralSurplus)}`,
          );
        }
      }
    }

    if (roomSurplus.length) {
      lines.push(`  ${room.name}: ${roomSurplus.join(", ")}`);
    }
  }

  if (lines.length === 1) lines.push("  no obvious surplus found");

  return printBlock(lines);
}

function stage(resource, amount, roomName) {
  const result = opsLogisticsManager.createMoveRequest(
    resource,
    amount,
    roomName,
    "storage",
    "terminal",
  );

  return printLine(result.message);
}

function unstage(resource, amount, roomName) {
  const result = opsLogisticsManager.createMoveRequest(
    resource,
    amount,
    roomName,
    "terminal",
    "storage",
  );

  return printLine(result.message);
}

function requests(roomName, mode) {
  const firstArg = typeof roomName === "string" ? roomName.trim().toLowerCase() : "";
  const secondArg = typeof mode === "string" ? mode.trim().toLowerCase() : "";
  const includeAll =
    firstArg === "all" ||
    firstArg === "history" ||
    secondArg === "all" ||
    secondArg === "history";
  const resolvedRoomName =
    firstArg === "all" || firstArg === "history" ? null : roomName;
  const allRows = opsLogisticsManager
    .listRequests(resolvedRoomName)
    .concat(marketRequestManager.listRequests(resolvedRoomName));
  const counts = {
    open: 0,
    blocked: 0,
    done: 0,
    canceled: 0,
    expired: 0,
  };

  for (let i = 0; i < allRows.length; i++) {
    const status = allRows[i].status || "open";
    if (Object.prototype.hasOwnProperty.call(counts, status)) {
      counts[status] += 1;
    }
  }

  const rows = includeAll
    ? allRows
    : allRows.filter((row) => row.status === "open" || row.status === "blocked");
  const lines = [
    (resolvedRoomName
      ? `[MARKET] Requests for ${resolvedRoomName}`
      : "[MARKET] Market-compatible logistics requests") +
      (includeAll ? " (all)" : " (active)") +
      ` | open ${counts.open}` +
      ` | blocked ${counts.blocked}` +
      ` | done ${counts.done}` +
      ` | canceled ${counts.canceled}` +
      ` | expired ${counts.expired}:`,
  ];

  if (!rows.length) {
    lines.push("  none");
    return printBlock(lines);
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const from = row.from || row.source || "storage";
    const to = row.to || row.target || "terminal";

    lines.push(
      `  ${row.id} | ${row.status} | ${row.roomName}` +
        ` | ${row.resourceType}` +
        ` | ${from} -> ${to}` +
        ` | remaining ${fmt(row.remaining)}/${fmt(row.amount)}` +
        ` | claimed ${fmt(row.claimed)}`,
    );
  }

  return printBlock(lines);
}

function cancel(requestId) {
  let result = opsLogisticsManager.cancelRequest(requestId);

  if (!result.ok) {
    result = marketRequestManager.cancelRequest(requestId);
  }

  return printLine(result.message);
}

function send(resource, amount, fromRoom, toRoom) {
  amount = Number(amount);

  const source = getOwnedRoom(fromRoom);
  const target = getOwnedRoom(toRoom);

  if (!source)
    return printLine(`${CONFIG.logPrefix} Invalid source room: ${fromRoom}`);
  if (!target)
    return printLine(`${CONFIG.logPrefix} Invalid target room: ${toRoom}`);
  if (!terminalUsable(source))
    return printLine(`${CONFIG.logPrefix} Source room has no usable terminal.`);
  if (!terminalUsable(target))
    return printLine(`${CONFIG.logPrefix} Target room has no usable terminal.`);
  if (!terminalReady(source))
    return printLine(
      `${CONFIG.logPrefix} Source terminal cooldown: ${source.terminal.cooldown}`,
    );
  if (!resource || !amount || amount <= 0)
    return printLine(`${CONFIG.logPrefix} Invalid resource or amount.`);

  if (amountIn(source.terminal.store, resource) < amount) {
    return printLine(
      `${CONFIG.logPrefix} Source terminal lacks ${resource}. Has ${fmt(amountIn(source.terminal.store, resource))}, needs ${fmt(amount)}.`,
    );
  }

  const energyCost = Game.market.calcTransactionCost(amount, fromRoom, toRoom);

  if (amountIn(source.terminal.store, RESOURCE_ENERGY) < energyCost) {
    return printLine(
      `${CONFIG.logPrefix} Not enough terminal energy. Needs ${fmt(energyCost)}.`,
    );
  }

  const result = source.terminal.send(
    resource,
    amount,
    toRoom,
    "market console helper transfer",
  );

  return printLine(
    `${CONFIG.logPrefix} send ${resource} x${fmt(amount)} ${fromRoom} -> ${toRoom}` +
      ` | energy cost ${fmt(energyCost)} | result ${result}`,
  );
}

function buyOptions(resource) {
  const resources = resource ? [resource] : resourceList();
  const lines = [
    resource
      ? `[MARKET] Buy options for ${resource}:`
      : "[MARKET] Buy options for scanned resources:",
  ];

  for (const res of resources) {
    const orders = Game.market
      .getAllOrders({
        type: ORDER_SELL,
        resourceType: res,
      })
      .filter((order) => order.amount > 0 && order.roomName);

    const scored = [];

    for (const order of orders) {
      const best = bestOwnedRoomForBuy(CONFIG.sampleAmount, order);
      if (!best) continue;

      const score = scoreBuyOrder(order, best.room.name, CONFIG.sampleAmount);

      scored.push({
        order,
        room: best.room,
        energyCost: score.energyCost,
        effectivePrice: score.effectivePrice,
      });
    }

    scored.sort((a, b) => a.effectivePrice - b.effectivePrice);

    const top = scored.slice(
      0,
      resource ? CONFIG.optionLimit : CONFIG.allOptionLimitPerResource,
    );

    if (resource && !top.length) {
      lines.push("  no usable buy options found");
    }

    if (!resource && top.length) {
      lines.push("");
      lines.push(`${res}:`);
    }

    for (const item of top) {
      lines.push(
        `  ${item.order.id} | ${res}` +
          ` | price ${item.order.price.toFixed(4)}` +
          ` | effective ${item.effectivePrice.toFixed(4)}` +
          ` | amount ${fmt(item.order.amount)}` +
          ` | receive ${item.room.name}` +
          ` | energy ${fmt(item.energyCost)}`,
      );
    }
  }

  return printBlock(lines);
}

function sellOptions(resource) {
  const resources = resource ? [resource] : resourceList();
  const lines = [
    resource
      ? `[MARKET] Sell options for ${resource}:`
      : "[MARKET] Sell options for scanned resources:",
  ];

  for (const res of resources) {
    const orders = Game.market
      .getAllOrders({
        type: ORDER_BUY,
        resourceType: res,
      })
      .filter((order) => order.amount > 0 && order.roomName);

    const scored = [];

    for (const room of ownedRooms()) {
      if (!terminalUsable(room)) continue;

      const available = amountIn(room.terminal.store, res);
      if (available <= 0) continue;

      for (const order of orders) {
        const sample = Math.min(CONFIG.sampleAmount, available, order.amount);
        if (sample <= 0) continue;

        const score = scoreSellOrder(order, room.name, sample);
        const terminalEnergy = amountIn(room.terminal.store, RESOURCE_ENERGY);
        const maxByEnergy = maxAmountByTerminalEnergy(
          room.name,
          order.roomName,
          terminalEnergy,
          Math.min(order.amount, available),
        );
        const maxNow = terminalReady(room)
          ? Math.min(order.amount, available, maxByEnergy)
          : 0;
        const blockedReasons = [];

        if (!terminalReady(room)) {
          blockedReasons.push(`cooldown ${room.terminal.cooldown}`);
        }
        if (terminalEnergy < score.energyCost) {
          blockedReasons.push(
            `energy short ${fmt(score.energyCost - terminalEnergy)}`,
          );
        }

        const ready = maxNow > 0 && blockedReasons.length === 0;

        scored.push({
          order,
          room,
          available,
          terminalEnergy,
          maxNow,
          blockedReasons,
          ready,
          energyCost: score.energyCost,
          effectivePrice: score.effectivePrice,
        });
      }
    }

    scored.sort((a, b) => {
      if (a.ready !== b.ready) return a.ready ? -1 : 1;
      return b.effectivePrice - a.effectivePrice;
    });

    const top = scored.slice(
      0,
      resource ? CONFIG.optionLimit : CONFIG.allOptionLimitPerResource,
    );

    if (resource && !top.length) {
      lines.push("  no sell options found");
    }

    if (!resource && top.length) {
      lines.push("");
      lines.push(`${res}:`);
    }

    for (const item of top) {
      lines.push(
        `  ${item.order.id} | ${res}` +
          ` | ${item.ready ? "ready" : "blocked"}` +
          ` | price ${item.order.price.toFixed(4)}` +
          ` | effective ${item.effectivePrice.toFixed(4)}` +
          ` | order amount ${fmt(item.order.amount)}` +
          ` | terminal amount ${fmt(item.available)}` +
          ` | maxNow ${fmt(item.maxNow)}` +
          ` | sell from ${item.room.name}` +
          ` | sample energy need ${fmt(item.energyCost)}` +
          ` | terminal energy ${fmt(item.terminalEnergy)}` +
          (item.blockedReasons.length
            ? ` | reason ${item.blockedReasons.join(", ")}`
            : ""),
      );
    }
  }

  return printBlock(lines);
}

function buy(resource, amount, roomName) {
  amount = Number(amount);

  const room = getOwnedRoom(roomName);

  if (!room)
    return printLine(`${CONFIG.logPrefix} Invalid owned room: ${roomName}`);
  if (!terminalUsable(room))
    return printLine(`${CONFIG.logPrefix} Room has no usable terminal.`);
  if (!terminalReady(room))
    return printLine(
      `${CONFIG.logPrefix} Terminal cooldown: ${room.terminal.cooldown}`,
    );
  if (!resource || !amount || amount <= 0)
    return printLine(`${CONFIG.logPrefix} Invalid resource or amount.`);
  const freeCapacity = terminalFreeCapacity(room);

  if (freeCapacity <= 0)
    return printLine(`${CONFIG.logPrefix} Terminal lacks free capacity.`);

  const orders = Game.market
    .getAllOrders({
      type: ORDER_SELL,
      resourceType: resource,
    })
    .filter((order) => order.amount > 0 && order.roomName);

  const scored = orders
    .map((order) => {
      const score = scoreBuyOrder(order, room.name, amount);
      return {
        order,
        energyCost: score.energyCost,
        effectivePrice: score.effectivePrice,
      };
    })
    .sort((a, b) => a.effectivePrice - b.effectivePrice);

  const selected = scored.find((item) => {
    const terminalEnergy = amountIn(room.terminal.store, RESOURCE_ENERGY);
    const dealAmount = Math.min(amount, item.order.amount, freeCapacity);
    const totalPrice = dealAmount * item.order.price;
    const energyCost = Game.market.calcTransactionCost(
      dealAmount,
      room.name,
      item.order.roomName,
    );

    return (
      dealAmount > 0 &&
      Game.market.credits >= totalPrice &&
      terminalEnergy >= energyCost
    );
  });

  if (!selected) {
    return printLine(
      `${CONFIG.logPrefix} No affordable usable sell order found for ${resource}.`,
    );
  }

  const terminalEnergy = amountIn(room.terminal.store, RESOURCE_ENERGY);
  const maxByCredits = Math.floor(Game.market.credits / selected.order.price);
  const maxByEnergy = maxAmountByTerminalEnergy(
    room.name,
    selected.order.roomName,
    terminalEnergy,
    Math.min(amount, selected.order.amount, freeCapacity, maxByCredits),
  );
  const dealAmount = Math.min(
    amount,
    selected.order.amount,
    freeCapacity,
    maxByCredits,
    maxByEnergy,
  );
  const energyCost = Game.market.calcTransactionCost(
    dealAmount,
    room.name,
    selected.order.roomName,
  );
  const limitReasons = [];

  if (dealAmount < amount) {
    if (selected.order.amount < amount) limitReasons.push("order amount");
    if (maxByCredits < Math.min(amount, selected.order.amount, freeCapacity)) {
      limitReasons.push("credits");
    }
    if (freeCapacity < Math.min(amount, selected.order.amount, maxByCredits)) {
      limitReasons.push("terminal capacity");
    }
    if (
      maxByEnergy <
      Math.min(amount, selected.order.amount, freeCapacity, maxByCredits)
    ) {
      limitReasons.push("terminal energy");
    }
  }

  const result = Game.market.deal(selected.order.id, dealAmount, room.name);

  return printLine(
    `${CONFIG.logPrefix} buy ${resource} requested ${fmt(amount)} | bought ${fmt(dealAmount)} into ${room.name}` +
      ` | ${formatLimitReasons(limitReasons)}` +
      ` | price ${selected.order.price.toFixed(4)}` +
      ` | effective ${selected.effectivePrice.toFixed(4)}` +
      ` | credits ${fmt(dealAmount * selected.order.price)}` +
      ` | energy ${fmt(energyCost)}` +
      ` | result ${result}`,
  );
}

function sell(resource, amount, roomName) {
  amount = Number(amount);

  const room = getOwnedRoom(roomName);

  if (!room)
    return printLine(`${CONFIG.logPrefix} Invalid owned room: ${roomName}`);
  if (!terminalUsable(room))
    return printLine(`${CONFIG.logPrefix} Room has no usable terminal.`);
  if (!terminalReady(room))
    return printLine(
      `${CONFIG.logPrefix} Terminal cooldown: ${room.terminal.cooldown}`,
    );
  if (!resource || !amount || amount <= 0)
    return printLine(`${CONFIG.logPrefix} Invalid resource or amount.`);

  const available = amountIn(room.terminal.store, resource);
  const terminalEnergy = amountIn(room.terminal.store, RESOURCE_ENERGY);

  if (available <= 0) {
    return printLine(
      `${CONFIG.logPrefix} Terminal lacks ${resource}. Has ${fmt(available)}, needs ${fmt(amount)}.`,
    );
  }

  const orders = Game.market
    .getAllOrders({
      type: ORDER_BUY,
      resourceType: resource,
    })
    .filter((order) => order.amount > 0 && order.roomName);

  const scored = orders
    .map((order) => {
      const score = scoreSellOrder(order, room.name, amount);
      return {
        order,
        energyCost: score.energyCost,
        effectivePrice: score.effectivePrice,
      };
    })
    .sort((a, b) => b.effectivePrice - a.effectivePrice);

  const selected = scored.find((item) => {
    const dealAmount = Math.min(amount, item.order.amount, available);
    const energyCost = Game.market.calcTransactionCost(
      dealAmount,
      room.name,
      item.order.roomName,
    );
    return dealAmount > 0 && terminalEnergy >= energyCost;
  });

  if (!selected) {
    return printLine(
      `${CONFIG.logPrefix} No usable buy order found for ${resource}.`,
    );
  }

  const maxByEnergy = maxAmountByTerminalEnergy(
    room.name,
    selected.order.roomName,
    terminalEnergy,
    Math.min(amount, selected.order.amount, available),
  );
  const dealAmount = Math.min(
    amount,
    selected.order.amount,
    available,
    maxByEnergy,
  );
  const energyCost = Game.market.calcTransactionCost(
    dealAmount,
    room.name,
    selected.order.roomName,
  );
  const limitReasons = [];

  if (dealAmount < amount) {
    if (selected.order.amount < amount) limitReasons.push("order amount");
    if (available < Math.min(amount, selected.order.amount)) {
      limitReasons.push("terminal resource");
    }
    if (maxByEnergy < Math.min(amount, selected.order.amount, available)) {
      limitReasons.push("terminal energy");
    }
  }

  const result = Game.market.deal(selected.order.id, dealAmount, room.name);

  return printLine(
    `${CONFIG.logPrefix} sell ${resource} requested ${fmt(amount)} | sold ${fmt(dealAmount)} from ${room.name}` +
      ` | ${formatLimitReasons(limitReasons)}` +
      ` | price ${selected.order.price.toFixed(4)}` +
      ` | effective ${selected.effectivePrice.toFixed(4)}` +
      ` | credits ${fmt(dealAmount * selected.order.price)}` +
      ` | energy ${fmt(energyCost)}` +
      ` | result ${result}`,
  );
}

function planBuys() {
  const totals = empireTotals();
  const lines = ["[MARKET] Suggested buys:"];

  for (const room of ownedRooms()) {
    if (!room.terminal) continue;

    const terminalEnergy = amountIn(room.terminal.store, RESOURCE_ENERGY);

    if (terminalEnergy < CONFIG.terminalEnergyTarget) {
      lines.push(
        `  ${room.name}: buy/receive energy +${fmt(CONFIG.terminalEnergyTarget - terminalEnergy)}`,
      );
    }

    const mineral = room.find(FIND_MINERALS)[0];

    if (mineral) {
      const resource = mineral.mineralType;
      const total = roomResourceTotal(room, resource);

      if (total < CONFIG.mineralTarget) {
        lines.push(
          `  ${room.name}: buy/receive ${resource} +${fmt(CONFIG.mineralTarget - total)}`,
        );
      }
    }
  }

  for (const resource of BASE_RESOURCES) {
    if (resource === RESOURCE_ENERGY) continue;

    const total = totals[resource] || 0;

    if (total > 0 && total < CONFIG.mineralTarget) {
      lines.push(
        `  empire: consider buying ${resource} +${fmt(CONFIG.mineralTarget - total)}`,
      );
    }
  }

  if (lines.length === 1) {
    lines.push("  no obvious buys recommended");
  }

  return printBlock(lines);
}

function planSells() {
  const lines = ["[MARKET] Suggested sells:"];

  for (const room of ownedRooms()) {
    if (!room.terminal) continue;

    for (const resource of storeResources(room.terminal.store)) {
      const amount = amountIn(room.terminal.store, resource);

      if (resource === RESOURCE_ENERGY) {
        if (
          amount >
          CONFIG.terminalEnergyTarget + CONFIG.terminalEnergyReserve
        ) {
          lines.push(
            `  ${room.name}: sell/send energy surplus ${fmt(amount - CONFIG.terminalEnergyTarget)}`,
          );
        }

        continue;
      }

      if (amount > CONFIG.mineralSurplus) {
        lines.push(
          `  ${room.name}: sell/send ${resource} surplus ${fmt(amount - CONFIG.mineralSurplus)}`,
        );
      }
    }
  }

  if (lines.length === 1) {
    lines.push("  no obvious sells recommended");
  }

  return printBlock(lines);
}

function registerGlobals() {
  const memory = touchMemory();

  if (memory.uninstalled) {
    delete global.market;
    return null;
  }

  global.market = {
    version: VERSION,
    config: CONFIG,

    help,
    info,
    ping,
    install,
    restore,
    uninstall,

    rooms,
    stock,
    needs,
    surplus,

    stage,
    unstage,
    requests,
    cancel,
    send,

    buyOptions,
    sellOptions,
    readiness: readinessCommand,
    opportunities,
    recommendations,
    planSell,
    planBuy,
    plans,
    plan,
    planSummary,
    planReview,
    planAudit,
    clearPlan,
    deletePlan,
    removePlan,
    clearPlans,
    executionStatus,
    executionDryRun,
    executionLimits,
    setExecutionLimit,
    clearExecutionLimit,
    limits: executionLimits,
    setLimit: setExecutionLimit,
    clearLimit: clearExecutionLimit,
    executePlan,
    execute: executePlan,
    history,
    historySummary,
    historyAudit,
    clearHistory,
    setHistoryLimit,
    historyLimit,
    buy,
    sell,

    planBuys,
    planSells,
  };

  return global.market;
}

module.exports = {
  VERSION,
  registerGlobals,

  help,
  info,
  ping,
  install,
  restore,
  uninstall,

  rooms,
  stock,
  needs,
  surplus,

  stage,
  unstage,
  requests,
  cancel,
  send,

  buyOptions,
  sellOptions,
  readiness: readinessCommand,
  opportunities,
  recommendations,
  planSell,
  planBuy,
  plans,
  plan,
  planSummary,
  planReview,
  planAudit,
  clearPlan,
  deletePlan,
  removePlan,
  clearPlans,
  executionStatus,
  executionDryRun,
  executionLimits,
  setExecutionLimit,
  clearExecutionLimit,
  limits: executionLimits,
  setLimit: setExecutionLimit,
  clearLimit: clearExecutionLimit,
  executePlan,
  execute: executePlan,
  history,
  historySummary,
  historyAudit,
  clearHistory,
  setHistoryLimit,
  historyLimit,
  buy,
  sell,

  planBuys,
  planSells,
};
