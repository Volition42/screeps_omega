module.exports = {
  plan(roomManager) {
    const room = roomManager.room;

    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].buildPlan) {
      Memory.rooms[room.name].buildPlan = {};
    }

    const mem = Memory.rooms[room.name].buildPlan;

    if (!mem.lastContainerPlan) mem.lastContainerPlan = 0;
    if (!mem.lastRoadPlan) mem.lastRoadPlan = 0;

    const existingSites = room.find(FIND_CONSTRUCTION_SITES);
    if (existingSites.length >= 6) return;

    if (Game.time - mem.lastContainerPlan >= 200) {
      this.planSourceContainers(roomManager);
      mem.lastContainerPlan = Game.time;
    }

    if (Game.time - mem.lastRoadPlan >= 500) {
      this.planBasicRoads(roomManager);
      mem.lastRoadPlan = Game.time;
    }
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
      const matches = _.filter(sites, (s) => s.structureType === structureType);
      if (matches.length) {
        return creep.pos.findClosestByPath(matches);
      }
    }

    return creep.pos.findClosestByPath(sites);
  },

  planSourceContainers(roomManager) {
    const room = roomManager.room;
    const sources = room.find(FIND_SOURCES);

    for (const source of sources) {
      const existing = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: (s) => s.structureType === STRUCTURE_CONTAINER,
      });

      const sites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
        filter: (s) => s.structureType === STRUCTURE_CONTAINER,
      });

      if (existing.length || sites.length) continue;

      const path = room.findPath(room.controller.pos, source.pos, {
        ignoreCreeps: true,
      });
      if (!path.length) continue;

      const step = path[path.length - 1];
      const pos = new RoomPosition(step.x, step.y, room.name);
      pos.createConstructionSite(STRUCTURE_CONTAINER);
    }
  },

  planBasicRoads(roomManager) {
    const room = roomManager.room;
    const controller = room.controller;
    const spawns = room.find(FIND_MY_SPAWNS);
    const sources = room.find(FIND_SOURCES);

    if (!spawns.length) return;
    const spawn = spawns[0];

    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].roadsPlannedAt)
      Memory.rooms[room.name].roadsPlannedAt = 0;
    if (Game.time - Memory.rooms[room.name].roadsPlannedAt < 200) return;

    let placed = 0;
    const maxSitesToPlace = 8;

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

    if (placed > 0) Memory.rooms[room.name].roadsPlannedAt = Game.time;
  },

  placeRoadPath(fromPos, toPos, limit) {
    if (limit <= 0) return 0;

    const path = fromPos.findPathTo(toPos, { ignoreCreeps: true, range: 1 });
    let placed = 0;

    for (const step of path) {
      if (placed >= limit) break;

      const room = Game.rooms[fromPos.roomName];
      const pos = new RoomPosition(step.x, step.y, fromPos.roomName);

      const structures = pos.lookFor(LOOK_STRUCTURES);
      const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

      if (
        _.some(structures, (s) => s.structureType === STRUCTURE_ROAD) ||
        sites.length
      )
        continue;
      if (room.getTerrain().get(step.x, step.y) === TERRAIN_MASK_WALL) continue;

      if (pos.createConstructionSite(STRUCTURE_ROAD) === OK) placed++;
    }

    return placed;
  },
};
