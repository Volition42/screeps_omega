module.exports = {
  plan(roomManager) {
    this.planBasicRoads(roomManager);
  },

  getPrioritySite(room, creep) {
    const sites = room.find(FIND_CONSTRUCTION_SITES);
    if (!sites.length) return null;

    const priorityOrder = [
      STRUCTURE_EXTENSION,
      STRUCTURE_CONTAINER,
      STRUCTURE_ROAD,
      STRUCTURE_TOWER,
    ];

    for (const structureType of priorityOrder) {
      const matches = _.filter(
        sites,
        (site) => site.structureType === structureType,
      );

      if (matches.length) {
        return creep.pos.findClosestByPath(matches);
      }
    }

    return creep.pos.findClosestByPath(sites);
  },

  planBasicRoads(roomManager) {
    const room = roomManager.room;
    const controller = room.controller;
    const spawns = room.find(FIND_MY_SPAWNS);
    const sources = room.find(FIND_SOURCES);

    if (!spawns.length) return;

    const spawn = spawns[0];

    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].roadsPlannedAt) {
      Memory.rooms[room.name].roadsPlannedAt = 0;
    }

    // Re-plan only occasionally
    if (Game.time - Memory.rooms[room.name].roadsPlannedAt < 200) return;

    let placed = 0;
    const maxSitesToPlace = 6;

    if (controller) {
      placed += this.placeRoadPath(
        spawn.pos,
        controller.pos,
        maxSitesToPlace - placed,
      );
    }

    for (const source of sources) {
      if (placed >= maxSitesToPlace) break;
      placed += this.placeRoadPath(
        spawn.pos,
        source.pos,
        maxSitesToPlace - placed,
      );
    }

    if (placed > 0) {
      Memory.rooms[room.name].roadsPlannedAt = Game.time;
    }
  },

  placeRoadPath(fromPos, toPos, limit) {
    if (limit <= 0) return 0;

    const path = fromPos.findPathTo(toPos, {
      ignoreCreeps: true,
      range: 1,
    });

    let placed = 0;

    for (const step of path) {
      if (placed >= limit) break;

      const room = Game.rooms[fromPos.roomName];
      if (!room) break;

      const pos = new RoomPosition(step.x, step.y, fromPos.roomName);

      const structures = pos.lookFor(LOOK_STRUCTURES);
      const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

      const hasRoad = _.some(
        structures,
        (s) => s.structureType === STRUCTURE_ROAD,
      );
      const hasSite = sites.length > 0;

      if (hasRoad || hasSite) continue;

      const terrain = room.getTerrain().get(step.x, step.y);
      if (terrain === TERRAIN_MASK_WALL) continue;

      const result = pos.createConstructionSite(STRUCTURE_ROAD);
      if (result === OK) {
        placed++;
      }
    }

    return placed;
  },
};
