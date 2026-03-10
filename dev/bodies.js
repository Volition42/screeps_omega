module.exports = {
  getBody(role, room) {
    const energy = room.energyCapacityAvailable;

    switch (role) {
      case "harvester":
        if (energy >= 400) return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
        return [WORK, CARRY, MOVE];

      case "miner":
        if (energy >= 550) return [WORK, WORK, WORK, WORK, MOVE];
        if (energy >= 400) return [WORK, WORK, WORK, MOVE];
        return [WORK, WORK, MOVE];

      case "hauler":
        if (energy >= 500) return [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE];
        if (energy >= 300) return [CARRY, CARRY, CARRY, MOVE, MOVE];
        return [CARRY, CARRY, MOVE];

      case "upgrader":
        if (energy >= 550)
          return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energy >= 400) return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
        return [WORK, CARRY, MOVE];

      case "builder":
        if (energy >= 500)
          return [WORK, WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
        if (energy >= 400) return [WORK, CARRY, CARRY, MOVE, MOVE];
        return [WORK, CARRY, MOVE];

      default:
        return [WORK, CARRY, MOVE];
    }
  },
};
