const config = require("config");

var cachedTick = null;
var cachedPlansByRoom = {};

function resetCacheIfNeeded() {
  if (cachedTick === Game.time) return;

  cachedTick = Game.time;
  cachedPlansByRoom = {};
}

module.exports = {
  getPlan(room, state) {
    resetCacheIfNeeded();

    if (cachedPlansByRoom[room.name] !== undefined) {
      return cachedPlansByRoom[room.name];
    }

    var spawn = state && state.spawns && state.spawns[0] ? state.spawns[0] : null;
    var controller = room.controller;

    if (!spawn || !controller || !config.DEFENSE.ENABLED) {
      cachedPlansByRoom[room.name] = null;
      return null;
    }
    if (controller.level < (config.DEFENSE.MIN_CONTROLLER_LEVEL || 2)) {
      cachedPlansByRoom[room.name] = null;
      return null;
    }

    var terrain = room.getTerrain();
    var protectedMap = this.getProtectedMap(room, state, spawn, terrain);

    if (!protectedMap[this.toKey(spawn.pos.x, spawn.pos.y)]) {
      cachedPlansByRoom[room.name] = null;
      return null;
    }

    var outsideMap = this.getOutsideMap(terrain, protectedMap);
    var barrierTiles = this.getBarrierTiles(room, terrain, protectedMap, outsideMap);

    if (barrierTiles.length === 0) {
      cachedPlansByRoom[room.name] = { walls: [], gates: [] };
      return cachedPlansByRoom[room.name];
    }

    var barrierMap = Object.create(null);
    for (var i = 0; i < barrierTiles.length; i++) {
      barrierMap[this.toKey(barrierTiles[i].x, barrierTiles[i].y)] = barrierTiles[i];
    }

    var gateMap = this.getGateMap(room, state, spawn.pos, barrierTiles, barrierMap);
    var walls = [];
    var gates = [];

    for (var j = 0; j < barrierTiles.length; j++) {
      var tile = barrierTiles[j];
      var key = this.toKey(tile.x, tile.y);

      if (gateMap[key]) gates.push(tile);
      else walls.push(tile);
    }

    cachedPlansByRoom[room.name] = {
      walls: walls,
      gates: gates,
    };

    return cachedPlansByRoom[room.name];
  },

  getProtectedMap(room, state, spawn, terrain) {
    var padding = Math.max(1, config.DEFENSE.CORE_PADDING || 2);
    var maxCoreRange = Math.max(4, config.DEFENSE.MAX_CORE_RANGE_FROM_SPAWN || 8);
    var seedMap = Object.create(null);
    var seeds = this.getCoreSeeds(room, state, spawn, maxCoreRange);

    for (var i = 0; i < seeds.length; i++) {
      var seed = seeds[i];

      for (var dx = -padding; dx <= padding; dx++) {
        for (var dy = -padding; dy <= padding; dy++) {
          var x = seed.x + dx;
          var y = seed.y + dy;

          if (!this.isInteriorCoordinate(x, y)) continue;
          if (!this.isWalkable(terrain, x, y)) continue;
          if (Math.max(Math.abs(dx), Math.abs(dy)) > padding) continue;

          seedMap[this.toKey(x, y)] = true;
        }
      }
    }

    var spawnKey = this.toKey(spawn.pos.x, spawn.pos.y);
    seedMap[spawnKey] = true;

    var protectedMap = Object.create(null);
    var queue = [{ x: spawn.pos.x, y: spawn.pos.y }];
    protectedMap[spawnKey] = true;

    for (var head = 0; head < queue.length; head++) {
      var current = queue[head];

      this.forEachAdjacent(
        current.x,
        current.y,
        1,
        48,
        function (x, y) {
          var key = this.toKey(x, y);

          if (!seedMap[key] || protectedMap[key]) return;
          if (!this.isWalkable(terrain, x, y)) return;

          protectedMap[key] = true;
          queue.push({ x: x, y: y });
        },
        this,
      );
    }

    return protectedMap;
  },

  getCoreSeeds(room, state, spawn, maxCoreRange) {
    var seeds = [];
    var seen = Object.create(null);
    var structures = state && state.structures ? state.structures : room.find(FIND_STRUCTURES);
    var sites = state && state.sites ? state.sites : room.find(FIND_CONSTRUCTION_SITES);

    this.addSeed(seeds, seen, spawn.pos);

    for (var i = 0; i < structures.length; i++) {
      var structure = structures[i];

      if (!structure || !structure.pos) continue;
      if (structure.my === false) continue;
      if (!this.shouldProtectType(structure.structureType)) continue;
      if (spawn.pos.getRangeTo(structure.pos) > maxCoreRange) continue;

      this.addSeed(seeds, seen, structure.pos);
    }

    for (var j = 0; j < sites.length; j++) {
      var site = sites[j];

      if (!site || !site.pos) continue;
      if (site.my === false) continue;
      if (!this.shouldProtectType(site.structureType)) continue;
      if (spawn.pos.getRangeTo(site.pos) > maxCoreRange) continue;

      this.addSeed(seeds, seen, site.pos);
    }

    return seeds;
  },

  shouldProtectType(structureType) {
    return (
      structureType !== STRUCTURE_ROAD &&
      structureType !== STRUCTURE_CONTAINER &&
      structureType !== STRUCTURE_WALL &&
      structureType !== STRUCTURE_RAMPART &&
      structureType !== STRUCTURE_EXTRACTOR
    );
  },

  addSeed(seeds, seen, pos) {
    if (!pos) return;

    var key = this.toKey(pos.x, pos.y);
    if (seen[key]) return;

    seen[key] = true;
    seeds.push(pos);
  },

  getOutsideMap(terrain, protectedMap) {
    var outsideMap = Object.create(null);
    var queue = [];

    for (var x = 0; x <= 49; x++) {
      this.seedOutsideTile(queue, outsideMap, protectedMap, terrain, x, 0);
      this.seedOutsideTile(queue, outsideMap, protectedMap, terrain, x, 49);
    }

    for (var y = 1; y <= 48; y++) {
      this.seedOutsideTile(queue, outsideMap, protectedMap, terrain, 0, y);
      this.seedOutsideTile(queue, outsideMap, protectedMap, terrain, 49, y);
    }

    for (var head = 0; head < queue.length; head++) {
      var current = queue[head];

      this.forEachAdjacent(
        current.x,
        current.y,
        0,
        49,
        function (x, y) {
          var key = this.toKey(x, y);

          if (outsideMap[key] || protectedMap[key]) return;
          if (!this.isWalkable(terrain, x, y)) return;

          outsideMap[key] = true;
          queue.push({ x: x, y: y });
        },
        this,
      );
    }

    return outsideMap;
  },

  seedOutsideTile(queue, outsideMap, protectedMap, terrain, x, y) {
    var key = this.toKey(x, y);

    if (outsideMap[key] || protectedMap[key]) return;
    if (!this.isWalkable(terrain, x, y)) return;

    outsideMap[key] = true;
    queue.push({ x: x, y: y });
  },

  getBarrierTiles(room, terrain, protectedMap, outsideMap) {
    var tiles = [];

    for (var x = 1; x <= 48; x++) {
      for (var y = 1; y <= 48; y++) {
        var key = this.toKey(x, y);

        if (!outsideMap[key] || protectedMap[key]) continue;
        if (!this.isWalkable(terrain, x, y)) continue;

        var touchesProtected = false;

        this.forEachAdjacent(
          x,
          y,
          1,
          48,
          function (adjX, adjY) {
            if (protectedMap[this.toKey(adjX, adjY)]) {
              touchesProtected = true;
            }
          },
          this,
        );

        if (touchesProtected) {
          tiles.push(new RoomPosition(x, y, room.name));
        }
      }
    }

    tiles.sort(function (a, b) {
      if (a.x !== b.x) return a.x - b.x;
      return a.y - b.y;
    });

    return tiles;
  },

  getGateMap(room, state, spawnPos, barrierTiles, barrierMap) {
    var gateMap = Object.create(null);

    for (var i = 0; i < barrierTiles.length; i++) {
      var tile = barrierTiles[i];
      var key = this.toKey(tile.x, tile.y);

      if (this.hasTransitStructure(tile)) {
        gateMap[key] = true;
      }
    }

    var targets = this.getGateTargets(room, state);
    var emptyMatrix = new PathFinder.CostMatrix();

    for (var j = 0; j < targets.length; j++) {
      var target = targets[j];
      if (!target || !target.pos) continue;

      var search = PathFinder.search(
        spawnPos,
        {
          pos: target.pos,
          range: typeof target.range === "number" ? target.range : 1,
        },
        {
          plainCost: 2,
          swampCost: 10,
          roomCallback: function (roomName) {
            if (roomName !== room.name) return false;
            return emptyMatrix;
          },
        },
      );

      for (var k = 0; k < search.path.length; k++) {
        var step = search.path[k];
        var stepKey = this.toKey(step.x, step.y);

        if (barrierMap[stepKey]) {
          gateMap[stepKey] = true;
          break;
        }
      }
    }

    if (barrierTiles.length > 0 && Object.keys(gateMap).length === 0) {
      var fallback = room.controller
        ? this.getClosestBarrier(barrierTiles, room.controller.pos)
        : barrierTiles[0];

      if (fallback) {
        gateMap[this.toKey(fallback.x, fallback.y)] = true;
      }
    }

    return gateMap;
  },

  hasTransitStructure(pos) {
    var structures = pos.lookFor(LOOK_STRUCTURES);
    var sites = pos.lookFor(LOOK_CONSTRUCTION_SITES);

    for (var i = 0; i < structures.length; i++) {
      var type = structures[i].structureType;

      if (
        type === STRUCTURE_ROAD ||
        type === STRUCTURE_CONTAINER ||
        type === STRUCTURE_RAMPART
      ) {
        return true;
      }
    }

    for (var j = 0; j < sites.length; j++) {
      var siteType = sites[j].structureType;

      if (
        siteType === STRUCTURE_ROAD ||
        siteType === STRUCTURE_CONTAINER ||
        siteType === STRUCTURE_RAMPART
      ) {
        return true;
      }
    }

    return false;
  },

  getGateTargets(room, state) {
    var targets = [];

    if (room.controller) {
      targets.push({ pos: room.controller.pos, range: 1 });
    }

    var sources = state && state.sources ? state.sources : room.find(FIND_SOURCES);
    var sourceContainersBySourceId =
      state && state.sourceContainersBySourceId ? state.sourceContainersBySourceId : {};

    for (var i = 0; i < sources.length; i++) {
      var source = sources[i];
      var container = sourceContainersBySourceId[source.id];

      targets.push({
        pos: container && container.pos ? container.pos : source.pos,
        range: container ? 0 : 1,
      });
    }

    if (room.controller && room.controller.level >= 6) {
      var minerals = room.find(FIND_MINERALS);
      if (minerals.length > 0) {
        targets.push({ pos: minerals[0].pos, range: 1 });
      }
    }

    return targets;
  },

  getClosestBarrier(barrierTiles, targetPos) {
    var best = null;
    var bestRange = Infinity;

    for (var i = 0; i < barrierTiles.length; i++) {
      var tile = barrierTiles[i];
      var range = tile.getRangeTo(targetPos);

      if (range < bestRange) {
        best = tile;
        bestRange = range;
      }
    }

    return best;
  },

  forEachAdjacent(x, y, minCoord, maxCoord, fn, context) {
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        var nextX = x + dx;
        var nextY = y + dy;

        if (nextX < minCoord || nextX > maxCoord) continue;
        if (nextY < minCoord || nextY > maxCoord) continue;

        fn.call(context, nextX, nextY);
      }
    }
  },

  isWalkable(terrain, x, y) {
    return terrain.get(x, y) !== TERRAIN_MASK_WALL;
  },

  isInteriorCoordinate(x, y) {
    return x >= 1 && x <= 48 && y >= 1 && y <= 48;
  },

  toKey(x, y) {
    return x + ":" + y;
  },
};
