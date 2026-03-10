module.exports = {
  collect(room) {
    const creeps = room.find(FIND_MY_CREEPS);
    const spawns = room.find(FIND_MY_SPAWNS);
    const sources = room.find(FIND_SOURCES);
    const sites = room.find(FIND_CONSTRUCTION_SITES);
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    const roleCounts = _.countBy(creeps, (c) => c.memory.role);

    return {
      roomName: room.name,
      energyAvailable: room.energyAvailable,
      energyCapacityAvailable: room.energyCapacityAvailable,
      controllerLevel: room.controller ? room.controller.level : 0,
      creeps,
      spawns,
      sources,
      sites,
      hostiles,
      roleCounts,
    };
  },
};
