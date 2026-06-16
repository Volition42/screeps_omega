const VERSION = "2.1.0-ops-logistics";

const REQUEST_TTL = 50000;
const CLAIM_TTL = 25;

const ENDPOINTS = {
  storage: true,
  terminal: true,
  powerSpawn: true,
};

const BALANCE = {
  terminalEnergyTarget: 30000,
  terminalFreeCapacityTarget: 50000,
  mineralMax: 100000,
  priority: 60,
};

function getMemoryRoot() {
  if (!Memory.ops) Memory.ops = {};
  if (!Memory.ops.logistics) Memory.ops.logistics = {};
  if (!Memory.ops.logistics.requests) Memory.ops.logistics.requests = {};
  return Memory.ops.logistics.requests;
}

function isValidEndpoint(endpoint) {
  return !!ENDPOINTS[endpoint];
}

function isValidResourceType(resourceType) {
  if (!resourceType || typeof resourceType !== "string") return false;

  if (typeof RESOURCES_ALL !== "undefined" && Array.isArray(RESOURCES_ALL)) {
    return RESOURCES_ALL.indexOf(resourceType) >= 0;
  }

  return true;
}

function getOwnedRoom(roomName) {
  const room = Game.rooms[roomName];

  if (!room || !room.controller || !room.controller.my) return null;

  return room;
}

function ownedRooms() {
  return Object.values(Game.rooms)
    .filter(function (room) {
      return room.controller && room.controller.my;
    })
    .sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
}

function getEndpointStructure(room, endpoint) {
  if (!room || !isValidEndpoint(endpoint)) return null;
  if (endpoint === "powerSpawn") {
    if (
      room.structuresByType &&
      room.structuresByType[STRUCTURE_POWER_SPAWN] &&
      room.structuresByType[STRUCTURE_POWER_SPAWN][0]
    ) {
      return room.structuresByType[STRUCTURE_POWER_SPAWN][0];
    }

    const spawns = room.find(FIND_MY_STRUCTURES, {
      filter: function (structure) {
        return structure.structureType === STRUCTURE_POWER_SPAWN;
      },
    });
    return spawns.length > 0 ? spawns[0] : null;
  }

  return room[endpoint] || null;
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
    total += target.store[resourceType] || 0;
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

function storeResources(store) {
  if (!store) return [];

  return Object.keys(store)
    .filter(function (resourceType) {
      return (store[resourceType] || 0) > 0;
    })
    .sort();
}

function makeRequestId(roomName, resourceType) {
  return [
    "ol",
    Game.time,
    roomName,
    resourceType,
    Math.floor(Math.random() * 10000),
  ].join("_");
}

function cleanupClaims(request) {
  if (!request.claims) request.claims = {};

  for (const creepName in request.claims) {
    if (!Object.prototype.hasOwnProperty.call(request.claims, creepName)) {
      continue;
    }

    const claim = request.claims[creepName];

    if (!claim || !Game.creeps[creepName] || claim.until < Game.time) {
      delete request.claims[creepName];
    }
  }
}

function getClaimedAmount(request) {
  cleanupClaims(request);

  let claimed = 0;

  for (const creepName in request.claims) {
    if (!Object.prototype.hasOwnProperty.call(request.claims, creepName)) {
      continue;
    }

    claimed += request.claims[creepName].amount || 0;
  }

  return claimed;
}

function expireAndNormalize(request) {
  if (!request) return false;

  if (request.status === "open" && request.expiresAt && request.expiresAt < Game.time) {
    request.status = "expired";
    request.updatedAt = Game.time;
  }

  cleanupClaims(request);

  if (request.status === "open" && (request.remaining || 0) <= 0) {
    request.status = "done";
    request.completedAt = request.completedAt || Game.time;
    request.updatedAt = Game.time;
  }

  return request.status === "open";
}

function findOpenDuplicate(roomName, resourceType, from, to) {
  const root = getMemoryRoot();

  for (const requestId in root) {
    if (!Object.prototype.hasOwnProperty.call(root, requestId)) continue;

    const request = root[requestId];
    if (!expireAndNormalize(request)) continue;

    if (
      request.type === "move" &&
      request.roomName === roomName &&
      request.resourceType === resourceType &&
      request.from === from &&
      request.to === to
    ) {
      return request;
    }
  }

  return null;
}

function getOpenRequests(roomName) {
  const root = getMemoryRoot();
  const open = [];

  for (const requestId in root) {
    if (!Object.prototype.hasOwnProperty.call(root, requestId)) continue;

    const request = root[requestId];
    if (!expireAndNormalize(request)) continue;
    if (roomName && request.roomName !== roomName) continue;

    open.push(request);
  }

  open.sort(function (a, b) {
    if ((a.priority || 0) !== (b.priority || 0)) {
      return (b.priority || 0) - (a.priority || 0);
    }

    return (a.createdAt || 0) - (b.createdAt || 0);
  });

  return open;
}

function validateMove(resourceType, amount, roomName, from, to) {
  amount = Number(amount);

  if (!isValidResourceType(resourceType)) {
    return {
      ok: false,
      message: "[OPS] logistics: invalid resource type: " + resourceType,
    };
  }

  if (!amount || amount <= 0) {
    return {
      ok: false,
      message: "[OPS] logistics: invalid move amount.",
    };
  }

  if (!isValidEndpoint(from) || !isValidEndpoint(to) || from === to) {
    return {
      ok: false,
      message:
        "[OPS] logistics: endpoints must be storage -> terminal or terminal -> storage.",
    };
  }

  const room = getOwnedRoom(roomName);
  if (!room) {
    return {
      ok: false,
      message: "[OPS] logistics: invalid owned room: " + roomName,
    };
  }

  const source = getEndpointStructure(room, from);
  const target = getEndpointStructure(room, to);

  if (!source) {
    return {
      ok: false,
      message: "[OPS] logistics: " + roomName + " has no " + from + ".",
    };
  }

  if (!target) {
    return {
      ok: false,
      message: "[OPS] logistics: " + roomName + " has no " + to + ".",
    };
  }

  const available = getStoredAmount(source, resourceType);
  const free = getFreeCapacity(target, resourceType);

  if (available <= 0) {
    return {
      ok: false,
      message:
        "[OPS] logistics: " +
        roomName +
        " " +
        from +
        " has no " +
        resourceType +
        " available.",
    };
  }

  if (free <= 0) {
    return {
      ok: false,
      message:
        "[OPS] logistics: " +
        roomName +
        " " +
        to +
        " has no free capacity for " +
        resourceType +
        ".",
    };
  }

  return {
    ok: true,
    room: room,
    source: source,
    target: target,
    amount: Math.min(amount, available, free),
  };
}

function createMoveRequest(resourceType, amount, roomName, from, to, options) {
  const validation = validateMove(resourceType, amount, roomName, from, to);

  if (!validation.ok) return validation;

  const duplicate = findOpenDuplicate(roomName, resourceType, from, to);
  const requestAmount = validation.amount;

  if (duplicate) {
    duplicate.sourceId = validation.source.id;
    duplicate.targetId = validation.target.id;
    duplicate.updatedAt = Game.time;

    return {
      ok: true,
      skipped: true,
      requestedAmount: 0,
      request: duplicate,
      message:
        "[OPS] existing logistics request " +
        duplicate.id +
        " already moves " +
        resourceType +
        " " +
        from +
        " -> " +
        to +
        " in " +
        roomName,
    };
  }

  const id = makeRequestId(roomName, resourceType);
  const root = getMemoryRoot();

  root[id] = {
    id: id,
    type: "move",
    status: "open",
    roomName: roomName,
    resourceType: resourceType,
    amount: requestAmount,
    remaining: requestAmount,
    from: from,
    to: to,
    sourceId: validation.source.id,
    targetId: validation.target.id,
    priority: options && options.priority ? options.priority : 50,
    createdAt: Game.time,
    updatedAt: Game.time,
    expiresAt: Game.time + REQUEST_TTL,
    claims: {},
  };

  return {
    ok: true,
    requestedAmount: requestAmount,
    request: root[id],
    message:
      "[OPS] logistics request " +
      id +
      ": move " +
      requestAmount +
      " " +
      resourceType +
      " " +
      from +
      " -> " +
      to +
      " in " +
      roomName,
  };
}

function cancelRequest(requestId) {
  const root = getMemoryRoot();
  const request = root[requestId];

  if (!request) {
    return {
      ok: false,
      message: "[OPS] logistics request not found: " + requestId,
    };
  }

  request.status = "canceled";
  request.updatedAt = Game.time;
  request.canceledAt = Game.time;

  return {
    ok: true,
    request: request,
    message: "[OPS] canceled logistics request " + requestId,
  };
}

function listRequests(roomName) {
  const root = getMemoryRoot();
  const ids = Object.keys(root).sort();
  const rows = [];

  for (let i = 0; i < ids.length; i++) {
    const request = root[ids[i]];
    if (!request) continue;
    expireAndNormalize(request);
    if (roomName && request.roomName !== roomName) continue;

    rows.push({
      id: request.id,
      roomName: request.roomName,
      type: request.type,
      status: request.status,
      resourceType: request.resourceType,
      amount: request.amount,
      remaining: request.remaining,
      from: request.from,
      to: request.to,
      priority: request.priority,
      claimed: getClaimedAmount(request),
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
    });
  }

  return rows;
}

function refreshRequestEndpoints(request, room) {
  const source = getEndpointStructure(room, request.from);
  const target = getEndpointStructure(room, request.to);

  if (!source || !target) {
    request.status = "blocked";
    request.reason = "missing_endpoint";
    request.updatedAt = Game.time;
    return null;
  }

  if (request.sourceId !== source.id || request.targetId !== target.id) {
    request.sourceId = source.id;
    request.targetId = target.id;
    request.updatedAt = Game.time;
  }

  return {
    source: source,
    target: target,
  };
}

function chooseRequestForCreep(room, creep) {
  if (!room || !creep) return null;

  const open = getOpenRequests(room.name);

  for (let i = 0; i < open.length; i++) {
    const request = open[i];
    if (request.type !== "move") continue;

    const endpoints = refreshRequestEndpoints(request, room);
    if (!endpoints) continue;

    const available = getStoredAmount(endpoints.source, request.resourceType);
    const free = getFreeCapacity(endpoints.target, request.resourceType);
    const claimed = getClaimedAmount(request);
    const unclaimed = Math.max(0, (request.remaining || 0) - claimed);

    if (available <= 0) {
      request.status = (request.remaining || 0) <= 0 ? "done" : "blocked";
      request.reason = "source_empty";
      request.updatedAt = Game.time;
      continue;
    }

    if (free <= 0) {
      request.status = "blocked";
      request.reason = "target_full";
      request.updatedAt = Game.time;
      continue;
    }

    if (unclaimed <= 0) continue;

    const amount = Math.min(
      unclaimed,
      available,
      free,
      creep.store.getFreeCapacity(request.resourceType),
    );

    if (amount <= 0) continue;

    request.claims[creep.name] = {
      amount: amount,
      until: Game.time + CLAIM_TTL,
    };
    request.updatedAt = Game.time;

    return {
      label: "ops_logistics",
      requestId: request.id,
      pickupId: endpoints.source.id,
      deliveryId: endpoints.target.id,
      resourceType: request.resourceType,
      amount: amount,
    };
  }

  return null;
}

function isHaulerTaskValid(task, room) {
  if (!task || !task.requestId || !task.resourceType || !task.amount) {
    return false;
  }

  const root = getMemoryRoot();
  const request = root[task.requestId];

  if (!request || !expireAndNormalize(request)) return false;
  if (request.roomName !== room.name) return false;

  const pickup = Game.getObjectById(task.pickupId);
  const delivery = Game.getObjectById(task.deliveryId);

  if (!pickup || !delivery) return false;
  if (getStoredAmount(pickup, task.resourceType) <= 0) return false;
  if (getFreeCapacity(delivery, task.resourceType) <= 0) return false;

  return true;
}

function refreshClaim(task, creep) {
  if (!task || !task.requestId) return;

  const root = getMemoryRoot();
  const request = root[task.requestId];

  if (!request || !expireAndNormalize(request)) return;
  if (!request.claims) request.claims = {};

  request.claims[creep.name] = {
    amount: task.amount,
    until: Game.time + CLAIM_TTL,
  };
  request.updatedAt = Game.time;
}

function getHaulerTask(room, creep) {
  const cachedTask = creep.memory.opsLogisticsTask || null;

  if (cachedTask && isHaulerTaskValid(cachedTask, room)) {
    refreshClaim(cachedTask, creep);
    return cachedTask;
  }

  delete creep.memory.opsLogisticsTask;

  const task = chooseRequestForCreep(room, creep);
  if (!task) return null;

  creep.memory.opsLogisticsTask = task;
  return task;
}

function completeHaulerTask(creep, amountMoved) {
  const task = creep.memory.opsLogisticsTask;
  if (!task || !task.requestId) {
    delete creep.memory.opsLogisticsTask;
    return;
  }

  const root = getMemoryRoot();
  const request = root[task.requestId];

  if (request) {
    request.remaining = Math.max(0, (request.remaining || 0) - amountMoved);
    request.updatedAt = Game.time;

    if (request.claims) {
      delete request.claims[creep.name];
    }

    if (request.remaining <= 0) {
      request.status = "done";
      request.completedAt = Game.time;
    }
  }

  delete creep.memory.opsLogisticsTask;
}

function releaseHaulerTask(creep, reason) {
  const task = creep.memory.opsLogisticsTask;

  if (task && task.requestId) {
    const root = getMemoryRoot();
    const request = root[task.requestId];

    if (request && request.claims) {
      delete request.claims[creep.name];
      request.updatedAt = Game.time;
      request.lastReleaseReason = reason || "released";
    }
  }

  delete creep.memory.opsLogisticsTask;
}

function buildBalanceMove(resourceType, amount, roomName, from, to, results) {
  if (amount <= 0) return;

  const result = createMoveRequest(resourceType, amount, roomName, from, to, {
    priority: BALANCE.priority,
  });

  results.push(result);
}

function balanceTerminal(roomName) {
  const room = getOwnedRoom(roomName);

  if (!room) {
    return {
      ok: false,
      roomName: roomName,
      requests: [],
      message: "[OPS] logistics: invalid owned room: " + roomName,
    };
  }

  if (!room.storage || !room.terminal) {
    return {
      ok: false,
      roomName: roomName,
      requests: [],
      message:
        "[OPS] logistics: " +
        roomName +
        " needs both storage and terminal for balance.",
    };
  }

  const results = [];
  const terminalEnergy = getStoredAmount(room.terminal, RESOURCE_ENERGY);
  const terminalFree = getTotalFreeCapacity(room.terminal);
  const storageEnergy = getStoredAmount(room.storage, RESOURCE_ENERGY);

  if (
    terminalEnergy < BALANCE.terminalEnergyTarget &&
    terminalFree > 0 &&
    storageEnergy > 0
  ) {
    buildBalanceMove(
      RESOURCE_ENERGY,
      Math.min(
        BALANCE.terminalEnergyTarget - terminalEnergy,
        terminalFree,
        storageEnergy,
      ),
      room.name,
      "storage",
      "terminal",
      results,
    );
  }

  const resources = storeResources(room.terminal.store)
    .filter(function (resourceType) {
      return resourceType !== RESOURCE_ENERGY;
    })
    .sort(function (a, b) {
      return (
        getStoredAmount(room.terminal, b) -
        getStoredAmount(room.terminal, a)
      );
    });

  let projectedFree = terminalFree;
  for (let i = 0; i < results.length; i++) {
    const request = results[i].request;
    if (!request || request.roomName !== room.name) continue;
    const requestedAmount = results[i].requestedAmount || 0;
    if (request.from === "terminal" && request.to === "storage") {
      projectedFree += requestedAmount;
    } else if (request.from === "storage" && request.to === "terminal") {
      projectedFree -= requestedAmount;
    }
  }

  for (let j = 0; j < resources.length; j++) {
    const resourceType = resources[j];
    const amount = getStoredAmount(room.terminal, resourceType);
    const needFree = Math.max(
      0,
      BALANCE.terminalFreeCapacityTarget - projectedFree,
    );
    const excess = Math.max(0, amount - BALANCE.mineralMax);
    const unloadAmount = Math.min(amount, Math.max(excess, needFree));

    if (unloadAmount > 0) {
      buildBalanceMove(
        resourceType,
        unloadAmount,
        room.name,
        "terminal",
        "storage",
        results,
      );
      projectedFree += unloadAmount;
    }

    if (projectedFree >= BALANCE.terminalFreeCapacityTarget) {
      break;
    }
  }

  if (
    projectedFree < BALANCE.terminalFreeCapacityTarget &&
    terminalEnergy > BALANCE.terminalEnergyTarget
  ) {
    buildBalanceMove(
      RESOURCE_ENERGY,
      Math.min(
        terminalEnergy - BALANCE.terminalEnergyTarget,
        BALANCE.terminalFreeCapacityTarget - projectedFree,
      ),
      room.name,
      "terminal",
      "storage",
      results,
    );
  }

  return {
    ok: true,
    roomName: room.name,
    requests: results,
    message:
      "[OPS] terminal balance " +
      room.name +
      ": " +
      results.length +
      " logistics request result(s).",
  };
}

function balanceTerminals() {
  const rooms = ownedRooms().filter(function (room) {
    return room.storage && room.terminal;
  });
  const results = [];

  for (let i = 0; i < rooms.length; i++) {
    results.push(balanceTerminal(rooms[i].name));
  }

  return {
    ok: true,
    rooms: results,
    message:
      "[OPS] terminal balance evaluated " + rooms.length + " owned room(s).",
  };
}

module.exports = {
  VERSION: VERSION,
  BALANCE: BALANCE,
  createMoveRequest: createMoveRequest,
  cancelRequest: cancelRequest,
  listRequests: listRequests,
  getHaulerTask: getHaulerTask,
  completeHaulerTask: completeHaulerTask,
  releaseHaulerTask: releaseHaulerTask,
  balanceTerminal: balanceTerminal,
  balanceTerminals: balanceTerminals,
};
