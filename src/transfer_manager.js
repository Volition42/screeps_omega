const opsLogisticsManager = require("ops_logistics_manager");

const DESCRIPTION = "Omega ops.transfer";
const HISTORY_LIMIT = 20;

const STATUS = {
  PENDING: "PENDING",
  SOURCE_STAGE: "SOURCE_STAGE",
  WAITING_SOURCE_RESOURCE: "WAITING_SOURCE_RESOURCE",
  READY_TO_SEND: "READY_TO_SEND",
  SENDING: "SENDING",
  DESTINATION_STAGE: "DESTINATION_STAGE",
  COMPLETE: "COMPLETE",
  BLOCKED: "BLOCKED",
  CANCELLED: "CANCELLED",
};

const ACTIVE_STATUSES = {};
ACTIVE_STATUSES[STATUS.PENDING] = true;
ACTIVE_STATUSES[STATUS.SOURCE_STAGE] = true;
ACTIVE_STATUSES[STATUS.WAITING_SOURCE_RESOURCE] = true;
ACTIVE_STATUSES[STATUS.READY_TO_SEND] = true;
ACTIVE_STATUSES[STATUS.SENDING] = true;
ACTIVE_STATUSES[STATUS.DESTINATION_STAGE] = true;
ACTIVE_STATUSES[STATUS.BLOCKED] = true;

function fmt(value) {
  return Math.round(value || 0).toLocaleString();
}

function now() {
  return typeof Game !== "undefined" && typeof Game.time === "number"
    ? Game.time
    : 0;
}

function normalizeEndpoint(endpoint) {
  if (typeof endpoint !== "string") return "";
  return endpoint.trim().toLowerCase();
}

function normalizeMode(mode) {
  if (typeof mode === "undefined" || mode === null || mode === "") {
    return "check";
  }

  if (typeof mode !== "string") return null;
  const normalized = mode.trim().toLowerCase();
  if (normalized === "check" || normalized === "confirm") return normalized;
  return null;
}

function normalizeResource(resource) {
  if (typeof resource !== "string") return null;
  const normalized = resource.trim();
  if (!normalized) return null;

  if (typeof RESOURCES_ALL !== "undefined" && Array.isArray(RESOURCES_ALL)) {
    if (RESOURCES_ALL.indexOf(normalized) !== -1) return normalized;
    const lowered = normalized.toLowerCase();
    for (let i = 0; i < RESOURCES_ALL.length; i++) {
      if (String(RESOURCES_ALL[i]).toLowerCase() === lowered) {
        return RESOURCES_ALL[i];
      }
    }
    return null;
  }

  return normalized;
}

function parseAmount(amount) {
  if (typeof amount === "string" && amount.trim() !== "") {
    amount = Number(amount);
  }

  if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
    return null;
  }

  return Math.floor(amount);
}

function isRoomName(roomName) {
  return typeof roomName === "string" && /^[WE]\d+[NS]\d+$/.test(roomName);
}

function getMemoryRoot() {
  if (!Memory.ops) Memory.ops = {};
  if (!Memory.ops.transfers) Memory.ops.transfers = {};
  return Memory.ops.transfers;
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
    const totalFree = target.store.getFreeCapacity();
    if (typeof totalFree === "number") return totalFree;

    const free = target.store.getFreeCapacity(resourceType);
    if (typeof free === "number") return free;
  }

  return 0;
}

function getEndpoint(roomName, location) {
  const room = Game.rooms[roomName];
  if (!room || !room.controller || !room.controller.my) return null;
  if (location !== "storage" && location !== "terminal") return null;
  return room[location] || null;
}

function calcTransactionCost(amount, fromRoom, toRoom) {
  if (Game.market && typeof Game.market.calcTransactionCost === "function") {
    return Game.market.calcTransactionCost(amount, fromRoom, toRoom);
  }

  if (Game.map && typeof Game.map.calcTransactionCost === "function") {
    return Game.map.calcTransactionCost(amount, fromRoom, toRoom);
  }

  return 0;
}

function resultLabel(result) {
  const labels = {};
  labels[OK] = "OK";
  labels[ERR_NOT_OWNER] = "ERR_NOT_OWNER";
  labels[ERR_BUSY] = "ERR_BUSY";
  labels[ERR_NOT_FOUND] = "ERR_NOT_FOUND";
  labels[ERR_NOT_ENOUGH_RESOURCES] = "ERR_NOT_ENOUGH_RESOURCES";
  labels[ERR_INVALID_TARGET] = "ERR_INVALID_TARGET";
  labels[ERR_FULL] = "ERR_FULL";
  labels[ERR_TIRED] = "ERR_TIRED";
  labels[ERR_INVALID_ARGS] = "ERR_INVALID_ARGS";
  return labels[result] || String(result);
}

function hasActiveThreat(roomName) {
  const roomMemory =
    Memory.rooms && Memory.rooms[roomName] ? Memory.rooms[roomName] : null;
  return !!(
    roomMemory &&
    roomMemory.state &&
    roomMemory.state.defense &&
    roomMemory.state.defense.hasThreats
  );
}

function hasCriticalCpuPressure() {
  return !!(Game.cpu && typeof Game.cpu.bucket === "number" && Game.cpu.bucket < 1000);
}

function makeTransferId(fromRoom, toRoom) {
  return [
    "ot",
    now(),
    fromRoom,
    toRoom,
    Math.floor(Math.random() * 10000),
  ].join("_");
}

function isActive(plan) {
  return !!(plan && ACTIVE_STATUSES[plan.status]);
}

function listPlans(includeHistory) {
  const root = getMemoryRoot();
  const rows = Object.keys(root)
    .map(function (id) {
      return root[id];
    })
    .filter(function (plan) {
      return !!plan && (includeHistory || isActive(plan));
    })
    .sort(function (a, b) {
      return (a.created || 0) - (b.created || 0);
    });

  return rows;
}

function pruneHistory() {
  const root = getMemoryRoot();
  const finished = Object.keys(root)
    .map(function (id) {
      return root[id];
    })
    .filter(function (plan) {
      return plan && !isActive(plan);
    })
    .sort(function (a, b) {
      return (b.updated || 0) - (a.updated || 0);
    });

  for (let i = HISTORY_LIMIT; i < finished.length; i++) {
    delete root[finished[i].id];
  }
}

function findDuplicate(draft) {
  const rows = listPlans(false);
  for (let i = 0; i < rows.length; i++) {
    const plan = rows[i];
    if (
      plan.resource === draft.resource &&
      plan.fromRoom === draft.fromRoom &&
      plan.toRoom === draft.toRoom &&
      plan.fromLocation === draft.fromLocation &&
      plan.toLocation === draft.toLocation
    ) {
      return plan;
    }
  }

  return null;
}

function endpointLabel(roomName, location) {
  return roomName + " " + location;
}

function routeLabel(plan) {
  return (
    endpointLabel(plan.fromRoom, plan.fromLocation) +
    " -> " +
    endpointLabel(plan.toRoom, plan.toLocation)
  );
}

function setBlocked(plan, reason, result) {
  plan.status = STATUS.BLOCKED;
  plan.blockedReason = reason;
  if (result) plan.lastResult = result;
  plan.updated = now();
  return plan;
}

function setProgress(plan, status, phase, result) {
  plan.status = status;
  plan.phase = phase || status;
  plan.blockedReason = null;
  if (result) plan.lastResult = result;
  plan.updated = now();
  return plan;
}

function buildDraft(resource, amount, fromRoom, fromLocation, toRoom, toLocation, mode) {
  return {
    resource: normalizeResource(resource),
    amount: parseAmount(amount) || 0,
    fromRoom: fromRoom,
    fromLocation: normalizeEndpoint(fromLocation),
    toRoom: toRoom,
    toLocation: normalizeEndpoint(toLocation),
    mode: normalizeMode(mode),
  };
}

function validateDraft(draft) {
  if (!draft.resource) return "invalid_resource";
  if (draft.amount <= 0) return "invalid_amount";
  if (!isRoomName(draft.fromRoom) || !isRoomName(draft.toRoom)) {
    return "invalid_room";
  }
  if (!draft.mode) return "invalid_mode";
  if (
    (draft.fromLocation !== "storage" && draft.fromLocation !== "terminal") ||
    (draft.toLocation !== "storage" && draft.toLocation !== "terminal")
  ) {
    return "unsupported_endpoint_path";
  }

  const sourceRoom = Game.rooms[draft.fromRoom];
  if (!sourceRoom || !sourceRoom.controller || !sourceRoom.controller.my) {
    return "source_room_not_owned";
  }
  if (hasActiveThreat(draft.fromRoom)) return "source_room_threat";
  if (hasCriticalCpuPressure()) return "critical_cpu_pressure";

  const sourceEndpoint = getEndpoint(draft.fromRoom, draft.fromLocation);
  if (!sourceEndpoint) return "source_" + draft.fromLocation + "_missing";

  const destinationRoom = Game.rooms[draft.toRoom];
  if (destinationRoom && (!destinationRoom.controller || !destinationRoom.controller.my)) {
    return "destination_room_not_owned";
  }
  if (hasActiveThreat(draft.toRoom)) return "destination_room_threat";

  if (draft.toLocation === "storage") {
    const destinationStorage = getEndpoint(draft.toRoom, "storage");
    if (!destinationStorage) return "destination_storage_missing";
  }

  if (draft.toLocation === "terminal") {
    const destinationTerminal = getEndpoint(draft.toRoom, "terminal");
    if (destinationRoom && !destinationTerminal) return "destination_terminal_missing";
  }

  if (draft.fromLocation === "storage" && !getEndpoint(draft.fromRoom, "terminal")) {
    return "source_terminal_missing";
  }

  if (draft.toLocation === "storage" && !getEndpoint(draft.toRoom, "terminal")) {
    return "destination_terminal_missing";
  }

  return null;
}

function destinationEndpointAmount(plan) {
  const endpoint = getEndpoint(plan.toRoom, plan.toLocation);
  return getStoredAmount(endpoint, plan.resource);
}

function sourceSendAmount(plan) {
  const terminal = getEndpoint(plan.fromRoom, "terminal");
  return getStoredAmount(terminal, plan.resource);
}

function buildReportLine(report) {
  const parts = [
    "[OPS][TRANSFER]",
    "resource " + (report.resource || "invalid"),
    "amount " + fmt(report.amount),
    routeLabel(report),
    "mode " + report.mode,
    "phase " + report.phase,
    "status " + report.status,
  ];

  if (report.id) parts.splice(1, 0, "id " + report.id);
  if (typeof report.transactionCost === "number") {
    parts.push("cost " + fmt(report.transactionCost));
  }
  if (typeof report.sourceAvailable === "number") {
    parts.push("source " + fmt(report.sourceAvailable));
  }
  if (typeof report.sourceEnergy === "number") {
    parts.push("energy " + fmt(report.sourceEnergy));
  }
  if (typeof report.destinationFree === "number") {
    parts.push("destFree " + fmt(report.destinationFree));
  } else if (report.destinationFree === null) {
    parts.push("destFree not_visible");
  }
  if (report.blockedReason) parts.push("blocked " + report.blockedReason);
  if (report.lastResult) parts.push("last " + report.lastResult);

  return parts.join(" | ");
}

function buildCheckReport(draft) {
  const report = {
    id: null,
    resource: draft.resource,
    amount: draft.amount,
    fromRoom: draft.fromRoom,
    fromLocation: draft.fromLocation,
    toRoom: draft.toRoom,
    toLocation: draft.toLocation,
    mode: draft.mode || "invalid",
    phase: STATUS.PENDING,
    status: "CHECK",
    transactionCost: null,
    sourceAvailable: 0,
    sourceEnergy: null,
    destinationFree: null,
    blockedReason: null,
    lastResult: null,
  };

  const validationError = validateDraft(draft);
  if (validationError) {
    report.status = STATUS.BLOCKED;
    report.blockedReason = validationError;
    return report;
  }

  const duplicate = findDuplicate(draft);
  if (duplicate) {
    report.status = STATUS.BLOCKED;
    report.blockedReason = "duplicate_active_transfer_" + duplicate.id;
    return report;
  }

  const sourceEndpoint = getEndpoint(draft.fromRoom, draft.fromLocation);
  report.sourceAvailable = getStoredAmount(sourceEndpoint, draft.resource);
  if (report.sourceAvailable < draft.amount) {
    report.status = STATUS.BLOCKED;
    report.blockedReason = "source_resource_insufficient";
    return report;
  }

  const finalDestination = getEndpoint(draft.toRoom, draft.toLocation);
  if (finalDestination) {
    report.destinationFree = getFreeCapacity(finalDestination, draft.resource);
    if (report.destinationFree < draft.amount) {
      report.status = STATUS.BLOCKED;
      report.blockedReason = "destination_capacity_insufficient";
      return report;
    }
  }

  if (draft.fromRoom !== draft.toRoom) {
    const sourceTerminal = getEndpoint(draft.fromRoom, "terminal");
    report.sourceEnergy = getStoredAmount(sourceTerminal, RESOURCE_ENERGY);
    report.transactionCost = calcTransactionCost(
      draft.amount,
      draft.fromRoom,
      draft.toRoom,
    );
  }

  return report;
}

function createPlan(draft) {
  const destinationEndpoint = getEndpoint(draft.toRoom, draft.toLocation);
  const plan = {
    id: makeTransferId(draft.fromRoom, draft.toRoom),
    resource: draft.resource,
    amount: draft.amount,
    fromRoom: draft.fromRoom,
    fromLocation: draft.fromLocation,
    toRoom: draft.toRoom,
    toLocation: draft.toLocation,
    status: STATUS.PENDING,
    phase: STATUS.PENDING,
    created: now(),
    updated: now(),
    sentAmount: 0,
    deliveredAmount: 0,
    initialDestinationAmount: getStoredAmount(destinationEndpoint, draft.resource),
    sourceRequestId: null,
    destinationRequestId: null,
    blockedReason: null,
    lastResult: "operator_confirmed",
  };
  getMemoryRoot()[plan.id] = plan;
  return plan;
}

function getRequest(requestId) {
  if (!requestId) return null;
  const rows = opsLogisticsManager.listRequests(null);
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].id === requestId) return rows[i];
  }
  return null;
}

function ensureLocalMove(plan, side, roomName, from, to, amount) {
  const result = opsLogisticsManager.createMoveRequest(
    plan.resource,
    amount,
    roomName,
    from,
    to,
    { priority: 70 },
  );

  if (!result.ok) {
    setBlocked(plan, result.message || "logistics_request_blocked", "logistics_blocked");
    return null;
  }

  if (side === "source") {
    plan.sourceRequestId = result.request.id;
  } else {
    plan.destinationRequestId = result.request.id;
  }

  plan.lastResult = result.skipped
    ? "existing_logistics_request_" + result.request.id
    : "created_logistics_request_" + result.request.id;
  plan.updated = now();
  return result.request;
}

function completeIfDelivered(plan) {
  plan.deliveredAmount = Math.max(
    0,
    destinationEndpointAmount(plan) - (plan.initialDestinationAmount || 0),
  );

  if (plan.deliveredAmount >= plan.amount) {
    setProgress(plan, STATUS.COMPLETE, STATUS.COMPLETE, "delivered");
    return true;
  }

  return false;
}

function readyToSend(plan) {
  const terminal = getEndpoint(plan.fromRoom, "terminal");
  if (!terminal) {
    setBlocked(plan, "source_terminal_missing", "missing_source_terminal");
    return false;
  }

  if (terminal.cooldown > 0) {
    setBlocked(plan, "source_terminal_cooldown", "cooldown_" + terminal.cooldown);
    return false;
  }

  const available = getStoredAmount(terminal, plan.resource);
  if (available < plan.amount) {
    setProgress(
      plan,
      STATUS.WAITING_SOURCE_RESOURCE,
      STATUS.WAITING_SOURCE_RESOURCE,
      "source_terminal_waiting",
    );
    return false;
  }

  const cost = calcTransactionCost(plan.amount, plan.fromRoom, plan.toRoom);
  const energy = getStoredAmount(terminal, RESOURCE_ENERGY);
  const requiredEnergy = plan.resource === RESOURCE_ENERGY ? plan.amount + cost : cost;
  if (energy < requiredEnergy) {
    setBlocked(plan, "transaction_energy_insufficient", "need_energy_" + cost);
    return false;
  }

  return true;
}

function runSourceStage(plan) {
  if (plan.fromLocation === "terminal") return true;

  if (!plan.sourceRequestId) {
    ensureLocalMove(
      plan,
      "source",
      plan.fromRoom,
      "storage",
      "terminal",
      plan.amount,
    );
    return false;
  }

  const request = getRequest(plan.sourceRequestId);
  if (request && request.status === "blocked") {
    setBlocked(plan, "source_stage_blocked", "request_" + request.id + "_blocked");
    return false;
  }

  if (sourceSendAmount(plan) < plan.amount) {
    setProgress(
      plan,
      STATUS.SOURCE_STAGE,
      STATUS.SOURCE_STAGE,
      "waiting_source_stage_" + plan.sourceRequestId,
    );
    return false;
  }

  return true;
}

function sendTerminal(plan) {
  if (!readyToSend(plan)) return false;

  const terminal = getEndpoint(plan.fromRoom, "terminal");
  const result = terminal.send(
    plan.resource,
    plan.amount,
    plan.toRoom,
    DESCRIPTION + " " + plan.id,
  );
  plan.lastResult = resultLabel(result);
  plan.updated = now();

  if (result !== OK) {
    setBlocked(plan, resultLabel(result), "terminal_send_failed");
    return false;
  }

  plan.sentAmount += plan.amount;
  setProgress(plan, STATUS.SENDING, STATUS.SENDING, "terminal_send_ok");
  return true;
}

function runDestinationStage(plan) {
  if (plan.toLocation === "terminal") {
    return completeIfDelivered(plan);
  }

  if (!getEndpoint(plan.toRoom, "terminal")) {
    setBlocked(plan, "destination_terminal_missing", "missing_destination_terminal");
    return false;
  }

  if (!getEndpoint(plan.toRoom, "storage")) {
    setBlocked(plan, "destination_storage_missing", "missing_destination_storage");
    return false;
  }

  if (!plan.destinationRequestId) {
    const request = ensureLocalMove(
      plan,
      "destination",
      plan.toRoom,
      "terminal",
      "storage",
      plan.amount,
    );
    if (!request) return false;
    setProgress(
      plan,
      STATUS.DESTINATION_STAGE,
      STATUS.DESTINATION_STAGE,
      plan.lastResult,
    );
    return false;
  }

  const request = getRequest(plan.destinationRequestId);
  if (request && request.status === "blocked") {
    setBlocked(plan, "destination_stage_blocked", "request_" + request.id + "_blocked");
    return false;
  }

  if (!completeIfDelivered(plan)) {
    setProgress(
      plan,
      STATUS.DESTINATION_STAGE,
      STATUS.DESTINATION_STAGE,
      "waiting_destination_stage_" + plan.destinationRequestId,
    );
  }

  return plan.status === STATUS.COMPLETE;
}

function advancePlan(plan) {
  if (!isActive(plan)) return plan;
  if (hasCriticalCpuPressure()) {
    return setBlocked(plan, "critical_cpu_pressure", "cpu_blocked");
  }
  if (hasActiveThreat(plan.fromRoom)) {
    return setBlocked(plan, "source_room_threat", "threat_blocked");
  }
  if (hasActiveThreat(plan.toRoom)) {
    return setBlocked(plan, "destination_room_threat", "threat_blocked");
  }

  if (completeIfDelivered(plan)) return plan;

  setProgress(plan, STATUS.SOURCE_STAGE, STATUS.SOURCE_STAGE, "advancing");
  if (!runSourceStage(plan)) return plan;

  setProgress(plan, STATUS.READY_TO_SEND, STATUS.READY_TO_SEND, "ready_to_send");
  if (plan.sentAmount <= 0 && !sendTerminal(plan)) return plan;

  runDestinationStage(plan);
  return plan;
}

function transfer(resource, amount, fromRoom, fromLocation, toRoom, toLocation, mode) {
  const draft = buildDraft(
    resource,
    amount,
    fromRoom,
    fromLocation,
    toRoom,
    toLocation,
    mode,
  );
  const report = buildCheckReport(draft);

  if (draft.mode !== "confirm" || report.status === STATUS.BLOCKED) {
    return buildReportLine(report);
  }

  const plan = createPlan(draft);
  advancePlan(plan);

  return buildReportLine({
    id: plan.id,
    resource: plan.resource,
    amount: plan.amount,
    fromRoom: plan.fromRoom,
    fromLocation: plan.fromLocation,
    toRoom: plan.toRoom,
    toLocation: plan.toLocation,
    mode: "confirm",
    phase: plan.phase,
    status: plan.status,
    transactionCost: calcTransactionCost(plan.amount, plan.fromRoom, plan.toRoom),
    sourceAvailable: sourceSendAmount(plan),
    sourceEnergy: getStoredAmount(getEndpoint(plan.fromRoom, "terminal"), RESOURCE_ENERGY),
    destinationFree: null,
    blockedReason: plan.blockedReason,
    lastResult: plan.lastResult,
  });
}

function formatSummary(plan) {
  return (
    plan.id +
    " | " +
    plan.resource +
    " " +
    fmt(plan.amount) +
    " | " +
    routeLabel(plan) +
    " | phase " +
    plan.phase +
    " | status " +
    plan.status
  );
}

function transfers() {
  const rows = listPlans(false);
  const lines = ["[OPS][TRANSFERS] active " + rows.length + ":"];
  if (!rows.length) lines.push("  none");
  for (let i = 0; i < rows.length; i++) {
    lines.push("  " + formatSummary(rows[i]));
  }
  return lines.join("\n");
}

function transferStatus(id) {
  const plan = getMemoryRoot()[id];
  if (!plan) return "[OPS][TRANSFER] not found: " + id;

  completeIfDelivered(plan);
  const progress =
    "sent " +
    fmt(plan.sentAmount) +
    "/" +
    fmt(plan.amount) +
    " | delivered " +
    fmt(plan.deliveredAmount) +
    "/" +
    fmt(plan.amount);
  const lines = [
    "[OPS][TRANSFER] " + plan.id,
    "resource " + plan.resource,
    "amount " + fmt(plan.amount),
    "source " + endpointLabel(plan.fromRoom, plan.fromLocation),
    "destination " + endpointLabel(plan.toRoom, plan.toLocation),
    "phase " + plan.phase,
    "status " + plan.status,
    "created " + plan.created,
    "updated " + plan.updated,
    "progress " + progress,
    "blocked reason " + (plan.blockedReason || "none"),
    "last result " + (plan.lastResult || "none"),
  ];
  return lines.join("\n");
}

function cancelTransfer(id) {
  const plan = getMemoryRoot()[id];
  if (!plan) return "[OPS][TRANSFER] not found: " + id;
  if (plan.status === STATUS.COMPLETE) {
    return "[OPS][TRANSFER] " + id + " already COMPLETE.";
  }
  if (plan.status === STATUS.CANCELLED) {
    return "[OPS][TRANSFER] " + id + " already CANCELLED.";
  }

  plan.status = STATUS.CANCELLED;
  plan.phase = STATUS.CANCELLED;
  plan.updated = now();
  plan.lastResult = "operator_cancelled";

  if (plan.sourceRequestId) opsLogisticsManager.cancelRequest(plan.sourceRequestId);
  if (plan.destinationRequestId) opsLogisticsManager.cancelRequest(plan.destinationRequestId);

  pruneHistory();
  return "[OPS][TRANSFER] cancelled " + id;
}

function run() {
  const rows = listPlans(false);
  for (let i = 0; i < rows.length; i++) {
    advancePlan(rows[i]);
  }
  pruneHistory();
  return rows.length;
}

module.exports = {
  DESCRIPTION: DESCRIPTION,
  STATUS: STATUS,
  transfer: transfer,
  transfers: transfers,
  transferStatus: transferStatus,
  cancelTransfer: cancelTransfer,
  run: run,
  _advancePlan: advancePlan,
};
