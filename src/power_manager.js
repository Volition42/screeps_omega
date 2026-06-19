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
const opsLogisticsManager = require("ops_logistics_manager");

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
  BLOCKED_DISABLED: "BLOCKED_DISABLED",
  PROCESSED: "PROCESSED",
};

const REFILL = {
  READY: "REFILL_READY",
  NOT_NEEDED: "REFILL_NOT_NEEDED",
  NEEDS_ENERGY: "REFILL_NEEDS_ENERGY",
  NEEDS_POWER: "REFILL_NEEDS_POWER",
  NEEDS_BOTH: "REFILL_NEEDS_BOTH",
  BLOCKED_NO_STORAGE: "REFILL_BLOCKED_NO_STORAGE",
  BLOCKED_NO_TERMINAL: "REFILL_BLOCKED_NO_TERMINAL",
  BLOCKED_STORAGE_RESERVE: "REFILL_BLOCKED_STORAGE_RESERVE",
  BLOCKED_TERMINAL_RESERVE: "REFILL_BLOCKED_TERMINAL_RESERVE",
  BLOCKED_THREAT: "REFILL_BLOCKED_THREAT",
  BLOCKED_CPU_PRESSURE: "REFILL_BLOCKED_CPU_PRESSURE",
  REQUEST_PENDING: "REFILL_REQUEST_PENDING",
  REQUEST_CREATED: "REFILL_REQUEST_CREATED",
  BLOCKED_DISABLED: "REFILL_BLOCKED_DISABLED",
  BLOCKED_RCL: "REFILL_BLOCKED_RCL",
};

module.exports = {
  READINESS: READINESS,
  REFILL: REFILL,

  run(room, state) {
    if (!room.controller || !room.controller.my) return;

    const settings = this.getEffectiveSettings(room);
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
        globalEnabled: settings.GLOBAL_ENABLED,
        globalRefillEnabled: settings.GLOBAL_REFILL_ENABLED,
        processingOverride: settings.PROCESSING_OVERRIDE,
        refillOverride: settings.REFILL_OVERRIDE,
        effectiveProcessingEnabled: settings.EFFECTIVE_PROCESSING_ENABLED,
        effectiveRefillEnabled: settings.EFFECTIVE_REFILL_ENABLED,
        minStorageEnergyOverride: settings.MIN_STORAGE_ENERGY_OVERRIDE,
        result: null,
      });
      return;
    }

    const powerSpawns = this.getPowerSpawns(room, state);
    const powerSpawn = powerSpawns.length > 0 ? powerSpawns[0] : null;
    const storageEnergy = this.getStoredAmount(room.storage, RESOURCE_ENERGY);
    const storagePower = this.getStoredAmount(room.storage, RESOURCE_POWER);
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
      storagePower: storagePower,
      terminalEnergy: terminalEnergy,
      terminalPower: terminalPower,
      minStorageEnergy: settings.MIN_STORAGE_ENERGY,
      minTerminalEnergy: settings.MIN_TERMINAL_ENERGY,
      energyTarget: settings.POWER_SPAWN_ENERGY_TARGET,
      powerTarget: settings.POWER_SPAWN_POWER_TARGET,
      globalEnabled: settings.GLOBAL_ENABLED,
      globalRefillEnabled: settings.GLOBAL_REFILL_ENABLED,
      processingOverride: settings.PROCESSING_OVERRIDE,
      refillOverride: settings.REFILL_OVERRIDE,
      effectiveProcessingEnabled: settings.EFFECTIVE_PROCESSING_ENABLED,
      effectiveRefillEnabled: settings.EFFECTIVE_REFILL_ENABLED,
      minStorageEnergyOverride: settings.MIN_STORAGE_ENERGY_OVERRIDE,
      processed: false,
      result: null,
    });

    this.runRefill(room, state, settings, mem, {
      readiness: readiness,
      powerSpawn: powerSpawn,
      powerSpawnEnergy: powerSpawnEnergy,
      powerSpawnPower: powerSpawnPower,
      storageEnergy: storageEnergy,
      storagePower: storagePower,
      terminalEnergy: terminalEnergy,
      terminalPower: terminalPower,
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
        MIN_STORAGE_ENERGY: 5000,
        MIN_TERMINAL_ENERGY: 0,
        PROCESS_UNDER_THREAT: false,
        PROCESS_UNDER_CRITICAL_CPU: false,
        POWER_SPAWN_ENERGY_TARGET: 5000,
        POWER_SPAWN_POWER_TARGET: 100,
        REFILL_ENABLED: true,
        REFILL_BATCH_ENERGY: 5000,
        REFILL_BATCH_POWER: 100,
        REFILL_INTERVAL: 25,
        REFILL_PRIORITY: 64,
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

  getRoomPolicy(roomName) {
    const roomMemory =
      Memory.rooms && Memory.rooms[roomName] ? Memory.rooms[roomName] : null;
    return roomMemory && roomMemory.powerPolicy ? roomMemory.powerPolicy : {};
  },

  getEffectiveSettings(room) {
    const settings = this.getSettings();
    const policy = this.getRoomPolicy(room.name);

    settings.GLOBAL_ENABLED = !!settings.ENABLED;
    settings.GLOBAL_REFILL_ENABLED = !!settings.REFILL_ENABLED;
    settings.PROCESSING_OVERRIDE =
      typeof policy.processingEnabled === "boolean"
        ? policy.processingEnabled
        : null;
    settings.REFILL_OVERRIDE =
      typeof policy.refillEnabled === "boolean" ? policy.refillEnabled : null;
    settings.MIN_STORAGE_ENERGY_OVERRIDE =
      typeof policy.minStorageEnergy === "number" && policy.minStorageEnergy >= 0
        ? Math.floor(policy.minStorageEnergy)
        : null;

    settings.EFFECTIVE_PROCESSING_ENABLED =
      settings.PROCESSING_OVERRIDE === null
        ? !!settings.ENABLED
        : settings.PROCESSING_OVERRIDE;
    settings.EFFECTIVE_REFILL_ENABLED =
      settings.REFILL_OVERRIDE === null
        ? !!settings.REFILL_ENABLED
        : settings.REFILL_OVERRIDE;

    if (settings.MIN_STORAGE_ENERGY_OVERRIDE !== null) {
      settings.MIN_STORAGE_ENERGY = settings.MIN_STORAGE_ENERGY_OVERRIDE;
    }

    return settings;
  },

  setRoomPolicy(roomName, updates) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[roomName]) Memory.rooms[roomName] = {};
    if (!Memory.rooms[roomName].powerPolicy) Memory.rooms[roomName].powerPolicy = {};

    const policy = Memory.rooms[roomName].powerPolicy;
    const keys = ["processingEnabled", "refillEnabled", "minStorageEnergy"];

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      if (!Object.prototype.hasOwnProperty.call(updates, key)) continue;

      if (updates[key] === null || typeof updates[key] === "undefined") {
        delete policy[key];
      } else {
        policy[key] = updates[key];
      }
    }

    policy.updated = Game.time;
    return policy;
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
    mem.storagePower = status.storagePower || 0;
    mem.terminalEnergy = status.terminalEnergy;
    mem.terminalPower = status.terminalPower;
    mem.minStorageEnergy = status.minStorageEnergy;
    mem.minTerminalEnergy = status.minTerminalEnergy;
    mem.energyTarget = status.energyTarget;
    mem.powerTarget = status.powerTarget;
    mem.globalEnabled = !!status.globalEnabled;
    mem.globalRefillEnabled = !!status.globalRefillEnabled;
    mem.processingOverride =
      typeof status.processingOverride === "boolean" ? status.processingOverride : null;
    mem.refillOverride =
      typeof status.refillOverride === "boolean" ? status.refillOverride : null;
    mem.effectiveProcessingEnabled = !!status.effectiveProcessingEnabled;
    mem.effectiveRefillEnabled = !!status.effectiveRefillEnabled;
    mem.minStorageEnergyOverride =
      typeof status.minStorageEnergyOverride === "number"
        ? status.minStorageEnergyOverride
        : null;
    mem.processed = false;
    mem.result = status.result;
    this.writeRefillStatus(mem, status);

    // Legacy aliases kept for existing console snippets and memory inspection.
    mem.energy = status.powerSpawnEnergy;
    mem.power = status.powerSpawnPower;
  },

  writeRefillStatus(mem, status) {
    const refill = this.getRefillStatus(status);

    mem.refillState = refill.state;
    mem.refillEnergyNeeded = refill.energyNeeded;
    mem.refillPowerNeeded = refill.powerNeeded;
    mem.refillEnergyStorageAvailable = refill.energyStorageAvailable;
    mem.refillEnergyTerminalAvailable = refill.energyTerminalAvailable;
    mem.refillPowerStorageAvailable = refill.powerStorageAvailable;
    mem.refillPowerTerminalAvailable = refill.powerTerminalAvailable;
    mem.refillBlockedReason = refill.blockedReason;
    mem.refillPendingRequests = refill.pendingRequests;
    mem.refillPendingSummary = refill.pendingSummary;
    mem.refillLastSource = status.refillLastSource || null;
    mem.refillLastResource = status.refillLastResource || null;
    mem.refillLastRequestTick =
      typeof status.refillLastRequestTick === "number"
        ? status.refillLastRequestTick
        : mem.refillLastRequestTick || null;
    mem.refillLastRequestId = status.refillLastRequestId || mem.refillLastRequestId || null;
    mem.refillLastResult = status.refillLastResult || mem.refillLastResult || null;
    mem.refillLastCreated =
      typeof status.refillLastCreated === "boolean"
        ? status.refillLastCreated
        : false;
  },

  getRefillStatus(status) {
    const energyNeeded = Math.max(
      0,
      (status.energyTarget || 0) - (status.powerSpawnEnergy || 0),
    );
    const powerNeeded = Math.max(
      0,
      (status.powerTarget || 0) - (status.powerSpawnPower || 0),
    );
    const energyStorageAvailable = status.powerSpawns > 0 && status.storageEnergy
      ? Math.max(0, status.storageEnergy - (status.minStorageEnergy || 0))
      : 0;
    const energyTerminalAvailable = status.powerSpawns > 0 && status.terminalEnergy
      ? Math.max(0, status.terminalEnergy - (status.minTerminalEnergy || 0))
      : 0;
    const powerStorageAvailable = status.powerSpawns > 0 ? status.storagePower || 0 : 0;
    const powerTerminalAvailable = status.powerSpawns > 0 ? status.terminalPower || 0 : 0;
    const needsEnergy = energyNeeded > 0;
    const needsPower = powerNeeded > 0;
    let state = REFILL.NOT_NEEDED;
    let blockedReason = null;

    if (status.powerSpawns <= 0) {
      return {
        state: REFILL.NOT_NEEDED,
        energyNeeded: 0,
        powerNeeded: 0,
        energyStorageAvailable: 0,
        energyTerminalAvailable: 0,
        powerStorageAvailable: 0,
        powerTerminalAvailable: 0,
        blockedReason: null,
        pendingRequests: 0,
        pendingSummary: "none",
      };
    }

    if (!needsEnergy && !needsPower) {
      state = REFILL.NOT_NEEDED;
    } else if (status.reason === READINESS.BLOCKED_THREAT) {
      state = REFILL.BLOCKED_THREAT;
      blockedReason = READINESS.BLOCKED_THREAT;
    } else if (status.reason === READINESS.BLOCKED_CPU_PRESSURE) {
      state = REFILL.BLOCKED_CPU_PRESSURE;
      blockedReason = READINESS.BLOCKED_CPU_PRESSURE;
    } else if (needsEnergy && !status.storageEnergy && !energyTerminalAvailable) {
      state = REFILL.BLOCKED_NO_STORAGE;
      blockedReason = REFILL.BLOCKED_NO_STORAGE;
    } else if (
      needsPower &&
      powerStorageAvailable <= 0 &&
      powerTerminalAvailable <= 0 &&
      !status.terminalPower
    ) {
      state = REFILL.BLOCKED_NO_TERMINAL;
      blockedReason = REFILL.BLOCKED_NO_TERMINAL;
    } else if (needsEnergy && energyStorageAvailable <= 0) {
      state = REFILL.BLOCKED_STORAGE_RESERVE;
      blockedReason = REFILL.BLOCKED_STORAGE_RESERVE;
    } else if (
      needsEnergy &&
      status.minTerminalEnergy > 0 &&
      energyTerminalAvailable <= 0 &&
      energyStorageAvailable <= 0
    ) {
      state = REFILL.BLOCKED_TERMINAL_RESERVE;
      blockedReason = REFILL.BLOCKED_TERMINAL_RESERVE;
    } else if (needsEnergy && needsPower) {
      state = REFILL.NEEDS_BOTH;
    } else if (needsEnergy) {
      state = REFILL.NEEDS_ENERGY;
    } else if (needsPower) {
      state = REFILL.NEEDS_POWER;
    } else {
      state = REFILL.READY;
    }

    return {
      state: state,
      energyNeeded: energyNeeded,
      powerNeeded: powerNeeded,
      energyStorageAvailable: energyStorageAvailable,
      energyTerminalAvailable: energyTerminalAvailable,
      powerStorageAvailable: powerStorageAvailable,
      powerTerminalAvailable: powerTerminalAvailable,
      blockedReason: blockedReason,
      pendingRequests: 0,
      pendingSummary: "none",
    };
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

    if (!settings.EFFECTIVE_PROCESSING_ENABLED) {
      return READINESS.BLOCKED_DISABLED;
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

  runRefill(room, state, settings, mem, status) {
    const decision = this.buildRefillDecision(room, state, settings, status);

    mem.refillPendingRequests = decision.pendingRequests;
    mem.refillPendingSummary = decision.pendingSummary;
    mem.refillLastCreated = false;

    if (!decision.ok) {
      mem.refillBlockedReason = decision.reason;
      if (decision.state) mem.refillState = decision.state;
      return;
    }

    if (!this.shouldRunRefill(mem, settings)) {
      mem.refillBlockedReason = null;
      return;
    }

    let created = 0;
    const summaries = decision.pendingSummary === "none" ? [] : [decision.pendingSummary];

    for (let i = 0; i < decision.requests.length; i++) {
      const request = decision.requests[i];
      const result = opsLogisticsManager.createMoveRequest(
        request.resourceType,
        request.amount,
        room.name,
        request.from,
        "powerSpawn",
        {
          priority: settings.REFILL_PRIORITY,
          reason: request.reason,
        },
      );

      mem.refillLastResult = result.message;
      if (result.ok) {
        mem.refillLastRequestTick = Game.time;
        mem.refillLastRequestId = result.request ? result.request.id : null;
        mem.refillLastSource = request.from;
        mem.refillLastResource = request.resourceType;
        if (!result.skipped) {
          created += 1;
          mem.refillLastCreated = true;
        }
        if (result.request) {
          summaries.push(
            [
              result.request.id,
              result.request.resourceType,
              result.request.from,
              fmtEndpoint(result.request.to),
              result.request.remaining || result.request.amount || 0,
            ].join(" "),
          );
        }
      } else {
        mem.refillBlockedReason = result.message;
      }
    }

    mem.refillPendingRequests = decision.pendingRequests + created;
    mem.refillPendingSummary = summaries.length > 0 ? summaries.slice(0, 2).join("; ") : "none";
    mem.refillState = created > 0 ? REFILL.REQUEST_CREATED : REFILL.REQUEST_PENDING;
    mem.refillBlockedReason = null;
  },

  shouldRunRefill(mem, settings) {
    const interval = Math.max(1, settings.REFILL_INTERVAL || 25);
    return !mem.refillLastEval || Game.time - mem.refillLastEval >= interval
      ? ((mem.refillLastEval = Game.time), true)
      : false;
  },

  buildRefillDecision(room, state, settings, status) {
    if (!settings.EFFECTIVE_REFILL_ENABLED) {
      return this.blockRefill(REFILL.BLOCKED_DISABLED);
    }
    if (!room.controller || room.controller.level < settings.MIN_RCL) {
      return this.blockRefill(REFILL.BLOCKED_RCL);
    }
    if (!status.powerSpawn) {
      return this.blockRefill(REFILL.NOT_NEEDED);
    }
    if (!settings.PROCESS_UNDER_THREAT && this.hasActiveThreat(room, state)) {
      return this.blockRefill(REFILL.BLOCKED_THREAT);
    }
    if (!settings.PROCESS_UNDER_CRITICAL_CPU && this.isCriticalCpuPressure(room)) {
      return this.blockRefill(REFILL.BLOCKED_CPU_PRESSURE);
    }

    const pending = this.getPendingRefillRequests(room.name);
    const pendingEnergy = pending.energy > 0;
    const pendingPower = pending.power > 0;
    const requests = [];

    const energyNeeded = Math.max(
      0,
      settings.POWER_SPAWN_ENERGY_TARGET - status.powerSpawnEnergy,
    );
    if (energyNeeded > 0 && !pendingEnergy) {
      const energySource = this.selectEnergyRefillSource(room, settings);
      if (energySource) {
        requests.push({
          resourceType: RESOURCE_ENERGY,
          from: energySource.from,
          amount: Math.min(energyNeeded, energySource.available, settings.REFILL_BATCH_ENERGY),
          reason: "power_spawn_energy",
        });
      }
    }

    const powerNeeded = Math.max(
      0,
      settings.POWER_SPAWN_POWER_TARGET - status.powerSpawnPower,
    );
    if (powerNeeded > 0 && !pendingPower) {
      const powerSource = this.selectPowerRefillSource(room);
      if (powerSource) {
        requests.push({
          resourceType: RESOURCE_POWER,
          from: powerSource.from,
          amount: Math.min(powerNeeded, powerSource.available, settings.REFILL_BATCH_POWER),
          reason: "power_spawn_power",
        });
      }
    }

    if (requests.length === 0) {
      if (pending.count > 0) {
        return {
          ok: false,
          state: REFILL.REQUEST_PENDING,
          reason: null,
          pendingRequests: pending.count,
          pendingSummary: pending.summary,
        };
      }
      if (energyNeeded > 0) {
        return this.blockRefill(REFILL.BLOCKED_STORAGE_RESERVE, pending);
      }
      if (powerNeeded > 0) {
        return this.blockRefill(REFILL.BLOCKED_NO_TERMINAL, pending);
      }
      return this.blockRefill(REFILL.NOT_NEEDED, pending);
    }

    return {
      ok: true,
      requests: requests,
      pendingRequests: pending.count,
      pendingSummary: pending.summary,
    };
  },

  blockRefill(reason, pending) {
    return {
      ok: false,
      state: reason,
      reason: reason,
      pendingRequests: pending ? pending.count : 0,
      pendingSummary: pending ? pending.summary : "none",
    };
  },

  selectEnergyRefillSource(room, settings) {
    const storageAvailable = room.storage
      ? this.getStoredAmount(room.storage, RESOURCE_ENERGY) - settings.MIN_STORAGE_ENERGY
      : 0;
    if (storageAvailable > 0) {
      return {
        from: "storage",
        available: storageAvailable,
      };
    }

    const terminalAvailable = room.terminal
      ? this.getStoredAmount(room.terminal, RESOURCE_ENERGY) - settings.MIN_TERMINAL_ENERGY
      : 0;
    if (terminalAvailable > 0) {
      return {
        from: "terminal",
        available: terminalAvailable,
      };
    }

    return null;
  },

  selectPowerRefillSource(room) {
    const terminalPower = this.getStoredAmount(room.terminal, RESOURCE_POWER);
    if (terminalPower > 0) {
      return {
        from: "terminal",
        available: terminalPower,
      };
    }

    const storagePower = this.getStoredAmount(room.storage, RESOURCE_POWER);
    if (storagePower > 0) {
      return {
        from: "storage",
        available: storagePower,
      };
    }

    return null;
  },

  getPendingRefillRequests(roomName) {
    const rows = opsLogisticsManager.listRequests(roomName);
    const summaries = [];
    let energy = 0;
    let power = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.status !== "open") continue;
      if (row.to !== "powerSpawn") continue;
      if (row.resourceType !== RESOURCE_ENERGY && row.resourceType !== RESOURCE_POWER) {
        continue;
      }

      if (row.resourceType === RESOURCE_ENERGY) energy += 1;
      if (row.resourceType === RESOURCE_POWER) power += 1;
      if (summaries.length < 2) {
        summaries.push(
          [
            row.id,
            row.resourceType,
            row.from,
            fmtEndpoint(row.to),
            row.remaining || row.amount || 0,
          ].join(" "),
        );
      }
    }

    return {
      count: energy + power,
      energy: energy,
      power: power,
      summary: summaries.length > 0 ? summaries.join("; ") : "none",
    };
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

function fmtEndpoint(endpoint) {
  return endpoint === "powerSpawn" ? "powerSpawn" : endpoint;
}
