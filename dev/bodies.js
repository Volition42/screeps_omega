const config = require("config");

module.exports = {
  get(role, room) {
    const energyCapacity = room ? room.energyCapacityAvailable : 300;
    const tier = this.getTier(energyCapacity);

    switch (role) {
      case "jrworker":
        // Developer note:
        // JrWorkers stay intentionally cheap and simple.
        return [WORK, CARRY, MOVE];

      case "worker":
        return this.getWorkerBody(tier);

      case "miner":
        return this.getMinerBody(tier);

      case "hauler":
        return this.getHaulerBody(tier);

      case "upgrader":
        return this.getUpgraderBody(tier);

      case "repair":
        return this.getRepairBody(tier);

      default:
        return [WORK, CARRY, MOVE];
    }
  },

  getTier(energyCapacity) {
    // Developer note:
    // Tier 1 = 300 energy baseline
    // Tier 2 = 550 energy rooms
    // Tier 3 = 800+ energy rooms through early RCL3 scaling
    if (energyCapacity >= 800) return 3;
    if (energyCapacity >= 550) return 2;
    return 1;
  },

  getWorkerBody(tier) {
    // Developer note:
    // Workers need more WORK as the room grows, but still enough CARRY/MOVE
    // to stay practical for build / refill / upgrade tasks.
    switch (tier) {
      case 3:
        return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE];
      case 2:
        return [WORK, WORK, WORK, CARRY, MOVE, MOVE];
      default:
        return [WORK, WORK, CARRY, MOVE];
    }
  },

  getMinerBody(tier) {
    // Developer note:
    // Miners sit on source containers, so WORK scales hardest.
    // Keep one CARRY and one MOVE because the role still needs both.
    switch (tier) {
      case 3:
        return [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE];
      case 2:
        return [WORK, WORK, WORK, WORK, CARRY, MOVE];
      default:
        return [WORK, CARRY, MOVE];
    }
  },

  getHaulerBody(tier) {
    // Developer note:
    // Haulers scale mainly with CARRY.
    // MOVE scales too so they do not become mud wagons.
    switch (tier) {
      case 3:
        return [CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
      case 2:
        return [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE];
      default:
        return [CARRY, CARRY, MOVE, MOVE];
    }
  },

  getUpgraderBody(tier) {
    // Developer note:
    // Upgraders work near the controller container, so WORK is the main upgrade.
    // Keep at least one CARRY and one MOVE.
    switch (tier) {
      case 3:
        return [WORK, WORK, WORK, WORK, CARRY, MOVE];
      case 2:
        return [WORK, WORK, WORK, CARRY, MOVE];
      default:
        return [WORK, CARRY, MOVE];
    }
  },

  getRepairBody(tier) {
    // Developer note:
    // Repairs benefit from a bit more balance than upgraders.
    // Extra CARRY helps reduce refill trips.
    switch (tier) {
      case 3:
        return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE];
      case 2:
        return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
      default:
        return [WORK, CARRY, MOVE];
    }
  },
};
