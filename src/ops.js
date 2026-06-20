const opsState = require("ops_state");
const roomReporting = require("room_reporting");
const empireManager = require("empire_manager");
const reservationManager = require("reservation_manager");
const attackManager = require("attack_manager");
const invasionLog = require("invasion_log");
const opsLogisticsManager = require("ops_logistics_manager");
const terminalBalanceManager = require("terminal_balance_manager");
const transferManager = require("transfer_manager");
const powerManager = require("power_manager");
const pclManager = require("pcl_manager");
const bodies = require("bodies");
const spawnManager = require("spawn_manager");

const MANUAL_SPAWN_ROLES = [
  "jrworker",
  "worker",
  "miner",
  "mineral_miner",
  "hauler",
  "remotehauler",
  "upgrader",
  "repair",
  "claimer",
  "reserver",
  "pioneer",
  "remoteworker",
  "remoteminer",
  "defender",
  "dismantler",
  "assault",
  "combat_healer",
  "controller_attacker",
];

const MANUAL_SPAWN_PROFILES = {
  small: 300,
  medium: 800,
  large: null,
};

const SCAN_SECTIONS = [
  "spawns",
  "powerSpawns",
  "creeps",
  "powerCreeps",
  "structures",
  "sites",
  "resources",
];

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

function getRoomAdvancedOpsMemory(roomName) {
  if (!Memory.rooms) Memory.rooms = {};
  if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
  if (!Memory.rooms[roomName].advancedOps) Memory.rooms[roomName].advancedOps = {};
  return Memory.rooms[roomName].advancedOps;
}

function findOwnedStructure(room, structureType) {
  const matches = room.find(FIND_MY_STRUCTURES, {
    filter: function (structure) {
      return structure.structureType === structureType;
    },
  });
  return matches.length > 0 ? matches[0] : null;
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

function formatResultCode(result) {
  if (result === OK) return "OK";
  if (typeof ERR_BUSY !== "undefined" && result === ERR_BUSY) return "ERR_BUSY";
  if (typeof ERR_NOT_FOUND !== "undefined" && result === ERR_NOT_FOUND) return "ERR_NOT_FOUND";
  if (typeof ERR_NOT_ENOUGH_ENERGY !== "undefined" && result === ERR_NOT_ENOUGH_ENERGY) return "ERR_NOT_ENOUGH_ENERGY";
  if (typeof ERR_INVALID_TARGET !== "undefined" && result === ERR_INVALID_TARGET) return "ERR_INVALID_TARGET";
  if (typeof ERR_INVALID_ARGS !== "undefined" && result === ERR_INVALID_ARGS) return "ERR_INVALID_ARGS";
  if (typeof ERR_NAME_EXISTS !== "undefined" && result === ERR_NAME_EXISTS) return "ERR_NAME_EXISTS";
  return String(result);
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

function getObjectId(target) {
  return target && target.id ? target.id : "no-id";
}

function getShortId(target) {
  const id = getObjectId(target);
  return id.length > 8 ? id.slice(0, 8) + "..." : id;
}

function formatStorePair(target, resourceType) {
  const used = getStoredAmount(target, resourceType);
  const capacity =
    target && target.store && typeof target.store.getCapacity === "function"
      ? target.store.getCapacity(resourceType)
      : target && target.store && typeof target.store.getUsedCapacity === "function" && typeof target.store.getFreeCapacity === "function"
        ? target.store.getUsedCapacity(resourceType) + target.store.getFreeCapacity(resourceType)
        : target && target.storeCapacityResource && typeof target.storeCapacityResource[resourceType] === "number"
          ? target.storeCapacityResource[resourceType]
          : null;
  return fmt(used) + (typeof capacity === "number" ? "/" + fmt(capacity) : "");
}

function getRoomOwnedSpawns(room) {
  if (!room || typeof room.find !== "function") return [];
  return room.find(FIND_MY_STRUCTURES, {
    filter: function (structure) {
      return structure.structureType === STRUCTURE_SPAWN;
    },
  }).sort(function (a, b) {
    return (a.name || a.id || "").localeCompare(b.name || b.id || "");
  });
}

function getRoomPowerSpawns(room) {
  if (!room || typeof room.find !== "function") return [];
  return room.find(FIND_MY_STRUCTURES, {
    filter: function (structure) {
      return structure.structureType === STRUCTURE_POWER_SPAWN;
    },
  }).sort(function (a, b) {
    return (a.id || "").localeCompare(b.id || "");
  });
}

function getRoomCreeps(room, role) {
  if (!room || typeof room.find !== "function") return [];
  const normalizedRole = typeof role === "string" && role.trim() ? role.trim() : null;
  return room.find(FIND_MY_CREEPS).filter(function (creep) {
    return !normalizedRole || (creep.memory && creep.memory.role === normalizedRole);
  }).sort(function (a, b) {
    return (a.name || "").localeCompare(b.name || "");
  });
}

function getPowerCreepRoomName(powerCreep) {
  if (!powerCreep) return null;
  if (powerCreep.room && powerCreep.room.name) return powerCreep.room.name;
  if (powerCreep.pos && powerCreep.pos.roomName) return powerCreep.pos.roomName;
  return null;
}

function getPowerCreepCooldown(powerCreep) {
  if (!powerCreep || !powerCreep.powers) return 0;
  let cooldown = 0;
  for (const powerName in powerCreep.powers) {
    if (!Object.prototype.hasOwnProperty.call(powerCreep.powers, powerName)) continue;
    const info = powerCreep.powers[powerName];
    if (info && typeof info.cooldown === "number") {
      cooldown = Math.max(cooldown, info.cooldown);
    }
  }
  return cooldown;
}

function getRoomPowerCreeps(roomName) {
  const powerCreeps = Game.powerCreeps || {};
  return Object.keys(powerCreeps)
    .sort()
    .map(function (name) {
      return powerCreeps[name];
    })
    .filter(function (powerCreep) {
      return !roomName || getPowerCreepRoomName(powerCreep) === roomName;
    });
}

function countBy(items, getKey) {
  const counts = {};
  for (let i = 0; i < items.length; i++) {
    const key = getKey(items[i]) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function formatCounts(counts) {
  const keys = Object.keys(counts).sort();
  if (keys.length === 0) return "none";
  return keys.map(function (key) {
    return key + " " + counts[key];
  }).join(", ");
}

function formatSpawnLine(spawn) {
  const status = spawn.spawning
    ? "busy " + (spawn.spawning.name || "unknown")
    : "idle";
  return (
    `  ${spawn.name || getShortId(spawn)}: ${status}, ` +
    `energy ${formatStorePair(spawn, RESOURCE_ENERGY)}`
  );
}

function formatPowerSpawnLine(powerSpawn) {
  return (
    `  PowerSpawn ${getShortId(powerSpawn)}: id ${getObjectId(powerSpawn)}, ` +
    `energy ${fmt(getStoredAmount(powerSpawn, RESOURCE_ENERGY))}, ` +
    `power ${fmt(getStoredAmount(powerSpawn, RESOURCE_POWER))}`
  );
}

function formatPowerCreepLine(powerCreep) {
  const spawned = powerCreep && (powerCreep.ticksToLive || powerCreep.room || powerCreep.pos);
  return (
    `  ${powerCreep.name}: ${spawned ? "spawned" : "unspawned"}, ` +
    `room ${getPowerCreepRoomName(powerCreep) || "none"}, ` +
    `ttl ${typeof powerCreep.ticksToLive === "number" ? fmt(powerCreep.ticksToLive) : "--"}, ` +
    `ops ${fmt(getStoredAmount(powerCreep, getOpsResourceType()))}, ` +
    `cooldown ${fmt(getPowerCreepCooldown(powerCreep))}`
  );
}

function getMajorStructureRows(room) {
  const structures = room.find(FIND_STRUCTURES);
  const majorTypes = {};
  [
    STRUCTURE_SPAWN,
    STRUCTURE_EXTENSION,
    STRUCTURE_TOWER,
    STRUCTURE_STORAGE,
    STRUCTURE_TERMINAL,
    STRUCTURE_LINK,
    STRUCTURE_LAB,
    STRUCTURE_FACTORY,
    STRUCTURE_OBSERVER,
    STRUCTURE_POWER_SPAWN,
    STRUCTURE_NUKER,
  ].forEach(function (type) {
    majorTypes[type] = true;
  });
  return structures.filter(function (structure) {
    return majorTypes[structure.structureType];
  });
}

function getRoomResources(room) {
  const rows = [];
  if (typeof FIND_DROPPED_RESOURCES !== "undefined") {
    const dropped = room.find(FIND_DROPPED_RESOURCES).filter(function (resource) {
      return (resource.amount || 0) > 0;
    });
    for (let i = 0; i < dropped.length; i++) {
      rows.push({
        type: "dropped",
        resourceType: dropped[i].resourceType,
        amount: dropped[i].amount || 0,
        id: getObjectId(dropped[i]),
      });
    }
  }
  if (typeof FIND_TOMBSTONES !== "undefined") {
    const tombstones = room.find(FIND_TOMBSTONES);
    for (let j = 0; j < tombstones.length; j++) {
      rows.push({
        type: "tombstone",
        resourceType: "stored",
        amount: getStoreTotal(tombstones[j]),
        id: getObjectId(tombstones[j]),
      });
    }
  }
  if (typeof FIND_RUINS !== "undefined") {
    const ruins = room.find(FIND_RUINS);
    for (let k = 0; k < ruins.length; k++) {
      rows.push({
        type: "ruin",
        resourceType: "stored",
        amount: getStoreTotal(ruins[k]),
        id: getObjectId(ruins[k]),
      });
    }
  }
  return rows.filter(function (row) {
    return row.amount > 0;
  }).sort(function (a, b) {
    if (b.amount !== a.amount) return b.amount - a.amount;
    return a.id.localeCompare(b.id);
  });
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

function normalizeScanSection(section) {
  if (typeof section === "undefined" || section === null || section === "") return "summary";
  const normalized = String(section).trim().toLowerCase();
  if (normalized === "powerspawns" || normalized === "power_spawns" || normalized === "power-spawns") {
    return "powerSpawns";
  }
  if (normalized === "powercreeps" || normalized === "power_creeps" || normalized === "power-creeps") {
    return "powerCreeps";
  }
  if (SCAN_SECTIONS.indexOf(normalized) !== -1) return normalized;
  return null;
}

function buildScanLines(room, section, roleFilter) {
  const normalized = normalizeScanSection(section);
  if (!normalized) {
    return ['[OPS] scan: section must be spawns, powerSpawns, creeps, powerCreeps, structures, sites, or resources.'];
  }

  const spawns = getRoomOwnedSpawns(room);
  const powerSpawns = getRoomPowerSpawns(room);
  const creeps = getRoomCreeps(room, roleFilter);
  const powerCreeps = getRoomPowerCreeps(room.name);
  const lines = [`[OPS] Scan ${room.name} / ${normalized}`];

  if (normalized === "summary") {
    lines.push(`  Spawns: ${spawns.length}`);
    lines.push(`  Power Spawns: ${powerSpawns.length}`);
    lines.push(`  Creeps: ${formatCounts(countBy(creeps, function (creep) { return creep.memory && creep.memory.role; }))}`);
    lines.push(`  PowerCreeps: ${powerCreeps.length}`);
    lines.push(`  Structures: ${getMajorStructureRows(room).length}`);
    lines.push(`  Sites: ${room.find(FIND_CONSTRUCTION_SITES).length}`);
    lines.push(`  Resources: ${getRoomResources(room).length}`);
    return lines;
  }

  if (normalized === "spawns") {
    if (spawns.length === 0) lines.push("  none");
    for (let i = 0; i < spawns.length; i++) lines.push(formatSpawnLine(spawns[i]));
    return lines;
  }

  if (normalized === "powerSpawns") {
    if (powerSpawns.length === 0) lines.push("  none");
    for (let j = 0; j < powerSpawns.length; j++) lines.push(formatPowerSpawnLine(powerSpawns[j]));
    return lines;
  }

  if (normalized === "creeps") {
    const counts = countBy(creeps, function (creep) {
      return creep.memory && creep.memory.role;
    });
    lines.push(`  Role counts: ${formatCounts(counts)}`);
    return lines;
  }

  if (normalized === "powerCreeps") {
    if (powerCreeps.length === 0) lines.push("  none");
    for (let k = 0; k < powerCreeps.length; k++) lines.push(formatPowerCreepLine(powerCreeps[k]));
    return lines;
  }

  if (normalized === "structures") {
    const counts = countBy(getMajorStructureRows(room), function (structure) {
      return structure.structureType;
    });
    lines.push(`  Major structures: ${formatCounts(counts)}`);
    return lines;
  }

  if (normalized === "sites") {
    const counts = countBy(room.find(FIND_CONSTRUCTION_SITES), function (site) {
      return site.structureType;
    });
    lines.push(`  Construction sites: ${formatCounts(counts)}`);
    return lines;
  }

  const resources = getRoomResources(room);
  if (resources.length === 0) {
    lines.push("  none");
    return lines;
  }
  for (let r = 0; r < Math.min(resources.length, 10); r++) {
    lines.push(`  ${resources[r].type} ${resources[r].resourceType}: ${fmt(resources[r].amount)} id ${resources[r].id}`);
  }
  if (resources.length > 10) lines.push(`  ... +${resources.length - 10} more`);
  return lines;
}

function parseSpawnOptions(sizeOrOptions, maybeOptions) {
  const extra =
    maybeOptions && typeof maybeOptions === "object" && !Array.isArray(maybeOptions)
      ? maybeOptions
      : {};

  if (typeof sizeOrOptions === "undefined" || sizeOrOptions === null) {
    return {
      size: typeof extra.size === "string" ? extra.size.trim() : "medium",
      spawn: extra.spawn || extra.spawnName || extra.spawnId || null,
      dryRun: !!(extra.dryRun || extra.preview || extra.check),
      preview: !!(extra.preview || extra.dryRun || extra.check),
    };
  }
  if (typeof sizeOrOptions === "string") {
    return {
      size: sizeOrOptions.trim(),
      spawn: extra.spawn || extra.spawnName || extra.spawnId || null,
      dryRun: !!(extra.dryRun || extra.preview || extra.check),
      preview: !!(extra.preview || extra.dryRun || extra.check),
    };
  }
  if (typeof sizeOrOptions === "object" && !Array.isArray(sizeOrOptions)) {
    return {
      size: typeof sizeOrOptions.size === "string" ? sizeOrOptions.size.trim() : "medium",
      spawn: sizeOrOptions.spawn || sizeOrOptions.spawnName || sizeOrOptions.spawnId || null,
      dryRun: !!(sizeOrOptions.dryRun || sizeOrOptions.preview || sizeOrOptions.check),
      preview: !!(sizeOrOptions.preview || sizeOrOptions.dryRun || sizeOrOptions.check),
    };
  }
  return null;
}

function resolveManualSpawnEnergyLimit(room, size) {
  const normalized = typeof size === "string" ? size.trim().toLowerCase() : "medium";
  if (!Object.prototype.hasOwnProperty.call(MANUAL_SPAWN_PROFILES, normalized)) return null;
  if (normalized === "large") return Math.max(300, room.energyCapacityAvailable || room.energyAvailable || 300);
  return Math.min(
    Math.max(300, room.energyCapacityAvailable || room.energyAvailable || 300),
    MANUAL_SPAWN_PROFILES[normalized],
  );
}

function resolveOwnedSpawn(room, spawnSelector) {
  const spawns = getRoomOwnedSpawns(room);
  if (!spawnSelector) return spawns.length > 0 ? spawns[0] : null;
  const selector = String(spawnSelector);

  for (let i = 0; i < spawns.length; i++) {
    if (spawns[i].name === selector || spawns[i].id === selector) return spawns[i];
  }
  if (Game.spawns && Game.spawns[selector]) {
    const spawn = Game.spawns[selector];
    if (spawn.room && spawn.room.name === room.name && spawn.my !== false) return spawn;
  }
  const byId = Game.getObjectById ? Game.getObjectById(selector) : null;
  if (
    byId &&
    byId.structureType === STRUCTURE_SPAWN &&
    byId.room &&
    byId.room.name === room.name &&
    byId.my !== false
  ) {
    return byId;
  }
  return null;
}

function getManualBodyPlan(room, role, size, state) {
  const energyLimit = resolveManualSpawnEnergyLimit(room, size);
  if (energyLimit === null) return null;
  return bodies.plan(role, room, { role: role, energyLimit: energyLimit }, state || null);
}

function buildManualSpawnResultLine(room, role, spawn, plan, result, dryRun) {
  return (
    `[OPS] spawn ${room.name}: ${dryRun ? "preview" : "result"} ${formatResultCode(result)} (${result}) | ` +
    `spawn ${spawn.name || getShortId(spawn)} | role ${role} | profile ${plan.profile || "unknown"} | ` +
    `cost ${fmt(plan.cost)} | parts ${plan.parts}`
  );
}

function countBodyParts(body) {
  const counts = {};
  const order = [];

  for (let i = 0; i < (body || []).length; i++) {
    const part = body[i];
    if (!Object.prototype.hasOwnProperty.call(counts, part)) {
      counts[part] = 0;
      order.push(part);
    }
    counts[part]++;
  }

  return order.map(function (part) {
    return part + " " + counts[part];
  }).join(", ");
}

function buildManualSpawnPreviewLines(room, role, size, spawn, plan, validation, blockedReason) {
  const spawnLabel = spawn ? spawn.name || getShortId(spawn) : "none";
  const validNow = !blockedReason;
  const body = plan && plan.body ? plan.body : [];
  const cost = plan && typeof plan.cost === "number" ? plan.cost : 0;
  const parts = plan && typeof plan.parts === "number" ? plan.parts : body.length;
  const reason = blockedReason || "none";

  return [
    `[OPS] Spawn preview ${room.name}`,
    `Room ${room.name} | Role ${role} | Size ${size} | Profile ${plan && plan.profile ? plan.profile : "unknown"}`,
    `Selected spawn ${spawnLabel}`,
    `Body ${body.join(", ") || "none"}`,
    `Body counts ${countBodyParts(body) || "none"}`,
    `Cost ${fmt(cost)} | Energy ${fmt(room.energyAvailable || 0)}/${fmt(room.energyCapacityAvailable || 0)}`,
    `Spawn time ${fmt(parts * 3)} ticks | Parts ${parts}`,
    `Valid now ${validNow ? "yes" : "no"} | Blocked ${reason}`,
    validation && !validation.valid
      ? `Validation ${validation.reason}`
      : "Validation OK",
  ];
}

function parsePowerSpawnOptions(roomOrOptions) {
  if (typeof roomOrOptions === "string") {
    return { room: roomOrOptions.trim(), powerSpawn: null, dryRun: false };
  }
  if (typeof roomOrOptions === "object" && roomOrOptions !== null && !Array.isArray(roomOrOptions)) {
    return {
      room: roomOrOptions.room || roomOrOptions.roomName || null,
      powerSpawn: roomOrOptions.powerSpawn || roomOrOptions.powerSpawnId || null,
      dryRun: !!(roomOrOptions.dryRun || roomOrOptions.preview || roomOrOptions.check),
    };
  }
  return { room: null, powerSpawn: null, dryRun: false };
}

function resolvePowerSpawn(room, selector) {
  const powerSpawns = getRoomPowerSpawns(room);
  if (!selector) return powerSpawns.length > 0 ? powerSpawns[0] : null;
  const normalized = String(selector);
  for (let i = 0; i < powerSpawns.length; i++) {
    if (powerSpawns[i].id === normalized || powerSpawns[i].name === normalized) return powerSpawns[i];
  }
  const byId = Game.getObjectById ? Game.getObjectById(normalized) : null;
  if (
    byId &&
    byId.structureType === STRUCTURE_POWER_SPAWN &&
    byId.room &&
    byId.room.name === room.name &&
    byId.my !== false
  ) {
    return byId;
  }
  return null;
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
    `pending ${power.refillPendingRequests || 0} | owner power_manager execution ops_logistics | ` +
    `last ${typeof power.lastProcessed === "number" ? power.lastProcessed : "--"} total ${fmt(power.totalProcessed || 0)}`
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
        "Show one room report. Sections include roles, factory, labs, labor, logistics, power, observer, and resources status.",
      example: 'ops.room("W5N5", "labor")',
    },
    {
      command: "ops.rooms()",
      group: "Reports",
      description: "Show overview lines for all owned rooms.",
      example: "ops.rooms()",
    },
    {
      command: 'ops.scan(roomName, [section], [role])',
      group: "Reports",
      description:
        "Read-only room/object discovery. Sections: spawns, powerSpawns, creeps, powerCreeps, structures, sites, resources.",
      example: 'ops.scan("W42N9", "spawns")',
    },
    {
      command: 'ops.spawn(roomName, role, [size|options])',
      group: "Manual Actions",
      description:
        "Preview or explicitly spawn one normal creep after validating owned room, role, profile, selected spawn, body, cost, and energy.",
      example: 'ops.spawn("W42N9", "worker", "medium", { preview: true })',
    },
    {
      command: 'ops.spawn("power", name, [room|options])',
      group: "Manual Actions",
      description:
        "Explicitly spawn one PowerCreep at an owned Power Spawn. Does not enable rooms, move, or use powers.",
      example: 'ops.spawn("power", "Operator_GenOps", { room: "W42N9", powerSpawn: "id" })',
    },
    {
      command: 'ops.empire(["logistics"|"labor"])',
      group: "Reports",
      description: "Show empire summary, logistics pressure, or labor coverage rollup across owned rooms.",
      example: 'ops.empire("labor")',
    },
    {
      command: 'ops.factory(roomName, ["status"|"preview"|"battery"|"pause"|"resume"], [policy])',
      group: "Reports",
      description:
        "Show factory status or explicitly set battery policy/pause state. No market, terminal, planner, or production action is created.",
      example: 'ops.factory("W5N5", "battery", "reserve")',
    },
    {
      command: 'ops.labs(roomName, ["status"|"preview"|"pause"|"resume"])',
      group: "Reports",
      description:
        "Show lab status or explicitly set lab pause state. No boost, market, terminal, or reaction action is created.",
      example: 'ops.labs("W5N5", "pause")',
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
      command: 'ops.powerCreep(name, "assign", room)',
      description: "Assign a Power Creep home room for renewal assist only.",
      example: 'ops.powerCreep("OperatorOne", "assign", "W5N5")',
    },
    {
      command: 'ops.powerCreep(name, "renewAssist", on|off)',
      description: "Toggle per-creep renewal assist for an assigned Power Creep.",
      example: 'ops.powerCreep("OperatorOne", "renewAssist", "off")',
    },
    {
      command: 'ops.powerCreep(name, "renewStatus")',
      description: "Show concise Power Creep renewal assist state.",
      example: 'ops.powerCreep("OperatorOne", "renewStatus")',
    },
    {
      command: 'ops.powerCreep(name, "generateOps", mode)',
      description:
        "Check or explicitly confirm manual GENERATE_OPS use on a spawned Power Creep. Configured Operator_GenOps banking is reported through room power.",
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
      command: "ops.transfer(resource, amount, fromRoom, fromLocation, toRoom, toLocation, mode)",
      description:
        "Check or confirm an explicit staged room-to-room transfer plan.",
      example: 'ops.transfer(RESOURCE_POWER, 1000, "W41N7", "storage", "W42N9", "storage", "check")',
    },
    {
      command: "ops.transfer(resource, amount, fromRoom, fromLocation, toRoom, toLocation, mode)",
      description:
        "Confirm only after reviewing the check output.",
      example: 'ops.transfer(RESOURCE_POWER, 1000, "W41N7", "storage", "W42N9", "storage", "confirm")',
    },
    {
      command: "ops.transfers()",
      description: "Show active staged transfer plans.",
      example: "ops.transfers()",
    },
    {
      command: "ops.transferStatus(id)",
      description: "Show detailed status for a staged transfer plan.",
      example: 'ops.transferStatus("ot_123_W41N7_W42N9_4567")',
    },
    {
      command: "ops.cancelTransfer(id)",
      description: "Cancel an active staged transfer plan.",
      example: 'ops.cancelTransfer("ot_123_W41N7_W42N9_4567")',
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
      command: "ops.requests([roomName], [mode])",
      description:
        "Show ops logistics requests. Pass blocked for blocked only, or all/history for completed, canceled, and expired requests.",
      example: 'ops.requests("W42N9", "blocked")',
    },
    {
      command: 'ops.cancelRequests(roomName, "blocked", [filters])',
      description:
        "Safely cancel stale blocked unclaimed ops logistics requests with optional resource/from/to/olderThan filters.",
      example: 'ops.cancelRequests("W42N9", "blocked", { resource: RESOURCE_POWER, from: "terminal", to: "powerSpawn", olderThan: 1000 })',
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
  const lines = ["[OPS] Omega Console Commands"];
  let activeGroup = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const group = row.group || "Operations";
    if (group !== activeGroup) {
      lines.push("");
      lines.push(`[OPS] ${group}`);
      activeGroup = group;
    }

    lines.push(`  - ${row.command}`);
    const descriptionLines = wrapHelpLine("    ", row.description, 86);
    for (let j = 0; j < descriptionLines.length; j++) {
      lines.push(descriptionLines[j]);
    }
    const exampleLines = wrapHelpLine("    example: ", row.example, 86);
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

function formatRequestFilters(filters) {
  const parts = [];

  if (!filters) return "none";
  if (filters.resourceType) parts.push("resource " + filters.resourceType);
  if (filters.from) parts.push("from " + filters.from);
  if (filters.to) parts.push("to " + filters.to);
  if (typeof filters.olderThan === "number") {
    parts.push(
      "olderThan " +
        fmt(filters.olderThan) +
        (filters.defaultOlderThan ? " default" : ""),
    );
  }

  return parts.length > 0 ? parts.join(", ") : "none";
}

function formatSkippedReasons(skipped) {
  if (!skipped || skipped.length === 0) return "none";

  const counts = {};
  for (let i = 0; i < skipped.length; i++) {
    const reason = skipped[i].reason || "unknown";
    counts[reason] = (counts[reason] || 0) + 1;
  }

  return Object.keys(counts)
    .sort()
    .map(function (reason) {
      return reason + " " + counts[reason];
    })
    .join(", ");
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
      scan: function (roomName, section, role) {
        return module.exports.scan(roomName, section, role);
      },
      spawn: function (roomNameOrPower, roleOrName, sizeOrOptions, maybeOptions) {
        return module.exports.spawn(roomNameOrPower, roleOrName, sizeOrOptions, maybeOptions);
      },
      empire: function (section) {
        return module.exports.empire(section);
      },
      factory: function (roomName, mode, product) {
        return module.exports.factory(roomName, mode, product);
      },
      labs: function (roomName, mode) {
        return module.exports.labs(roomName, mode);
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
      transfer: function (resource, amount, fromRoom, fromLocation, toRoom, toLocation, mode) {
        return module.exports.transfer(resource, amount, fromRoom, fromLocation, toRoom, toLocation, mode);
      },
      transfers: function () {
        return module.exports.transfers();
      },
      transferStatus: function (id) {
        return module.exports.transferStatus(id);
      },
      cancelTransfer: function (id) {
        return module.exports.cancelTransfer(id);
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
      cancelRequests: function (roomName, status, filters) {
        return module.exports.cancelRequests(roomName, status, filters);
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

  scan(roomName, section, role) {
    const room = getTargetRoomOrPrintError(roomName, "scan");
    if (!room) return null;
    opsState.setCurrentRoomName(room.name);

    return printBlock(buildScanLines(room, section, role));
  },

  spawn(roomNameOrPower, roleOrName, sizeOrOptions, maybeOptions) {
    const normalizedFirst =
      typeof roomNameOrPower === "string" ? roomNameOrPower.trim().toLowerCase() : roomNameOrPower;
    if (normalizedFirst === "power") {
      return this.spawnPowerCreep(roleOrName, sizeOrOptions);
    }

    return this.spawnCreep(roomNameOrPower, roleOrName, sizeOrOptions, maybeOptions);
  },

  spawnCreep(roomName, role, sizeOrOptions, maybeOptions) {
    if (!roomName) {
      return printLine('[OPS] spawn: room required. Use ops.spawn("ROOM", "role", "medium").');
    }
    if (!role) {
      return printLine('[OPS] spawn: role required. Use ops.spawn("ROOM", "role", "medium").');
    }

    const room = Game.rooms && Game.rooms[roomName] ? Game.rooms[roomName] : null;
    if (!room || !room.controller || !room.controller.my) {
      return printLine(`[OPS] spawn: owned room "${roomName}" not found.`);
    }

    const normalizedRole = String(role).trim();
    if (MANUAL_SPAWN_ROLES.indexOf(normalizedRole) === -1) {
      return printLine(`[OPS] spawn ${room.name}: role "${normalizedRole}" is not supported.`);
    }

    const options = parseSpawnOptions(sizeOrOptions, maybeOptions);
    if (!options) {
      return printLine('[OPS] spawn: options must be a size string or object.');
    }

    const normalizedSize = String(options.size || "medium").trim().toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(MANUAL_SPAWN_PROFILES, normalizedSize)) {
      return printLine(`[OPS] spawn ${room.name}: profile "${normalizedSize}" not found. Use small, medium, or large.`);
    }

    const plan = getManualBodyPlan(room, normalizedRole, normalizedSize, null);
    const validation = bodies.validateBody(plan && plan.body);
    const spawn = resolveOwnedSpawn(room, options.spawn);
    let blockedReason = null;

    if (!spawn) {
      blockedReason = options.spawn ? "selected_spawn_not_found" : "no_idle_spawn";
    } else if (spawn.spawning) {
      blockedReason = "spawn_busy";
    } else if (!validation.valid) {
      blockedReason = validation.reason;
    } else if ((room.energyAvailable || 0) < plan.cost) {
      blockedReason = "insufficient_energy";
    }

    if (options.preview || options.dryRun) {
      const lines = buildManualSpawnPreviewLines(
        room,
        normalizedRole,
        normalizedSize,
        spawn,
        plan,
        validation,
        blockedReason,
      );
      return printBlock(lines);
    }

    if (!spawn) {
      const selector = options.spawn ? ` "${options.spawn}"` : "";
      return printLine(`[OPS] spawn ${room.name}: owned spawn${selector} not found.`);
    }
    if (spawn.spawning) {
      return printLine(`[OPS] spawn ${room.name}: spawn ${spawn.name || getShortId(spawn)} is busy.`);
    }

    if (!validation.valid) {
      return printLine(`[OPS] spawn ${room.name}: role "${normalizedRole}" profile "${normalizedSize}" invalid body ${validation.reason}.`);
    }
    if ((room.energyAvailable || 0) < plan.cost) {
      return printLine(`[OPS] spawn ${room.name}: insufficient energy ${fmt(room.energyAvailable || 0)}/${fmt(plan.cost)} for ${normalizedRole} ${normalizedSize}.`);
    }

    const name = spawnManager.getSpawnName(normalizedRole, spawn);
    const result = spawn.spawnCreep(plan.body, name, {
      memory: {
        role: normalizedRole,
        room: room.name,
        homeRoom: room.name,
        working: false,
        delivering: false,
        manualSpawn: true,
        bodyProfile: plan.profile || null,
        bodyCost: plan.cost || null,
      },
    });
    return printLine(buildManualSpawnResultLine(room, normalizedRole, spawn, plan, result, false));
  },

  spawnPowerCreep(powerCreepName, roomOrOptions) {
    if (!powerCreepName) {
      return printLine('[OPS] spawn power: PowerCreep name required. Use ops.spawn("power", "NAME", "ROOM").');
    }
    const powerCreep = Game.powerCreeps && Game.powerCreeps[powerCreepName]
      ? Game.powerCreeps[powerCreepName]
      : null;
    if (!powerCreep) {
      return printLine(`[OPS] spawn power: PowerCreep "${powerCreepName}" not found.`);
    }

    const options = parsePowerSpawnOptions(roomOrOptions);
    const targetRoomName = options.room || getPowerCreepRoomName(powerCreep);
    if (!targetRoomName) {
      return printLine(`[OPS] spawn power ${powerCreepName}: target room required.`);
    }

    const room = Game.rooms && Game.rooms[targetRoomName] ? Game.rooms[targetRoomName] : null;
    if (!room || !room.controller || !room.controller.my) {
      return printLine(`[OPS] spawn power ${powerCreepName}: owned room "${targetRoomName}" not found.`);
    }

    const powerSpawn = resolvePowerSpawn(room, options.powerSpawn);
    if (!powerSpawn) {
      const selector = options.powerSpawn ? ` "${options.powerSpawn}"` : "";
      return printLine(`[OPS] spawn power ${powerCreepName}: owned Power Spawn${selector} not found in ${room.name}.`);
    }

    if (powerCreep.ticksToLive || powerCreep.room || powerCreep.pos) {
      return printLine(`[OPS] spawn power ${powerCreepName}: PowerCreep is already spawned.`);
    }

    if (options.dryRun) {
      return printLine(`[OPS] spawn power ${powerCreepName}: preview OK (0) | room ${room.name} | powerSpawn ${getShortId(powerSpawn)}`);
    }

    if (typeof powerCreep.spawn !== "function") {
      return printLine(`[OPS] spawn power ${powerCreepName}: spawn method unavailable.`);
    }

    const result = powerCreep.spawn(powerSpawn);
    return printLine(
      `[OPS] spawn power ${powerCreepName}: result ${formatResultCode(result)} (${result}) | ` +
        `room ${room.name} | powerSpawn ${getShortId(powerSpawn)}`,
    );
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
        '[OPS] room: invalid section. Use overview, economy, build, defense, creeps, roles, sources, resources, factory, labs, labor, logistics, advanced, power, observer, cpu, or all.',
      );
    }

    printBlock(lines);

    if (parsed.section === "cpu") {
      return `[OPS][${room.name}][CPU] report generated`;
    }
    if (parsed.section === "logistics") {
      return `[OPS][${room.name}][LOGISTICS] report generated`;
    }
    if (parsed.section === "factory") {
      return `[OPS][${room.name}][FACTORY] report generated`;
    }
    if (parsed.section === "labs") {
      return `[OPS][${room.name}][LABS] report generated`;
    }
    if (parsed.section === "labor") {
      return `[OPS][${room.name}][LABOR] report generated`;
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

    if (!powerCreepName || !action) {
      return printLine(
        '[OPS] powerCreep: use ops.powerCreep("CREEP_NAME", "assign|unassign|renewAssist|renewStatus|spawn|renew|position|move", ...).',
      );
    }

    if (normalizedAction === "assign") {
      const result = pclManager.assignPowerCreep(powerCreepName, roomName);
      return printLine(result.message);
    }

    if (normalizedAction === "unassign") {
      const result = pclManager.unassignPowerCreep(powerCreepName);
      return printLine(result.message);
    }

    if (normalizedAction === "renewassist") {
      const result = pclManager.setPowerCreepRenewAssist(powerCreepName, roomName);
      return printLine(result.message);
    }

    if (normalizedAction === "renewstatus") {
      const report = pclManager.formatPowerCreepRenewStatus(powerCreepName);
      printBlock(report.split("\n"));
      return report;
    }

    if (!roomName && normalizedAction !== "generateops") {
      return printLine(
        '[OPS] powerCreep: room required for spawn, renew, position, and move.',
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

  empire(section) {
    const ownedRooms = getOwnedRooms();
    if (ownedRooms.length === 0) {
      return printLine("[OPS] empire: no owned rooms available.");
    }

    const reports = empireManager.buildRoomReports(ownedRooms, null, {
      updateProgress: true,
    });

    const normalizedSection =
      typeof section === "string" ? section.trim().toLowerCase() : null;
    if (normalizedSection === "logistics") {
      const rollup = opsLogisticsManager.buildEmpirePressureRollup(reports);
      const lines = opsLogisticsManager.formatEmpirePressureRollup(rollup);
      printBlock(lines);
      return {
        section: "logistics",
        lines: lines,
        rollup: rollup,
      };
    }

    if (normalizedSection === "labor") {
      const rollup = roomReporting.buildEmpireLaborRollup(reports);
      const lines = roomReporting.formatEmpireLaborRollup(rollup);
      printBlock(lines);
      return {
        section: "labor",
        lines: lines,
        rollup: rollup,
      };
    }

    const report = empireManager.buildReport(reports);

    printBlock(report.lines);

    return report;
  },

  factory(roomName, mode, product) {
    const normalizedMode =
      typeof mode === "string" ? mode.trim().toLowerCase() : "status";
    const room = getTargetRoomOrPrintError(roomName, "factory");
    if (!room) return null;
    opsState.setCurrentRoomName(room.name);

    if (normalizedMode === "pause" || normalizedMode === "resume") {
      const factory = findOwnedStructure(room, STRUCTURE_FACTORY);
      if (!factory) {
        return printLine(`[OPS][${room.name}][FACTORY] ${normalizedMode}: blocked; factory missing.`);
      }

      const memory = getRoomAdvancedOpsMemory(room.name);
      memory.factoryPaused = normalizedMode === "pause";
      memory.factoryPauseUpdated = Game.time;
      return printLine(
        `[OPS][${room.name}][FACTORY] ${normalizedMode}: factory pause ${memory.factoryPaused ? "enabled" : "cleared"}.`,
      );
    }

    if (normalizedMode === "stop" || normalizedMode === "off") {
      return printLine('[OPS] factory: invalid mode. Use status, preview, battery, pause, or resume.');
    }

    if (normalizedMode === "battery" && typeof product === "string") {
      const policy = product.trim().toLowerCase();
      if (["reserve", "commodity", "disabled"].indexOf(policy) === -1) {
        return printLine('[OPS] factory battery: invalid policy. Use reserve, commodity, or disabled.');
      }

      const factory = findOwnedStructure(room, STRUCTURE_FACTORY);
      if (!factory) {
        return printLine(`[OPS][${room.name}][FACTORY] battery ${policy}: blocked; factory missing.`);
      }

      const memory = getRoomAdvancedOpsMemory(room.name);
      memory.batteryPolicy = policy;
      memory.batteryPolicyUpdated = Game.time;
      return printLine(
        `[OPS][${room.name}][FACTORY] battery policy ${policy} stored | No market, terminal, planner, or production action performed.`,
      );
    }

    if (
      normalizedMode !== "status" &&
      normalizedMode !== "preview" &&
      normalizedMode !== "battery" &&
      normalizedMode !== "undefined"
    ) {
      return printLine(
        '[OPS] factory: invalid mode. Use status, preview, battery, pause, or resume.',
      );
    }

    const report = roomReporting.build(room, null, { updateProgress: true });
    const lines = roomReporting.getSectionLines(report, "factory").slice();
    if (normalizedMode === "preview" || normalizedMode === "battery") {
      const previewProduct =
        normalizedMode === "battery"
          ? "battery"
          : product || report.factory.configuredProduct || "none";
      lines.push(
        `[OPS][${room.name}][FACTORY] preview ${previewProduct} | No production executed.`,
      );
    }
    printBlock(lines);
    return `[OPS][${room.name}][FACTORY] report generated`;
  },

  labs(roomName, mode) {
    const normalizedMode =
      typeof mode === "string" ? mode.trim().toLowerCase() : "status";
    const room = getTargetRoomOrPrintError(roomName, "labs");
    if (!room) return null;
    opsState.setCurrentRoomName(room.name);

    if (normalizedMode === "pause" || normalizedMode === "resume") {
      const labs = room.find(FIND_MY_STRUCTURES, {
        filter: function (structure) {
          return structure.structureType === STRUCTURE_LAB;
        },
      });
      if (labs.length === 0) {
        return printLine(`[OPS][${room.name}][LABS] ${normalizedMode}: blocked; labs missing.`);
      }

      const memory = getRoomAdvancedOpsMemory(room.name);
      memory.labsPaused = normalizedMode === "pause";
      memory.labsPauseUpdated = Game.time;
      return printLine(
        `[OPS][${room.name}][LABS] ${normalizedMode}: lab pause ${memory.labsPaused ? "enabled" : "cleared"}.`,
      );
    }

    if (normalizedMode === "stop" || normalizedMode === "off") {
      return printLine('[OPS] labs: invalid mode. Use status, preview, pause, or resume.');
    }

    if (
      normalizedMode !== "status" &&
      normalizedMode !== "preview" &&
      normalizedMode !== "undefined"
    ) {
      return printLine('[OPS] labs: invalid mode. Use status, preview, pause, or resume.');
    }

    const report = roomReporting.build(room, null, { updateProgress: true });
    const lines = roomReporting.getSectionLines(report, "labs").slice();
    if (normalizedMode === "preview") {
      lines.push(`[OPS][${room.name}][LABS] preview | No reaction executed.`);
    }
    printBlock(lines);
    return `[OPS][${room.name}][LABS] report generated`;
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

  transfer(resource, amount, fromRoom, fromLocation, toRoom, toLocation, mode) {
    return printLine(
      transferManager.transfer(
        resource,
        amount,
        fromRoom,
        fromLocation,
        toRoom,
        toLocation,
        mode,
      ),
    );
  },

  transfers() {
    return printBlock(transferManager.transfers().split("\n"));
  },

  transferStatus(id) {
    return printBlock(transferManager.transferStatus(id).split("\n"));
  },

  cancelTransfer(id) {
    return printLine(transferManager.cancelTransfer(id));
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
    const blockedOnly = firstArg === "blocked" || secondArg === "blocked";
    const resolvedRoomName =
      firstArg === "all" || firstArg === "history" || firstArg === "blocked"
        ? null
        : roomName;
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

    const rows = blockedOnly
      ? allRows.filter(function (row) {
          return row.status === "blocked";
        })
      : includeAll
        ? allRows
        : allRows.filter(function (row) {
          return row.status === "open" || row.status === "blocked";
        });
    const lines = [
      (resolvedRoomName
        ? `[OPS] Logistics requests for ${resolvedRoomName}`
        : "[OPS] Logistics requests") +
        (blockedOnly ? " (blocked)" : includeAll ? " (all)" : " (active)") +
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
          ` | claimed ${fmt(row.claimed)}` +
          ` | age ${fmt(row.age)}` +
          ` | reason ${row.reason || "none"}` +
          ` | created ${typeof row.createdAt === "number" ? row.createdAt : "--"}` +
          ` | updated ${typeof row.updatedAt === "number" ? row.updatedAt : "--"}`,
      );
    }

    return printBlock(lines);
  },

  cancelRequests(roomName, status, filters) {
    const normalizedStatus =
      typeof status === "string" ? status.trim().toLowerCase() : status;

    if (!roomName) {
      return printLine("[OPS] cancelRequests: roomName required.");
    }

    if (normalizedStatus !== "blocked") {
      return printLine('[OPS] cancelRequests: only "blocked" cleanup is supported.');
    }

    const result = opsLogisticsManager.cancelBlockedRequests(roomName, filters);
    const canceledIds = result.canceled || [];
    const visibleCanceled = canceledIds.slice(0, 10);
    const lines = [
      `[OPS] cancelRequests ${roomName} blocked`,
      `  filters ${formatRequestFilters(result.filters)}`,
      `  matched ${fmt(result.matched)} | canceled ${fmt(canceledIds.length)} | skipped ${fmt(result.skipped.length)}`,
      `  skipped reasons ${formatSkippedReasons(result.skipped)}`,
      `  canceled ids ${visibleCanceled.length > 0 ? visibleCanceled.join(", ") : "none"}` +
        (canceledIds.length > visibleCanceled.length
          ? `, ... +${fmt(canceledIds.length - visibleCanceled.length)} more`
          : ""),
    ];

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
