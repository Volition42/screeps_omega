const config = require("config");

// Legacy wall/rampart planner kept for explicit future experiments. Default room
// defense no longer places barriers; towers and defender spawning own defense.
var PLANNER_VERSION = 6;
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
    var preserveExistingPlan = this.shouldPreserveExistingPlan(state, memory);
    var storedPlan = memory.plan
      ? this.normalizePlan(
          room,
          state,
          spawn,
          this.deserializePlan(room.name, memory.plan),
        )
      : null;

    if (storedPlan) {
      memory.plan = this.serializePlan(storedPlan);
    }

    if (preserveExistingPlan) {
      var canonicalPlan = this.selectCanonicalPlan(
        room,
        state,
        spawn,
        memory,
        storedPlan,
      );
      if (canonicalPlan) {
        memory.version = PLANNER_VERSION;
        memory.signature = signature;
        memory.plan = this.serializePlan(canonicalPlan);
        memory.locked = true;
        cachedPlansByRoom[room.name] = canonicalPlan;
        return cachedPlansByRoom[room.name];
      }
    }

    if (
      memory.version === PLANNER_VERSION &&
      memory.signature === signature &&
      storedPlan
    ) {
      cachedPlansByRoom[room.name] = storedPlan;
      return cachedPlansByRoom[room.name];
    }

    var anchor = this.getTrafficAnchor(room, state, spawn);
    var plan = this.buildPlan(room, anchor);

    memory.version = PLANNER_VERSION;
    memory.signature = signature;
    memory.plan = this.serializePlan(plan);
    if (preserveExistingPlan) {
      memory.locked = true;
    }
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

  shouldPreserveExistingPlan(state, memory) {
    if (!memory || !memory.plan) return false;
    if (memory.locked) return true;
    if (!state) return false;

    var builtWalls =
      state.structuresByType && state.structuresByType[STRUCTURE_WALL]
        ? state.structuresByType[STRUCTURE_WALL].length
        : 0;
    var builtRamparts =
      state.structuresByType && state.structuresByType[STRUCTURE_RAMPART]
        ? state.structuresByType[STRUCTURE_RAMPART].length
        : 0;
    var wallSites =
      state.sitesByType && state.sitesByType[STRUCTURE_WALL]
        ? state.sitesByType[STRUCTURE_WALL].length
        : 0;
    var rampartSites =
      state.sitesByType && state.sitesByType[STRUCTURE_RAMPART]
        ? state.sitesByType[STRUCTURE_RAMPART].length
        : 0;

    return builtWalls + builtRamparts + wallSites + rampartSites > 0;
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

  getPlanForAnchor(room, anchor, state) {
    if (!room || !anchor) return null;

    return this.buildPlan(room, anchor, state || null);
  },

  buildPlan(room, anchor, state) {
    if (!room || !anchor) return null;

    var terrain = room.getTerrain();
    var approaches = this.getExitApproaches(room.name, terrain);
    var protectedRegion = this.getProtectedRegion(room, state, anchor);
    var wallMap = Object.create(null);
    var gateMap = Object.create(null);

    for (var i = 0; i < approaches.length; i++) {
      var choke = this.getBestApproachChoke(
        room.name,
        terrain,
        approaches[i],
        anchor,
        protectedRegion,
      );

      if (!choke) continue;
      this.mergeBarrierMaps(wallMap, gateMap, choke);
    }

    return this.coalesceCornerGatePlan(
      room.name,
      {
        walls: this.toSortedPositions(room.name, wallMap),
        gates: this.toSortedPositions(room.name, gateMap),
      },
      anchor,
    );
  },

  selectCanonicalPlan(room, state, spawn, memory, storedPlan) {
    if (!room || !spawn) return null;

    var candidates = [];
    var seen = Object.create(null);
    var currentAnchor = this.getTrafficAnchor(room, state, spawn);

    this.addPlanCandidate(
      candidates,
      seen,
      "legacy",
      this.buildLegacyPlan(room, currentAnchor, state),
      3,
    );
    this.addPlanCandidate(
      candidates,
      seen,
      "spawn",
      this.buildPlan(room, spawn.pos, state),
      2,
    );
    this.addPlanCandidate(
      candidates,
      seen,
      "stored",
      storedPlan || this.deserializePlan(room.name, memory && memory.plan),
      1,
    );
    this.addPlanCandidate(
      candidates,
      seen,
      "traffic",
      this.buildPlan(room, currentAnchor, state),
      0,
    );

    if (candidates.length === 0) return null;

    var footprint = this.getDefenseFootprint(state);
    var best = candidates[0];
    var bestScore = this.scorePlanAgainstFootprint(best.plan, footprint);

    for (var i = 1; i < candidates.length; i++) {
      var score = this.scorePlanAgainstFootprint(candidates[i].plan, footprint);

      if (score > bestScore) {
        best = candidates[i];
        bestScore = score;
        continue;
      }

      if (score === bestScore && candidates[i].priority > best.priority) {
        best = candidates[i];
      }
    }

    return best.plan;
  },

  buildLegacyPlan(room, anchor, state) {
    if (!room || !anchor) return null;

    var terrain = room.getTerrain();
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

    return this.coalesceCornerGatePlan(
      room.name,
      {
        walls: this.toSortedPositions(room.name, wallMap),
        gates: this.toSortedPositions(room.name, gateMap),
      },
      anchor,
    );
  },

  addPlanCandidate(candidates, seen, label, plan, priority) {
    if (!plan) return;

    var key = this.getPlanKey(plan);
    if (seen[key]) return;
    seen[key] = true;

    candidates.push({
      label: label,
      plan: plan,
      priority: priority || 0,
    });
  },

  getPlanKey(plan) {
    if (!plan) return "null";

    return [
      this.serializePositionList(plan.walls)
        .map(function (pos) {
          return pos.x + ":" + pos.y;
        })
        .join(","),
      this.serializePositionList(plan.gates)
        .map(function (pos) {
          return pos.x + ":" + pos.y;
        })
        .join(","),
    ].join("|");
  },

  getDefenseFootprint(state) {
    var footprint = [];
    var builtWalls =
      state && state.structuresByType && state.structuresByType[STRUCTURE_WALL]
        ? state.structuresByType[STRUCTURE_WALL]
        : [];
    var builtRamparts =
      state && state.structuresByType && state.structuresByType[STRUCTURE_RAMPART]
        ? state.structuresByType[STRUCTURE_RAMPART]
        : [];
    var wallSites =
      state && state.sitesByType && state.sitesByType[STRUCTURE_WALL]
        ? state.sitesByType[STRUCTURE_WALL]
        : [];
    var rampartSites =
      state && state.sitesByType && state.sitesByType[STRUCTURE_RAMPART]
        ? state.sitesByType[STRUCTURE_RAMPART]
        : [];

    this.pushDefenseFootprintEntries(footprint, builtWalls, STRUCTURE_WALL, false);
    this.pushDefenseFootprintEntries(
      footprint,
      builtRamparts,
      STRUCTURE_RAMPART,
      false,
    );
    this.pushDefenseFootprintEntries(footprint, wallSites, STRUCTURE_WALL, true);
    this.pushDefenseFootprintEntries(
      footprint,
      rampartSites,
      STRUCTURE_RAMPART,
      true,
    );

    return footprint;
  },

  pushDefenseFootprintEntries(footprint, entries, structureType, isSite) {
    if (!entries || !entries.length) return;

    for (var i = 0; i < entries.length; i++) {
      var entry = entries[i];
      if (!entry || !entry.pos) continue;

      footprint.push({
        x: entry.pos.x,
        y: entry.pos.y,
        structureType: structureType,
        isSite: !!isSite,
        hits: entry.hits || 0,
      });
    }
  },

  scorePlanAgainstFootprint(plan, footprint) {
    if (!plan) return -1;
    if (!footprint || footprint.length === 0) return 0;

    var typeByKey = this.getPlanTypeMap(plan);
    var score = 0;

    for (var i = 0; i < footprint.length; i++) {
      var entry = footprint[i];
      var expectedType = typeByKey[this.toKey(entry.x, entry.y)];
      if (!expectedType) continue;

      if (entry.isSite) {
        score += expectedType === entry.structureType ? 100 : 10;
        continue;
      }

      if (expectedType === entry.structureType) {
        score += 10000 + Math.min(entry.hits || 0, 50000);
      } else {
        score += 1000 + Math.floor(Math.min(entry.hits || 0, 50000) / 10);
      }
    }

    return score;
  },

  getPlanTypeMap(plan) {
    var typeByKey = Object.create(null);

    if (!plan) return typeByKey;

    for (var i = 0; i < plan.walls.length; i++) {
      typeByKey[this.toKey(plan.walls[i].x, plan.walls[i].y)] = STRUCTURE_WALL;
    }
    for (var j = 0; j < plan.gates.length; j++) {
      typeByKey[this.toKey(plan.gates[j].x, plan.gates[j].y)] = STRUCTURE_RAMPART;
    }

    return typeByKey;
  },

  getExitPassages(roomName, terrain) {
    var passages = [];

    this.collectSidePassages(passages, roomName, terrain, "top");
    this.collectSidePassages(passages, roomName, terrain, "right");
    this.collectSidePassages(passages, roomName, terrain, "bottom");
    this.collectSidePassages(passages, roomName, terrain, "left");

    return passages;
  },

  getExitApproaches(roomName, terrain) {
    var passages = this.getExitPassages(roomName, terrain);
    if (!passages || passages.length <= 0) return [];

    var mergeDepth = Math.max(6, Math.min(config.DEFENSE.MAX_CHOKE_DEPTH || 8, 10));
    var parent = [];
    var shallowReach = [];

    for (var i = 0; i < passages.length; i++) {
      parent[i] = i;
      shallowReach[i] = this.getApproachFrontier(
        roomName,
        terrain,
        {
          roomName: roomName,
          passages: [passages[i]],
        },
        mergeDepth,
      );
    }

    for (var left = 0; left < passages.length; left++) {
      for (var right = left + 1; right < passages.length; right++) {
        if (!this.areCornerAdjacentPassages(passages[left], passages[right])) {
          continue;
        }

        if (
          this.frontiersTouchOrOverlap(
            shallowReach[left],
            shallowReach[right],
          )
        ) {
          this.unionApproachParents(parent, left, right);
        }
      }
    }

    var grouped = Object.create(null);

    for (var j = 0; j < passages.length; j++) {
      var root = this.findApproachParent(parent, j);
      if (!grouped[root]) grouped[root] = [];
      grouped[root].push(passages[j]);
    }

    var approaches = [];
    for (var key in grouped) {
      approaches.push({
        roomName: roomName,
        passages: grouped[key],
      });
    }

    return approaches;
  },

  areCornerAdjacentPassages(left, right) {
    if (!left || !right) return false;

    return (
      this.isPassagePairNearCorner(left, right, "top", "left", 16) ||
      this.isPassagePairNearCorner(left, right, "top", "right", 16) ||
      this.isPassagePairNearCorner(left, right, "bottom", "left", 16) ||
      this.isPassagePairNearCorner(left, right, "bottom", "right", 16)
    );
  },

  isPassagePairNearCorner(first, second, sideA, sideB, margin) {
    var passageA = null;
    var passageB = null;

    if (first.side === sideA && second.side === sideB) {
      passageA = first;
      passageB = second;
    } else if (first.side === sideB && second.side === sideA) {
      passageA = second;
      passageB = first;
    } else {
      return false;
    }

    if (sideA === "top" && sideB === "left") {
      return passageA.start <= margin && passageB.start <= margin;
    }
    if (sideA === "top" && sideB === "right") {
      return passageA.end >= 49 - margin && passageB.start <= margin;
    }
    if (sideA === "bottom" && sideB === "left") {
      return passageA.start <= margin && passageB.end >= 49 - margin;
    }
    if (sideA === "bottom" && sideB === "right") {
      return passageA.end >= 49 - margin && passageB.end >= 49 - margin;
    }

    return false;
  },

  findApproachParent(parent, index) {
    if (parent[index] === index) return index;
    parent[index] = this.findApproachParent(parent, parent[index]);
    return parent[index];
  },

  unionApproachParents(parent, left, right) {
    var leftRoot = this.findApproachParent(parent, left);
    var rightRoot = this.findApproachParent(parent, right);

    if (leftRoot === rightRoot) return;
    parent[rightRoot] = leftRoot;
  },

  frontiersTouchOrOverlap(leftFrontier, rightFrontier) {
    if (
      !leftFrontier ||
      !rightFrontier ||
      !leftFrontier.tiles ||
      !rightFrontier.tiles ||
      leftFrontier.tiles.length <= 0 ||
      rightFrontier.tiles.length <= 0
    ) {
      return false;
    }

    var leftMap = Object.create(null);

    for (var i = 0; i < leftFrontier.tiles.length; i++) {
      leftMap[this.toKey(leftFrontier.tiles[i].x, leftFrontier.tiles[i].y)] = true;
    }

    for (var j = 0; j < rightFrontier.tiles.length; j++) {
      var tile = rightFrontier.tiles[j];
      var tileKey = this.toKey(tile.x, tile.y);

      if (leftMap[tileKey]) return true;

      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          if (dx === 0 && dy === 0) continue;
          if (leftMap[this.toKey(tile.x + dx, tile.y + dy)]) return true;
        }
      }
    }

    return false;
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

  getBestPassageChoke(roomName, terrain, passage, anchor, protectedRegion) {
    var maxDepth = Math.max(2, config.DEFENSE.MAX_CHOKE_DEPTH || 8);
    var preferredCoord = this.getPreferredPassageCoord(passage, anchor);
    var best = this.searchPassageChoke(
      roomName,
      terrain,
      passage,
      preferredCoord,
      protectedRegion,
      1,
      maxDepth,
    );

    if (best) return best;

    return this.searchPassageChoke(
      roomName,
      terrain,
      passage,
      preferredCoord,
      protectedRegion,
      maxDepth + 1,
      20,
    );
  },

  getBestApproachChoke(roomName, terrain, approach, anchor, protectedRegion) {
    var maxDepth = Math.max(2, config.DEFENSE.MAX_CHOKE_DEPTH || 8);
    var best = this.searchApproachChoke(
      roomName,
      terrain,
      approach,
      anchor,
      protectedRegion,
      1,
      maxDepth,
    );

    if (best) return best;

    return this.searchApproachChoke(
      roomName,
      terrain,
      approach,
      anchor,
      protectedRegion,
      maxDepth + 1,
      20,
    );
  },

  searchApproachChoke(roomName, terrain, approach, anchor, protectedRegion, startDepth, endDepth) {
    var best = null;

    for (var depth = startDepth; depth <= endDepth; depth++) {
      var frontier = this.getApproachFrontier(roomName, terrain, approach, depth);
      if (frontier.tiles.length === 0) continue;
      if (!this.isFrontierOutsideProtectedRegion(frontier, protectedRegion)) continue;

      var gates = this.pickFrontierGatePairs(frontier.tiles, anchor);
      if (!gates || gates.length === 0) continue;

      var walls = this.getWallTiles(frontier.tiles, gates);
      if (!this.isBarrierBuildable(terrain, walls, gates)) continue;

      var score = this.scoreFrontierChoke(
        frontier.tiles.length,
        gates,
        anchor,
        depth,
        protectedRegion,
        frontier.tiles,
      );

      if (!best || score < best.score) {
        best = {
          score: score,
          walls: walls,
          gates: gates,
        };
      }
    }

    return best;
  },

  searchPassageChoke(roomName, terrain, passage, preferredCoord, protectedRegion, startDepth, endDepth) {
    var best = null;

    for (var depth = startDepth; depth <= endDepth; depth++) {
      var frontier = this.getPassageFrontier(roomName, terrain, passage, depth);
      if (frontier.tiles.length === 0) continue;
      if (!this.isFrontierOutsideProtectedRegion(frontier, protectedRegion)) continue;

      var gates = this.pickGatePairs(frontier.tiles, passage.side, preferredCoord);
      if (!gates || gates.length === 0) continue;
      var walls = this.getWallTiles(frontier.tiles, gates);
      if (!this.isBarrierBuildable(terrain, walls, gates)) continue;

      var score = this.scoreChoke(
        frontier.tiles.length,
        gates,
        passage.side,
        preferredCoord,
        depth,
        protectedRegion,
        frontier.tiles,
      );

      if (!best || score < best.score) {
        best = {
          score: score,
          walls: walls,
          gates: gates,
        };
      }
    }

    return best;
  },

  getProtectedRegion(room, state, anchor) {
    var terrain = room.getTerrain();
    var map = Object.create(null);
    var positions = [];
    var objectives = [];
    var structures =
      state && state.structures
        ? state.structures
        : room.find(FIND_MY_STRUCTURES);
    var sources =
      state && state.sources
        ? state.sources
        : room.find(FIND_SOURCES);
    var controller = room.controller || null;
    var sourceContainers =
      state && state.sourceContainers
        ? state.sourceContainers
        : [];
    var controllerContainer =
      state && state.controllerContainer
        ? state.controllerContainer
        : null;
    var storage =
      room.storage ||
      (state && state.structuresByType && state.structuresByType[STRUCTURE_STORAGE]
        ? state.structuresByType[STRUCTURE_STORAGE][0]
        : null);

    this.addProtectedRegionRadius(map, positions, terrain, anchor, 4);
    if (storage && storage.pos) {
      this.addProtectedRegionRadius(map, positions, terrain, storage.pos, 2);
    }

    for (var i = 0; i < structures.length; i++) {
      var structure = structures[i];
      if (!structure || !structure.pos) continue;
      if (
        structure.structureType === STRUCTURE_ROAD ||
        structure.structureType === STRUCTURE_WALL ||
        structure.structureType === STRUCTURE_RAMPART
      ) {
        continue;
      }

      this.addProtectedRegionRadius(
        map,
        positions,
        terrain,
        structure.pos,
        1,
      );
    }

    if (controller && controller.pos) {
      objectives.push(controllerContainer && controllerContainer.pos ? controllerContainer.pos : controller.pos);
    }

    if (sourceContainers && sourceContainers.length > 0) {
      for (var s = 0; s < sourceContainers.length; s++) {
        if (sourceContainers[s] && sourceContainers[s].pos) {
          objectives.push(sourceContainers[s].pos);
        }
      }
    } else {
      for (var sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
        objectives.push(sources[sourceIndex].pos);
      }
    }

    for (var j = 0; j < objectives.length; j++) {
      this.addProtectedRegionRadius(map, positions, terrain, objectives[j], 1);
      this.addProtectedPathRegion(map, positions, terrain, anchor, objectives[j], 1);
    }

    return {
      map: map,
      positions: positions,
    };
  },

  addProtectedRegionRadius(map, positions, terrain, origin, radius) {
    if (!origin) return;

    for (var dx = -radius; dx <= radius; dx++) {
      for (var dy = -radius; dy <= radius; dy++) {
        var x = origin.x + dx;
        var y = origin.y + dy;

        if (x < 1 || x > 48 || y < 1 || y > 48) continue;
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;
        this.addProtectedRegionTile(map, positions, origin.roomName, x, y);
      }
    }
  },

  addProtectedPathRegion(map, positions, terrain, fromPos, toPos, radius) {
    if (!fromPos || !toPos) return;

    var path = fromPos.findPathTo(toPos, { range: 1 });
    for (var i = 0; i < path.length; i++) {
      this.addProtectedRegionRadius(
        map,
        positions,
        terrain,
        new RoomPosition(path[i].x, path[i].y, fromPos.roomName),
        radius,
      );
    }
  },

  addProtectedRegionTile(map, positions, roomName, x, y) {
    var key = this.toKey(x, y);
    if (map[key]) return;

    var pos = new RoomPosition(x, y, roomName);
    map[key] = pos;
    positions.push(pos);
  },

  isFrontierOutsideProtectedRegion(frontier, protectedRegion) {
    if (!protectedRegion || !protectedRegion.map) return true;
    if (!frontier || !frontier.visitedMap) return true;

    for (var key in protectedRegion.map) {
      if (frontier.visitedMap[key]) return false;
    }

    return true;
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
    return this.getApproachFrontier(
      roomName,
      terrain,
      {
        roomName: roomName,
        passages: [passage],
      },
      depth,
    );
  },

  getApproachFrontier(roomName, terrain, approach, depth) {
    var queue = [];
    var visited = Object.create(null);
    var distanceByKey = Object.create(null);
    var visitedTiles = [];
    var passages = approach && approach.passages ? approach.passages : [];

    for (var p = 0; p < passages.length; p++) {
      for (var offset = passages[p].start; offset <= passages[p].end; offset++) {
        var seed = this.getSeedPosition(passages[p].side, offset, roomName);
        var key = this.toKey(seed.x, seed.y);

        if (!this.isWalkable(terrain, seed.x, seed.y)) continue;
        if (visited[key]) continue;

        visited[key] = true;
        distanceByKey[key] = 1;
        queue.push(seed);
        visitedTiles.push(seed);
      }
    }

    for (var head = 0; head < queue.length; head++) {
      var current = queue[head];
      var currentKey = this.toKey(current.x, current.y);
      var currentDistance = distanceByKey[currentKey] || 1;

      this.forEachAdjacent(
        current.x,
        current.y,
        1,
        48,
        function (x, y) {
          var key = this.toKey(x, y);

          if (visited[key]) return;
          if (!this.isWalkable(terrain, x, y)) return;
          if (!this.isWithinApproachBand(approach, x, y, depth)) return;
          if (currentDistance + 1 > depth) return;

          visited[key] = true;
          distanceByKey[key] = currentDistance + 1;
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
      var tileKey = this.toKey(tile.x, tile.y);

      if ((distanceByKey[tileKey] || 0) === depth) {
        frontier.push(tile);
      }
    }

    frontier.sort(function (left, right) {
      if (left.x !== right.x) return left.x - right.x;
      return left.y - right.y;
    });

    return {
      tiles: frontier,
      visitedMap: visited,
    };
  },

  isWithinApproachBand(approach, x, y, depth) {
    if (!approach || !approach.passages || approach.passages.length <= 0) return false;

    for (var i = 0; i < approach.passages.length; i++) {
      if (this.isWithinPassageBand(approach.passages[i], x, y, depth)) {
        return true;
      }
    }

    return false;
  },

  pickFrontierGatePairs(frontierTiles, anchor) {
    var gates = [];
    var gateMap = Object.create(null);
    var sideGroups = {
      top: [],
      right: [],
      bottom: [],
      left: [],
    };

    if (!frontierTiles || frontierTiles.length <= 0) return gates;

    for (var i = 0; i < frontierTiles.length; i++) {
      var side = this.getPrimarySide(frontierTiles[i]);
      if (!sideGroups[side]) sideGroups[side] = [];
      sideGroups[side].push(frontierTiles[i]);
    }

    for (var sideName in sideGroups) {
      if (!sideGroups[sideName] || sideGroups[sideName].length <= 0) continue;

      sideGroups[sideName].sort(function (left, right) {
        if (sideName === "top" || sideName === "bottom") {
          if (left.x !== right.x) return left.x - right.x;
          return left.y - right.y;
        }

        if (left.y !== right.y) return left.y - right.y;
        return left.x - right.x;
      });

      var preferredCoord = this.getPreferredSideCoord(sideName, anchor, sideGroups[sideName]);
      var sideGates = this.pickGatePairs(sideGroups[sideName], sideName, preferredCoord);

      for (var g = 0; g < sideGates.length; g++) {
        var gateKey = this.toKey(sideGates[g].x, sideGates[g].y);
        if (gateMap[gateKey]) continue;
        gateMap[gateKey] = true;
        gates.push(sideGates[g]);
      }
    }

    return gates;
  },

  getPreferredSideCoord(side, anchor, tiles) {
    if (anchor) {
      return side === "top" || side === "bottom" ? anchor.x : anchor.y;
    }

    if (!tiles || tiles.length <= 0) return 25;

    var first = tiles[0];
    var last = tiles[tiles.length - 1];

    return side === "top" || side === "bottom"
      ? Math.floor((first.x + last.x) / 2)
      : Math.floor((first.y + last.y) / 2);
  },

  getFrontierComponents(frontierTiles) {
    var tileByKey = Object.create(null);
    var visited = Object.create(null);
    var components = [];

    if (!frontierTiles || frontierTiles.length <= 0) return components;

    for (var i = 0; i < frontierTiles.length; i++) {
      tileByKey[this.toKey(frontierTiles[i].x, frontierTiles[i].y)] = frontierTiles[i];
    }

    for (var j = 0; j < frontierTiles.length; j++) {
      var start = frontierTiles[j];
      var startKey = this.toKey(start.x, start.y);
      if (visited[startKey]) continue;

      var queue = [start];
      var component = [];
      visited[startKey] = true;

      for (var head = 0; head < queue.length; head++) {
        var current = queue[head];
        component.push(current);

        for (var dx = -1; dx <= 1; dx++) {
          for (var dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;

            var nextKey = this.toKey(current.x + dx, current.y + dy);
            if (!tileByKey[nextKey] || visited[nextKey]) continue;

            visited[nextKey] = true;
            queue.push(tileByKey[nextKey]);
          }
        }
      }

      components.push(component);
    }

    return components;
  },

  pickFrontierGatePairForComponent(component, anchor) {
    if (!component || component.length < 2) return null;

    var bestPair = null;
    var bestDepth = -1;
    var bestAnchorDistance = Infinity;

    for (var i = 0; i < component.length; i++) {
      for (var j = i + 1; j < component.length; j++) {
        if (!this.areAdjacentGatePairTiles(component[i], component[j])) continue;

        var pair = [component[i], component[j]];
        var depth =
          this.getRoomBorderDistance(component[i]) +
          this.getRoomBorderDistance(component[j]);
        var anchorDistance = anchor
          ? this.getRangeToAnchor(component[i], anchor) +
            this.getRangeToAnchor(component[j], anchor)
          : 0;

        if (
          depth > bestDepth ||
          (depth === bestDepth && anchorDistance < bestAnchorDistance) ||
          (depth === bestDepth &&
            anchorDistance === bestAnchorDistance &&
            this.comparePositionLists(pair, bestPair) < 0)
        ) {
          bestPair = pair;
          bestDepth = depth;
          bestAnchorDistance = anchorDistance;
        }
      }
    }

    return bestPair;
  },

  scoreFrontierChoke(tileCount, gates, anchor, depth, protectedRegion, frontierTiles) {
    var closestGateDistance = Infinity;
    var gatePairs = Math.floor((gates && gates.length ? gates.length : 0) / 2);
    var protectedDistance = this.getClosestProtectedDistance(frontierTiles, protectedRegion);

    for (var i = 0; gates && i < gates.length - 1; i += 2) {
      var anchorDistance = anchor
        ? this.getRangeToAnchor(gates[i], anchor) +
          this.getRangeToAnchor(gates[i + 1], anchor)
        : 0;

      if (anchorDistance < closestGateDistance) {
        closestGateDistance = anchorDistance;
      }
    }

    if (closestGateDistance === Infinity) closestGateDistance = 0;

    return (
      protectedDistance * 10000 +
      tileCount * 1000 +
      depth * 10 +
      closestGateDistance +
      gatePairs * 25
    );
  },

  pickGatePairs(frontierTiles, side, preferredCoord) {
    var runs = this.getFrontierRuns(frontierTiles, side);
    var gates = [];

    for (var i = 0; i < runs.length; i++) {
      var pair = this.pickGatePairForRun(runs[i], side, preferredCoord);
      if (!pair) continue;
      gates.push(pair[0], pair[1]);
    }

    return gates;
  },

  getFrontierRuns(frontierTiles, side) {
    var runs = [];
    if (!frontierTiles || frontierTiles.length === 0) return runs;

    var currentRun = [frontierTiles[0]];

    for (var i = 1; i < frontierTiles.length; i++) {
      if (this.areSideBySideGateTiles(frontierTiles[i - 1], frontierTiles[i], side)) {
        currentRun.push(frontierTiles[i]);
      } else {
        runs.push(currentRun);
        currentRun = [frontierTiles[i]];
      }
    }

    if (currentRun.length > 0) {
      runs.push(currentRun);
    }

    return runs;
  },

  pickGatePairForRun(runTiles, side, preferredCoord) {
    if (!runTiles || runTiles.length < 2) return null;

    var bestPair = null;
    var bestScore = Infinity;
    var minCoord =
      side === "top" || side === "bottom"
        ? runTiles[0].x
        : runTiles[0].y;
    var maxCoord =
      side === "top" || side === "bottom"
        ? runTiles[runTiles.length - 1].x
        : runTiles[runTiles.length - 1].y;
    var clampedPreferred = Math.max(minCoord, Math.min(maxCoord, preferredCoord));

    for (var i = 0; i < runTiles.length - 1; i++) {
      var first = runTiles[i];
      var second = runTiles[i + 1];

      if (!this.areSideBySideGateTiles(first, second, side)) continue;

      var center = this.getGateCenter(first, second, side);
      var score = Math.abs(center - clampedPreferred);

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

  scoreChoke(tileCount, gates, side, preferredCoord, depth, protectedRegion, frontierTiles) {
    var closestGateDistance = Infinity;
    var gatePairs = Math.floor((gates && gates.length ? gates.length : 0) / 2);
    var protectedDistance = this.getClosestProtectedDistance(frontierTiles, protectedRegion);

    for (var i = 0; gates && i < gates.length - 1; i += 2) {
      var gateCenter = this.getGateCenter(gates[i], gates[i + 1], side);
      var gateDistance = Math.abs(gateCenter - preferredCoord);
      if (gateDistance < closestGateDistance) {
        closestGateDistance = gateDistance;
      }
    }

    if (closestGateDistance === Infinity) closestGateDistance = 0;

    return (
      protectedDistance * 10000 +
      tileCount * 1000 +
      depth * 10 +
      closestGateDistance +
      gatePairs * 25
    );
  },

  getClosestProtectedDistance(frontierTiles, protectedRegion) {
    if (
      !frontierTiles ||
      frontierTiles.length <= 0 ||
      !protectedRegion ||
      !protectedRegion.positions ||
      protectedRegion.positions.length <= 0
    ) {
      return 0;
    }

    var best = Infinity;

    for (var i = 0; i < frontierTiles.length; i++) {
      for (var j = 0; j < protectedRegion.positions.length; j++) {
        var distance = frontierTiles[i].getRangeTo(protectedRegion.positions[j]);
        if (distance < best) best = distance;
      }
    }

    return best === Infinity ? 0 : best;
  },

  getWallTiles(frontierTiles, gates) {
    var walls = [];
    var gateMap = Object.create(null);

    for (var g = 0; gates && g < gates.length; g++) {
      gateMap[this.toKey(gates[g].x, gates[g].y)] = true;
    }

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

  normalizePlan(room, state, spawn, plan) {
    if (!room || !plan) return plan;

    var terrain = room.getTerrain();
    var passages = this.getExitPassages(room.name, terrain);
    var anchor = this.getTrafficAnchor(room, state, spawn);
    var wallMap = Object.create(null);
    var gateMap = Object.create(null);
    var key;

    for (var i = 0; i < plan.walls.length; i++) {
      wallMap[this.toKey(plan.walls[i].x, plan.walls[i].y)] = plan.walls[i];
    }
    for (var j = 0; j < plan.gates.length; j++) {
      gateMap[this.toKey(plan.gates[j].x, plan.gates[j].y)] = plan.gates[j];
    }

    for (var p = 0; p < passages.length; p++) {
      var side = passages[p].side;
      var hasInvalidEntries = false;

      for (key in wallMap) {
        if (!wallMap[key] || !this.isPositionOnSide(wallMap[key], side)) continue;
        if (!this.isDefensePositionBuildable(terrain, wallMap[key])) {
          hasInvalidEntries = true;
          break;
        }
      }

      if (!hasInvalidEntries) {
        for (key in gateMap) {
          if (!gateMap[key] || !this.isPositionOnSide(gateMap[key], side)) continue;
          if (!this.isDefensePositionBuildable(terrain, gateMap[key])) {
            hasInvalidEntries = true;
            break;
          }
        }
      }

      if (!hasInvalidEntries) continue;

      for (key in wallMap) {
        if (wallMap[key] && this.isPositionOnSide(wallMap[key], side)) {
          delete wallMap[key];
        }
      }
      for (key in gateMap) {
        if (gateMap[key] && this.isPositionOnSide(gateMap[key], side)) {
          delete gateMap[key];
        }
      }

      var repairedChoke = this.getBestPassageChoke(
        room.name,
        terrain,
        passages[p],
        anchor,
      );
      if (repairedChoke) {
        this.mergeBarrierMaps(wallMap, gateMap, repairedChoke);
      }
    }

    return this.coalesceCornerGatePlan(
      room.name,
      {
        walls: this.toSortedPositions(room.name, wallMap),
        gates: this.toSortedPositions(room.name, gateMap),
      },
      anchor,
    );
  },

  coalesceCornerGatePlan(roomName, plan, anchor) {
    if (!plan) return null;

    var wallMap = this.getPositionMap(plan.walls);
    var gateMap = this.getPositionMap(plan.gates);
    var components = this.getBarrierComponents(wallMap, gateMap);

    for (var i = 0; i < components.length; i++) {
      var component = components[i];

      if (!component.gates || component.gates.length <= 2) continue;

      var sideMap = this.getComponentSideMap(component.positions);
      if (this.hasAdjacentCornerSides(sideMap)) continue;

      var gatePairs = this.getComponentGatePairs(component.gates);
      if (gatePairs.length <= 1) continue;

      var retainedPair = this.pickRetainedGatePair(gatePairs, anchor);
      if (!retainedPair) continue;

      var retainedMap = Object.create(null);
      retainedMap[this.toKey(retainedPair[0].x, retainedPair[0].y)] = true;
      retainedMap[this.toKey(retainedPair[1].x, retainedPair[1].y)] = true;

      for (var g = 0; g < component.gates.length; g++) {
        var gate = component.gates[g];
        var gateKey = this.toKey(gate.x, gate.y);

        if (retainedMap[gateKey]) continue;

        delete gateMap[gateKey];
        wallMap[gateKey] = gate;
      }
    }

    return {
      walls: this.toSortedPositions(roomName, wallMap),
      gates: this.toSortedPositions(roomName, gateMap),
    };
  },

  getPositionMap(positions) {
    var map = Object.create(null);

    if (!positions) return map;

    for (var i = 0; i < positions.length; i++) {
      if (!positions[i]) continue;
      map[this.toKey(positions[i].x, positions[i].y)] = positions[i];
    }

    return map;
  },

  getBarrierComponents(wallMap, gateMap) {
    var barrierMap = Object.create(null);
    var components = [];
    var visited = Object.create(null);
    var key;

    for (key in wallMap) {
      if (wallMap[key]) barrierMap[key] = wallMap[key];
    }
    for (key in gateMap) {
      if (gateMap[key]) barrierMap[key] = gateMap[key];
    }

    for (key in barrierMap) {
      if (!barrierMap[key] || visited[key]) continue;

      var queue = [barrierMap[key]];
      var positions = [];
      var gates = [];

      visited[key] = true;

      for (var head = 0; head < queue.length; head++) {
        var current = queue[head];
        var currentKey = this.toKey(current.x, current.y);

        positions.push(current);
        if (gateMap[currentKey]) gates.push(current);

        this.forEachAdjacent(
          current.x,
          current.y,
          1,
          48,
          function (x, y) {
            var nextKey = this.toKey(x, y);

            if (!barrierMap[nextKey] || visited[nextKey]) return;

            visited[nextKey] = true;
            queue.push(barrierMap[nextKey]);
          },
          this,
        );
      }

      components.push({
        positions: positions,
        gates: gates,
      });
    }

    return components;
  },

  getComponentSideMap(positions) {
    var sideMap = Object.create(null);

    if (!positions) return sideMap;

    for (var i = 0; i < positions.length; i++) {
      sideMap[this.getPrimarySide(positions[i])] = true;
    }

    return sideMap;
  },

  hasAdjacentCornerSides(sideMap) {
    if (!sideMap) return false;

    return (
      (sideMap.top && sideMap.left) ||
      (sideMap.top && sideMap.right) ||
      (sideMap.bottom && sideMap.left) ||
      (sideMap.bottom && sideMap.right)
    );
  },

  getComponentGatePairs(gates) {
    var pairs = [];
    var seen = Object.create(null);

    if (!gates) return pairs;

    for (var i = 0; i < gates.length; i++) {
      for (var j = i + 1; j < gates.length; j++) {
        if (!this.areAdjacentGatePairTiles(gates[i], gates[j])) continue;

        var first = gates[i];
        var second = gates[j];

        if (
          second.x < first.x ||
          (second.x === first.x && second.y < first.y)
        ) {
          first = gates[j];
          second = gates[i];
        }

        var key = [
          this.toKey(first.x, first.y),
          this.toKey(second.x, second.y),
        ].join("|");

        if (seen[key]) continue;
        seen[key] = true;
        pairs.push([first, second]);
      }
    }

    return pairs;
  },

  areAdjacentGatePairTiles(first, second) {
    if (!first || !second) return false;

    return (
      (first.x === second.x && Math.abs(first.y - second.y) === 1) ||
      (first.y === second.y && Math.abs(first.x - second.x) === 1)
    );
  },

  pickRetainedGatePair(gatePairs, anchor) {
    var bestPair = null;
    var bestDepth = -1;
    var bestAnchorDistance = Infinity;

    for (var i = 0; i < gatePairs.length; i++) {
      var pair = gatePairs[i];
      var depth =
        this.getRoomBorderDistance(pair[0]) +
        this.getRoomBorderDistance(pair[1]);
      var anchorDistance = anchor
        ? this.getRangeToAnchor(pair[0], anchor) + this.getRangeToAnchor(pair[1], anchor)
        : 0;

      if (
        depth > bestDepth ||
        (depth === bestDepth && anchorDistance < bestAnchorDistance) ||
        (depth === bestDepth &&
          anchorDistance === bestAnchorDistance &&
          this.comparePositionLists(pair, bestPair) < 0)
      ) {
        bestPair = pair;
        bestDepth = depth;
        bestAnchorDistance = anchorDistance;
      }
    }

    return bestPair;
  },

  getRoomBorderDistance(pos) {
    if (!pos) return 0;

    return Math.min(pos.x, pos.y, 49 - pos.x, 49 - pos.y);
  },

  getRangeToAnchor(pos, anchor) {
    if (!pos || !anchor) return 0;

    return Math.abs(pos.x - anchor.x) + Math.abs(pos.y - anchor.y);
  },

  comparePositionLists(left, right) {
    if (!left && !right) return 0;
    if (!left) return 1;
    if (!right) return -1;

    for (var i = 0; i < Math.min(left.length, right.length); i++) {
      if (left[i].x !== right[i].x) return left[i].x - right[i].x;
      if (left[i].y !== right[i].y) return left[i].y - right[i].y;
    }

    return left.length - right.length;
  },

  isBarrierBuildable(terrain, walls, gates) {
    var positions = [];
    if (walls && walls.length) positions = positions.concat(walls);
    if (gates && gates.length) positions = positions.concat(gates);

    for (var i = 0; i < positions.length; i++) {
      if (!this.isDefensePositionBuildable(terrain, positions[i])) return false;
    }

    return true;
  },

  isDefensePositionBuildable(terrain, pos) {
    if (!terrain || !pos) return false;
    if (pos.x <= 0 || pos.y <= 0 || pos.x >= 49 || pos.y >= 49) return false;
    if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) return false;

    var borderTiles = this.getBorderSupportTiles(pos.x, pos.y);
    if (!borderTiles) return true;

    for (var i = 0; i < borderTiles.length; i++) {
      if (terrain.get(borderTiles[i][0], borderTiles[i][1]) !== TERRAIN_MASK_WALL) {
        return false;
      }
    }

    return true;
  },

  getBorderSupportTiles(x, y) {
    if (x === 1) return [[0, y - 1], [0, y], [0, y + 1]];
    if (x === 48) return [[49, y - 1], [49, y], [49, y + 1]];
    if (y === 1) return [[x - 1, 0], [x, 0], [x + 1, 0]];
    if (y === 48) return [[x - 1, 49], [x, 49], [x + 1, 49]];
    return null;
  },

  isPositionOnSide(pos, side) {
    return !!pos && this.getPrimarySide(pos) === side;
  },

  getPrimarySide(pos) {
    var distances = [
      { side: "top", distance: pos.y },
      { side: "right", distance: 49 - pos.x },
      { side: "bottom", distance: 49 - pos.y },
      { side: "left", distance: pos.x },
    ];
    var best = distances[0];

    for (var i = 1; i < distances.length; i++) {
      if (distances[i].distance < best.distance) {
        best = distances[i];
      }
    }

    return best.side;
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

  isWithinPassageBand(passage, x, y, depth) {
    if (!passage) return false;

    var lateralSlack = Math.floor(Math.max(0, depth - 1) / 2);
    var minOffset = Math.max(1, passage.start - lateralSlack);
    var maxOffset = Math.min(48, passage.end + lateralSlack);

    if (passage.side === "top") {
      return y >= 1 && y <= depth && x >= minOffset && x <= maxOffset;
    }
    if (passage.side === "right") {
      return x >= 49 - depth && x <= 48 && y >= minOffset && y <= maxOffset;
    }
    if (passage.side === "bottom") {
      return y >= 49 - depth && y <= 48 && x >= minOffset && x <= maxOffset;
    }
    return x >= 1 && x <= depth && y >= minOffset && y <= maxOffset;
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
