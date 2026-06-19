/*
Developer Summary:
Power Creep Generate Ops Manager

Purpose:
- Keep the known Operator_GenOps Power Creep spawned when a valid home Power
  Spawn is visible
- Use PWR_GENERATE_OPS when the creep is spawned, ready, and off cooldown
- Write compact operator diagnostics into existing room power memory

Scope:
- Only the configured named Power Creep
- Only PWR_GENERATE_OPS
- No autonomous room enablement, remote travel, market, terminal, or normal
  creep spawn behavior
*/

const config = require("config");

const STATUS = {
  SPAWNED: "SPAWNED",
  GENERATED: "GENERATED",
  BLOCKED_DISABLED: "BLOCKED_DISABLED",
  BLOCKED_MISSING_POWER_CREEP: "BLOCKED_MISSING_POWER_CREEP",
  BLOCKED_MISSING_POWER_SPAWN: "BLOCKED_MISSING_POWER_SPAWN",
  BLOCKED_NOT_OWNED: "BLOCKED_NOT_OWNED",
  BLOCKED_ROOM_NOT_VISIBLE: "BLOCKED_ROOM_NOT_VISIBLE",
  BLOCKED_ROOM_NOT_POWER_ENABLED: "BLOCKED_ROOM_NOT_POWER_ENABLED",
  BLOCKED_MISSING_POWER: "BLOCKED_MISSING_POWER",
  BLOCKED_COOLDOWN: "BLOCKED_COOLDOWN",
  BLOCKED_NO_USE_POWER: "BLOCKED_NO_USE_POWER",
  BLOCKED_NO_SPAWN_METHOD: "BLOCKED_NO_SPAWN_METHOD",
  API_ERROR: "API_ERROR",
};

function getPowerConstant(settings) {
  if (typeof PWR_GENERATE_OPS !== "undefined") return PWR_GENERATE_OPS;
  return settings.POWER || "PWR_GENERATE_OPS";
}

function getOpsResourceType() {
  return typeof RESOURCE_OPS !== "undefined" ? RESOURCE_OPS : "ops";
}

function getStoreAmount(target, resourceType) {
  if (!target || !target.store) return 0;
  if (typeof target.store.getUsedCapacity === "function") {
    const used = target.store.getUsedCapacity(resourceType);
    if (typeof used === "number") return used;
  }
  return target.store[resourceType] || 0;
}

function getStoreCapacity(target, resourceType) {
  if (!target || !target.store) return null;
  if (typeof target.store.getCapacity === "function") {
    const capacity = target.store.getCapacity(resourceType);
    if (typeof capacity === "number") return capacity;
  }
  if (
    typeof target.store.getUsedCapacity === "function" &&
    typeof target.store.getFreeCapacity === "function"
  ) {
    const used = target.store.getUsedCapacity(resourceType);
    const free = target.store.getFreeCapacity(resourceType);
    if (typeof used === "number" && typeof free === "number") return used + free;
  }
  return null;
}

function getPowerInfo(powerCreep, powerConstant) {
  if (!powerCreep || !powerCreep.powers) return null;
  return powerCreep.powers[powerConstant] || powerCreep.powers.PWR_GENERATE_OPS || null;
}

function isSpawned(powerCreep) {
  return !!(
    powerCreep &&
    (powerCreep.ticksToLive || powerCreep.room || powerCreep.pos)
  );
}

function getCreepRoomName(powerCreep) {
  if (!powerCreep) return null;
  if (powerCreep.room && powerCreep.room.name) return powerCreep.room.name;
  if (powerCreep.pos && powerCreep.pos.roomName) return powerCreep.pos.roomName;
  return null;
}

function isOwnedRoom(room) {
  return !!(room && room.controller && room.controller.my);
}

function isPowerEnabled(room) {
  return !!(room && room.controller && room.controller.isPowerEnabled);
}

module.exports = {
  STATUS: STATUS,

  run(ownedRooms) {
    const settings = this.getSettings();
    const room = this.resolveHomeRoom(settings.HOME_ROOM, ownedRooms);
    const mem = this.getHomeMemory(settings.HOME_ROOM);

    if (!settings.ENABLED) {
      this.writeStatus(mem, settings, room, null, STATUS.BLOCKED_DISABLED, "idle", null);
      return mem;
    }

    const powerCreep = this.getPowerCreep(settings.NAME);
    if (!powerCreep) {
      this.writeStatus(mem, settings, room, null, STATUS.BLOCKED_MISSING_POWER_CREEP, "idle", null);
      return mem;
    }

    if (!isSpawned(powerCreep)) {
      return this.runSpawn(settings, room, powerCreep, mem);
    }

    return this.runGenerate(settings, room, powerCreep, mem);
  },

  getSettings() {
    const configured =
      config.POWER_CREEPS && config.POWER_CREEPS.GENERATE_OPS
        ? config.POWER_CREEPS.GENERATE_OPS
        : {};
    return Object.assign(
      {
        ENABLED: true,
        NAME: "Operator_GenOps",
        HOME_ROOM: "W42N9",
        POWER: "PWR_GENERATE_OPS",
      },
      configured,
    );
  },

  resolveHomeRoom(homeRoomName, ownedRooms) {
    if (
      homeRoomName &&
      Game.rooms &&
      Game.rooms[homeRoomName] &&
      isOwnedRoom(Game.rooms[homeRoomName])
    ) {
      return Game.rooms[homeRoomName];
    }

    const rooms = ownedRooms || [];
    for (let i = 0; i < rooms.length; i++) {
      if (isOwnedRoom(rooms[i])) return rooms[i];
    }

    return null;
  },

  getHomeMemory(homeRoomName) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[homeRoomName]) Memory.rooms[homeRoomName] = {};
    if (!Memory.rooms[homeRoomName].power) Memory.rooms[homeRoomName].power = {};
    if (!Memory.rooms[homeRoomName].power.generateOps) {
      Memory.rooms[homeRoomName].power.generateOps = {};
    }
    return Memory.rooms[homeRoomName].power.generateOps;
  },

  getPowerCreep(name) {
    return Game.powerCreeps && Game.powerCreeps[name] ? Game.powerCreeps[name] : null;
  },

  getOwnedPowerSpawn(room) {
    if (!room || typeof room.find !== "function") return null;
    const structures = room.find(FIND_MY_STRUCTURES, {
      filter(structure) {
        return structure.structureType === STRUCTURE_POWER_SPAWN;
      },
    });
    return structures && structures.length > 0 ? structures[0] : null;
  },

  runSpawn(settings, room, powerCreep, mem) {
    if (!isOwnedRoom(room)) {
      this.writeStatus(mem, settings, room, powerCreep, STATUS.BLOCKED_ROOM_NOT_VISIBLE, "spawn", null);
      return mem;
    }

    const powerSpawn = this.getOwnedPowerSpawn(room);
    if (!powerSpawn) {
      this.writeStatus(mem, settings, room, powerCreep, STATUS.BLOCKED_MISSING_POWER_SPAWN, "spawn", null);
      return mem;
    }

    let result = null;
    if (typeof powerCreep.spawn === "function") {
      result = powerCreep.spawn(powerSpawn);
    } else if (typeof powerSpawn.spawnPowerCreep === "function") {
      result = powerSpawn.spawnPowerCreep(powerCreep);
    } else {
      this.writeStatus(mem, settings, room, powerCreep, STATUS.BLOCKED_NO_SPAWN_METHOD, "spawn", null);
      return mem;
    }

    this.writeStatus(
      mem,
      settings,
      room,
      powerCreep,
      result === OK ? STATUS.SPAWNED : STATUS.API_ERROR,
      "spawn",
      result,
    );
    return mem;
  },

  runGenerate(settings, room, powerCreep, mem) {
    const roomName = getCreepRoomName(powerCreep);
    const currentRoom = roomName && Game.rooms ? Game.rooms[roomName] : null;
    const powerConstant = getPowerConstant(settings);
    const powerInfo = getPowerInfo(powerCreep, powerConstant);
    const cooldown = powerInfo && typeof powerInfo.cooldown === "number" ? powerInfo.cooldown : 0;

    if (!currentRoom) {
      this.writeStatus(mem, settings, room, powerCreep, STATUS.BLOCKED_ROOM_NOT_VISIBLE, "generate_ops", null);
      return mem;
    }
    if (!isOwnedRoom(currentRoom)) {
      this.writeStatus(mem, settings, currentRoom, powerCreep, STATUS.BLOCKED_NOT_OWNED, "generate_ops", null);
      return mem;
    }
    if (!isPowerEnabled(currentRoom)) {
      this.writeStatus(mem, settings, currentRoom, powerCreep, STATUS.BLOCKED_ROOM_NOT_POWER_ENABLED, "generate_ops", null);
      return mem;
    }
    if (!powerInfo) {
      this.writeStatus(mem, settings, currentRoom, powerCreep, STATUS.BLOCKED_MISSING_POWER, "generate_ops", null);
      return mem;
    }
    if (cooldown > 0) {
      this.writeStatus(mem, settings, currentRoom, powerCreep, STATUS.BLOCKED_COOLDOWN, "idle", null);
      return mem;
    }
    if (typeof powerCreep.usePower !== "function") {
      this.writeStatus(mem, settings, currentRoom, powerCreep, STATUS.BLOCKED_NO_USE_POWER, "generate_ops", null);
      return mem;
    }

    const result = powerCreep.usePower(powerConstant);
    this.writeStatus(
      mem,
      settings,
      currentRoom,
      powerCreep,
      result === OK ? STATUS.GENERATED : STATUS.API_ERROR,
      "generate_ops",
      result,
    );
    return mem;
  },

  writeStatus(mem, settings, room, powerCreep, status, action, result) {
    const powerConstant = getPowerConstant(settings);
    const powerInfo = getPowerInfo(powerCreep, powerConstant);
    const resourceType = getOpsResourceType();

    mem.enabled = !!settings.ENABLED;
    mem.name = settings.NAME;
    mem.homeRoom = settings.HOME_ROOM;
    mem.power = settings.POWER;
    mem.lastTick = Game.time;
    mem.status = status;
    mem.blockedReason =
      status === STATUS.SPAWNED || status === STATUS.GENERATED ? null : status;
    mem.spawned = !!(powerCreep && isSpawned(powerCreep));
    mem.currentRoom = getCreepRoomName(powerCreep);
    mem.ticksToLive =
      powerCreep && typeof powerCreep.ticksToLive === "number"
        ? powerCreep.ticksToLive
        : null;
    mem.level = powerInfo && typeof powerInfo.level === "number" ? powerInfo.level : 0;
    mem.cooldown = powerInfo && typeof powerInfo.cooldown === "number" ? powerInfo.cooldown : 0;
    mem.ops = getStoreAmount(powerCreep, resourceType);
    mem.opsCapacity = getStoreCapacity(powerCreep, resourceType);
    const homeRoom =
      settings.HOME_ROOM && Game.rooms ? Game.rooms[settings.HOME_ROOM] : null;
    mem.powerEnabled = isPowerEnabled(homeRoom || room);
    mem.lastAction = action || "idle";
    mem.lastResult = typeof result === "number" ? result : null;
  },
};
