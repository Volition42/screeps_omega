#!/usr/bin/env node
"use strict";

const path = require("path");
const Module = require("module");

const repoRoot = path.resolve(__dirname, "..", "..");
const srcRoot = path.join(repoRoot, "src");

process.env.NODE_PATH = process.env.NODE_PATH
  ? `${srcRoot}${path.delimiter}${process.env.NODE_PATH}`
  : srcRoot;
Module._initPaths();

const OK = 0;
const ERR_NOT_OWNER = -1;
const ERR_NO_PATH = -2;
const ERR_NAME_EXISTS = -3;
const ERR_BUSY = -4;
const ERR_NOT_FOUND = -5;
const ERR_NOT_ENOUGH_ENERGY = -6;
const ERR_INVALID_TARGET = -7;
const ERR_FULL = -8;
const ERR_NOT_IN_RANGE = -9;
const ERR_INVALID_ARGS = -10;
const ERR_TIRED = -11;
const ERR_NO_BODYPART = -12;
const ERR_RCL_NOT_ENOUGH = -14;

const LOOK_STRUCTURES = "structure";
const LOOK_CONSTRUCTION_SITES = "constructionSite";
const LOOK_CREEPS = "creep";
const LOOK_POWER_CREEPS = "powerCreep";

const FIND_MY_CREEPS = 1;
const FIND_MY_SPAWNS = 2;
const FIND_SOURCES = 3;
const FIND_SOURCES_ACTIVE = 4;
const FIND_CONSTRUCTION_SITES = 5;
const FIND_STRUCTURES = 6;
const FIND_HOSTILE_CREEPS = 7;
const FIND_HOSTILE_POWER_CREEPS = 8;
const FIND_HOSTILE_STRUCTURES = 9;
const FIND_MINERALS = 10;
const FIND_MY_STRUCTURES = 11;
const FIND_DROPPED_RESOURCES = 12;

const TERRAIN_MASK_WALL = 1;

const STRUCTURE_SPAWN = "spawn";
const STRUCTURE_EXTENSION = "extension";
const STRUCTURE_ROAD = "road";
const STRUCTURE_WALL = "constructedWall";
const STRUCTURE_RAMPART = "rampart";
const STRUCTURE_CONTAINER = "container";
const STRUCTURE_TOWER = "tower";
const STRUCTURE_STORAGE = "storage";
const STRUCTURE_LINK = "link";
const STRUCTURE_TERMINAL = "terminal";
const STRUCTURE_EXTRACTOR = "extractor";
const STRUCTURE_LAB = "lab";
const STRUCTURE_FACTORY = "factory";
const STRUCTURE_OBSERVER = "observer";
const STRUCTURE_POWER_SPAWN = "powerSpawn";
const STRUCTURE_NUKER = "nuker";
const STRUCTURE_INVADER_CORE = "invaderCore";

const RESOURCE_ENERGY = "energy";
const RESOURCE_POWER = "power";
const RESOURCE_GHODIUM = "G";

const WORK = "work";
const CARRY = "carry";
const MOVE = "move";
const ATTACK = "attack";
const RANGED_ATTACK = "ranged_attack";
const HEAL = "heal";
const CLAIM = "claim";
const TOUGH = "tough";

const CONTROLLER_STRUCTURES = {
  spawn: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 2, 8: 3 },
  extension: { 1: 0, 2: 5, 3: 10, 4: 20, 5: 30, 6: 40, 7: 50, 8: 60 },
  road: { 1: 2500, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
  constructedWall: { 1: 0, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
  rampart: { 1: 0, 2: 2500, 3: 2500, 4: 2500, 5: 2500, 6: 2500, 7: 2500, 8: 2500 },
  container: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5, 6: 5, 7: 5, 8: 5 },
  tower: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 6 },
  storage: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1 },
  link: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 2, 6: 3, 7: 4, 8: 6 },
  terminal: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
  extractor: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 1, 8: 1 },
  lab: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 3, 7: 6, 8: 10 },
  factory: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 1, 8: 1 },
  observer: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
  powerSpawn: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
  nuker: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 1 },
};

function collectionValues(collection) {
  if (!collection) return [];
  return Array.isArray(collection) ? collection.slice() : Object.values(collection);
}

function normalizeIteratee(iteratee) {
  if (typeof iteratee === "function") return iteratee;
  if (typeof iteratee === "string") {
    return function (item) {
      return item ? item[iteratee] : undefined;
    };
  }
  if (iteratee && typeof iteratee === "object") {
    return function (item) {
      if (!item) return false;
      const keys = Object.keys(iteratee);
      for (let i = 0; i < keys.length; i++) {
        if (item[keys[i]] !== iteratee[keys[i]]) return false;
      }
      return true;
    };
  }
  return function (item) {
    return item;
  };
}

global._ = {
  filter(collection, predicate) {
    const fn = normalizeIteratee(predicate);
    return collectionValues(collection).filter(fn);
  },
  map(collection, iteratee) {
    const fn = normalizeIteratee(iteratee);
    return collectionValues(collection).map(fn);
  },
  some(collection, predicate) {
    const fn = normalizeIteratee(predicate);
    return collectionValues(collection).some(fn);
  },
  find(collection, predicate) {
    const fn = normalizeIteratee(predicate);
    const values = collectionValues(collection);
    for (let i = 0; i < values.length; i++) {
      if (fn(values[i])) return values[i];
    }
    return undefined;
  },
  min(collection, iteratee) {
    const fn = normalizeIteratee(iteratee);
    const values = collectionValues(collection);
    if (values.length === 0) return undefined;
    let best = values[0];
    let bestScore = fn(best);
    for (let i = 1; i < values.length; i++) {
      const score = fn(values[i]);
      if (score < bestScore) {
        best = values[i];
        bestScore = score;
      }
    }
    return best;
  },
};

Object.assign(global, {
  OK,
  ERR_NOT_OWNER,
  ERR_NO_PATH,
  ERR_NAME_EXISTS,
  ERR_BUSY,
  ERR_NOT_FOUND,
  ERR_NOT_ENOUGH_ENERGY,
  ERR_INVALID_TARGET,
  ERR_FULL,
  ERR_NOT_IN_RANGE,
  ERR_INVALID_ARGS,
  ERR_TIRED,
  ERR_NO_BODYPART,
  ERR_RCL_NOT_ENOUGH,
  LOOK_STRUCTURES,
  LOOK_CONSTRUCTION_SITES,
  LOOK_CREEPS,
  LOOK_POWER_CREEPS,
  FIND_MY_CREEPS,
  FIND_MY_SPAWNS,
  FIND_SOURCES,
  FIND_SOURCES_ACTIVE,
  FIND_CONSTRUCTION_SITES,
  FIND_STRUCTURES,
  FIND_HOSTILE_CREEPS,
  FIND_HOSTILE_POWER_CREEPS,
  FIND_HOSTILE_STRUCTURES,
  FIND_MINERALS,
  FIND_MY_STRUCTURES,
  FIND_DROPPED_RESOURCES,
  TERRAIN_MASK_WALL,
  STRUCTURE_SPAWN,
  STRUCTURE_EXTENSION,
  STRUCTURE_ROAD,
  STRUCTURE_WALL,
  STRUCTURE_RAMPART,
  STRUCTURE_CONTAINER,
  STRUCTURE_TOWER,
  STRUCTURE_STORAGE,
  STRUCTURE_LINK,
  STRUCTURE_TERMINAL,
  STRUCTURE_EXTRACTOR,
  STRUCTURE_LAB,
  STRUCTURE_FACTORY,
  STRUCTURE_OBSERVER,
  STRUCTURE_POWER_SPAWN,
  STRUCTURE_NUKER,
  STRUCTURE_INVADER_CORE,
  RESOURCE_ENERGY,
  RESOURCE_POWER,
  RESOURCE_GHODIUM,
  WORK,
  CARRY,
  MOVE,
  ATTACK,
  RANGED_ATTACK,
  HEAL,
  CLAIM,
  TOUGH,
  CONTROLLER_STRUCTURES,
  REACTIONS: {
    H: { O: "OH" },
    O: { H: "OH" },
    Z: { K: "ZK" },
    K: { Z: "ZK" },
    U: { L: "UL" },
    L: { U: "UL" },
    ZK: { UL: "G" },
    UL: { ZK: "G" },
    G: { H: "GH", O: "GO" },
    H: { O: "OH", G: "GH", U: "UH", K: "KH", L: "LH", Z: "ZH" },
    O: { H: "OH", G: "GO", U: "UO", K: "KO", L: "LO", Z: "ZO" },
  },
  COMMODITIES: {
    battery: {
      amount: 50,
      cooldown: 10,
      components: {
        energy: 600,
      },
    },
  },
});

let currentRuntime = null;

function nextId(prefix) {
  currentRuntime.nextId += 1;
  return `${prefix}${currentRuntime.nextId}`;
}

function createStore(initial, capacities, totalCapacity) {
  const store = Object.assign({}, initial || {});
  const resourceCaps = Object.assign({}, capacities || {});
  const total = typeof totalCapacity === "number" ? totalCapacity : null;

  Object.defineProperty(store, "_resourceCaps", {
    value: resourceCaps,
    enumerable: false,
    writable: true,
  });
  Object.defineProperty(store, "_totalCapacity", {
    value: total,
    enumerable: false,
    writable: true,
  });

  Object.defineProperty(store, "getFreeCapacity", {
    enumerable: false,
    value(resourceType) {
      if (resourceType) {
        const cap = Object.prototype.hasOwnProperty.call(resourceCaps, resourceType)
          ? resourceCaps[resourceType]
          : total;
        if (typeof cap !== "number") return 0;
        return Math.max(0, cap - (store[resourceType] || 0));
      }

      if (typeof total !== "number") return 0;
      return Math.max(0, total - store.getUsedCapacity());
    },
  });

  Object.defineProperty(store, "getUsedCapacity", {
    enumerable: false,
    value(resourceType) {
      if (resourceType) return store[resourceType] || 0;

      const keys = Object.keys(store);
      let used = 0;
      for (let i = 0; i < keys.length; i++) {
        if (typeof store[keys[i]] === "number") used += store[keys[i]];
      }
      return used;
    },
  });

  return store;
}

class FakeTerrain {
  constructor() {
    this.walls = new Set();
  }

  setWall(x, y) {
    this.walls.add(`${x}:${y}`);
  }

  get(x, y) {
    return this.walls.has(`${x}:${y}`) ? TERRAIN_MASK_WALL : 0;
  }
}

class RoomPosition {
  constructor(x, y, roomName) {
    this.x = x;
    this.y = y;
    this.roomName = roomName;
  }

  get room() {
    return currentRuntime.rooms[this.roomName] || null;
  }

  getRangeTo(target) {
    const pos = target && target.pos ? target.pos : target;
    return Math.max(Math.abs(this.x - pos.x), Math.abs(this.y - pos.y));
  }

  inRangeTo(target, range) {
    return this.getRangeTo(target) <= range;
  }

  isEqualTo(target) {
    const pos = target && target.pos ? target.pos : target;
    return !!pos && this.x === pos.x && this.y === pos.y && this.roomName === pos.roomName;
  }

  lookFor(type) {
    const room = this.room;
    return room ? room.lookForAt(type, this.x, this.y) : [];
  }

  createConstructionSite(structureType) {
    const room = this.room;
    return room ? room.createConstructionSite(this.x, this.y, structureType) : ERR_INVALID_TARGET;
  }

  findPathTo(target, options) {
    const pos = target && target.pos ? target.pos : target;
    const range = options && typeof options.range === "number" ? options.range : 1;
    const path = [];
    let x = this.x;
    let y = this.y;

    while (Math.max(Math.abs(x - pos.x), Math.abs(y - pos.y)) > range) {
      if (x < pos.x) x++;
      else if (x > pos.x) x--;

      if (y < pos.y) y++;
      else if (y > pos.y) y--;

      path.push({ x: x, y: y });
      if (path.length > 100) break;
    }

    return path;
  }

  findClosestByRange(findType, options) {
    const room = this.room;
    if (!room) return null;
    const candidates = room.find(findType, options);
    if (!candidates || candidates.length === 0) return null;

    let best = candidates[0];
    let bestRange = this.getRangeTo(best);

    for (let i = 1; i < candidates.length; i++) {
      const range = this.getRangeTo(candidates[i]);
      if (range < bestRange) {
        best = candidates[i];
        bestRange = range;
      }
    }

    return best;
  }

  findClosestByPath(findType, options) {
    return this.findClosestByRange(findType, options);
  }

  getDirectionTo(target) {
    const pos = target && target.pos ? target.pos : target;
    const dx = Math.sign(pos.x - this.x);
    const dy = Math.sign(pos.y - this.y);
    const map = {
      "0,-1": 1,
      "1,-1": 2,
      "1,0": 3,
      "1,1": 4,
      "0,1": 5,
      "-1,1": 6,
      "-1,0": 7,
      "-1,-1": 8,
    };
    return map[`${dx},${dy}`] || 0;
  }
}

class FakeRoom {
  constructor(name, terrain) {
    this.name = name;
    this._terrain = terrain || new FakeTerrain();
    this._structures = [];
    this._sites = [];
    this._sources = [];
    this._minerals = [];
    this._hostileCreeps = [];
    this._hostileStructures = [];
    this._dropped = [];
    this.energyAvailable = 300;
    this.energyCapacityAvailable = 300;
    currentRuntime.rooms[name] = this;
  }

  getTerrain() {
    return this._terrain;
  }

  addStructure(structure) {
    structure.room = this;
    structure.pos.roomName = this.name;
    this._structures.push(structure);
    currentRuntime.objectsById[structure.id] = structure;
    if (structure.structureType === STRUCTURE_STORAGE) this.storage = structure;
    if (structure.structureType === STRUCTURE_TERMINAL) this.terminal = structure;
    if (structure.structureType === STRUCTURE_SPAWN && !this.spawn) this.spawn = structure;
    return structure;
  }

  addSite(site) {
    site.room = this;
    site.pos.roomName = this.name;
    this._sites.push(site);
    currentRuntime.objectsById[site.id] = site;
    return site;
  }

  addSource(source) {
    source.room = this;
    source.pos.roomName = this.name;
    this._sources.push(source);
    currentRuntime.objectsById[source.id] = source;
    return source;
  }

  addMineral(mineral) {
    mineral.room = this;
    mineral.pos.roomName = this.name;
    this._minerals.push(mineral);
    currentRuntime.objectsById[mineral.id] = mineral;
    return mineral;
  }

  setController(controller) {
    controller.room = this;
    controller.pos.roomName = this.name;
    this.controller = controller;
    currentRuntime.objectsById[controller.id] = controller;
    return controller;
  }

  find(findType, options) {
    let results;

    switch (findType) {
      case FIND_MY_CREEPS:
        results = collectionValues(Game.creeps).filter((creep) => creep.my && creep.pos.roomName === this.name);
        break;
      case FIND_MY_SPAWNS:
        results = this._structures.filter((structure) => structure.my && structure.structureType === STRUCTURE_SPAWN);
        break;
      case FIND_SOURCES:
        results = this._sources.slice();
        break;
      case FIND_SOURCES_ACTIVE:
        results = this._sources.filter((source) => source.energy > 0);
        break;
      case FIND_CONSTRUCTION_SITES:
        results = this._sites.slice();
        break;
      case FIND_STRUCTURES:
        results = this._structures.slice();
        break;
      case FIND_MY_STRUCTURES:
        results = this._structures.filter((structure) => structure.my);
        break;
      case FIND_HOSTILE_CREEPS:
        results = this._hostileCreeps.slice();
        break;
      case FIND_HOSTILE_POWER_CREEPS:
        results = [];
        break;
      case FIND_HOSTILE_STRUCTURES:
        results = this._hostileStructures.slice();
        break;
      case FIND_MINERALS:
        results = this._minerals.slice();
        break;
      case FIND_DROPPED_RESOURCES:
        results = this._dropped.slice();
        break;
      default:
        results = [];
        break;
    }

    if (options && typeof options.filter === "function") {
      results = results.filter(options.filter);
    }

    return results;
  }

  lookForAt(type, x, y) {
    if (type === LOOK_STRUCTURES) {
      return this._structures.filter((item) => item.pos.x === x && item.pos.y === y);
    }
    if (type === LOOK_CONSTRUCTION_SITES) {
      return this._sites.filter((item) => item.pos.x === x && item.pos.y === y);
    }
    if (type === LOOK_CREEPS) {
      return collectionValues(Game.creeps).filter((item) => item.pos.roomName === this.name && item.pos.x === x && item.pos.y === y);
    }
    if (type === LOOK_POWER_CREEPS) {
      return [];
    }
    return [];
  }

  createConstructionSite(x, y, structureType) {
    if (x < 1 || x > 48 || y < 1 || y > 48) return ERR_INVALID_ARGS;
    if (this._terrain.get(x, y) === TERRAIN_MASK_WALL) return ERR_INVALID_TARGET;

    const existingStructure = this._structures.find((item) => item.pos.x === x && item.pos.y === y && item.structureType === structureType);
    if (existingStructure) return ERR_INVALID_TARGET;

    const existingSite = this._sites.find((item) => item.pos.x === x && item.pos.y === y && item.structureType === structureType);
    if (existingSite) return ERR_INVALID_TARGET;

    const site = {
      id: nextId("site"),
      type: "constructionSite",
      structureType: structureType,
      pos: new RoomPosition(x, y, this.name),
      progress: 0,
      progressTotal: 100,
      room: this,
      my: true,
      owner: { username: "tester" },
    };
    this.addSite(site);
    return OK;
  }
}

function createStructure(structureType, x, y, options) {
  const spec = options || {};
  const structure = {
    id: spec.id || nextId(structureType),
    my: spec.my !== false,
    owner: spec.my === false ? null : { username: "tester" },
    structureType: structureType,
    pos: new RoomPosition(x, y, spec.roomName || "sim"),
    hits: spec.hits || 1000,
    hitsMax: spec.hitsMax || spec.hits || 1000,
  };

  if (spec.store || spec.storeCapacity || spec.storeCapacityResource) {
    structure.store = createStore(spec.store, spec.storeCapacityResource, spec.storeCapacity);
  }
  if (spec.storeCapacity) structure.storeCapacity = spec.storeCapacity;
  if (spec.storeCapacityResource) {
    structure.storeCapacityResource = Object.assign({}, spec.storeCapacityResource);
  }
  if (spec.cooldown !== undefined) structure.cooldown = spec.cooldown;
  if (spec.name) structure.name = spec.name;
  if (spec.level !== undefined) structure.level = spec.level;

  return structure;
}

function createSource(x, y, options) {
  const spec = options || {};
  return {
    id: spec.id || nextId("source"),
    type: "source",
    energy: spec.energy !== undefined ? spec.energy : 3000,
    energyCapacity: 3000,
    pos: new RoomPosition(x, y, spec.roomName || "sim"),
  };
}

function createMineral(x, y, options) {
  const spec = options || {};
  return {
    id: spec.id || nextId("mineral"),
    type: "mineral",
    mineralType: spec.mineralType || "H",
    mineralAmount: spec.mineralAmount !== undefined ? spec.mineralAmount : 70000,
    pos: new RoomPosition(x, y, spec.roomName || "sim"),
  };
}

function createController(x, y, options) {
  const spec = options || {};
  return {
    id: spec.id || nextId("controller"),
    type: "controller",
    level: spec.level || 1,
    progress: spec.progress || 0,
    pos: new RoomPosition(x, y, spec.roomName || "sim"),
    user: "tester",
  };
}

function createCreep(name, role, x, y, options) {
  const spec = options || {};
  const roomName = spec.roomName || "sim";
  const creep = {
    id: spec.id || nextId("creep"),
    name: name,
    my: true,
    body: spec.body || [{ type: WORK }, { type: CARRY }, { type: MOVE }],
    memory: Object.assign(
      {
        role: role,
        room: roomName,
        homeRoom: roomName,
        working: false,
      },
      spec.memory || {},
    ),
    pos: new RoomPosition(x, y, roomName),
    store: createStore(spec.store || {}, null, spec.storeCapacity || 50),
    fatigue: spec.fatigue || 0,
    getActiveBodyparts(partType) {
      let count = 0;
      for (let i = 0; i < this.body.length; i++) {
        if (this.body[i].type === partType) count++;
      }
      return count;
    },
  };

  Object.defineProperty(creep, "room", {
    enumerable: false,
    get() {
      return currentRuntime.rooms[this.pos.roomName] || null;
    },
  });

  currentRuntime.objectsById[creep.id] = creep;
  Game.creeps[creep.name] = creep;
  return creep;
}

function resetRuntime(tick) {
  currentRuntime = {
    nextId: 0,
    rooms: {},
    objectsById: {},
  };

  global.Memory = { rooms: {}, creeps: {}, runtime: {}, stats: {} };
  global.Game = {
    time: tick,
    creeps: {},
    rooms: currentRuntime.rooms,
    getObjectById(id) {
      return currentRuntime.objectsById[id] || null;
    },
    map: {
      getRoomTerrain(roomName) {
        return currentRuntime.rooms[roomName].getTerrain();
      },
    },
    cpu: {
      limit: 20,
      tickLimit: 500,
      bucket: 10000,
      getUsed() {
        return 0;
      },
    },
  };

  global.PathFinder = {
    search(start, goal) {
      const startPos = start.pos ? start.pos : start;
      const target = goal.pos ? goal.pos : goal;
      return {
        path: startPos.findPathTo(target, { range: goal.range || 1 }),
      };
    },
  };

  global.RoomPosition = RoomPosition;
}

function addRoads(room, positions) {
  for (let i = 0; i < positions.length; i++) {
    room.addStructure(
      createStructure(STRUCTURE_ROAD, positions[i][0], positions[i][1], {
        roomName: room.name,
        hits: 5000,
        hitsMax: 5000,
      }),
    );
  }
}

function addContainersForSources(room, sources) {
  const containers = [];
  for (let i = 0; i < sources.length; i++) {
    const pos = sources[i].pos;
    containers.push(
      room.addStructure(
        createStructure(STRUCTURE_CONTAINER, pos.x + 1, pos.y, {
          roomName: room.name,
          hits: 250000,
          hitsMax: 250000,
          store: { energy: 1000 },
          storeCapacity: 2000,
        }),
      ),
    );
  }
  return containers;
}

function addContainer(room, x, y, energy) {
  return room.addStructure(
    createStructure(STRUCTURE_CONTAINER, x, y, {
      roomName: room.name,
      hits: 250000,
      hitsMax: 250000,
      store: { energy: energy !== undefined ? energy : 1000 },
      storeCapacity: 2000,
    }),
  );
}

function addSupportContainers(room) {
  const support = {};

  const hubCandidates = [
    [24, 28],
    [26, 28],
    [24, 22],
    [26, 22],
  ];
  for (let i = 0; i < hubCandidates.length; i++) {
    if (!isOccupied(room, hubCandidates[i][0], hubCandidates[i][1])) {
      support.hub = addContainer(room, hubCandidates[i][0], hubCandidates[i][1], 600);
      break;
    }
  }

  const controller = room.controller;
  const controllerCandidates = controller
    ? [
        [controller.pos.x - 1, controller.pos.y - 2],
        [controller.pos.x, controller.pos.y - 2],
        [controller.pos.x + 1, controller.pos.y - 2],
        [controller.pos.x - 2, controller.pos.y],
        [controller.pos.x + 2, controller.pos.y],
      ]
    : [];

  for (let i = 0; i < controllerCandidates.length; i++) {
    const x = controllerCandidates[i][0];
    const y = controllerCandidates[i][1];
    if (!isOccupied(room, x, y)) {
      support.controller = addContainer(room, x, y, 400);
      break;
    }
  }

  return support;
}

function buildRoomScenario(name, options) {
  resetRuntime(options.tick);

  const room = new FakeRoom(name, new FakeTerrain());
  room.setController(
    createController(options.controllerX || 20, options.controllerY || 20, {
      roomName: name,
      level: options.controllerLevel,
      progress: options.controllerProgress || 0,
    }),
  );

  const spawn = room.addStructure(
    createStructure(STRUCTURE_SPAWN, options.spawnX || 25, options.spawnY || 25, {
      roomName: name,
      name: "Spawn1",
      hits: 5000,
      hitsMax: 5000,
      store: { energy: options.spawnEnergy !== undefined ? options.spawnEnergy : 300 },
      storeCapacityResource: { energy: 300 },
    }),
  );

  const sources = [
    room.addSource(createSource(options.sourceAX || 15, options.sourceAY || 25, { roomName: name })),
  ];

  if ((options.sourceCount || 2) >= 2) {
    sources.push(
      room.addSource(
        createSource(options.sourceBX || 35, options.sourceBY || 25, {
          roomName: name,
        }),
      ),
    );
  }

  if ((options.sourceCount || 2) >= 3) {
    sources.push(
      room.addSource(
        createSource(options.sourceCX || 25, options.sourceCY || 38, {
          roomName: name,
        }),
      ),
    );
  }

  room.addMineral(createMineral(options.mineralX || 40, options.mineralY || 10, { roomName: name }));

  if (options.sourceContainers) {
    addContainersForSources(room, sources);
  }

  if (options.supportContainers) {
    addSupportContainers(room);
  }

  if (options.foundationRoads) {
    addRoads(room, [
      [25, 22], [25, 23], [25, 24], [22, 25], [23, 25], [24, 25], [26, 25], [27, 25],
      [28, 25], [25, 26], [25, 27], [25, 28],
    ]);
  }

  if (options.backboneRoads) {
    addBackboneRoads(room);
  }

  if (options.extraStructures) {
    for (let i = 0; i < options.extraStructures.length; i++) {
      const spec = options.extraStructures[i];
      room.addStructure(createStructure(spec.type, spec.x, spec.y, Object.assign({ roomName: name }, spec.options || {})));
    }
  }

  if (options.extraSites) {
    for (let i = 0; i < options.extraSites.length; i++) {
      room.createConstructionSite(options.extraSites[i].x, options.extraSites[i].y, options.extraSites[i].type);
    }
  }

  if (options.creeps) {
    for (let i = 0; i < options.creeps.length; i++) {
      const spec = options.creeps[i];
      createCreep(spec.name, spec.role, spec.x, spec.y, {
        roomName: name,
        memory: spec.memory,
        body: spec.body,
        store: spec.store,
        storeCapacity: spec.storeCapacity,
      });
    }
  }

  room.energyAvailable = options.energyAvailable !== undefined ? options.energyAvailable : spawn.store.energy;
  room.energyCapacityAvailable = options.energyCapacityAvailable !== undefined ? options.energyCapacityAvailable : 300;

  return room;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getSiteTypes(room) {
  return room.find(FIND_CONSTRUCTION_SITES).map((site) => site.structureType);
}

const roomState = require("room_state");
const spawnManager = require("spawn_manager");
const constructionManager = require("construction_manager");
const constructionStatus = require("construction_status");
const advancedStructureManager = require("advanced_structure_manager");
const defenseLayout = require("defense_layout");
const logisticsManager = require("logistics_manager");
const utils = require("utils");

function getOccupiedKey(x, y) {
  return `${x}:${y}`;
}

function isOccupied(room, x, y) {
  if (room.getTerrain().get(x, y) === TERRAIN_MASK_WALL) return true;

  const structures = room.find(FIND_STRUCTURES);
  for (let i = 0; i < structures.length; i++) {
    if (structures[i].pos.x === x && structures[i].pos.y === y) return true;
  }

  if (room.controller && room.controller.pos.x === x && room.controller.pos.y === y) {
    return true;
  }

  const sources = room.find(FIND_SOURCES);
  for (let i = 0; i < sources.length; i++) {
    if (sources[i].pos.x === x && sources[i].pos.y === y) return true;
  }

  const minerals = room.find(FIND_MINERALS);
  for (let i = 0; i < minerals.length; i++) {
    if (minerals[i].pos.x === x && minerals[i].pos.y === y) return true;
  }

  return false;
}

function addRoadPath(room, fromPos, toPos, range) {
  const path = fromPos.findPathTo(toPos, { range: range || 1 });
  for (let i = 0; i < path.length; i++) {
    if (!isOccupied(room, path[i].x, path[i].y)) {
      room.addStructure(
        createStructure(STRUCTURE_ROAD, path[i].x, path[i].y, {
          roomName: room.name,
          hits: 5000,
          hitsMax: 5000,
        }),
      );
    }
  }
}

function addBackboneRoads(room) {
  const spawn = room.find(FIND_MY_SPAWNS)[0];
  const controller = room.controller;
  const containers = room.find(FIND_STRUCTURES, {
    filter: function (structure) {
      return structure.structureType === STRUCTURE_CONTAINER;
    },
  });

  for (let i = 0; i < containers.length; i++) {
    addRoadPath(room, spawn.pos, containers[i].pos, 1);
  }

  if (controller) {
    addRoadPath(room, spawn.pos, controller.pos, 2);
  }
}

function pickOpenPositions(room, count, preferredRows) {
  const positions = [];
  const occupied = new Set();
  const structures = room.find(FIND_STRUCTURES);
  const sites = room.find(FIND_CONSTRUCTION_SITES);

  for (let i = 0; i < structures.length; i++) {
    occupied.add(getOccupiedKey(structures[i].pos.x, structures[i].pos.y));
  }
  for (let i = 0; i < sites.length; i++) {
    occupied.add(getOccupiedKey(sites[i].pos.x, sites[i].pos.y));
  }

  const rows = preferredRows || [
    [8, 8, 18, 4],
    [32, 8, 18, 4],
    [8, 38, 18, 4],
    [32, 38, 18, 4],
  ];

  for (let r = 0; r < rows.length && positions.length < count; r++) {
    const [startX, startY, width, height] = rows[r];
    for (let y = startY; y < startY + height && positions.length < count; y++) {
      for (let x = startX; x < startX + width && positions.length < count; x++) {
        const key = getOccupiedKey(x, y);
        if (occupied.has(key) || isOccupied(room, x, y)) continue;
        occupied.add(key);
        positions.push([x, y]);
      }
    }
  }

  return positions;
}

function satisfyDevelopmentRequirements(room) {
  let state = roomState.collect(room);
  const controllerLevel = room.controller ? room.controller.level : 0;
  const desiredExtensions = CONTROLLER_STRUCTURES.extension[controllerLevel] || 0;
  const desiredTowers = CONTROLLER_STRUCTURES.tower[controllerLevel] || 0;

  const existingExtensions = room.find(FIND_STRUCTURES, {
    filter: function (structure) {
      return structure.structureType === STRUCTURE_EXTENSION;
    },
  }).length;
  const extensionPositions = pickOpenPositions(room, desiredExtensions - existingExtensions);
  for (let i = 0; i < extensionPositions.length; i++) {
    room.addStructure(
      createStructure(STRUCTURE_EXTENSION, extensionPositions[i][0], extensionPositions[i][1], {
        roomName: room.name,
        store: { energy: 0 },
        storeCapacityResource: { energy: 50 },
        hits: 1000,
        hitsMax: 1000,
      }),
    );
  }

  const existingTowers = room.find(FIND_STRUCTURES, {
    filter: function (structure) {
      return structure.structureType === STRUCTURE_TOWER;
    },
  }).length;
  const towerPositions = pickOpenPositions(room, desiredTowers - existingTowers, [
    [room.spawn.pos.x + 3, room.spawn.pos.y - 4, 5, 5],
    [room.spawn.pos.x - 7, room.spawn.pos.y - 4, 5, 5],
  ]);
  for (let i = 0; i < towerPositions.length; i++) {
    room.addStructure(
      createStructure(STRUCTURE_TOWER, towerPositions[i][0], towerPositions[i][1], {
        roomName: room.name,
        store: { energy: 800 },
        storeCapacityResource: { energy: 1000 },
        hits: 3000,
        hitsMax: 3000,
      }),
    );
  }

  if (
    controllerLevel >= 4 &&
    room.find(FIND_STRUCTURES, {
      filter: function (structure) {
        return structure.structureType === STRUCTURE_STORAGE;
      },
    }).length === 0
  ) {
    const storagePos = pickOpenPositions(room, 1, [[room.spawn.pos.x - 1, room.spawn.pos.y + 4, 3, 3]])[0];
    if (storagePos) {
      room.addStructure(
        createStructure(STRUCTURE_STORAGE, storagePos[0], storagePos[1], {
          roomName: room.name,
          store: { energy: 100000 },
          storeCapacity: 1000000,
          hits: 10000,
          hitsMax: 10000,
        }),
      );
    }
  }

  state = roomState.collect(room);
  const plan = defenseLayout.getPlan(room, state);
  if (plan) {
    for (let i = 0; i < plan.gates.length; i++) {
      if (!isOccupied(room, plan.gates[i].x, plan.gates[i].y)) {
        room.addStructure(
          createStructure(STRUCTURE_RAMPART, plan.gates[i].x, plan.gates[i].y, {
            roomName: room.name,
            hits: 10000,
            hitsMax: 10000,
          }),
        );
      }
    }

    for (let i = 0; i < plan.walls.length; i++) {
      if (!isOccupied(room, plan.walls[i].x, plan.walls[i].y)) {
        room.addStructure(
          createStructure(STRUCTURE_WALL, plan.walls[i].x, plan.walls[i].y, {
            roomName: room.name,
            hits: 10000,
            hitsMax: 10000,
          }),
        );
      }
    }
  }
}

function runBootstrapScenario() {
  const room = buildRoomScenario("VAL_BOOTSTRAP", {
    tick: 100,
    controllerLevel: 1,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
  });

  const state = roomState.collect(room);
  const requests = spawnManager.getSpawnRequests(room, state);

  assert(state.phase === "bootstrap", `expected bootstrap, got ${state.phase}`);
  assert(requests.length > 0 && requests[0].role === "jrworker", "bootstrap should request jrworkers");
}

function runFoundationScenario() {
  const room = buildRoomScenario("VAL_FOUNDATION", {
    tick: 200,
    controllerLevel: 2,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    creeps: [
      { name: "jr1", role: "jrworker", x: 24, y: 25 },
      { name: "jr2", role: "jrworker", x: 26, y: 25 },
    ],
  });

  const state = roomState.collect(room);
  const requests = spawnManager.getSpawnRequests(room, state);

  assert(state.phase === "foundation", `expected foundation, got ${state.phase}`);
  assert(requests.some((request) => request.role === "worker"), "foundation without containers should request workers");

  constructionManager.plan(room, state);
  const siteTypes = getSiteTypes(room);
  const containerSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter: function (site) {
      return site.structureType === STRUCTURE_CONTAINER;
    },
  });

  assert(
    containerSites.length >= 4,
    `expected source, hub, and controller container sites, got ${containerSites.length}`,
  );
  assert(siteTypes.includes(STRUCTURE_ROAD), "foundation should also place road sites");
}

function runBootstrapHarvestSpreadScenario() {
  const room = buildRoomScenario("VAL_BOOTSTRAP_SPREAD", {
    tick: 250,
    controllerLevel: 1,
    spawnEnergy: 0,
    energyAvailable: 0,
    creeps: [
      { name: "jr1", role: "jrworker", x: 25, y: 24 },
      { name: "jr2", role: "jrworker", x: 25, y: 25 },
      { name: "jr3", role: "jrworker", x: 25, y: 26 },
    ],
  });

  const source = room.find(FIND_SOURCES)[0];
  const creeps = room.find(FIND_MY_CREEPS);

  const keys = [];
  for (let i = 0; i < creeps.length; i++) {
    creeps[i].memory.harvestSourceId = source.id;
    const pos = utils.getAssignedHarvestPosition(creeps[i], source);
    assert(pos, `expected harvest position for ${creeps[i].name}`);
    assert(pos.getRangeTo(source) <= 1, "assigned harvest position must stay adjacent to source");
    keys.push(utils.getHarvestPositionKey(pos));
  }

  const uniqueKeys = Array.from(new Set(keys));
  assert(
    uniqueKeys.length === creeps.length,
    `expected unique harvest positions, got ${keys.join(",")}`,
  );
}

function runBootstrapSpawnCapScenario() {
  const room = buildRoomScenario("VAL_BOOTSTRAP_SPAWN_CAP", {
    tick: 275,
    controllerLevel: 1,
    spawnEnergy: 300,
    energyAvailable: 300,
    creeps: [
      { name: "jr1", role: "jrworker", x: 24, y: 25 },
      { name: "jr2", role: "jrworker", x: 26, y: 25 },
    ],
  });

  const state = roomState.collect(room);
  const requests = spawnManager.getSpawnRequests(room, state);

  assert(state.phase === "bootstrap", `expected bootstrap, got ${state.phase}`);
  assert(
    !requests.some((request) => request.role === "jrworker"),
    "bootstrap at RCL1 should cap the emergency jrworker count instead of endlessly refilling the spawn",
  );
}

function runStorageCapScenario() {
  const room = buildRoomScenario("VAL_STORAGE_CAP", {
    tick: 290,
    controllerLevel: 4,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    creeps: [{ name: "hauler1", role: "hauler", x: 24, y: 25 }],
    extraStructures: [
      {
        type: STRUCTURE_STORAGE,
        x: 26,
        y: 25,
        options: {
          store: { energy: 199999 },
          storeCapacity: 1000000,
          hits: 10000,
          hitsMax: 10000,
        },
      },
    ],
  });

  let state = roomState.collect(room);
  let target = logisticsManager.getHaulerDeliveryTarget(
    room,
    Game.creeps.hauler1,
    state,
  );
  assert(target && target.structureType === STRUCTURE_STORAGE, "storage should accept energy below the cap");

  room.storage.store.energy = 200000;
  state = roomState.collect(room);
  target = logisticsManager.getHaulerDeliveryTarget(
    room,
    Game.creeps.hauler1,
    state,
  );
  assert(target === null, "storage should stop accepting energy once it reaches the configured cap");
}

function runDevelopmentScenario() {
  const room = buildRoomScenario("VAL_DEVELOPMENT", {
    tick: 300,
    controllerLevel: 4,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 550,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "worker1", role: "worker", x: 24, y: 25 },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
      { name: "hauler2", role: "hauler", x: 26, y: 24 },
      { name: "upgrader1", role: "upgrader", x: 24, y: 24 },
    ],
  });

  const state = roomState.collect(room);
  const status = constructionStatus.getStatus(room, state);

  assert(state.phase === "development", `expected development, got ${state.phase}`);
  assert(status.foundationComplete === true, "development scenario should have foundation complete");

  constructionManager.plan(room, state);
  const siteTypes = getSiteTypes(room);
  assert(
    siteTypes.includes(STRUCTURE_EXTENSION) ||
      siteTypes.includes(STRUCTURE_TOWER) ||
      siteTypes.includes(STRUCTURE_STORAGE) ||
      siteTypes.includes(STRUCTURE_ROAD),
    "development should place active buildout sites",
  );
}

function runContainerUsageScenario() {
  const room = buildRoomScenario("VAL_CONTAINER_USAGE", {
    tick: 305,
    controllerLevel: 3,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 550,
    sourceCount: 3,
    sourceContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      {
        type: STRUCTURE_CONTAINER,
        x: 24,
        y: 28,
        options: {
          store: { energy: 600 },
          storeCapacity: 2000,
          hits: 250000,
          hitsMax: 250000,
        },
      },
      {
        type: STRUCTURE_CONTAINER,
        x: 19,
        y: 18,
        options: {
          store: { energy: 400 },
          storeCapacity: 2000,
          hits: 250000,
          hitsMax: 250000,
        },
      },
    ],
    creeps: [
      { name: "worker1", role: "worker", x: 24, y: 25 },
      { name: "upgrader1", role: "upgrader", x: 19, y: 19 },
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
    ],
  });

  const state = roomState.collect(room);
  const status = constructionStatus.getStatus(room, state);
  const workerTarget = logisticsManager.getGeneralEnergyWithdrawalTarget(
    room,
    Game.creeps.worker1,
    state,
  );
  const upgraderTarget = logisticsManager.getUpgraderEnergyWithdrawalTarget(
    room,
    Game.creeps.upgrader1,
    state,
  );
  const haulerTarget = logisticsManager.getHaulerDeliveryTarget(
    room,
    Game.creeps.hauler1,
    state,
  );

  assert(status.sourceContainersNeeded === 3, "three-source room should plan three source containers");
  assert(status.sourceContainersBuilt >= 3, "three-source room should count all built source containers");
  assert(state.hubContainer, "hub container should be classified");
  assert(state.controllerContainer, "controller container should be classified");
  assert(
    workerTarget && workerTarget.id === state.hubContainer.id,
    "workers should prefer the hub container before draining source containers when storage is absent",
  );
  assert(
    upgraderTarget && upgraderTarget.id === state.controllerContainer.id,
    "upgraders should prefer the controller container when it has energy",
  );
  assert(
    haulerTarget && haulerTarget.id === state.controllerContainer.id,
    "haulers should refill the controller container before generic storage work",
  );
}

function runLogisticsScenario() {
  const room = buildRoomScenario("VAL_LOGISTICS", {
    tick: 400,
    controllerLevel: 5,
    spawnEnergy: 300,
    energyAvailable: 550,
    energyCapacityAvailable: 550,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "worker1", role: "worker", x: 24, y: 25 },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
      { name: "hauler2", role: "hauler", x: 26, y: 24 },
      { name: "upgrader1", role: "upgrader", x: 24, y: 24 },
    ],
  });

  satisfyDevelopmentRequirements(room);

  const state = roomState.collect(room);
  const status = constructionStatus.getStatus(room, state);

  assert(state.phase === "logistics", `expected logistics, got ${state.phase}`);
  assert(status.linksNeeded > 0, "logistics should require links");
}

function runSpecializationScenario() {
  const room = buildRoomScenario("VAL_SPECIALIZATION", {
    tick: 500,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "worker1", role: "worker", x: 24, y: 25 },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
      { name: "hauler2", role: "hauler", x: 26, y: 24 },
      { name: "upgrader1", role: "upgrader", x: 24, y: 24 },
    ],
    extraStructures: [
      { type: STRUCTURE_LINK, x: 24, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 16, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 36, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 120000;

  const state = roomState.collect(room);
  let status = constructionStatus.getStatus(room, state);
  assert(state.phase === "specialization", `expected specialization, got ${state.phase}`);
  assert(status.terminalNeeded === 1, "specialization should require a terminal");
  assert(status.mineralContainersNeeded === 1, "specialization should require a mineral container");
  assert(status.extractorNeeded === 1, "specialization should require an extractor");
  assert(status.labsNeeded === 3, "specialization should require an initial lab cluster");

  constructionManager.plan(room, state);
  status = constructionStatus.getStatus(room, state);
  assert(
    status.futurePlan && status.futurePlan.mineralContainerPlanReady,
    "specialization should produce a ready mineral container plan",
  );
}

function runMineralOpsScenario() {
  const room = buildRoomScenario("VAL_MINERAL_OPS", {
    tick: 550,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "hauler1", role: "hauler", x: 25, y: 24, store: {}, storeCapacity: 200 },
    ],
    extraStructures: [
      { type: STRUCTURE_TERMINAL, x: 25, y: 32, options: { store: { energy: 10000 }, storeCapacity: 300000, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_EXTRACTOR, x: 40, y: 10, options: { hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_CONTAINER, x: 39, y: 10, options: { store: { H: 150 }, storeCapacity: 2000, hits: 250000, hitsMax: 250000 } },
      { type: STRUCTURE_LINK, x: 24, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 16, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 36, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 26, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 120000;

  const state = roomState.collect(room);
  const requests = spawnManager.getSpawnRequests(room, state);
  const task = advancedStructureManager.getHaulerTask(room, Game.creeps.hauler1, state);

  assert(state.mineralContainer, "mineral ops scenario should classify the mineral container");
  assert(
    requests.some((request) => request.role === "mineral_miner"),
    `expected a mineral_miner request, got ${JSON.stringify(requests)}`,
  );
  assert(
    task && task.label === "mineral_output",
    `expected mineral_output advanced haul task, got ${task ? task.label : "none"}`,
  );
}

function runFortificationScenario() {
  const room = buildRoomScenario("VAL_FORTIFICATION", {
    tick: 600,
    controllerLevel: 7,
    spawnEnergy: 300,
    energyAvailable: 1200,
    energyCapacityAvailable: 1200,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "worker1", role: "worker", x: 24, y: 25 },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
      { name: "hauler2", role: "hauler", x: 26, y: 24 },
      { name: "upgrader1", role: "upgrader", x: 24, y: 24 },
    ],
    extraStructures: [
      { type: STRUCTURE_TERMINAL, x: 25, y: 32, options: { store: { energy: 10000 }, storeCapacity: 300000, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_CONTAINER, x: 39, y: 10, options: { store: {}, storeCapacity: 2000, hits: 250000, hitsMax: 250000 } },
      { type: STRUCTURE_EXTRACTOR, x: 40, y: 10, options: { hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LINK, x: 24, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 16, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 36, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 26, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LAB, x: 27, y: 32, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LAB, x: 28, y: 33, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LAB, x: 29, y: 32, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LAB, x: 27, y: 34, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LAB, x: 28, y: 35, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LAB, x: 29, y: 34, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 150000;

  const state = roomState.collect(room);
  assert(state.phase === "fortification", `expected fortification, got ${state.phase}`);

  constructionManager.plan(room, state);
  const siteTypes = getSiteTypes(room);
  assert(
    siteTypes.includes(STRUCTURE_FACTORY),
    `fortification should place a factory site, got sites: ${siteTypes.join(",") || "none"}`,
  );
}

function runCommandScenario() {
  const room = buildRoomScenario("VAL_COMMAND", {
    tick: 700,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "worker1", role: "worker", x: 24, y: 25 },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
      { name: "hauler2", role: "hauler", x: 26, y: 24 },
      { name: "upgrader1", role: "upgrader", x: 24, y: 24 },
    ],
    extraStructures: [
      { type: STRUCTURE_TERMINAL, x: 25, y: 32, options: { store: { energy: 30000 }, storeCapacity: 300000, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_CONTAINER, x: 39, y: 10, options: { store: {}, storeCapacity: 2000, hits: 250000, hitsMax: 250000 } },
      { type: STRUCTURE_EXTRACTOR, x: 40, y: 10, options: { hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_FACTORY, x: 27, y: 30, options: { store: { energy: 0 }, storeCapacity: 50000, hits: 1000, hitsMax: 1000, cooldown: 0 } },
      { type: STRUCTURE_LINK, x: 24, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 16, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 36, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 26, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      ...Array.from({ length: 10 }, function (_, index) {
        return {
          type: STRUCTURE_LAB,
          x: 27 + (index % 3),
          y: 33 + Math.floor(index / 3),
          options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 },
        };
      }),
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 200000;

  const state = roomState.collect(room);
  const status = constructionStatus.getStatus(room, state);

  assert(state.phase === "command", `expected command, got ${state.phase}`);
  assert(status.observerNeeded === 1, "command should need observer");
  assert(status.powerSpawnNeeded === 1, "command should need power spawn");
  assert(status.nukerNeeded === 1, "command should need nuker");

  constructionManager.plan(room, state);
  const siteTypes = getSiteTypes(room);
  assert(
    siteTypes.includes(STRUCTURE_OBSERVER) ||
      siteTypes.includes(STRUCTURE_POWER_SPAWN) ||
      siteTypes.includes(STRUCTURE_NUKER),
    `command should place late-game command structure sites, got sites: ${siteTypes.join(",") || "none"}`,
  );
}

function runFactoryOpsScenario() {
  const room = buildRoomScenario("VAL_FACTORY_OPS", {
    tick: 800,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "hauler1", role: "hauler", x: 25, y: 24, store: {}, storeCapacity: 200 },
    ],
    extraStructures: [
      { type: STRUCTURE_FACTORY, x: 27, y: 30, options: { store: { energy: 0 }, storeCapacity: 50000, hits: 1000, hitsMax: 1000, cooldown: 0 } },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 200000;
  room.addStructure(
    createStructure(STRUCTURE_TERMINAL, 25, 32, {
      roomName: room.name,
      store: { energy: 10000 },
      storeCapacity: 300000,
      hits: 3000,
      hitsMax: 3000,
    }),
  );

  const state = roomState.collect(room);
  const summary = advancedStructureManager.getStatus(room, state);
  const task = advancedStructureManager.getHaulerTask(room, Game.creeps.hauler1, state);

  assert(summary.factoryStatus === "ready", `expected factory ready, got ${summary.factoryStatus}`);
  assert(summary.factoryProduct === "battery", `expected battery product, got ${summary.factoryProduct}`);
  assert(
    task && task.label === "factory_energy",
    `expected factory_energy advanced haul task, got ${task ? task.label : "none"} with summary ${JSON.stringify(summary)}`,
  );
}

function main() {
  const scenarios = [
    ["bootstrap", runBootstrapScenario],
    ["foundation", runFoundationScenario],
    ["bootstrap_harvest_spread", runBootstrapHarvestSpreadScenario],
    ["bootstrap_spawn_cap", runBootstrapSpawnCapScenario],
    ["storage_cap", runStorageCapScenario],
    ["development", runDevelopmentScenario],
    ["container_usage", runContainerUsageScenario],
    ["logistics", runLogisticsScenario],
    ["specialization", runSpecializationScenario],
    ["mineral_ops", runMineralOpsScenario],
    ["fortification", runFortificationScenario],
    ["command", runCommandScenario],
    ["factory_ops", runFactoryOpsScenario],
  ];

  const results = [];

  for (let i = 0; i < scenarios.length; i++) {
    const name = scenarios[i][0];
    const run = scenarios[i][1];
    try {
      run();
      results.push({ name: name, status: "PASS" });
    } catch (error) {
      results.push({
        name: name,
        status: "FAIL",
        message: error && error.message ? error.message : String(error),
      });
    }
  }

  for (let i = 0; i < results.length; i++) {
    if (results[i].status === "PASS") {
      console.log(`[PASS] ${results[i].name}`);
    } else {
      console.log(`[FAIL] ${results[i].name}: ${results[i].message}`);
    }
  }

  const failures = results.filter((result) => result.status !== "PASS");
  if (failures.length > 0) {
    process.exitCode = 1;
    return;
  }

  console.log("Solo room harness passed.");
}

main();
