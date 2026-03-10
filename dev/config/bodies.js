module.exports = {
  getBody(role, room) {
    const energy = room.energyCapacityAvailable;

    if (role === "harvester") {
      if (energy >= 400) return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
      return [WORK, CARRY, MOVE];
    }

    if (role === "upgrader") {
      if (energy >= 400) return [WORK, WORK, CARRY, CARRY, MOVE, MOVE];
      return [WORK, CARRY, MOVE];
    }

    if (role === "builder") {
      if (energy >= 400) return [WORK, CARRY, CARRY, MOVE, MOVE];
      return [WORK, CARRY, MOVE];
    }

    return [WORK, CARRY, MOVE];
  },
};
