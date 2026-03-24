const config = require("config");

var PLANNER_VERSION = 3;
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

    var memory = this.getRoomMemory(room);
    var signature = this.getPlanSignature(room, state, spawn);

    if (
      memory.version === PLANNER_VERSION &&
      memory.signature === signature &&
      memory.plan
    ) {
      cachedPlansByRoom[room.name] = this.deserializePlan(room.name, memory.plan);
      return cachedPlansByRoom[room.name];
    }

    var terrain = room.getTerrain();
    var anchor = this.getTrafficAnchor(room, state, spawn);
    var passages = this.getExitPassages(room.name, terrain);
    var wallMap = Object.create(null);
    var gateMap = Object.create(null);

    for (var i = 0; i < passages.length; i++) {
      var choke = this.getBestPassageChoke(
        room.name,
        terrain,
        passages[i],
        anchor,
      );

      if (!choke) continue;
      this.mergeBarrierMaps(wallMap, gateMap, choke);
    }

    var plan = {
      walls: this.toSortedPositions(room.name, wallMap),
      gates: this.toSortedPositions(room.name, gateMap),
    };

    memory.version = PLANNER_VERSION;
    memory.signature = signature;
    memory.plan = this.serializePlan(plan);
    cachedPlansByRoom[room.name] = plan;
    return plan;
  },

  getRoomMemory(room) {
    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].defenseLayout) {
      Memory.rooms[room.name].defenseLayout = {};
    }

    return Memory.rooms[room.name].defenseLayout;
  },

  getPlanSignature(room, state, spawn) {
    var anchor = this.getTrafficAnchor(room, state, spawn);
    var controller = room.controller;

    return [
      PLANNER_VERSION,
      controller ? controller.level : 0,
      spawn.pos.x,
      spawn.pos.y,
      anchor ? anchor.x : "na",
      anchor ? anchor.y : "na",
      config.DEFENSE.MAX_CHOKE_DEPTH || 8,
    ].join(":");
  },

  getTrafficAnchor(room, state, spawn) {
    var storages =
      state &&
      state.structuresByType &&
      state.structuresByType[STRUCTURE_STORAGE]
        ? state.structuresByType[STRUCTURE_STORAGE]
        : [];
    if (storages.length > 0) return storages[0].pos;

    var storageSites =
      state && state.sitesByType && state.sitesByType[STRUCTURE_STORAGE]
        ? state.sitesByType[STRUCTURE_STORAGE]
        : [];
    if (storageSites.length > 0) return storageSites[0].pos;

    return spawn ? spawn.pos : null;
  },

  getExitPassages(roomName, terrain) {
    var passages = [];

    this.collectSidePassages(passages, roomName, terrain, "top");
    this.collectSidePassages(passages, roomName, terrain, "right");
    this.collectSidePassages(passages, roomName, terrain, "bottom");
    this.collectSidePassages(passages, roomName, terrain, "left");

    return passages;
  },

  collectSidePassages(passages, roomName, terrain, side) {
    var start = null;

    for (var offset = 1; offset <= 48; offset++) {
      var open = this.isEdgePassable(terrain, side, offset);

      if (open && start === null) {
        start = offset;
      } else if (!open && start !== null) {
        passages.push(this.createPassage(roomName, side, start, offset - 1));
        start = null;
      }
    }

    if (start !== null) {
      passages.push(this.createPassage(roomName, side, start, 48));
    }
  },

  isEdgePassable(terrain, side, offset) {
    var edgePos = this.getEdgePosition(side, offset);
    var seedPos = this.getSeedPosition(side, offset);

    return (
      this.isWalkable(terrain, edgePos.x, edgePos.y) &&
      this.isWalkable(terrain, seedPos.x, seedPos.y)
    );
  },

  createPassage(roomName, side, start, end) {
    return {
      roomName: roomName,
      side: side,
      start: start,
      end: end,
      center: Math.floor((start + end) / 2),
    };
  },

  getBestPassageChoke(roomName, terrain, passage, anchor) {
    var maxDepth = Math.max(2, config.DEFENSE.MAX_CHOKE_DEPTH || 8);
    var preferredCoord = this.getPreferredPassageCoord(passage, anchor);
    var best = this.searchPassageChoke(
      roomName,
      terrain,
      passage,
      preferredCoord,
      1,
      maxDepth,
    );

    if (best) return best;

    return this.searchPassageChoke(
      roomName,
      terrain,
      passage,
      preferredCoord,
      maxDepth + 1,
      20,
    );
  },

  searchPassageChoke(roomName, terrain, passage, preferredCoord, startDepth, endDepth) {
    var best = null;

    for (var depth = startDepth; depth <= endDepth; depth++) {
      var frontier = this.getPassageFrontier(roomName, terrain, passage, depth);
      if (frontier.tiles.length === 0) continue;

      var gatePair = this.pickGatePair(frontier.tiles, passage.side, preferredCoord);
      if (!gatePair) continue;

      var score = this.scoreChoke(frontier.tiles.length, gatePair, passage.side, preferredCoord, depth);

      if (!best || score < best.score) {
        best = {
          score: score,
          walls: this.getWallTiles(frontier.tiles, gatePair),
          gates: gatePair,
        };
      }
    }

    return best;
  },

  getPreferredPassageCoord(passage, anchor) {
    if (!anchor) return passage.center;

    var preferred =
      passage.side === "top" || passage.side === "bottom"
        ? anchor.x
        : anchor.y;

    if (preferred < passage.start) return passage.start;
    if (preferred > passage.end) return passage.end;
    return preferred;
  },

  getPassageFrontier(roomName, terrain, passage, depth) {
    var queue = [];
    var visited = Object.create(null);
    var visitedTiles = [];

    for (var offset = passage.start; offset <= passage.end; offset++) {
      var seed = this.getSeedPosition(passage.side, offset, roomName);
      var key = this.toKey(seed.x, seed.y);

      if (!this.isWalkable(terrain, seed.x, seed.y)) continue;
      if (visited[key]) continue;

      visited[key] = true;
      queue.push(seed);
      visitedTiles.push(seed);
    }

    for (var head = 0; head < queue.length; head++) {
      var current = queue[head];

      this.forEachAdjacent(
        current.x,
        current.y,
        1,
        48,
        function (x, y) {
          var key = this.toKey(x, y);

          if (visited[key]) return;
          if (!this.isWalkable(terrain, x, y)) return;
          if (!this.isWithinPassageBand(passage.side, x, y, depth)) return;

          visited[key] = true;
          var pos = new RoomPosition(x, y, roomName);
          queue.push(pos);
          visitedTiles.push(pos);
        },
        this,
      );
    }

    var frontier = [];
    for (var i = 0; i < visitedTiles.length; i++) {
      var tile = visitedTiles[i];

      if (this.isOnFrontierLine(passage.side, tile.x, tile.y, depth)) {
        frontier.push(tile);
      }
    }

    frontier.sort(function (left, right) {
      var leftCoord =
        passage.side === "top" || passage.side === "bottom"
          ? left.x
          : left.y;
      var rightCoord =
        passage.side === "top" || passage.side === "bottom"
          ? right.x
          : right.y;

      return leftCoord - rightCoord;
    });

    return {
      tiles: frontier,
    };
  },

  pickGatePair(frontierTiles, side, preferredCoord) {
    var bestPair = null;
    var bestScore = Infinity;

    for (var i = 0; i < frontierTiles.length - 1; i++) {
      var first = frontierTiles[i];
      var second = frontierTiles[i + 1];

      if (!this.areSideBySideGateTiles(first, second, side)) continue;

      var center = this.getGateCenter(first, second, side);
      var score = Math.abs(center - preferredCoord);

      if (score < bestScore) {
        bestScore = score;
        bestPair = [first, second];
      }
    }

    return bestPair;
  },

  areSideBySideGateTiles(first, second, side) {
    if (side === "top" || side === "bottom") {
      return first.y === second.y && second.x === first.x + 1;
    }

    return first.x === second.x && second.y === first.y + 1;
  },

  getGateCenter(first, second, side) {
    if (side === "top" || side === "bottom") {
      return (first.x + second.x) / 2;
    }

    return (first.y + second.y) / 2;
  },

  scoreChoke(tileCount, gatePair, side, preferredCoord, depth) {
    var gateCenter = this.getGateCenter(gatePair[0], gatePair[1], side);
    return tileCount * 1000 + depth * 10 + Math.abs(gateCenter - preferredCoord);
  },

  getWallTiles(frontierTiles, gatePair) {
    var walls = [];
    var gateMap = Object.create(null);

    gateMap[this.toKey(gatePair[0].x, gatePair[0].y)] = true;
    gateMap[this.toKey(gatePair[1].x, gatePair[1].y)] = true;

    for (var i = 0; i < frontierTiles.length; i++) {
      var tile = frontierTiles[i];

      if (gateMap[this.toKey(tile.x, tile.y)]) continue;
      walls.push(tile);
    }

    return walls;
  },

  mergeBarrierMaps(wallMap, gateMap, choke) {
    for (var i = 0; i < choke.walls.length; i++) {
      var wall = choke.walls[i];
      var wallKey = this.toKey(wall.x, wall.y);

      if (gateMap[wallKey]) continue;
      wallMap[wallKey] = wall;
    }

    for (var j = 0; j < choke.gates.length; j++) {
      var gate = choke.gates[j];
      var gateKey = this.toKey(gate.x, gate.y);

      gateMap[gateKey] = gate;
      delete wallMap[gateKey];
    }
  },

  toSortedPositions(roomName, positionMap) {
    var positions = [];

    for (var key in positionMap) {
      if (!positionMap[key]) continue;
      positions.push(new RoomPosition(positionMap[key].x, positionMap[key].y, roomName));
    }

    positions.sort(function (left, right) {
      if (left.x !== right.x) return left.x - right.x;
      return left.y - right.y;
    });

    return positions;
  },

  serializePlan(plan) {
    return {
      walls: this.serializePositionList(plan.walls),
      gates: this.serializePositionList(plan.gates),
    };
  },

  deserializePlan(roomName, plan) {
    if (!plan) return null;

    return {
      walls: this.deserializePositionList(roomName, plan.walls),
      gates: this.deserializePositionList(roomName, plan.gates),
    };
  },

  serializePositionList(positions) {
    var serialized = [];

    for (var i = 0; i < positions.length; i++) {
      serialized.push({ x: positions[i].x, y: positions[i].y });
    }

    return serialized;
  },

  deserializePositionList(roomName, positions) {
    var deserialized = [];

    if (!positions) return deserialized;

    for (var i = 0; i < positions.length; i++) {
      deserialized.push(new RoomPosition(positions[i].x, positions[i].y, roomName));
    }

    return deserialized;
  },

  getEdgePosition(side, offset) {
    if (side === "top") return { x: offset, y: 0 };
    if (side === "right") return { x: 49, y: offset };
    if (side === "bottom") return { x: offset, y: 49 };
    return { x: 0, y: offset };
  },

  getSeedPosition(side, offset, roomName) {
    if (!roomName) {
      if (side === "top") return { x: offset, y: 1 };
      if (side === "right") return { x: 48, y: offset };
      if (side === "bottom") return { x: offset, y: 48 };
      return { x: 1, y: offset };
    }

    if (side === "top") return new RoomPosition(offset, 1, roomName);
    if (side === "right") return new RoomPosition(48, offset, roomName);
    if (side === "bottom") return new RoomPosition(offset, 48, roomName);
    return new RoomPosition(1, offset, roomName);
  },

  isWithinPassageBand(side, x, y, depth) {
    if (side === "top") return y >= 1 && y <= depth;
    if (side === "right") return x >= 49 - depth && x <= 48;
    if (side === "bottom") return y >= 49 - depth && y <= 48;
    return x >= 1 && x <= depth;
  },

  isOnFrontierLine(side, x, y, depth) {
    if (side === "top") return y === depth;
    if (side === "right") return x === 49 - depth;
    if (side === "bottom") return y === 49 - depth;
    return x === depth;
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

  toKey(x, y) {
    return x + ":" + y;
  },
};
