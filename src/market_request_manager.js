const VERSION = "2.0.0-layer2-market-requests";

const REQUEST_TTL = 50000;
const CLAIM_TTL = 25;

function getMemoryRoot() {
  if (!Memory.consoleTools) Memory.consoleTools = {};
  if (!Memory.consoleTools.market) Memory.consoleTools.market = {};
  if (!Memory.consoleTools.market.requests) {
    Memory.consoleTools.market.requests = {};
  }
  return Memory.consoleTools.market.requests;
}

function getRoomRequests(roomName) {
  const root = getMemoryRoot();
  if (!root[roomName]) root[roomName] = {};
  return root[roomName];
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
    return target.store.getFreeCapacity(resourceType);
  }

  return 0;
}

function makeRequestId(roomName, resourceType) {
  return [
    "mr",
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

function getOpenRequests(roomName) {
  const requests = getRoomRequests(roomName);
  const open = [];

  for (const requestId in requests) {
    if (!Object.prototype.hasOwnProperty.call(requests, requestId)) continue;

    const request = requests[requestId];

    if (!request || request.status !== "open") continue;
    if (request.expiresAt && request.expiresAt < Game.time) {
      request.status = "expired";
      request.updatedAt = Game.time;
      continue;
    }

    cleanupClaims(request);

    if ((request.remaining || 0) <= 0) {
      request.status = "done";
      request.updatedAt = Game.time;
      continue;
    }

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

function isValidResourceType(resourceType) {
  if (!resourceType || typeof resourceType !== "string") return false;

  if (typeof RESOURCES_ALL !== "undefined" && Array.isArray(RESOURCES_ALL)) {
    return RESOURCES_ALL.indexOf(resourceType) >= 0;
  }

  return true;
}

function getRoom(roomName) {
  const room = Game.rooms[roomName];

  if (!room || !room.controller || !room.controller.my) {
    return null;
  }

  return room;
}

function createStageRequest(resourceType, amount, roomName, options) {
  amount = Number(amount);

  if (!isValidResourceType(resourceType)) {
    return {
      ok: false,
      message: "[MARKET] Invalid resource type: " + resourceType,
    };
  }

  if (!amount || amount <= 0) {
    return {
      ok: false,
      message: "[MARKET] Invalid stage amount.",
    };
  }

  const room = getRoom(roomName);

  if (!room) {
    return {
      ok: false,
      message: "[MARKET] Invalid owned room: " + roomName,
    };
  }

  if (!room.storage) {
    return {
      ok: false,
      message: "[MARKET] " + roomName + " has no storage.",
    };
  }

  if (!room.terminal) {
    return {
      ok: false,
      message: "[MARKET] " + roomName + " has no terminal.",
    };
  }

  const available = getStoredAmount(room.storage, resourceType);
  const free = getFreeCapacity(room.terminal, resourceType);

  if (available <= 0) {
    return {
      ok: false,
      message:
        "[MARKET] " +
        roomName +
        " storage has no " +
        resourceType +
        " available.",
    };
  }

  if (free <= 0) {
    return {
      ok: false,
      message:
        "[MARKET] " +
        roomName +
        " terminal has no free capacity for " +
        resourceType +
        ".",
    };
  }

  const requestAmount = Math.min(amount, available, free);
  const id = makeRequestId(roomName, resourceType);
  const requests = getRoomRequests(roomName);

  requests[id] = {
    id: id,
    type: "stage",
    status: "open",
    roomName: roomName,
    resourceType: resourceType,
    amount: requestAmount,
    remaining: requestAmount,
    source: "storage",
    target: "terminal",
    priority: options && options.priority ? options.priority : 50,
    createdAt: Game.time,
    updatedAt: Game.time,
    expiresAt: Game.time + REQUEST_TTL,
    claims: {},
  };

  return {
    ok: true,
    request: requests[id],
    message:
      "[MARKET] staged request " +
      id +
      ": move " +
      requestAmount +
      " " +
      resourceType +
      " storage -> terminal in " +
      roomName,
  };
}

function cancelRequest(requestId) {
  const root = getMemoryRoot();

  for (const roomName in root) {
    if (!Object.prototype.hasOwnProperty.call(root, roomName)) continue;

    const requests = root[roomName];

    if (requests && requests[requestId]) {
      requests[requestId].status = "canceled";
      requests[requestId].updatedAt = Game.time;
      requests[requestId].canceledAt = Game.time;

      return {
        ok: true,
        request: requests[requestId],
        message: "[MARKET] canceled request " + requestId,
      };
    }
  }

  return {
    ok: false,
    message: "[MARKET] request not found: " + requestId,
  };
}

function listRequests(roomName) {
  const root = getMemoryRoot();
  const rows = [];

  const roomNames = roomName ? [roomName] : Object.keys(root).sort();

  for (let i = 0; i < roomNames.length; i++) {
    const currentRoom = roomNames[i];
    const requests = root[currentRoom] || {};
    const ids = Object.keys(requests).sort();

    for (let j = 0; j < ids.length; j++) {
      const request = requests[ids[j]];
      cleanupClaims(request);

      rows.push({
        id: request.id,
        roomName: request.roomName,
        type: request.type,
        status: request.status,
        resourceType: request.resourceType,
        amount: request.amount,
        remaining: request.remaining,
        claimed: getClaimedAmount(request),
        createdAt: request.createdAt,
        updatedAt: request.updatedAt,
      });
    }
  }

  return rows;
}

function chooseRequestForCreep(room, creep) {
  if (!room || !creep || !room.storage || !room.terminal) return null;

  const open = getOpenRequests(room.name);

  for (let i = 0; i < open.length; i++) {
    const request = open[i];

    if (request.type !== "stage") continue;

    const available = getStoredAmount(room.storage, request.resourceType);
    const free = getFreeCapacity(room.terminal, request.resourceType);
    const claimed = getClaimedAmount(request);
    const unclaimed = Math.max(0, (request.remaining || 0) - claimed);

    if (available <= 0) {
      request.status = "blocked";
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
      label: "market_stage",
      requestId: request.id,
      pickupId: room.storage.id,
      deliveryId: room.terminal.id,
      resourceType: request.resourceType,
      amount: amount,
    };
  }

  return null;
}

function getHaulerTask(room, creep) {
  const cachedTask = creep.memory.marketTask || null;

  if (cachedTask && isHaulerTaskValid(cachedTask, room, creep)) {
    refreshClaim(cachedTask, creep);
    return cachedTask;
  }

  delete creep.memory.marketTask;

  const task = chooseRequestForCreep(room, creep);
  if (!task) return null;

  creep.memory.marketTask = task;
  return task;
}

function isHaulerTaskValid(task, room, creep) {
  if (!task || !task.requestId || !task.resourceType || !task.amount) {
    return false;
  }

  const requests = getRoomRequests(room.name);
  const request = requests[task.requestId];

  if (!request || request.status !== "open") return false;

  const pickup = Game.getObjectById(task.pickupId);
  const delivery = Game.getObjectById(task.deliveryId);

  if (!pickup || !delivery) return false;
  if (getStoredAmount(pickup, task.resourceType) <= 0) return false;
  if (getFreeCapacity(delivery, task.resourceType) <= 0) return false;

  return true;
}

function refreshClaim(task, creep) {
  if (!task || !task.requestId) return;

  const requests = getRoomRequests(creep.room.name);
  const request = requests[task.requestId];

  if (!request || request.status !== "open") return;
  if (!request.claims) request.claims = {};

  request.claims[creep.name] = {
    amount: task.amount,
    until: Game.time + CLAIM_TTL,
  };

  request.updatedAt = Game.time;
}

function completeHaulerTask(creep, amountMoved) {
  const task = creep.memory.marketTask;
  if (!task || !task.requestId) {
    delete creep.memory.marketTask;
    return;
  }

  const requests = getRoomRequests(creep.room.name);
  const request = requests[task.requestId];

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

  delete creep.memory.marketTask;
}

function releaseHaulerTask(creep, reason) {
  const task = creep.memory.marketTask;

  if (task && task.requestId) {
    const requests = getRoomRequests(creep.room.name);
    const request = requests[task.requestId];

    if (request && request.claims) {
      delete request.claims[creep.name];
      request.updatedAt = Game.time;
      request.lastReleaseReason = reason || "released";
    }
  }

  delete creep.memory.marketTask;
}

module.exports = {
  VERSION,
  createStageRequest,
  cancelRequest,
  listRequests,
  getHaulerTask,
  completeHaulerTask,
  releaseHaulerTask,
};
