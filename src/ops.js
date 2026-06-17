const opsState = require("ops_state");
const roomReporting = require("room_reporting");
const empireManager = require("empire_manager");
const reservationManager = require("reservation_manager");
const attackManager = require("attack_manager");
const invasionLog = require("invasion_log");
const opsLogisticsManager = require("ops_logistics_manager");
const terminalBalanceManager = require("terminal_balance_manager");
const powerManager = require("power_manager");
const pclManager = require("pcl_manager");

function getOwnedRooms() {
  return empireManager.collectOwnedRooms();
}

function resolveOwnedRoom(roomName) {
  if (roomName) {
    const room = Game.rooms[roomName];
    if (room && room.controller && room.controller.my) {
      return room;
    }

    return null;
  }

  const currentRoomName = opsState.getCurrentRoomName();
  if (currentRoomName) {
    const currentRoom = Game.rooms[currentRoomName];
    if (currentRoom && currentRoom.controller && currentRoom.controller.my) {
      return currentRoom;
    }
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

  return lines.join("\n");
}

function getRuntimeMemory() {
  if (!Memory.runtime) Memory.runtime = {};
  return Memory.runtime;
}

function getOpsConsoleMemory() {
  const runtime = getRuntimeMemory();
  if (!runtime.opsConsole) runtime.opsConsole = {};
  return runtime.opsConsole;
}

function buildToggleResult(label, enabled) {
  return {
    enabled: enabled,
    label: label,
  };
}

function fmt(value) {
  return Math.round(value || 0).toLocaleString();
}

function formatOverride(value) {
  if (value === true) return "on";
  if (value === false) return "off";
  return "global";
}

function getStoredAmount(target, resourceType) {
  if (!target || !target.store) return 0;

  if (typeof target.store.getUsedCapacity === "function") {
    const used = target.store.getUsedCapacity(resourceType);
    if (typeof used === "number" && used > 0) return used;
  }

  return target.store[resourceType] || 0;
}

function getOpsResourceType() {
  return typeof RESOURCE_OPS !== "undefined" ? RESOURCE_OPS : "ops";
}

function getRoomPowerCreepOpsRows(roomName) {
  const powerCreeps = Game.powerCreeps || {};
  const resourceType = getOpsResourceType();

  return Object.keys(powerCreeps)
    .sort()
    .map(function (name) {
      const powerCreep = powerCreeps[name];
      const creepRoomName =
        powerCreep && powerCreep.room
          ? powerCreep.room.name
          : powerCreep && powerCreep.pos
            ? powerCreep.pos.roomName
            : null;

      if (roomName && creepRoomName !== roomName) return null;

      return {
        name: powerCreep && powerCreep.name ? powerCreep.name : name,
        roomName: creepRoomName || "unknown",
        amount: getStoredAmount(powerCreep, resourceType),
      };
    })
    .filter(function (row) {
      return !!row;
    });
}

function getActiveOpsLogisticsRequests(roomName) {
  const resourceType = getOpsResourceType();
  return opsLogisticsManager.listRequests(roomName).filter(function (row) {
    return (
      row.resourceType === resourceType &&
      (row.status === "open" || row.status === "blocked")
    );
  });
}

function buildRoomOpsInventory(room) {
  const resourceType = getOpsResourceType();
  const powerCreeps = getRoomPowerCreepOpsRows(room.name);
  const carried = powerCreeps.reduce(function (sum, row) {
    return sum + (row.amount || 0);
  }, 0);
  const pending = getActiveOpsLogisticsRequests(room.name);

  return {
    roomName: room.name,
    resourceType: resourceType,
    storage: getStoredAmount(room.storage, resourceType),
    terminal: getStoredAmount(room.terminal, resourceType),
    carried: carried,
    powerCreeps: powerCreeps,
    pending: pending,
  };
}

function formatPowerCreepOpsRows(rows) {
  const visible = rows.filter(function (row) {
    return row.amount > 0;
  });
  if (visible.length === 0) return "none";
  return visible
    .map(function (row) {
      return row.name + " " + fmt(row.amount);
    })
    .join(", ");
}

function formatOpsRequestRows(rows) {
  if (rows.length === 0) return "none";
  return rows
    .slice(0, 5)
    .map(function (row) {
      return (
        row.id +
        " " +
        row.status +
        " " +
        row.from +
        "->" +
        row.to +
        " remaining " +
        fmt(row.remaining) +
        "/" +
        fmt(row.amount)
      );
    })
    .join("; ");
}

function formatRoomOpsInventory(inventory) {
  const lines = [
    `[OPS][${inventory.roomName}][OPS] ` +
      `storage ${fmt(inventory.storage)} | terminal ${fmt(inventory.terminal)} | ` +
      `powerCreeps ${fmt(inventory.carried)} | pending ${inventory.pending.length}`,
    `[OPS][${inventory.roomName}][OPS] visible Power Creeps: ${formatPowerCreepOpsRows(inventory.powerCreeps)}`,
    `[OPS][${inventory.roomName}][OPS] pending: ${formatOpsRequestRows(inventory.pending)}`,
  ];

  return lines;
}

function formatGlobalOpsInventory() {
  const rooms = getOwnedRooms();
  const inventories = rooms.map(buildRoomOpsInventory);
  const totals = inventories.reduce(
    function (sum, inventory) {
      sum.storage += inventory.storage;
      sum.terminal += inventory.terminal;
      sum.carried += inventory.carried;
      sum.pending += inventory.pending.length;
      return sum;
    },
    { storage: 0, terminal: 0, carried: 0, pending: 0 },
  );

  const lines = [
    `[OPS][OPS] Empire ops inventory | storage ${fmt(totals.storage)} | ` +
      `terminal ${fmt(totals.terminal)} | powerCreeps ${fmt(totals.carried)} | ` +
      `pending ${totals.pending}`,
  ];

  if (rooms.length === 0) {
    lines.push("[OPS][OPS] no visible owned rooms");
    return lines;
  }

  for (let i = 0; i < inventories.length; i++) {
    const inventory = inventories[i];
    lines.push(
      `[OPS][OPS] ${inventory.roomName} | storage ${fmt(inventory.storage)} | ` +
        `terminal ${fmt(inventory.terminal)} | powerCreeps ${fmt(inventory.carried)} | ` +
        `pending ${inventory.pending.length}`,
    );
  }

  return lines;
}

function normalizeOpsEndpoint(endpoint) {
  if (typeof endpoint !== "string") return "";
  return endpoint.trim().toLowerCase();
}

function parsePositiveAmount(amount) {
  if (typeof amount === "string" && amount.trim() !== "") {
    amount = Number(amount);
  }

  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.floor(amount);
}

function isStorageTerminalEndpoint(endpoint) {
  return endpoint === "storage" || endpoint === "terminal";
}

function getRoomOpsEndpoint(room, endpoint) {
  if (!room || !isStorageTerminalEndpoint(endpoint)) return null;
  return room[endpoint] || null;
}

function getStoreTotal(target) {
  if (!target || !target.store) return 0;

  if (typeof target.store.getUsedCapacity === "function") {
    const used = target.store.getUsedCapacity();
    if (typeof used === "number") return used;
  }

  let total = 0;
  for (const resourceType in target.store) {
    if (!Object.prototype.hasOwnProperty.call(target.store, resourceType)) {
      continue;
    }
    if (typeof target.store[resourceType] === "number") {
      total += target.store[resourceType];
    }
  }

  return total;
}

function getTotalFreeCapacity(target) {
  if (!target || !target.store) return 0;

  if (typeof target.store.getFreeCapacity === "function") {
    const free = target.store.getFreeCapacity();
    if (typeof free === "number") return free;
  }

  return Math.max(0, 300000 - getStoreTotal(target));
}

function getTerminalCongestionStatus(freeCapacity) {
  if (freeCapacity <= 0) return "FULL";
  if (freeCapacity < 20000) return "CONGESTED";
  if (freeCapacity < 50000) return "BUSY";
  return "HEALTHY";
}

function getStoreResources(store) {
  if (!store) return [];

  return Object.keys(store)
    .filter(function (resourceType) {
      return (store[resourceType] || 0) > 0;
    })
    .sort();
}

function getTerminalResourceRows(terminal) {
  return getStoreResources(terminal.store)
    .map(function (resourceType) {
      return {
        resourceType: resourceType,
        amount: getStoredAmount(terminal, resourceType),
      };
    })
    .sort(function (a, b) {
      if (b.amount !== a.amount) return b.amount - a.amount;
      return a.resourceType.localeCompare(b.resourceType);
    });
}

function formatResourceList(resources, limit) {
  const capped = typeof limit === "number" ? resources.slice(0, limit) : resources;
  if (capped.length === 0) return "none";

  return capped
    .map(function (row) {
      return row.resourceType + " " + fmt(row.amount);
    })
    .join(", ");
}

function buildTerminalStatus(room) {
  const terminal = room.terminal;
  const used = getStoreTotal(terminal);
  const free = getTotalFreeCapacity(terminal);
  const resources = getTerminalResourceRows(terminal);

  return {
    roomName: room.name,
    used: used,
    free: free,
    energy: getStoredAmount(terminal, RESOURCE_ENERGY),
    status: getTerminalCongestionStatus(free),
    resources: resources,
  };
}

function getPowerMemory(roomName) {
  return Memory.rooms && Memory.rooms[roomName] && Memory.rooms[roomName].power
    ? Memory.rooms[roomName].power
    : {};
}

function getPowerSpawnCount(room) {
  if (!room) return 0;
  const spawns = room.find(FIND_MY_STRUCTURES, {
    filter: function (structure) {
      return structure.structureType === STRUCTURE_POWER_SPAWN;
    },
  });
  return spawns.length;
}

function getPowerSummaryLine(room) {
  const power = getPowerMemory(room.name);
  const policy = powerManager.getRoomPolicy(room.name);
  const globalProcess = typeof power.globalEnabled === "boolean"
    ? power.globalEnabled
    : !!(powerManager.getSettings().ENABLED);
  const globalRefill = typeof power.globalRefillEnabled === "boolean"
    ? power.globalRefillEnabled
    : !!(powerManager.getSettings().REFILL_ENABLED);
  const processOverride = typeof policy.processingEnabled === "boolean"
    ? policy.processingEnabled
    : null;
  const refillOverride = typeof policy.refillEnabled === "boolean"
    ? policy.refillEnabled
    : null;
  const effectiveProcess = typeof power.effectiveProcessingEnabled === "boolean"
    ? power.effectiveProcessingEnabled
    : processOverride === null
      ? globalProcess
      : processOverride;
  const effectiveRefill = typeof power.effectiveRefillEnabled === "boolean"
    ? power.effectiveRefillEnabled
    : refillOverride === null
      ? globalRefill
      : refillOverride;

  return (
    `[OPS][${room.name}][POWER] ` +
    `PS ${power.powerSpawns || getPowerSpawnCount(room)} | ` +
    `process ${effectiveProcess ? "on" : "off"} (${formatOverride(processOverride)}) | ` +
    `refill ${effectiveRefill ? "on" : "off"} (${formatOverride(refillOverride)}) | ` +
    `ready ${power.readiness || "UNKNOWN"} | refill ${power.refillState || "REFILL_UNKNOWN"} | ` +
    `E ${fmt(power.powerSpawnEnergy || power.energy || 0)}/${fmt(power.energyTarget || (powerManager.getSettings().POWER_SPAWN_ENERGY_TARGET || 0))} | ` +
    `P ${fmt(power.powerSpawnPower || power.power || 0)}/${fmt(power.powerTarget || (powerManager.getSettings().POWER_SPAWN_POWER_TARGET || 0))} | ` +
    `pending ${power.refillPendingRequests || 0} | last ${typeof power.lastProcessed === "number" ? power.lastProcessed : "--"} total ${fmt(power.totalProcessed || 0)}`
  );
}

function parsePowerCommand(roomName, arg1, arg2) {
  if (typeof roomName === "undefined" || roomName === null || roomName === "") {
    return {
      mode: "summary",
    };
  }

  const normalized = typeof arg1 === "string" ? arg1.trim().toLowerCase() : arg1;
  if (typeof arg1 === "undefined") {
    return {
      mode: "detail",
      roomName: roomName,
    };
  }

  if (normalized === "process" || normalized === "processing") {
    const enabled = parseToggleMode(arg2, true);
    return {
      mode: "set",
      roomName: roomName,
      updates: {
        processingEnabled: enabled === null ? undefined : enabled,
      },
      label: "processing",
    };
  }

  if (normalized === "refill") {
    const enabled = parseToggleMode(arg2, true);
    return {
      mode: "set",
      roomName: roomName,
      updates: {
        refillEnabled: enabled === null ? undefined : enabled,
      },
      label: "refill",
    };
  }

  if (normalized === "reserve") {
    const reserve =
      arg2 === null ||
      (typeof arg2 === "string" && ["clear", "default", "global", "null"].indexOf(arg2.trim().toLowerCase()) !== -1)
        ? null
        : Number(arg2);
    return {
      mode: "set",
      roomName: roomName,
      updates: {
        minStorageEnergy:
          reserve === null
            ? null
            : typeof reserve === "number" && isFinite(reserve) && reserve >= 0
              ? Math.floor(reserve)
              : undefined,
      },
      label: "reserve",
    };
  }

  const enabled = parseToggleMode(arg1, true);
  return {
    mode: "set",
    roomName: roomName,
    updates: {
      processingEnabled: enabled === null ? undefined : enabled,
      refillEnabled: enabled === null ? undefined : enabled,
    },
    label: "power",
  };
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

function normalizeTickRateSampleTicks(sampleTicks) {
  if (typeof sampleTicks === "undefined") return 5;

  if (typeof sampleTicks === "string") {
    const trimmed = sampleTicks.trim();
    if (!trimmed) return null;
    sampleTicks = Number(trimmed);
  }

  if (
    typeof sampleTicks !== "number" ||
    !isFinite(sampleTicks) ||
    sampleTicks <= 0
  ) {
    return null;
  }

  return Math.floor(sampleTicks);
}

function formatTickRateSummary(sample) {
  if (!sample) return "[OPS] Tick rate: no completed sample recorded.";

  return (
    `[OPS] Tick rate: ${sample.avgMs.toFixed(2)} ms/tick over ${sample.ticks} ticks ` +
    `(ticks ${sample.startTick}-${sample.endTick}, reported at tick ${sample.reportedAtTick}).`
  );
}

function buildTickRateStatusLine() {
  const opsConsole = getOpsConsoleMemory();
  const probe = opsConsole.tickRateProbe;

  if (!probe) {
    if (opsConsole.lastTickRateSample) {
      return `${formatTickRateSummary(opsConsole.lastTickRateSample)} No active probe.`;
    }

    return "[OPS] Tick rate: no active probe.";
  }

  if (typeof probe.startTick === "number") {
    const remainingTicks = Math.max(
      0,
      probe.startTick + probe.sampleTicks - Game.time,
    );

    return (
      `[OPS] Tick rate running: ${probe.sampleTicks} ticks from tick ${probe.startTick}. ` +
      `${remainingTicks} ticks remaining.`
    );
  }

  return (
    `[OPS] Tick rate armed: sampling ${probe.sampleTicks} ticks starting at tick ${probe.armTick}.`
  );
}

function processTickRateProbe() {
  const opsConsole = getOpsConsoleMemory();
  const probe = opsConsole.tickRateProbe;

  if (!probe) return null;

  if (typeof probe.startTick !== "number") {
    if (Game.time < probe.armTick) return null;

    probe.startTick = Game.time;
    probe.startMs = Date.now();
    return null;
  }

  if (Game.time < probe.startTick + probe.sampleTicks) return null;

  const ticks = Math.max(1, Game.time - probe.startTick);
  const elapsedMs = Math.max(0, Date.now() - probe.startMs);
  const avgMs = elapsedMs / ticks;
  const sample = {
    avgMs: avgMs,
    elapsedMs: elapsedMs,
    endTick: Game.time,
    reportedAtTick: Game.time,
    sampleTicks: probe.sampleTicks,
    startTick: probe.startTick,
    ticks: ticks,
  };

  opsConsole.lastTickRateSample = sample;
  delete opsConsole.tickRateProbe;

  return printLine(formatTickRateSummary(sample));
}

function getConsoleCommandHelp() {
  return [
    {
      command: "view(on|off)",
      description: "Toggle HUD and critical reports together.",
      example: "view(on)",
    },
    {
      command: "ops.hud(on|off)",
      description: "Toggle the HUD overlay.",
      example: "ops.hud(on)",
    },
    {
      command: "ops.reports(on|off)",
      description: "Toggle critical room reports.",
      example: "ops.reports(off)",
    },
    {
      command: "ops.room([roomName], [section])",
      description:
        "Show one room report. Sections include power, observer, and resources status.",
      example: 'ops.room("W5N5", "power")',
    },
    {
      command: "ops.rooms()",
      description: "Show overview lines for all owned rooms.",
      example: "ops.rooms()",
    },
    {
      command: "ops.empire()",
      description: "Show empire summary and owned-room overview.",
      example: "ops.empire()",
    },
    {
      command: "ops.log([roomName], [limit])",
      description: "Show compact invasion history. Defaults to newest 20 entries across all rooms.",
      example: 'ops.log("W43N6")',
    },
    {
      command: "ops.logClear([roomName])",
      description: "Clear invasion history for one room, or all rooms when omitted.",
      example: 'ops.logClear("W43N6")',
    },
    {
      command: "ops.cpu([roomName])",
      description: "Show measured room CPU, top section costs, pressure, and scheduler skips.",
      example: 'ops.cpu("W5N5")',
    },
    {
      command: "ops.power([roomName], [mode], [on|off])",
      description:
        "Show or set room-local Power Spawn processing and refill policy.",
      example: 'ops.power("W5N5", "process", "off")',
    },
    {
      command: "ops.pcl([roomName])",
      description: "Show GPL/PCL status and optional room enablement readiness.",
      example: 'ops.pcl("W5N5")',
    },
    {
      command: "ops.powerCreeps()",
      description: "List friendly Power Creeps without controlling them.",
      example: "ops.powerCreeps()",
    },
    {
      command: 'ops.operator(name, [roomName], ["powers"])',
      description:
        "Report operator OPERATE_* readiness and visible room targets without using powers.",
      example: 'ops.operator("OperatorOne", "W5N5", "powers")',
    },
    {
      command: 'ops.operator(name, roomName, "operateSpawn", [spawnNameOrId], mode)',
      description:
        "Check or explicitly confirm manual OPERATE_SPAWN use on an owned spawn.",
      example: 'ops.operator("OperatorOne", "W5N5", "operateSpawn", "Spawn1", "check")',
    },
    {
      command: 'ops.operator(name, roomName, "operateExtension", mode)',
      description:
        "Check or explicitly confirm manual OPERATE_EXTENSION use on an owned room controller target.",
      example: 'ops.operator("OperatorOne", "W5N5", "operateExtension", "check")',
    },
    {
      command: 'ops.powerCreep(name, action, room, [target], [mode])',
      description:
        "Check Power Creep lifecycle position, or confirm manual spawn, renew, and move preparation.",
      example: 'ops.powerCreep("OperatorOne", "move", "W5N5", "powerSpawn", "check")',
    },
    {
      command: 'ops.powerCreep(name, "generateOps", mode)',
      description:
        "Check or explicitly confirm manual GENERATE_OPS use on a spawned Power Creep.",
      example: 'ops.powerCreep("OperatorOne", "generateOps", "check")',
    },
    {
      command: 'ops.ops([roomName], ["stage", from, to, amount])',
      description:
        "Show ops inventory or manually stage RESOURCE_OPS between room storage and terminal.",
      example: 'ops.ops("W5N5", "stage", "storage", "terminal", 1000)',
    },
    {
      command: 'ops.powerEnable(roomName, mode, [name])',
      description:
        "Check room enablement readiness or confirm enableRoom with a named Power Creep.",
      example: 'ops.powerEnable("W5N5", "check")',
    },
    {
      command: "ops.tickRate([sampleTicks|status|cancel])",
      description:
        "Sample wall-clock ms per tick over a short window and auto-print the result.",
      example: "ops.tickRate(5)",
    },
    {
      command: "ops.move(resource, amount, roomName, from, to)",
      description:
        "Create a room-local logistics request between storage and terminal.",
      example: 'ops.move("H", 50000, "W42N9", "terminal", "storage")',
    },
    {
      command: "ops.terminalStatus([roomName])",
      description:
        "Show terminal capacity, energy, resources, and congestion status.",
      example: 'ops.terminalStatus("W42N9")',
    },
    {
      command: "ops.clearTerminal(roomName, [resource], [amount])",
      description:
        "Create terminal -> storage logistics requests for terminal cleanup.",
      example: 'ops.clearTerminal("W42N9", "H", 50000)',
    },
    {
      command: "ops.fillTerminal(roomName, resource, amount)",
      description:
        "Create a storage -> terminal logistics request for market staging.",
      example: 'ops.fillTerminal("W42N9", "energy", 10000)',
    },
    {
      command: "ops.requests([roomName])",
      description:
        "Show active ops logistics requests. Pass all or history to include completed, canceled, and expired requests.",
      example: 'ops.requests("W42N9", "all")',
    },
    {
      command: "ops.cancel(requestId)",
      description: "Cancel an ops logistics request.",
      example: 'ops.cancel("ol_123_W42N9_H_1")',
    },
    {
      command: "ops.balanceTerminal(roomName)",
      description:
        "Evaluate terminal balance targets and create conservative logistics requests.",
      example: 'ops.balanceTerminal("W42N9")',
    },
    {
      command: "ops.balanceTerminals()",
      description:
        "Evaluate terminal balance targets for owned rooms with storage and terminal.",
      example: "ops.balanceTerminals()",
    },
    {
      command: "ops.expand(targetRoom, [parentRoom])",
      description: "Start or update a manual expansion plan.",
      example: 'ops.expand("W5N6", "W5N5")',
    },
    {
      command: "ops.reserve(targetRoom, [parentRoom])",
      description: "Start or update a reserved-room plan.",
      example: 'ops.reserve("W5N6", "W5N5")',
    },
    {
      command: "ops.reserved([parentRoom])",
      description: "Show active reserved rooms grouped by parent.",
      example: 'ops.reserved("W5N5")',
    },
    {
      command: "ops.expansions()",
      description: "Show active expansion plans.",
      example: "ops.expansions()",
    },
    {
      command: "ops.attack(targetRoom, [postAction], [parentRoom], [allies])",
      description: 'Start or update a manual attack plan. postAction defaults to "expand"; use "expand", "reserve", or "none".',
      example: 'ops.attack("W5N6", "expand", "W5N5", ["W4N6"])',
    },
    {
      command: "ops.attacks()",
      description: "Show active attack plans.",
      example: "ops.attacks()",
    },
    {
      command: "ops.cancelAttack(targetRoom)",
      description: "Cancel an active attack plan.",
      example: 'ops.cancelAttack("W5N6")',
    },
    {
      command: "ops.cancelExpansion(targetRoom)",
      description: "Cancel an active expansion plan.",
      example: 'ops.cancelExpansion("W5N6")',
    },
    {
      command: "ops.cancelReserve(targetRoom)",
      description: "Cancel an active reserved-room plan.",
      example: 'ops.cancelReserve("W5N6")',
    },
  ];
}

function wrapHelpLine(prefix, text, width) {
  const limit = width || 80;
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let current = prefix;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    const next = current === prefix ? current + word : current + " " + word;
    if (next.length > limit && current !== prefix) {
      lines.push(current);
      current = "  " + word;
    } else {
      current = next;
    }
  }

  lines.push(current);
  return lines;
}

function formatHelpLines(rows) {
  const lines = ["[OPS] Available console commands"];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    lines.push(row.command);
    const descriptionLines = wrapHelpLine("  ", row.description, 80);
    for (let j = 0; j < descriptionLines.length; j++) {
      lines.push(descriptionLines[j]);
    }
    const exampleLines = wrapHelpLine("  ", row.example, 80);
    for (let k = 0; k < exampleLines.length; k++) {
      lines.push(exampleLines[k]);
    }
  }

  return lines;
}

function parseRoomCommandArgs(arg1, arg2) {
  const firstSection = roomReporting.normalizeSection(arg1);
  const secondSection = roomReporting.normalizeSection(arg2);

  if (typeof arg1 === "undefined" && typeof arg2 === "undefined") {
    return {
      roomName: null,
      section: "all",
    };
  }

  if (firstSection && typeof arg2 === "undefined") {
    return {
      roomName: null,
      section: firstSection,
    };
  }

  return {
    roomName: arg1 || null,
    section: secondSection || "all",
  };
}

module.exports = {
  registerGlobals() {
    processTickRateProbe();

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
      room: function (arg1, arg2) {
        return module.exports.room(arg1, arg2);
      },
      cpu: function (roomName) {
        return module.exports.cpu(roomName);
      },
      rooms: function () {
        return module.exports.rooms();
      },
      empire: function () {
        return module.exports.empire();
      },
      log: function (arg1, arg2) {
        return module.exports.log(arg1, arg2);
      },
      logClear: function (roomName) {
        return module.exports.logClear(roomName);
      },
      tickRate: function (sampleTicks) {
        return module.exports.tickRate(sampleTicks);
      },
      tickSpeed: function (sampleTicks) {
        return module.exports.tickRate(sampleTicks);
      },
      power: function (roomName, arg1, arg2) {
        return module.exports.power(roomName, arg1, arg2);
      },
      pcl: function (roomName) {
        return module.exports.pcl(roomName);
      },
      powerCreeps: function () {
        return module.exports.powerCreeps();
      },
      operator: function (powerCreepName, roomName, mode, targetOrMode, maybeMode) {
        return module.exports.operator(powerCreepName, roomName, mode, targetOrMode, maybeMode);
      },
      powerCreep: function (powerCreepName, action, roomName, targetOrMode, mode) {
        return module.exports.powerCreep(powerCreepName, action, roomName, targetOrMode, mode);
      },
      ops: function (roomName, action, from, to, amount, powerCreepName) {
        return module.exports.opsInventory(roomName, action, from, to, amount, powerCreepName);
      },
      powerEnable: function (roomName, mode, powerCreepName) {
        return module.exports.powerEnable(roomName, mode, powerCreepName);
      },
      move: function (resource, amount, roomName, from, to) {
        return module.exports.move(resource, amount, roomName, from, to);
      },
      terminalStatus: function (roomName) {
        return module.exports.terminalStatus(roomName);
      },
      clearTerminal: function (roomName, resource, amount) {
        return module.exports.clearTerminal(roomName, resource, amount);
      },
      fillTerminal: function (roomName, resource, amount) {
        return module.exports.fillTerminal(roomName, resource, amount);
      },
      requests: function (roomName, mode) {
        return module.exports.requests(roomName, mode);
      },
      cancel: function (requestId) {
        return module.exports.cancel(requestId);
      },
      balanceTerminal: function (roomName) {
        return module.exports.balanceTerminal(roomName);
      },
      balanceTerminals: function () {
        return module.exports.balanceTerminals();
      },
      expand: function (targetRoom, parentRoom) {
        return module.exports.expand(targetRoom, parentRoom);
      },
      reserve: function (targetRoom, parentRoom) {
        return module.exports.reserve(targetRoom, parentRoom);
      },
      reserved: function (parentRoom) {
        return module.exports.reserved(parentRoom);
      },
      expansions: function () {
        return module.exports.expansions();
      },
      attack: function (targetRoom, postAction, parentRoom, allies) {
        return module.exports.attack(targetRoom, postAction, parentRoom, allies);
      },
      attacks: function () {
        return module.exports.attacks();
      },
      cancelAttack: function (targetRoom) {
        return module.exports.cancelAttack(targetRoom);
      },
      cancelExpansion: function (targetRoom) {
        return module.exports.cancelExpansion(targetRoom);
      },
      cancelReserve: function (targetRoom) {
        return module.exports.cancelReserve(targetRoom);
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
    const lines = formatHelpLines(rows);

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

  room(arg1, arg2) {
    const parsed = parseRoomCommandArgs(arg1, arg2);
    const room = getTargetRoomOrPrintError(parsed.roomName, "room");
    if (!room) return null;
    opsState.setCurrentRoomName(room.name);

    const report = roomReporting.build(room, null, { updateProgress: true });
    const lines = roomReporting.getSectionLines(report, parsed.section);

    if (!lines) {
      return printLine(
        '[OPS] room: invalid section. Use overview, economy, build, defense, creeps, sources, resources, advanced, power, observer, cpu, or all.',
      );
    }

    printBlock(lines);

    if (parsed.section === "cpu") {
      return `[OPS][${room.name}][CPU] report generated`;
    }

    return {
      room: room.name,
      section: parsed.section,
      nextTask: report.nextTask,
      lines: lines,
    };
  },

  power(roomName, arg1, arg2) {
    const parsed = parsePowerCommand(roomName, arg1, arg2);

    if (parsed.mode === "summary") {
      const ownedRooms = getOwnedRooms();
      if (ownedRooms.length === 0) {
        return printLine("[OPS] power: no owned rooms available.");
      }

      const lines = ["[OPS] Power Spawn status"];
      for (let i = 0; i < ownedRooms.length; i++) {
        lines.push(getPowerSummaryLine(ownedRooms[i]));
      }
      return printBlock(lines);
    }

    const room = getTargetRoomOrPrintError(parsed.roomName, "power");
    if (!room) return null;
    opsState.setCurrentRoomName(room.name);

    if (parsed.mode === "detail") {
      const report = roomReporting.build(room, null, { updateProgress: true });
      const lines = roomReporting.getSectionLines(report, "power");
      printBlock(lines);
      return `[OPS][${room.name}][POWER] report generated`;
    }

    const updates = parsed.updates || {};
    const keys = Object.keys(updates);
    for (let i = 0; i < keys.length; i++) {
      if (typeof updates[keys[i]] === "undefined") {
        return printLine('[OPS] power: invalid mode. Use "on", "off", "process", "refill", or reserve amount.');
      }
    }

    const policy = powerManager.setRoomPolicy(room.name, updates);
    const line =
      `[OPS] Power ${room.name}: process ${formatOverride(policy.processingEnabled)} ` +
      `refill ${formatOverride(policy.refillEnabled)} ` +
      `reserve ${
        typeof policy.minStorageEnergy === "number"
          ? fmt(policy.minStorageEnergy)
          : "global"
      }.`;
    return printLine(line);
  },

  pcl(roomName) {
    const report = pclManager.formatGlobalStatus(roomName);
    printBlock(report.split("\n"));
    return report;
  },

  powerCreeps() {
    const report = pclManager.formatPowerCreeps();
    printBlock(report.split("\n"));
    return report;
  },

  operator(powerCreepName, roomName, mode, targetOrMode, maybeMode) {
    if (!powerCreepName) {
      return printLine('[OPS] operator: use ops.operator("CREEP_NAME", ["ROOM"], ["powers"]) or ops.operator("CREEP_NAME", "ROOM", "operateSpawn|operateExtension", ["SPAWN"], "check|confirm").');
    }

    const normalizedMode = typeof mode === "string" ? mode.trim().toLowerCase() : mode;
    if (normalizedMode === "operatespawn" || normalizedMode === "operateextension") {
      if (!roomName) {
        return printLine(`[OPS] operator ${mode}: roomName required.`);
      }

      let targetArg = null;
      let executionMode = targetOrMode;
      const normalizedTargetOrMode =
        typeof targetOrMode === "string" ? targetOrMode.trim().toLowerCase() : targetOrMode;

      if (
        normalizedMode === "operatespawn" &&
        normalizedTargetOrMode !== "check" &&
        normalizedTargetOrMode !== "confirm"
      ) {
        targetArg = targetOrMode;
        executionMode = maybeMode;
      }

      const normalizedExecutionMode =
        typeof executionMode === "string" ? executionMode.trim().toLowerCase() : executionMode;
      if (normalizedMode === "operateextension") {
        const report = pclManager.formatOperateExtension(
          powerCreepName,
          roomName,
          normalizedExecutionMode,
        );
        printBlock(report.split("\n"));
        return report;
      }

      const report = pclManager.formatOperateSpawn(
        powerCreepName,
        roomName,
        targetArg,
        normalizedExecutionMode,
      );
      printBlock(report.split("\n"));
      return report;
    }

    if (typeof normalizedMode !== "undefined" && normalizedMode !== "powers") {
      return printLine('[OPS] operator: optional mode must be "powers", "operateSpawn", or "operateExtension".');
    }

    const report = pclManager.formatOperatorReadiness(
      powerCreepName,
      roomName,
      normalizedMode,
    );
    printBlock(report.split("\n"));
    return report;
  },

  powerCreep(powerCreepName, action, roomName, targetOrMode, mode) {
    const normalizedAction = typeof action === "string" ? action.trim().toLowerCase() : action;

    if (!powerCreepName || !action || (!roomName && normalizedAction !== "generateops")) {
      return printLine(
        '[OPS] powerCreep: use ops.powerCreep("CREEP_NAME", "spawn|renew|position|move", "ROOM", "check|confirm") or ops.powerCreep("CREEP_NAME", "generateOps", "check|confirm").',
      );
    }

    if (normalizedAction === "generateops") {
      const normalizedMode = typeof roomName === "string" ? roomName.trim().toLowerCase() : roomName;
      const report = pclManager.formatPowerCreepGenerateOps(powerCreepName, normalizedMode);
      printBlock(report.split("\n"));
      return report;
    }

    if (normalizedAction === "position") {
      const report = pclManager.formatPowerCreepPosition(powerCreepName, roomName);
      printBlock(report.split("\n"));
      return report;
    }

    if (normalizedAction === "move") {
      const normalizedMode = typeof mode === "string" ? mode.trim().toLowerCase() : mode;
      const report = pclManager.formatPowerCreepMove(
        powerCreepName,
        roomName,
        targetOrMode,
        normalizedMode,
      );
      printBlock(report.split("\n"));
      return report;
    }

    const normalized = typeof targetOrMode === "string" ? targetOrMode.trim().toLowerCase() : targetOrMode;
    if (normalized !== "check" && normalized !== "confirm") {
      return printLine('[OPS] powerCreep: mode must be "check" or "confirm".');
    }

    const report = pclManager.formatPowerCreepLifecycle(
      powerCreepName,
      action,
      roomName,
      normalized,
    );
    printBlock(report.split("\n"));
    return report;
  },

  opsInventory(roomName, action, from, to, amount, powerCreepName) {
    if (typeof roomName === "undefined" || roomName === null || roomName === "") {
      return printBlock(formatGlobalOpsInventory());
    }

    const normalizedAction =
      typeof action === "string" ? action.trim().toLowerCase() : action;
    const room = Game.rooms && Game.rooms[roomName] ? Game.rooms[roomName] : null;

    if (!room || !room.controller || !room.controller.my) {
      return printLine(`[OPS] ops: owned room "${roomName}" not found.`);
    }

    if (typeof action === "undefined") {
      const lines = formatRoomOpsInventory(buildRoomOpsInventory(room));
      return printBlock(lines);
    }

    if (normalizedAction !== "stage") {
      return printLine('[OPS] ops: use ops.ops("ROOM") or ops.ops("ROOM", "stage", "storage", "terminal", amount).');
    }

    const sourceEndpoint = normalizeOpsEndpoint(from);
    const targetEndpoint = normalizeOpsEndpoint(to);

    if (sourceEndpoint === "powercreep" || targetEndpoint === "powercreep") {
      return printLine(
        `[OPS] ops stage ${room.name}: Power Creep direct ops staging is not supported yet; use storage <-> terminal logistics.`,
      );
    }

    if (
      !isStorageTerminalEndpoint(sourceEndpoint) ||
      !isStorageTerminalEndpoint(targetEndpoint) ||
      sourceEndpoint === targetEndpoint
    ) {
      return printLine('[OPS] ops stage: endpoints must be storage -> terminal or terminal -> storage.');
    }

    if (powerCreepName) {
      return printLine(
        "[OPS] ops stage: Power Creep direct ops staging is not supported yet; use storage <-> terminal logistics.",
      );
    }

    const requestAmount = parsePositiveAmount(amount);
    if (requestAmount === null) {
      return printLine("[OPS] ops stage: amount must be a positive finite number.");
    }

    const resourceType = getOpsResourceType();
    const source = getRoomOpsEndpoint(room, sourceEndpoint);
    const target = getRoomOpsEndpoint(room, targetEndpoint);

    if (!source) {
      return printLine(`[OPS] ops stage: ${room.name} has no ${sourceEndpoint}.`);
    }

    if (!target) {
      return printLine(`[OPS] ops stage: ${room.name} has no ${targetEndpoint}.`);
    }

    const available = getStoredAmount(source, resourceType);
    if (available < requestAmount) {
      return printLine(
        `[OPS] ops stage: ${room.name} ${sourceEndpoint} has ${fmt(available)} ${resourceType}; requested ${fmt(requestAmount)}.`,
      );
    }

    if (
      target.store &&
      typeof target.store.getFreeCapacity === "function" &&
      target.store.getFreeCapacity(resourceType) < requestAmount
    ) {
      return printLine(
        `[OPS] ops stage: ${room.name} ${targetEndpoint} lacks free capacity for ${fmt(requestAmount)} ${resourceType}.`,
      );
    }

    const result = opsLogisticsManager.createMoveRequest(
      resourceType,
      requestAmount,
      room.name,
      sourceEndpoint,
      targetEndpoint,
    );

    const request = result.request || {};
    const status = result.skipped ? "existing" : request.status || "unknown";
    const line =
      `[OPS] ops stage ${room.name}: ${resourceType} ${fmt(requestAmount)} ` +
      `${sourceEndpoint} -> ${targetEndpoint} | request ${request.id || "none"} | status ${status}`;
    printLine(line);

    if (!result.ok || result.skipped) {
      printLine(result.message);
    }

    return line;
  },

  powerEnable(roomName, mode, powerCreepName) {
    const normalized = typeof mode === "string" ? mode.trim().toLowerCase() : mode;
    if (!roomName) {
      return printLine('[OPS] powerEnable: roomName required. Use ops.powerEnable("ROOM", "check").');
    }

    if (normalized === "check") {
      const report = pclManager.formatEnablementReadiness(roomName);
      printBlock(report.split("\n"));
      return report;
    }

    if (normalized === "confirm") {
      const report = pclManager.formatEnablementConfirm(roomName, normalized, powerCreepName);
      printBlock(report.split("\n"));
      return report;
    }

    return printLine('[OPS] powerEnable: mode must be "check" or "confirm".');
  },

  rooms() {
    const ownedRooms = getOwnedRooms();
    if (ownedRooms.length === 0) {
      return printLine("[OPS] rooms: no owned rooms available.");
    }

    const reports = empireManager.buildRoomReports(ownedRooms, null, {
      updateProgress: true,
    });

    const lines = roomReporting.buildRoomsOverview(reports);
    printBlock(lines);

    return reports;
  },

  empire() {
    const ownedRooms = getOwnedRooms();
    if (ownedRooms.length === 0) {
      return printLine("[OPS] empire: no owned rooms available.");
    }

    const reports = empireManager.buildRoomReports(ownedRooms, null, {
      updateProgress: true,
    });
    const report = empireManager.buildReport(reports);

    printBlock(report.lines);

    return report;
  },

  log(arg1, arg2) {
    let roomName = null;
    let limit = 20;

    if (typeof arg1 === "number") {
      limit = arg1;
    } else if (typeof arg1 === "string") {
      const trimmed = arg1.trim();
      if (/^\d+$/.test(trimmed)) {
        limit = Number(trimmed);
      } else if (trimmed.length > 0) {
        roomName = trimmed;
      }
    }

    if (typeof arg2 === "number") {
      limit = arg2;
    } else if (typeof arg2 === "string" && /^\d+$/.test(arg2.trim())) {
      limit = Number(arg2.trim());
    }

    const lines = invasionLog.formatLines(roomName, limit, 85);
    printBlock(lines);
    return lines;
  },

  logClear(roomName) {
    const normalized =
      typeof roomName === "string" && roomName.trim().length > 0
        ? roomName.trim()
        : "all";
    const result = invasionLog.clear(normalized);
    printLine(
      `[OPS] Invasion log cleared rooms=${result.clearedRooms} entries=${result.clearedEntries}.`,
    );
    return result;
  },

  tickRate(sampleTicks) {
    if (typeof sampleTicks === "string") {
      const action = sampleTicks.trim().toLowerCase();
      const opsConsole = getOpsConsoleMemory();

      if (action === "status") {
        return printLine(buildTickRateStatusLine());
      }

      if (action === "cancel") {
        if (!opsConsole.tickRateProbe) {
          return printLine("[OPS] Tick rate: no active probe to cancel.");
        }

        delete opsConsole.tickRateProbe;
        return printLine("[OPS] Tick rate probe cancelled.");
      }
    }

    const resolvedSampleTicks = normalizeTickRateSampleTicks(sampleTicks);
    if (resolvedSampleTicks === null) {
      return printLine(
        '[OPS] tickRate: invalid sample. Use a positive integer, "status", or "cancel".',
      );
    }

    const opsConsole = getOpsConsoleMemory();
    opsConsole.tickRateProbe = {
      armTick: Game.time + 1,
      requestedAtTick: Game.time,
      sampleTicks: resolvedSampleTicks,
      startMs: null,
      startTick: null,
    };

    return printLine(
      `[OPS] Tick rate armed: sampling ${resolvedSampleTicks} ticks starting next tick.`,
    );
  },

  move(resource, amount, roomName, from, to) {
    const result = opsLogisticsManager.createMoveRequest(
      resource,
      amount,
      roomName,
      from,
      to,
    );
    printLine(result.message);
    return result;
  },

  terminalStatus(roomName) {
    if (roomName) {
      const room = resolveOwnedRoom(roomName);

      if (!room) {
        return printLine(`[OPS] terminalStatus: owned room "${roomName}" not found.`);
      }

      if (!room.terminal) {
        return printLine(`[OPS] terminalStatus: ${room.name} has no terminal.`);
      }

      const status = buildTerminalStatus(room);
      const lines = [
        `[OPS] Terminal ${room.name}: ${status.status}`,
        `  used ${fmt(status.used)} | free ${fmt(status.free)} | energy ${fmt(status.energy)}`,
        "  resources:",
      ];

      if (status.resources.length === 0) {
        lines.push("    none");
      } else {
        for (let i = 0; i < status.resources.length; i++) {
          lines.push(
            `    ${status.resources[i].resourceType}: ${fmt(status.resources[i].amount)}`,
          );
        }
      }

      return printBlock(lines);
    }

    const rooms = getOwnedRooms().filter(function (room) {
      return !!room.terminal;
    });
    const statuses = rooms.map(buildTerminalStatus);
    const lines = ["[OPS] Terminal status:"];

    if (statuses.length === 0) {
      lines.push("  no owned rooms with terminals");
      return printBlock(lines);
    }

    for (let i = 0; i < statuses.length; i++) {
      const status = statuses[i];
      lines.push(
        `  ${status.roomName} | ${status.status}` +
          ` | used ${fmt(status.used)}` +
          ` | free ${fmt(status.free)}` +
          ` | energy ${fmt(status.energy)}` +
          ` | top ${formatResourceList(status.resources, 4)}`,
      );
    }

    return printBlock(lines);
  },

  clearTerminal(roomName, resource, amount) {
    if (typeof resource === "undefined") {
      const room = resolveOwnedRoom(roomName);

      if (!room) {
        const message = `[OPS] clearTerminal: owned room "${roomName}" not found.`;
        printLine(message);
        return {
          ok: false,
          roomName: roomName,
          requests: [],
          message: message,
        };
      }

      if (!room.storage || !room.terminal) {
        const message = `[OPS] clearTerminal: ${room.name} needs both storage and terminal.`;
        printLine(message);
        return {
          ok: false,
          roomName: room.name,
          requests: [],
          message: message,
        };
      }

      const results = [];
      const resources = getTerminalResourceRows(room.terminal).filter(function (row) {
        return row.resourceType !== RESOURCE_ENERGY;
      });
      let projectedFree = getTotalFreeCapacity(room.terminal);

      for (let i = 0; i < resources.length; i++) {
        const row = resources[i];
        const needFree = Math.max(
          0,
          opsLogisticsManager.BALANCE.terminalFreeCapacityTarget - projectedFree,
        );
        const excess = Math.max(0, row.amount - opsLogisticsManager.BALANCE.mineralMax);
        const unloadAmount = Math.min(row.amount, Math.max(excess, needFree));

        if (unloadAmount <= 0) continue;

        const result = opsLogisticsManager.createMoveRequest(
          row.resourceType,
          unloadAmount,
          room.name,
          "terminal",
          "storage",
          { priority: opsLogisticsManager.BALANCE.priority },
        );
        results.push(result);
        projectedFree += result.requestedAmount || 0;
      }

      const message =
        `[OPS] clearTerminal ${room.name}: ${results.length} cleanup request result(s).`;
      printLine(message);
      for (let j = 0; j < results.length; j++) {
        printLine(results[j].message);
      }

      return {
        ok: true,
        roomName: room.name,
        requests: results,
        message: message,
      };
    }

    const result = opsLogisticsManager.createMoveRequest(
      resource,
      amount,
      roomName,
      "terminal",
      "storage",
    );
    printLine(result.message);
    return result;
  },

  fillTerminal(roomName, resource, amount) {
    const result = opsLogisticsManager.createMoveRequest(
      resource,
      amount,
      roomName,
      "storage",
      "terminal",
    );
    printLine(result.message);
    return result;
  },

  requests(roomName, mode) {
    const firstArg = typeof roomName === "string" ? roomName.trim().toLowerCase() : "";
    const secondArg = typeof mode === "string" ? mode.trim().toLowerCase() : "";
    const includeAll =
      firstArg === "all" ||
      firstArg === "history" ||
      secondArg === "all" ||
      secondArg === "history";
    const resolvedRoomName =
      firstArg === "all" || firstArg === "history" ? null : roomName;
    const allRows = opsLogisticsManager.listRequests(resolvedRoomName);
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
      : allRows.filter(function (row) {
          return row.status === "open" || row.status === "blocked";
        });
    const lines = [
      (resolvedRoomName
        ? `[OPS] Logistics requests for ${resolvedRoomName}`
        : "[OPS] Logistics requests") +
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

    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];

      lines.push(
        `  ${row.id} | ${row.status} | ${row.roomName}` +
          ` | ${row.resourceType}` +
          ` | ${row.from} -> ${row.to}` +
          ` | remaining ${fmt(row.remaining)}/${fmt(row.amount)}` +
          ` | claimed ${fmt(row.claimed)}`,
      );
    }

    return printBlock(lines);
  },

  cancel(requestId) {
    const result = opsLogisticsManager.cancelRequest(requestId);
    printLine(result.message);
    return result;
  },

  balanceTerminal(roomName) {
    const room = resolveOwnedRoom(roomName);
    if (!room) {
      return printLine(`[OPS] balanceTerminal: owned room "${roomName}" not found.`);
    }

    const result = terminalBalanceManager.evaluate(room);
    printLine(result.message);

    if (result.requests && result.requests.length) {
      for (let i = 0; i < result.requests.length; i++) {
        printLine(result.requests[i].message);
      }
    }

    return result;
  },

  balanceTerminals() {
    const rooms = getOwnedRooms().filter(function (room) {
      return !!(room.storage && room.terminal);
    });
    const result = {
      ok: true,
      rooms: rooms.map(function (room) {
        return terminalBalanceManager.evaluate(room);
      }),
      message:
        "[OPS] terminal balance evaluated " +
        rooms.length +
        " owned room(s).",
    };
    printLine(result.message);

    for (let i = 0; i < result.rooms.length; i++) {
      const roomResult = result.rooms[i];
      printLine(roomResult.message);
      if (!roomResult.requests) continue;

      for (let j = 0; j < roomResult.requests.length; j++) {
        printLine(roomResult.requests[j].message);
      }
    }

    return result;
  },

  expand(targetRoom, parentRoom) {
    const resolvedParent = parentRoom || null;

    const reservation = reservationManager.getActiveReservation(targetRoom);
    const takeoverParent = resolvedParent || (reservation ? reservation.parentRoom : null);
    const result = empireManager.createExpansion(
      targetRoom,
      takeoverParent,
    );
    printLine(`[OPS] ${result.message}`);

    if (result.ok) {
      if (reservation) {
        reservationManager.convertReservationToExpansion(
          targetRoom,
          result.plan ? result.plan.parentRoom : takeoverParent,
        );
        printLine(`[OPS] Reserved room ${targetRoom} converted to expansion.`);
      }
      printBlock(empireManager.getExpansionLines());
    }

    return result;
  },

  reserve(targetRoom, parentRoom) {
    let resolvedParent = parentRoom || null;

    const expansion = empireManager.getActiveExpansion(targetRoom);
    if (!resolvedParent && expansion && expansion.parentRoom) {
      resolvedParent = expansion.parentRoom;
    }

    if (!resolvedParent) {
      const currentRoomName = opsState.getCurrentRoomName();
      const currentRoom = currentRoomName ? Game.rooms[currentRoomName] : null;

      if (!currentRoom || !currentRoom.controller || !currentRoom.controller.my) {
        const message =
          "reserve: parent room is required because no current owned room is selected.";
        printLine(`[OPS] ${message}`);
        return {
          ok: false,
          message: message,
        };
      }

      resolvedParent = currentRoom.name;
    }

    const result = reservationManager.createReservation(
      targetRoom,
      resolvedParent,
    );
    printLine(`[OPS] ${result.message}`);

    if (result.ok) {
      if (expansion) {
        empireManager.convertExpansionToReservation(
          targetRoom,
          result.plan ? result.plan.parentRoom : resolvedParent,
        );
        printLine(`[OPS] Expansion room ${targetRoom} converted to reservation.`);
      }
      printBlock(reservationManager.getReservedLines(resolvedParent));
    }

    return result;
  },

  reserved(parentRoom) {
    const lines = reservationManager.getReservedLines(parentRoom);
    printBlock(lines);
    return lines;
  },

  expansions() {
    const lines = empireManager.getExpansionLines();
    printBlock(lines);
    return lines;
  },

  attack(targetRoom, postActionOrOptions, parentRoom, allies) {
    let options = {};

    if (
      postActionOrOptions &&
      typeof postActionOrOptions === "object" &&
      !Array.isArray(postActionOrOptions)
    ) {
      options = {
        postAction: postActionOrOptions.postAction,
        parentRoom: postActionOrOptions.parentRoom,
        allies: postActionOrOptions.allies,
      };
    } else {
      const possiblePostAction = attackManager.normalizePostAction(postActionOrOptions);

      if (
        typeof postActionOrOptions !== "undefined" &&
        possiblePostAction === null &&
        (typeof parentRoom === "undefined" || Array.isArray(parentRoom))
      ) {
        options = {
          postAction: undefined,
          parentRoom: postActionOrOptions,
          allies: parentRoom,
        };
      } else {
        options = {
          postAction: postActionOrOptions,
          parentRoom: parentRoom,
          allies: allies,
        };
      }
    }

    const result = attackManager.createAttack(targetRoom, options);
    printLine(`[OPS] ${result.message}`);
    if (result.ok) {
      printBlock(attackManager.getAttacksLines());
    }
    return result;
  },

  attacks() {
    const lines = attackManager.getAttacksLines();
    printBlock(lines);
    return lines;
  },

  cancelAttack(targetRoom) {
    const result = attackManager.cancelAttack(targetRoom);
    printLine(`[OPS] ${result.message}`);
    return result;
  },

  cancelExpansion(targetRoom) {
    const result = empireManager.cancelExpansion(targetRoom);
    printLine(`[OPS] ${result.message}`);
    return result;
  },

  cancelReserve(targetRoom) {
    const result = reservationManager.cancelReservation(targetRoom);
    printLine(`[OPS] ${result.message}`);
    return result;
  },

  cpuStatus(roomName) {
    return this.room(roomName, "cpu");
  },

  cpu(roomName) {
    return this.room(roomName, "cpu");
  },

  phase(roomName) {
    return this.room(roomName, "build");
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
      this.room();
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
