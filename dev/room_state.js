const roomPhase = require("room_phase");

module.exports = {
  collect(room) {
    const creeps = room.find(FIND_MY_CREEPS);
    const spawns = room.find(FIND_MY_SPAWNS);
    const sources = room.find(FIND_SOURCES);
    const sites = room.find(FIND_CONSTRUCTION_SITES);
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    const structures = room.find(FIND_STRUCTURES);
    const roleCounts = _.countBy(creeps, (c) => c.memory.role);

    const containers = _.filter(
      structures,
      (s) => s.structureType === STRUCTURE_CONTAINER,
    );
    const towers = _.filter(
      structures,
      (s) => s.structureType === STRUCTURE_TOWER,
    );
    const extensions = _.filter(
      structures,
      (s) => s.structureType === STRUCTURE_EXTENSION,
    );

    return {
      roomName: room.name,
      phase: roomPhase.get(room),
      energyAvailable: room.energyAvailable,
      energyCapacityAvailable: room.energyCapacityAvailable,
      controllerLevel: room.controller ? room.controller.level : 0,
      creeps,
      spawns,
      sources,
      sites,
      hostiles,
      structures,
      containers,
      towers,
      extensions,
      roleCounts,
    };
  },
};
