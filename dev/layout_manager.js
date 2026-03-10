const EXTENSIONS_BY_RCL = {
  1: 0,
  2: 5,
  3: 10,
  4: 20,
  5: 30,
  6: 40,
  7: 50,
  8: 60,
};

module.exports = {
  plan(roomManager) {
    const room = roomManager.room;
    const rcl = room.controller.level;

    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].layoutTick)
      Memory.rooms[room.name].layoutTick = 0;

    if (Game.time - Memory.rooms[room.name].layoutTick < 500) return;

    const spawns = room.find(FIND_MY_SPAWNS);
    if (!spawns.length) return;

    const spawn = spawns[0];

    const extensions = room.find(FIND_MY_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_EXTENSION,
    });

    const sites = room.find(FIND_CONSTRUCTION_SITES, {
      filter: (s) => s.structureType === STRUCTURE_EXTENSION,
    });

    const existingCount = extensions.length + sites.length;

    const maxExtensions = EXTENSIONS_BY_RCL[rcl] || 0;

    if (existingCount >= maxExtensions) return;

    const positions = this.generateRing(spawn.pos, 3);

    let built = 0;

    for (const pos of positions) {
      if (existingCount + built >= maxExtensions) break;

      const terrain = room.getTerrain().get(pos.x, pos.y);
      if (terrain === TERRAIN_MASK_WALL) continue;

      const structures = pos.lookFor(LOOK_STRUCTURES);
      const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

      if (structures.length || sites.length) continue;

      if (pos.createConstructionSite(STRUCTURE_EXTENSION) === OK) {
        built++;
      }
    }

    Memory.rooms[room.name].layoutTick = Game.time;
  },

  generateRing(center, radius) {
    const positions = [];

    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

        positions.push(
          new RoomPosition(center.x + dx, center.y + dy, center.roomName),
        );
      }
    }

    return positions;
  },
};
