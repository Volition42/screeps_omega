const config = require("config");
const roleIntentDiagnostics = require("role_intent_diagnostics");

const VERSION = "2.1.0-ops-logistics";

const REQUEST_TTL = 50000;
const CLAIM_TTL = 25;
const UNCLAIMED_STARVATION_AGE = 50;
const AGING_STARVATION_AGE = 100;
const HISTORY_LIMIT = 8;
const RECENT_VISIBLE_LIMIT = 3;

const STARVATION_SEVERITY = {
  clear: 0,
  pending: 1,
  aging: 2,
  blocked: 3,
  unclaimed: 4,
  hauler_short: 5,
};

const TREND_PRESSURE_RANK = {
  clear: 0,
  isolated: 1,
  recurring: 2,
  persistent: 3,
};

const ENDPOINTS = {
  storage: true,
  terminal: true,
  powerSpawn: true,
};

const ENDPOINT_LABELS = Object.keys(ENDPOINTS).sort().join(", ");

const BALANCE = {
  terminalEnergyTarget: 30000,
  terminalFreeCapacityTarget: 50000,
  mineralMax: 100000,
  priority: 60,
};

function getDefaultBlockedCancelAge() {
  if (
    config.OPS_LOGISTICS &&
    typeof config.OPS_LOGISTICS.BLOCKED_CANCEL_DEFAULT_AGE === "number" &&
    isFinite(config.OPS_LOGISTICS.BLOCKED_CANCEL_DEFAULT_AGE) &&
    config.OPS_LOGISTICS.BLOCKED_CANCEL_DEFAULT_AGE >= 0
  ) {
    return Math.floor(config.OPS_LOGISTICS.BLOCKED_CANCEL_DEFAULT_AGE);
  }

  return 1000;
}

function getMemoryRoot() {
  if (!Memory.ops) Memory.ops = {};
  if (!Memory.ops.logistics) Memory.ops.logistics = {};
  if (!Memory.ops.logistics.requests) Memory.ops.logistics.requests = {};
  return Memory.ops.logistics.requests;
}

function getHistoryRoot() {
  if (!Memory.ops) Memory.ops = {};
  if (!Memory.ops.logistics) Memory.ops.logistics = {};
  if (!Memory.ops.logistics.history) Memory.ops.logistics.history = {};
  return Memory.ops.logistics.history;
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

function getRequestAge(request) {
  if (!request || typeof request.createdAt !== "number") return 0;
  return Math.max(0, Game.time - request.createdAt);
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
        "[OPS] logistics: endpoints must be different supported endpoints: " +
        ENDPOINT_LABELS +
        ".",
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

function normalizeBlockedCancelFilters(filters) {
  const normalized = {};

  if (filters && typeof filters === "object") {
    if (typeof filters.resource === "string") normalized.resourceType = filters.resource;
    if (typeof filters.resourceType === "string") normalized.resourceType = filters.resourceType;
    if (typeof filters.from === "string") normalized.from = filters.from;
    if (typeof filters.to === "string") normalized.to = filters.to;

    if (typeof filters.olderThan === "number" || typeof filters.olderThan === "string") {
      const olderThan = Number(filters.olderThan);
      if (isFinite(olderThan) && olderThan >= 0) {
        normalized.olderThan = Math.floor(olderThan);
      }
    }
  }

  if (typeof normalized.olderThan !== "number") {
    normalized.olderThan = getDefaultBlockedCancelAge();
    normalized.defaultOlderThan = true;
  }

  return normalized;
}

function requestMatchesFilters(request, filters) {
  if (filters.resourceType && request.resourceType !== filters.resourceType) return false;
  if (filters.from && request.from !== filters.from) return false;
  if (filters.to && request.to !== filters.to) return false;
  if (getRequestAge(request) < filters.olderThan) return false;
  return true;
}

function addSkip(skipped, request, reason) {
  skipped.push({
    id: request && request.id ? request.id : "unknown",
    reason: reason,
  });
}

function cancelBlockedRequests(roomName, filters) {
  if (!roomName || typeof roomName !== "string") {
    return {
      ok: false,
      roomName: roomName || null,
      status: "blocked",
      filters: normalizeBlockedCancelFilters(filters),
      matched: 0,
      canceled: [],
      skipped: [],
      message: "[OPS] cancelRequests: roomName required.",
    };
  }

  const root = getMemoryRoot();
  const normalizedFilters = normalizeBlockedCancelFilters(filters);
  const ids = Object.keys(root).sort();
  const canceled = [];
  const skipped = [];

  for (let i = 0; i < ids.length; i++) {
    const request = root[ids[i]];
    if (!request) continue;
    expireAndNormalize(request);
    if (request.roomName !== roomName) continue;
    if (!requestMatchesFilters(request, normalizedFilters)) continue;

    if (request.status !== "blocked") {
      addSkip(skipped, request, "status_" + (request.status || "unknown"));
      continue;
    }

    const claimed = getClaimedAmount(request);
    if (claimed > 0) {
      addSkip(skipped, request, "claimed_" + claimed);
      continue;
    }

    request.status = "canceled";
    request.updatedAt = Game.time;
    request.canceledAt = Game.time;
    request.cancelReason = "ops_cancel_blocked";
    canceled.push(request.id);
  }

  return {
    ok: true,
    roomName: roomName,
    status: "blocked",
    filters: normalizedFilters,
    matched: canceled.length + skipped.length,
    canceled: canceled,
    skipped: skipped,
    message:
      "[OPS] cancelRequests " +
      roomName +
      " blocked: matched " +
      (canceled.length + skipped.length) +
      " | canceled " +
      canceled.length +
      " | skipped " +
      skipped.length,
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
      reason: request.reason || request.blockedReason || null,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      expiresAt: request.expiresAt,
      age: getRequestAge(request),
    });
  }

  return rows;
}

function formatEndpoint(endpoint) {
  if (!endpoint) return "unknown";
  if (endpoint === "powerSpawn") return "Power Spawn";
  return endpoint.charAt(0).toUpperCase() + endpoint.slice(1);
}

function formatRequestSummary(row) {
  if (!row) return "none";

  const details = [];
  details.push(formatEndpoint(row.from) + " -> " + formatEndpoint(row.to));
  details.push(row.resourceType || "resource");
  details.push("(" + Math.round(row.remaining || row.amount || 0) + ")");

  if (row.status === "blocked") {
    details.push("blocked " + (row.reason || "unknown"));
  }

  if (typeof row.age === "number" && row.age > 0) {
    details.push("age " + row.age + "t");
  }

  return details.join(" ");
}

function summarizeAdvancedBacklog(advanced) {
  if (!advanced) {
    return {
      count: 0,
      labels: [],
      summary: "none",
    };
  }

  const labels = [];
  const source =
    advanced.taskBacklog && Array.isArray(advanced.taskBacklog)
      ? advanced.taskBacklog
      : advanced.taskCandidates && Array.isArray(advanced.taskCandidates)
        ? advanced.taskCandidates
        : [];

  for (let i = 0; i < source.length; i++) {
    const entry = source[i];
    const label = typeof entry === "string" ? entry : entry && entry.label;
    if (label && labels.indexOf(label) === -1) labels.push(label);
  }

  if (labels.length === 0 && advanced.taskLabel) {
    labels.push(advanced.taskLabel);
  }

  return {
    count: labels.length,
    labels: labels,
    summary: labels.length > 0 ? labels.slice(0, 3).join(", ") : "none",
  };
}

function isStarvedSnapshot(snapshot) {
  return !!snapshot && snapshot.state !== "clear";
}

function isUnclaimedAgingSnapshot(snapshot) {
  return (
    !!snapshot &&
    snapshot.unclaimed > 0 &&
    snapshot.oldestUnclaimedAge >= UNCLAIMED_STARVATION_AGE
  );
}

function isHaulerShortSnapshot(snapshot) {
  return (
    !!snapshot &&
    snapshot.remaining > 0 &&
    snapshot.haulers < snapshot.desiredHaulers
  );
}

function buildSnapshot(roomName, summary) {
  return {
    t: Game.time,
    roomName: roomName,
    state: summary.state,
    open: summary.openRequests,
    blocked: summary.blockedRequests,
    unclaimed: Math.round(summary.totalUnclaimed || 0),
    claimed: Math.round(summary.totalClaimed || 0),
    remaining: Math.round(summary.totalRemaining || 0),
    oldestOpenAge: summary.oldestOpenAge || 0,
    oldestUnclaimedAge: summary.oldestUnclaimedAge || 0,
    haulers: summary.haulers.current || 0,
    desiredHaulers: summary.haulers.desired || 0,
  };
}

function compactHistorySnapshot(snapshot) {
  return {
    t: Math.round(snapshot && snapshot.t || 0),
    roomName: String(snapshot && snapshot.roomName || "unknown"),
    state: String(snapshot && snapshot.state || "clear"),
    open: Math.round(snapshot && snapshot.open || 0),
    blocked: Math.round(snapshot && snapshot.blocked || 0),
    unclaimed: Math.round(snapshot && snapshot.unclaimed || 0),
    claimed: Math.round(snapshot && snapshot.claimed || 0),
    remaining: Math.round(snapshot && snapshot.remaining || 0),
    oldestOpenAge: Math.round(snapshot && snapshot.oldestOpenAge || 0),
    oldestUnclaimedAge: Math.round(snapshot && snapshot.oldestUnclaimedAge || 0),
    haulers: Math.round(snapshot && snapshot.haulers || 0),
    desiredHaulers: Math.round(snapshot && snapshot.desiredHaulers || 0),
  };
}

function compactHistory(history) {
  const compacted = [];

  for (let i = 0; i < history.length; i++) {
    if (!history[i]) continue;
    compacted.push(compactHistorySnapshot(history[i]));
  }

  return compacted;
}

function getWorstState(history) {
  let worst = "clear";

  for (let i = 0; i < history.length; i++) {
    const state = history[i].state || "clear";
    if ((STARVATION_SEVERITY[state] || 0) > (STARVATION_SEVERITY[worst] || 0)) {
      worst = state;
    }
  }

  return worst;
}

function getStateSeverity(state) {
  return STARVATION_SEVERITY[state] || 0;
}

function getTrendLabel(history) {
  const starvationSamples = history.filter(isStarvedSnapshot).length;

  if (starvationSamples === 0) return "clear";
  if (starvationSamples === 1) return "isolated";

  const lastThree = history.slice(-3);
  if (
    lastThree.length >= 3 &&
    lastThree.every(isStarvedSnapshot)
  ) {
    return "persistent";
  }

  return "recurring";
}

function summarizeHistory(history) {
  const starvationSamples = history.filter(isStarvedSnapshot).length;
  const blockedSamples = history.filter(function (snapshot) {
    return (snapshot.blocked || 0) > 0 || snapshot.state === "blocked";
  }).length;
  const unclaimedAgingSamples = history.filter(isUnclaimedAgingSnapshot).length;
  const haulerShortSamples = history.filter(isHaulerShortSnapshot).length;

  return {
    limit: HISTORY_LIMIT,
    sampleCount: history.length,
    trend: getTrendLabel(history),
    starvationSamples: starvationSamples,
    blockedSamples: blockedSamples,
    unclaimedAgingSamples: unclaimedAgingSamples,
    haulerShortSamples: haulerShortSamples,
    worstState: getWorstState(history),
    recent: history.slice(-RECENT_VISIBLE_LIMIT).reverse(),
  };
}

function hasCurrentPressure(row) {
  return !!row && row.state !== "clear";
}

function getTrendRank(trend) {
  return TREND_PRESSURE_RANK[trend] || 0;
}

function comparePressureRows(a, b) {
  const aTrend = getTrendRank(a.trend);
  const bTrend = getTrendRank(b.trend);
  if (aTrend !== bTrend) return bTrend - aTrend;

  const aSeverity = getStateSeverity(a.state);
  const bSeverity = getStateSeverity(b.state);
  if (aSeverity !== bSeverity) return bSeverity - aSeverity;

  if ((a.blockedRequests || 0) !== (b.blockedRequests || 0)) {
    return (b.blockedRequests || 0) - (a.blockedRequests || 0);
  }

  if ((a.totalUnclaimed || 0) !== (b.totalUnclaimed || 0)) {
    return (b.totalUnclaimed || 0) - (a.totalUnclaimed || 0);
  }

  if ((a.openRequests || 0) !== (b.openRequests || 0)) {
    return (b.openRequests || 0) - (a.openRequests || 0);
  }

  return String(a.roomName).localeCompare(String(b.roomName));
}

function buildEmpirePressureRow(report) {
  const logistics = report && report.logistics ? report.logistics : null;
  const history = logistics && logistics.history ? logistics.history : {};
  const haulers = logistics && logistics.haulers ? logistics.haulers : {};

  return {
    roomName: report && report.room ? report.room : logistics ? logistics.roomName : "unknown",
    state: logistics ? logistics.state || "clear" : "clear",
    trend: history.trend || "clear",
    openRequests: logistics ? logistics.openRequests || 0 : 0,
    blockedRequests: logistics ? logistics.blockedRequests || 0 : 0,
    totalUnclaimed: logistics ? Math.round(logistics.totalUnclaimed || 0) : 0,
    haulers: haulers.current || 0,
    desiredHaulers: haulers.desired || 0,
    worstState: history.worstState || "clear",
    blockedSamples: history.blockedSamples || 0,
    unclaimedAgingSamples: history.unclaimedAgingSamples || 0,
    haulerShortSamples: history.haulerShortSamples || 0,
  };
}

function buildEmpirePressureRollup(reports, options) {
  const settings = options || {};
  const topLimit = settings.topLimit || 5;
  const rows = (reports || []).map(buildEmpirePressureRow);
  const pressured = rows.filter(function (row) {
    return (
      hasCurrentPressure(row) ||
      row.trend === "recurring" ||
      row.trend === "persistent" ||
      row.blockedSamples > 0 ||
      row.unclaimedAgingSamples > 0 ||
      row.haulerShortSamples > 0
    );
  });
  const ranked = pressured.slice().sort(comparePressureRows);

  return {
    roomsEvaluated: rows.length,
    pressuredRooms: rows.filter(hasCurrentPressure).length,
    recurringRooms: rows.filter(function (row) {
      return row.trend === "recurring";
    }).length,
    persistentRooms: rows.filter(function (row) {
      return row.trend === "persistent";
    }).length,
    blockedSampleRooms: rows.filter(function (row) {
      return row.blockedSamples > 0;
    }).length,
    unclaimedAgingSampleRooms: rows.filter(function (row) {
      return row.unclaimedAgingSamples > 0;
    }).length,
    haulerShortSampleRooms: rows.filter(function (row) {
      return row.haulerShortSamples > 0;
    }).length,
    worstRoom: ranked.length > 0 ? ranked[0] : null,
    rows: rows,
    rankedRows: ranked,
    topRows: ranked.slice(0, topLimit),
  };
}

function formatEmpirePressureRow(row) {
  return (
    row.roomName +
    ": " +
    row.trend +
    ", state " +
    row.state +
    ", open " +
    row.openRequests +
    ", blocked " +
    row.blockedRequests +
    ", unclaimed " +
    row.totalUnclaimed +
    ", haulers " +
    row.haulers +
    " / " +
    row.desiredHaulers +
    ", worst " +
    row.worstState
  );
}

function formatEmpirePressureRollup(rollup) {
  const report = rollup || buildEmpirePressureRollup([]);
  const lines = [
    "[OPS][EMPIRE][LOGISTICS]",
    "Empire Logistics Pressure",
    "Rooms Evaluated: " + report.roomsEvaluated,
    "Pressured Rooms: " + report.pressuredRooms,
    "Recurring: " + report.recurringRooms,
    "Persistent: " + report.persistentRooms,
    "Blocked Samples: " + report.blockedSampleRooms,
    "Unclaimed Aging Samples: " + report.unclaimedAgingSampleRooms,
    "Hauler Short Samples: " + report.haulerShortSampleRooms,
    "Worst Room: " + (report.worstRoom ? formatEmpirePressureRow(report.worstRoom) : "none"),
    "Top Pressure:",
  ];

  if (report.topRows.length === 0) {
    lines.push("  none");
  } else {
    for (let i = 0; i < report.topRows.length; i++) {
      lines.push("  " + formatEmpirePressureRow(report.topRows[i]));
    }
  }

  const inspectRooms = report.topRows.map(function (row) {
    return 'ops.room("' + row.roomName + '", "logistics")';
  });
  lines.push("Inspect: " + (inspectRooms.length > 0 ? inspectRooms.join("; ") : "none"));

  return lines;
}

function recordHistorySnapshot(roomName, summary) {
  const root = getHistoryRoot();
  const history = compactHistory(Array.isArray(root[roomName]) ? root[roomName] : []);
  const snapshot = buildSnapshot(roomName, summary);

  if (history.length > 0 && history[history.length - 1].t === Game.time) {
    history[history.length - 1] = snapshot;
  } else {
    history.push(snapshot);
  }

  while (history.length > HISTORY_LIMIT) {
    history.shift();
  }

  root[roomName] = history;
  return summarizeHistory(history);
}

function getRoomDiagnostics(roomName, options) {
  const settings = options || {};
  const rows = listRequests(roomName);
  const active = rows.filter(function (row) {
    return row.status === "open" || row.status === "blocked";
  });
  const open = active.filter(function (row) {
    return row.status === "open";
  });
  const blocked = active.filter(function (row) {
    return row.status === "blocked";
  });

  let totalRemaining = 0;
  let totalClaimed = 0;
  let totalUnclaimed = 0;
  let oldestOpenAge = 0;
  let oldestUnclaimedAge = 0;

  for (let i = 0; i < active.length; i++) {
    const row = active[i];
    const remaining = Math.max(0, row.remaining || 0);
    const claimed = Math.max(0, row.claimed || 0);
    const unclaimed = Math.max(0, remaining - claimed);

    totalRemaining += remaining;
    totalClaimed += Math.min(remaining, claimed);
    totalUnclaimed += unclaimed;

    if (row.status === "open") {
      oldestOpenAge = Math.max(oldestOpenAge, row.age || 0);
    }
    if (unclaimed > 0) {
      oldestUnclaimedAge = Math.max(oldestUnclaimedAge, row.age || 0);
    }
  }

  const waiting = active
    .slice()
    .sort(function (a, b) {
      if (a.status !== b.status) return a.status === "blocked" ? -1 : 1;
      if ((b.age || 0) !== (a.age || 0)) return (b.age || 0) - (a.age || 0);
      if ((b.remaining || 0) !== (a.remaining || 0)) {
        return (b.remaining || 0) - (a.remaining || 0);
      }
      return String(a.id).localeCompare(String(b.id));
    })
    .slice(0, 3)
    .map(function (row) {
      return {
        id: row.id,
        status: row.status,
        resourceType: row.resourceType,
        remaining: row.remaining || 0,
        claimed: row.claimed || 0,
        unclaimed: Math.max(0, (row.remaining || 0) - (row.claimed || 0)),
        age: row.age || 0,
        summary: formatRequestSummary(row),
      };
    });

  const currentHaulers =
    typeof settings.currentHaulers === "number" ? settings.currentHaulers : 0;
  const desiredHaulers =
    typeof settings.desiredHaulers === "number" ? settings.desiredHaulers : 0;
  const haulerShort = totalRemaining > 0 && currentHaulers < desiredHaulers;
  const advancedBacklog = summarizeAdvancedBacklog(settings.advanced);
  let state = "clear";

  if (haulerShort) state = "hauler_short";
  else if (blocked.length > 0) state = "blocked";
  else if (totalUnclaimed > 0 && oldestUnclaimedAge >= UNCLAIMED_STARVATION_AGE) {
    state = "unclaimed";
  } else if (oldestOpenAge >= AGING_STARVATION_AGE) state = "aging";
  else if (open.length > 0) state = "pending";

  const summary = {
    roomName: roomName,
    openRequests: open.length,
    blockedRequests: blocked.length,
    totalRemaining: totalRemaining,
    totalClaimed: totalClaimed,
    totalUnclaimed: totalUnclaimed,
    oldestOpenAge: oldestOpenAge,
    oldestUnclaimedAge: oldestUnclaimedAge,
    waiting: waiting,
    advancedBacklog: advancedBacklog,
    state: state,
    haulers: {
      current: currentHaulers,
      desired: desiredHaulers,
      short: haulerShort,
    },
  };

  summary.history = settings.recordHistory === false
    ? summarizeHistory(getHistoryRoot()[roomName] || [])
    : recordHistorySnapshot(roomName, summary);
  return summary;
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

function validateAssignedHaulerTask(creep) {
  const task = creep && creep.memory ? creep.memory.opsLogisticsTask : null;
  if (!task || !task.requestId || !task.resourceType || !task.amount) {
    if (creep && creep.memory) delete creep.memory.opsLogisticsTask;
    return null;
  }

  const root = getMemoryRoot();
  const request = root[task.requestId];

  if (!request || !expireAndNormalize(request)) {
    releaseHaulerTask(creep, "request_not_open");
    return null;
  }

  const room = getOwnedRoom(request.roomName);
  if (!room || !creep.room || creep.room.name !== room.name) {
    releaseHaulerTask(creep, "invalid_room");
    return null;
  }

  const endpoints = refreshRequestEndpoints(request, room);
  if (!endpoints) {
    releaseHaulerTask(creep, "missing_endpoint");
    return null;
  }

  task.pickupId = endpoints.source.id;
  task.deliveryId = endpoints.target.id;

  const deliveryFree = getFreeCapacity(endpoints.target, task.resourceType);
  if (deliveryFree <= 0) {
    request.status = "blocked";
    request.reason = "target_full";
    request.updatedAt = Game.time;
    releaseHaulerTask(creep, "target_full");
    return null;
  }

  const carriedAmount = getStoredAmount(creep, task.resourceType);
  if (carriedAmount <= 0) {
    if (getStoredAmount(endpoints.source, task.resourceType) <= 0) {
      request.status = (request.remaining || 0) <= 0 ? "done" : "blocked";
      request.reason = "source_empty";
      request.updatedAt = Game.time;
      releaseHaulerTask(creep, "source_empty");
      return null;
    }

    if (creep.store.getFreeCapacity(task.resourceType) <= 0) {
      releaseHaulerTask(creep, "creep_full");
      return null;
    }
  }

  refreshClaim(task, creep);
  return {
    task: task,
    request: request,
    pickup: endpoints.source,
    delivery: endpoints.target,
  };
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

    const roomName =
      request && request.roomName
        ? request.roomName
        : creep && creep.room
          ? creep.room.name
          : null;
    const label = getStaleReleaseLabel(reason);
    if (roomName && label) {
      roleIntentDiagnostics.recordStaleRelease(roomName, label);
    }
  }

  delete creep.memory.opsLogisticsTask;
}

function getStaleReleaseLabel(reason) {
  switch (reason) {
    case "target_full":
      return "ops-full-target";
    case "source_empty":
      return "ops-empty-source";
    case "missing_endpoint":
      return "ops-missing-target";
    case "request_not_open":
    case "invalid_room":
      return "ops-invalid-request";
    default:
      if (reason && reason.indexOf("withdraw_result_") === 0) {
        return "ops-missing-source";
      }
      if (reason && reason.indexOf("transfer_result_") === 0) {
        return "ops-missing-target";
      }
      return null;
  }
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
  getDefaultBlockedCancelAge: getDefaultBlockedCancelAge,
  createMoveRequest: createMoveRequest,
  cancelRequest: cancelRequest,
  cancelBlockedRequests: cancelBlockedRequests,
  listRequests: listRequests,
  getRoomDiagnostics: getRoomDiagnostics,
  buildEmpirePressureRollup: buildEmpirePressureRollup,
  formatEmpirePressureRollup: formatEmpirePressureRollup,
  getHistoryLimit: function () {
    return HISTORY_LIMIT;
  },
  getHaulerTask: getHaulerTask,
  validateAssignedHaulerTask: validateAssignedHaulerTask,
  completeHaulerTask: completeHaulerTask,
  releaseHaulerTask: releaseHaulerTask,
  balanceTerminal: balanceTerminal,
  balanceTerminals: balanceTerminals,
};
