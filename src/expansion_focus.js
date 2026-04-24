/*
Developer Summary:
Expansion Focus Constants

Purpose:
- Keep expansion focus values consistent between console commands, memory, and construction planning
- Shape focused expansion rooms without changing their race to RCL8
*/

const FULL = "full";
const MINERAL = "mineral";
const ENERGY = "energy";

const VALUES = [FULL, MINERAL, ENERGY];

function normalize(value) {
  if (typeof value === "undefined" || value === null || value === "") {
    return FULL;
  }

  const normalized = String(value).trim().toLowerCase();
  for (let i = 0; i < VALUES.length; i++) {
    if (normalized === VALUES[i]) return normalized;
  }

  return null;
}

function removeActions(plan, actions) {
  if (!plan || !plan.buildList) return;

  plan.buildList = plan.buildList.filter(function (action) {
    return actions.indexOf(action) === -1;
  });
}

function ensureGoals(plan) {
  if (!plan.goals) plan.goals = {};
  if (!plan.goals.advancedStructures) plan.goals.advancedStructures = {};
  if (!plan.goals.structureTargets) plan.goals.structureTargets = {};
  if (!plan.goals.lateGameStructures) plan.goals.lateGameStructures = {};
  if (!plan.goals.linkPlanning) plan.goals.linkPlanning = {};

  return plan.goals;
}

function getFocusForRoom(roomName) {
  const plans =
    Memory.empire &&
    Memory.empire.expansion &&
    Memory.empire.expansion.plans
      ? Memory.empire.expansion.plans
      : null;
  const plan = plans && roomName ? plans[roomName] : null;

  if (!plan || plan.cancelled) return getStoredRoomFocus(roomName);
  return normalize(plan.focus) || FULL;
}

function getStoredRoomFocus(roomName) {
  const roomMemory = ensureRoomFocus(roomName);
  return roomMemory ? roomMemory.roomFocus : FULL;
}

function getEffectiveFocusForRoom(roomName) {
  const plans =
    Memory.empire &&
    Memory.empire.expansion &&
    Memory.empire.expansion.plans
      ? Memory.empire.expansion.plans
      : null;
  const plan = plans && roomName ? plans[roomName] : null;

  if (plan && !plan.cancelled) return normalize(plan.focus) || FULL;
  return getStoredRoomFocus(roomName);
}

function applyToPlan(plan, focusName) {
  const focus = normalize(focusName);
  if (!plan) return plan;

  plan.expansionFocus = focus || FULL;
  if (focus === FULL) return plan;

  const goals = ensureGoals(plan);
  goals.structureTargets[STRUCTURE_TOWER] = 2;

  if (focus === MINERAL) {
    goals.advancedStructures.terminal = true;
    goals.advancedStructures.extractor = true;
    goals.advancedStructures.labs = Math.min(3, goals.advancedStructures.labs || 3);
    goals.lateGameStructures.factory = false;
    goals.lateGameStructures.observer = false;
    goals.lateGameStructures.powerSpawn = false;
    goals.lateGameStructures.nuker = false;
    removeActions(plan, ["factory", "observer", "powerSpawn", "nuker"]);
    return plan;
  }

  if (focus === ENERGY) {
    goals.advancedStructures.terminal = true;
    goals.advancedStructures.extractor = false;
    goals.advancedStructures.labs = 0;
    goals.linkPlanning.mineralLink = false;
    goals.lateGameStructures.factory = false;
    goals.lateGameStructures.observer = false;
    goals.lateGameStructures.powerSpawn = false;
    goals.lateGameStructures.nuker = false;
    removeActions(plan, [
      "mineralContainer",
      "extractor",
      "labs",
      "mineralAccessRoad",
      "factory",
      "observer",
      "powerSpawn",
      "nuker",
    ]);
  }

  return plan;
}

function ensureRoomFocus(roomName) {
  if (!roomName) return null;
  if (!Memory.rooms) Memory.rooms = {};
  if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};

  const roomMemory = Memory.rooms[roomName];
  const focus = normalize(roomMemory.roomFocus);
  if (!focus) {
    roomMemory.roomFocus = FULL;
    roomMemory.roomFocusMigratedAt = Game.time;
  } else if (roomMemory.roomFocus !== focus) {
    roomMemory.roomFocus = focus;
    roomMemory.roomFocusMigratedAt = Game.time;
  }

  return roomMemory;
}

function setRoomFocus(roomName, focusName) {
  const focus = normalize(focusName);
  if (!roomName || !focus) return null;

  const roomMemory = ensureRoomFocus(roomName);
  if (!roomMemory) return null;
  roomMemory.roomFocus = focus;
  roomMemory.roomFocusUpdatedAt = Game.time;

  return focus;
}

module.exports = {
  FULL,
  MINERAL,
  ENERGY,
  DEFAULT: FULL,
  VALUES,
  normalize,
  getFocusForRoom,
  getStoredRoomFocus,
  getEffectiveFocusForRoom,
  ensureRoomFocus,
  setRoomFocus,
  applyToPlan,

  isFocus(value) {
    if (typeof value === "undefined" || value === null || value === "") {
      return false;
    }

    return normalize(value) !== null;
  },
};
