const config = require("config");

const CRITICAL_CONSTRUCTION = {
  spawn: true,
  tower: true,
  extension: true,
  storage: true,
  container: true,
};

module.exports = {
  getStorageEnergy(room, state) {
    if (
      state &&
      state.infrastructure &&
      typeof state.infrastructure.storageEnergy === "number"
    ) {
      return state.infrastructure.storageEnergy;
    }

    if (!room || !room.storage || !room.storage.store) {
      return 0;
    }

    return room.storage.store[RESOURCE_ENERGY] || 0;
  },

  getReserveBankMinStorageEnergy() {
    if (
      config.UPGRADING &&
      typeof config.UPGRADING.RESERVE_BANK_MIN_STORAGE_ENERGY === "number"
    ) {
      return config.UPGRADING.RESERVE_BANK_MIN_STORAGE_ENERGY;
    }

    if (
      config.ADVANCED &&
      typeof config.ADVANCED.MINERAL_MINING_MIN_STORAGE_ENERGY === "number"
    ) {
      return config.ADVANCED.MINERAL_MINING_MIN_STORAGE_ENERGY;
    }

    return 5000;
  },

  getRcl8DowngradeSafetyTicks() {
    if (
      config.UPGRADING &&
      typeof config.UPGRADING.RCL8_DOWNGRADE_SAFETY_TICKS === "number"
    ) {
      return config.UPGRADING.RCL8_DOWNGRADE_SAFETY_TICKS;
    }

    return 50000;
  },

  isRcl8GclPushEnabled() {
    return !!(
      !config.UPGRADING ||
      config.UPGRADING.RCL8_GCL_PUSH_ENABLED !== false
    );
  },

  getRcl8GclPushMinStorageEnergy() {
    return config.UPGRADING &&
      typeof config.UPGRADING.RCL8_GCL_PUSH_MIN_STORAGE_ENERGY === "number"
      ? config.UPGRADING.RCL8_GCL_PUSH_MIN_STORAGE_ENERGY
      : 300000;
  },

  getRcl8GclPushPreferredStorageEnergy() {
    return config.UPGRADING &&
      typeof config.UPGRADING.RCL8_GCL_PUSH_PREFERRED_STORAGE_ENERGY === "number"
      ? config.UPGRADING.RCL8_GCL_PUSH_PREFERRED_STORAGE_ENERGY
      : 500000;
  },

  getRcl8GclPushMinTerminalEnergy() {
    return config.UPGRADING &&
      typeof config.UPGRADING.RCL8_GCL_PUSH_MIN_TERMINAL_ENERGY === "number"
      ? config.UPGRADING.RCL8_GCL_PUSH_MIN_TERMINAL_ENERGY
      : 50000;
  },

  shouldBankStorageEnergy(room, state) {
    if (!room || !room.storage) return false;

    return (
      this.getStorageEnergy(room, state) < this.getReserveBankMinStorageEnergy()
    );
  },

  shouldHoldRcl8Upgrading(room, state) {
    const controller = room && room.controller ? room.controller : null;
    if (!controller || controller.level < 8) return false;
    if (!room || !room.storage) return false;
    if (!this.shouldBankStorageEnergy(room, state)) return false;

    const ticksToDowngrade =
      typeof controller.ticksToDowngrade === "number"
        ? controller.ticksToDowngrade
        : Infinity;

    return ticksToDowngrade > this.getRcl8DowngradeSafetyTicks();
  },

  shouldAllowRcl8GclPush(room, state, options) {
    return this.getRcl8GclPushStatus(room, state, options).eligible;
  },

  getRcl8GclPushStatus(room, state, options) {
    const settings = options || {};
    const controller = room && room.controller ? room.controller : null;
    const storageEnergy = this.getStorageEnergy(room, state);
    const terminalEnergy = this.getTerminalEnergy(room, state);
    const threshold = this.getRcl8GclPushMinStorageEnergy();
    const preferred = this.getRcl8GclPushPreferredStorageEnergy();
    const terminalMinimum = this.getRcl8GclPushMinTerminalEnergy();
    const roleCounts = state && state.roleCounts ? state.roleCounts : {};
    const laborCurrent = (roleCounts.worker || 0) + (roleCounts.jrworker || 0);
    const laborDesired =
      typeof settings.laborDesired === "number"
        ? settings.laborDesired
        : this.getMinimumWorkerLabor(state);
    const logistics = settings.logistics || null;
    const advanced = settings.advanced || (state && state.advancedOps ? state.advancedOps : null);
    const cpuPressure = this.getCpuPressure(room);
    let blocker = null;

    if (!this.isRcl8GclPushEnabled()) blocker = "disabled";
    else if (!room || !controller || !controller.my) blocker = "not-owned";
    else if ((controller.level || 0) !== 8) blocker = "not-rcl8";
    else if (this.isDowngradeCritical(controller)) blocker = "downgrade-critical";
    else if (!room.storage) blocker = "storage-missing";
    else if (storageEnergy < threshold) blocker = "reserve-low";
    else if (terminalMinimum > 0 && room.terminal && terminalEnergy < terminalMinimum) {
      blocker = "terminal-energy-low";
    } else if (this.hasCriticalConstruction(state)) blocker = "critical-construction";
    else if (this.hasCriticalRepair(room, state)) blocker = "critical-repair";
    else if (this.hasLogisticsStarvation(logistics)) blocker = "logistics-starvation";
    else if (this.hasHaulerShortage(state, logistics)) blocker = "hauler-short";
    else if (laborCurrent < laborDesired) blocker = "labor-deficit";
    else if (!this.isSpawnStable(room, state)) blocker = "spawn-blocked";
    else if (this.hasProductionEnergyNeed(advanced)) blocker = "production-energy";
    else if (cpuPressure === "critical") blocker = "cpu-critical";

    return {
      eligible: blocker === null,
      blocker: blocker || "none",
      rcl: controller ? controller.level || 0 : 0,
      storageEnergy: storageEnergy,
      threshold: threshold,
      preferredStorageEnergy: preferred,
      terminalEnergy: terminalEnergy,
      terminalMinimum: terminalMinimum,
      laborCurrent: laborCurrent,
      laborDesired: laborDesired,
      upgraderCount: roleCounts.upgrader || 0,
      upgradeMode: blocker === null ? "surplus" : "throttled",
      throttled: blocker !== null,
      pushing:
        blocker === null &&
        this.hasUpgradeLabor(state),
    };
  },

  getTerminalEnergy(room, state) {
    if (!room || !room.terminal || !room.terminal.store) return 0;
    return room.terminal.store[RESOURCE_ENERGY] || 0;
  },

  isDowngradeCritical(controller) {
    const ticksToDowngrade =
      controller && typeof controller.ticksToDowngrade === "number"
        ? controller.ticksToDowngrade
        : Infinity;
    return ticksToDowngrade <= this.getRcl8DowngradeSafetyTicks();
  },

  hasCriticalConstruction(state) {
    const sites = state && state.sites ? state.sites : [];
    for (let i = 0; i < sites.length; i++) {
      if (sites[i] && CRITICAL_CONSTRUCTION[sites[i].structureType]) {
        return true;
      }
    }
    return false;
  },

  hasCriticalRepair(room, state) {
    const structures =
      state && state.structures
        ? state.structures
        : room
          ? room.find(FIND_STRUCTURES)
          : [];
    const criticalContainerThreshold =
      config.REPAIR && typeof config.REPAIR.criticalContainerThreshold === "number"
        ? config.REPAIR.criticalContainerThreshold
        : 0.5;
    const importantThreshold =
      config.REPAIR && typeof config.REPAIR.importantThreshold === "number"
        ? config.REPAIR.importantThreshold
        : 0.75;
    const spawnExtensionThreshold =
      config.REPAIR && typeof config.REPAIR.spawnExtensionThreshold === "number"
        ? config.REPAIR.spawnExtensionThreshold
        : 0.7;

    for (let i = 0; i < structures.length; i++) {
      const structure = structures[i];
      if (!structure || !structure.hitsMax || structure.hits >= structure.hitsMax) {
        continue;
      }
      if (
        structure.structureType === STRUCTURE_CONTAINER &&
        structure.hits < structure.hitsMax * criticalContainerThreshold
      ) {
        return true;
      }
      if (
        (
          structure.structureType === STRUCTURE_SPAWN ||
          structure.structureType === STRUCTURE_EXTENSION
        ) &&
        structure.hits < structure.hitsMax * spawnExtensionThreshold
      ) {
        return true;
      }
      if (
        structure.structureType !== STRUCTURE_ROAD &&
        structure.structureType !== STRUCTURE_WALL &&
        structure.structureType !== STRUCTURE_RAMPART &&
        structure.hits < structure.hitsMax * importantThreshold
      ) {
        return true;
      }
    }
    return false;
  },

  hasLogisticsStarvation(logistics) {
    if (!logistics || !logistics.state) return false;
    return (
      logistics.state === "aging" ||
      logistics.state === "blocked" ||
      logistics.state === "unclaimed"
    );
  },

  hasHaulerShortage(state, logistics) {
    if (logistics && logistics.haulers && logistics.haulers.short) return true;
    const roleCounts = state && state.roleCounts ? state.roleCounts : {};
    const desired =
      state && state.sources && state.sources.length > 0
        ? state.sources.length
        : 1;
    return (roleCounts.hauler || 0) < desired;
  },

  getMinimumWorkerLabor(state) {
    const sites = state && state.sites ? state.sites.length : 0;
    return sites > 0 ? 1 : 0;
  },

  isSpawnStable(room, state) {
    const spawns = state && state.spawns ? state.spawns : [];
    if (spawns.length <= 0) return false;
    for (let i = 0; i < spawns.length; i++) {
      if (!spawns[i].spawning) return true;
    }

    const queue =
      Memory.rooms &&
      room &&
      Memory.rooms[room.name] &&
      Memory.rooms[room.name].spawnQueue
        ? Memory.rooms[room.name].spawnQueue
        : [];
    for (let j = 0; j < queue.length; j++) {
      if (queue[j].role === "worker" || queue[j].role === "jrworker") {
        return false;
      }
    }
    return true;
  },

  hasProductionEnergyNeed(advanced) {
    if (!advanced) return false;
    const labels = [
      advanced.taskLabel,
      advanced.factoryBlockedReason,
      advanced.labBlockedReason,
      advanced.factoryReason,
      advanced.labReason,
    ];
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i] ? String(labels[i]) : "";
      if (label.indexOf("energy") !== -1) return true;
      if (label.indexOf("factory_energy") !== -1) return true;
    }
    return false;
  },

  getCpuPressure(room) {
    if (!Memory.stats) return "normal";
    if (
      room &&
      Memory.stats.rooms &&
      Memory.stats.rooms[room.name] &&
      Memory.stats.rooms[room.name].cpu &&
      Memory.stats.rooms[room.name].cpu.pressure
    ) {
      return Memory.stats.rooms[room.name].cpu.pressure;
    }
    return Memory.stats.runtime && Memory.stats.runtime.pressure
      ? Memory.stats.runtime.pressure
      : "normal";
  },

  hasUpgradeLabor(state) {
    const creeps = state && state.homeCreeps ? state.homeCreeps : [];
    for (let i = 0; i < creeps.length; i++) {
      const memory = creeps[i].memory || {};
      if (memory.role === "upgrader" && memory.upgrading) return true;
      if (memory.role === "worker" && memory.working) return true;
    }
    return false;
  },

  getTowerBankingThreshold() {
    if (
      config.LOGISTICS &&
      typeof config.LOGISTICS.towerBankingThreshold === "number"
    ) {
      return config.LOGISTICS.towerBankingThreshold;
    }

    return 200;
  },
};
