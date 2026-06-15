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
  logPrefix: "[MARKET]",
};

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

function getMemoryRoot() {
  if (!Memory.consoleTools) Memory.consoleTools = {};
  if (!Memory.consoleTools.market) Memory.consoleTools.market = {};
  return Memory.consoleTools.market;
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
  return printBlock([
    "[MARKET] Screeps Market Console Helper",
    `[MARKET] Version: ${VERSION}`,
    "",
    "[MARKET] Memory/runtime:",
    "  market.help()",
    "  market.info()",
    "  market.ping()",
    "  market.install()",
    "  market.restore()",
    "  market.uninstall()",
    "",
    "[MARKET] Visibility:",
    "  market.rooms()",
    "  market.stock()",
    "  market.stock(roomName)",
    "  market.needs()",
    "  market.surplus()",
    "",
    "[MARKET] Internal terminal logistics:",
    "  market.stage(resource, amount, roomName)",
    "  market.unstage(resource, amount, roomName)",
    "  market.requests()",
    "  market.requests(roomName)",
    '  market.requests("all"|"history")',
    '  market.requests(roomName, "all"|"history")',
    "  market.cancel(requestId)",
    "  market.send(resource, amount, fromRoom, toRoom)",
    "",
    "[MARKET] Market scanning:",
    "  market.buyOptions()",
    "  market.buyOptions(resource)",
    "  market.sellOptions()",
    "  market.sellOptions(resource)",
    "",
    "[MARKET] Manual trading:",
    "  market.buy(resource, amount, roomName)",
    "  market.sell(resource, amount, roomName)",
    "",
    "[MARKET] Planning:",
    "  market.planBuys()",
    "  market.planSells()",
  ]);
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
  buy,
  sell,

  planBuys,
  planSells,
};
