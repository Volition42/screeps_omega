/*
Developer Summary:
Dynamic body builder.

Purpose:
- Provide role bodies based on room energy capacity
- Keep early game simple and scale through early controller levels
- Support the home-room workforce only

Important Notes:
- Upgrader bodies now carry their own energy buffer because they no longer
  stand on a dedicated controller container
*/

module.exports = {
  get(role, room, request) {
    const energyCapacity = room ? room.energyCapacityAvailable : 300;
    const tier = this.getTier(energyCapacity);
    const threatLevel =
      request && typeof request.threatLevel === "number"
        ? request.threatLevel
        : 1;

    switch (role) {
      case "jrworker":
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

      case "defender":
        return this.getDefenderBody(energyCapacity, threatLevel);

      default:
        return [WORK, CARRY, MOVE];
    }
  },

  getTier(energyCapacity) {
    if (energyCapacity >= 800) return 3;
    if (energyCapacity >= 550) return 2;
    return 1;
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
        return [WORK, WORK, CARRY, MOVE];
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
        return [WORK, WORK, WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
      case 2:
        return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
      default:
        return [WORK, WORK, CARRY, MOVE];
    }
  },

  getRepairBody(tier) {
    switch (tier) {
      case 3:
        return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE];
      case 2:
        return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
      default:
        return [WORK, WORK, CARRY, MOVE];
    }
  },

  getDefenderBody(energyCapacity, threatLevel) {
    if (energyCapacity >= 1000 && threatLevel >= 3) {
      return [
        TOUGH,
        TOUGH,
        TOUGH,
        TOUGH,
        ATTACK,
        ATTACK,
        ATTACK,
        ATTACK,
        ATTACK,
        ATTACK,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
      ];
    }

    if (energyCapacity >= 760 && threatLevel >= 2) {
      return [
        TOUGH,
        TOUGH,
        ATTACK,
        ATTACK,
        ATTACK,
        ATTACK,
        ATTACK,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
        MOVE,
      ];
    }

    if (energyCapacity >= 590) {
      return [TOUGH, ATTACK, ATTACK, ATTACK, ATTACK, MOVE, MOVE, MOVE, MOVE];
    }

    if (energyCapacity >= 430) {
      return [ATTACK, ATTACK, MOVE, MOVE, MOVE];
    }

    return [ATTACK, MOVE, MOVE];
  },
};
