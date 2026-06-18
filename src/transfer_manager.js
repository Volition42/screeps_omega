const DESCRIPTION = "Omega ops.transfer";
const UNSUPPORTED_PATH =
  "[OPS][TRANSFER] unsupported staged endpoint path; currently supports terminal -> terminal only";

function fmt(value) {
  return Math.round(value || 0).toLocaleString();
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
    const free = target.store.getFreeCapacity();
    if (typeof free === "number") return free;

    const resourceFree = target.store.getFreeCapacity(resourceType);
    if (typeof resourceFree === "number") return resourceFree;
  }

  return 0;
}

function calcTransactionCost(amount, fromRoom, toRoom) {
  if (
    Game.market &&
    typeof Game.market.calcTransactionCost === "function"
  ) {
    return Game.market.calcTransactionCost(amount, fromRoom, toRoom);
  }

  if (Game.map && typeof Game.map.calcTransactionCost === "function") {
    return Game.map.calcTransactionCost(amount, fromRoom, toRoom);
  }

  return 0;
}

function hasActiveThreat(room) {
  const roomMemory =
    Memory.rooms && Memory.rooms[room.name] ? Memory.rooms[room.name] : null;
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

function buildLine(report) {
  const parts = [
    "[OPS][TRANSFER]",
    "resource " + (report.resourceType || "invalid"),
    "amount " + fmt(report.amount),
    report.fromRoom + " " + report.fromLocation + " -> " + report.toRoom + " " + report.toLocation,
    "mode " + report.mode,
    "cost " + fmt(report.transactionCost),
    "source " + fmt(report.sourceAvailable),
    "energy " + fmt(report.sourceEnergy),
  ];

  if (report.destinationFree !== null) {
    parts.push("destFree " + fmt(report.destinationFree));
  } else {
    parts.push("destFree not_visible");
  }

  parts.push("status " + report.status);
  if (report.blockedReason) parts.push("blocked " + report.blockedReason);
  if (typeof report.resultCode === "number") {
    parts.push("result " + resultLabel(report.resultCode));
  }

  return parts.join(" | ");
}

function buildReport(args) {
  const report = {
    resourceType: normalizeResource(args.resource),
    amount: parseAmount(args.amount) || 0,
    fromRoom: args.fromRoom,
    fromLocation: normalizeEndpoint(args.fromLocation),
    toRoom: args.toRoom,
    toLocation: normalizeEndpoint(args.toLocation),
    mode: normalizeMode(args.mode),
    transactionCost: 0,
    sourceAvailable: 0,
    sourceEnergy: 0,
    destinationFree: null,
    status: "BLOCKED",
    blockedReason: null,
    resultCode: null,
  };

  if (!report.resourceType) {
    report.blockedReason = "invalid_resource";
    return report;
  }
  if (report.amount <= 0) {
    report.blockedReason = "invalid_amount";
    return report;
  }
  if (!isRoomName(report.fromRoom) || !isRoomName(report.toRoom)) {
    report.blockedReason = "invalid_room";
    return report;
  }
  if (!report.mode) {
    report.mode = "invalid";
    report.blockedReason = "invalid_mode";
    return report;
  }
  if (report.fromLocation !== "terminal" || report.toLocation !== "terminal") {
    report.blockedReason = "unsupported_endpoint_path";
    return report;
  }

  const sourceRoom = Game.rooms[report.fromRoom];
  if (!sourceRoom || !sourceRoom.controller || !sourceRoom.controller.my) {
    report.blockedReason = "source_room_not_owned";
    return report;
  }
  if (!sourceRoom.terminal) {
    report.blockedReason = "source_terminal_missing";
    return report;
  }
  if (sourceRoom.terminal.my === false) {
    report.blockedReason = "source_terminal_not_owned";
    return report;
  }
  if (sourceRoom.terminal.cooldown > 0) {
    report.blockedReason = "source_terminal_cooldown";
    return report;
  }
  if (hasActiveThreat(sourceRoom)) {
    report.blockedReason = "source_room_threat";
    return report;
  }
  if (hasCriticalCpuPressure()) {
    report.blockedReason = "critical_cpu_pressure";
    return report;
  }

  report.sourceAvailable = getStoredAmount(sourceRoom.terminal, report.resourceType);
  report.sourceEnergy = getStoredAmount(sourceRoom.terminal, RESOURCE_ENERGY);
  report.transactionCost = calcTransactionCost(
    report.amount,
    report.fromRoom,
    report.toRoom,
  );

  if (report.sourceAvailable < report.amount) {
    report.blockedReason = "source_resource_insufficient";
    return report;
  }
  if (report.sourceEnergy < report.transactionCost) {
    report.blockedReason = "transaction_energy_insufficient";
    return report;
  }

  const destinationRoom = Game.rooms[report.toRoom];
  if (destinationRoom) {
    if (destinationRoom.controller && destinationRoom.controller.my && !destinationRoom.terminal) {
      report.blockedReason = "destination_terminal_missing";
      return report;
    }
    if (destinationRoom.terminal) {
      report.destinationFree = getFreeCapacity(
        destinationRoom.terminal,
        report.resourceType,
      );
      if (report.destinationFree < report.amount) {
        report.blockedReason = "destination_capacity_insufficient";
        return report;
      }
    }
  }

  report.status = report.mode === "confirm" ? "READY" : "CHECK";
  return report;
}

function transfer(resource, amount, fromRoom, fromLocation, toRoom, toLocation, mode) {
  const report = buildReport({
    resource: resource,
    amount: amount,
    fromRoom: fromRoom,
    fromLocation: fromLocation,
    toRoom: toRoom,
    toLocation: toLocation,
    mode: mode,
  });

  if (report.blockedReason === "unsupported_endpoint_path") {
    return UNSUPPORTED_PATH;
  }

  if (report.status === "READY") {
    const sourceRoom = Game.rooms[report.fromRoom];
    report.resultCode = sourceRoom.terminal.send(
      report.resourceType,
      report.amount,
      report.toRoom,
      DESCRIPTION,
    );
    report.status = report.resultCode === OK ? "SENT" : "FAILED";
    if (report.resultCode !== OK) report.blockedReason = resultLabel(report.resultCode);
  }

  return buildLine(report);
}

module.exports = {
  DESCRIPTION: DESCRIPTION,
  UNSUPPORTED_PATH: UNSUPPORTED_PATH,
  transfer: transfer,
};
