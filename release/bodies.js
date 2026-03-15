/*
Developer Summary:
Dynamic body builder.

Purpose:
- Provide role bodies based on room energy capacity
- Keep early game simple and scale through early controller levels
- Support both local and remote workforce roles

Important Notes:
- Remote JrWorkers scale with home room energy capacity
- Remote phase 1 bodies favor extra carry and move for travel efficiency
- Reservers scale separately because CLAIM parts have different cost breakpoints
*/

module.exports = {
  get(role, room) {
    const energyCapacity = room ? room.energyCapacityAvailable : 300;
    const tier = this.getTier(energyCapacity);

    switch (role) {
      case "jrworker":
        return [WORK, CARRY, MOVE];

      case "remotejrworker":
        return this.getRemoteJrWorkerBody(tier);

      case "reserver":
        return this.getReserverBody(energyCapacity);

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
    if (energyCapacity >= 800) return 3;
    if (energyCapacity >= 550) return 2;
    return 1;
  },

  getRemoteJrWorkerBody(tier) {
    switch (tier) {
      case 3:
        return [WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
      case 2:
        return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
      default:
        return [WORK, CARRY, MOVE];
    }
  },

  getReserverBody(energyCapacity) {
    // Developer note:
    // CLAIM parts cost 600 each, so use simple reservation tiers.
    if (energyCapacity >= 1300) {
      return [CLAIM, CLAIM, MOVE, MOVE];
    }

    return [CLAIM, MOVE];
  },

  getWorkerBody(tier) {
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
