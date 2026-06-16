/*
Developer Summary:
Power Manager

Purpose:
- Start safe GPL progress in mature RCL8 rooms
- Process power through built Power Spawns when resources are already present
- Keep this first phase intentionally narrow and low CPU

Current Scope:
- Finds owned Power Spawns in RCL8 rooms
- Calls processPower only when the Power Spawn has enough energy and power
- Writes lightweight status into Memory.rooms[roomName].power
- Does not buy power
- Does not harvest Power Banks
- Does not spawn or manage Power Creeps
- Does not move energy or power into the Power Spawn yet

Important Notes:
- processPower consumes 1 POWER and 50 ENERGY per successful call.
- Logistics/refill support will come in a later phase.
*/

const config = require("config");

const READINESS = {
  READY: "READY",
  BLOCKED_NO_POWER_SPAWN: "BLOCKED_NO_POWER_SPAWN",
  BLOCKED_RCL: "BLOCKED_RCL",
  BLOCKED_NO_POWER: "BLOCKED_NO_POWER",
  BLOCKED_NO_ENERGY: "BLOCKED_NO_ENERGY",
  BLOCKED_STORAGE_RESERVE: "BLOCKED_STORAGE_RESERVE",
  BLOCKED_TERMINAL_ENERGY: "BLOCKED_TERMINAL_ENERGY",
  BLOCKED_THREAT: "BLOCKED_THREAT",
  BLOCKED_CPU_PRESSURE: "BLOCKED_CPU_PRESSURE",
  PROCESSED: "PROCESSED",
};

module.exports = {
  READINESS: READINESS,

  run(room, state) {
    if (!config.POWER || !config.POWER.ENABLED) return;
    if (!room.controller || !room.controller.my) return;

    const settings = this.getSettings();
    const mem = this.getRoomMemory(room);
    if (room.controller.level < settings.MIN_RCL) {
      this.writeStatus(mem, {
        readiness: READINESS.BLOCKED_RCL,
        reason: READINESS.BLOCKED_RCL,
        powerSpawns: 0,
        powerSpawnId: null,
        powerSpawnEnergy: 0,
        powerSpawnPower: 0,
        storageEnergy: this.getStoredAmount(room.storage, RESOURCE_ENERGY),
        terminalEnergy: this.getStoredAmount(room.terminal, RESOURCE_ENERGY),
        terminalPower: this.getStoredAmount(room.terminal, RESOURCE_POWER),
        minStorageEnergy: settings.MIN_STORAGE_ENERGY,
        minTerminalEnergy: settings.MIN_TERMINAL_ENERGY,
        energyTarget: settings.POWER_SPAWN_ENERGY_TARGET,
        powerTarget: settings.POWER_SPAWN_POWER_TARGET,
        result: null,
      });
      return;
    }

    const powerSpawns = this.getPowerSpawns(room, state);
    const powerSpawn = powerSpawns.length > 0 ? powerSpawns[0] : null;
    const storageEnergy = this.getStoredAmount(room.storage, RESOURCE_ENERGY);
    const terminalEnergy = this.getStoredAmount(room.terminal, RESOURCE_ENERGY);
    const terminalPower = this.getStoredAmount(room.terminal, RESOURCE_POWER);
    const powerSpawnEnergy = this.getStoredAmount(powerSpawn, RESOURCE_ENERGY);
    const powerSpawnPower = this.getStoredAmount(powerSpawn, RESOURCE_POWER);
    const readiness = this.getReadiness(
      room,
      state,
      settings,
      powerSpawns,
      storageEnergy,
      terminalEnergy,
      powerSpawnEnergy,
      powerSpawnPower,
    );

    this.writeStatus(mem, {
      readiness: readiness,
      reason: readiness,
      powerSpawns: powerSpawns.length,
      powerSpawnId: powerSpawn ? powerSpawn.id : null,
      powerSpawnEnergy: powerSpawnEnergy,
      powerSpawnPower: powerSpawnPower,
      storageEnergy: storageEnergy,
      terminalEnergy: terminalEnergy,
      terminalPower: terminalPower,
      minStorageEnergy: settings.MIN_STORAGE_ENERGY,
      minTerminalEnergy: settings.MIN_TERMINAL_ENERGY,
      energyTarget: settings.POWER_SPAWN_ENERGY_TARGET,
      powerTarget: settings.POWER_SPAWN_POWER_TARGET,
      processed: false,
      result: null,
    });

    if (readiness !== READINESS.READY) {
      return;
    }

    const result = powerSpawn.processPower();
    mem.result = result;

    if (result === OK) {
      mem.processed = true;
      mem.readiness = READINESS.PROCESSED;
      mem.reason = READINESS.PROCESSED;
      mem.blockedReason = null;
      mem.lastProcessed = Game.time;
      mem.totalProcessed = (mem.totalProcessed || 0) + 1;
      return;
    }

    mem.reason = this.describeResult(result);
    mem.blockedReason = mem.reason;
  },

  getSettings() {
    return Object.assign(
      {
        ENABLED: true,
        MIN_RCL: 8,
        MIN_STORAGE_ENERGY: 50000,
        MIN_TERMINAL_ENERGY: 0,
        PROCESS_UNDER_THREAT: false,
        PROCESS_UNDER_CRITICAL_CPU: false,
        POWER_SPAWN_ENERGY_TARGET: 5000,
        POWER_SPAWN_POWER_TARGET: 100,
        PROCESS_POWER_COST: 1,
        PROCESS_ENERGY_COST: 50,
        REPORT_INTERVAL: 100,
      },
      config.POWER || {},
    );
  },

  getRoomMemory(room) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].power) Memory.rooms[room.name].power = {};
    return Memory.rooms[room.name].power;
  },

  writeStatus(mem, status) {
    mem.lastSeen = Game.time;
    mem.readiness = status.readiness;
    mem.reason = status.reason;
    mem.blockedReason =
      status.readiness === READINESS.READY || status.readiness === READINESS.PROCESSED
        ? null
        : status.reason;
    mem.powerSpawns = status.powerSpawns;
    mem.powerSpawnId = status.powerSpawnId;
    mem.powerSpawnEnergy = status.powerSpawnEnergy;
    mem.powerSpawnPower = status.powerSpawnPower;
    mem.storageEnergy = status.storageEnergy;
    mem.terminalEnergy = status.terminalEnergy;
    mem.terminalPower = status.terminalPower;
    mem.minStorageEnergy = status.minStorageEnergy;
    mem.minTerminalEnergy = status.minTerminalEnergy;
    mem.energyTarget = status.energyTarget;
    mem.powerTarget = status.powerTarget;
    mem.processed = false;
    mem.result = status.result;

    // Legacy aliases kept for existing console snippets and memory inspection.
    mem.energy = status.powerSpawnEnergy;
    mem.power = status.powerSpawnPower;
  },

  getReadiness(
    room,
    state,
    settings,
    powerSpawns,
    storageEnergy,
    terminalEnergy,
    powerSpawnEnergy,
    powerSpawnPower,
  ) {
    if (powerSpawns.length === 0) {
      return READINESS.BLOCKED_NO_POWER_SPAWN;
    }

    if (!settings.PROCESS_UNDER_THREAT && this.hasActiveThreat(room, state)) {
      return READINESS.BLOCKED_THREAT;
    }

    if (!settings.PROCESS_UNDER_CRITICAL_CPU && this.isCriticalCpuPressure(room)) {
      return READINESS.BLOCKED_CPU_PRESSURE;
    }

    if (storageEnergy < settings.MIN_STORAGE_ENERGY) {
      return READINESS.BLOCKED_STORAGE_RESERVE;
    }

    if (terminalEnergy < settings.MIN_TERMINAL_ENERGY) {
      return READINESS.BLOCKED_TERMINAL_ENERGY;
    }

    if (powerSpawnPower < settings.PROCESS_POWER_COST) {
      return READINESS.BLOCKED_NO_POWER;
    }

    if (powerSpawnEnergy < settings.PROCESS_ENERGY_COST) {
      return READINESS.BLOCKED_NO_ENERGY;
    }

    return READINESS.READY;
  },

  getPowerSpawns(room, state) {
    if (
      state &&
      state.structuresByType &&
      state.structuresByType[STRUCTURE_POWER_SPAWN]
    ) {
      return state.structuresByType[STRUCTURE_POWER_SPAWN];
    }

    if (state && state.structures) {
      return _.filter(state.structures, function (structure) {
        return structure.structureType === STRUCTURE_POWER_SPAWN && structure.my !== false;
      });
    }

    return room.find(FIND_MY_STRUCTURES, {
      filter: function (structure) {
        return structure.structureType === STRUCTURE_POWER_SPAWN;
      },
    });
  },

  getStoredAmount(target, resourceType) {
    if (!target || !target.store) return 0;

    if (typeof target.store.getUsedCapacity === "function") {
      const used = target.store.getUsedCapacity(resourceType);
      if (typeof used === "number") return used;
    }

    return target.store[resourceType] || 0;
  },

  hasActiveThreat(room, state) {
    if (state && state.defense && state.defense.hasThreats) return true;
    if (state && state.hostileCreeps && state.hostileCreeps.length > 0) return true;

    const roomMemory =
      Memory.rooms && Memory.rooms[room.name] ? Memory.rooms[room.name] : null;
    const defense = roomMemory && roomMemory.defense ? roomMemory.defense : null;
    if (defense && defense.recovery && defense.recovery.active) return true;

    return false;
  },

  isCriticalCpuPressure(room) {
    if (
      Memory.stats &&
      Memory.stats.rooms &&
      Memory.stats.rooms[room.name] &&
      Memory.stats.rooms[room.name].cpu &&
      Memory.stats.rooms[room.name].cpu.pressure === "critical"
    ) {
      return true;
    }

    return !!(
      Memory.stats &&
      Memory.stats.runtime &&
      Memory.stats.runtime.pressure === "critical"
    );
  },

  describeResult(result) {
    switch (result) {
      case ERR_NOT_OWNER:
        return "not_owner";
      case ERR_NOT_ENOUGH_RESOURCES:
        return "not_enough_resources";
      case ERR_RCL_NOT_ENOUGH:
        return "rcl_not_enough";
      default:
        return "result_" + result;
    }
  },
};
