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

    // Always give container planning a chance first.
    if (Game.time - mem.lastContainerPlan >= 100) {
      this.planSourceContainers(roomManager);
      mem.lastContainerPlan = Game.time;
    }

    const existingSites = room.find(FIND_CONSTRUCTION_SITES);

    // Don't spam more sites once enough are queued.
    if (existingSites.length >= 6) return;

    // Only plan roads once source container infrastructure is started.
    const hasContainers =
      room.find(FIND_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_CONTAINER,
      }).length > 0;

    const hasContainerSites =
      room.find(FIND_CONSTRUCTION_SITES, {
        filter: (s) => s.structureType === STRUCTURE_CONTAINER,
      }).length > 0;

    if (
      (hasContainers || hasContainerSites) &&
      Game.time - mem.lastRoadPlan >= 500
    ) {
      this.planBasicRoads(roomManager);
      mem.lastRoadPlan = Game.time;
    }
  },

  getPrioritySite(room, creep) {
    const sites = room.find(FIND_CONSTRUCTION_SITES);
    if (!sites.length) return null;

    const controllerLevel = room.controller ? room.controller.level : 0;
    const containerSites = _.filter(
      sites,
      (s) => s.structureType === STRUCTURE_CONTAINER,
    );
    const extensionSites = _.filter(
      sites,
      (s) => s.structureType === STRUCTURE_EXTENSION,
    );
    const roadSites = _.filter(
      sites,
      (s) => s.structureType === STRUCTURE_ROAD,
    );
    const towerSites = _.filter(
      sites,
      (s) => s.structureType === STRUCTURE_TOWER,
    );

    let priorityOrder;

    // In bootstrap, force source containers first so we can transition
    // into miners + haulers sooner.
    if (controllerLevel < 3 && containerSites.length > 0) {
      priorityOrder = [
        STRUCTURE_CONTAINER,
        STRUCTURE_EXTENSION,
        STRUCTURE_ROAD,
        STRUCTURE_TOWER,
      ];
    } else {
      priorityOrder = [
        STRUCTURE_EXTENSION,
        STRUCTURE_CONTAINER,
        STRUCTURE_ROAD,
        STRUCTURE_TOWER,
      ];
    }

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
    const spawn = room.find(FIND_MY_SPAWNS)[0];

    if (!spawn) return;

    for (const source of sources) {
      const existing = source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: (s) => s.structureType === STRUCTURE_CONTAINER,
      });

      const sites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
        filter: (s) => s.structureType === STRUCTURE_CONTAINER,
      });

      if (existing.length || sites.length) continue;

      const pos = this.getBestContainerPosition(room, source, spawn);
      if (!pos) continue;

      pos.createConstructionSite(STRUCTURE_CONTAINER);
    }
  },

  getBestContainerPosition(room, source, spawn) {
    const terrain = room.getTerrain();
    const candidates = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const x = source.pos.x + dx;
        const y = source.pos.y + dy;

        if (x < 1 || x > 48 || y < 1 || y > 48) continue;
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

        const pos = new RoomPosition(x, y, room.name);

        const structures = pos.lookFor(LOOK_STRUCTURES);
        const sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

        if (structures.length || sites.length) continue;

        candidates.push(pos);
      }
    }

    if (!candidates.length) return null;

    return spawn.pos.findClosestByRange(candidates);
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
