const config = require("config");

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
