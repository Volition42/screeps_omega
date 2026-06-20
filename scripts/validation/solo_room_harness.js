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
const ERR_NOT_ENOUGH_RESOURCES = -6;
const ERR_INVALID_TARGET = -7;
const ERR_FULL = -8;
const ERR_NOT_IN_RANGE = -9;
const ERR_INVALID_ARGS = -10;
const ERR_TIRED = -11;
const ERR_NO_BODYPART = -12;
const ERR_RCL_NOT_ENOUGH = -14;
const ORDER_BUY = "buy";
const ORDER_SELL = "sell";
const PWR_GENERATE_OPS = "PWR_GENERATE_OPS";
const PWR_OPERATE_SPAWN = "PWR_OPERATE_SPAWN";
const PWR_OPERATE_EXTENSION = "PWR_OPERATE_EXTENSION";
const PWR_OPERATE_TOWER = "PWR_OPERATE_TOWER";
const PWR_OPERATE_STORAGE = "PWR_OPERATE_STORAGE";
const PWR_OPERATE_TERMINAL = "PWR_OPERATE_TERMINAL";
const PWR_OPERATE_FACTORY = "PWR_OPERATE_FACTORY";
const PWR_OPERATE_LAB = "PWR_OPERATE_LAB";
const PWR_OPERATE_POWER = "PWR_OPERATE_POWER";
const PWR_REGEN_SOURCE = "PWR_REGEN_SOURCE";
const PWR_REGEN_MINERAL = "PWR_REGEN_MINERAL";
const POWER_INFO = {
  [PWR_OPERATE_SPAWN]: { ops: 100, range: 3 },
  [PWR_OPERATE_EXTENSION]: { ops: 2, range: 3 },
  [PWR_OPERATE_TOWER]: { ops: 10, range: 3 },
  [PWR_OPERATE_STORAGE]: { ops: 100, range: 3 },
  [PWR_OPERATE_TERMINAL]: { ops: 100, range: 3 },
  [PWR_OPERATE_FACTORY]: { ops: 100, range: 3 },
  [PWR_OPERATE_LAB]: { ops: 10, range: 3 },
  [PWR_OPERATE_POWER]: { ops: 200, range: 3 },
  [PWR_REGEN_SOURCE]: { ops: 0, range: 3 },
  [PWR_REGEN_MINERAL]: { ops: 0, range: 3 },
};

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
const RESOURCE_OPS = "ops";
const RESOURCE_HYDROGEN = "H";
const RESOURCE_OXYGEN = "O";
const RESOURCE_UTRIUM = "U";
const RESOURCE_LEMERGIUM = "L";
const RESOURCE_KEANIUM = "K";
const RESOURCE_ZYNTHIUM = "Z";
const RESOURCE_CATALYST = "X";
const RESOURCE_GHODIUM = "G";
const RESOURCE_SILICON = "silicon";
const RESOURCE_METAL = "metal";
const RESOURCE_BIOMASS = "biomass";
const RESOURCE_MIST = "mist";
const RESOURCE_BATTERY = "battery";

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

const PART_COSTS = {
  [WORK]: 100,
  [CARRY]: 50,
  [MOVE]: 50,
  [ATTACK]: 80,
  [RANGED_ATTACK]: 150,
  [HEAL]: 250,
  [CLAIM]: 600,
  [TOUGH]: 10,
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
  ERR_NOT_ENOUGH_RESOURCES,
  ERR_INVALID_TARGET,
  ERR_FULL,
  ERR_NOT_IN_RANGE,
  ERR_INVALID_ARGS,
  ERR_TIRED,
  ERR_NO_BODYPART,
  ERR_RCL_NOT_ENOUGH,
  ORDER_BUY,
  ORDER_SELL,
  PWR_GENERATE_OPS,
  PWR_OPERATE_SPAWN,
  PWR_OPERATE_EXTENSION,
  PWR_OPERATE_TOWER,
  PWR_OPERATE_STORAGE,
  PWR_OPERATE_TERMINAL,
  PWR_OPERATE_FACTORY,
  PWR_OPERATE_LAB,
  PWR_OPERATE_POWER,
  PWR_REGEN_SOURCE,
  PWR_REGEN_MINERAL,
  POWER_INFO,
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
  RESOURCE_OPS,
  RESOURCE_HYDROGEN,
  RESOURCE_OXYGEN,
  RESOURCE_UTRIUM,
  RESOURCE_LEMERGIUM,
  RESOURCE_KEANIUM,
  RESOURCE_ZYNTHIUM,
  RESOURCE_CATALYST,
  RESOURCE_GHODIUM,
  RESOURCE_SILICON,
  RESOURCE_METAL,
  RESOURCE_BIOMASS,
  RESOURCE_MIST,
  RESOURCE_BATTERY,
  RESOURCES_ALL: [
    RESOURCE_ENERGY,
    RESOURCE_POWER,
    RESOURCE_OPS,
    RESOURCE_HYDROGEN,
    RESOURCE_OXYGEN,
    RESOURCE_UTRIUM,
    RESOURCE_LEMERGIUM,
    RESOURCE_KEANIUM,
    RESOURCE_ZYNTHIUM,
    RESOURCE_CATALYST,
    RESOURCE_GHODIUM,
    RESOURCE_SILICON,
    RESOURCE_METAL,
    RESOURCE_BIOMASS,
    RESOURCE_MIST,
    RESOURCE_BATTERY,
  ],
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

function getBodyCost(body) {
  let cost = 0;

  for (let i = 0; i < body.length; i++) {
    cost += PART_COSTS[body[i]] || 0;
  }

  return cost;
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
    const candidates = Array.isArray(findType)
      ? findType.slice()
      : room.find(findType, options);
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
    this.visual = {
      rect(x, y, width, height, style) {
        currentRuntime.visuals.push({
          roomName: name,
          type: "rect",
          x,
          y,
          width,
          height,
          style: style || {},
        });
        return this;
      },
      text(text, x, y, style) {
        currentRuntime.visuals.push({
          roomName: name,
          type: "text",
          text,
          x,
          y,
          style: style || {},
        });
        return this;
      },
    };
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

  addDroppedResource(resource) {
    resource.room = this;
    resource.pos.roomName = this.name;
    this._dropped.push(resource);
    currentRuntime.objectsById[resource.id] = resource;
    return resource;
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
    const hasMineral = this._minerals.some((item) => item.pos.x === x && item.pos.y === y);
    const borderTiles = (
      structureType !== STRUCTURE_ROAD &&
      structureType !== STRUCTURE_CONTAINER &&
      (x === 1 || x === 48 || y === 1 || y === 48)
    )
      ? (
        x === 1 ? [[0, y - 1], [0, y], [0, y + 1]]
          : x === 48 ? [[49, y - 1], [49, y], [49, y + 1]]
            : y === 1 ? [[x - 1, 0], [x, 0], [x + 1, 0]]
              : [[x - 1, 49], [x, 49], [x + 1, 49]]
      )
      : null;
    if (x < 1 || x > 48 || y < 1 || y > 48) return ERR_INVALID_ARGS;
    if (
      borderTiles &&
      borderTiles.some((tile) => this._terrain.get(tile[0], tile[1]) !== TERRAIN_MASK_WALL)
    ) {
      return ERR_INVALID_TARGET;
    }
    if (
      this._terrain.get(x, y) === TERRAIN_MASK_WALL
      && !(structureType === STRUCTURE_EXTRACTOR && hasMineral)
    ) {
      return ERR_INVALID_TARGET;
    }
    if (structureType === STRUCTURE_EXTRACTOR && !hasMineral) return ERR_INVALID_TARGET;

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
      remove() {
        const idx = this.room ? this.room._sites.findIndex((item) => item.id === this.id) : -1;
        if (idx >= 0) {
          this.room._sites.splice(idx, 1);
        }
        delete currentRuntime.objectsById[this.id];
        return OK;
      },
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
    destroy() {
      const idx = this.room ? this.room._structures.findIndex((item) => item.id === this.id) : -1;
      if (idx >= 0) {
        this.room._structures.splice(idx, 1);
      }
      if (this.room && this.room.storage && this.room.storage.id === this.id) delete this.room.storage;
      if (this.room && this.room.terminal && this.room.terminal.id === this.id) delete this.room.terminal;
      if (this.room && this.room.spawn && this.room.spawn.id === this.id) delete this.room.spawn;
      delete currentRuntime.objectsById[this.id];
      return OK;
    },
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

  if (structureType === STRUCTURE_SPAWN) {
    structure.spawning = spec.spawning || null;
    structure.spawnCreep = function (body, name, options) {
      if (this.spawning) return ERR_BUSY;
      if (Game.creeps[name]) return ERR_NAME_EXISTS;

      const room = this.room;
      const cost = getBodyCost(body || []);
      if (!room || room.energyAvailable < cost) return ERR_NOT_ENOUGH_ENERGY;

      room.energyAvailable -= cost;
      if (room.energyAvailable < 0) room.energyAvailable = 0;

      const memory = options && options.memory ? options.memory : {};
      createCreep(name, memory.role || "worker", this.pos.x, this.pos.y, {
        roomName: room.name,
        memory: memory,
        body: (body || []).map(function (part) {
          return { type: part };
        }),
      });

      this.spawning = {
        name: name,
        needTime: (body || []).length * 3,
        remainingTime: (body || []).length * 3,
      };

      currentRuntime.spawnEvents.push({
        spawnId: this.id,
        spawnName: this.name,
        role: memory.role || null,
        name: name,
        memory: Object.assign({}, memory),
      });

      return OK;
    };
  }

  if (structureType === STRUCTURE_LINK) {
    structure.transferEnergy = function (target, amount) {
      if (!target || !target.store || typeof target.store.getFreeCapacity !== "function") {
        return ERR_INVALID_TARGET;
      }
      if ((this.store[RESOURCE_ENERGY] || 0) <= 0) return ERR_NOT_ENOUGH_ENERGY;
      if (this.cooldown > 0) return ERR_TIRED;
      if (target.store.getFreeCapacity(RESOURCE_ENERGY) <= 0) return ERR_FULL;

      const transferred = Math.min(
        this.store[RESOURCE_ENERGY] || 0,
        amount || this.store[RESOURCE_ENERGY] || 0,
        target.store.getFreeCapacity(RESOURCE_ENERGY),
      );

      this.store[RESOURCE_ENERGY] = (this.store[RESOURCE_ENERGY] || 0) - transferred;
      target.store[RESOURCE_ENERGY] = (target.store[RESOURCE_ENERGY] || 0) + transferred;
      this.cooldown = 1;

      return OK;
    };
  }

  if (structureType === STRUCTURE_TERMINAL) {
    structure.send = function (resourceType, amount, destinationRoomName, description) {
      const destination = currentRuntime.rooms[destinationRoomName] || null;
      const destinationTerminal = destination ? destination.terminal : null;
      const sendAmount = amount || 0;
      const energyCost = Game.map.calcTransactionCost(
        sendAmount,
        this.pos.roomName,
        destinationRoomName,
      );

      if (!destinationTerminal || !destinationTerminal.store) return ERR_INVALID_TARGET;
      if (this.cooldown > 0) return ERR_TIRED;
      if ((this.store[resourceType] || 0) < sendAmount) return ERR_NOT_ENOUGH_RESOURCES;
      if ((this.store[RESOURCE_ENERGY] || 0) < energyCost) return ERR_NOT_ENOUGH_RESOURCES;
      if (destinationTerminal.store.getFreeCapacity(resourceType) < sendAmount) return ERR_FULL;

      this.store[resourceType] = (this.store[resourceType] || 0) - sendAmount;
      this.store[RESOURCE_ENERGY] = (this.store[RESOURCE_ENERGY] || 0) - energyCost;
      destinationTerminal.store[resourceType] =
        (destinationTerminal.store[resourceType] || 0) + sendAmount;
      this.cooldown = 10;
      currentRuntime.terminalSends = currentRuntime.terminalSends || [];
      currentRuntime.terminalSends.push({
        from: this.pos.roomName,
        to: destinationRoomName,
        resourceType: resourceType,
        amount: sendAmount,
        description: description || null,
        energyCost: energyCost,
      });
      return OK;
    };
  }

  if (structureType === STRUCTURE_OBSERVER) {
    structure.observeRoom = function (roomName) {
      currentRuntime.observerActions.push({
        observerId: this.id,
        observerRoom: this.pos.roomName,
        targetRoom: roomName,
        tick: Game.time,
      });
      return OK;
    };
  }

  if (structureType === STRUCTURE_POWER_SPAWN) {
    structure.processPower = function () {
      if (!this.store) return ERR_NOT_ENOUGH_RESOURCES;
      if ((this.store[RESOURCE_POWER] || 0) < 1) return ERR_NOT_ENOUGH_RESOURCES;
      if ((this.store[RESOURCE_ENERGY] || 0) < 50) return ERR_NOT_ENOUGH_RESOURCES;

      this.store[RESOURCE_POWER] -= 1;
      this.store[RESOURCE_ENERGY] -= 50;
      return OK;
    };
    structure.spawnPowerCreep = function (powerCreep) {
      currentRuntime.spawnPowerCreepActions.push({
        powerSpawnId: this.id,
        roomName: this.room ? this.room.name : this.pos.roomName,
        powerCreepName: powerCreep ? powerCreep.name : null,
        tick: Game.time,
      });
      if (!powerCreep) return ERR_INVALID_TARGET;
      if (powerCreep.ticksToLive || powerCreep.room || powerCreep.pos) return ERR_BUSY;

      powerCreep.ticksToLive = 5000;
      powerCreep.pos = new RoomPosition(this.pos.x, this.pos.y, this.pos.roomName);
      Object.defineProperty(powerCreep, "room", {
        enumerable: false,
        configurable: true,
        get() {
          return currentRuntime.rooms[this.pos.roomName] || null;
        },
      });
      return OK;
    };
    structure.renewPowerCreep = function (powerCreep) {
      currentRuntime.renewPowerCreepActions.push({
        powerSpawnId: this.id,
        roomName: this.room ? this.room.name : this.pos.roomName,
        powerCreepName: powerCreep ? powerCreep.name : null,
        tick: Game.time,
      });
      if (!powerCreep || !powerCreep.pos) return ERR_INVALID_TARGET;
      if (powerCreep.pos.getRangeTo(this) > 1) return ERR_NOT_IN_RANGE;

      powerCreep.ticksToLive = Math.max(powerCreep.ticksToLive || 0, 5000);
      return OK;
    };
  }

  if (structureType === STRUCTURE_TOWER) {
    structure.attack = function (target) {
      currentRuntime.towerActions.push({
        towerId: this.id,
        action: "attack",
        targetId: target ? target.id || null : null,
      });
      return OK;
    };
    structure.heal = function (target) {
      currentRuntime.towerActions.push({
        towerId: this.id,
        action: "heal",
        targetId: target ? target.id || null : null,
      });
      return OK;
    };
    structure.repair = function (target) {
      currentRuntime.towerActions.push({
        towerId: this.id,
        action: "repair",
        targetId: target ? target.id || null : null,
      });
      return OK;
    };
  }

  if (structureType === STRUCTURE_FACTORY) {
    structure.produce = function (product) {
      currentRuntime.factoryActions.push({
        factoryId: this.id,
        roomName: this.room ? this.room.name : this.pos.roomName,
        product: product,
        tick: Game.time,
      });
      return OK;
    };
  }

  if (structureType === STRUCTURE_LAB) {
    structure.runReaction = function (inputA, inputB) {
      currentRuntime.labReactionActions.push({
        labId: this.id,
        roomName: this.room ? this.room.name : this.pos.roomName,
        inputA: inputA ? inputA.id : null,
        inputB: inputB ? inputB.id : null,
        tick: Game.time,
      });
      return OK;
    };
  }

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

function createDroppedResource(x, y, options) {
  const spec = options || {};
  return {
    id: spec.id || nextId("resource"),
    type: "resource",
    resourceType: spec.resourceType || RESOURCE_ENERGY,
    amount: spec.amount !== undefined ? spec.amount : 50,
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
    my: !!spec.my,
    owner: spec.owner || null,
    reservation: spec.reservation || null,
    isPowerEnabled: !!spec.isPowerEnabled,
    enableRoom() {
      currentRuntime.enableRoomActions.push({
        roomName: this.room ? this.room.name : this.pos.roomName,
        tick: Game.time,
      });
      return OK;
    },
  };
}

function createCreep(name, role, x, y, options) {
  const spec = options || {};
  const roomName = spec.roomName || "sim";
  const creep = {
    id: spec.id || nextId("creep"),
    name: name,
    my: spec.my !== false,
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
    attack(target) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "attack",
        targetId: target ? target.id || null : null,
      });
      return this.pos.getRangeTo(target) <= 1 ? OK : ERR_NOT_IN_RANGE;
    },
    rangedAttack(target) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "rangedAttack",
        targetId: target ? target.id || null : null,
      });
      return this.pos.getRangeTo(target) <= 3 ? OK : ERR_NOT_IN_RANGE;
    },
    heal(target) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "heal",
        targetId: target ? target.id || null : null,
      });
      return this.pos.getRangeTo(target) <= 1 ? OK : ERR_NOT_IN_RANGE;
    },
    claimController(target) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "claimController",
        targetId: target ? target.id || null : null,
      });
      if (!target || target.type !== "controller") return ERR_INVALID_TARGET;
      if (this.pos.getRangeTo(target) > 1) return ERR_NOT_IN_RANGE;
      if (target.owner && !target.my) return ERR_INVALID_TARGET;
      target.my = true;
      target.owner = { username: "tester" };
      target.user = "tester";
      return OK;
    },
    reserveController(target) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "reserveController",
        targetId: target ? target.id || null : null,
      });
      if (!target || target.type !== "controller") return ERR_INVALID_TARGET;
      if (this.pos.getRangeTo(target) > 1) return ERR_NOT_IN_RANGE;
      if (target.owner && !target.my) return ERR_INVALID_TARGET;
      target.reservation = {
        username: "tester",
        ticksToEnd: Math.min(
          5000,
          ((target.reservation && target.reservation.ticksToEnd) || 0) + 1,
        ),
      };
      return OK;
    },
    attackController(target) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "attackController",
        targetId: target ? target.id || null : null,
      });
      return target && this.pos.getRangeTo(target) <= 1 ? OK : ERR_NOT_IN_RANGE;
    },
    harvest(target) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "harvest",
        targetId: target ? target.id || null : null,
      });
      if (!target || target.energy <= 0) return ERR_NOT_ENOUGH_ENERGY;
      if (this.pos.getRangeTo(target) > 1) return ERR_NOT_IN_RANGE;
      const amount = Math.min(
        target.energy,
        this.store.getFreeCapacity(RESOURCE_ENERGY),
        this.getActiveBodyparts(WORK) * 2 || 2,
      );
      target.energy -= amount;
      this.store[RESOURCE_ENERGY] = (this.store[RESOURCE_ENERGY] || 0) + amount;
      return OK;
    },
    withdraw(target, resourceType) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "withdraw",
        targetId: target ? target.id || null : null,
      });
      if (!target || !target.store) return ERR_INVALID_TARGET;
      if (this.pos.getRangeTo(target) > 1) return ERR_NOT_IN_RANGE;
      const amount = Math.min(
        target.store[resourceType] || 0,
        this.store.getFreeCapacity(resourceType),
      );
      if (amount <= 0) return ERR_NOT_ENOUGH_ENERGY;
      target.store[resourceType] -= amount;
      this.store[resourceType] = (this.store[resourceType] || 0) + amount;
      return OK;
    },
    pickup(target) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "pickup",
        targetId: target ? target.id || null : null,
      });
      if (!target || target.resourceType === undefined) return ERR_INVALID_TARGET;
      if (this.pos.getRangeTo(target) > 1) return ERR_NOT_IN_RANGE;
      const amount = Math.min(
        target.amount || 0,
        this.store.getFreeCapacity(target.resourceType),
      );
      if (amount <= 0) return ERR_NOT_ENOUGH_ENERGY;
      target.amount -= amount;
      this.store[target.resourceType] = (this.store[target.resourceType] || 0) + amount;
      if (target.amount <= 0 && target.room) {
        target.room._dropped = target.room._dropped.filter((item) => item.id !== target.id);
        delete currentRuntime.objectsById[target.id];
      }
      return OK;
    },
    transfer(target, resourceType) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "transfer",
        targetId: target ? target.id || null : null,
      });
      if (!target || !target.store) return ERR_INVALID_TARGET;
      if (this.pos.getRangeTo(target) > 1) return ERR_NOT_IN_RANGE;
      const amount = Math.min(
        this.store[resourceType] || 0,
        target.store.getFreeCapacity(resourceType),
      );
      if (amount <= 0) return ERR_NOT_ENOUGH_ENERGY;
      this.store[resourceType] -= amount;
      target.store[resourceType] = (target.store[resourceType] || 0) + amount;
      return OK;
    },
    build(target) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "build",
        targetId: target ? target.id || null : null,
      });
      if (!target || target.progressTotal === undefined) return ERR_INVALID_TARGET;
      if (this.pos.getRangeTo(target) > 3) return ERR_NOT_IN_RANGE;
      const amount = Math.min(
        this.store[RESOURCE_ENERGY] || 0,
        this.getActiveBodyparts(WORK) * 5 || 5,
        target.progressTotal - target.progress,
      );
      target.progress += amount;
      this.store[RESOURCE_ENERGY] = (this.store[RESOURCE_ENERGY] || 0) - amount;
      return OK;
    },
    upgradeController(target) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "upgradeController",
        targetId: target ? target.id || null : null,
      });
      if (!target || target.type !== "controller") return ERR_INVALID_TARGET;
      if (this.pos.getRangeTo(target) > 3) return ERR_NOT_IN_RANGE;
      const amount = Math.min(
        this.store[RESOURCE_ENERGY] || 0,
        this.getActiveBodyparts(WORK) || 1,
      );
      target.progress = (target.progress || 0) + amount;
      this.store[RESOURCE_ENERGY] = (this.store[RESOURCE_ENERGY] || 0) - amount;
      return OK;
    },
    moveTo(target, options) {
      currentRuntime.creepActions.push({
        creep: this.name,
        action: "moveTo",
        targetId: target && target.id ? target.id : null,
        targetRoom: target && target.pos
          ? target.pos.roomName
          : target && target.roomName
            ? target.roomName
            : null,
        targetX: target && target.pos ? target.pos.x : target && target.x !== undefined ? target.x : null,
        targetY: target && target.pos ? target.pos.y : target && target.y !== undefined ? target.y : null,
        range: options && typeof options.range === "number" ? options.range : null,
      });
      return OK;
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

function createPowerCreep(name, x, y, options) {
  const spec = options || {};
  const spawned = spec.spawned !== false;
  const roomName = spec.roomName || "sim";
  const powerCreep = {
    id: spec.id || nextId("powerCreep"),
    name: name,
    className: spec.className || "operator",
    level: spec.level !== undefined ? spec.level : 1,
    powers: spec.powers || {},
    shard: spec.shard || { name: "shard0" },
    store: createStore(spec.store || {}, null, spec.storeCapacity || 100),
    moveTo(target) {
      currentRuntime.powerCreepMoveActions.push({
        powerCreepName: this.name,
        targetId: target ? target.id || null : null,
        targetType: target ? target.structureType || (target.my ? "controller" : "target") : null,
        targetRoom: target && target.pos ? target.pos.roomName : null,
        tick: Game.time,
      });
      if (!target || !target.pos || !this.pos) return ERR_INVALID_TARGET;
      return OK;
    },
    spawn(powerSpawn) {
      currentRuntime.spawnPowerCreepActions.push({
        powerSpawnId: powerSpawn ? powerSpawn.id : null,
        roomName: powerSpawn && powerSpawn.room
          ? powerSpawn.room.name
          : powerSpawn && powerSpawn.pos
            ? powerSpawn.pos.roomName
            : null,
        powerCreepName: this.name,
        tick: Game.time,
      });
      if (!powerSpawn || powerSpawn.structureType !== STRUCTURE_POWER_SPAWN) return ERR_INVALID_TARGET;
      if (this.ticksToLive || this.room || this.pos) return ERR_BUSY;

      this.ticksToLive = 5000;
      this.pos = new RoomPosition(powerSpawn.pos.x, powerSpawn.pos.y, powerSpawn.pos.roomName);
      Object.defineProperty(this, "room", {
        enumerable: false,
        configurable: true,
        get() {
          return currentRuntime.rooms[this.pos.roomName] || null;
        },
      });
      return OK;
    },
    enableRoom(controller) {
      currentRuntime.enableRoomActions.push({
        roomName: controller && controller.room ? controller.room.name : controller && controller.pos ? controller.pos.roomName : null,
        powerCreepName: this.name,
        tick: Game.time,
      });
      if (!controller || !this.pos) return ERR_INVALID_TARGET;
      if (this.pos.getRangeTo(controller) > 1) return ERR_NOT_IN_RANGE;
      return OK;
    },
    usePower(power, target) {
      currentRuntime.powerCreepUsePowerActions.push({
        powerCreepName: this.name,
        power: power,
        targetId: target ? target.id || null : null,
        targetName: target ? target.name || null : null,
        targetType: target ? target.structureType || (target.my ? "controller" : null) : null,
        targetRoom: target && target.pos ? target.pos.roomName : null,
        tick: Game.time,
      });
      if (!this.pos) return ERR_INVALID_TARGET;
      return OK;
    },
    transfer(target, resourceType, amount) {
      currentRuntime.powerCreepTransferActions.push({
        powerCreepName: this.name,
        resourceType: resourceType,
        amount: amount || null,
        targetId: target ? target.id || null : null,
        targetType: target ? target.structureType || null : null,
        targetRoom: target && target.pos ? target.pos.roomName : null,
        tick: Game.time,
      });
      if (!target || !target.store || !this.pos) return ERR_INVALID_TARGET;
      if (this.pos.getRangeTo(target) > 1) return ERR_NOT_IN_RANGE;
      const transferAmount = Math.min(
        amount || this.store[resourceType] || 0,
        this.store[resourceType] || 0,
        target.store.getFreeCapacity(resourceType),
      );
      if (transferAmount <= 0) return ERR_NOT_ENOUGH_ENERGY;
      this.store[resourceType] -= transferAmount;
      target.store[resourceType] = (target.store[resourceType] || 0) + transferAmount;
      return OK;
    },
  };

  if (spawned) {
    powerCreep.ticksToLive =
      spec.ticksToLive !== undefined ? spec.ticksToLive : 1000;
    powerCreep.pos = new RoomPosition(x, y, roomName);
    Object.defineProperty(powerCreep, "room", {
      enumerable: false,
      configurable: true,
      get() {
        return currentRuntime.rooms[this.pos.roomName] || null;
      },
    });
  }

  currentRuntime.objectsById[powerCreep.id] = powerCreep;
  Game.powerCreeps[powerCreep.name] = powerCreep;
  return powerCreep;
}

function resetRuntime(tick) {
  currentRuntime = {
    nextId: 0,
    rooms: {},
    objectsById: {},
    enableRoomActions: [],
    powerCreepMoveActions: [],
    powerCreepTransferActions: [],
    powerCreepUsePowerActions: [],
    spawnPowerCreepActions: [],
    renewPowerCreepActions: [],
    spawnEvents: [],
    observerActions: [],
    factoryActions: [],
    labReactionActions: [],
    terminalSends: [],
    towerActions: [],
    creepActions: [],
    visuals: [],
  };

  global.Memory = { rooms: {}, creeps: {}, runtime: {}, stats: {} };
  global.Game = {
    time: tick,
    creeps: {},
    powerCreeps: {},
    rooms: currentRuntime.rooms,
    getObjectById(id) {
      return currentRuntime.objectsById[id] || null;
    },
    map: {
      getRoomTerrain(roomName) {
        return currentRuntime.rooms[roomName].getTerrain();
      },
      getRoomLinearDistance(roomA, roomB) {
        const parse = function (roomName) {
          const match = /^([WE])(\d+)([NS])(\d+)$/.exec(roomName || "");
          if (!match) return null;
          return {
            x: (match[1] === "W" ? -1 : 1) * (parseInt(match[2], 10) + (match[1] === "W" ? 1 : 0)),
            y: (match[3] === "N" ? -1 : 1) * (parseInt(match[4], 10) + (match[3] === "N" ? 1 : 0)),
          };
        };
        const a = parse(roomA);
        const b = parse(roomB);
        if (!a || !b) return roomA === roomB ? 0 : 50;
        return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
      },
      describeExits(roomName) {
        const match = /^([WE])(\d+)([NS])(\d+)$/.exec(roomName || "");
        if (!match) return null;

        const shiftAxis = function (direction, value, delta) {
          let coordinate = direction === "W" ? -value - 1 : value;
          coordinate += delta;
          if (coordinate < 0) return { direction: "W", value: -coordinate - 1 };
          return { direction: "E", value: coordinate };
        };
        const shiftVertical = function (direction, value, delta) {
          let coordinate = direction === "N" ? -value - 1 : value;
          coordinate += delta;
          if (coordinate < 0) return { direction: "N", value: -coordinate - 1 };
          return { direction: "S", value: coordinate };
        };
        const x = parseInt(match[2], 10);
        const y = parseInt(match[4], 10);
        const north = shiftVertical(match[3], y, -1);
        const east = shiftAxis(match[1], x, 1);
        const south = shiftVertical(match[3], y, 1);
        const west = shiftAxis(match[1], x, -1);

        return {
          1: `${match[1]}${x}${north.direction}${north.value}`,
          3: `${east.direction}${east.value}${match[3]}${y}`,
          5: `${match[1]}${x}${south.direction}${south.value}`,
          7: `${west.direction}${west.value}${match[3]}${y}`,
        };
      },
      calcTransactionCost(amount, roomA, roomB) {
        return roomA === roomB ? 0 : Math.ceil(amount * 0.1);
      },
    },
    market: {
      calcTransactionCost(amount, roomA, roomB) {
        return Game.map.calcTransactionCost(amount, roomA, roomB);
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

function addRcl4StableStructures(room) {
  satisfyDevelopmentRequirements(room);
  room.energyCapacityAvailable = Math.max(room.energyCapacityAvailable, 1300);
  room.energyAvailable = room.energyCapacityAvailable;
}

function buildRoomScenario(name, options) {
  resetRuntime(options.tick);

  const room = new FakeRoom(name, new FakeTerrain());
  if (options.terrainWalls) {
    for (let i = 0; i < options.terrainWalls.length; i++) {
      room.getTerrain().setWall(options.terrainWalls[i][0], options.terrainWalls[i][1]);
    }
  }
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

  if (options.hostiles) {
    for (let i = 0; i < options.hostiles.length; i++) {
      const spec = options.hostiles[i];
      const hostile = createCreep(
        spec.name || `hostile${i + 1}`,
        spec.role || "hostile",
        spec.x,
        spec.y,
        {
          roomName: name,
          my: false,
          body: spec.body,
          memory: spec.memory || {},
          store: spec.store,
          storeCapacity: spec.storeCapacity,
        },
      );
      hostile.owner = { username: spec.username || "Invader" };
      room._hostileCreeps.push(hostile);
    }
  }

  if (options.droppedResources) {
    for (let i = 0; i < options.droppedResources.length; i++) {
      const spec = options.droppedResources[i];
      room.addDroppedResource(
        createDroppedResource(spec.x, spec.y, Object.assign({ roomName: name }, spec)),
      );
    }
  }

  room.energyAvailable = options.energyAvailable !== undefined ? options.energyAvailable : spawn.store.energy;
  room.energyCapacityAvailable = options.energyCapacityAvailable !== undefined ? options.energyCapacityAvailable : 300;

  return room;
}

function buildOpenEdgeDefenseTerrainWalls() {
  const walls = [];

  for (let x = 0; x <= 49; x++) {
    if (x < 14 || x > 45) walls.push([x, 0]);
    walls.push([x, 49]);
  }
  for (let y = 0; y <= 49; y++) {
    if (y < 9 || y > 46) walls.push([0, y]);
    walls.push([49, y]);
  }
  for (let y = 1; y <= 8; y++) {
    for (let x = 0; x < 14 - y; x++) {
      walls.push([x, y]);
    }
    for (let x = 46; x <= 49; x++) {
      walls.push([x, y]);
    }
  }

  return walls;
}

function buildLeftCorridorDefenseTerrainWalls() {
  const walls = [];

  for (let x = 0; x <= 49; x++) {
    walls.push([x, 0]);
    walls.push([x, 49]);
  }
  for (let y = 0; y <= 49; y++) {
    walls.push([49, y]);
    if (y < 17 || y > 24) {
      walls.push([0, y]);
    }
  }

  return walls;
}

function buildTopSplitDefenseTerrainWalls() {
  const walls = [];

  for (let x = 0; x <= 49; x++) {
    if (x < 18 || x > 26) {
      walls.push([x, 0]);
    }
    walls.push([x, 49]);
  }
  for (let y = 0; y <= 49; y++) {
    walls.push([0, y]);
    walls.push([49, y]);
  }
  for (let x = 21; x <= 23; x++) {
    walls.push([x, 2]);
  }

  return walls;
}

function buildCornerApproachDefenseTerrainWalls() {
  const walls = [];

  for (let x = 0; x <= 49; x++) {
    if (x < 10 || x > 16) {
      walls.push([x, 0]);
    }
    walls.push([x, 49]);
  }
  for (let y = 0; y <= 49; y++) {
    if (y < 10 || y > 16) {
      walls.push([0, y]);
    }
    walls.push([49, y]);
  }

  return walls;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getSiteTypes(room) {
  return room.find(FIND_CONSTRUCTION_SITES).map((site) => site.structureType);
}

function hasHorizontalGatePair(positions, maxY) {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (
        positions[i].y === positions[j].y &&
        Math.abs(positions[i].x - positions[j].x) === 1 &&
        (maxY === undefined || positions[i].y <= maxY)
      ) {
        return true;
      }
    }
  }

  return false;
}

function hasVerticalGatePair(positions, maxX) {
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      if (
        positions[i].x === positions[j].x &&
        Math.abs(positions[i].y - positions[j].y) === 1 &&
        (maxX === undefined || positions[i].x <= maxX)
      ) {
        return true;
      }
    }
  }

  return false;
}

function completeAllSites(room) {
  const sites = room.find(FIND_CONSTRUCTION_SITES).slice();

  for (let i = 0; i < sites.length; i++) {
    const site = sites[i];
    room._sites = room._sites.filter((entry) => entry.id !== site.id);
    delete currentRuntime.objectsById[site.id];
    room.addStructure(
      createStructure(site.structureType, site.pos.x, site.pos.y, {
        roomName: room.name,
      }),
    );
  }
}

const roomState = require("room_state");
const bodies = require("bodies");
const spawnManager = require("spawn_manager");
const constructionManager = require("construction_manager");
const constructionStatus = require("construction_status");
const constructionRoadmap = require("construction_roadmap");
const roomReporting = require("room_reporting");
const empireManager = require("empire_manager");
const reservationManager = require("reservation_manager");
const attackManager = require("attack_manager");
const ops = require("ops");
const powerManager = require("power_manager");
const pclManager = require("pcl_manager");
const powerCreepManager = require("power_creep_manager");
const invasionLog = require("invasion_log");
const creepManager = require("creep_manager");
const hud = require("hud");
const advancedStructureManager = require("advanced_structure_manager");
const defenseManager = require("defense_manager");
const defenseLayout = require("defense_layout");
const linkManager = require("link_manager");
const logisticsManager = require("logistics_manager");
const opsLogisticsManager = require("ops_logistics_manager");
const terminalBalanceManager = require("terminal_balance_manager");
const transferManager = require("transfer_manager");
const observerManager = require("observer_manager");
const marketConsole = require("market_console");
const kernelMemory = require("kernel_memory");
const roleWorker = require("role_worker");
const roleJrWorker = require("role_jrworker");
const roleUpgrader = require("role_upgrader");
const roleRepair = require("role_repair");
const roleClaimer = require("role_claimer");
const rolePioneer = require("role_pioneer");
const roleReserver = require("role_reserver");
const roleRemoteWorker = require("role_remoteworker");
const roleRemoteMiner = require("role_remoteminer");
const roleRemoteHauler = require("role_remotehauler");
const roleDefender = require("role_defender");
const roleHauler = require("role_hauler");
const towerManager = require("tower_manager");
const statsManager = require("stats_manager");
const utils = require("utils");
const config = require("config");
const reservePolicy = require("economy_reserve_policy");
const stamps = require("stamp_library");
const scheduler = require("scheduler");
const marketRequestManager = require("market_request_manager");

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

  const hasControllerContainer = controller && containers.some((structure) => {
    return structure.pos.getRangeTo(controller) <= 4;
  });

  if (controller && !hasControllerContainer) {
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

function runFoundationPartialEconomyScenario() {
  const room = buildRoomScenario("VAL_FOUNDATION_PARTIAL", {
    tick: 210,
    controllerLevel: 2,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    supportContainers: true,
    creeps: [
      { name: "worker1", role: "worker", x: 24, y: 25 },
    ],
  });

  const sources = room.find(FIND_SOURCES);
  room.addStructure(
    createStructure(STRUCTURE_CONTAINER, sources[0].pos.x + 1, sources[0].pos.y, {
      roomName: room.name,
      hits: 250000,
      hitsMax: 250000,
      store: { energy: 1000 },
      storeCapacity: 2000,
    }),
  );

  const state = roomState.collect(room);
  const requests = spawnManager.getSpawnRequests(room, state);

  assert(state.phase === "foundation", `expected foundation, got ${state.phase}`);
  assert(
    requests.some((request) => request.role === "worker"),
    "foundation with only one ready source lane should still request workers",
  );
  assert(
    requests.some((request) => request.role === "miner" && request.sourceId === sources[0].id),
    "foundation should start a miner on the ready source lane",
  );
  assert(
    requests.some((request) => request.role === "hauler" && request.sourceId === sources[0].id),
    "foundation should start hauling from the ready source lane",
  );
  assert(
    !requests.some((request) => request.role === "miner" && request.sourceId === sources[1].id),
    "foundation should not request a miner for an unfinished source lane",
  );
  assert(
    requests.findIndex(
      (request) => request.role === "hauler" && request.sourceId === sources[0].id,
    ) <
      requests.findIndex((request) => request.role === "worker"),
    "foundation should queue the first hauler before generic workers once a source lane is ready",
  );
  assert(
    requests.findIndex(
      (request) => request.role === "hauler" && request.sourceId === sources[0].id,
    ) <
      requests.findIndex((request) => request.role === "upgrader"),
    "foundation should queue the first hauler before upgraders once a source lane is ready",
  );
}

function runFoundationExtensionScenario() {
  const room = buildRoomScenario("VAL_FOUNDATION_EXTENSIONS", {
    tick: 225,
    controllerLevel: 2,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "worker1", role: "worker", x: 30, y: 26 },
      { name: "miner1", role: "miner", x: 40, y: 34, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 30, y: 42, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 31, y: 27 },
    ],
  });

  const state = roomState.collect(room);

  constructionManager.plan(room, state);
  const siteTypes = getSiteTypes(room);

  assert(
    siteTypes.includes(STRUCTURE_EXTENSION),
    `foundation at RCL2 should place extension sites once the backbone is in place, got ${siteTypes.join(",") || "none"}`,
  );
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
      { name: "jr3", role: "jrworker", x: 25, y: 24 },
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

function runFoundationWorkerHarvestSpreadScenario() {
  const room = buildRoomScenario("VAL_FOUNDATION_WORKER_SPREAD", {
    tick: 280,
    controllerLevel: 2,
    spawnEnergy: 0,
    energyAvailable: 0,
    energyCapacityAvailable: 300,
    creeps: [
      { name: "worker1", role: "worker", x: 25, y: 24 },
      { name: "worker2", role: "worker", x: 25, y: 25 },
    ],
  });

  roomState.collect(room);
  const workers = room.find(FIND_MY_CREEPS);

  const targetA = roleWorker.getWithdrawalTarget(workers[0]);
  const targetB = roleWorker.getWithdrawalTarget(workers[1]);

  assert(targetA && targetA.id, "expected first worker to choose a withdrawal target");
  assert(targetB && targetB.id, "expected second worker to choose a withdrawal target");
  assert(
    targetA.id !== targetB.id,
    `expected workers to split across sources, got ${targetA.id} and ${targetB.id}`,
  );

  const sources = room.find(FIND_SOURCES);
  sources[0].energy = 0;

  const refreshed = roleWorker.getWithdrawalTarget(workers[0]);
  assert(
    refreshed && refreshed.id === sources[1].id,
    `expected worker to abandon empty source ${sources[0].id} for ${sources[1].id}, got ${refreshed ? refreshed.id : "none"}`,
  );
}

function runWorkerDroppedEnergyPickupScenario() {
  const room = buildRoomScenario("VAL_WORKER_DROPPED_ENERGY", {
    tick: 285,
    controllerLevel: 2,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    sourceContainers: true,
    supportContainers: true,
    droppedResources: [
      { x: 24, y: 25, amount: 25 },
    ],
    creeps: [
      { name: "workerLoose", role: "worker", x: 25, y: 25 },
    ],
  });
  const state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);

  const worker = Game.creeps.workerLoose;
  roleWorker.run(worker, { thinkInterval: 1 });

  const pickup = currentRuntime.creepActions.find(function (action) {
    return action.creep === "workerLoose" && action.action === "pickup";
  });

  assert(pickup, "expected worker to pick up loose dropped energy before harvesting or withdrawing");
  assert(
    (worker.store[RESOURCE_ENERGY] || 0) > 0,
    `expected worker to carry picked up energy, got ${worker.store[RESOURCE_ENERGY] || 0}`,
  );
}

function runWorkerClosestEnergyBufferScenario() {
  const room = buildRoomScenario("VAL_WORKER_CLOSEST_BUFFER", {
    tick: 287,
    controllerLevel: 4,
    spawnEnergy: 300,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: true,
    creeps: [
      { name: "workerNearSource", role: "worker", x: 17, y: 25 },
    ],
  });
  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 10000;

  const state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  const worker = Game.creeps.workerNearSource;
  const target = roleWorker.getWithdrawalTarget(worker, 1);

  assert(
    target && target.structureType === STRUCTURE_CONTAINER && target.pos.x === 16 && target.pos.y === 25,
    `expected worker to choose nearest source container over farther storage, got ${target ? `${target.structureType}@${target.pos.x},${target.pos.y}` : "none"}`,
  );
}

function runWorkerReserveClosestSkipsStorageScenario() {
  const room = buildRoomScenario("VAL_WORKER_RESERVE_CLOSEST_SKIP", {
    tick: 288,
    controllerLevel: 4,
    spawnEnergy: 300,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: false,
    creeps: [
      { name: "workerReserveNearStorage", role: "worker", x: 24, y: 28 },
    ],
  });
  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 1000;

  const state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  const worker = Game.creeps.workerReserveNearStorage;
  const target = roleWorker.getWithdrawalTarget(worker, 1);

  assert(
    target && target.id !== room.storage.id,
    `expected reserve-mode closest scan to skip protected storage, got ${target ? target.id : "none"}`,
  );
}

function runWorkerEnergyHarvestFallbackScenario() {
  const room = buildRoomScenario("VAL_WORKER_HARVEST_FALLBACK", {
    tick: 289,
    controllerLevel: 2,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    sourceContainers: false,
    supportContainers: false,
    creeps: [
      { name: "workerHarvestFallback", role: "worker", x: 25, y: 25 },
    ],
  });
  const state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  const worker = Game.creeps.workerHarvestFallback;
  const target = roleWorker.getWithdrawalTarget(worker, 1);

  assert(
    target && target.energy !== undefined,
    `expected worker to fall back to direct source harvest, got ${target ? target.id : "none"}`,
  );
}

function runJrWorkerDroppedEnergyPickupScenario() {
  const room = buildRoomScenario("VAL_JRWORKER_DROPPED_ENERGY", {
    tick: 286,
    controllerLevel: 1,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    sourceContainers: true,
    droppedResources: [
      { x: 24, y: 25, amount: 25 },
    ],
    creeps: [
      { name: "jrLoose", role: "jrworker", x: 25, y: 25 },
    ],
  });
  const state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);

  const jrWorker = Game.creeps.jrLoose;
  roleJrWorker.run(jrWorker);

  const pickup = currentRuntime.creepActions.find(function (action) {
    return action.creep === "jrLoose" && action.action === "pickup";
  });

  assert(pickup, "expected jrworker to pick up loose dropped energy before harvesting or withdrawing");
  assert(
    (jrWorker.store[RESOURCE_ENERGY] || 0) > 0,
    `expected jrworker to carry picked up energy, got ${jrWorker.store[RESOURCE_ENERGY] || 0}`,
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
    siteTypes.includes(STRUCTURE_EXTENSION),
    `development should prioritize extension placement, got ${siteTypes.join(",") || "none"}`,
  );
}

function runDevelopmentStoragePriorityScenario() {
  const room = buildRoomScenario("VAL_DEVELOPMENT_STORAGE_PRIORITY", {
    tick: 310,
    controllerLevel: 4,
    spawnEnergy: 300,
    energyAvailable: 550,
    energyCapacityAvailable: 550,
    sourceContainers: true,
    supportContainers: true,
    creeps: [
      { name: "worker1", role: "worker", x: 24, y: 25 },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
      { name: "hauler2", role: "hauler", x: 26, y: 24 },
      { name: "upgrader1", role: "upgrader", x: 24, y: 24 },
    ],
  });

  const extensionPositions = pickOpenPositions(
    room,
    CONTROLLER_STRUCTURES.extension[4] || 0,
  );
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

  const towerPositions = pickOpenPositions(room, CONTROLLER_STRUCTURES.tower[4] || 0, [
    [room.spawn.pos.x + 3, room.spawn.pos.y - 4, 5, 5],
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

  const state = roomState.collect(room);
  const originalMaxSites = config.CONSTRUCTION.MAX_SITES;
  config.CONSTRUCTION.MAX_SITES = 1;

  try {
    constructionManager.plan(room, state);
  } finally {
    config.CONSTRUCTION.MAX_SITES = originalMaxSites;
  }

  const sites = room.find(FIND_CONSTRUCTION_SITES);
  assert(state.phase === "development", `expected development, got ${state.phase}`);
  assert(sites.length === 1, `expected one prioritized site, got ${sites.length}`);
  assert(
    sites[0].structureType === STRUCTURE_STORAGE,
    `expected storage to be placed before extra roads once extensions/tower are ready, got ${sites[0].structureType}`,
  );
}

function runFoundationUpgraderPressureScenario() {
  const room = buildRoomScenario("VAL_FOUNDATION_UPGRADER_PRESSURE", {
    tick: 315,
    controllerLevel: 2,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 550,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    creeps: [
      { name: "worker1", role: "worker", x: 24, y: 25 },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
    ],
  });

  const state = roomState.collect(room);
  const desiredUpgraders = spawnManager.getDesiredUpgraders(room, state);

  assert(state.phase === "foundation", `expected foundation, got ${state.phase}`);
  assert(
    desiredUpgraders >= 2,
    `expected faster early foundation upgrading demand, got ${desiredUpgraders}`,
  );
}

function runCompactExtensionCoreScenario() {
  const room = buildRoomScenario("VAL_EXTENSION_CORE", {
    tick: 300,
    controllerLevel: 5,
    controllerX: 40,
    controllerY: 40,
    spawnEnergy: 300,
    energyAvailable: 550,
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
      { name: "upgrader1", role: "upgrader", x: 24, y: 24 },
    ],
  });

  const originalMaxSites = config.CONSTRUCTION.MAX_SITES;
  config.CONSTRUCTION.MAX_SITES = 100;

  try {
    const state = roomState.collect(room);
    const context = constructionManager.createPlanContext(room, state);
    const plan = constructionManager.getPlanningPlan(
      room,
      state,
      constructionRoadmap.getPlan(state.phase, room.controller.level),
    );
    const memory = constructionManager.getRoomConstructionMemory(room);

    context.planningPlan = plan;
    constructionManager.refreshCoreLayoutPlan(context, plan, memory);
    context.futurePlan = memory.futurePlan;

    const extensionPlan = context.futurePlan && context.futurePlan.extensionStamps
      ? context.futurePlan.extensionStamps
      : null;
    assert(extensionPlan, "expected compact extension plan");
    assert(extensionPlan.origins.length === 3, `expected 3 compact extension pods, got ${extensionPlan.origins.length}`);
    assert(extensionPlan.plannedCapacity === 30, `expected exact compact extension capacity of 30, got ${extensionPlan.plannedCapacity}`);

    constructionManager.placeExtensionStamps(context);

    const extensionSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter(site) {
        return site.structureType === STRUCTURE_EXTENSION;
      },
    });
    const roadSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter(site) {
        return site.structureType === STRUCTURE_ROAD;
      },
    });
    const maxRange = extensionSites.reduce((best, site) => {
      return Math.max(best, room.spawn.pos.getRangeTo(site.pos));
    }, 0);

    assert(extensionSites.length === 30, `expected 30 compact extension sites, got ${extensionSites.length}`);
    assert(roadSites.length === 6, `expected 6 compact extension roads, got ${roadSites.length}`);
    assert(maxRange <= 7, `expected compact extension footprint within range 7, got ${maxRange}`);
  } finally {
    config.CONSTRUCTION.MAX_SITES = originalMaxSites;
  }
}

function runTerrainAwareExtensionPlanScenario() {
  const room = buildRoomScenario("VAL_EXTENSION_TERRAIN", {
    tick: 301,
    controllerLevel: 5,
    controllerX: 40,
    controllerY: 40,
    spawnEnergy: 300,
    energyAvailable: 550,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    terrainWalls: [
      [20, 18],
      [21, 18],
      [22, 18],
      [20, 19],
      [21, 19],
      [22, 19],
      [20, 20],
      [21, 20],
      [22, 20],
      [20, 21],
      [21, 21],
      [22, 21],
    ],
    creeps: [
      { name: "worker1", role: "worker", x: 24, y: 25 },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
      { name: "upgrader1", role: "upgrader", x: 24, y: 24 },
    ],
  });

  const originalMaxSites = config.CONSTRUCTION.MAX_SITES;
  config.CONSTRUCTION.MAX_SITES = 100;

  try {
    const state = roomState.collect(room);
    const context = constructionManager.createPlanContext(room, state);
    const plan = constructionManager.getPlanningPlan(
      room,
      state,
      constructionRoadmap.getPlan(state.phase, room.controller.level),
    );
    const memory = constructionManager.getRoomConstructionMemory(room);

    context.planningPlan = plan;
    constructionManager.refreshCoreLayoutPlan(context, plan, memory);
    context.futurePlan = memory.futurePlan;

    const extensionPlan = context.futurePlan && context.futurePlan.extensionStamps
      ? context.futurePlan.extensionStamps
      : null;
    assert(extensionPlan && extensionPlan.origins.length >= 3, "expected terrain-aware extension plan");
    assert(
      !(extensionPlan.origins[0].x === 21 && extensionPlan.origins[0].y === 19),
      `expected blocked compact pod to be skipped, got ${JSON.stringify(extensionPlan.origins[0])}`,
    );
    assert(
      extensionPlan.plannedCapacity >= 30,
      `expected terrain-aware plan to keep full RCL5 extension capacity, got ${extensionPlan.plannedCapacity}`,
    );

    constructionManager.placeExtensionStamps(context);

    const extensionSites = room.find(FIND_CONSTRUCTION_SITES, {
      filter(site) {
        return site.structureType === STRUCTURE_EXTENSION;
      },
    });

    assert(extensionSites.length === 30, `expected 30 terrain-aware extension sites, got ${extensionSites.length}`);
    assert(
      extensionSites.every((site) => room.spawn.pos.getRangeTo(site.pos) <= 9),
      "expected terrain-aware compact farm to stay near the spawn core",
    );
  } finally {
    config.CONSTRUCTION.MAX_SITES = originalMaxSites;
  }
}

function runControllerRoadDedupScenario() {
  const room = buildRoomScenario("VAL_CONTROLLER_ROAD_DEDUP", {
    tick: 302,
    controllerLevel: 3,
    extraStructures: [
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
  });

  const state = roomState.collect(room);
  const context = constructionManager.createPlanContext(room, state);
  const spawn = room.find(FIND_MY_SPAWNS)[0];

  assert(state.controllerContainer, "controller road dedup scenario should classify the controller container");

  constructionManager.placeBackboneRoads(context);

  const roadSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter(site) {
      return site.structureType === STRUCTURE_ROAD;
    },
  });
  const expectedPath = spawn.pos.findPathTo(state.controllerContainer.pos, {
    ignoreCreeps: true,
    range: 0,
  });
  const expectedKeys = new Set(expectedPath.map((step) => getOccupiedKey(step.x, step.y)));
  const actualKeys = new Set(roadSites.map((site) => getOccupiedKey(site.pos.x, site.pos.y)));

  assert(roadSites.length === expectedPath.length, `expected exactly one controller road path, got ${roadSites.length} sites for ${expectedPath.length} steps`);
  assert(actualKeys.size === expectedKeys.size, "expected unique controller road sites without duplicate lane spread");
  expectedKeys.forEach((key) => {
    assert(actualKeys.has(key), `expected controller road site at ${key}`);
  });
}

function runStampRoadBudgetScenario() {
  const room = buildRoomScenario("VAL_STAMP_ROAD_BUDGET", {
    tick: 303,
    controllerLevel: 6,
    sourceContainers: true,
    supportContainers: true,
  });

  const anchor = stamps.getAnchorOrigin(room, roomState.collect(room));
  const storageOrigin = new RoomPosition(anchor.x, anchor.y + 4, room.name);
  const labOrigin = new RoomPosition(anchor.x, anchor.y + 6, room.name);

  assert(
    constructionStatus.countStampRoadCells(room, anchor, "anchor_v1") === 7,
    "expected minimal anchor stamp road budget of 7",
  );
  assert(
    constructionStatus.countStampRoadCells(room, storageOrigin, "storage_hub_v1") === 4,
    "expected minimal storage hub stamp road budget of 4",
  );
  assert(
    constructionStatus.countStampRoadCells(room, labOrigin, "lab_cluster_v1") === 2,
    "expected minimal lab cluster stamp road budget of 2",
  );
}

function runSharedInternalRoadScenario() {
  const room = buildRoomScenario("VAL_SHARED_INTERNAL_ROADS", {
    tick: 304,
    controllerLevel: 5,
    sourceContainers: true,
    supportContainers: true,
    energyAvailable: 550,
    energyCapacityAvailable: 800,
  });

  const state = roomState.collect(room);
  const context = constructionManager.createPlanContext(room, state);
  const plan = constructionManager.getPlanningPlan(
    room,
    state,
    constructionRoadmap.getPlan(state.phase, room.controller.level),
  );
  const memory = constructionManager.getRoomConstructionMemory(room);
  const spawn = room.find(FIND_MY_SPAWNS)[0];

  context.planningPlan = plan;
  constructionManager.refreshCoreLayoutPlan(context, plan, memory);
  context.futurePlan = memory.futurePlan;

  const extensionOrigins = constructionManager.getPlannedExtensionStampOrigins(context);
  const anchor = constructionManager.getAnchorOrigin(context);
  const desiredTowers = constructionRoadmap.getDesiredTowerCount(room.controller.level);
  const towerOrigins = stamps.getTowerStampOrigins(anchor).slice(0, desiredTowers);

  constructionManager.placeInternalRoads(context);

  const roadSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter(site) {
      return site.structureType === STRUCTURE_ROAD;
    },
  });
  const naiveKeys = new Set();
  const targets = extensionOrigins.concat(
    towerOrigins.map((origin) => new RoomPosition(origin.x, origin.y, origin.roomName)),
  );

  for (let i = 0; i < targets.length; i++) {
    const path = spawn.pos.findPathTo(targets[i], {
      ignoreCreeps: true,
      range: 1,
    });
    for (let j = 0; j < path.length; j++) {
      naiveKeys.add(getOccupiedKey(path[j].x, path[j].y));
    }
  }

  assert(roadSites.length > 0, "expected shared internal roads to place road sites");
  assert(
    roadSites.length < naiveKeys.size,
    `expected shared internal corridor to use fewer roads than star routing, got ${roadSites.length} vs ${naiveKeys.size}`,
  );
}

function runCompactLabPlanScenario() {
  const room = buildRoomScenario("VAL_COMPACT_LABS", {
    tick: 305,
    controllerLevel: 8,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    extraStructures: [
      {
        type: STRUCTURE_STORAGE,
        x: 25,
        y: 29,
        options: {
          store: { energy: 50000 },
          storeCapacity: 1000000,
          hits: 10000,
          hitsMax: 10000,
        },
      },
      {
        type: STRUCTURE_TERMINAL,
        x: 27,
        y: 29,
        options: {
          store: { energy: 10000 },
          storeCapacity: 300000,
          hits: 3000,
          hitsMax: 3000,
        },
      },
    ],
  });

  const state = roomState.collect(room);
  const context = constructionManager.createPlanContext(room, state);
  const labPlan = constructionManager.buildLabPlan(
    context,
    { goals: { advancedStructures: { labs: 10 } } },
    room.storage.pos,
    { pos: constructionManager.serializePos(room.terminal.pos) },
    {},
  );

  assert(labPlan.ready, "expected compact lab plan to be ready");
  assert(
    labPlan.stampName === "lab_compact_v1",
    `expected compact multi-lab stamp, got ${labPlan.stampName || "none"}`,
  );
  assert(
    labPlan.positions.length === 10,
    `expected full compact lab set of 10, got ${labPlan.positions.length}`,
  );

  const positions = labPlan.positions.map((pos) => constructionManager.deserializePos(pos));
  assert(
    positions.every((pos) => room.storage.pos.getRangeTo(pos) <= 4),
    "expected compact lab cluster to stay within range 4 of storage",
  );
}

function runDevelopmentStorageGateScenario() {
  const room = buildRoomScenario("VAL_DEVELOPMENT_STORAGE_GATE", {
    tick: 301,
    controllerLevel: 3,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 550,
  });

  const state = roomState.collect(room);
  state.phase = "development";

  const status = constructionStatus.getStatus(room, state);

  assert(
    status.storageNeeded === 0,
    `storage should stay gated until RCL4, got ${status.storageNeeded}`,
  );
}

function runStoragePlanningRoadConflictScenario() {
  const room = buildRoomScenario("VAL_STORAGE_ROAD_CONFLICT", {
    tick: 302,
    controllerLevel: 4,
    spawnX: 18,
    spawnY: 15,
    controllerX: 23,
    controllerY: 42,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 550,
    extraStructures: [
      { type: STRUCTURE_ROAD, x: 18, y: 20 },
      { type: STRUCTURE_ROAD, x: 23, y: 15 },
      { type: STRUCTURE_ROAD, x: 18, y: 10 },
      { type: STRUCTURE_ROAD, x: 12, y: 14 },
      { type: STRUCTURE_ROAD, x: 13, y: 14 },
      { type: STRUCTURE_ROAD, x: 14, y: 14 },
      { type: STRUCTURE_ROAD, x: 12, y: 15 },
      { type: STRUCTURE_ROAD, x: 14, y: 15 },
      { type: STRUCTURE_ROAD, x: 12, y: 16 },
      { type: STRUCTURE_ROAD, x: 13, y: 16 },
      { type: STRUCTURE_ROAD, x: 14, y: 16 },
    ],
  });

  const state = roomState.collect(room);
  const context = constructionManager.createPlanContext(room, state);

  constructionManager.placeStorage(context);

  const storageSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter: function (site) {
      return site.structureType === STRUCTURE_STORAGE;
    },
  });

  assert(storageSites.length === 1, `expected one storage site, got ${storageSites.length}`);
  assert(
    storageSites[0].pos.x === 18 && storageSites[0].pos.y === 19,
    `expected storage at 18,19, got ${storageSites[0].pos.x},${storageSites[0].pos.y}`,
  );
}

function runStoragePlanningDenseTerrainScenario() {
  const room = buildRoomScenario("VAL_STORAGE_DENSE_TERRAIN", {
    tick: 303,
    controllerLevel: 4,
    controllerX: 40,
    controllerY: 40,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 550,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    terrainWalls: [
      [25, 29],
      [29, 25],
      [21, 25],
      [25, 21],
    ],
  });

  const state = roomState.collect(room);
  const context = constructionManager.createPlanContext(room, state);
  const storagePos = constructionManager.getStoragePlanningPosition(context);

  assert(storagePos, "expected dense terrain room to still find a storage position");
  assert(
    !(
      (storagePos.x === 25 && storagePos.y === 29) ||
      (storagePos.x === 29 && storagePos.y === 25) ||
      (storagePos.x === 21 && storagePos.y === 25) ||
      (storagePos.x === 25 && storagePos.y === 21)
    ),
    `expected planner to move off blocked legacy storage slots, got ${storagePos.x},${storagePos.y}`,
  );
  assert(
    room.spawn.pos.getRangeTo(storagePos) <= 6,
    `expected compact fallback storage position, got range ${room.spawn.pos.getRangeTo(storagePos)}`,
  );

  constructionManager.placeStorage(context);

  const storageSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter(site) {
      return site.structureType === STRUCTURE_STORAGE;
    },
  });

  assert(storageSites.length === 1, `expected one storage site in dense terrain room, got ${storageSites.length}`);
}

function buildHarshStorageTerrainWalls() {
  const walls = [];
  const keep = {
    "25:33": true,
    "24:32": true,
    "25:32": true,
    "26:32": true,
    "24:33": true,
    "26:33": true,
    "24:34": true,
    "25:34": true,
    "26:34": true,
    "23:33": true,
    "27:33": true,
  };

  for (let x = 16; x <= 34; x++) {
    for (let y = 16; y <= 34; y++) {
      const range = Math.max(Math.abs(x - 25), Math.abs(y - 25));
      if (range < 3 || range > 8) continue;
      if (keep[`${x}:${y}`]) continue;
      walls.push([x, y]);
    }
  }

  return walls;
}

function runStoragePlanningHarshTerrainScenario() {
  const room = buildRoomScenario("VAL_STORAGE_HARSH_TERRAIN", {
    tick: 304,
    controllerLevel: 4,
    controllerX: 40,
    controllerY: 40,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 550,
    terrainWalls: buildHarshStorageTerrainWalls(),
  });

  const state = roomState.collect(room);
  const context = constructionManager.createPlanContext(room, state);
  const storagePos = constructionManager.getStoragePlanningPosition(context);
  const storagePlan = constructionManager.getStoragePlanningDebug(context);

  assert(storagePos, "expected harsh terrain room to still find a storage position");
  assert(
    storagePos.x === 25 && storagePos.y === 33,
    `expected harsh terrain fallback storage at 25,33, got ${storagePos.x},${storagePos.y}`,
  );
  assert(
    storagePlan && storagePlan.mode === "fallback",
    `expected harsh terrain storage plan to use fallback mode, got ${storagePlan ? storagePlan.mode : "none"}`,
  );

  constructionManager.placeStorage(context);

  const storageSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter(site) {
      return site.structureType === STRUCTURE_STORAGE;
    },
  });

  assert(storageSites.length === 1, `expected one storage site in harsh terrain room, got ${storageSites.length}`);
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
  assert(status.linksNeeded === 3, `specialization should use the full RCL6 link cap, got ${status.linksNeeded}`);
  assert(status.terminalNeeded === 1, "specialization should require a terminal");
  assert(status.mineralContainersNeeded === 1, "specialization should require a mineral container");
  assert(status.extractorNeeded === 1, "specialization should require an extractor");
  assert(status.labsNeeded === 3, "specialization should require an initial lab cluster");

  constructionManager.plan(room, state);
  const siteTypes = getSiteTypes(room);
  assert(
    !siteTypes.includes(STRUCTURE_LINK),
    `specialization should not try to exceed the RCL6 link cap, got sites: ${siteTypes.join(",") || "none"}`,
  );
  status = constructionStatus.getStatus(room, state);
  assert(
    status.futurePlan && status.futurePlan.mineralContainerPlanReady,
    "specialization should produce a ready mineral container plan",
  );
}

function runExtractorWallMineralScenario() {
  const room = buildRoomScenario("VAL_EXTRACTOR_WALL_MINERAL", {
    tick: 510,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    terrainWalls: [[40, 10]],
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
      { type: STRUCTURE_TERMINAL, x: 25, y: 32, options: { store: { energy: 10000 }, storeCapacity: 300000, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_CONTAINER, x: 39, y: 10, options: { store: {}, storeCapacity: 2000, hits: 250000, hitsMax: 250000 } },
      { type: STRUCTURE_LAB, x: 27, y: 32, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LAB, x: 28, y: 33, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LAB, x: 29, y: 32, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 120000;

  const originalMaxSites = config.CONSTRUCTION.MAX_SITES;
  config.CONSTRUCTION.MAX_SITES = 200;
  let lastState = null;
  let lastStatus = null;

  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      lastState = roomState.collect(room);
      lastStatus = constructionStatus.getStatus(room, lastState);
      constructionManager.plan(room, lastState);

      const extractorSites = room.find(FIND_CONSTRUCTION_SITES, {
        filter(site) {
          return site.structureType === STRUCTURE_EXTRACTOR;
        },
      });

      if (extractorSites.length === 1) {
        assert(
          extractorSites[0].pos.x === 40 && extractorSites[0].pos.y === 10,
          `expected extractor site on wall mineral, got ${JSON.stringify(extractorSites.map((site) => ({ x: site.pos.x, y: site.pos.y, type: site.structureType })))}`,
        );
        return;
      }

      if (room.find(FIND_CONSTRUCTION_SITES).length === 0) break;
      completeAllSites(room);
      Game.time += 60;
    }

    assert(
      false,
      `expected extractor site on wall mineral, got ${JSON.stringify(getSiteTypes(room))} phase=${lastState && lastState.phase} ready=${lastStatus && lastStatus.futurePlan && lastStatus.futurePlan.extractorPlanReady} plan=${JSON.stringify(lastStatus && lastStatus.futurePlan && lastStatus.futurePlan.extractor)}`,
    );
  } finally {
    config.CONSTRUCTION.MAX_SITES = originalMaxSites;
  }
}

function runSpecializationTransitionScenario() {
  const room = buildRoomScenario("VAL_SPECIALIZATION_TRANSITION", {
    tick: 525,
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

  assert(
    state.phase === "specialization",
    `expected specialization transition at RCL6 after logistics links, got ${state.phase}`,
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
      { type: STRUCTURE_LAB, x: 27, y: 32, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LAB, x: 28, y: 33, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LAB, x: 29, y: 32, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 5000;

  const state = roomState.collect(room);
  const requests = spawnManager.getSpawnRequests(room, state);
  const mineralRequest = requests.find((request) => request.role === "mineral_miner");

  assert(state.mineralContainer, "mineral ops scenario should classify the mineral container");
  assert(
    state.buildStatus.specializationComplete,
    "mineral ops scenario should be specialization complete",
  );
  assert(
    mineralRequest,
    `expected a mineral_miner request, got ${JSON.stringify(requests)}`,
  );
  assert(
    mineralRequest.priority === 85,
    `expected mineral_miner priority 85, got ${mineralRequest.priority}`,
  );
}

function runUpgraderReserveScenario() {
  const room = buildRoomScenario("VAL_UPGRADER_RESERVE", {
    tick: 555,
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
      { type: STRUCTURE_TERMINAL, x: 25, y: 32, options: { store: { energy: 60000 }, storeCapacity: 300000, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_CONTAINER, x: 39, y: 10, options: { store: {}, storeCapacity: 2000, hits: 250000, hitsMax: 250000 } },
      { type: STRUCTURE_EXTRACTOR, x: 40, y: 10, options: { hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_FACTORY, x: 27, y: 30, options: { store: { energy: 0 }, storeCapacity: 50000, hits: 1000, hitsMax: 1000, cooldown: 0 } },
      { type: STRUCTURE_LINK, x: 24, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 16, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 36, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 26, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.controller.ticksToDowngrade = 200000;

  room.storage.store.energy = 0;
  let state = roomState.collect(room);
  let lowPlan = bodies.plan("upgrader", room, { role: "upgrader" }, state);
  let lowDesired = spawnManager.getDesiredUpgraders(room, state);
  let lowWorkerDesired = spawnManager.getDesiredWorkers(room, state);
  let lowRepairDesired = spawnManager.getDesiredRepairs(room, state);
  let lowReport = roomReporting.build(room, state, { updateProgress: false });

  assert(
    lowPlan.workParts <= 2,
    `expected low-storage RCL8 upgrader body to stay lean, got ${lowPlan.workParts} work`,
  );
  assert(
    lowPlan.profile !== "controller_link_ready",
    `expected low-storage RCL8 upgrader to avoid controller_link_ready profile, got ${lowPlan.profile}`,
  );
  assert(
    lowDesired === 0,
    `expected low-storage RCL8 upgrader demand to pause for reserve banking, got ${lowDesired}`,
  );
  assert(
    lowWorkerDesired === 0,
    `expected low-storage storage-backed room with no sites to skip workers, got ${lowWorkerDesired}`,
  );
  assert(
    lowRepairDesired === 0,
    `expected low-storage storage-backed room with no repair pressure to skip repairers, got ${lowRepairDesired}`,
  );
  assert(
    lowReport.sections.overview.some((line) => line.indexOf("Upgrade held | Store 0/5000") !== -1),
    `expected reserve-hold line in overview, got ${JSON.stringify(lowReport.sections.overview)}`,
  );

  room.storage.store.energy = 500000;
  state = roomState.collect(room);
  const highPlan = bodies.plan("upgrader", room, { role: "upgrader" }, state);
  const highDesired = spawnManager.getDesiredUpgraders(room, state);

  assert(
    highPlan.workParts > lowPlan.workParts,
    `expected upgrader body to scale with healthy storage, got low ${lowPlan.workParts} high ${highPlan.workParts}`,
  );
  assert(
    highDesired >= lowDesired,
    `expected healthy storage to allow at least as much upgrader demand, got low ${lowDesired} high ${highDesired}`,
  );
}

function buildRcl8GclPushRoom(name, options) {
  const settings = options || {};
  const creeps = settings.creeps || [
    { name: `${name}_worker`, role: "worker", x: 24, y: 25 },
    { name: `${name}_miner1`, role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
    { name: `${name}_miner2`, role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
    { name: `${name}_hauler1`, role: "hauler", x: 25, y: 24 },
    { name: `${name}_hauler2`, role: "hauler", x: 26, y: 24 },
    { name: `${name}_upgrader`, role: "upgrader", x: 21, y: 20, store: { energy: 50 }, memory: { upgrading: true } },
  ];
  const room = buildRoomScenario(name, {
    tick: settings.tick || 556,
    controllerLevel: settings.controllerLevel || 8,
    spawnEnergy: 300,
    energyAvailable: settings.energyAvailable !== undefined ? settings.energyAvailable : 1300,
    energyCapacityAvailable: settings.energyCapacityAvailable !== undefined ? settings.energyCapacityAvailable : 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: creeps,
    extraSites: settings.extraSites || [],
    extraStructures: [
      { type: STRUCTURE_TERMINAL, x: 25, y: 32, options: { store: { energy: settings.terminalEnergy !== undefined ? settings.terminalEnergy : 60000 }, storeCapacity: 300000, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_CONTAINER, x: 39, y: 10, options: { store: {}, storeCapacity: 2000, hits: 250000, hitsMax: 250000 } },
      { type: STRUCTURE_EXTRACTOR, x: 40, y: 10, options: { hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LINK, x: 24, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 16, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 36, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 26, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
    ],
  });
  satisfyDevelopmentRequirements(room);
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  room.controller.ticksToDowngrade =
    settings.ticksToDowngrade !== undefined ? settings.ticksToDowngrade : 200000;
  room.storage.store.energy =
    settings.storageEnergy !== undefined ? settings.storageEnergy : 500000;
  return room;
}

function runRcl8GclPushPolicyScenario() {
  let room = buildRcl8GclPushRoom("VAL_GCL_PUSH_OK", {
    tick: 557,
    storageEnergy: 620000,
  });
  let state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  let status = reservePolicy.getRcl8GclPushStatus(room, state);
  assert(status.eligible, `expected surplus RCL8 room to be eligible, got ${JSON.stringify(status)}`);
  assert(status.threshold === 300000, `expected configured threshold 300000, got ${status.threshold}`);
  assert(
    spawnManager.getDesiredUpgraders(room, state) === reservePolicy.getRcl8GclPushMinUpgraders(),
    `eligible RCL8 room should request configured GCL push upgrader floor, got ${spawnManager.getDesiredUpgraders(room, state)}`,
  );

  roleUpgrader.run(Game.creeps.VAL_GCL_PUSH_OK_upgrader);
  assert(
    currentRuntime.creepActions.some((row) => row.creep === "VAL_GCL_PUSH_OK_upgrader" && row.action === "upgradeController"),
    `eligible upgrader should upgrade, got ${JSON.stringify(currentRuntime.creepActions)}`,
  );

  const coveredRequests = spawnManager.getSpawnRequests(room, state).filter(function (request) {
    return request.role === "upgrader";
  });
  assert(
    coveredRequests.length === 0,
    `eligible RCL8 room with configured upgrader coverage should not over-request, got ${JSON.stringify(coveredRequests)}`,
  );

  const zeroUpgraderRoom = buildRcl8GclPushRoom("VAL_GCL_PUSH_DEMAND", {
    tick: 557,
    storageEnergy: 620000,
    creeps: [
      { name: "demandWorker", role: "worker", x: 24, y: 25 },
      { name: "demandMiner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "demandMiner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "demandHauler1", role: "hauler", x: 25, y: 24 },
      { name: "demandHauler2", role: "hauler", x: 26, y: 24 },
    ],
  });
  let demandState = roomState.collect(zeroUpgraderRoom);
  let demandRequests = spawnManager.getSpawnRequests(zeroUpgraderRoom, demandState);
  let demandUpgraders = demandRequests.filter(function (request) { return request.role === "upgrader"; });
  assert(
    demandUpgraders.length === 1 && demandUpgraders[0].priority === 50,
    `eligible RCL8 room with zero upgraders should request one low-priority surplus upgrader, got ${JSON.stringify(demandRequests)}`,
  );

  const lowRoom = buildRcl8GclPushRoom("VAL_GCL_PUSH_LOW", {
    tick: 558,
    storageEnergy: 180000,
  });
  let lowState = roomState.collect(lowRoom);
  utils.setRoomRuntimeState(lowRoom, lowState);
  status = reservePolicy.getRcl8GclPushStatus(lowRoom, lowState);
  assert(!status.eligible && status.blocker === "reserve-low", `expected reserve-low blocker, got ${JSON.stringify(status)}`);
  assert(spawnManager.getDesiredUpgraders(lowRoom, lowState) === 0, "reserve-low RCL8 room should not request surplus upgraders");
  assert(
    !spawnManager.getSpawnRequests(lowRoom, lowState).some(function (request) { return request.role === "upgrader"; }),
    "reserve-low RCL8 room should not create surplus upgrader spawn demand",
  );
  currentRuntime.creepActions = [];
  roleUpgrader.run(Game.creeps.VAL_GCL_PUSH_LOW_upgrader);
  assert(
    !currentRuntime.creepActions.some((row) => row.action === "upgradeController"),
    `reserve-low upgrader should not upgrade, got ${JSON.stringify(currentRuntime.creepActions)}`,
  );

  const nonRclRoom = buildRcl8GclPushRoom("VAL_GCL_PUSH_RCL7", {
    tick: 559,
    controllerLevel: 7,
    storageEnergy: 620000,
  });
  status = reservePolicy.getRcl8GclPushStatus(nonRclRoom, roomState.collect(nonRclRoom));
  assert(!status.eligible && status.blocker === "not-rcl8", `expected not-rcl8 blocker, got ${JSON.stringify(status)}`);
  assert(
    !spawnManager.getSpawnRequests(nonRclRoom, roomState.collect(nonRclRoom)).some(function (request) {
      return request.role === "upgrader" && request.priority === 50;
    }),
    "non-RCL8 room should not create surplus GCL upgrader demand",
  );

  room = buildRcl8GclPushRoom("VAL_GCL_PUSH_BLOCKERS", {
    tick: 560,
    storageEnergy: 620000,
  });
  state = roomState.collect(room);
  assert(
    reservePolicy.getRcl8GclPushStatus(room, state, { logistics: { state: "aging", haulers: { short: false } } }).blocker === "logistics-starvation",
    "logistics starvation should block GCL push",
  );
  if (!Memory.ops) Memory.ops = {};
  Memory.ops.logistics = {
    requests: {
      old_energy_request: {
        id: "old_energy_request",
        type: "move",
        status: "open",
        roomName: room.name,
        resourceType: RESOURCE_ENERGY,
        amount: 100,
        remaining: 100,
        from: "storage",
        to: "spawn",
        priority: 70,
        claims: {},
        createdAt: Game.time - 200,
        updatedAt: Game.time - 200,
      },
    },
    history: {},
  };
  assert(
    spawnManager.getDesiredUpgraders(room, state) === 0 &&
      !spawnManager.getSpawnRequests(room, state).some(function (request) { return request.role === "upgrader"; }),
    "logistics starvation should suppress surplus GCL upgrader demand",
  );
  Memory.ops.logistics.requests = {};
  Memory.ops.logistics.history = {};
  assert(
    reservePolicy.getRcl8GclPushStatus(room, state, { laborDesired: 2 }).blocker === "labor-deficit",
    "worker labor deficit should block GCL push",
  );
  assert(
    reservePolicy.getRcl8GclPushStatus(room, state, { advanced: { taskLabel: "factory_energy" } }).blocker === "production-energy",
    "factory/lab energy need should block GCL push",
  );
  room.controller.ticksToDowngrade = 1000;
  assert(
    reservePolicy.getRcl8GclPushStatus(room, state).blocker === "downgrade-critical",
    "downgrade protection should still win",
  );

  const buildBlockedRoom = buildRcl8GclPushRoom("VAL_GCL_PUSH_BUILD", {
    tick: 561,
    storageEnergy: 620000,
    extraSites: [{ x: 23, y: 24, type: STRUCTURE_EXTENSION }],
  });
  assert(
    reservePolicy.getRcl8GclPushStatus(buildBlockedRoom, roomState.collect(buildBlockedRoom)).blocker === "critical-construction",
    "critical construction should block GCL push",
  );
  assert(
    !spawnManager.getSpawnRequests(buildBlockedRoom, roomState.collect(buildBlockedRoom)).some(function (request) { return request.role === "upgrader"; }),
    "critical construction should suppress surplus GCL upgrader demand",
  );

  const repairBlockedRoom = buildRcl8GclPushRoom("VAL_GCL_PUSH_REPAIR", {
    tick: 562,
    storageEnergy: 620000,
  });
  repairBlockedRoom.spawn.hits = 100;
  assert(
    reservePolicy.getRcl8GclPushStatus(repairBlockedRoom, roomState.collect(repairBlockedRoom)).blocker === "critical-repair",
    "critical repair should block GCL push",
  );
  assert(
    !spawnManager.getSpawnRequests(repairBlockedRoom, roomState.collect(repairBlockedRoom)).some(function (request) { return request.role === "upgrader"; }),
    "critical repair should suppress surplus GCL upgrader demand",
  );

  const downgradeRoom = buildRcl8GclPushRoom("VAL_GCL_PUSH_DOWNGRADE_PRIORITY", {
    tick: 563,
    storageEnergy: 620000,
    creeps: [
      { name: "downgradeMiner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "downgradeMiner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "downgradeHauler1", role: "hauler", x: 25, y: 24 },
      { name: "downgradeHauler2", role: "hauler", x: 26, y: 24 },
    ],
    extraSites: [{ x: 23, y: 24, type: STRUCTURE_ROAD }],
    ticksToDowngrade: 1000,
  });
  const downgradeRequests = spawnManager.getSpawnRequests(downgradeRoom, roomState.collect(downgradeRoom));
  const downgradeUpgrader = downgradeRequests.find(function (request) { return request.role === "upgrader"; });
  const downgradeWorker = downgradeRequests.find(function (request) { return request.role === "worker"; });
  assert(
    downgradeUpgrader && downgradeWorker && downgradeUpgrader.priority > downgradeWorker.priority,
    `downgrade protection should outrank worker restoration, got ${JSON.stringify(downgradeRequests)}`,
  );

  const impossibleRoom = buildRcl8GclPushRoom("VAL_GCL_PUSH_BODY_GUARD", {
    tick: 564,
    storageEnergy: 620000,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    creeps: [
      { name: "guardWorker", role: "worker", x: 24, y: 25 },
      { name: "guardMiner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "guardMiner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "guardHauler1", role: "hauler", x: 25, y: 24 },
      { name: "guardHauler2", role: "hauler", x: 26, y: 24 },
    ],
  });
  const impossibleState = roomState.collect(impossibleRoom);
  const impossiblePlan = spawnManager.getSpawnBodyPlan(impossibleRoom, impossibleState, { role: "upgrader" });
  assert(
    impossiblePlan.cost <= impossibleRoom.energyCapacityAvailable &&
      bodies.validateBody(impossiblePlan.body).valid,
    `upgrader body guardrail should keep low-capacity plan buildable, got ${JSON.stringify(impossiblePlan)}`,
  );

  const workerBlockedRoom = buildRcl8GclPushRoom("VAL_GCL_PUSH_WORKER_BLOCK", {
    tick: 565,
    storageEnergy: 180000,
    creeps: [
      { name: "blockedWorker", role: "worker", x: 24, y: 28, store: { energy: 50 }, memory: { working: true } },
      { name: "blockedMiner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "blockedMiner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "blockedHauler1", role: "hauler", x: 25, y: 24 },
      { name: "blockedHauler2", role: "hauler", x: 26, y: 24 },
    ],
  });
  const workerBlockedState = roomState.collect(workerBlockedRoom);
  utils.setRoomRuntimeState(workerBlockedRoom, workerBlockedState);
  currentRuntime.creepActions = [];
  roleWorker.run(Game.creeps.blockedWorker);
  assert(
    !currentRuntime.creepActions.some((row) => row.action === "upgradeController") &&
      currentRuntime.creepActions.some((row) => row.action === "transfer" && row.targetId === workerBlockedRoom.storage.id),
    `blocked worker should bank instead of upgrading, got ${JSON.stringify(currentRuntime.creepActions)}`,
  );

  const reportRoom = buildRcl8GclPushRoom("VAL_GCL_PUSH_REPORT", {
    tick: 566,
    storageEnergy: 620000,
    energyAvailable: 300,
    creeps: [
      { name: "reportWorker", role: "worker", x: 24, y: 25 },
      { name: "reportMiner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "reportMiner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "reportHauler1", role: "hauler", x: 25, y: 24 },
      { name: "reportHauler2", role: "hauler", x: 26, y: 24 },
    ],
  });
  spawnManager.run(reportRoom, roomState.collect(reportRoom));
  ops.registerGlobals();
  const capturedRoom = captureConsoleLines(function () {
    return global.ops.room(reportRoom.name, "labor");
  });
  assert(
    capturedRoom.result === `[OPS][${reportRoom.name}][LABOR] report generated` &&
      capturedRoom.lines.some(function (line) {
        return line.indexOf("GCL Push: eligible") !== -1 &&
          line.indexOf("Storage Energy 620,000 / threshold 300,000") !== -1 &&
          line.indexOf("Blocker none") !== -1 &&
          line.indexOf("Upgrade Mode surplus") !== -1;
      }) &&
      capturedRoom.lines.some(function (line) {
        return line.indexOf("GCL Push Demand: desired 1 | current 0") !== -1 &&
          line.indexOf("deficit 1") !== -1 &&
          line.indexOf("demand yes") !== -1;
      }) &&
      capturedRoom.lines.some(function (line) {
        return line.indexOf("GCL Push Body: profile") !== -1 &&
          line.indexOf("priority 50") !== -1;
      }) &&
      capturedRoom.lines.join("\n").indexOf("[object Object]") === -1,
    `room labor report should show printable GCL push state, got ${capturedRoom.lines.join(" / ")}`,
  );

  const capturedEmpire = captureConsoleLines(function () {
    return global.ops.empire("labor");
  });
  assert(
    capturedEmpire.result &&
      capturedEmpire.result.section === "labor" &&
      capturedEmpire.lines.some(function (line) { return line.indexOf("RCL8 GCL rooms") !== -1 && line.indexOf("eligible") !== -1 && line.indexOf("blocked") !== -1; }) &&
      capturedEmpire.lines.some(function (line) { return line.indexOf("GCL push labor gaps") !== -1 && line.indexOf("active demand") !== -1 && line.indexOf("pushing") !== -1; }) &&
      capturedEmpire.lines.some(function (line) { return line.indexOf("GCL push upgrade labor needed") !== -1 && line.indexOf(reportRoom.name) !== -1; }) &&
      capturedEmpire.lines.join("\n").indexOf("[object Object]") === -1,
    `empire labor report should show printable GCL rollup, got ${capturedEmpire.lines.join(" / ")}`,
  );

  const requests = spawnManager.getSpawnRequests(reportRoom, roomState.collect(reportRoom));
  const roles = requests.map(function (request) { return request.role; });
  assert(
    roles.every(function (role) {
      return [
        "jrworker",
        "worker",
        "miner",
        "mineral_miner",
        "hauler",
        "upgrader",
        "repair",
        "defender",
        "claimer",
        "reserver",
        "pioneer",
        "remoteworker",
        "remoteminer",
        "remotehauler",
        "dismantler",
        "assault",
        "combat_healer",
        "controller_attacker",
      ].indexOf(role) !== -1;
    }),
    `GCL push should not create new roles, got ${roles.join(",")}`,
  );
}

function runWorkerReserveBankingScenario() {
  const room = buildRoomScenario("VAL_WORKER_RESERVE_BANKING", {
    tick: 560,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      {
        name: "worker1",
        role: "worker",
        x: 24,
        y: 25,
        store: { energy: 50 },
        memory: { working: true },
      },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
      { name: "hauler2", role: "hauler", x: 26, y: 24 },
    ],
    extraStructures: [
      { type: STRUCTURE_TERMINAL, x: 25, y: 32, options: { store: { energy: 10000 }, storeCapacity: 300000, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_LINK, x: 24, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 16, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 36, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 26, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.controller.ticksToDowngrade = 200000;
  room.storage.store.energy = 0;

  const state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);

  const worker = Game.creeps.worker1;
  const workTarget = roleWorker.getWorkTarget(worker, 1);
  const withdrawTarget = roleWorker.getWithdrawalTarget(worker);

  assert(
    workTarget && workTarget.id === room.storage.id,
    `expected worker reserve mode to bank into storage, got ${workTarget ? workTarget.id : "none"}`,
  );
  assert(
    withdrawTarget && withdrawTarget.id !== room.storage.id,
    "expected worker reserve mode to avoid withdrawing from storage while banking",
  );
}

function runWorkerConstructionBodyScenario() {
  const idleRoom = buildRoomScenario("VAL_WORKER_BODY_IDLE", {
    tick: 562,
    controllerLevel: 8,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
  });
  satisfyDevelopmentRequirements(idleRoom);
  const idleState = roomState.collect(idleRoom);
  const idlePlan = bodies.plan("worker", idleRoom, { role: "worker" }, idleState);

  const buildRoom = buildRoomScenario("VAL_WORKER_BODY_BUILD", {
    tick: 563,
    controllerLevel: 8,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    extraSites: [
      { x: 24, y: 26, type: STRUCTURE_EXTENSION },
    ],
  });
  satisfyDevelopmentRequirements(buildRoom);
  const buildState = roomState.collect(buildRoom);
  const buildPlan = bodies.plan("worker", buildRoom, { role: "worker" }, buildState);

  assert(
    buildPlan.workParts < idlePlan.workParts,
    `expected construction worker body to be smaller than idle body, got build ${buildPlan.workParts} idle ${idlePlan.workParts}`,
  );
  assert(
    buildPlan.workParts <= config.BODIES.workerConstructionMaxWork,
    `expected construction worker body to respect cap ${config.BODIES.workerConstructionMaxWork}, got ${buildPlan.workParts}`,
  );
}

function runWorkerConstructionDemandScenario() {
  const idleRoom = buildRoomScenario("VAL_WORKER_DEMAND_IDLE", {
    tick: 564,
    controllerLevel: 8,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
  });
  satisfyDevelopmentRequirements(idleRoom);
  const idleState = roomState.collect(idleRoom);
  const idleDesired = spawnManager.getDesiredWorkers(idleRoom, idleState);

  const buildRoom = buildRoomScenario("VAL_WORKER_DEMAND_BUILD", {
    tick: 565,
    controllerLevel: 8,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    extraSites: [
      { x: 24, y: 26, type: STRUCTURE_EXTENSION },
      { x: 24, y: 27, type: STRUCTURE_EXTENSION },
      { x: 24, y: 28, type: STRUCTURE_EXTENSION },
    ],
  });
  satisfyDevelopmentRequirements(buildRoom);
  const buildState = roomState.collect(buildRoom);
  const buildDesired = spawnManager.getDesiredWorkers(buildRoom, buildState);

  assert(idleDesired <= 1, `expected idle mature room to avoid worker overspawn, got ${idleDesired}`);
  assert(
    buildDesired > idleDesired && buildDesired >= config.CREEPS.constructionWorkerMin,
    `expected construction room to request more workers, got build ${buildDesired} idle ${idleDesired}`,
  );
}

function runWorkerSpawnSiteCacheScenario() {
  const room = buildRoomScenario("VAL_WORKER_SPAWN_SITE_CACHE", {
    tick: 567,
    controllerLevel: 7,
    spawnEnergy: 300,
    energyAvailable: 2300,
    energyCapacityAvailable: 2300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      {
        name: "worker1",
        role: "worker",
        x: 24,
        y: 25,
        store: { energy: 50 },
        memory: { working: true },
      },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
      { name: "hauler2", role: "hauler", x: 26, y: 24 },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 150000;

  const spawnSiteResult = room.createConstructionSite(
    room.spawn.pos.x + 2,
    room.spawn.pos.y,
    STRUCTURE_SPAWN,
  );
  assert(spawnSiteResult === OK, `expected second spawn site for worker cache test, got ${spawnSiteResult}`);

  const worker = Game.creeps.worker1;
  const spawnSite = room.find(FIND_CONSTRUCTION_SITES, {
    filter(site) {
      return site.structureType === STRUCTURE_SPAWN;
    },
  })[0];
  assert(spawnSite, "expected cached worker spawn site test to create a spawn site");

  worker.memory.workTargetId = spawnSite.id;

  const cachedTarget = roleWorker.getCachedWorkTarget(worker);
  assert(
    cachedTarget && cachedTarget.id === spawnSite.id,
    `expected cached spawn construction site to remain a valid build target, got ${cachedTarget ? cachedTarget.id : "none"}`,
  );

  const liveTarget = roleWorker.getWorkTarget(worker, 1);
  assert(
    liveTarget && liveTarget.id === spawnSite.id,
    `expected worker to keep the spawn construction site as work target, got ${liveTarget ? liveTarget.id : "none"}`,
  );
}

function runWorkerConstructionPriorityConsolidationScenario() {
  const room = buildRoomScenario("VAL_WORKER_CONSTRUCTION_PRIORITY", {
    tick: 571,
    controllerLevel: 3,
    spawnEnergy: 300,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: true,
    creeps: [
      {
        name: "worker1",
        role: "worker",
        x: 25,
        y: 25,
        store: { energy: 50 },
        memory: { working: true },
      },
    ],
  });

  room.addStructure(
    createStructure(STRUCTURE_STORAGE, 24, 27, {
      roomName: room.name,
      store: { energy: 0 },
      storeCapacity: 1000000,
      hits: 10000,
      hitsMax: 10000,
    }),
  );
  room.storage.store.energy = 0;

  let result = room.createConstructionSite(23, 25, STRUCTURE_ROAD);
  assert(result === OK, `expected low-value road site, got ${result}`);
  result = room.createConstructionSite(27, 25, STRUCTURE_TOWER);
  assert(result === OK, `expected critical tower site, got ${result}`);

  let state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);

  const worker = Game.creeps.worker1;
  let target = roleWorker.getConstructionTarget(worker, state, { pressureOnly: true });
  assert(
    target && target.structureType === STRUCTURE_TOWER,
    `critical construction should win over noncritical construction under pressure, got ${target ? target.structureType : "none"}`,
  );

  const road = room.find(FIND_CONSTRUCTION_SITES, {
    filter(site) {
      return site.structureType === STRUCTURE_ROAD;
    },
  })[0];
  worker.memory.workTargetId = road.id;
  const cached = roleWorker.getCachedWorkTarget(worker);
  assert(cached === null, "cached low-value construction target should invalidate under reserve pressure");

  room.find(FIND_CONSTRUCTION_SITES, {
    filter(site) {
      return site.structureType === STRUCTURE_TOWER;
    },
  }).forEach(function (site) {
    site.remove();
  });
  state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  const storageTarget = roleWorker.getWorkTarget(worker, 1);
  assert(
    storageTarget && storageTarget.id === room.storage.id,
    `low-value construction should defer to reserve banking under pressure, got ${storageTarget ? storageTarget.id : "none"}`,
  );

  room.find(FIND_CONSTRUCTION_SITES).forEach(function (site) {
    site.remove();
  });
  room.storage.store.energy = 150000;
  worker.memory.workTargetId = null;

  result = room.createConstructionSite(23, 25, STRUCTURE_EXTENSION);
  assert(result === OK, `expected left extension site, got ${result}`);
  result = room.createConstructionSite(27, 25, STRUCTURE_EXTENSION);
  assert(result === OK, `expected right extension site, got ${result}`);
  state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  target = roleWorker.getConstructionTarget(worker, state);
  assert(
    target && target.pos.x === 23 && target.structureType === STRUCTURE_EXTENSION,
    `construction ordering should be deterministic by priority, range, position, id; got ${target ? target.pos.x + "," + target.pos.y : "none"}`,
  );
}

function runWorkerExtensionFallbackScenario() {
  const room = buildRoomScenario("VAL_WORKER_EXTENSION_FALLBACK", {
    tick: 574,
    controllerLevel: 3,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 500,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      {
        name: "worker1",
        role: "worker",
        x: 24,
        y: 25,
        store: { energy: 50 },
        memory: { working: true },
      },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
    ],
  });

  satisfyDevelopmentRequirements(room);

  const extension = room.find(FIND_MY_STRUCTURES, {
    filter(structure) {
      return structure.structureType === STRUCTURE_EXTENSION;
    },
  })[0];
  assert(extension, "expected worker extension fallback test to have an extension");
  extension.store.energy = 0;

  const state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);

  const worker = Game.creeps.worker1;
  const workTarget = roleWorker.getWorkTarget(worker, 1);

  assert(
    workTarget && workTarget.id === extension.id,
    `expected worker without a hauler to refill an extension, got ${workTarget ? workTarget.id : "none"}`,
  );
}

function runWorkerExtensionFallbackWithHaulerScenario() {
  const room = buildRoomScenario("VAL_WORKER_EXTENSION_WITH_HAULER", {
    tick: 581,
    controllerLevel: 3,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 500,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      {
        name: "worker1",
        role: "worker",
        x: 24,
        y: 25,
        store: { energy: 50 },
        memory: { working: true },
      },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
    ],
  });

  satisfyDevelopmentRequirements(room);

  const extension = room.find(FIND_MY_STRUCTURES, {
    filter(structure) {
      return structure.structureType === STRUCTURE_EXTENSION;
    },
  })[0];
  assert(extension, "expected worker hauler guard test to have an extension");
  extension.store.energy = 0;

  const sitePos = pickOpenPositions(room, 1)[0];
  assert(sitePos, "expected worker hauler guard test to find an open construction position");

  const siteResult = room.createConstructionSite(
    sitePos[0],
    sitePos[1],
    STRUCTURE_ROAD,
  );
  assert(siteResult === OK, `expected worker hauler guard test to create a road site, got ${siteResult}`);

  const site = room.find(FIND_CONSTRUCTION_SITES)[0];
  assert(site, "expected worker hauler guard test to create a construction site");

  const state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);

  const worker = Game.creeps.worker1;
  const workTarget = roleWorker.getWorkTarget(worker, 1);

  assert(
    workTarget && workTarget.id === site.id,
    `expected worker with a hauler present to keep building instead of refilling extensions, got ${workTarget ? workTarget.id : "none"}`,
  );
}

function runTowerBankingThresholdScenario() {
  const room = buildRoomScenario("VAL_TOWER_BANKING", {
    tick: 565,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      {
        name: "hauler1",
        role: "hauler",
        x: 25,
        y: 24,
        store: { energy: 100 },
        memory: { delivering: true },
      },
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
    ],
    extraStructures: [
      { type: STRUCTURE_TOWER, x: 27, y: 25, options: { store: { energy: 300 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_LINK, x: 24, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 16, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 36, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 26, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.controller.ticksToDowngrade = 200000;
  room.storage.store.energy = 0;
  room.find(FIND_MY_STRUCTURES, {
    filter: function (structure) {
      return (
        structure.structureType === STRUCTURE_SPAWN ||
        structure.structureType === STRUCTURE_EXTENSION
      );
    },
  }).forEach(function (structure) {
    structure.store.energy =
      structure.structureType === STRUCTURE_SPAWN ? 300 : 50;
  });

  let state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  let delivery = logisticsManager.getHaulerDeliveryTarget(
    room,
    Game.creeps.hauler1,
    state,
  );

  assert(
    delivery && delivery.id === room.storage.id,
    `expected storage to beat tower reserve fill while banking, got ${delivery ? delivery.id : "none"}`,
  );

  const tower = state.structuresByType[STRUCTURE_TOWER][0];
  tower.store.energy = 100;
  state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  delivery = logisticsManager.getHaulerDeliveryTarget(
    room,
    Game.creeps.hauler1,
    state,
  );

  assert(
    delivery && delivery.id === tower.id,
    `expected tower below banking threshold to remain priority, got ${delivery ? delivery.id : "none"}`,
  );
}

function runRoleTaskEconomyReconciliationScenario() {
  let room = buildRoomScenario("VAL_ROLE_ECON_WORKER", {
    tick: 583,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
  });
  satisfyDevelopmentRequirements(room);
  room.controller.ticksToDowngrade = 200000;
  room.storage.store.energy = 0;
  room.find(FIND_MY_STRUCTURES, {
    filter(structure) {
      return (
        structure.structureType === STRUCTURE_SPAWN ||
        structure.structureType === STRUCTURE_EXTENSION ||
        structure.structureType === STRUCTURE_TOWER
      );
    },
  }).forEach(function (structure) {
    structure.store.energy =
      structure.structureType === STRUCTURE_EXTENSION ? 50 :
        structure.structureType === STRUCTURE_TOWER ? 1000 : 300;
  });

  const roadSitePos = pickOpenPositions(room, 1)[0];
  assert(roadSitePos, "expected an open position for low-priority road site");
  assert(
    room.createConstructionSite(roadSitePos[0], roadSitePos[1], STRUCTURE_ROAD) === OK,
    "expected low-priority road site to be created",
  );
  const roadSite = room.find(FIND_CONSTRUCTION_SITES)[0];
  const worker = createCreep("economyWorker", "worker", room.storage.pos.x, room.storage.pos.y - 1, {
    roomName: room.name,
    store: { energy: 50 },
    memory: { working: true, workTargetId: roadSite.id },
  });
  let state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  assert(roleWorker.getCachedWorkTarget(worker) === null, "worker should reject cached low-priority construction under reserve pressure");
  let requestCountBefore = opsLogisticsManager.listRequests().length;
  let spawnEventsBefore = currentRuntime.spawnEvents.length;
  currentRuntime.creepActions.length = 0;
  roleWorker.run(worker, { thinkInterval: 1 });
  assert(
    !currentRuntime.creepActions.some(function (action) { return action.creep === worker.name && action.action === "build"; }),
    "worker should not spend energy building low-priority road site under reserve pressure",
  );
  assert(
    currentRuntime.creepActions.some(function (action) { return action.creep === worker.name && action.action === "transfer" && action.targetId === room.storage.id; }),
    `worker should bank carried energy in storage under pressure, got ${JSON.stringify(currentRuntime.creepActions)}`,
  );
  assert(opsLogisticsManager.listRequests().length === requestCountBefore, "worker guard must not create logistics requests");
  assert(currentRuntime.spawnEvents.length === spawnEventsBefore, "worker guard must not spawn creeps");

  room = buildRoomScenario("VAL_ROLE_ECON_ORDER", {
    tick: 584,
    controllerLevel: 4,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
  });
  satisfyDevelopmentRequirements(room);
  const orderWorker = createCreep("orderWorker", "worker", 20, 20, {
    roomName: room.name,
    store: { energy: 50 },
    memory: { working: true },
  });
  assert(room.createConstructionSite(19, 20, STRUCTURE_ROAD) === OK, "expected first deterministic road site");
  assert(room.createConstructionSite(21, 20, STRUCTURE_ROAD) === OK, "expected second deterministic road site");
  state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  const orderedTarget = roleWorker.getConstructionTarget(orderWorker, state);
  assert(
    orderedTarget && orderedTarget.pos.x === 19 && orderedTarget.pos.y === 20,
    `expected deterministic construction ordering to choose 19,20, got ${orderedTarget ? `${orderedTarget.pos.x},${orderedTarget.pos.y}` : "none"}`,
  );

  room = buildRoomScenario("VAL_ROLE_ECON_UPGRADER", {
    tick: 585,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
  });
  satisfyDevelopmentRequirements(room);
  room.controller.ticksToDowngrade = 200000;
  room.storage.store.energy = 0;
  const upgrader = createCreep("economyUpgrader", "upgrader", room.storage.pos.x, room.storage.pos.y - 1, {
    roomName: room.name,
    store: { energy: 50 },
    memory: { upgrading: true },
  });
  state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  currentRuntime.creepActions.length = 0;
  roleUpgrader.run(upgrader, { thinkInterval: 1 });
  assert(
    !currentRuntime.creepActions.some(function (action) { return action.creep === upgrader.name && action.action === "upgradeController"; }),
    "upgrader should not spend energy upgrading while RCL8 reserve hold is active",
  );
  assert(
    currentRuntime.creepActions.some(function (action) { return action.creep === upgrader.name && action.action === "transfer" && action.targetId === room.storage.id; }),
    `upgrader should return carried energy to storage under reserve hold, got ${JSON.stringify(currentRuntime.creepActions)}`,
  );

  room = buildRoomScenario("VAL_ROLE_ECON_REPAIR", {
    tick: 586,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
  });
  satisfyDevelopmentRequirements(room);
  room.controller.ticksToDowngrade = 200000;
  room.storage.store.energy = 0;
  const road = room.addStructure(
    createStructure(STRUCTURE_ROAD, room.storage.pos.x + 1, room.storage.pos.y, {
      roomName: room.name,
      hits: 1,
      hitsMax: 5000,
    }),
  );
  const repairer = createCreep("economyRepair", "repair", room.storage.pos.x, room.storage.pos.y - 1, {
    roomName: room.name,
    store: { energy: 50 },
    memory: {
      working: true,
      workTargetId: road.id,
      workTargetKind: "roadRepair",
    },
  });
  state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  assert(roleRepair.getCachedWorkTarget(repairer) === null, "repairer should reject cached noncritical repair under reserve pressure");
  currentRuntime.creepActions.length = 0;
  roleRepair.run(repairer);
  assert(
    !currentRuntime.creepActions.some(function (action) { return action.creep === repairer.name && (action.action === "repair" || action.action === "build" || action.action === "upgradeController"); }),
    `repairer should avoid noncritical energy spend under pressure, got ${JSON.stringify(currentRuntime.creepActions)}`,
  );
  assert(
    currentRuntime.creepActions.some(function (action) { return action.creep === repairer.name && action.action === "transfer" && action.targetId === room.storage.id; }),
    `repairer should bank carried energy in storage under pressure, got ${JSON.stringify(currentRuntime.creepActions)}`,
  );

  room = buildOpsLogisticsRoom("VAL_ROLE_ECON_HAULER_STALE", {
    tick: 587,
    storageStore: { energy: 1000 },
    terminalStore: { energy: 1000 },
  });
  const hauler = createCreep("economyHauler", "hauler", room.storage.pos.x, room.storage.pos.y, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  const request = opsLogisticsManager.createMoveRequest(RESOURCE_ENERGY, 50, room.name, "storage", "terminal");
  assert(request.ok, `expected ops logistics request, got ${request.message}`);
  assert(opsLogisticsManager.getHaulerTask(room, hauler), "expected hauler to claim ops request before target became stale");
  room.terminal.store.energy = 300000;
  currentRuntime.creepActions.length = 0;
  assert(roleHauler.runOpsLogisticsRequest(hauler, 1) === false, "stale full delivery target should abort assigned ops task");
  assert(!hauler.memory.opsLogisticsTask, "stale ops logistics task should be cleared from hauler memory");
  assert(request.request.status === "blocked", `stale full target should block request, got ${request.request.status}`);
  assert(request.request.reason === "target_full", `stale full target should record target_full, got ${request.request.reason}`);
  assert(
    !currentRuntime.creepActions.some(function (action) { return action.creep === hauler.name && (action.action === "withdraw" || action.action === "transfer"); }),
    `hauler should not withdraw or transfer for stale ops target, got ${JSON.stringify(currentRuntime.creepActions)}`,
  );

  room = buildOpsLogisticsRoom("VAL_ROLE_ECON_HAULER_EMPTY", {
    tick: 588,
    storageStore: { energy: 1000 },
    terminalStore: { energy: 1000 },
  });
  const emptyHauler = createCreep("economyHaulerEmpty", "hauler", room.storage.pos.x, room.storage.pos.y, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  const emptyRequest = opsLogisticsManager.createMoveRequest(RESOURCE_ENERGY, 50, room.name, "storage", "terminal");
  assert(emptyRequest.ok, `expected empty-source ops logistics request, got ${emptyRequest.message}`);
  assert(opsLogisticsManager.getHaulerTask(room, emptyHauler), "expected hauler to claim request before source emptied");
  room.storage.store.energy = 0;
  currentRuntime.creepActions.length = 0;
  assert(roleHauler.runOpsLogisticsRequest(emptyHauler, 1) === false, "stale empty source should abort assigned ops task");
  assert(!emptyHauler.memory.opsLogisticsTask, "empty-source ops task should be cleared from hauler memory");
  assert(emptyRequest.request.status === "blocked", `empty source should block request, got ${emptyRequest.request.status}`);
  assert(emptyRequest.request.reason === "source_empty", `empty source should record source_empty, got ${emptyRequest.request.reason}`);
  assert(
    !currentRuntime.creepActions.some(function (action) { return action.creep === emptyHauler.name && (action.action === "withdraw" || action.action === "transfer"); }),
    `hauler should not withdraw or transfer from empty stale source, got ${JSON.stringify(currentRuntime.creepActions)}`,
  );
}

function runRoleIntentWasteDiagnosticsScenario() {
  const room = buildOpsLogisticsRoom("VAL_ROLE_INTENT", {
    tick: 589,
    storageStore: { energy: 1000 },
    terminalStore: { energy: 1000 },
  });
  room.storage.store.energy = 0;
  room.controller.ticksToDowngrade = 200000;

  assert(room.createConstructionSite(19, 20, STRUCTURE_ROAD) === OK, "expected deterministic role intent road site");
  const site = room.find(FIND_CONSTRUCTION_SITES)[0];
  const road = room.addStructure(
    createStructure(STRUCTURE_ROAD, 20, 21, {
      roomName: room.name,
      hits: 1,
      hitsMax: 5000,
    }),
  );

  const workerA = createCreep("intentWorkerA", "worker", 20, 20, {
    roomName: room.name,
    store: { energy: 50 },
    memory: { working: true, workTargetId: site.id },
  });
  createCreep("intentWorkerB", "worker", 21, 20, {
    roomName: room.name,
    store: { energy: 50 },
    memory: { working: true, workTargetId: site.id },
  });
  createCreep("intentIdle", "worker", 22, 20, {
    roomName: room.name,
    store: {},
    memory: { working: false },
  });
  const repairer = createCreep("intentRepair", "repair", 24, 27, {
    roomName: room.name,
    store: { energy: 50 },
    memory: {
      working: true,
      workTargetId: road.id,
      workTargetKind: "roadRepair",
    },
  });
  const upgrader = createCreep("intentUpgrader", "upgrader", 24, 26, {
    roomName: room.name,
    store: { energy: 50 },
    memory: { upgrading: true },
  });
  const hauler = createCreep("intentHauler", "hauler", room.storage.pos.x, room.storage.pos.y, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });

  let state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  assert(roleWorker.getCachedWorkTarget(workerA) === null, "worker cached target should defer under reserve pressure");
  assert(roleRepair.getCachedWorkTarget(repairer) === null, "repair cached target should defer under reserve pressure");
  roleUpgrader.run(upgrader, { thinkInterval: 1 });

  room.storage.store.energy = 1000;
  const request = opsLogisticsManager.createMoveRequest(RESOURCE_ENERGY, 50, room.name, "storage", "terminal");
  assert(request.ok, `expected role intent ops logistics request, got ${request.message}`);
  assert(opsLogisticsManager.getHaulerTask(room, hauler), "expected role intent hauler to claim ops request");
  room.terminal.store.energy = 300000;
  assert(roleHauler.runOpsLogisticsRequest(hauler, 1) === false, "role intent stale target should release ops task");

  workerA.memory.working = true;
  workerA.memory.workTargetId = site.id;
  Game.creeps.intentWorkerB.memory.working = true;
  Game.creeps.intentWorkerB.memory.workTargetId = site.id;
  repairer.memory.working = true;
  repairer.memory.workTargetId = road.id;
  repairer.memory.workTargetKind = "roadRepair";
  upgrader.memory.upgrading = true;

  state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  const requestCountBefore = opsLogisticsManager.listRequests(room.name).length;
  const spawnEventsBefore = currentRuntime.spawnEvents.length;
  ops.registerGlobals();
  const captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "roles");
  });

  assert(
    captured.lines.some(function (line) { return line === `[OPS][${room.name}][ROLES]`; }),
    `expected roles section header, got ${captured.lines.join(" / ")}`,
  );
  assert(
    captured.lines.some(function (line) {
      return line.indexOf("Creeps: 6") !== -1 &&
        line.indexOf("Active: 4") !== -1 &&
        line.indexOf("Idle: 2") !== -1;
    }),
    `expected active and idle creep counts, got ${captured.lines.join(" / ")}`,
  );
  assert(
    captured.lines.some(function (line) {
      return line.indexOf("Energy Spend:") === 0 &&
        line.indexOf("build: 2") !== -1 &&
        line.indexOf("repair-noncritical: 1") !== -1 &&
        line.indexOf("upgrade: 1") !== -1 &&
        line.indexOf("idle: 2") !== -1;
    }),
    `expected energy-spend categories, got ${captured.lines.join(" / ")}`,
  );
  assert(
    captured.lines.some(function (line) {
      return line.indexOf("Deferred:") === 0 &&
        line.indexOf("construction-reserve-pressure: 1") !== -1 &&
        line.indexOf("repair-reserve-pressure: 1") !== -1 &&
        line.indexOf("upgrade-reserve-pressure: 1") !== -1;
    }),
    `expected deferred categories, got ${captured.lines.join(" / ")}`,
  );
  assert(
    captured.lines.some(function (line) {
      return line.indexOf("Stale Releases:") === 0 &&
        line.indexOf("ops-full-target: 1") !== -1 &&
        line.indexOf("cached-invalid-target: 2") !== -1;
    }),
    `expected stale release categories, got ${captured.lines.join(" / ")}`,
  );
  assert(
    captured.lines.some(function (line) {
      return line.indexOf("Contention:") === 0 &&
        line.indexOf("construction-site " + site.id + ": 2 creeps") !== -1;
    }),
    `expected construction contention summary, got ${captured.lines.join(" / ")}`,
  );
  assert(
    captured.lines.some(function (line) { return line === "Largest Sink: build"; }),
    `expected deterministic largest sink, got ${captured.lines.join(" / ")}`,
  );
  assert(
    captured.lines.every(function (line) { return line.indexOf("[object Object]") === -1; }),
    `roles report should be printable, got ${captured.lines.join(" / ")}`,
  );
  assert(
    JSON.stringify(Memory.rooms[room.name].roleIntent).length < 500,
    `role intent diagnostic memory should stay compact, got ${JSON.stringify(Memory.rooms[room.name].roleIntent)}`,
  );
  assert(
    opsLogisticsManager.listRequests(room.name).length === requestCountBefore,
    "role intent report must not create or delete logistics requests",
  );
  assert(
    currentRuntime.spawnEvents.length === spawnEventsBefore,
    "role intent report must not change spawn policy",
  );
  assert(
    currentRuntime.terminalSends.length === 0 &&
      currentRuntime.powerCreepUsePowerActions.length === 0 &&
      currentRuntime.towerActions.length === 0,
    "role intent report must not introduce market, terminal, power, or combat actions",
  );
}

function runMineralMiningBlockedScenario() {
  const room = buildRoomScenario("VAL_MINERAL_BLOCKED", {
    tick: 575,
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
      { type: STRUCTURE_EXTRACTOR, x: 40, y: 10, options: { hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_CONTAINER, x: 39, y: 10, options: { store: {}, storeCapacity: 2000, hits: 250000, hitsMax: 250000 } },
      { type: STRUCTURE_LINK, x: 24, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 16, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 36, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 120000;

  const state = roomState.collect(room);
  const requests = spawnManager.getSpawnRequests(room, state);

  assert(
    state.phase === "specialization",
    `expected specialization phase, got ${state.phase}`,
  );
  assert(
    !state.buildStatus.specializationComplete,
    "mineral blocked scenario should not be specialization complete",
  );
  assert(
    !requests.some((request) => request.role === "mineral_miner"),
    `did not expect a mineral_miner request before specialization complete, got ${JSON.stringify(requests)}`,
  );
}

function runMineralAccessRoadScenario() {
  const room = buildRoomScenario("VAL_MINERAL_ACCESS_ROAD", {
    tick: 590,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "hauler1", role: "hauler", x: 25, y: 24 },
    ],
    extraStructures: [
      { type: STRUCTURE_TERMINAL, x: 25, y: 32, options: { store: { energy: 10000 }, storeCapacity: 300000, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_EXTRACTOR, x: 40, y: 10, options: { hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_CONTAINER, x: 39, y: 10, options: { store: {}, storeCapacity: 2000, hits: 250000, hitsMax: 250000 } },
      { type: STRUCTURE_LINK, x: 24, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 16, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 36, y: 25, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 26, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LAB, x: 27, y: 32, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LAB, x: 28, y: 33, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LAB, x: 29, y: 32, options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 } },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 10000;

  const mineral = room.find(FIND_MINERALS)[0];
  createCreep("mineral1", "mineral_miner", 39, 10, {
    roomName: room.name,
    memory: { targetId: mineral.id },
    body: [{ type: WORK }, { type: WORK }, { type: MOVE }],
  });

  let state = roomState.collect(room);
  let status = constructionStatus.getStatus(room, state);

  assert(
    status.mineralAccessRoadsNeeded > status.mineralAccessRoadsBuilt,
    `expected pending mineral access road, got ${status.mineralAccessRoadsBuilt}/${status.mineralAccessRoadsNeeded} phase=${state.phase} unlocked=${constructionStatus.isMineralAccessRoadUnlocked(room, state)} mineralContainer=${!!state.mineralContainer} storage=${!!room.storage} roleCounts=${JSON.stringify(state.roleCounts)}`,
  );

  constructionManager.plan(room, state);

  const roadSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter(site) {
      return site.structureType === STRUCTURE_ROAD;
    },
  });
  assert(
    roadSites.length > 0,
    "expected mineral access road sites after mineral miner became active",
  );

  state = roomState.collect(room);
  status = constructionStatus.getStatus(room, state);
  const report = roomReporting.build(room, state, { updateProgress: false });

  assert(
    report.nextTask === "finish mineral access road",
    `expected mineral access road next task, got ${report.nextTask}`,
  );
  assert(
    report.sections.build[2].indexOf("mRoad ") !== -1,
    `expected build section to include mineral access road progress, got ${report.sections.build[2]}`,
  );
  assert(
    report.sections.overview.some((line) => line.indexOf("Road ") !== -1),
    `expected overview to mention mineral road progress, got ${JSON.stringify(report.sections.overview)}`,
  );
  assert(
    report.hudLines.some(function (line) { return line.indexOf("Road ") !== -1; }),
    `expected HUD line to mention mineral road progress, got ${JSON.stringify(report.hudLines)}`,
  );
  assert(
    report.hudLines[0].indexOf("RCL") === -1 &&
      report.hudLines[1].indexOf("RCL") === 0 &&
      report.hudLines[1].indexOf("ETA") !== -1,
    `expected HUD to put RCL/ETA on second line, got ${JSON.stringify(report.hudLines)}`,
  );

  delete Game.creeps.mineral1;
  state = roomState.collect(room);
  status = constructionStatus.getStatus(room, state);

  assert(
    status.mineralAccessRoadsNeeded > 0,
    "expected mineral access road target to stay unlocked after mineral miner activity",
  );
}

function runDefenseBorderSupportScenario() {
  const room = buildRoomScenario("VAL_DEFENSE_BORDER_SUPPORT", {
    tick: 588,
    controllerLevel: 4,
    spawnX: 32,
    spawnY: 26,
    controllerX: 6,
    controllerY: 6,
    sourceAX: 41,
    sourceAY: 33,
    sourceBX: 31,
    sourceBY: 43,
    mineralX: 11,
    mineralY: 35,
    terrainWalls: buildOpenEdgeDefenseTerrainWalls(),
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 32, y: 30, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
    ],
  });

  const anchor = new RoomPosition(32, 30, room.name);
  const plan = defenseLayout.getPlanForAnchor(room, anchor);

  assert(plan, "expected defense plan for open-edge room");
  assert(
    !plan.walls.some((pos) => pos.y === 1) && !plan.gates.some((pos) => pos.y === 1),
    `expected border-adjacent top defense tiles to be skipped, got walls=${JSON.stringify(plan.walls)} gates=${JSON.stringify(plan.gates)}`,
  );
  assert(
    hasHorizontalGatePair(plan.gates, 10),
    `expected top-side gate coverage away from the border, got ${JSON.stringify(plan.gates)}`,
  );
  assert(
    room.createConstructionSite(31, 1, STRUCTURE_RAMPART) === ERR_INVALID_TARGET,
    "expected rampart site on open top border to be rejected",
  );
}

function runDefenseWestGateCenteringScenario() {
  const room = buildRoomScenario("VAL_DEFENSE_WEST_GATE", {
    tick: 589,
    controllerLevel: 4,
    spawnX: 32,
    spawnY: 17,
    controllerX: 40,
    controllerY: 40,
    sourceAX: 41,
    sourceAY: 25,
    sourceBX: 34,
    sourceBY: 40,
    mineralX: 40,
    mineralY: 10,
    terrainWalls: buildLeftCorridorDefenseTerrainWalls(),
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 32, y: 17, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
    ],
  });

  const anchor = new RoomPosition(32, 17, room.name);
  const plan = defenseLayout.getPlanForAnchor(room, anchor);

  assert(plan, "expected defense plan for west corridor room");
  assert(
    hasVerticalGatePair(plan.gates, 10),
    `expected west-side gate coverage away from the border, got ${JSON.stringify(plan.gates)}`,
  );
}

function runDefenseNorthSplitGateScenario() {
  const room = buildRoomScenario("VAL_DEFENSE_NORTH_SPLIT", {
    tick: 589,
    controllerLevel: 4,
    spawnX: 22,
    spawnY: 20,
    controllerX: 40,
    controllerY: 40,
    sourceAX: 41,
    sourceAY: 25,
    sourceBX: 34,
    sourceBY: 40,
    mineralX: 40,
    mineralY: 10,
    terrainWalls: buildTopSplitDefenseTerrainWalls(),
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 22, y: 20, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
    ],
  });

  const anchor = new RoomPosition(22, 20, room.name);
  const plan = defenseLayout.getPlanForAnchor(room, anchor);

  assert(plan, "expected defense plan for north split corridor room");
  assert(
    hasHorizontalGatePair(plan.gates, 10),
    `expected north-side gate coverage for the split opening, got ${JSON.stringify(plan.gates)}`,
  );
}

function runDefenseCornerGateCoalesceScenario() {
  const room = buildRoomScenario("VAL_DEFENSE_CORNER_COALESCE", {
    tick: 589,
    controllerLevel: 4,
    spawnX: 25,
    spawnY: 25,
    controllerX: 40,
    controllerY: 40,
    sourceAX: 41,
    sourceAY: 25,
    sourceBX: 34,
    sourceBY: 40,
    mineralX: 40,
    mineralY: 10,
  });

  const anchor = new RoomPosition(25, 25, room.name);
  const normalized = defenseLayout.coalesceCornerGatePlan(
    room.name,
    {
      walls: [
        new RoomPosition(2, 6, room.name),
        new RoomPosition(3, 6, room.name),
        new RoomPosition(4, 6, room.name),
        new RoomPosition(5, 6, room.name),
        new RoomPosition(6, 6, room.name),
        new RoomPosition(7, 6, room.name),
        new RoomPosition(8, 6, room.name),
        new RoomPosition(9, 6, room.name),
        new RoomPosition(10, 6, room.name),
      ],
      gates: [
        new RoomPosition(2, 4, room.name),
        new RoomPosition(2, 5, room.name),
        new RoomPosition(11, 6, room.name),
        new RoomPosition(12, 6, room.name),
      ],
    },
    anchor,
  );

  assert(normalized, "expected connected corner plan to normalize");
  assert(
    normalized.gates.length === 4,
    `expected connected corner component to preserve both corner gate pairs, got ${JSON.stringify(normalized.gates)}`,
  );
  assert(
    normalized.gates.some((pos) => pos.x === 2 && pos.y === 4) &&
      normalized.gates.some((pos) => pos.x === 2 && pos.y === 5) &&
    normalized.gates.some((pos) => pos.x === 11 && pos.y === 6) &&
      normalized.gates.some((pos) => pos.x === 12 && pos.y === 6),
    `expected corner-connected plan to keep both west and north gate pairs, got ${JSON.stringify(normalized.gates)}`,
  );
  assert(
    !normalized.walls.some((pos) => pos.x === 2 && pos.y === 4) &&
      !normalized.walls.some((pos) => pos.x === 2 && pos.y === 5),
    `expected preserved west gate pair to stay out of the wall set, got walls=${JSON.stringify(normalized.walls)} gates=${JSON.stringify(normalized.gates)}`,
  );
}

function runDefenseCornerApproachGroupingScenario() {
  const room = buildRoomScenario("VAL_DEFENSE_CORNER_APPROACH", {
    tick: 589,
    controllerLevel: 4,
    spawnX: 25,
    spawnY: 25,
    controllerX: 40,
    controllerY: 40,
    sourceAX: 41,
    sourceAY: 25,
    sourceBX: 34,
    sourceBY: 40,
    mineralX: 40,
    mineralY: 10,
    terrainWalls: buildCornerApproachDefenseTerrainWalls(),
  });

  const approaches = defenseLayout.getExitApproaches(room.name, room.getTerrain());

  assert(approaches.length === 1, `expected connected top/left openings to merge into one approach, got ${JSON.stringify(approaches)}`);
  assert(
    approaches[0].passages.some((passage) => passage.side === "top") &&
      approaches[0].passages.some((passage) => passage.side === "left"),
    `expected merged corner approach to include top and left passages, got ${JSON.stringify(approaches[0])}`,
  );

  const anchor = new RoomPosition(25, 25, room.name);
  const plan = defenseLayout.getPlanForAnchor(room, anchor);

  assert(plan, "expected merged corner approach to produce a defense plan");
  assert(
    plan.gates.some((pos) => pos.y <= 8) &&
      plan.gates.some((pos) => pos.x <= 8),
    `expected merged corner approach to keep gate coverage on both north and west runs, got ${JSON.stringify(plan.gates)}`,
  );
  assert(
    plan.gates.length >= 4,
    `expected merged corner approach to preserve at least two gate pairs, got ${JSON.stringify(plan.gates)}`,
  );
}

function runDefenseAssetPerimeterScenario() {
  const room = buildRoomScenario("VAL_DEFENSE_ASSET_PERIMETER", {
    tick: 589,
    controllerLevel: 4,
    spawnX: 25,
    spawnY: 25,
    controllerX: 25,
    controllerY: 34,
    sourceAX: 17,
    sourceAY: 25,
    sourceBX: 33,
    sourceBY: 25,
    mineralX: 40,
    mineralY: 10,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
  });

  const state = roomState.collect(room);
  const plan = defenseLayout.getPlan(room, state);

  assert(plan, "expected asset-perimeter room to produce a defense plan");
  assert(
    !plan.walls.some((pos) => pos.x <= 3 || pos.y <= 3 || pos.x >= 46 || pos.y >= 46) &&
      !plan.gates.some((pos) => pos.x <= 3 || pos.y <= 3 || pos.x >= 46 || pos.y >= 46),
    `expected asset-perimeter defense to stay off room edges, got walls=${JSON.stringify(plan.walls)} gates=${JSON.stringify(plan.gates)}`,
  );
  assert(
    plan.walls.some((pos) => (
      pos.getRangeTo(room.spawn.pos) <= 18 ||
      pos.getRangeTo(room.controller.pos) <= 10 ||
      pos.getRangeTo(room.find(FIND_SOURCES)[0].pos) <= 10 ||
      pos.getRangeTo(room.find(FIND_SOURCES)[1].pos) <= 10
    )) ||
      plan.gates.some((pos) => (
        pos.getRangeTo(room.spawn.pos) <= 18 ||
        pos.getRangeTo(room.controller.pos) <= 10 ||
        pos.getRangeTo(room.find(FIND_SOURCES)[0].pos) <= 10 ||
        pos.getRangeTo(room.find(FIND_SOURCES)[1].pos) <= 10
      )),
    `expected asset-perimeter defense to stay near the protected economy footprint, got walls=${JSON.stringify(plan.walls)} gates=${JSON.stringify(plan.gates)}`,
  );
}

function runDefensePlanLockScenario() {
  const room = buildRoomScenario("VAL_ACTIVE_DEFENSE_TOWER_ONLY", {
    tick: 590,
    controllerLevel: 5,
    spawnEnergy: 300,
    energyAvailable: 1800,
    energyCapacityAvailable: 1800,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 100000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 800 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_TOWER, x: 28, y: 24, options: { store: { energy: 800 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    hostiles: [
      {
        name: "invader1",
        x: 6,
        y: 24,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: ATTACK },
          { type: ATTACK },
        ],
      },
    ],
  });

  const state = roomState.collect(room);
  const threat = state.defense.homeThreat;

  assert(threat && threat.active, "expected hostile pressure to produce an active threat");
  assert(threat.towerCanHandle, "expected towers to fully cover a weak intruder");
  assert(
    threat.desiredDefenders === 0,
    `expected no defender spawn request when towers can hold, got ${threat.desiredDefenders}`,
  );
  assert(
    threat.responseMode === "tower_only",
    `expected tower-only defense mode, got ${threat.responseMode}`,
  );
  assert(threat.towerTargetId, "expected a selected tower focus target");

  towerManager.run(room, state);

  assert(
    currentRuntime.towerActions.length === 2,
    `expected both towers to fire, got ${currentRuntime.towerActions.length}`,
  );
  assert(
    currentRuntime.towerActions.every((action) => action.targetId === threat.towerTargetId),
    `expected tower focus fire on ${threat.towerTargetId}, got ${JSON.stringify(currentRuntime.towerActions)}`,
  );
}

function runDefenseConflictCleanupScenario() {
  const room = buildRoomScenario("VAL_ACTIVE_DEFENSE_ESCALATION", {
    tick: 595,
    controllerLevel: 5,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 150 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    hostiles: [
      {
        name: "invader_healer",
        x: 5,
        y: 5,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: HEAL },
          { type: HEAL },
          { type: TOUGH },
        ],
      },
      {
        name: "invader_melee",
        x: 7,
        y: 6,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: MOVE },
          { type: MOVE },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
        ],
      },
    ],
  });

  const state = roomState.collect(room);
  const threat = state.defense.homeThreat;

  assert(threat && threat.active, "expected hostile pressure to produce an active threat");
  assert(
    !threat.towerCanHandle,
    "expected low-energy edge pressure with healing support to require creeps",
  );
  assert(
    threat.desiredDefenders >= 1,
    `expected defender escalation, got ${threat.desiredDefenders}`,
  );
  assert(
    threat.responseMode === "tower_support",
    `expected tower-support mode, got ${threat.responseMode}`,
  );

  const requests = spawnManager.getSpawnRequests(room, state);
  const defenseRequests = requests.filter((request) => request.role === "defender");

  assert(
    defenseRequests.length >= 1,
    `expected at least one defender request, got ${JSON.stringify(requests)}`,
  );
  assert(
    defenseRequests[0].responseMode === "tower_support",
    `expected defender request to preserve tower-support mode, got ${defenseRequests[0].responseMode}`,
  );

  const plan = bodies.plan("defender", room, defenseRequests[0], state);
  assert(
    plan.body.includes(RANGED_ATTACK),
    `expected tower-support defender body to include ranged damage, got ${JSON.stringify(plan.body)}`,
  );
}

function runDefenseDismantlerThreatScenario() {
  const baselineRoom = buildRoomScenario("W20N20", {
    tick: 598,
    controllerLevel: 5,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 250 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    hostiles: [
      {
        name: "baseline_invader",
        x: 24,
        y: 27,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: MOVE },
        ],
      },
    ],
  });
  const baselineState = roomState.collect(baselineRoom);
  const baselineThreat = baselineState.defense.homeThreat;

  const dismantlerRoom = buildRoomScenario("W21N20", {
    tick: 599,
    controllerLevel: 5,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 250 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    hostiles: [
      {
        name: "dismantler_invader",
        x: 24,
        y: 27,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: MOVE },
          { type: WORK },
          { type: WORK },
          { type: WORK },
        ],
      },
    ],
  });
  const dismantlerState = roomState.collect(dismantlerRoom);
  const dismantlerThreat = dismantlerState.defense.homeThreat;

  assert(dismantlerThreat && dismantlerThreat.active, "expected dismantler intrusion to register as an active threat");
  assert(
    dismantlerThreat.threatScore > baselineThreat.threatScore,
    `expected dismantlers to score above the baseline intruder, got ${dismantlerThreat.threatScore} <= ${baselineThreat.threatScore}`,
  );
  assert(
    dismantlerThreat.breachSeverity === "core_breach",
    `expected dismantler near storage to be treated as core breach, got ${dismantlerThreat.breachSeverity}`,
  );
  assert(
    dismantlerThreat.desiredDefenders >= 1,
    `expected dismantler breach to demand defenders, got ${dismantlerThreat.desiredDefenders}`,
  );
}

function runDefenseLowTowerCoreBreachScenario() {
  const room = buildRoomScenario("W22N20", {
    tick: 600,
    controllerLevel: 5,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 50 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    hostiles: [
      {
        name: "breach_healer",
        x: 24,
        y: 26,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: HEAL },
          { type: HEAL },
        ],
      },
      {
        name: "breach_melee",
        x: 25,
        y: 26,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: MOVE },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
        ],
      },
    ],
  });

  const state = roomState.collect(room);
  const threat = state.defense.homeThreat;

  assert(
    threat.towerEnergyState === "low",
    `expected low tower energy state, got ${threat.towerEnergyState}`,
  );
  assert(
    threat.breachSeverity === "core_breach",
    `expected core breach severity, got ${threat.breachSeverity}`,
  );
  assert(
    threat.responseMode === "core_breach",
    `expected core breach response mode, got ${threat.responseMode}`,
  );
  assert(
    threat.desiredDefenders >= 1,
    `expected low-tower core breach to demand defenders, got ${threat.desiredDefenders}`,
  );
}

function runCivilianCoreBreachEvacuationScenario() {
  const room = buildRoomScenario("W23N20", {
    tick: 601,
    controllerLevel: 5,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      {
        name: "worker1",
        role: "worker",
        x: 24,
        y: 25,
        store: { energy: 50 },
        memory: { working: true },
      },
    ],
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 100 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    hostiles: [
      {
        name: "breach_worker_hunter",
        x: 24,
        y: 27,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: WORK },
          { type: WORK },
        ],
      },
    ],
  });

  const state = roomState.collect(room);
  currentRuntime.creepActions.length = 0;
  creepManager.run(room, state);

  const worker = Game.creeps.worker1;
  const move = currentRuntime.creepActions.find(function (action) {
    return action.creep === worker.name && action.action === "moveTo";
  });

  assert(worker.memory.retreatMode === "evacuate", `expected evacuation retreat mode, got ${worker.memory.retreatMode}`);
  assert(worker.memory.retreatRoom && worker.memory.retreatRoom !== room.name, "expected worker to pick an adjacent retreat room");
  assert(move && move.targetRoom === worker.memory.retreatRoom, `expected evacuation move toward ${worker.memory.retreatRoom}, got ${JSON.stringify(move)}`);
}

function runCivilianCoreBreachFallbackScenario() {
  const room = buildRoomScenario("VAL_BREACH_FALLBACK", {
    tick: 602,
    controllerLevel: 5,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      {
        name: "worker1",
        role: "worker",
        x: 24,
        y: 25,
        store: { energy: 50 },
        memory: { working: true },
      },
    ],
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 100 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    hostiles: [
      {
        name: "fallback_hunter",
        x: 24,
        y: 27,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: WORK },
          { type: WORK },
        ],
      },
    ],
  });

  const state = roomState.collect(room);
  currentRuntime.creepActions.length = 0;
  creepManager.run(room, state);

  const worker = Game.creeps.worker1;
  assert(worker.memory.retreatMode === "safe_edge", `expected safe-edge fallback, got ${worker.memory.retreatMode}`);
  assert(!worker.memory.retreatRoom, "expected nonstandard room fallback to avoid cross-room evacuation");
  assert(worker.memory.retreatEdge, "expected fallback retreat edge to be stored");
  assert(
    worker.memory.retreatEdge.indexOf("25:25") === -1 &&
      worker.memory.retreatEdge.indexOf("24:29") === -1 &&
      worker.memory.retreatEdge.indexOf("20:20") === -1,
    `expected fallback edge to avoid core anchors, got ${worker.memory.retreatEdge}`,
  );
}

function runDefenseBurstQueueScenario() {
  const room = buildRoomScenario("W24N20", {
    tick: 603,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 50 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    hostiles: [
      {
        name: "burst_healer",
        x: 24,
        y: 26,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: MOVE },
          { type: HEAL },
          { type: HEAL },
          { type: HEAL },
          { type: HEAL },
        ],
      },
      {
        name: "burst_attacker",
        x: 25,
        y: 26,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: MOVE },
          { type: MOVE },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
        ],
      },
      {
        name: "burst_attacker_2",
        x: 26,
        y: 26,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: MOVE },
          { type: MOVE },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
          { type: ATTACK },
        ],
      },
      {
        name: "burst_dismantler",
        x: 24,
        y: 27,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: MOVE },
          { type: MOVE },
          { type: WORK },
          { type: WORK },
          { type: WORK },
          { type: WORK },
          { type: WORK },
          { type: WORK },
        ],
      },
    ],
  });

  const state = roomState.collect(room);
  const requests = spawnManager.getSpawnRequests(room, state).filter(function (request) {
    return request.role === "defender";
  });

  assert(state.defense.homeThreat.desiredDefenders >= 2, `expected scenario to require multiple defenders, got ${state.defense.homeThreat.desiredDefenders}`);
  assert(requests.length === 2, `expected burst queue to request two defenders, got ${requests.length}`);
  assert(
    requests.every(function (request) { return request.responseMode === "core_breach"; }),
    `expected core breach requests, got ${JSON.stringify(requests)}`,
  );
}

function runCrossRoomDefenseNoOvercommitScenario() {
  const helper = buildRoomScenario("W25N20", {
    tick: 604,
    controllerLevel: 6,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
    ],
  });
  helper.controller.my = true;

  createOwnedSupportTargetRoom("W24N20", {
    controllerLevel: 5,
    spawn: true,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    spawnBusy: false,
    hostiles: [
      {
        name: "light_edge_invader",
        x: 3,
        y: 25,
        body: [{ type: MOVE }, { type: ATTACK }],
      },
    ],
  });

  const requests = spawnManager.getSpawnRequests(helper, roomState.collect(helper)).filter(function (request) {
    return request.role === "defender";
  });

  assert(requests.length === 0, `expected helper room to avoid unnecessary support, got ${JSON.stringify(requests)}`);
}

function runCrossRoomDefenseCoreBreachSupportScenario() {
  const helper = buildRoomScenario("W27N20", {
    tick: 605,
    controllerLevel: 6,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
    ],
  });
  helper.controller.my = true;

  const target = createOwnedSupportTargetRoom("W26N20", {
    controllerLevel: 5,
    spawn: false,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    hostiles: [
      {
        name: "remote_healer",
        x: 25,
        y: 25,
        body: [{ type: MOVE }, { type: HEAL }, { type: HEAL }],
      },
      {
        name: "remote_attacker",
        x: 24,
        y: 25,
        body: [{ type: MOVE }, { type: MOVE }, { type: ATTACK }, { type: ATTACK }, { type: ATTACK }, { type: ATTACK }],
      },
      {
        name: "remote_dismantler",
        x: 25,
        y: 24,
        body: [{ type: MOVE }, { type: MOVE }, { type: WORK }, { type: WORK }, { type: WORK }, { type: WORK }],
      },
    ],
  });
  target.addStructure(
    createStructure(STRUCTURE_STORAGE, 25, 26, {
      roomName: target.name,
      store: { energy: 50000 },
      storeCapacity: 1000000,
      hits: 10000,
      hitsMax: 10000,
    }),
  );

  const requests = spawnManager.getSpawnRequests(helper, roomState.collect(helper)).filter(function (request) {
    return request.role === "defender";
  });

  assert(requests.length === 2, `expected severe core breach support to request two defenders, got ${JSON.stringify(requests)}`);
  assert(
    requests.every(function (request) { return request.targetRoom === target.name; }),
    `expected both support defenders to target ${target.name}, got ${JSON.stringify(requests)}`,
  );
}

function runDefenseRecoveryScenario() {
  const room = buildRoomScenario("W28N20", {
    tick: 606,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 800,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 100 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_TOWER, x: 28, y: 24, options: { store: { energy: 150 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    hostiles: [
      {
        name: "recovery_dismantler",
        x: 24,
        y: 27,
        body: [{ type: MOVE }, { type: MOVE }, { type: WORK }, { type: WORK }, { type: WORK }],
      },
    ],
  });
  let state = roomState.collect(room);
  assert(state.defense.homeThreat.recoveryEligible, "expected severe breach to mark recovery eligibility");

  room._hostileCreeps = [];
  Game.time = 607;
  state = roomState.collect(room);

  assert(state.defense.recovery && state.defense.recovery.active, "expected room to enter recovery after the breach clears");
  assert(state.logistics && state.logistics.haulerMode === "recovery", `expected recovery hauler mode, got ${state.logistics ? state.logistics.haulerMode : "none"}`);

  const report = roomReporting.build(room, state, { updateProgress: false });
  assert(report.alert.recoveryActive, "expected room reporting to expose recovery");
  assert(
    report.hudLines[0].indexOf("RECOVERY") !== -1,
    `expected recovery HUD label, got ${JSON.stringify(report.hudLines)}`,
  );

  room.energyAvailable = room.energyCapacityAvailable;
  state.structuresByType[STRUCTURE_TOWER][0].store.energy = 800;
  state.structuresByType[STRUCTURE_TOWER][1].store.energy = 800;
  room._structures.forEach(function (structure) {
    if (structure.structureType === STRUCTURE_TOWER) {
      structure.store.energy = 800;
    }
  });
  Memory.rooms[room.name].spawnQueue = [];

  Game.time = 623;
  state = roomState.collect(room);

  assert(
    !state.defense.recovery.active,
    "expected recovery to clear once energy and tower thresholds are restored",
  );
}

function runRecoveryTowerBankingDeadlockScenario() {
  const room = buildRoomScenario("VAL_RECOVERY_TOWER_BANKING", {
    tick: 900,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [{ name: "recoveryHauler", role: "hauler", x: 25, y: 24 }],
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 621 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 297 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_TOWER, x: 28, y: 24, options: { store: { energy: 100 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
  });

  Memory.rooms[room.name] = {
    defense: {
      recovery: {
        active: true,
        eligible: true,
        reason: "post_attack",
        mode: "full",
        startedAt: 880,
        exitWhenReady: true,
        lastThreatSeen: 880,
      },
    },
    spawnQueue: [],
  };

  const state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  const delivery = logisticsManager.getHaulerDeliveryTarget(
    room,
    Game.creeps.recoveryHauler,
    state,
  );

  assert(
    delivery && delivery.structureType === STRUCTURE_TOWER,
    `expected recovery tower below emergency to beat reserve-banking storage, got ${delivery ? delivery.id : "none"}`,
  );
}

function runRecoveryTowerReserveIgnoresBankingScenario() {
  const room = buildRoomScenario("VAL_RECOVERY_TOWER_RESERVE", {
    tick: 930,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [{ name: "reserveHauler", role: "hauler", x: 25, y: 24 }],
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 621 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 500 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
  });

  Memory.rooms[room.name] = {
    defense: {
      recovery: {
        active: true,
        eligible: true,
        reason: "post_attack",
        mode: "full",
        startedAt: 920,
        exitWhenReady: true,
        lastThreatSeen: 920,
      },
    },
    spawnQueue: [],
  };

  const state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  const delivery = logisticsManager.getHaulerDeliveryTarget(
    room,
    Game.creeps.reserveHauler,
    state,
  );

  assert(
    delivery && delivery.structureType === STRUCTURE_TOWER,
    `expected recovery tower reserve to ignore storage banking, got ${delivery ? delivery.id : "none"}`,
  );
}

function runLightRecoveryScenario() {
  const room = buildRoomScenario("VAL_LIGHT_RECOVERY", {
    tick: 1000,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 450 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    hostiles: [
      {
        name: "light_intruder",
        x: 10,
        y: 10,
        body: [{ type: MOVE }],
      },
    ],
  });

  let state = roomState.collect(room);
  assert(!state.defense.homeThreat.recoveryEligible, "expected light threat to avoid full recovery eligibility");

  room._hostileCreeps = [];
  Game.time = 1001;
  state = roomState.collect(room);
  assert(state.defense.recovery.active, "expected light post-attack recovery to start after a light threat clears");
  assert(
    state.defense.recovery.reason === "post_attack_light",
    `expected light recovery reason, got ${state.defense.recovery.reason}`,
  );

  Game.time = 1016;
  state = roomState.collect(room);
  assert(
    !state.defense.recovery.active,
    "expected light recovery to clear with emergency tower energy and no reserve fill",
  );
}

function runFullRecoveryRequiresReserveScenario() {
  const room = buildRoomScenario("VAL_FULL_RECOVERY_RESERVE", {
    tick: 1100,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 450 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
  });

  Memory.rooms[room.name] = {
    defense: {
      recovery: {
        active: true,
        eligible: true,
        reason: "post_attack",
        mode: "full",
        startedAt: 1090,
        exitWhenReady: true,
        lastThreatSeen: 1090,
      },
    },
    spawnQueue: [],
  };

  let state = roomState.collect(room);
  assert(state.defense.recovery.active, "expected full recovery to remain active below tower reserve");
  assert(
    state.defense.recovery.blockers.indexOf("tower reserve 0/1") !== -1,
    `expected tower reserve blocker, got ${state.defense.recovery.blockers.join(",")}`,
  );

  room._structures.forEach(function (structure) {
    if (structure.structureType === STRUCTURE_TOWER) {
      structure.store.energy = 700;
    }
  });
  Game.time = 1106;
  state = roomState.collect(room);
  assert(!state.defense.recovery.active, "expected full recovery to clear once tower reserve is met");
}

function runRecoveryFailsafeScenario() {
  const room = buildRoomScenario("VAL_RECOVERY_FAILSAFE", {
    tick: 3000,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 621 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 450 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
  });

  Memory.rooms[room.name] = {
    defense: {
      recovery: {
        active: true,
        eligible: true,
        reason: "post_attack",
        mode: "full",
        startedAt: 1000,
        exitWhenReady: true,
        lastThreatSeen: 1000,
      },
    },
    spawnQueue: [],
  };

  const state = roomState.collect(room);
  assert(
    !state.defense.recovery.active,
    "expected aged full recovery to clear when safe and tower emergency is restored",
  );
}

function runRecoveryFailsafeBlockedScenario() {
  const room = buildRoomScenario("VAL_RECOVERY_FAILSAFE_BLOCKED", {
    tick: 3000,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 621 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 399 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
  });

  Memory.rooms[room.name] = {
    defense: {
      recovery: {
        active: true,
        eligible: true,
        reason: "post_attack",
        mode: "full",
        startedAt: 1000,
        exitWhenReady: true,
        lastThreatSeen: 1000,
      },
    },
    spawnQueue: [],
  };

  const state = roomState.collect(room);
  assert(
    state.defense.recovery.active,
    "expected aged recovery to remain active below tower emergency threshold",
  );
}

function runRecoveryReportingContextScenario() {
  const room = buildRoomScenario("VAL_RECOVERY_REPORTING", {
    tick: 646130,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 621 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 297 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
  });

  Memory.rooms[room.name] = {
    defense: {
      recovery: {
        active: true,
        eligible: true,
        reason: "post_attack",
        mode: "full",
        startedAt: 644266,
        exitWhenReady: true,
        lastThreatSeen: 644265,
      },
    },
    spawnQueue: [],
  };

  const state = roomState.collect(room);
  const report = roomReporting.build(room, state, { updateProgress: false });
  const recoveryLine = report.sections.defense.find(function (line) {
    return line.indexOf("Recovery") === 0;
  });

  assert(
    recoveryLine &&
      recoveryLine.indexOf("post_attack") !== -1 &&
      recoveryLine.indexOf("age 1864t") !== -1 &&
      recoveryLine.indexOf("last 644265") !== -1,
    `expected recovery line to include reason, age, and last threat, got ${recoveryLine}`,
  );
}

function runRecoveryBuildIntentScenario() {
  const room = buildRoomScenario("W43N6", {
    tick: 700,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1050,
    energyCapacityAvailable: 1100,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraSites: [
      { type: STRUCTURE_EXTENSION, x: 23, y: 27 },
      { type: STRUCTURE_EXTENSION, x: 24, y: 27 },
      { type: STRUCTURE_ROAD, x: 25, y: 27 },
    ],
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 117511 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 800 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    creeps: [
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24, memory: { sourceId: "source1" } },
      { name: "hauler2", role: "hauler", x: 26, y: 24, memory: { sourceId: "source2" } },
      { name: "upgrader1", role: "upgrader", x: 24, y: 24 },
      { name: "upgrader2", role: "upgrader", x: 23, y: 24 },
    ],
  });

  Memory.rooms[room.name] = {
    defense: {
      recovery: {
        active: true,
        eligible: true,
        reason: "post_attack",
        startedAt: 680,
        exitWhenReady: true,
        lastThreatSeen: 680,
      },
    },
    spawnQueue: [],
  };

  const state = roomState.collect(room);
  assert(
    !state.defense.recovery.active,
    "expected recovery to clear with healthy towers and small spawn energy deficit",
  );
  assert(state.phase !== "foundation", `expected operational RCL6 room to leave foundation, got ${state.phase}`);

  const requests = spawnManager.getSpawnRequests(room, state);
  assert(
    requests.some((request) => request.role === "worker"),
    `expected build backlog with zero labor to request a worker, got ${requests.map((request) => request.role).join(",")}`,
  );
  assert(
    spawnManager.getDesiredUpgraders(room, state) < 2,
    `expected build backlog to reduce upgrader demand below current pressure, got ${spawnManager.getDesiredUpgraders(room, state)}`,
  );

  const report = roomReporting.build(room, state, { updateProgress: false });
  assert(
    report.sections.economy.some(function (line) {
      return line.indexOf("Build mode active") !== -1;
    }),
    `expected economy report to show build intent, got ${JSON.stringify(report.sections.economy)}`,
  );
}

function runConstructionSiteWorkerFloorScenario() {
  const room = buildRoomScenario("VAL_BUILD_WORKER_FLOOR", {
    tick: 701,
    controllerLevel: 4,
    spawnEnergy: 300,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraSites: [
      { type: STRUCTURE_EXTENSION, x: 23, y: 27 },
    ],
    creeps: [
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24, memory: { sourceId: "source1" } },
      { name: "hauler2", role: "hauler", x: 26, y: 24, memory: { sourceId: "source2" } },
      { name: "upgrader1", role: "upgrader", x: 24, y: 24 },
    ],
  });

  const state = roomState.collect(room);
  const requests = spawnManager.getSpawnRequests(room, state);

  assert(
    requests.some((request) => request.role === "worker"),
    `expected construction site backlog with zero labor to request worker, got ${requests.map((request) => request.role).join(",")}`,
  );
}

function runSpawnEnergyFallbackScenario() {
  const room = buildRoomScenario("VAL_SPAWN_ENERGY_FALLBACK", {
    tick: 800,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1050,
    energyCapacityAvailable: 1100,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraSites: [
      { type: STRUCTURE_EXTENSION, x: 23, y: 27 },
      { type: STRUCTURE_EXTENSION, x: 24, y: 27 },
      { type: STRUCTURE_ROAD, x: 25, y: 27 },
    ],
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 122620 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 800 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    creeps: [
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24, memory: { sourceId: "source1" } },
      { name: "hauler2", role: "hauler", x: 26, y: 24, memory: { sourceId: "source2" } },
      { name: "upgrader1", role: "upgrader", x: 24, y: 24 },
    ],
  });
  const sources = room.find(FIND_SOURCES);
  Game.creeps.miner1.memory.sourceId = sources[0].id;
  Game.creeps.hauler1.memory.sourceId = sources[0].id;
  Game.creeps.miner2.memory.sourceId = sources[1].id;
  Game.creeps.hauler2.memory.sourceId = sources[1].id;

  let state = roomState.collect(room);
  spawnManager.run(room, state);

  let queue = Memory.rooms[room.name].spawnQueue || [];
  assert(queue.length > 0 && queue[0].role === "worker", `expected worker queue, got ${JSON.stringify(queue)}`);
  assert(queue[0].waitAge === 0, `expected fresh request age 0, got ${queue[0].waitAge}`);
  assert(queue[0].bodyCost === 600, `expected construction worker cost 600, got ${queue[0].bodyCost}`);
  assert(currentRuntime.spawnEvents.length === 1, "expected smaller construction worker to spawn immediately");

  Game.time = 810;
  room.energyAvailable = 1050;
  state = roomState.collect(room);
  spawnManager.run(room, state);

  queue = Memory.rooms[room.name].spawnQueue || [];
  assert(queue.length > 0 && queue[0].role === "worker", `expected worker queue after immediate construction spawn, got ${JSON.stringify(queue[0])}`);
  assert(queue[0].waitAge === 10, `expected request age 10, got ${queue[0].waitAge}`);
  assert(queue[0].bodyCost <= 1050, `expected fallback worker to fit current energy, got ${queue[0].bodyCost}`);
  assert(currentRuntime.spawnEvents.length === 1, `expected fallback worker to spawn, got ${currentRuntime.spawnEvents.length}`);
  assert(currentRuntime.spawnEvents[0].role === "worker", `expected spawned worker, got ${currentRuntime.spawnEvents[0].role}`);
}

function runSpawnRequestAgeTrackingScenario() {
  const room = buildRoomScenario("VAL_SPAWN_REQUEST_AGE", {
    tick: 820,
    controllerLevel: 3,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
  });

  let requests = spawnManager.trackSpawnRequestAges(room, [
    { role: "worker", priority: 90, targetId: "site-a" },
  ]);
  assert(requests[0].waitAge === 0, `expected initial request age 0, got ${requests[0].waitAge}`);

  Game.time = 825;
  requests = spawnManager.trackSpawnRequestAges(room, [
    { role: "worker", priority: 90, targetId: "site-a" },
  ]);
  assert(requests[0].waitAge === 5, `expected equivalent request age 5, got ${requests[0].waitAge}`);

  requests = spawnManager.trackSpawnRequestAges(room, [
    { role: "worker", priority: 90, targetId: "site-b" },
  ]);
  assert(requests[0].waitAge === 0, `expected changed target to reset age, got ${requests[0].waitAge}`);
}

function runInvasionLogOwnedScenario() {
  const room = buildRoomScenario("VAL_INVASION_HOME", {
    tick: 840,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1800,
    energyCapacityAvailable: 1800,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 80000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 800 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    hostiles: [
      {
        name: "logInvader1",
        username: "Invader",
        x: 6,
        y: 24,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: ATTACK },
          { type: HEAL },
        ],
      },
    ],
  });

  let state = roomState.collect(room);
  let active = invasionLog.recordOwned(room, state);
  assert(active, "expected owned-room invasion log to open");
  assert(active.sc === "home", `expected home scope, got ${active.sc}`);
  assert(active.s === 840, `expected start tick 840, got ${active.s}`);
  assert(active.h === 1, `expected max hostile count 1, got ${active.h}`);
  assert(active.ms > 0, `expected threat score to be recorded, got ${active.ms}`);
  assert(active.o.indexOf("Invader") !== -1, `expected Invader owner, got ${JSON.stringify(active.o)}`);
  assert(active.m && active.m !== "idle", `expected response mode, got ${active.m}`);

  Game.time = 842;
  room._hostileCreeps = [];
  state = roomState.collect(room);
  invasionLog.recordOwned(room, state);

  const roomLog = Memory.empire.invasionLog.rooms[room.name];
  assert(roomLog && !roomLog.active, "expected owned-room invasion log to close");
  assert(roomLog.entries.length === 1, `expected one closed entry, got ${roomLog.entries.length}`);
  const entry = roomLog.entries[0];
  assert(entry.e === 842, `expected end tick 842, got ${entry.e}`);
  assert(entry.st === "cleared", `expected cleared status, got ${entry.st}`);
  assert(entry.b, "expected breach severity to be stored");
}

function runInvasionLogRemoteScenario() {
  resetRuntime(850);
  const threat = {
    active: true,
    scope: "reservation",
    hostiles: [
      { owner: { username: "Invader" } },
      { owner: { username: "Source Keeper" } },
    ],
    hostileCount: 2,
    threatScore: 9,
    threatLevel: 2,
    responseMode: "tower_support",
    breachSeverity: "edge_pressure",
    towerCanHandle: false,
    desiredDefenders: 1,
    towerTargetSummary: "healer 24,25",
  };

  let active = invasionLog.recordRemote("VAL_REMOTE_LOG", "reservation", threat);
  assert(active && active.sc === "reservation", `expected reservation active log, got ${JSON.stringify(active)}`);
  assert(active.h === 2, `expected two remote hostiles, got ${active.h}`);
  assert(active.o.indexOf("Invader") !== -1 && active.o.indexOf("Source Keeper") !== -1, `expected remote owners, got ${JSON.stringify(active.o)}`);

  Game.time = 851;
  invasionLog.recordRemote("VAL_REMOTE_LOG", "reservation", null);
  let roomLog = Memory.empire.invasionLog.rooms.VAL_REMOTE_LOG;
  assert(roomLog && roomLog.entries.length === 1, "expected visible clear to close remote invasion");
  assert(roomLog.entries[0].st === "cleared", `expected cleared remote status, got ${roomLog.entries[0].st}`);

  Game.time = 860;
  active = invasionLog.recordRemote("VAL_REMOTE_STALE", "expansion", Object.assign({}, threat, {
    scope: "expansion",
    hostileCount: 1,
    hostiles: [{ owner: { username: "Invader" } }],
  }));
  assert(active && active.sc === "expansion", "expected expansion active log");

  Game.time = 886;
  invasionLog.closeStaleRemotes(25);
  roomLog = Memory.empire.invasionLog.rooms.VAL_REMOTE_STALE;
  assert(roomLog && !roomLog.active, "expected stale remote log to close");
  assert(roomLog.entries.length === 1, `expected one stale entry, got ${roomLog.entries.length}`);
  assert(roomLog.entries[0].st === "stale", `expected stale status, got ${roomLog.entries[0].st}`);
}

function runInvasionLogOpsScenario() {
  resetRuntime(900);
  invasionLog.recordThreat("VAL_LOG_A", "home", {
    active: true,
    hostiles: [{ owner: { username: "Invader" } }],
    hostileCount: 1,
    threatScore: 4,
    threatLevel: 1,
    responseMode: "tower_only",
    breachSeverity: "edge_pressure",
    towerCanHandle: true,
    desiredDefenders: 0,
    towerTargetSummary: "melee 10,10",
  });
  Game.time = 905;
  invasionLog.closeRoom("VAL_LOG_A", "cleared", "home");

  ops.registerGlobals();
  const originalLog = console.log;
  const lines = [];
  console.log = function (line) {
    lines.push(String(line));
  };
  try {
    global.ops.log();
    global.ops.log("VAL_LOG_A");
  } finally {
    console.log = originalLog;
  }

  assert(lines.some(function (line) { return line.indexOf("[OPS][INVASIONS] stored 1") !== -1; }), `expected invasion header, got ${lines.join(" / ")}`);
  assert(lines.some(function (line) { return line.indexOf("VAL_LOG_A 900-905") !== -1; }), `expected room log row, got ${lines.join(" / ")}`);
  assert(lines.every(function (line) { return line.length <= 85; }), `expected ops.log lines within 85 chars, got ${lines.filter(function (line) { return line.length > 85; }).join(" / ")}`);
  assert(lines.every(function (line) { return line.indexOf("...") === -1; }), `expected no ellipsis truncation, got ${lines.join(" / ")}`);

  let result = global.ops.logClear("VAL_LOG_A");
  assert(result.ok && result.clearedRooms === 1 && result.clearedEntries === 1, `expected one room clear, got ${JSON.stringify(result)}`);

  invasionLog.recordThreat("VAL_LOG_B", "home", {
    active: true,
    hostiles: [{ owner: { username: "Invader" } }],
    hostileCount: 1,
    threatScore: 4,
    threatLevel: 1,
  });
  result = global.ops.logClear();
  assert(result.ok && result.clearedRooms === 1 && result.clearedEntries === 1, `expected all clear, got ${JSON.stringify(result)}`);
}

function runInvasionLogCapScenario() {
  resetRuntime(930);
  for (let i = 0; i < 25; i++) {
    Game.time = 930 + i * 2;
    invasionLog.recordThreat("VAL_LOG_CAP", "home", {
      active: true,
      hostiles: [{ owner: { username: "Invader" } }],
      hostileCount: 1,
      threatScore: 4,
      threatLevel: 1,
    });
    Game.time += 1;
    invasionLog.closeRoom("VAL_LOG_CAP", "cleared", "home");
  }

  const roomLog = Memory.empire.invasionLog.rooms.VAL_LOG_CAP;
  assert(roomLog.entries.length === invasionLog.getPerRoomCap(), `expected cap ${invasionLog.getPerRoomCap()}, got ${roomLog.entries.length}`);
  assert(roomLog.entries[0].s === 940, `expected oldest retained start tick 940, got ${roomLog.entries[0].s}`);
}

function runPassiveDefenseRampartBaselineScenario() {
  const room = buildRoomScenario("W29N20", {
    tick: 624,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 150000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 800 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_TOWER, x: 28, y: 24, options: { store: { energy: 800 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_RAMPART, x: 25, y: 25, options: { hits: 10000, hitsMax: 10000 } },
    ],
  });

  let state = roomState.collect(room);
  state.phase = "fortification";
  state.buildStatus = constructionStatus.getStatus(room, state);
  const context = constructionManager.createPlanContext(room, state);
  constructionManager.placeDefense(context);

  const rampartSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter(site) {
      return site.structureType === STRUCTURE_RAMPART;
    },
  });

  assert(
    state.buildStatus.rampartsNeeded === 4,
    `expected rampart goal for spawn, storage, and 2 towers, got ${state.buildStatus.rampartsNeeded}`,
  );
  assert(
    rampartSites.length === 3,
    `expected only missing passive ramparts to be placed, got ${rampartSites.length}`,
  );
}

function runPassiveDefenseEarlyRoomScenario() {
  const room = buildRoomScenario("W30N20", {
    tick: 625,
    controllerLevel: 5,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 800 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_TOWER, x: 28, y: 24, options: { store: { energy: 800 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
  });

  const state = roomState.collect(room);
  constructionManager.plan(room, state);

  const rampartSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter(site) {
      return site.structureType === STRUCTURE_RAMPART;
    },
  });

  assert(rampartSites.length === 0, `expected pre-fortification room to skip passive defenses, got ${rampartSites.length}`);
}

function createOwnedSupportTargetRoom(name, options) {
  const settings = options || {};
  const room = new FakeRoom(name, new FakeTerrain());
  room.setController(
    createController(settings.controllerX || 20, settings.controllerY || 20, {
      roomName: name,
      level: settings.controllerLevel || 3,
      progress: settings.controllerProgress || 0,
    }),
  );
  room.controller.my = true;
  room.controller.owner = { username: "tester" };

  if (settings.spawn !== false) {
    room.addStructure(
      createStructure(STRUCTURE_SPAWN, settings.spawnX || 25, settings.spawnY || 25, {
        roomName: name,
        name: settings.spawnName || `${name}_Spawn`,
        store: { energy: settings.spawnEnergy !== undefined ? settings.spawnEnergy : 300 },
        storeCapacityResource: { energy: 300 },
        hits: 5000,
        hitsMax: 5000,
        spawning: settings.spawnBusy ? { name: "busy", remainingTime: 10 } : null,
      }),
    );
  }

  room.addSource(createSource(settings.sourceX || 15, settings.sourceY || 25, { roomName: name }));
  room.addMineral(createMineral(settings.mineralX || 35, settings.mineralY || 20, { roomName: name }));

  if (settings.hostiles) {
    for (let i = 0; i < settings.hostiles.length; i++) {
      const spec = settings.hostiles[i];
      const hostile = createCreep(
        spec.name || `supportHostile${i + 1}`,
        "hostile",
        spec.x,
        spec.y,
        {
          roomName: name,
          my: false,
          body: spec.body,
        },
      );
      hostile.owner = { username: spec.username || "Invader" };
      room._hostileCreeps.push(hostile);
    }
  }

  room.energyAvailable =
    settings.energyAvailable !== undefined ? settings.energyAvailable : 300;
  room.energyCapacityAvailable =
    settings.energyCapacityAvailable !== undefined ? settings.energyCapacityAvailable : 300;

  return room;
}

function runCrossRoomDefenseSupportRequestScenario() {
  const helper = buildRoomScenario("W9N6", {
    tick: 596,
    controllerLevel: 5,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
    ],
  });
  helper.controller.my = true;

  const target = createOwnedSupportTargetRoom("W8N6", {
    controllerLevel: 4,
    spawn: false,
    hostiles: [
      {
        name: "support_invader",
        x: 8,
        y: 8,
        body: [
          { type: MOVE },
          { type: MOVE },
          { type: ATTACK },
          { type: ATTACK },
        ],
      },
    ],
  });

  const state = roomState.collect(helper);
  spawnManager.run(helper, state);

  const defenderEvent = currentRuntime.spawnEvents.find(function (event) {
    return event.role === "defender";
  });

  assert(defenderEvent, "expected helper room to spawn a support defender");
  assert(
    defenderEvent.memory.targetRoom === target.name,
    `expected support defender target ${target.name}, got ${defenderEvent.memory.targetRoom}`,
  );
  assert(
    defenderEvent.memory.homeRoom === helper.name,
    `expected support defender home ${helper.name}, got ${defenderEvent.memory.homeRoom}`,
  );
  assert(
    defenderEvent.memory.operation === "defense_support",
    `expected defense_support operation, got ${defenderEvent.memory.operation}`,
  );
  assert(
    Memory.empire.defense.support[target.name].helperRoom === helper.name,
    "expected empire defense support memory to record the helper room",
  );
}

function runCrossRoomDefenderRoleScenario() {
  const helper = buildRoomScenario("W9N6", {
    tick: 597,
    controllerLevel: 5,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
  });
  helper.controller.my = true;

  const target = createOwnedSupportTargetRoom("W8N6", {
    controllerLevel: 4,
    spawn: false,
    hostiles: [
      {
        name: "support_target_invader",
        x: 8,
        y: 8,
        body: [
          { type: MOVE },
          { type: ATTACK },
        ],
      },
    ],
  });
  const hostile = target.find(FIND_HOSTILE_CREEPS)[0];
  const defender = createCreep("supportDefender", "defender", 25, 25, {
    roomName: helper.name,
    memory: {
      homeRoom: helper.name,
      targetRoom: target.name,
      operation: "defense_support",
    },
    body: [
      { type: ATTACK },
      { type: MOVE },
      { type: MOVE },
    ],
  });
  const helperState = roomState.collect(helper);

  currentRuntime.creepActions.length = 0;
  roleDefender.run(defender, helperState);

  assert(
    currentRuntime.creepActions.some(function (action) {
      return action.creep === defender.name && action.action === "moveTo" && action.range === 20;
    }),
    "expected support defender to travel toward the target room",
  );

  defender.pos = new RoomPosition(hostile.pos.x + 1, hostile.pos.y, target.name);
  currentRuntime.creepActions.length = 0;
  roleDefender.run(defender, null);

  assert(
    currentRuntime.creepActions.some(function (action) {
      return action.creep === defender.name && action.action === "attack" && action.targetId === hostile.id;
    }),
    "expected support defender to attack a hostile in the supported room",
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
  assert(
    state.buildStatus.spawnsNeeded === 2,
    `expected fortification to target two spawns at RCL7, got ${state.buildStatus.spawnsNeeded}`,
  );
  assert(
    !state.buildStatus.fortificationComplete,
    "expected fortification to stay incomplete until the second spawn is built",
  );

  const report = roomReporting.build(room, state, { updateProgress: false });
  assert(
    report.nextTask === "place or finish the next spawn",
    `expected fortification next task to point at spawn expansion, got ${report.nextTask}`,
  );

  constructionManager.plan(room, state);
  const siteTypes = getSiteTypes(room);
  assert(
    siteTypes.includes(STRUCTURE_SPAWN),
    `fortification should place a second spawn site, got sites: ${siteTypes.join(",") || "none"}`,
  );
}

function runRcl7UpgradeTransitionScenario() {
  const room = buildRoomScenario("VAL_RCL7_TRANSITION", {
    tick: 640,
    controllerLevel: 6,
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
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 150000;

  let state = roomState.collect(room);
  assert(state.phase === "specialization", `expected specialization before upgrade, got ${state.phase}`);
  assert(
    state.buildStatus.specializationComplete,
    "expected RCL6 room to finish specialization prep before the RCL7 test",
  );

  room.controller.level = 7;

  state = roomState.collect(room);
  assert(state.phase === "development", `expected development catch-up right after RCL7 upgrade, got ${state.phase}`);
  assert(
    state.buildStatus.extensionsNeeded === 50 && state.buildStatus.towersNeeded === 3,
    `expected RCL7 core unlock targets, got ext ${state.buildStatus.extensionsNeeded} tower ${state.buildStatus.towersNeeded}`,
  );

  satisfyDevelopmentRequirements(room);
  state = roomState.collect(room);
  assert(state.phase === "fortification", `expected fortification after RCL7 core catch-up, got ${state.phase}`);
  assert(
    state.buildStatus.linksNeeded === 4,
    `expected fortification to add the second source link target at RCL7, got ${state.buildStatus.linksNeeded}`,
  );
  assert(
    state.buildStatus.spawnsNeeded === 2,
    `expected fortification to target a second spawn at RCL7, got ${state.buildStatus.spawnsNeeded}`,
  );

  Game.time += config.CONSTRUCTION.PLAN_INTERVAL || 50;
  constructionManager.plan(room, state);
  const siteTypes = getSiteTypes(room);
  assert(
    siteTypes.includes(STRUCTURE_SPAWN),
    `RCL7 transition should place a second spawn site after the next planning cycle, got sites: ${siteTypes.join(",") || "none"}`,
  );
}

function runRcl8MineralCatchupScenario() {
  const room = buildRoomScenario("VAL_RCL8_MINERAL_CATCHUP", {
    tick: 680,
    controllerLevel: 7,
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
      ...Array.from({ length: 6 }, function (_, index) {
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
  room.storage.store.energy = 150000;

  let state = roomState.collect(room);
  assert(state.phase === "fortification", `expected fortification before upgrade, got ${state.phase}`);
  assert(
    state.buildStatus.specializationComplete,
    "expected specialization complete before the RCL8 mineral catch-up test",
  );

  room.controller.level = 8;
  const existingExtensions = room.find(FIND_STRUCTURES, {
    filter: function (structure) {
      return structure.structureType === STRUCTURE_EXTENSION;
    },
  }).length;
  const extensionPositions = pickOpenPositions(
    room,
    (CONTROLLER_STRUCTURES.extension[8] || 0) - existingExtensions,
  );
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

  state = roomState.collect(room);
  assert(state.phase === "development", `expected development catch-up at RCL8, got ${state.phase}`);
  assert(
    !state.buildStatus.specializationComplete,
    "expected RCL8 catch-up state to temporarily regress specializationComplete",
  );
  assert(
    constructionStatus.isMineralProgramUnlocked(room, state),
    "expected mature mineral infrastructure to keep mineral ops unlocked during RCL8 catch-up",
  );

  const mineral = room.find(FIND_MINERALS)[0];
  assert(
    spawnManager.shouldSpawnMineralMiner(room, state, mineral),
    "expected mineral miner respawn to stay enabled during RCL8 catch-up after unlock",
  );

  let report = roomReporting.build(room, state, { updateProgress: false });
  assert(
    report.nextTask === "place or finish the next tower",
    `expected next task to point at the next tower, got ${report.nextTask}`,
  );
  assert(
    report.sections.overview.some((line) => line.indexOf("Mineral ready") !== -1),
    `expected mineral reporting to stay ready instead of blocked, got ${report.sections.overview.join(" || ")}`,
  );

  constructionManager.plan(room, state);
  const siteTypes = getSiteTypes(room);
  assert(
    siteTypes.includes(STRUCTURE_TOWER),
    `expected RCL8 catch-up to keep placing towers, got sites: ${siteTypes.join(",") || "none"}`,
  );
  assert(
    siteTypes.includes(STRUCTURE_LAB),
    `expected RCL8 catch-up to place final labs alongside tower catch-up, got sites: ${siteTypes.join(",") || "none"}`,
  );

  createCreep("mineral_miner1", "mineral_miner", 39, 10, {
    roomName: room.name,
    memory: { targetId: mineral.id },
  });

  state = roomState.collect(room);
  report = roomReporting.build(room, state, { updateProgress: false });
  assert(
    report.sections.overview.some((line) => line.indexOf("Mineral active") !== -1),
    `expected active mineral reporting during RCL8 catch-up, got ${report.sections.overview.join(" || ")}`,
  );
}

function runLegacyTowerFallbackScenario() {
  const room = buildRoomScenario("VAL_LEGACY_TOWER_FALLBACK", {
    tick: 690,
    controllerLevel: 8,
    spawnX: 18,
    spawnY: 15,
    spawnEnergy: 300,
    energyAvailable: 12300,
    energyCapacityAvailable: 12300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "worker1", role: "worker", x: 20, y: 34 },
      { name: "miner1", role: "miner", x: 29, y: 19, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 33, y: 18, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 23, y: 12 },
      { name: "hauler2", role: "hauler", x: 18, y: 18 },
      { name: "upgrader1", role: "upgrader", x: 23, y: 39 },
    ],
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 13, y: 15, options: { store: { energy: 150000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TERMINAL, x: 13, y: 17, options: { store: { energy: 30000 }, storeCapacity: 300000, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_FACTORY, x: 14, y: 17, options: { store: { energy: 0 }, storeCapacity: 50000, hits: 1000, hitsMax: 1000, cooldown: 0 } },
      { type: STRUCTURE_CONTAINER, x: 8, y: 43, options: { store: {}, storeCapacity: 2000, hits: 250000, hitsMax: 250000 } },
      { type: STRUCTURE_EXTRACTOR, x: 9, y: 43, options: { hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_LINK, x: 11, y: 14, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 22, y: 41, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 28, y: 20, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 32, y: 19, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 11, options: { store: { energy: 800 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 19, options: { store: { energy: 800 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_TOWER, x: 14, y: 19, options: { store: { energy: 800 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
      ...Array.from({ length: 6 }, function (_, index) {
        return {
          type: STRUCTURE_LAB,
          x: 10 + (index % 2),
          y: 16 + index,
          options: { store: { energy: 1000 }, storeCapacity: 5000, storeCapacityResource: { energy: 2000 }, hits: 500, hitsMax: 500 },
        };
      }),
    ],
  });

  satisfyDevelopmentRequirements(room);
  room._structures = room._structures.filter(function (structure) {
    if (structure.structureType !== STRUCTURE_TOWER) return true;
    delete currentRuntime.objectsById[structure.id];
    return false;
  });
  room.addStructure(
    createStructure(STRUCTURE_TOWER, 22, 11, {
      roomName: room.name,
      store: { energy: 800 },
      storeCapacityResource: { energy: 1000 },
      hits: 3000,
      hitsMax: 3000,
    }),
  );
  room.addStructure(
    createStructure(STRUCTURE_TOWER, 22, 19, {
      roomName: room.name,
      store: { energy: 800 },
      storeCapacityResource: { energy: 1000 },
      hits: 3000,
      hitsMax: 3000,
    }),
  );
  room.addStructure(
    createStructure(STRUCTURE_TOWER, 14, 19, {
      roomName: room.name,
      store: { energy: 800 },
      storeCapacityResource: { energy: 1000 },
      hits: 3000,
      hitsMax: 3000,
    }),
  );
  room.addStructure(
    createStructure(STRUCTURE_EXTENSION, 14, 11, {
      roomName: room.name,
      store: { energy: 50 },
      storeCapacityResource: { energy: 50 },
      hits: 1000,
      hitsMax: 1000,
    }),
  );
  room.addStructure(
    createStructure(STRUCTURE_ROAD, 18, 9, {
      roomName: room.name,
      hits: 5000,
      hitsMax: 5000,
    }),
  );
  room.addStructure(
    createStructure(STRUCTURE_ROAD, 18, 21, {
      roomName: room.name,
      hits: 5000,
      hitsMax: 5000,
    }),
  );
  room.storage.store.energy = 150000;

  const state = roomState.collect(room);
  assert(state.phase === "development", `expected development catch-up, got ${state.phase}`);
  constructionManager.plan(room, state);

  const towerSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter(site) {
      return site.structureType === STRUCTURE_TOWER;
    },
  });

  assert(
    towerSites.length >= 3,
    `expected legacy layout to still place missing towers, got ${towerSites.length}`,
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
      { type: STRUCTURE_SPAWN, x: 27, y: 25, options: { name: "Spawn2", store: { energy: 300 }, storeCapacityResource: { energy: 300 }, hits: 5000, hitsMax: 5000 } },
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
  assert(status.spawnsNeeded === 3, "command should need all three spawns");
  assert(status.linksNeeded === 6, `command should unlock all six links, got ${status.linksNeeded}`);
  assert(status.observerNeeded === 1, "command should need observer");
  assert(status.powerSpawnNeeded === 1, "command should need power spawn");
  assert(status.nukerNeeded === 1, "command should need nuker");
  const report = roomReporting.build(room, state, { updateProgress: false });
  assert(
    report.nextTask === "place or finish the next spawn",
    `expected command next task to point at spawns, got ${report.nextTask}`,
  );
  assert(
    report.sections.build[2].indexOf("spawn 2/3") !== -1,
    `expected command build line to include spawn progress, got ${report.sections.build[2]}`,
  );

  constructionManager.plan(room, state);
  const siteTypes = getSiteTypes(room);
  assert(
    siteTypes.includes(STRUCTURE_SPAWN) ||
      siteTypes.includes(STRUCTURE_OBSERVER) ||
      siteTypes.includes(STRUCTURE_POWER_SPAWN) ||
      siteTypes.includes(STRUCTURE_NUKER),
    `command should place late-game command structure sites, got sites: ${siteTypes.join(",") || "none"}`,
  );

  ops.registerGlobals();
  const originalLog = console.log;
  const helpLines = [];
  console.log = function (line) {
    helpLines.push(String(line));
  };
  try {
    global.ops.help();
  } finally {
    console.log = originalLog;
  }
  assert(
    !helpLines.some(function (line) { return line.indexOf("ops.roomRole") !== -1; }),
    `expected help to omit roomRole command, got ${helpLines.join(" / ")}`,
  );
  assert(
    helpLines.some(function (line) { return line.indexOf("ops.expand(targetRoom, [parentRoom])") !== -1; }) &&
      helpLines.some(function (line) { return line.indexOf("ops.reserve(targetRoom, [parentRoom])") !== -1; }),
    `expected simplified expand/reserve help, got ${helpLines.join(" / ")}`,
  );
  assert(
    helpLines.some(function (line) { return line.indexOf("ops.terminalStatus([roomName])") !== -1; }) &&
      helpLines.some(function (line) { return line.indexOf("ops.clearTerminal(roomName, [resource], [amount])") !== -1; }) &&
      helpLines.some(function (line) { return line.indexOf("ops.fillTerminal(roomName, resource, amount)") !== -1; }) &&
      helpLines.some(function (line) { return line.indexOf("ops.requests([roomName], [mode])") !== -1; }) &&
      helpLines.some(function (line) { return line.indexOf('ops.cancelRequests(roomName, "blocked", [filters])') !== -1; }),
    `expected Layer 2 terminal hygiene help, got ${helpLines.join(" / ")}`,
  );
  assert(
    helpLines.every(function (line) { return line.length <= 100; }),
    `expected help output lines to stay within 100 chars, got ${helpLines.filter(function (line) { return line.length > 100; }).join(" / ")}`,
  );
}

function runCommandUtilityLinksScenario() {
  const room = buildRoomScenario("VAL_COMMAND_LINKS", {
    tick: 720,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 12900,
    energyCapacityAvailable: 12900,
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
      { type: STRUCTURE_SPAWN, x: 27, y: 25, options: { name: "Spawn2", store: { energy: 300 }, storeCapacityResource: { energy: 300 }, hits: 5000, hitsMax: 5000 } },
      { type: STRUCTURE_SPAWN, x: 23, y: 25, options: { name: "Spawn3", store: { energy: 300 }, storeCapacityResource: { energy: 300 }, hits: 5000, hitsMax: 5000 } },
      { type: STRUCTURE_TERMINAL, x: 25, y: 32, options: { store: { energy: 30000 }, storeCapacity: 300000, hits: 3000, hitsMax: 3000 } },
      { type: STRUCTURE_CONTAINER, x: 39, y: 10, options: { store: {}, storeCapacity: 2000, hits: 250000, hitsMax: 250000 } },
      { type: STRUCTURE_EXTRACTOR, x: 40, y: 10, options: { hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_FACTORY, x: 27, y: 30, options: { store: { energy: 0 }, storeCapacity: 50000, hits: 1000, hitsMax: 1000, cooldown: 0 } },
      { type: STRUCTURE_OBSERVER, x: 25, y: 19, options: { hits: 500, hitsMax: 500 } },
      { type: STRUCTURE_POWER_SPAWN, x: 27, y: 31, options: { store: { energy: 0, power: 0 }, storeCapacity: 5000, hits: 5000, hitsMax: 5000 } },
      { type: STRUCTURE_NUKER, x: 23, y: 22, options: { store: { energy: 0, G: 0 }, storeCapacity: 5000, hits: 1000, hitsMax: 1000 } },
      { type: STRUCTURE_LINK, x: 24, y: 30, options: { store: { energy: 400 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000, cooldown: 0 } },
      { type: STRUCTURE_LINK, x: 16, y: 25, options: { store: { energy: 800 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000, cooldown: 0 } },
      { type: STRUCTURE_LINK, x: 36, y: 25, options: { store: { energy: 800 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000, cooldown: 0 } },
      { type: STRUCTURE_LINK, x: 26, y: 30, options: { store: { energy: 0 }, storeCapacityResource: { energy: 800 }, hits: 1000, hitsMax: 1000, cooldown: 0 } },
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

  let state = roomState.collect(room);
  let status = constructionStatus.getStatus(room, state);
  assert(state.phase === "command", `expected command utility-link room to be command, got ${state.phase}`);
  assert(status.linksNeeded === 6, `expected command utility-link room to need six links, got ${status.linksNeeded}`);

  let report = roomReporting.build(room, state, { updateProgress: false });
  assert(
    report.nextTask === "finish planned links",
    `expected command utility-link next task to point at links, got ${report.nextTask}`,
  );
  assert(
    report.sections.build[2].indexOf("links 4/6") !== -1,
    `expected command utility-link build line to show 4/6 links, got ${report.sections.build[2]}`,
  );

  constructionManager.plan(room, state);
  let linkSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter(site) {
      return site.structureType === STRUCTURE_LINK;
    },
  });
  assert(
    linkSites.length >= 2,
    `expected command utility-link plan to place two link sites, got ${linkSites.length}`,
  );

  for (let i = 0; i < linkSites.length; i++) {
    room.addStructure(
      createStructure(STRUCTURE_LINK, linkSites[i].pos.x, linkSites[i].pos.y, {
        roomName: room.name,
        store: { energy: 0 },
        storeCapacityResource: { energy: 800 },
        hits: 1000,
        hitsMax: 1000,
        cooldown: 0,
      }),
    );
    linkSites[i].remove();
  }

  state = roomState.collect(room);
  status = constructionStatus.getStatus(room, state);
  assert(status.linksBuilt >= 6, `expected command utility-link room to build six links, got ${status.linksBuilt}`);
  assert(state.infrastructure.hasTerminalLink, "expected terminal utility link to be classified");
  assert(state.infrastructure.hasMineralLink, "expected mineral utility link to be classified");

  const summary = linkManager.run(room, state);
  assert(
    summary.storageToTerminal + summary.storageToMineral + summary.sourceToStorage + summary.sourceToController >= 1,
    `expected command utility-link runtime to perform at least one transfer, got ${JSON.stringify(summary)}`,
  );
}

function runMultiSpawnBalancingScenario() {
  const room = buildRoomScenario("VAL_MULTI_SPAWN_BALANCE", {
    tick: 740,
    controllerLevel: 7,
    spawnEnergy: 300,
    energyAvailable: 2300,
    energyCapacityAvailable: 2300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "miner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "miner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "hauler1", role: "hauler", x: 25, y: 24, memory: { sourceId: "source1" } },
      { name: "hauler2", role: "hauler", x: 26, y: 24, memory: { sourceId: "source2" } },
    ],
    extraStructures: [
      { type: STRUCTURE_SPAWN, x: 27, y: 25, options: { name: "Spawn2", store: { energy: 300 }, storeCapacityResource: { energy: 300 }, hits: 5000, hitsMax: 5000 } },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = 50000;

  const state = roomState.collect(room);
  state.defense = {
    activeThreats: [
      {
        roomName: room.name,
        desiredDefenders: 1,
        priority: 200,
        threatLevel: 1,
        threatScore: 10,
        responseRole: "defender",
        spawnCooldown: 0,
      },
    ],
  };

  spawnManager.run(room, state);

  assert(
    currentRuntime.spawnEvents.length === 2,
    `expected both spawns to be used in one tick, got ${currentRuntime.spawnEvents.length}`,
  );

  const roles = currentRuntime.spawnEvents.map(function (event) {
    return event.role;
  });
  const spawnIds = currentRuntime.spawnEvents.map(function (event) {
    return event.spawnId;
  });
  assert(
    roles.includes("defender"),
    `expected one defense spawn assignment, got ${roles.join(",") || "none"}`,
  );
  assert(
    roles.some(function (role) {
      return role !== "defender";
    }),
    `expected one non-defense spawn assignment, got ${roles.join(",") || "none"}`,
  );
  assert(
    new Set(spawnIds).size === 2,
    `expected both idle spawns to participate, got ${spawnIds.join(",") || "none"}`,
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

function withPowerSettings(overrides, fn) {
  const previous = Object.assign({}, config.POWER);
  config.POWER = Object.assign({}, config.POWER, overrides || {});

  try {
    fn();
  } finally {
    config.POWER = previous;
  }
}

function withPowerCreepSettings(overrides, fn) {
  const previous = Object.assign({}, config.POWER_CREEPS || {});
  config.POWER_CREEPS = Object.assign({}, config.POWER_CREEPS || {}, overrides || {});

  try {
    fn();
  } finally {
    config.POWER_CREEPS = previous;
  }
}

function buildPowerProcessingRoom(name, options) {
  const settings = options || {};
  const room = buildRoomScenario(name, {
    tick: settings.tick || 840,
    controllerLevel: settings.controllerLevel || 8,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    hostiles: settings.hostiles || null,
    extraStructures: [
      {
        type: STRUCTURE_POWER_SPAWN,
        x: 27,
        y: 31,
        options: {
          store: {
            energy: settings.powerSpawnEnergy !== undefined ? settings.powerSpawnEnergy : 500,
            power: settings.powerSpawnPower !== undefined ? settings.powerSpawnPower : 10,
          },
          storeCapacity: 5000,
          hits: 5000,
          hitsMax: 5000,
        },
      },
    ],
  });

  room.controller.my = true;
  satisfyDevelopmentRequirements(room);
  room.storage.store.energy =
    settings.storageEnergy !== undefined ? settings.storageEnergy : 200000;
  room.addStructure(
    createStructure(STRUCTURE_TERMINAL, 25, 32, {
      roomName: room.name,
      store: settings.terminalStore || { energy: 10000, power: 250 },
      storeCapacity: 300000,
      hits: 3000,
      hitsMax: 3000,
    }),
  );

  return room;
}

function runPowerSpawnProcessingScenario() {
  withPowerSettings({ MIN_STORAGE_ENERGY: 50000, MIN_TERMINAL_ENERGY: 0 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_READY");
    const state = roomState.collect(room);

    powerManager.run(room, state);

    const memory = Memory.rooms[room.name].power;
    assert(memory.readiness === "PROCESSED", `expected PROCESSED, got ${memory.readiness}`);
    assert(memory.lastProcessed === Game.time, `expected lastProcessed ${Game.time}, got ${memory.lastProcessed}`);
    assert(memory.totalProcessed === 1, `expected totalProcessed 1, got ${memory.totalProcessed}`);
    assert(memory.powerSpawnEnergy === 500, "memory should report pre-process Power Spawn energy");
    assert(memory.powerSpawnPower === 10, "memory should report pre-process Power Spawn power");

    const powerSpawn = state.structuresByType[STRUCTURE_POWER_SPAWN][0];
    assert(powerSpawn.store.energy === 450, `expected processPower to consume energy, got ${powerSpawn.store.energy}`);
    assert(powerSpawn.store.power === 9, `expected processPower to consume power, got ${powerSpawn.store.power}`);
  });
}

function runPowerSpawnReserveBlockScenario() {
  withPowerSettings({ MIN_STORAGE_ENERGY: 50000 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_RESERVE", {
      storageEnergy: 49999,
    });
    const state = roomState.collect(room);

    powerManager.run(room, state);

    const memory = Memory.rooms[room.name].power;
    assert(
      memory.readiness === "BLOCKED_STORAGE_RESERVE",
      `expected storage reserve block, got ${memory.readiness}`,
    );
    assert(memory.lastProcessed === undefined, "storage reserve block should not process power");
  });
}

function runPowerSpawnThreatBlockScenario() {
  withPowerSettings({ PROCESS_UNDER_THREAT: false }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_THREAT", {
      hostiles: [
        {
          name: "hostile_power_block",
          x: 26,
          y: 25,
          body: [{ type: ATTACK }, { type: MOVE }],
        },
      ],
    });
    const state = roomState.collect(room);

    powerManager.run(room, state);

    const memory = Memory.rooms[room.name].power;
    assert(memory.readiness === "BLOCKED_THREAT", `expected threat block, got ${memory.readiness}`);
    assert(memory.lastProcessed === undefined, "threat block should not process power");
  });
}

function runPowerSpawnCpuBlockScenario() {
  withPowerSettings({ PROCESS_UNDER_CRITICAL_CPU: false }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_CPU");
    Memory.stats = {
      runtime: {
        pressure: "critical",
      },
    };
    const state = roomState.collect(room);

    powerManager.run(room, state);

    const memory = Memory.rooms[room.name].power;
    assert(
      memory.readiness === "BLOCKED_CPU_PRESSURE",
      `expected CPU pressure block, got ${memory.readiness}`,
    );
    assert(memory.lastProcessed === undefined, "CPU pressure block should not process power");
  });
}

function runPowerReportingScenario() {
  withPowerSettings({ MIN_STORAGE_ENERGY: 50000 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_REPORT");
    const state = roomState.collect(room);
    powerManager.run(room, state);

    ops.registerGlobals();
    const captured = captureConsoleLines(function () {
      return global.ops.room(room.name, "power");
    });

    assert(
      captured.lines.some(function (line) { return line === `[OPS][${room.name}][POWER]`; }),
      `expected power report header, got ${captured.lines.join(" / ")}`,
    );
    assert(
      captured.lines.some(function (line) { return line.indexOf("Readiness PROCESSED") !== -1; }),
      `expected readiness in power report, got ${captured.lines.join(" / ")}`,
    );
    assert(
      captured.lines.some(function (line) { return line.indexOf("Terminal Power 250") !== -1; }),
      `expected terminal power staging in report, got ${captured.lines.join(" / ")}`,
    );
    assert(roomReporting.normalizeSection("power") === "power", "power section should normalize");
  });
}

function runPowerOperatorControlsScenario() {
  withPowerSettings({ ENABLED: true, REFILL_ENABLED: true, MIN_STORAGE_ENERGY: 50000, POWER_SPAWN_ENERGY_TARGET: 5000, POWER_SPAWN_POWER_TARGET: 100, REFILL_INTERVAL: 1 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_CONTROLS", {
      powerSpawnEnergy: 500,
      powerSpawnPower: 20,
      storageEnergy: 200000,
      terminalStore: { energy: 12000, power: 250 },
    });
    const state = roomState.collect(room);

    ops.registerGlobals();
    assert(typeof global.ops.power === "function", "ops.power should be registered");

    powerManager.run(room, state);

    let captured = captureConsoleLines(function () {
      return global.ops.power();
    });
    assert(typeof captured.result === "string", "ops.power summary should return a printable string");
    assert(
      captured.result.indexOf("[OPS] Power Spawn status") !== -1 &&
        captured.result.indexOf(`[OPS][${room.name}][POWER]`) !== -1,
      `ops.power summary should include room power status, got ${captured.result}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.power(room.name);
    });
    assert(
      captured.result === `[OPS][${room.name}][POWER] report generated`,
      `ops.power(room) should return concise detail status, got ${captured.result}`,
    );
    assert(
      captured.lines.some(function (line) { return line.indexOf("Global process on refill on") !== -1; }) &&
        captured.lines.some(function (line) { return line.indexOf("Effective process on refill on") !== -1; }),
      `ops.power(room) should show policy state, got ${captured.lines.join(" / ")}`,
    );

    let result = global.ops.power(room.name, "process", "off");
    assert(typeof result === "string" && result.indexOf("process off") !== -1, `process off should print policy, got ${result}`);
    Game.time += 1;
    powerManager.run(room, state);
    assert(
      Memory.rooms[room.name].power.readiness === "BLOCKED_DISABLED",
      `processing override off should block processing, got ${Memory.rooms[room.name].power.readiness}`,
    );
    assert(
      Memory.rooms[room.name].power.effectiveRefillEnabled === true,
      "processing override should not disable refill",
    );

    result = global.ops.power(room.name, "process", "on");
    assert(typeof result === "string" && result.indexOf("process on") !== -1, `process on should print policy, got ${result}`);
    result = global.ops.power(room.name, "refill", "off");
    assert(typeof result === "string" && result.indexOf("refill off") !== -1, `refill off should print policy, got ${result}`);

    Memory.ops = { logistics: { requests: {} } };
    Game.time += 1;
    powerManager.run(room, state);
    assert(
      Memory.rooms[room.name].power.effectiveProcessingEnabled === true,
      "refill override should not disable processing",
    );
    assert(
      Memory.rooms[room.name].power.refillState === "REFILL_BLOCKED_DISABLED",
      `refill override off should block refill, got ${Memory.rooms[room.name].power.refillState}`,
    );
    assert(
      getOpenPowerSpawnRefillRequests(room.name).length === 0,
      "refill off should create no refill requests",
    );

    result = global.ops.power(room.name, "off");
    assert(
      typeof result === "string" && result.indexOf("process off refill off") !== -1,
      `power off should disable both toggles, got ${result}`,
    );
    Game.time += 1;
    powerManager.run(room, state);
    assert(
      Memory.rooms[room.name].power.effectiveProcessingEnabled === false &&
        Memory.rooms[room.name].power.effectiveRefillEnabled === false,
      "power off should disable both effective controls",
    );

    result = global.ops.power(room.name, "on");
    assert(
      typeof result === "string" && result.indexOf("process on refill on") !== -1,
      `power on should enable both toggles, got ${result}`,
    );
    result = global.ops.power(room.name, "reserve", 75000);
    assert(
      typeof result === "string" && result.indexOf("reserve 75,000") !== -1,
      `reserve override should be printable, got ${result}`,
    );
    Game.time += 1;
    powerManager.run(room, state);
    assert(
      Memory.rooms[room.name].power.minStorageEnergy === 75000,
      `reserve override should update effective reserve, got ${Memory.rooms[room.name].power.minStorageEnergy}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.room(room.name, "power");
    });
    assert(
      captured.lines.some(function (line) { return line === `[OPS][${room.name}][POWER]`; }),
      `ops.room(room, power) should still print power section, got ${captured.lines.join(" / ")}`,
    );
  });
}

function runPclReadinessCommandsScenario() {
  withPowerSettings({ MIN_STORAGE_ENERGY: 50000, PROCESS_UNDER_CRITICAL_CPU: false }, function () {
    const room = buildPowerProcessingRoom("VAL_PCL_READY", {
      tick: 870,
      powerSpawnEnergy: 500,
      powerSpawnPower: 10,
      storageEnergy: 200000,
      terminalStore: { energy: 12000, power: 250 },
    });
    const state = roomState.collect(room);
    powerManager.run(room, state);

    ops.registerGlobals();
    assert(typeof global.ops.pcl === "function", "ops.pcl should be registered");
    assert(typeof global.ops.powerCreeps === "function", "ops.powerCreeps should be registered");
    assert(typeof global.ops.powerEnable === "function", "ops.powerEnable should be registered");

    let captured = captureConsoleLines(function () {
      return global.ops.pcl();
    });
    assert(typeof captured.result === "string", "ops.pcl should return a printable string");
    assert(
      captured.result.indexOf("[OPS][PCL] GPL 0") !== -1 &&
        captured.result.indexOf("Game.gpl unavailable") !== -1,
      `ops.pcl should handle missing Game.gpl safely, got ${captured.result}`,
    );

    Game.gpl = {
      level: 3,
      progress: 500,
      progressTotal: 1000,
    };
    Game.powerCreeps = {
      OperatorOne: {
        name: "OperatorOne",
        className: "operator",
        level: 4,
        ticksToLive: 1234,
        room: room,
        shard: { name: "shard0" },
        powers: {
          PWR_GENERATE_OPS: { level: 1 },
          PWR_OPERATE_EXTENSION: { level: 2 },
        },
        store: createStore({ ops: 75 }, null, 100),
      },
      OperatorTwo: {
        name: "OperatorTwo",
        className: "operator",
        level: 1,
        powers: {},
      },
    };

    captured = captureConsoleLines(function () {
      return global.ops.pcl(room.name);
    });
    assert(
      captured.result.indexOf("GPL 3 | 500/1,000 (50.0%)") !== -1 &&
        captured.result.indexOf("known 2 spawned 1 unspawned 1 slots 1") !== -1,
      `ops.pcl should report GPL/PCL counts, got ${captured.result}`,
    );
    assert(
      captured.result.indexOf(`[OPS][${room.name}][POWER_ENABLE] READY_TO_ENABLE`) !== -1,
      `ops.pcl(room) should include room enablement summary, got ${captured.result}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreeps();
    });
    assert(typeof captured.result === "string", "ops.powerCreeps should return a printable string");
    assert(
      captured.result.indexOf("known 2 spawned 1") !== -1 &&
        captured.result.indexOf("OperatorOne | operator L4 | spawned") !== -1 &&
        captured.result.indexOf("ttl 1234") !== -1 &&
        captured.result.indexOf("ops 75") !== -1 &&
        captured.result.indexOf("PWR_GENERATE_OPS") !== -1 &&
        captured.result.indexOf("OperatorTwo | operator L1 | unspawned") !== -1,
      `ops.powerCreeps should list friendly Power Creeps, got ${captured.result}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerEnable(room.name, "check");
    });
    assert(typeof captured.result === "string", "ops.powerEnable check should return a printable string");
    assert(
      captured.result.indexOf("READY_TO_ENABLE") !== -1 &&
        captured.result.indexOf("OK owned room") !== -1 &&
        captured.result.indexOf("OK RCL8") !== -1 &&
        captured.result.indexOf("OK Power Spawn processing healthy") !== -1 &&
        captured.result.indexOf("dry run only; enableRoom not called") !== -1,
      `ops.powerEnable should print readiness checklist, got ${captured.result}`,
    );
    assert(
      currentRuntime.enableRoomActions.length === 0,
      `powerEnable check must not call enableRoom, got ${JSON.stringify(currentRuntime.enableRoomActions)}`,
    );

    const missingRoomReport = global.ops.powerEnable("VAL_PCL_MISSING", "check");
    assert(
      missingRoomReport.indexOf("BLOCKED_NOT_OWNED") !== -1,
      `missing room should report BLOCKED_NOT_OWNED, got ${missingRoomReport}`,
    );

    const noPowerCreepsMemory = JSON.stringify(Memory);
    Game.powerCreeps = {};
    captured = captureConsoleLines(function () {
      return global.ops.powerCreeps();
    });
    assert(
      captured.result.indexOf("known 0 spawned 0") !== -1 &&
        captured.result.indexOf("none") !== -1,
      `zero Power Creeps should be safe, got ${captured.result}`,
    );
    assert(JSON.stringify(Memory) === noPowerCreepsMemory, "Power Creep reporting should not mutate Memory");
  });
}

function runPclBlockedReadinessScenario() {
  withPowerSettings({ MIN_STORAGE_ENERGY: 50000, PROCESS_UNDER_CRITICAL_CPU: false }, function () {
    let room = buildPowerProcessingRoom("VAL_PCL_BLOCK_RCL", {
      tick: 875,
      controllerLevel: 7,
      storageEnergy: 200000,
    });
    room.controller.level = 7;
    ops.registerGlobals();
    let report = global.ops.powerEnable(room.name, "check");
    assert(report.indexOf("BLOCKED_RCL") !== -1, `RCL block should report BLOCKED_RCL, got ${report}`);

    room = buildRoomScenario("VAL_PCL_BLOCK_NO_PS", {
      tick: 876,
      controllerLevel: 8,
      spawnEnergy: 1300,
      energyAvailable: 1300,
      energyCapacityAvailable: 1300,
      sourceContainers: true,
      supportContainers: true,
      foundationRoads: true,
      backboneRoads: true,
    });
    room.controller.my = true;
    room.controller.owner = { username: "tester" };
    satisfyDevelopmentRequirements(room);
    room.storage.store.energy = 200000;
    report = global.ops.powerEnable(room.name, "check");
    assert(
      report.indexOf("BLOCKED_NO_POWER_SPAWN") !== -1,
      `missing Power Spawn should report BLOCKED_NO_POWER_SPAWN, got ${report}`,
    );

    room = buildPowerProcessingRoom("VAL_PCL_BLOCK_THREAT", {
      tick: 877,
      storageEnergy: 200000,
      hostiles: [
        {
          name: "pclHostile",
          x: 25,
          y: 26,
          body: [{ type: ATTACK }, { type: MOVE }],
        },
      ],
    });
    powerManager.run(room, roomState.collect(room));
    report = global.ops.powerEnable(room.name, "check");
    assert(report.indexOf("BLOCKED_THREAT") !== -1, `threat should block enablement, got ${report}`);

    room = buildPowerProcessingRoom("VAL_PCL_BLOCK_CPU", {
      tick: 878,
      storageEnergy: 200000,
    });
    Memory.stats.runtime = { pressure: "critical" };
    powerManager.run(room, roomState.collect(room));
    report = global.ops.powerEnable(room.name, "check");
    assert(
      report.indexOf("BLOCKED_CPU_PRESSURE") !== -1,
      `critical CPU should block enablement, got ${report}`,
    );
    assert(currentRuntime.enableRoomActions.length === 0, "blocked readiness checks should not call enableRoom");
  });
}

function runPowerCreepLifecycleControlsScenario() {
  withPowerSettings({ MIN_STORAGE_ENERGY: 50000, PROCESS_UNDER_CRITICAL_CPU: false }, function () {
    let room = buildPowerProcessingRoom("VAL_PC_LIFE_SPAWN", {
      tick: 879,
      storageEnergy: 200000,
      powerSpawnEnergy: 500,
      powerSpawnPower: 10,
    });
    powerManager.run(room, roomState.collect(room));
    ops.registerGlobals();
    assert(typeof global.ops.powerCreep === "function", "ops.powerCreep should be registered");

    createPowerCreep("OperatorSpawn", 0, 0, {
      spawned: false,
      level: 3,
    });

    let captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorSpawn", "spawn", room.name, "check");
    });
    assert(typeof captured.result === "string", "spawn check should return a clean string");
    assert(
      captured.result.indexOf("action spawn | mode check") !== -1 &&
        captured.result.indexOf("status READY") !== -1 &&
        captured.result.indexOf("native powerSpawn.spawnPowerCreep(powerCreep)") !== -1 &&
        captured.result.indexOf("dry run only; native action not called") !== -1,
      `spawn check should explain readiness and native call, got ${captured.result}`,
    );
    assert(
      currentRuntime.spawnPowerCreepActions.length === 0,
      `spawn check must not call spawnPowerCreep, got ${JSON.stringify(currentRuntime.spawnPowerCreepActions)}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorSpawn", "spawn", room.name, "confirm");
    });
    assert(
      captured.result.indexOf("status EXECUTED") !== -1 &&
        captured.result.indexOf("API result 0 (OK)") !== -1,
      `spawn confirm should execute with result, got ${captured.result}`,
    );
    assert(
      currentRuntime.spawnPowerCreepActions.length === 1 &&
        currentRuntime.spawnPowerCreepActions[0].powerCreepName === "OperatorSpawn",
      `spawn confirm should call spawnPowerCreep once, got ${JSON.stringify(currentRuntime.spawnPowerCreepActions)}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorSpawn", "spawn", room.name, "confirm");
    });
    assert(
      captured.result.indexOf("BLOCKED_ALREADY_SPAWNED") !== -1 &&
        currentRuntime.spawnPowerCreepActions.length === 1,
      `spawn confirm should block already-spawned Power Creeps, got ${captured.result}`,
    );

    room = buildPowerProcessingRoom("VAL_PC_LIFE_RENEW", {
      tick: 880,
      storageEnergy: 200000,
      powerSpawnEnergy: 500,
      powerSpawnPower: 10,
    });
    powerManager.run(room, roomState.collect(room));
    ops.registerGlobals();
    createPowerCreep("OperatorRenew", 27, 32, {
      roomName: room.name,
      ticksToLive: 500,
    });

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorRenew", "renew", room.name, "check");
    });
    assert(
      captured.result.indexOf("action renew | mode check") !== -1 &&
        captured.result.indexOf("status READY") !== -1 &&
        captured.result.indexOf("native powerSpawn.renewPowerCreep(powerCreep)") !== -1,
      `renew check should explain readiness and native call, got ${captured.result}`,
    );
    assert(
      currentRuntime.renewPowerCreepActions.length === 0,
      `renew check must not call renewPowerCreep, got ${JSON.stringify(currentRuntime.renewPowerCreepActions)}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorRenew", "renew", room.name, "confirm");
    });
    assert(
      captured.result.indexOf("status EXECUTED") !== -1 &&
        captured.result.indexOf("API result 0 (OK)") !== -1,
      `renew confirm should execute with result, got ${captured.result}`,
    );
    assert(
      currentRuntime.renewPowerCreepActions.length === 1 &&
        currentRuntime.renewPowerCreepActions[0].powerCreepName === "OperatorRenew",
      `renew confirm should call renewPowerCreep once, got ${JSON.stringify(currentRuntime.renewPowerCreepActions)}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("MissingRenew", "renew", room.name, "confirm");
    });
    assert(
      captured.result.indexOf("BLOCKED_MISSING_POWER_CREEP") !== -1 &&
        currentRuntime.renewPowerCreepActions.length === 1,
      `renew confirm should block missing Power Creeps, got ${captured.result}`,
    );

    const otherRoom = new FakeRoom("VAL_PC_OTHER", new FakeTerrain());
    otherRoom.setController(
      createController(20, 20, {
        roomName: otherRoom.name,
        level: 8,
        my: true,
        owner: { username: "tester" },
      }),
    );
    createPowerCreep("OperatorWrongRoom", 25, 25, {
      roomName: otherRoom.name,
      ticksToLive: 1000,
    });
    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorWrongRoom", "renew", room.name, "confirm");
    });
    assert(
      captured.result.indexOf("BLOCKED_ROOM_MISMATCH") !== -1 &&
        currentRuntime.renewPowerCreepActions.length === 1,
      `renew confirm should block wrong-room Power Creeps, got ${captured.result}`,
    );

    room = buildPowerProcessingRoom("VAL_PC_LIFE_ENABLE", {
      tick: 881,
      storageEnergy: 200000,
      powerSpawnEnergy: 500,
      powerSpawnPower: 10,
    });
    powerManager.run(room, roomState.collect(room));
    ops.registerGlobals();
    createPowerCreep("OperatorEnable", 20, 21, {
      roomName: room.name,
      ticksToLive: 1000,
    });

    captured = captureConsoleLines(function () {
      return global.ops.powerEnable(room.name, "check");
    });
    assert(
      captured.result.indexOf("READY_TO_ENABLE") !== -1 &&
        captured.result.indexOf("dry run only; enableRoom not called") !== -1,
      `powerEnable check should remain dry-run only, got ${captured.result}`,
    );
    assert(
      currentRuntime.enableRoomActions.length === 0,
      `powerEnable check must not call enableRoom, got ${JSON.stringify(currentRuntime.enableRoomActions)}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerEnable(room.name, "confirm", "OperatorEnable");
    });
    assert(
      captured.result.indexOf("action enable | mode confirm") !== -1 &&
        captured.result.indexOf("status EXECUTED") !== -1 &&
        captured.result.indexOf("native powerCreep.enableRoom(room.controller)") !== -1 &&
        captured.result.indexOf("API result 0 (OK)") !== -1,
      `powerEnable confirm should execute with readable result, got ${captured.result}`,
    );
    assert(
      currentRuntime.enableRoomActions.length === 1 &&
        currentRuntime.enableRoomActions[0].roomName === room.name,
      `powerEnable confirm should call enableRoom once, got ${JSON.stringify(currentRuntime.enableRoomActions)}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerEnable(room.name, "confirm");
    });
    assert(
      captured.result.indexOf("BLOCKED_MISSING_POWER_CREEP") !== -1 &&
        currentRuntime.enableRoomActions.length === 1,
      `powerEnable confirm should require named Power Creep, got ${captured.result}`,
    );

    const invalidEnable = global.ops.powerEnable(room.name, "execute", "OperatorEnable");
    assert(
      invalidEnable.indexOf('mode must be "check" or "confirm"') !== -1 &&
        currentRuntime.enableRoomActions.length === 1,
      `powerEnable should block non-confirm execution modes, got ${invalidEnable}`,
    );

    const zeroRoom = buildPowerProcessingRoom("VAL_PC_LIFE_ZERO", {
      tick: 882,
      storageEnergy: 200000,
    });
    powerManager.run(zeroRoom, roomState.collect(zeroRoom));
    ops.registerGlobals();
    Game.powerCreeps = {};
    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("Nobody", "spawn", zeroRoom.name, "check");
    });
    assert(
      captured.result.indexOf("BLOCKED_NO_POWER_CREEPS") !== -1,
      `zero Power Creeps should be handled safely, got ${captured.result}`,
    );

    delete Game.powerCreeps;
    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("Nobody", "spawn", zeroRoom.name, "check");
    });
    assert(
      captured.result.indexOf("BLOCKED_NO_POWER_CREEPS") !== -1,
      `missing Game.powerCreeps should be handled safely, got ${captured.result}`,
    );

    Game.powerCreeps = {};
    assert(typeof global.ops.pcl(zeroRoom.name) === "string", "ops.pcl should still work");
    assert(typeof global.ops.powerCreeps() === "string", "ops.powerCreeps should still work");
    assert(typeof global.ops.power(zeroRoom.name) === "string", "ops.power should still work");
    captured = captureConsoleLines(function () {
      return global.ops.room(zeroRoom.name, "power");
    });
    assert(
      captured.lines.some(function (line) { return line === `[OPS][${zeroRoom.name}][POWER]`; }),
      `ops.room(room, power) should still print power section, got ${captured.lines.join(" / ")}`,
    );
  });
}

function runPowerCreepPositioningSupportScenario() {
  withPowerSettings({ MIN_STORAGE_ENERGY: 50000, PROCESS_UNDER_CRITICAL_CPU: false }, function () {
    const room = buildPowerProcessingRoom("VAL_PC_POSITION", {
      tick: 883,
      storageEnergy: 200000,
      powerSpawnEnergy: 500,
      powerSpawnPower: 10,
    });
    powerManager.run(room, roomState.collect(room));
    ops.registerGlobals();

    createPowerCreep("OperatorMover", 20, 25, {
      roomName: room.name,
      ticksToLive: 1000,
    });

    let captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorMover", "position", room.name);
    });
    assert(typeof captured.result === "string", "position command should return a clean string");
    assert(
      captured.result.indexOf("action position | mode check") !== -1 &&
        captured.result.indexOf("current " + room.name + ":20,25") !== -1 &&
        captured.result.indexOf("target Power Spawn") !== -1 &&
        captured.result.indexOf("target Controller") !== -1 &&
        captured.result.indexOf("target Staging") !== -1 &&
        captured.result.indexOf("[object Object]") === -1,
      `position command should report clean target strings, got ${captured.result}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorMover", "move", room.name, "powerSpawn", "check");
    });
    assert(
      captured.result.indexOf("action move | mode check") !== -1 &&
        captured.result.indexOf("target Power Spawn") !== -1 &&
        captured.result.indexOf("dry run only; moveTo not called") !== -1,
      `move check should report Power Spawn target without moving, got ${captured.result}`,
    );
    assert(
      currentRuntime.powerCreepMoveActions.length === 0,
      `move check must not call moveTo, got ${JSON.stringify(currentRuntime.powerCreepMoveActions)}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorMover", "move", room.name, "powerSpawn", "confirm");
    });
    assert(
      captured.result.indexOf("status EXECUTED") !== -1 &&
        captured.result.indexOf("moveTo result 0 (OK)") !== -1,
      `move confirm should execute with readable moveTo result, got ${captured.result}`,
    );
    assert(
      currentRuntime.powerCreepMoveActions.length === 1 &&
        currentRuntime.powerCreepMoveActions[0].powerCreepName === "OperatorMover" &&
        currentRuntime.powerCreepMoveActions[0].targetType === STRUCTURE_POWER_SPAWN,
      `move confirm should call moveTo once for Power Spawn, got ${JSON.stringify(currentRuntime.powerCreepMoveActions)}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorMover", "move", room.name, "controller", "confirm");
    });
    assert(
      captured.result.indexOf("target Controller") !== -1 &&
        captured.result.indexOf("moveTo result 0 (OK)") !== -1,
      `controller move should resolve controller target, got ${captured.result}`,
    );
    assert(
      currentRuntime.powerCreepMoveActions.length === 2 &&
        currentRuntime.powerCreepMoveActions[1].targetType === "controller",
      `controller move confirm should call moveTo on controller, got ${JSON.stringify(currentRuntime.powerCreepMoveActions)}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorMover", "move", room.name, "staging", "confirm");
    });
    assert(
      captured.result.indexOf("target Staging") !== -1 &&
        captured.result.indexOf("default staging target is Power Spawn") !== -1 &&
        captured.result.indexOf("moveTo result 0 (OK)") !== -1,
      `staging move should default to Power Spawn, got ${captured.result}`,
    );
    assert(
      currentRuntime.powerCreepMoveActions.length === 3 &&
        currentRuntime.powerCreepMoveActions[2].targetType === STRUCTURE_POWER_SPAWN,
      `staging move should call moveTo on Power Spawn, got ${JSON.stringify(currentRuntime.powerCreepMoveActions)}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorMover", "move", room.name, "controller");
    });
    assert(
      captured.result.indexOf("BLOCKED_INVALID_MODE") !== -1 &&
        captured.result.indexOf("moveTo not called") !== -1 &&
        currentRuntime.powerCreepMoveActions.length === 3,
      `move without explicit confirm should block and avoid moveTo, got ${captured.result}`,
    );

    createPowerCreep("OperatorUnspawned", 1, 1, {
      roomName: room.name,
      spawned: false,
    });
    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorUnspawned", "move", room.name, "controller", "confirm");
    });
    assert(
      captured.result.indexOf("BLOCKED_NOT_SPAWNED") !== -1 &&
        currentRuntime.powerCreepMoveActions.length === 3,
      `unspawned Power Creep movement should block, got ${captured.result}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("MissingMover", "move", room.name, "controller", "confirm");
    });
    assert(
      captured.result.indexOf("BLOCKED_MISSING_POWER_CREEP") !== -1 &&
        currentRuntime.powerCreepMoveActions.length === 3,
      `missing named Power Creep movement should block, got ${captured.result}`,
    );

    delete Game.powerCreeps;
    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorMover", "move", room.name, "controller", "confirm");
    });
    assert(
      captured.result.indexOf("BLOCKED_NO_POWER_CREEPS") !== -1 &&
        currentRuntime.powerCreepMoveActions.length === 3,
      `missing Game.powerCreeps should be handled safely, got ${captured.result}`,
    );
  });
}

function runPowerCreepRenewalAssistScenario() {
  withPowerSettings({ MIN_STORAGE_ENERGY: 50000, PROCESS_UNDER_CRITICAL_CPU: false }, function () {
    withPowerCreepSettings({
      RENEW_ASSIST_ENABLED: true,
      RENEW_TTL_THRESHOLD: 1000,
      RENEW_TARGET_TTL: 4500,
      MOVE_REUSE_PATH: 3,
    }, function () {
      const room = buildPowerProcessingRoom("VAL_PC_RENEW_ASSIST", {
        tick: 889,
        storageEnergy: 200000,
        powerSpawnEnergy: 500,
        powerSpawnPower: 10,
      });
      powerManager.run(room, roomState.collect(room));
      ops.registerGlobals();

      let result = global.ops.powerCreep("OperatorRemove", "assign", room.name);
      assert(result.indexOf("assigned " + room.name) !== -1, `assign should print bounded status, got ${result}`);
      assert(
        Memory.powerCreeps.OperatorRemove.homeRoom === room.name &&
          Memory.powerCreeps.OperatorRemove.renewalAssist === true &&
          Memory.powerCreeps.OperatorRemove.updated === Game.time,
        `assign should store bounded assignment, got ${JSON.stringify(Memory.powerCreeps.OperatorRemove)}`,
      );
      result = global.ops.powerCreep("OperatorRemove", "unassign");
      assert(result.indexOf("unassigned") !== -1, `unassign should print status, got ${result}`);
      assert(!Memory.powerCreeps.OperatorRemove, "unassign should remove assignment memory");

      result = global.ops.powerCreep("OperatorRenewAssist", "assign", room.name);
      assert(result.indexOf("renewAssist on") !== -1, `assign should default assist on, got ${result}`);
      result = global.ops.powerCreep("OperatorRenewAssist", "renewAssist", "off");
      assert(
        result.indexOf("renewAssist off") !== -1 &&
          Memory.powerCreeps.OperatorRenewAssist.renewalAssist === false,
        `renewAssist off should update memory, got ${result}`,
      );
      result = global.ops.powerCreep("OperatorRenewAssist", "renewAssist", "on");
      assert(
        result.indexOf("renewAssist on") !== -1 &&
          Memory.powerCreeps.OperatorRenewAssist.renewalAssist === true,
        `renewAssist on should update memory, got ${result}`,
      );

      const operator = createPowerCreep("OperatorRenewAssist", 20, 25, {
        roomName: room.name,
        ticksToLive: 1500,
      });

      pclManager.runRenewalAssist();
      assert(
        currentRuntime.powerCreepMoveActions.length === 0 &&
          currentRuntime.renewPowerCreepActions.length === 0,
        "renewal assist should do nothing above threshold",
      );
      assert(
        Memory.powerCreeps.OperatorRenewAssist.renewal.status === "IDLE_ABOVE_THRESHOLD",
        `expected above-threshold idle, got ${JSON.stringify(Memory.powerCreeps.OperatorRenewAssist.renewal)}`,
      );

      operator.ticksToLive = 500;
      pclManager.runRenewalAssist();
      assert(
        currentRuntime.powerCreepMoveActions.length === 1 &&
          currentRuntime.powerCreepMoveActions[0].powerCreepName === "OperatorRenewAssist" &&
          currentRuntime.powerCreepMoveActions[0].targetType === STRUCTURE_POWER_SPAWN &&
          currentRuntime.renewPowerCreepActions.length === 0,
        `renewal assist should move toward Power Spawn below threshold, got moves ${JSON.stringify(currentRuntime.powerCreepMoveActions)} renews ${JSON.stringify(currentRuntime.renewPowerCreepActions)}`,
      );
      assert(
        Memory.powerCreeps.OperatorRenewAssist.renewal.status === "MOVING_TO_POWER_SPAWN" &&
          Memory.powerCreeps.OperatorRenewAssist.renewal.moveResult === OK,
        `expected move status, got ${JSON.stringify(Memory.powerCreeps.OperatorRenewAssist.renewal)}`,
      );

      operator.pos = new RoomPosition(27, 32, room.name);
      operator.ticksToLive = 500;
      pclManager.runRenewalAssist();
      assert(
        currentRuntime.renewPowerCreepActions.length === 1 &&
          currentRuntime.renewPowerCreepActions[0].powerCreepName === "OperatorRenewAssist",
        `renewal assist should renew in range, got ${JSON.stringify(currentRuntime.renewPowerCreepActions)}`,
      );
      assert(
        Memory.powerCreeps.OperatorRenewAssist.renewal.status === "RENEWED" &&
          Memory.powerCreeps.OperatorRenewAssist.renewal.renewResult === OK,
        `expected renewed status, got ${JSON.stringify(Memory.powerCreeps.OperatorRenewAssist.renewal)}`,
      );

      let captured = captureConsoleLines(function () {
        return global.ops.powerCreep("OperatorRenewAssist", "renewStatus");
      });
      assert(
        captured.result.indexOf("assigned " + room.name) !== -1 &&
          captured.result.indexOf("ttl 500") !== -1 &&
          captured.result.indexOf("threshold 1000") !== -1 &&
          captured.result.indexOf("target 4500") !== -1 &&
          captured.result.indexOf("powerSpawn") !== -1 &&
          captured.result.indexOf("range 1") !== -1 &&
          captured.result.indexOf("renew 0 (OK)") !== -1 &&
          captured.result.indexOf("[object Object]") === -1,
        `renewStatus should report clean assist state, got ${captured.result}`,
      );

      operator.ticksToLive = 4600;
      const renewsBeforeTarget = currentRuntime.renewPowerCreepActions.length;
      pclManager.runRenewalAssist();
      assert(
        currentRuntime.renewPowerCreepActions.length === renewsBeforeTarget &&
          Memory.powerCreeps.OperatorRenewAssist.renewal.status === "IDLE_ABOVE_TARGET",
        `renewal assist should stop above target TTL, got ${JSON.stringify(Memory.powerCreeps.OperatorRenewAssist.renewal)}`,
      );

      assert(
        global.ops.powerCreep("OperatorManualSpawn", "assign", room.name).indexOf("assigned") !== -1,
        "manual spawn regression setup should assign cleanly",
      );
      createPowerCreep("OperatorManualSpawn", 1, 1, { spawned: false });
      assert(
        global.ops.powerCreep("OperatorManualSpawn", "spawn", room.name, "check").indexOf("action spawn | mode check") !== -1,
        "manual spawn check should still work",
      );
      assert(
        global.ops.powerCreep("OperatorRenewAssist", "renew", room.name, "check").indexOf("action renew | mode check") !== -1,
        "manual renew check should still work",
      );
      assert(
        global.ops.powerEnable(room.name, "check").indexOf("POWER_ENABLE") !== -1,
        "manual enable check should still work",
      );
      assert(
        global.ops.powerCreep("OperatorRenewAssist", "move", room.name, "powerSpawn", "check").indexOf("action move | mode check") !== -1,
        "manual move check should still work",
      );
      createPowerCreep("OperatorManualOps", 20, 25, {
        roomName: room.name,
        ticksToLive: 1000,
        powers: { [PWR_GENERATE_OPS]: { level: 1, cooldown: 0 } },
        store: { ops: 0 },
        storeCapacity: 100,
      });
      assert(
        global.ops.powerCreep("OperatorManualOps", "generateOps", "check").indexOf("action generateOps | mode check") !== -1,
        "manual generateOps check should still work",
      );
      createPowerCreep("OperatorManualSpawnOps", 22, 25, {
        roomName: room.name,
        ticksToLive: 1000,
        powers: { [PWR_OPERATE_SPAWN]: { level: 1, cooldown: 0 } },
        store: { ops: 150 },
        storeCapacity: 200,
      });
      assert(
        global.ops.operator("OperatorManualSpawnOps", room.name, "operateSpawn", "check").indexOf("action operateSpawn | mode check") !== -1,
        "manual operateSpawn check should still work",
      );
      createPowerCreep("OperatorManualExtensionOps", 22, 20, {
        roomName: room.name,
        ticksToLive: 1000,
        powers: { [PWR_OPERATE_EXTENSION]: { level: 1, cooldown: 0 } },
        store: { ops: 10 },
        storeCapacity: 100,
      });
      assert(
        global.ops.operator("OperatorManualExtensionOps", room.name, "operateExtension", "check").indexOf("action operateExtension | mode check") !== -1,
        "manual operateExtension check should still work",
      );

      global.ops.powerCreep("OperatorRenewAssist", "renewAssist", "off");
      operator.pos = new RoomPosition(20, 25, room.name);
      operator.ticksToLive = 500;
      const movesBeforeOff = currentRuntime.powerCreepMoveActions.length;
      const renewsBeforeOff = currentRuntime.renewPowerCreepActions.length;
      pclManager.runRenewalAssist();
      assert(
        currentRuntime.powerCreepMoveActions.length === movesBeforeOff &&
          currentRuntime.renewPowerCreepActions.length === renewsBeforeOff &&
          Memory.powerCreeps.OperatorRenewAssist.renewal.status === "BLOCKED_ASSIGNMENT_DISABLED",
        `per-creep assist off should block automation, got ${JSON.stringify(Memory.powerCreeps.OperatorRenewAssist.renewal)}`,
      );
      global.ops.powerCreep("OperatorRenewAssist", "renewAssist", "on");

      room._hostileCreeps.push(
        createCreep("RenewAssistHostile", "hostile", 25, 25, {
          roomName: room.name,
          my: false,
        }),
      );
      const movesBeforeThreat = currentRuntime.powerCreepMoveActions.length;
      pclManager.runRenewalAssist();
      assert(
        currentRuntime.powerCreepMoveActions.length === movesBeforeThreat &&
          Memory.powerCreeps.OperatorRenewAssist.renewal.status === "BLOCKED_THREAT",
        `active threat should block renewal assist, got ${JSON.stringify(Memory.powerCreeps.OperatorRenewAssist.renewal)}`,
      );
      room._hostileCreeps = [];

      const powerSpawn = room.find(FIND_MY_STRUCTURES, {
        filter(structure) {
          return structure.structureType === STRUCTURE_POWER_SPAWN;
        },
      })[0];
      powerSpawn.destroy();
      const movesBeforeNoPowerSpawn = currentRuntime.powerCreepMoveActions.length;
      pclManager.runRenewalAssist();
      assert(
        currentRuntime.powerCreepMoveActions.length === movesBeforeNoPowerSpawn &&
          Memory.powerCreeps.OperatorRenewAssist.renewal.status === "BLOCKED_NO_POWER_SPAWN",
        `missing Power Spawn should block renewal assist, got ${JSON.stringify(Memory.powerCreeps.OperatorRenewAssist.renewal)}`,
      );

      global.ops.powerCreep("OperatorRenewUnspawned", "assign", room.name);
      createPowerCreep("OperatorRenewUnspawned", 1, 1, { spawned: false });
      pclManager.runRenewalAssist();
      assert(
        Memory.powerCreeps.OperatorRenewUnspawned.renewal.status === "BLOCKED_NOT_SPAWNED",
        `unspawned Power Creep should block renewal assist, got ${JSON.stringify(Memory.powerCreeps.OperatorRenewUnspawned.renewal)}`,
      );
    });
  });
}

function runPowerCreepOpsGenerationControlsScenario() {
  withPowerSettings({ MIN_STORAGE_ENERGY: 50000, PROCESS_UNDER_CRITICAL_CPU: false }, function () {
    const room = buildPowerProcessingRoom("VAL_PC_OPS_GEN", {
      tick: 884,
      storageEnergy: 200000,
      powerSpawnEnergy: 500,
      powerSpawnPower: 10,
    });
    powerManager.run(room, roomState.collect(room));
    ops.registerGlobals();

    createPowerCreep("OperatorOps", 20, 25, {
      roomName: room.name,
      ticksToLive: 1000,
      powers: {
        PWR_GENERATE_OPS: { level: 1, cooldown: 0 },
      },
      store: { ops: 75 },
      storeCapacity: 100,
    });

    let captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorOps", "generateOps", "check");
    });
    assert(typeof captured.result === "string", "generateOps check should return a clean string");
    assert(
      captured.result.indexOf("action generateOps | mode check") !== -1 &&
        captured.result.indexOf("creep OperatorOps") !== -1 &&
        captured.result.indexOf("spawned yes") !== -1 &&
        captured.result.indexOf(`room ${room.name}`) !== -1 &&
        captured.result.indexOf("ops 75") !== -1 &&
        captured.result.indexOf("free 25") !== -1 &&
        captured.result.indexOf("cooldown 0") !== -1 &&
        captured.result.indexOf("status READY") !== -1 &&
        captured.result.indexOf("native powerCreep.usePower(PWR_GENERATE_OPS)") !== -1 &&
        captured.result.indexOf("dry run only; usePower not called") !== -1 &&
        captured.result.indexOf("[object Object]") === -1,
      `generateOps check should explain readiness and native call, got ${captured.result}`,
    );
    assert(
      currentRuntime.powerCreepUsePowerActions.length === 0,
      `generateOps check must not call usePower, got ${JSON.stringify(currentRuntime.powerCreepUsePowerActions)}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorOps", "generateOps", "confirm");
    });
    assert(
      captured.result.indexOf("status EXECUTED") !== -1 &&
        captured.result.indexOf("usePower result 0 (OK)") !== -1,
      `generateOps confirm should execute with readable result, got ${captured.result}`,
    );
    assert(
      currentRuntime.powerCreepUsePowerActions.length === 1 &&
        currentRuntime.powerCreepUsePowerActions[0].powerCreepName === "OperatorOps" &&
        currentRuntime.powerCreepUsePowerActions[0].power === PWR_GENERATE_OPS,
      `generateOps confirm should call usePower(PWR_GENERATE_OPS) once, got ${JSON.stringify(currentRuntime.powerCreepUsePowerActions)}`,
    );

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorOps", "generateOps");
    });
    assert(
      captured.result.indexOf("BLOCKED_INVALID_MODE") !== -1 &&
        captured.result.indexOf("usePower not called") !== -1 &&
        currentRuntime.powerCreepUsePowerActions.length === 1,
      `generateOps without explicit confirm should block, got ${captured.result}`,
    );

    const savedPowerCreeps = Game.powerCreeps;
    delete Game.powerCreeps;
    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorOps", "generateOps", "check");
    });
    assert(
      captured.result.indexOf("BLOCKED_NO_POWER_CREEPS") !== -1 &&
        currentRuntime.powerCreepUsePowerActions.length === 1,
      `missing Game.powerCreeps should be handled safely, got ${captured.result}`,
    );
    Game.powerCreeps = savedPowerCreeps;

    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("MissingOps", "generateOps", "check");
    });
    assert(
      captured.result.indexOf("BLOCKED_MISSING_POWER_CREEP") !== -1 &&
        currentRuntime.powerCreepUsePowerActions.length === 1,
      `missing named Power Creep should block, got ${captured.result}`,
    );

    createPowerCreep("OperatorUnspawnedOps", 1, 1, {
      spawned: false,
      powers: {
        PWR_GENERATE_OPS: { level: 1, cooldown: 0 },
      },
      store: { ops: 0 },
      storeCapacity: 100,
    });
    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorUnspawnedOps", "generateOps", "confirm");
    });
    assert(
      captured.result.indexOf("BLOCKED_NOT_SPAWNED") !== -1 &&
        currentRuntime.powerCreepUsePowerActions.length === 1,
      `unspawned Power Creep should block, got ${captured.result}`,
    );

    createPowerCreep("OperatorNoPowerOps", 21, 25, {
      roomName: room.name,
      powers: {},
      store: { ops: 0 },
      storeCapacity: 100,
    });
    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorNoPowerOps", "generateOps", "confirm");
    });
    assert(
      captured.result.indexOf("BLOCKED_MISSING_POWER") !== -1 &&
        currentRuntime.powerCreepUsePowerActions.length === 1,
      `missing PWR_GENERATE_OPS should block, got ${captured.result}`,
    );

    createPowerCreep("OperatorCooldownOps", 22, 25, {
      roomName: room.name,
      powers: {
        PWR_GENERATE_OPS: { level: 1, cooldown: 3 },
      },
      store: { ops: 0 },
      storeCapacity: 100,
    });
    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorCooldownOps", "generateOps", "confirm");
    });
    assert(
      captured.result.indexOf("BLOCKED_COOLDOWN") !== -1 &&
        captured.result.indexOf("cooldown 3") !== -1 &&
        currentRuntime.powerCreepUsePowerActions.length === 1,
      `cooldown should block, got ${captured.result}`,
    );

    createPowerCreep("OperatorFullOps", 23, 25, {
      roomName: room.name,
      powers: {
        PWR_GENERATE_OPS: { level: 1, cooldown: 0 },
      },
      store: { ops: 100 },
      storeCapacity: 100,
    });
    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorFullOps", "generateOps", "confirm");
    });
    assert(
      captured.result.indexOf("BLOCKED_NO_CAPACITY") !== -1 &&
        currentRuntime.powerCreepUsePowerActions.length === 1,
      `insufficient free capacity should block, got ${captured.result}`,
    );

    const savedGenerateOps = global.PWR_GENERATE_OPS;
    delete global.PWR_GENERATE_OPS;
    captured = captureConsoleLines(function () {
      return global.ops.powerCreep("OperatorOps", "generateOps", "confirm");
    });
    assert(
      captured.result.indexOf("BLOCKED_MISSING_CONSTANT") !== -1 &&
        currentRuntime.powerCreepUsePowerActions.length === 1,
      `missing PWR_GENERATE_OPS constant should block safely, got ${captured.result}`,
    );
    global.PWR_GENERATE_OPS = savedGenerateOps;

    assert(typeof global.ops.pcl(room.name) === "string", "ops.pcl should still work");
    assert(typeof global.ops.powerCreeps() === "string", "ops.powerCreeps should still work");
    assert(typeof global.ops.power(room.name) === "string", "ops.power should still work");
    captured = captureConsoleLines(function () {
      return global.ops.powerEnable(room.name, "check");
    });
    assert(
      captured.result.indexOf("READY_TO_ENABLE") !== -1,
      `ops.powerEnable should still work, got ${captured.result}`,
    );
  });
}

function runPowerCreepGenerateOpsAutomationScenario() {
  withPowerCreepSettings({
    GENERATE_OPS: {
      ENABLED: true,
      NAME: "Operator_GenOps",
      HOME_ROOM: "W42N9",
      POWER: "PWR_GENERATE_OPS",
    },
  }, function () {
    resetRuntime(900);
    powerCreepManager.run([]);
    assert(
      Memory.rooms.W42N9.power.generateOps.blockedReason === "BLOCKED_MISSING_POWER_CREEP",
      `missing Power Creep should block safely, got ${JSON.stringify(Memory.rooms.W42N9.power.generateOps)}`,
    );

    const noSpawnRoom = buildPowerProcessingRoom("W42N9", {
      tick: 901,
      powerSpawnEnergy: 500,
      powerSpawnPower: 10,
      storageEnergy: 200000,
    });
    noSpawnRoom.controller.isPowerEnabled = true;
    const powerSpawn = noSpawnRoom.find(FIND_MY_STRUCTURES, {
      filter(structure) {
        return structure.structureType === STRUCTURE_POWER_SPAWN;
      },
    })[0];
    noSpawnRoom._structures = noSpawnRoom._structures.filter(function (structure) {
      return structure.id !== powerSpawn.id;
    });
    delete currentRuntime.objectsById[powerSpawn.id];
    createPowerCreep("Operator_GenOps", 1, 1, {
      spawned: false,
      powers: {
        PWR_GENERATE_OPS: { level: 1, cooldown: 0 },
      },
      store: { ops: 0 },
      storeCapacity: 200,
    });
    powerCreepManager.run([noSpawnRoom]);
    assert(
      currentRuntime.spawnPowerCreepActions.length === 0 &&
        Memory.rooms.W42N9.power.generateOps.blockedReason === "BLOCKED_MISSING_POWER_SPAWN",
      `missing Power Spawn should not spawn, got ${JSON.stringify(Memory.rooms.W42N9.power.generateOps)}`,
    );

    const room = buildPowerProcessingRoom("W42N9", {
      tick: 902,
      powerSpawnEnergy: 500,
      powerSpawnPower: 10,
      storageEnergy: 200000,
    });
    room.controller.isPowerEnabled = true;
    const operator = createPowerCreep("Operator_GenOps", 1, 1, {
      spawned: false,
      powers: {
        PWR_GENERATE_OPS: { level: 1, cooldown: 0 },
      },
      store: { ops: 0 },
      storeCapacity: 200,
    });
    powerCreepManager.run([room]);
    assert(
      currentRuntime.spawnPowerCreepActions.length === 1 &&
        currentRuntime.spawnPowerCreepActions[0].powerCreepName === "Operator_GenOps" &&
        Memory.rooms.W42N9.power.generateOps.status === "SPAWNED",
      `unspawned configured Power Creep should spawn once, got ${JSON.stringify(currentRuntime.spawnPowerCreepActions)}`,
    );
    assert(operator.ticksToLive === 5000, "spawn should update fake Power Creep TTL");

    Game.time += 1;
    operator.powers[PWR_GENERATE_OPS].cooldown = 0;
    operator.store[RESOURCE_OPS] = 0;
    powerCreepManager.run([room]);
    assert(
      currentRuntime.powerCreepUsePowerActions.length === 1 &&
        currentRuntime.powerCreepUsePowerActions[0].powerCreepName === "Operator_GenOps" &&
        currentRuntime.powerCreepUsePowerActions[0].power === PWR_GENERATE_OPS,
      `cooldown clear should use only PWR_GENERATE_OPS once, got ${JSON.stringify(currentRuntime.powerCreepUsePowerActions)}`,
    );
    assert(
      Memory.rooms.W42N9.power.generateOps.status === "GENERATED" &&
        Memory.rooms.W42N9.power.generateOps.lastAction === "generate_ops" &&
        Memory.rooms.W42N9.power.generateOps.lastResult === OK,
      `successful generate should write compact status, got ${JSON.stringify(Memory.rooms.W42N9.power.generateOps)}`,
    );

    Game.time += 1;
    operator.powers[PWR_GENERATE_OPS].cooldown = 12;
    powerCreepManager.run([room]);
    assert(
      currentRuntime.powerCreepUsePowerActions.length === 1 &&
        Memory.rooms.W42N9.power.generateOps.blockedReason === "BLOCKED_COOLDOWN" &&
        Memory.rooms.W42N9.power.generateOps.lastAction === "idle",
      `cooldown should not call usePower, got ${JSON.stringify(Memory.rooms.W42N9.power.generateOps)}`,
    );

    Game.time += 1;
    operator.powers[PWR_GENERATE_OPS].cooldown = 0;
    room.controller.isPowerEnabled = false;
    powerCreepManager.run([room]);
    assert(
      currentRuntime.powerCreepUsePowerActions.length === 1 &&
        currentRuntime.enableRoomActions.length === 0 &&
        Memory.rooms.W42N9.power.generateOps.blockedReason === "BLOCKED_ROOM_NOT_POWER_ENABLED",
      `power disabled room should block without enableRoom, got ${JSON.stringify(Memory.rooms.W42N9.power.generateOps)}`,
    );
    room.controller.isPowerEnabled = true;

    ops.registerGlobals();
    const captured = captureConsoleLines(function () {
      return global.ops.room("W42N9", "power");
    });
    assert(typeof captured.result === "object", "ops.room power keeps existing structured return");
    assert(
      captured.lines.some(function (line) { return line.indexOf("PowerCreep Operator_GenOps") !== -1; }) &&
        captured.lines.some(function (line) { return line.indexOf("Room W42N9") !== -1; }) &&
        captured.lines.some(function (line) { return line.indexOf("TTL 5000") !== -1; }) &&
        captured.lines.some(function (line) { return line.indexOf("Generate Ops level 1 cooldown 0") !== -1; }) &&
        captured.lines.some(function (line) { return line.indexOf("Store ops 0/200") !== -1; }) &&
        captured.lines.some(function (line) { return line.indexOf("last action generate_ops") !== -1; }) &&
        captured.lines.some(function (line) { return line.indexOf("blocked BLOCKED_ROOM_NOT_POWER_ENABLED") !== -1; }) &&
        captured.lines.join("\n").indexOf("[object Object]") === -1,
      `power report should include printable generate ops diagnostics, got ${captured.lines.join(" / ")}`,
    );

    assert(currentRuntime.enableRoomActions.length === 0, "automation must not enable rooms");
    assert(currentRuntime.powerCreepMoveActions.length === 0, "automation must not move Power Creeps");
    assert(currentRuntime.terminalSends.length === 0, "automation must not send terminal resources");
    assert(currentRuntime.spawnEvents.length === 0, "automation must not spawn normal creeps");
    assert(
      currentRuntime.powerCreepUsePowerActions.every(function (action) {
        return action.power === PWR_GENERATE_OPS;
      }),
      `automation must not use other powers, got ${JSON.stringify(currentRuntime.powerCreepUsePowerActions)}`,
    );
  });
}

function runPowerCreepOpsBankingScenario() {
  withPowerCreepSettings({
    GENERATE_OPS: {
      ENABLED: true,
      NAME: "Operator_GenOps",
      HOME_ROOM: "W42N9",
      POWER: "PWR_GENERATE_OPS",
    },
  }, function () {
    let room = buildPowerProcessingRoom("W42N9", {
      tick: 910,
      terminalStore: { energy: 10000 },
      storageEnergy: 200000,
    });
    room.controller.isPowerEnabled = true;
    const operator = createPowerCreep("Operator_GenOps", 25, 31, {
      roomName: room.name,
      ticksToLive: 1000,
      powers: {
        PWR_GENERATE_OPS: { level: 1, cooldown: 0 },
      },
      store: { ops: 50 },
      storeCapacity: 200,
    });

    powerCreepManager.run([room]);

    assert(
      currentRuntime.powerCreepTransferActions.length === 1 &&
        currentRuntime.powerCreepTransferActions[0].resourceType === RESOURCE_OPS &&
        currentRuntime.powerCreepTransferActions[0].targetType === STRUCTURE_TERMINAL &&
        currentRuntime.powerCreepTransferActions[0].targetRoom === room.name,
      `ops banking should transfer only to same-room terminal, got ${JSON.stringify(currentRuntime.powerCreepTransferActions)}`,
    );
    assert(operator.store[RESOURCE_OPS] === 0, "ops banking should debit carried ops");
    assert(room.terminal.store[RESOURCE_OPS] === 50, "ops banking should credit terminal ops");
    assert(currentRuntime.powerCreepMoveActions.length === 0, "in-range banking should not move");
    assert(currentRuntime.powerCreepUsePowerActions.length === 0, "banking should not use powers");
    assert(currentRuntime.enableRoomActions.length === 0, "banking should not enable rooms");
    assert(currentRuntime.terminalSends.length === 0, "banking should not send terminal resources");
    assert(
      Memory.rooms.W42N9.power.generateOps.status === "BANKED_OPS" &&
        Memory.rooms.W42N9.power.generateOps.bankingAction === "bank_ops_transfer" &&
        Memory.rooms.W42N9.power.generateOps.bankingTarget === "terminal" &&
        Memory.rooms.W42N9.power.generateOps.bankingResult === OK &&
        !Memory.rooms.W42N9.power.generateOps.bankingBlockedReason,
      `banking should write compact transfer status, got ${JSON.stringify(Memory.rooms.W42N9.power.generateOps)}`,
    );

    ops.registerGlobals();
    const captured = captureConsoleLines(function () {
      return global.ops.room("W42N9", "power");
    });
    assert(
      captured.lines.some(function (line) {
        return line.indexOf("Ops banking action bank_ops_transfer") !== -1 &&
          line.indexOf("target terminal") !== -1 &&
          line.indexOf("result 0") !== -1 &&
          line.indexOf("blocked none") !== -1;
      }) &&
        captured.lines.join("\n").indexOf("[object Object]") === -1,
      `power report should show printable ops banking state, got ${captured.lines.join(" / ")}`,
    );

    room = buildPowerProcessingRoom("W42N9", {
      tick: 911,
      terminalStore: { energy: 10000 },
      storageEnergy: 200000,
    });
    room.controller.isPowerEnabled = true;
    createPowerCreep("Operator_GenOps", 20, 20, {
      roomName: room.name,
      ticksToLive: 1000,
      powers: {
        PWR_GENERATE_OPS: { level: 1, cooldown: 0 },
      },
      store: { ops: 25 },
      storeCapacity: 200,
    });

    powerCreepManager.run([room]);
    assert(
      currentRuntime.powerCreepMoveActions.length === 1 &&
        currentRuntime.powerCreepMoveActions[0].targetType === STRUCTURE_TERMINAL &&
        currentRuntime.powerCreepMoveActions[0].targetRoom === room.name,
      `out-of-range banking should move only toward same-room terminal, got ${JSON.stringify(currentRuntime.powerCreepMoveActions)}`,
    );
    assert(currentRuntime.powerCreepTransferActions.length === 0, "out-of-range banking should not transfer yet");
    assert(currentRuntime.powerCreepUsePowerActions.length === 0, "out-of-range banking should not use powers");
    assert(currentRuntime.enableRoomActions.length === 0, "out-of-range banking should not enable rooms");

    room = buildPowerProcessingRoom("W42N9", {
      tick: 912,
      terminalStore: { energy: 10000 },
      storageEnergy: 200000,
    });
    room.controller.isPowerEnabled = true;
    const otherRoom = new FakeRoom("W43N9", new FakeTerrain());
    otherRoom.setController(
      createController(20, 20, {
        roomName: otherRoom.name,
        level: 8,
        my: true,
        owner: { username: "tester" },
      }),
    );
    createPowerCreep("Operator_GenOps", 25, 25, {
      roomName: otherRoom.name,
      ticksToLive: 1000,
      powers: {
        PWR_GENERATE_OPS: { level: 1, cooldown: 0 },
      },
      store: { ops: 25 },
      storeCapacity: 200,
    });

    powerCreepManager.run([room, otherRoom]);
    assert(
      currentRuntime.powerCreepMoveActions.length === 0 &&
        currentRuntime.powerCreepTransferActions.length === 0 &&
        currentRuntime.powerCreepUsePowerActions.length === 0 &&
        currentRuntime.enableRoomActions.length === 0 &&
        Memory.rooms.W42N9.power.generateOps.bankingBlockedReason === "BLOCKED_BANK_NOT_HOME",
      `wrong-room banking should block without movement, transfer, powers, or enableRoom, got ${JSON.stringify(Memory.rooms.W42N9.power.generateOps)}`,
    );
  });
}

function runOperatorSpawnAndScanCommandsScenario() {
  const room = buildRoomScenario("VAL_OP_SCAN", {
    tick: 1890,
    controllerLevel: 8,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    creeps: [
      { name: "workerA", role: "worker", x: 24, y: 25 },
      { name: "workerB", role: "worker", x: 25, y: 24 },
      { name: "haulerA", role: "hauler", x: 26, y: 24 },
      { name: "repairA", role: "repair", x: 27, y: 24 },
    ],
    extraStructures: [
      { type: STRUCTURE_SPAWN, x: 27, y: 25, options: { name: "Spawn2", store: { energy: 300 }, storeCapacityResource: { energy: 300 }, hits: 5000, hitsMax: 5000 } },
      { type: STRUCTURE_POWER_SPAWN, x: 27, y: 31, options: { id: "power_spawn_scan", store: { energy: 5000, power: 100 }, storeCapacity: 5000, hits: 5000, hitsMax: 5000 } },
      { type: STRUCTURE_TOWER, x: 23, y: 25, options: { store: { energy: 300 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    extraSites: [
      { type: STRUCTURE_EXTENSION, x: 24, y: 26 },
    ],
    droppedResources: [
      { x: 26, y: 26, resourceType: RESOURCE_ENERGY, amount: 250 },
    ],
  });
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  createPowerCreep("Operator_Scan", 27, 31, {
    roomName: room.name,
    ticksToLive: 4875,
    store: { [RESOURCE_OPS]: 3 },
    powers: { [PWR_GENERATE_OPS]: { level: 1, cooldown: 42 } },
  });

  ops.registerGlobals();

  let captured = captureConsoleLines(function () {
    return global.ops.scan(room.name);
  });
  assert(typeof captured.result === "string", "ops.scan should return printable room summary");
  assert(captured.result.indexOf("[object Object]") === -1, `scan summary must not dump raw objects, got ${captured.result}`);
  assert(
    captured.lines.some(function (line) { return line.indexOf("Scan VAL_OP_SCAN / summary") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Spawns: 2") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Power Spawns: 1") !== -1; }),
    `scan summary should include concise room object counts, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.scan(room.name, "spawns");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("Spawn1: idle, energy 300/300") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Spawn2: idle, energy 300/300") !== -1; }),
    `scan spawns should list normal spawns, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.scan(room.name, "powerSpawns");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("power_spawn_scan") !== -1 && line.indexOf("energy 5,000") !== -1 && line.indexOf("power 100") !== -1; }),
    `scan powerSpawns should list Power Spawns, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.scan(room.name, "creeps");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("hauler 1") !== -1 && line.indexOf("repair 1") !== -1 && line.indexOf("worker 2") !== -1; }),
    `scan creeps should list role counts, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.scan(room.name, "powerCreeps");
  });
  assert(
    captured.lines.some(function (line) {
      return line.indexOf("Operator_Scan") !== -1 &&
        line.indexOf("spawned") !== -1 &&
        line.indexOf("ttl 4,875") !== -1 &&
        line.indexOf("ops 3") !== -1 &&
        line.indexOf("cooldown 42") !== -1;
    }),
    `scan powerCreeps should list PowerCreep state, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.scan(room.name, "structures");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("spawn 2") !== -1 && line.indexOf("powerSpawn 1") !== -1 && line.indexOf("tower 1") !== -1; }),
    `scan structures should list major structure counts, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.scan(room.name, "sites");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("extension 1") !== -1; }),
    `scan sites should list construction sites, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.scan(room.name, "resources");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("dropped energy: 250") !== -1; }),
    `scan resources should list bounded dropped resources, got ${captured.lines.join(" / ")}`,
  );

  const spawnEventsBeforeInvalid = currentRuntime.spawnEvents.length;
  captured = captureConsoleLines(function () {
    return global.ops.spawn("MISSING_ROOM", "worker", "small");
  });
  assert(captured.result.indexOf('owned room "MISSING_ROOM" not found') !== -1, `missing room should fail gracefully, got ${captured.result}`);
  assert(currentRuntime.spawnEvents.length === spawnEventsBeforeInvalid, "missing room must not spawn a creep");

  captured = captureConsoleLines(function () {
    return global.ops.spawn(room.name, "worker", { size: "small", spawn: "MissingSpawn" });
  });
  assert(captured.result.indexOf('owned spawn "MissingSpawn" not found') !== -1, `missing spawn should fail gracefully, got ${captured.result}`);
  assert(currentRuntime.spawnEvents.length === spawnEventsBeforeInvalid, "missing spawn must not spawn a creep");

  room.spawn.spawning = { name: "busy_worker", remainingTime: 10 };
  captured = captureConsoleLines(function () {
    return global.ops.spawn(room.name, "worker", { size: "small", spawn: "Spawn1" });
  });
  assert(captured.result.indexOf("is busy") !== -1, `busy spawn should fail, got ${captured.result}`);
  assert(currentRuntime.spawnEvents.length === spawnEventsBeforeInvalid, "busy spawn must not spawn a creep");
  room.spawn.spawning = null;

  captured = captureConsoleLines(function () {
    return global.ops.spawn(room.name, "unknown_role", "small");
  });
  assert(captured.result.indexOf('role "unknown_role" is not supported') !== -1, `invalid role should fail, got ${captured.result}`);
  assert(currentRuntime.spawnEvents.length === spawnEventsBeforeInvalid, "invalid role must not spawn a creep");

  captured = captureConsoleLines(function () {
    return global.ops.spawn(room.name, "worker", "huge");
  });
  assert(captured.result.indexOf('profile "huge" not found') !== -1, `invalid profile should fail, got ${captured.result}`);
  assert(currentRuntime.spawnEvents.length === spawnEventsBeforeInvalid, "invalid profile must not spawn a creep");

  captured = captureConsoleLines(function () {
    return global.ops.spawn(room.name, "worker", "small", { spawn: "Spawn1", preview: true });
  });
  assert(
    captured.result.indexOf("Spawn preview VAL_OP_SCAN") !== -1 &&
      captured.result.indexOf("Room VAL_OP_SCAN | Role worker | Size small") !== -1 &&
      captured.result.indexOf("Selected spawn Spawn1") !== -1 &&
      captured.result.indexOf("Body work, work, carry, move") !== -1 &&
      captured.result.indexOf("Body counts work 2, carry 1, move 1") !== -1 &&
      captured.result.indexOf("Cost 300") !== -1 &&
      captured.result.indexOf("Spawn time 12 ticks") !== -1 &&
      captured.result.indexOf("Valid now yes | Blocked none") !== -1 &&
      captured.result.indexOf("[object Object]") === -1,
    `preview should print exact body, cost, selected spawn, and spawn time, got ${captured.result}`,
  );
  assert(currentRuntime.spawnEvents.length === spawnEventsBeforeInvalid, "preview must not spawn a creep");

  captured = captureConsoleLines(function () {
    return global.ops.spawn(room.name, "worker", { size: "medium", spawn: "Spawn1", dryRun: true });
  });
  assert(
    captured.result.indexOf("Spawn preview VAL_OP_SCAN") !== -1 &&
      captured.result.indexOf("Size medium") !== -1 &&
      captured.result.indexOf("Cost") !== -1 &&
      captured.result.indexOf("Spawn time") !== -1,
    `dry-run should use full spawn preview, got ${captured.result}`,
  );
  assert(currentRuntime.spawnEvents.length === spawnEventsBeforeInvalid, "dry-run must not spawn a creep");

  captured = captureConsoleLines(function () {
    return global.ops.spawn(room.name, "worker", { size: "small", spawn: "Spawn1" });
  });
  assert(captured.result.indexOf("result OK (0)") !== -1, `valid spawn should call spawnCreep, got ${captured.result}`);
  assert(currentRuntime.spawnEvents.length === spawnEventsBeforeInvalid + 1, "valid spawn should create one spawn event");
  assert(currentRuntime.spawnEvents[currentRuntime.spawnEvents.length - 1].role === "worker", "spawn event should record worker role");

  const powerSpawn = room.find(FIND_MY_STRUCTURES, {
    filter(structure) {
      return structure.structureType === STRUCTURE_POWER_SPAWN;
    },
  })[0];
  const powerActionsBeforeInvalid = currentRuntime.spawnPowerCreepActions.length;
  captured = captureConsoleLines(function () {
    return global.ops.spawn("power", "MissingOperator", room.name);
  });
  assert(captured.result.indexOf('PowerCreep "MissingOperator" not found') !== -1, `missing PowerCreep should fail, got ${captured.result}`);
  assert(currentRuntime.spawnPowerCreepActions.length === powerActionsBeforeInvalid, "missing PowerCreep must not call spawn");

  const unspawnedPowerCreep = createPowerCreep("Operator_Manual", 25, 25, { spawned: false });
  captured = captureConsoleLines(function () {
    return global.ops.spawn("power", unspawnedPowerCreep.name, { room: room.name, powerSpawn: "missing_power_spawn" });
  });
  assert(captured.result.indexOf('owned Power Spawn "missing_power_spawn" not found') !== -1, `missing Power Spawn should fail, got ${captured.result}`);
  assert(currentRuntime.spawnPowerCreepActions.length === powerActionsBeforeInvalid, "missing Power Spawn must not call spawn");

  captured = captureConsoleLines(function () {
    return global.ops.spawn("power", unspawnedPowerCreep.name, { room: room.name, powerSpawn: powerSpawn.id, dryRun: true });
  });
  assert(captured.result.indexOf("preview OK (0)") !== -1, `PowerCreep dry-run should preview, got ${captured.result}`);
  assert(currentRuntime.spawnPowerCreepActions.length === powerActionsBeforeInvalid, "PowerCreep dry-run must not call spawn");

  captured = captureConsoleLines(function () {
    return global.ops.spawn("power", unspawnedPowerCreep.name, { room: room.name, powerSpawn: powerSpawn.id });
  });
  assert(captured.result.indexOf("result OK (0)") !== -1, `valid PowerCreep spawn should call spawn, got ${captured.result}`);
  assert(currentRuntime.spawnPowerCreepActions.length === powerActionsBeforeInvalid + 1, "valid PowerCreep spawn should call spawn once");
  assert(currentRuntime.enableRoomActions.length === 0, "ops.spawn power must not call enableRoom");
  assert(currentRuntime.powerCreepMoveActions.length === 0, "ops.spawn power must not move PowerCreeps");
  assert(currentRuntime.powerCreepUsePowerActions.length === 0, "ops.spawn power must not use powers");

  const helpCapture = captureConsoleLines(function () {
    return global.ops.help();
  });
  assert(
    helpCapture.lines.some(function (line) { return line.indexOf("ops.scan(roomName, [section], [role])") !== -1; }) &&
      helpCapture.lines.some(function (line) { return line.indexOf("ops.spawn(roomName, role, [size|options])") !== -1; }) &&
      helpCapture.lines.some(function (line) { return line.indexOf('ops.spawn("power", name, [room|options])') !== -1; }),
    `ops.help should list scan and spawn commands, got ${helpCapture.lines.join(" / ")}`,
  );
}

function runOperatorReadinessReportsScenario() {
  const room = buildPowerProcessingRoom("VAL_OPERATOR_READY", {
    tick: 888,
    storageEnergy: 200000,
    powerSpawnEnergy: 500,
    powerSpawnPower: 10,
    terminalStore: { energy: 12000, ops: 300 },
  });
  room.addStructure(createStructure(STRUCTURE_EXTENSION, 23, 25, { roomName: room.name, my: true, store: { energy: 50 }, storeCapacityResource: { energy: 50 } }));
  room.addStructure(createStructure(STRUCTURE_EXTENSION, 24, 25, { roomName: room.name, my: true, store: { energy: 50 }, storeCapacityResource: { energy: 50 } }));
  room.addStructure(createStructure(STRUCTURE_TOWER, 25, 24, { roomName: room.name, my: true, store: { energy: 500 }, storeCapacityResource: { energy: 1000 } }));
  room.addStructure(createStructure(STRUCTURE_FACTORY, 26, 24, { roomName: room.name, my: true, store: { energy: 0 }, storeCapacity: 50000, cooldown: 0 }));
  room.addStructure(createStructure(STRUCTURE_LAB, 27, 24, { roomName: room.name, my: true, store: { energy: 0 }, storeCapacity: 3000, cooldown: 0 }));
  room.addStructure(createStructure(STRUCTURE_LAB, 28, 24, { roomName: room.name, my: true, store: { energy: 0 }, storeCapacity: 3000, cooldown: 0 }));
  room.addMineral(createMineral(28, 28, { roomName: room.name, mineralType: RESOURCE_UTRIUM }));
  powerManager.run(room, roomState.collect(room));
  ops.registerGlobals();
  assert(typeof global.ops.operator === "function", "ops.operator should be registered");

  createPowerCreep("OperatorReady", 25, 25, {
    roomName: room.name,
    ticksToLive: 1000,
    powers: {
      [PWR_OPERATE_SPAWN]: { level: 1, cooldown: 0 },
      [PWR_OPERATE_EXTENSION]: { level: 1, cooldown: 0 },
      [PWR_OPERATE_TOWER]: { level: 1, cooldown: 42 },
      [PWR_OPERATE_STORAGE]: { level: 1, cooldown: 0 },
      [PWR_OPERATE_TERMINAL]: { level: 1, cooldown: 0 },
      [PWR_OPERATE_FACTORY]: { level: 1, cooldown: 0 },
      [PWR_OPERATE_LAB]: { level: 1, cooldown: 0 },
      [PWR_REGEN_SOURCE]: { level: 1, cooldown: 0 },
      [PWR_REGEN_MINERAL]: { level: 1, cooldown: 0 },
    },
    store: { ops: 40 },
    storeCapacity: 100,
  });

  let captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorReady");
  });
  assert(typeof captured.result === "string", "ops.operator should return a clean string");
  assert(
    captured.result.indexOf("[OPS][OperatorReady][OPERATOR] spawned yes") !== -1 &&
      captured.result.indexOf("ops 40") !== -1 &&
      captured.result.indexOf("spawn need-ops cooldown 0 ops 40/100 enough no") !== -1 &&
      captured.result.indexOf("extension ready cooldown 0 ops 40/2 enough yes") !== -1 &&
      captured.result.indexOf("tower cooldown cooldown 42") !== -1 &&
      captured.result.indexOf("report only; OPERATE_* usePower not called") !== -1 &&
      captured.result.indexOf("[object Object]") === -1,
    `operator summary should report clean readiness rows, got ${captured.result}`,
  );
  assert(
    currentRuntime.powerCreepUsePowerActions.length === 0,
    `operator report must not call usePower, got ${JSON.stringify(currentRuntime.powerCreepUsePowerActions)}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorReady", room.name);
  });
  assert(
    captured.result.indexOf(`[OPS][${room.name}][OPERATOR] targets`) !== -1 &&
      captured.result.indexOf("spawns ") !== -1 &&
      captured.result.indexOf("extensions ") !== -1 &&
      captured.result.indexOf("towers ") !== -1 &&
      captured.result.indexOf("storage 1") !== -1 &&
      captured.result.indexOf("terminal 1") !== -1 &&
      captured.result.indexOf("factory 1") !== -1 &&
      captured.result.indexOf("labs 2") !== -1 &&
      captured.result.indexOf("powerSpawn 1") !== -1 &&
      captured.result.indexOf("sources 2") !== -1 &&
      captured.result.indexOf("minerals ") !== -1 &&
      captured.result.indexOf("targets ") !== -1,
    `operator room report should include target counts, got ${captured.result}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorReady", room.name, "powers");
  });
  assert(
    captured.result.indexOf("target lab constant PWR_OPERATE_LAB") !== -1 &&
      captured.result.indexOf("range") !== -1 &&
      captured.result.indexOf("power missing-power") !== -1,
    `operator powers detail should include target/constant/range fields, got ${captured.result}`,
  );

  const savedPowerCreeps = Game.powerCreeps;
  delete Game.powerCreeps;
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorReady", room.name);
  });
  assert(
    captured.result.indexOf("Game.powerCreeps missing") !== -1 &&
      captured.result.indexOf("missing Power Creep") !== -1,
    `missing Game.powerCreeps should be safe, got ${captured.result}`,
  );
  Game.powerCreeps = savedPowerCreeps;

  captured = captureConsoleLines(function () {
    return global.ops.operator("MissingOperator", room.name);
  });
  assert(
    captured.result.indexOf("missing Power Creep") !== -1 &&
      captured.result.indexOf("missing-creep") !== -1,
    `missing named Power Creep should be safe, got ${captured.result}`,
  );

  createPowerCreep("OperatorUnspawnedReport", 1, 1, {
    spawned: false,
    powers: {
      [PWR_OPERATE_EXTENSION]: { level: 1, cooldown: 0 },
    },
    store: { ops: 40 },
  });
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorUnspawnedReport", room.name);
  });
  assert(
    captured.result.indexOf("unspawned Power Creep") !== -1 &&
      captured.result.indexOf("not-spawned") !== -1,
    `unspawned Power Creep should be reported cleanly, got ${captured.result}`,
  );

  const savedLabPower = global.PWR_OPERATE_LAB;
  delete global.PWR_OPERATE_LAB;
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorReady", room.name, "powers");
  });
  assert(
    captured.result.indexOf("lab missing-constant") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 0,
    `missing power constants should be reported safely, got ${captured.result}`,
  );
  global.PWR_OPERATE_LAB = savedLabPower;

  const secondSpawn = room.addStructure(
    createStructure(STRUCTURE_SPAWN, 24, 26, {
      roomName: room.name,
      name: "SpawnOperateTwo",
      id: "spawn_operate_two",
      hits: 5000,
      hitsMax: 5000,
      store: { energy: 300 },
      storeCapacityResource: { energy: 300 },
    }),
  );

  createPowerCreep("OperatorSpawnOps", 22, 25, {
    roomName: room.name,
    ticksToLive: 1000,
    powers: {
      [PWR_OPERATE_SPAWN]: { level: 1, cooldown: 0 },
    },
    store: { ops: 150 },
    storeCapacity: 200,
  });

  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorSpawnOps", room.name, "operateSpawn", "check");
  });
  assert(typeof captured.result === "string", "operateSpawn check should return a clean string");
  assert(
    captured.result.indexOf("action operateSpawn | mode check") !== -1 &&
      captured.result.indexOf("creep OperatorSpawnOps") !== -1 &&
      captured.result.indexOf(`room ${room.name}`) !== -1 &&
      captured.result.indexOf("target spawn Spawn1") !== -1 &&
      captured.result.indexOf("ops 150/100") !== -1 &&
      captured.result.indexOf("cooldown 0") !== -1 &&
      captured.result.indexOf("range 3/3") !== -1 &&
      captured.result.indexOf("status READY") !== -1 &&
      captured.result.indexOf("target defaulted to first owned spawn") !== -1 &&
      captured.result.indexOf("native powerCreep.usePower(PWR_OPERATE_SPAWN, spawn)") !== -1 &&
      captured.result.indexOf("dry run only; usePower not called") !== -1 &&
      captured.result.indexOf("[object Object]") === -1,
    `operateSpawn check should explain readiness and native call, got ${captured.result}`,
  );
  assert(
    currentRuntime.powerCreepUsePowerActions.length === 0,
    `operateSpawn check must not call usePower, got ${JSON.stringify(currentRuntime.powerCreepUsePowerActions)}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorSpawnOps", room.name, "operateSpawn", "SpawnOperateTwo", "check");
  });
  assert(
    captured.result.indexOf("target spawn SpawnOperateTwo") !== -1 &&
      captured.result.indexOf("requested target SpawnOperateTwo") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 0,
    `operateSpawn should resolve target by spawn name without executing, got ${captured.result}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorSpawnOps", room.name, "operateSpawn", secondSpawn.id, "check");
  });
  assert(
    captured.result.indexOf("target spawn SpawnOperateTwo") !== -1 &&
      captured.result.indexOf(`requested target ${secondSpawn.id}`) !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 0,
    `operateSpawn should resolve target by spawn id without executing, got ${captured.result}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorSpawnOps", room.name, "operateSpawn", "SpawnOperateTwo", "confirm");
  });
  assert(
    captured.result.indexOf("status EXECUTED") !== -1 &&
      captured.result.indexOf("usePower result 0 (OK)") !== -1,
    `operateSpawn confirm should execute with readable result, got ${captured.result}`,
  );
  assert(
    currentRuntime.powerCreepUsePowerActions.length === 1 &&
      currentRuntime.powerCreepUsePowerActions[0].powerCreepName === "OperatorSpawnOps" &&
      currentRuntime.powerCreepUsePowerActions[0].power === PWR_OPERATE_SPAWN &&
      currentRuntime.powerCreepUsePowerActions[0].targetId === secondSpawn.id,
    `operateSpawn confirm should call usePower(PWR_OPERATE_SPAWN, spawn) once, got ${JSON.stringify(currentRuntime.powerCreepUsePowerActions)}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorSpawnOps", room.name, "operateSpawn");
  });
  assert(
    captured.result.indexOf("BLOCKED_INVALID_MODE") !== -1 &&
      captured.result.indexOf("usePower not called") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 1,
    `operateSpawn without explicit confirm should block, got ${captured.result}`,
  );

  const savedPowerCreepsForOperateSpawn = Game.powerCreeps;
  delete Game.powerCreeps;
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorSpawnOps", room.name, "operateSpawn", "check");
  });
  assert(
    captured.result.indexOf("BLOCKED_NO_POWER_CREEPS") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 1,
    `missing Game.powerCreeps should be handled safely for operateSpawn, got ${captured.result}`,
  );
  Game.powerCreeps = savedPowerCreepsForOperateSpawn;

  captured = captureConsoleLines(function () {
    return global.ops.operator("MissingSpawnOps", room.name, "operateSpawn", "check");
  });
  assert(
    captured.result.indexOf("BLOCKED_MISSING_POWER_CREEP") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 1,
    `missing named Power Creep should block operateSpawn, got ${captured.result}`,
  );

  createPowerCreep("OperatorUnspawnedSpawnOps", 1, 1, {
    spawned: false,
    powers: {
      [PWR_OPERATE_SPAWN]: { level: 1, cooldown: 0 },
    },
    store: { ops: 150 },
    storeCapacity: 200,
  });
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorUnspawnedSpawnOps", room.name, "operateSpawn", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_NOT_SPAWNED") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 1,
    `unspawned Power Creep should block operateSpawn, got ${captured.result}`,
  );

  const savedOperateSpawnPower = global.PWR_OPERATE_SPAWN;
  delete global.PWR_OPERATE_SPAWN;
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorSpawnOps", room.name, "operateSpawn", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_MISSING_CONSTANT") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 1,
    `missing PWR_OPERATE_SPAWN constant should block safely, got ${captured.result}`,
  );
  global.PWR_OPERATE_SPAWN = savedOperateSpawnPower;

  createPowerCreep("OperatorNoSpawnPower", 22, 25, {
    roomName: room.name,
    powers: {},
    store: { ops: 150 },
    storeCapacity: 200,
  });
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorNoSpawnPower", room.name, "operateSpawn", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_MISSING_POWER") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 1,
    `missing PWR_OPERATE_SPAWN on creep should block, got ${captured.result}`,
  );

  createPowerCreep("OperatorCooldownSpawnOps", 22, 25, {
    roomName: room.name,
    powers: {
      [PWR_OPERATE_SPAWN]: { level: 1, cooldown: 4 },
    },
    store: { ops: 150 },
    storeCapacity: 200,
  });
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorCooldownSpawnOps", room.name, "operateSpawn", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_COOLDOWN") !== -1 &&
      captured.result.indexOf("cooldown 4") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 1,
    `operateSpawn cooldown should block, got ${captured.result}`,
  );

  createPowerCreep("OperatorLowOpsSpawnOps", 22, 25, {
    roomName: room.name,
    powers: {
      [PWR_OPERATE_SPAWN]: { level: 1, cooldown: 0 },
    },
    store: { ops: 40 },
    storeCapacity: 200,
  });
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorLowOpsSpawnOps", room.name, "operateSpawn", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_INSUFFICIENT_OPS") !== -1 &&
      captured.result.indexOf("ops 40/100") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 1,
    `operateSpawn insufficient ops should block, got ${captured.result}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorSpawnOps", room.name, "operateSpawn", "MissingSpawn", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_NO_TARGET") !== -1 &&
      captured.result.indexOf("requested target MissingSpawn") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 1,
    `missing spawn target should block operateSpawn, got ${captured.result}`,
  );

  createPowerCreep("OperatorFarSpawnOps", 10, 10, {
    roomName: room.name,
    powers: {
      [PWR_OPERATE_SPAWN]: { level: 1, cooldown: 0 },
    },
    store: { ops: 150 },
    storeCapacity: 200,
  });
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorFarSpawnOps", room.name, "operateSpawn", "check");
  });
  assert(
    captured.result.indexOf("BLOCKED_NOT_IN_RANGE") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 1,
    `out of range operateSpawn should block, got ${captured.result}`,
  );

  createPowerCreep("OperatorExtensionOps", 22, 20, {
    roomName: room.name,
    ticksToLive: 1000,
    powers: {
      [PWR_OPERATE_EXTENSION]: { level: 1, cooldown: 0 },
    },
    store: { ops: 10 },
    storeCapacity: 100,
  });

  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorExtensionOps", room.name, "operateExtension", "check");
  });
  assert(typeof captured.result === "string", "operateExtension check should return a clean string");
  assert(
    captured.result.indexOf("action operateExtension | mode check") !== -1 &&
      captured.result.indexOf("creep OperatorExtensionOps") !== -1 &&
      captured.result.indexOf(`room ${room.name}`) !== -1 &&
      captured.result.indexOf(`target controller ${room.controller.id}`) !== -1 &&
      captured.result.indexOf("ops 10/2") !== -1 &&
      captured.result.indexOf("cooldown 0") !== -1 &&
      captured.result.indexOf("range 2/3") !== -1 &&
      captured.result.indexOf("status READY") !== -1 &&
      captured.result.indexOf("native powerCreep.usePower(PWR_OPERATE_EXTENSION, room.controller)") !== -1 &&
      captured.result.indexOf("dry run only; usePower not called") !== -1 &&
      captured.result.indexOf("[object Object]") === -1,
    `operateExtension check should explain readiness and native call, got ${captured.result}`,
  );
  assert(
    currentRuntime.powerCreepUsePowerActions.length === 1,
    `operateExtension check must not call usePower, got ${JSON.stringify(currentRuntime.powerCreepUsePowerActions)}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorExtensionOps", room.name, "operateExtension", "confirm");
  });
  assert(
    captured.result.indexOf("status EXECUTED") !== -1 &&
      captured.result.indexOf("usePower result 0 (OK)") !== -1,
    `operateExtension confirm should execute with readable result, got ${captured.result}`,
  );
  assert(
    currentRuntime.powerCreepUsePowerActions.length === 2 &&
      currentRuntime.powerCreepUsePowerActions[1].powerCreepName === "OperatorExtensionOps" &&
      currentRuntime.powerCreepUsePowerActions[1].power === PWR_OPERATE_EXTENSION &&
      currentRuntime.powerCreepUsePowerActions[1].targetId === room.controller.id &&
      currentRuntime.powerCreepUsePowerActions[1].targetType === "controller",
    `operateExtension confirm should call usePower(PWR_OPERATE_EXTENSION, controller) once, got ${JSON.stringify(currentRuntime.powerCreepUsePowerActions)}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorExtensionOps", room.name, "operateExtension");
  });
  assert(
    captured.result.indexOf("BLOCKED_INVALID_MODE") !== -1 &&
      captured.result.indexOf("usePower not called") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 2,
    `operateExtension without explicit confirm should block, got ${captured.result}`,
  );

  const savedPowerCreepsForOperateExtension = Game.powerCreeps;
  delete Game.powerCreeps;
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorExtensionOps", room.name, "operateExtension", "check");
  });
  assert(
    captured.result.indexOf("BLOCKED_NO_POWER_CREEPS") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 2,
    `missing Game.powerCreeps should be handled safely for operateExtension, got ${captured.result}`,
  );
  Game.powerCreeps = savedPowerCreepsForOperateExtension;

  captured = captureConsoleLines(function () {
    return global.ops.operator("MissingExtensionOps", room.name, "operateExtension", "check");
  });
  assert(
    captured.result.indexOf("BLOCKED_MISSING_POWER_CREEP") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 2,
    `missing named Power Creep should block operateExtension, got ${captured.result}`,
  );

  createPowerCreep("OperatorUnspawnedExtensionOps", 1, 1, {
    spawned: false,
    powers: {
      [PWR_OPERATE_EXTENSION]: { level: 1, cooldown: 0 },
    },
    store: { ops: 10 },
    storeCapacity: 100,
  });
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorUnspawnedExtensionOps", room.name, "operateExtension", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_NOT_SPAWNED") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 2,
    `unspawned Power Creep should block operateExtension, got ${captured.result}`,
  );

  const savedOperateExtensionPower = global.PWR_OPERATE_EXTENSION;
  delete global.PWR_OPERATE_EXTENSION;
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorExtensionOps", room.name, "operateExtension", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_MISSING_CONSTANT") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 2,
    `missing PWR_OPERATE_EXTENSION constant should block safely, got ${captured.result}`,
  );
  global.PWR_OPERATE_EXTENSION = savedOperateExtensionPower;

  createPowerCreep("OperatorNoExtensionPower", 22, 20, {
    roomName: room.name,
    powers: {},
    store: { ops: 10 },
    storeCapacity: 100,
  });
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorNoExtensionPower", room.name, "operateExtension", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_MISSING_POWER") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 2,
    `missing PWR_OPERATE_EXTENSION on creep should block, got ${captured.result}`,
  );

  createPowerCreep("OperatorCooldownExtensionOps", 22, 20, {
    roomName: room.name,
    powers: {
      [PWR_OPERATE_EXTENSION]: { level: 1, cooldown: 4 },
    },
    store: { ops: 10 },
    storeCapacity: 100,
  });
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorCooldownExtensionOps", room.name, "operateExtension", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_COOLDOWN") !== -1 &&
      captured.result.indexOf("cooldown 4") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 2,
    `operateExtension cooldown should block, got ${captured.result}`,
  );

  createPowerCreep("OperatorLowOpsExtensionOps", 22, 20, {
    roomName: room.name,
    powers: {
      [PWR_OPERATE_EXTENSION]: { level: 1, cooldown: 0 },
    },
    store: { ops: 1 },
    storeCapacity: 100,
  });
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorLowOpsExtensionOps", room.name, "operateExtension", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_INSUFFICIENT_OPS") !== -1 &&
      captured.result.indexOf("ops 1/2") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 2,
    `operateExtension insufficient ops should block, got ${captured.result}`,
  );

  const savedController = room.controller;
  room.controller = null;
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorExtensionOps", room.name, "operateExtension", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_NOT_OWNED") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 2,
    `missing controller target should block operateExtension, got ${captured.result}`,
  );
  room.controller = savedController;

  createPowerCreep("OperatorWrongRoomExtensionOps", 22, 20, {
    roomName: "VAL_OTHER_ROOM",
    powers: {
      [PWR_OPERATE_EXTENSION]: { level: 1, cooldown: 0 },
    },
    store: { ops: 10 },
    storeCapacity: 100,
  });
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorWrongRoomExtensionOps", room.name, "operateExtension", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_ROOM_MISMATCH") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 2,
    `wrong room should block operateExtension, got ${captured.result}`,
  );

  createPowerCreep("OperatorFarExtensionOps", 10, 10, {
    roomName: room.name,
    powers: {
      [PWR_OPERATE_EXTENSION]: { level: 1, cooldown: 0 },
    },
    store: { ops: 10 },
    storeCapacity: 100,
  });
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorFarExtensionOps", room.name, "operateExtension", "check");
  });
  assert(
    captured.result.indexOf("BLOCKED_NOT_IN_RANGE") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 2,
    `out of range operateExtension should block, got ${captured.result}`,
  );

  room._hostileCreeps.push(
    createCreep("OperateExtensionHostile", "hostile", 25, 25, {
      roomName: room.name,
      my: false,
    }),
  );
  captured = captureConsoleLines(function () {
    return global.ops.operator("OperatorExtensionOps", room.name, "operateExtension", "confirm");
  });
  assert(
    captured.result.indexOf("BLOCKED_THREAT") !== -1 &&
      currentRuntime.powerCreepUsePowerActions.length === 2,
    `active threat should block operateExtension, got ${captured.result}`,
  );
  room._hostileCreeps = [];

  currentRuntime.powerCreepUsePowerActions = [];

  assert(typeof global.ops.pcl(room.name) === "string", "ops.pcl should still work after operator report additions");
  assert(typeof global.ops.powerCreeps() === "string", "ops.powerCreeps should still work after operator report additions");
  assert(
    global.ops.powerCreep("OperatorReady", "generateOps", "check").indexOf("BLOCKED_MISSING_POWER") !== -1,
    "ops.powerCreep generateOps should still report missing power",
  );
  assert(typeof global.ops.ops(room.name) === "string", "ops.ops should still work after operator report additions");
  assert(
    global.ops.powerEnable(room.name, "check").indexOf("READY_TO_ENABLE") !== -1,
    "ops.powerEnable should still work after operator report additions",
  );
  assert(typeof global.ops.power(room.name) === "string", "ops.power should still work after operator report additions");
  assert(
    currentRuntime.powerCreepUsePowerActions.length === 0,
    `operator readiness and check regressions must not call usePower, got ${JSON.stringify(currentRuntime.powerCreepUsePowerActions)}`,
  );
}

function runOpsInventoryAndStagingControlsScenario() {
  let room = buildOpsLogisticsRoom("VAL_OPS_INVENTORY", {
    tick: 885,
    storageStore: { energy: 200000, ops: 1200 },
    terminalStore: { energy: 12000, ops: 300 },
  });
  ops.registerGlobals();
  assert(typeof global.ops.ops === "function", "ops.ops should be registered");

  createPowerCreep("OperatorInventory", 20, 25, {
    roomName: room.name,
    ticksToLive: 1000,
    powers: {
      PWR_GENERATE_OPS: { level: 1, cooldown: 0 },
    },
    store: { ops: 75 },
    storeCapacity: 100,
  });

  let captured = captureConsoleLines(function () {
    return global.ops.ops();
  });
  assert(typeof captured.result === "string", "ops.ops should return a clean string");
  assert(
    captured.result.indexOf("Empire ops inventory") !== -1 &&
      captured.result.indexOf("storage 1,200") !== -1 &&
      captured.result.indexOf("terminal 300") !== -1 &&
      captured.result.indexOf("powerCreeps 75") !== -1 &&
      captured.result.indexOf(room.name) !== -1 &&
      captured.result.indexOf("[object Object]") === -1,
    `global ops inventory should report clean totals and room summary, got ${captured.result}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.ops(room.name);
  });
  assert(typeof captured.result === "string", "ops.ops(room) should return a clean string");
  assert(
    captured.result.indexOf(`[OPS][${room.name}][OPS] storage 1,200 | terminal 300`) !== -1 &&
      captured.result.indexOf("visible Power Creeps: OperatorInventory 75") !== -1 &&
      captured.result.indexOf("pending: none") !== -1,
    `room ops inventory should include storage, terminal, carried ops, and pending summary, got ${captured.result}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.ops(room.name, "stage", "storage", "terminal", 500);
  });
  assert(
    typeof captured.result === "string" &&
      captured.result.indexOf(`ops stage ${room.name}: ops 500 storage -> terminal`) !== -1 &&
      captured.result.indexOf("status open") !== -1,
    `storage -> terminal staging should return a clean request line, got ${captured.result}`,
  );
  let rows = opsLogisticsManager.listRequests(room.name).filter(function (row) {
    return row.resourceType === RESOURCE_OPS && row.from === "storage" && row.to === "terminal";
  });
  assert(rows.length === 1, `expected one storage -> terminal ops request, got ${rows.length}`);
  assert(rows[0].amount === 500, `expected staged amount 500, got ${rows[0].amount}`);

  captured = captureConsoleLines(function () {
    return global.ops.ops(room.name);
  });
  assert(
    captured.result.indexOf("pending 1") !== -1 &&
      captured.result.indexOf(rows[0].id) !== -1 &&
      captured.result.indexOf("storage->terminal") !== -1,
    `room ops inventory should include pending staging request, got ${captured.result}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.ops(room.name, "stage", "storage", "terminal", 250);
  });
  assert(
    captured.result.indexOf("status existing") !== -1,
    `duplicate compatible request should be suppressed, got ${captured.result}`,
  );
  rows = opsLogisticsManager.listRequests(room.name).filter(function (row) {
    return row.resourceType === RESOURCE_OPS && row.from === "storage" && row.to === "terminal";
  });
  assert(rows.length === 1, `duplicate staging should not create another request, got ${rows.length}`);

  captured = captureConsoleLines(function () {
    return global.ops.ops(room.name, "stage", "terminal", "storage", 100);
  });
  assert(
    captured.result.indexOf(`ops stage ${room.name}: ops 100 terminal -> storage`) !== -1 &&
      captured.result.indexOf("status open") !== -1,
    `terminal -> storage staging should create a request, got ${captured.result}`,
  );
  rows = opsLogisticsManager.listRequests(room.name).filter(function (row) {
    return row.resourceType === RESOURCE_OPS;
  });
  assert(rows.length === 2, `expected two directional ops requests, got ${rows.length}`);

  captured = captureConsoleLines(function () {
    return global.ops.ops(room.name, "stage", "terminal", "storage", 0);
  });
  assert(
    captured.result.indexOf("amount must be a positive finite number") !== -1,
    `invalid amount should be blocked, got ${captured.result}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.ops("VAL_OPS_INVENTORY_MISSING");
  });
  assert(
    captured.result.indexOf('owned room "VAL_OPS_INVENTORY_MISSING" not found') !== -1,
    `missing room should be blocked, got ${captured.result}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.ops(room.name, "stage", "storage", "terminal", 5000);
  });
  assert(
    captured.result.indexOf("has 1,200 ops; requested 5,000") !== -1,
    `over-large request should be blocked instead of clipped, got ${captured.result}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.ops(room.name, "stage", "powerCreep", "storage", 25, "OperatorInventory");
  });
  assert(
    captured.result.indexOf("Power Creep direct ops staging is not supported yet") !== -1,
    `Power Creep direct staging should report unsupported, got ${captured.result}`,
  );

  const savedResourceOps = global.RESOURCE_OPS;
  delete global.RESOURCE_OPS;
  room = buildOpsLogisticsRoom("VAL_OPS_INVENTORY_NO_CONST", {
    tick: 886,
    storageStore: { energy: 200000 },
    terminalStore: { energy: 12000 },
  });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.ops(room.name);
  });
  assert(
    captured.result.indexOf("storage 0 | terminal 0 | powerCreeps 0 | pending 0") !== -1 &&
      captured.result.indexOf("[object Object]") === -1,
    `missing RESOURCE_OPS should report safe zero ops, got ${captured.result}`,
  );
  global.RESOURCE_OPS = savedResourceOps;

  room = buildPowerProcessingRoom("VAL_OPS_INVENTORY_REGRESSION", {
    tick: 887,
    storageEnergy: 200000,
    powerSpawnEnergy: 500,
    powerSpawnPower: 10,
  });
  powerManager.run(room, roomState.collect(room));
  ops.registerGlobals();
  createPowerCreep("OperatorOpsRegression", 20, 25, {
    roomName: room.name,
    ticksToLive: 1000,
    powers: {
      PWR_GENERATE_OPS: { level: 1, cooldown: 0 },
    },
    store: { ops: 10 },
    storeCapacity: 100,
  });
  assert(typeof global.ops.pcl(room.name) === "string", "ops.pcl should still work after ops inventory additions");
  assert(typeof global.ops.powerCreeps() === "string", "ops.powerCreeps should still work after ops inventory additions");
  assert(typeof global.ops.power(room.name) === "string", "ops.power should still work after ops inventory additions");
  assert(
    global.ops.powerEnable(room.name, "check").indexOf("READY_TO_ENABLE") !== -1,
    "ops.powerEnable should still work after ops inventory additions",
  );
  assert(
    global.ops.powerCreep("OperatorOpsRegression", "generateOps", "check").indexOf("action generateOps | mode check") !== -1,
    "ops.powerCreep generateOps should still work after ops inventory additions",
  );
}

function runPowerSpawnRefillVisibilityScenario() {
  withPowerSettings({ MIN_STORAGE_ENERGY: 50000, POWER_SPAWN_ENERGY_TARGET: 5000, POWER_SPAWN_POWER_TARGET: 100 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_REFILL", {
      powerSpawnEnergy: 1000,
      powerSpawnPower: 0,
      storageEnergy: 200000,
      terminalStore: { energy: 12000, power: 250 },
    });
    room.storage.store.power = 25;
    const state = roomState.collect(room);

    powerManager.run(room, state);

    const memory = Memory.rooms[room.name].power;
    assert(memory.refillState === "REFILL_REQUEST_CREATED", `expected refill request created, got ${memory.refillState}`);
    assert(memory.refillEnergyNeeded === 4000, `expected energy need 4000, got ${memory.refillEnergyNeeded}`);
    assert(memory.refillPowerNeeded === 100, `expected power need 100, got ${memory.refillPowerNeeded}`);
    assert(memory.refillEnergyStorageAvailable === 150000, `expected storage energy available 150000, got ${memory.refillEnergyStorageAvailable}`);
    assert(memory.refillPowerStorageAvailable === 25, `expected storage power available 25, got ${memory.refillPowerStorageAvailable}`);
    assert(memory.refillPowerTerminalAvailable === 250, `expected terminal power available 250, got ${memory.refillPowerTerminalAvailable}`);
    assert(memory.refillPendingRequests === 2, `expected two created refill requests, got ${memory.refillPendingRequests}`);

    ops.registerGlobals();
    const captured = captureConsoleLines(function () {
      return global.ops.room(room.name, "power");
    });

    assert(
      captured.lines.some(function (line) { return line.indexOf("Refill REFILL_REQUEST_PENDING") !== -1; }),
      `expected report to summarize created requests as pending refill, got ${captured.lines.join(" / ")}`,
    );
    assert(
      captured.lines.some(function (line) { return line.indexOf("Energy need 4,000") !== -1 && line.indexOf("Power need 100") !== -1; }),
      `expected refill need line, got ${captured.lines.join(" / ")}`,
    );
    assert(
      captured.lines.some(function (line) { return line.indexOf("energy storage 150,000 terminal 12,000") !== -1; }),
      `expected energy source availability, got ${captured.lines.join(" / ")}`,
    );
    assert(
      captured.lines.some(function (line) { return line.indexOf("power storage 25 terminal 250") !== -1; }),
      `expected power source availability, got ${captured.lines.join(" / ")}`,
    );
    assert(
      captured.lines.some(function (line) { return line.indexOf("Refill pending 2") !== -1 && line.indexOf("power") !== -1; }),
      `expected pending refill summary, got ${captured.lines.join(" / ")}`,
    );
    assert(
      captured.lines.some(function (line) { return line.indexOf("selected power from terminal") !== -1; }),
      `expected selected source in report, got ${captured.lines.join(" / ")}`,
    );
  });
}

function getOpenPowerSpawnRefillRequests(roomName, resourceType) {
  return opsLogisticsManager.listRequests(roomName).filter(function (request) {
    return (
      request.status === "open" &&
      request.to === "powerSpawn" &&
      (!resourceType || request.resourceType === resourceType)
    );
  });
}

function runPowerSpawnEnergyRefillRequestScenario() {
  withPowerSettings({ MIN_STORAGE_ENERGY: 50000, POWER_SPAWN_ENERGY_TARGET: 5000, POWER_SPAWN_POWER_TARGET: 100 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_REFILL_ENERGY", {
      powerSpawnEnergy: 1000,
      powerSpawnPower: 100,
      storageEnergy: 54000,
      terminalStore: { energy: 12000, power: 0 },
    });
    const state = roomState.collect(room);

    powerManager.run(room, state);

    const requests = getOpenPowerSpawnRefillRequests(room.name, RESOURCE_ENERGY);
    assert(requests.length === 1, `expected one energy refill request, got ${requests.length}`);
    assertOpsLogisticsRequestShape(requests[0], {
      status: "open",
      roomName: room.name,
      resourceType: RESOURCE_ENERGY,
      from: "storage",
      to: "powerSpawn",
    });
    assert(requests[0].amount === 4000, `expected reserve-aware 4000 energy amount, got ${requests[0].amount}`);
  });
}

function runPowerSpawnPowerRefillRequestScenario() {
  withPowerSettings({ POWER_SPAWN_ENERGY_TARGET: 5000, POWER_SPAWN_POWER_TARGET: 100 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_REFILL_POWER", {
      powerSpawnEnergy: 5000,
      powerSpawnPower: 20,
      storageEnergy: 200000,
      terminalStore: { energy: 12000, power: 250 },
    });
    room.storage.store.power = 500;
    const state = roomState.collect(room);

    powerManager.run(room, state);

    const requests = getOpenPowerSpawnRefillRequests(room.name, RESOURCE_POWER);
    assert(requests.length === 1, `expected one power refill request, got ${requests.length}`);
    assertOpsLogisticsRequestShape(requests[0], {
      status: "open",
      roomName: room.name,
      resourceType: RESOURCE_POWER,
      from: "terminal",
      to: "powerSpawn",
    });
    assert(requests[0].amount === 80, `expected target-bounded 80 power amount, got ${requests[0].amount}`);
  });
}

function runPowerSpawnRefillReserveBlockScenario() {
  withPowerSettings({ MIN_STORAGE_ENERGY: 50000, MIN_TERMINAL_ENERGY: 10000, POWER_SPAWN_ENERGY_TARGET: 5000 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_REFILL_RESERVE_BLOCK", {
      powerSpawnEnergy: 1000,
      powerSpawnPower: 100,
      storageEnergy: 50000,
      terminalStore: { energy: 10000, power: 0 },
    });
    const state = roomState.collect(room);

    powerManager.run(room, state);

    const requests = getOpenPowerSpawnRefillRequests(room.name);
    const memory = Memory.rooms[room.name].power;
    assert(requests.length === 0, `reserve block should create no requests, got ${requests.length}`);
    assert(
      memory.refillBlockedReason === "REFILL_BLOCKED_STORAGE_RESERVE",
      `expected reserve refill block, got ${memory.refillBlockedReason}`,
    );
  });
}

function runPowerSpawnRefillThreatBlockScenario() {
  withPowerSettings({ PROCESS_UNDER_THREAT: false, POWER_SPAWN_ENERGY_TARGET: 5000 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_REFILL_THREAT_BLOCK", {
      powerSpawnEnergy: 1000,
      powerSpawnPower: 100,
      hostiles: [
        {
          name: "hostile_refill_block",
          x: 26,
          y: 25,
          body: [{ type: ATTACK }, { type: MOVE }],
        },
      ],
    });
    const state = roomState.collect(room);

    powerManager.run(room, state);

    const requests = getOpenPowerSpawnRefillRequests(room.name);
    const memory = Memory.rooms[room.name].power;
    assert(requests.length === 0, `threat block should create no requests, got ${requests.length}`);
    assert(
      memory.refillBlockedReason === "REFILL_BLOCKED_THREAT",
      `expected threat refill block, got ${memory.refillBlockedReason}`,
    );
  });
}

function runPowerSpawnRefillDuplicateSuppressionScenario() {
  withPowerSettings({ POWER_SPAWN_ENERGY_TARGET: 5000, REFILL_INTERVAL: 1 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_REFILL_DUPLICATE", {
      powerSpawnEnergy: 1000,
      powerSpawnPower: 100,
      storageEnergy: 200000,
      terminalStore: { energy: 12000, power: 0 },
    });
    const state = roomState.collect(room);

    powerManager.run(room, state);
    Game.time += 1;
    powerManager.run(room, state);

    const requests = getOpenPowerSpawnRefillRequests(room.name, RESOURCE_ENERGY);
    assert(requests.length === 1, `duplicate refill should keep one request, got ${requests.length}`);
    assert(
      Memory.rooms[room.name].power.refillState === "REFILL_REQUEST_PENDING",
      `expected duplicate pass to report pending, got ${Memory.rooms[room.name].power.refillState}`,
    );
  });
}

function runPowerSpawnRefillReportShapeScenario() {
  withPowerSettings({ POWER_SPAWN_ENERGY_TARGET: 5000, POWER_SPAWN_POWER_TARGET: 100 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_REFILL_REPORT_SHAPE", {
      powerSpawnEnergy: 1000,
      powerSpawnPower: 100,
      storageEnergy: 200000,
    });
    const state = roomState.collect(room);

    powerManager.run(room, state);
    ops.registerGlobals();
    const captured = captureConsoleLines(function () {
      return global.ops.room(room.name, "power");
    });

    assert(
      captured.lines.some(function (line) { return line.indexOf("Refill pending 1") !== -1; }),
      `expected one pending refill in report, got ${captured.lines.join(" / ")}`,
    );
    assert(
      captured.lines.some(function (line) { return line.indexOf("selected energy from storage") !== -1; }),
      `expected selected refill source in report, got ${captured.lines.join(" / ")}`,
    );
    assert(
      captured.lines.some(function (line) { return line.indexOf("Refill recent created") !== -1; }),
      `expected recent created line in report, got ${captured.lines.join(" / ")}`,
    );
    assert(
      captured.lines.some(function (line) { return line.indexOf("Refill owner power_manager | execution ops_logistics") !== -1; }),
      `expected refill ownership line in report, got ${captured.lines.join(" / ")}`,
    );
    assert(
      !captured.lines.some(function (line) { return line.indexOf("{") !== -1 || line.indexOf("}") !== -1; }),
      `power report should not dump raw request objects, got ${captured.lines.join(" / ")}`,
    );
  });
}

function runPowerSpawnRefillOwnershipScenario() {
  withPowerSettings({ POWER_SPAWN_ENERGY_TARGET: 5000, POWER_SPAWN_POWER_TARGET: 100 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_REFILL_OWNER", {
      powerSpawnEnergy: 1000,
      powerSpawnPower: 0,
      storageEnergy: 200000,
      terminalStore: { energy: 12000, power: 250 },
    });
    room.storage.store.power = 25;
    const state = roomState.collect(room);
    const hauler = createCreep("VAL_POWER_REFILL_OWNER_hauler", "hauler", 24, 27, {
      roomName: room.name,
      store: {},
      storeCapacity: 100,
    });

    const advancedSummary = advancedStructureManager.getStatus(room, state);
    const advancedTask = advancedStructureManager.getHaulerTask(room, hauler, state);
    assert(advancedSummary.powerSpawnStatus === "ready", `expected advanced Power Spawn status ready, got ${advancedSummary.powerSpawnStatus}`);
    assert(advancedSummary.powerSpawnRefillOwner === "power_manager", `expected power_manager owner, got ${advancedSummary.powerSpawnRefillOwner}`);
    assert(!advancedTask, `advanced structure manager should not create Power Spawn haul tasks, got ${advancedTask ? advancedTask.label : "none"}`);
    assert(!hauler.memory.advancedTask, "advanced Power Spawn check should not store an advanced task on the hauler");

    powerManager.run(room, state);
    const requests = getOpenPowerSpawnRefillRequests(room.name);
    assert(requests.length === 2, `power_manager should create energy and power ops logistics requests, got ${requests.length}`);
    assert(
      requests.some(function (request) {
        return request.resourceType === RESOURCE_ENERGY && request.from === "storage";
      }),
      "expected power_manager energy refill request from storage",
    );
    assert(
      requests.some(function (request) {
        return request.resourceType === RESOURCE_POWER && request.from === "terminal";
      }),
      "expected power_manager power refill request from terminal",
    );
  });
}

function runPowerSpawnRefillHaulerExecutionScenario() {
  withPowerSettings({ ENABLED: false, REFILL_ENABLED: true, POWER_SPAWN_ENERGY_TARGET: 5000, POWER_SPAWN_POWER_TARGET: 100 }, function () {
    const room = buildPowerProcessingRoom("VAL_POWER_REFILL_HAULER", {
      powerSpawnEnergy: 5000,
      powerSpawnPower: 20,
      storageEnergy: 200000,
      terminalStore: { energy: 12000, power: 250 },
    });
    const state = roomState.collect(room);
    utils.setRoomRuntimeState(room, state);
    const hauler = createCreep("VAL_POWER_REFILL_HAULER_hauler", "hauler", 25, 32, {
      roomName: room.name,
      store: {},
      storeCapacity: 80,
    });

    powerManager.run(room, state);
    let requests = getOpenPowerSpawnRefillRequests(room.name, RESOURCE_POWER);
    assert(requests.length === 1, `expected one power refill request, got ${requests.length}`);
    const requestId = requests[0].id;

    roleHauler.run(hauler, { thinkInterval: 1 });
    assert(hauler.memory.opsLogisticsTask, "hauler should claim the Power Spawn ops logistics request");
    assert(hauler.memory.opsLogisticsTask.requestId === requestId, "hauler should claim the expected Power Spawn request");
    assert(!hauler.memory.advancedTask, "hauler should not use advanced task memory for Power Spawn refill");
    assertHaulerAction(hauler, "withdraw", room.terminal.id, "Power Spawn refill pickup");
    assert(hauler.store.power === 80, `expected hauler to carry 80 power, got ${hauler.store.power || 0}`);

    const powerSpawn = state.structuresByType[STRUCTURE_POWER_SPAWN][0];
    hauler.pos = new RoomPosition(powerSpawn.pos.x, powerSpawn.pos.y, room.name);
    roleHauler.run(hauler, { thinkInterval: 1 });
    assertHaulerAction(hauler, "transfer", powerSpawn.id, "Power Spawn refill delivery");
    requests = opsLogisticsManager.listRequests(room.name).filter(function (request) {
      return request.id === requestId;
    });
    assert(requests.length === 1, "expected original Power Spawn refill request to remain visible");
    assert(requests[0].status === "done", `expected request done after hauler delivery, got ${requests[0].status}`);
    assert(powerSpawn.store.power === 100, `expected Power Spawn power to reach 100, got ${powerSpawn.store.power}`);
  });
}

function withBoostTargets(targets, fn) {
  const previousTargets = config.ADVANCED.LABS.BOOST_TARGETS;
  config.ADVANCED.LABS.BOOST_TARGETS = targets;

  try {
    fn();
  } finally {
    config.ADVANCED.LABS.BOOST_TARGETS = previousTargets;
  }
}

function buildLabOpsRoom(name, options) {
  const settings = options || {};
  const room = buildRoomScenario(name, {
    tick: settings.tick || 900,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: settings.creeps || [
      { name: `${name}_hauler`, role: "hauler", x: 25, y: 24, store: {}, storeCapacity: 200 },
    ],
  });

  satisfyDevelopmentRequirements(room);
  room.storage.store.energy = settings.storageEnergy || 200000;
  room.addStructure(
    createStructure(STRUCTURE_TERMINAL, 25, 32, {
      roomName: room.name,
      store: settings.terminalStore || { energy: 10000 },
      storeCapacity: 300000,
      hits: 3000,
      hitsMax: 3000,
    }),
  );

  const labStores = settings.labStores || [{}, {}, {}, {}, {}];
  const labPositions = [
    [23, 30],
    [25, 30],
    [24, 29],
    [24, 31],
    [25, 29],
  ];

  for (let i = 0; i < labPositions.length; i++) {
    room.addStructure(
      createStructure(STRUCTURE_LAB, labPositions[i][0], labPositions[i][1], {
        roomName: room.name,
        store: labStores[i] || {},
        storeCapacity: 3000,
        hits: 500,
        hitsMax: 500,
        cooldown: 0,
      }),
    );
  }

  return room;
}

function runLabBoostDirectScenario() {
  withBoostTargets({ UH: 1000 }, function () {
    const room = buildLabOpsRoom("VAL_LAB_BOOST_DIRECT", {
      terminalStore: { energy: 10000, U: 500, H: 500 },
    });
    const state = roomState.collect(room);
    const summary = advancedStructureManager.getStatus(room, state);
    const task = advancedStructureManager.getHaulerTask(room, Game.creeps.VAL_LAB_BOOST_DIRECT_hauler, state);

    assert(summary.labStatus === "making_boost", `expected making_boost, got ${summary.labStatus}`);
    assert(summary.labProduct === "UH", `expected UH product, got ${summary.labProduct}`);
    assert(summary.labGoal === "UH", `expected UH goal, got ${summary.labGoal}`);
    assert(summary.labNeed === 1000, `expected UH need 1000, got ${summary.labNeed}`);
    assert(task && task.label === "lab_input", `expected lab_input task, got ${task ? task.label : "none"}`);
  });
}

function runLabBoostIntermediateScenario() {
  withBoostTargets({ GH: 1000 }, function () {
    const room = buildLabOpsRoom("VAL_LAB_BOOST_INTERMEDIATE", {
      terminalStore: { energy: 10000, ZK: 500, UL: 500, H: 500 },
    });
    const state = roomState.collect(room);
    const summary = advancedStructureManager.getStatus(room, state);

    assert(summary.labStatus === "making_intermediate", `expected making_intermediate, got ${summary.labStatus}`);
    assert(summary.labProduct === "G", `expected G intermediate, got ${summary.labProduct}`);
    assert(summary.labGoal === "GH", `expected GH goal, got ${summary.labGoal}`);
  });
}

function runLabLoadedReactionPreservedScenario() {
  withBoostTargets({ UH: 1000, KH: 1000 }, function () {
    const room = buildLabOpsRoom("VAL_LAB_LOADED_KEEP", {
      terminalStore: { energy: 10000, U: 500, H: 1000, K: 500 },
      labStores: [{ U: 200 }, { H: 200 }, {}, {}, {}],
    });
    const state = roomState.collect(room);
    const summary = advancedStructureManager.getStatus(room, state);

    assert(summary.labStatus === "making_boost", `expected making_boost, got ${summary.labStatus}`);
    assert(summary.labProduct === "UH", `expected loaded UH to be preserved, got ${summary.labProduct}`);
  });
}

function runLabSwitchAfterTargetMetScenario() {
  withBoostTargets({ UH: 1000, KH: 1000 }, function () {
    const room = buildLabOpsRoom("VAL_LAB_SWITCH_TARGET_MET", {
      terminalStore: { energy: 10000, UH: 1000, K: 500, H: 500 },
      labStores: [{ U: 200 }, { H: 200 }, {}, {}, {}],
    });
    Memory.rooms[room.name] = {
      advancedOps: {
        labSchedule: {
          tick: Game.time,
          product: "UH",
          goal: "UH",
          reason: "cached",
        },
      },
    };
    const state = roomState.collect(room);
    const summary = advancedStructureManager.getStatus(room, state);

    assert(summary.labProduct === "KH", `expected switch to KH after UH target, got ${summary.labProduct}`);
    assert(summary.labGoal === "KH", `expected KH goal, got ${summary.labGoal}`);
  });
}

function runLabTargetsMetScenario() {
  withBoostTargets({ UH: 1000 }, function () {
    const room = buildLabOpsRoom("VAL_LAB_TARGETS_MET", {
      terminalStore: { energy: 10000, UH: 1000, U: 500, H: 500 },
    });
    const state = roomState.collect(room);
    const summary = advancedStructureManager.getStatus(room, state);

    assert(summary.labStatus === "target_met", `expected target_met, got ${summary.labStatus}`);
    assert(summary.labProduct === null, `expected no lab product, got ${summary.labProduct}`);
    assert(summary.labReason === "target_met", `expected target_met reason, got ${summary.labReason}`);
  });
}

function runLabTightReplanScenario() {
  withBoostTargets({ UH: 1000, KH: 1000 }, function () {
    const room = buildLabOpsRoom("VAL_LAB_TIGHT_REPLAN", {
      tick: 1010,
      terminalStore: { energy: 10000, U: 500, H: 1000, K: 500 },
    });
    Memory.runtime.rooms = {};
    Memory.runtime.rooms[room.name] = { pressure: "tight" };
    Memory.rooms[room.name] = {
      advancedOps: {
        labSchedule: {
          tick: 1000,
          product: "UH",
          goal: "UH",
          reason: "cached",
        },
      },
    };
    const state = roomState.collect(room);
    const summary = advancedStructureManager.getStatus(room, state);

    assert(summary.labProduct === "UH", `expected tight mode to keep cached UH, got ${summary.labProduct}`);
    assert(summary.labReason === "cached", `expected cached reason, got ${summary.labReason}`);
  });
}

function addOwnedStorageAndTerminal(room, terminalStore) {
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  if (!room.storage) {
    room.addStructure(
      createStructure(STRUCTURE_STORAGE, 24, 27, {
        roomName: room.name,
        store: { energy: 200000 },
        storeCapacity: 1000000,
        hits: 10000,
        hitsMax: 10000,
      }),
    );
  }
  if (!room.terminal) {
    room.addStructure(
      createStructure(STRUCTURE_TERMINAL, 25, 32, {
        roomName: room.name,
        store: terminalStore || { energy: 10000 },
        storeCapacity: 300000,
        hits: 3000,
        hitsMax: 3000,
        cooldown: 0,
      }),
    );
  }
}

function buildOpsLogisticsRoom(name, options) {
  const settings = options || {};
  const room = buildRoomScenario(name, {
    tick: settings.tick || 1300,
    controllerLevel: 8,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
  });

  room.controller.my = true;
  room.controller.owner = { username: "tester" };

  room.addStructure(
    createStructure(STRUCTURE_STORAGE, 24, 27, {
      roomName: room.name,
      store: settings.storageStore || { energy: 200000 },
      storeCapacity: settings.storageCapacity || 1000000,
      hits: 10000,
      hitsMax: 10000,
    }),
  );
  room.addStructure(
    createStructure(STRUCTURE_TERMINAL, 25, 32, {
      roomName: room.name,
      store: settings.terminalStore || { energy: 10000 },
      storeCapacity: settings.terminalCapacity || 300000,
      hits: 3000,
      hitsMax: 3000,
      cooldown: 0,
    }),
  );

  return room;
}

function addTransferRoom(name, options) {
  const settings = options || {};
  const room = new FakeRoom(name, new FakeTerrain());
  room.setController(
    createController(20, 20, {
      roomName: name,
      level: settings.controllerLevel || 8,
      my: settings.owned !== false,
      owner: settings.owned === false ? null : { username: "tester" },
    }),
  );

  if (settings.withTerminal !== false) {
    room.addStructure(
      createStructure(STRUCTURE_TERMINAL, 25, 25, {
        roomName: name,
        my: settings.terminalOwned !== false,
        store: settings.terminalStore || { energy: 10000, power: 5000 },
        storeCapacity: settings.terminalCapacity || 300000,
        cooldown: settings.cooldown || 0,
      }),
    );
  }

  if (settings.withStorage) {
    room.addStructure(
      createStructure(STRUCTURE_STORAGE, 24, 25, {
        roomName: name,
        store: settings.storageStore || { energy: 10000, power: 5000 },
        storeCapacity: settings.storageCapacity || 1000000,
      }),
    );
  }

  return room;
}

function assertOpsLogisticsRequestShape(request, expected) {
  assert(request, "expected an ops logistics request");
  assert(request.status === expected.status, `expected status ${expected.status}, got ${request.status}`);
  assert(request.roomName === expected.roomName, `expected room ${expected.roomName}, got ${request.roomName}`);
  assert(request.resourceType === expected.resourceType, `expected resource ${expected.resourceType}, got ${request.resourceType}`);
  assert(request.from === expected.from, `expected from ${expected.from}, got ${request.from}`);
  assert(request.to === expected.to, `expected to ${expected.to}, got ${request.to}`);
}

function assertCleanOpsString(value, label) {
  assert(typeof value === "string", `${label} should return a printable string`);
  assert(value.indexOf("[object Object]") === -1, `${label} should not contain raw objects`);
}

function assertCompactLogisticsHistory(history, label) {
  const allowedKeys = {
    t: true,
    roomName: true,
    state: true,
    open: true,
    blocked: true,
    unclaimed: true,
    claimed: true,
    remaining: true,
    oldestOpenAge: true,
    oldestUnclaimedAge: true,
    haulers: true,
    desiredHaulers: true,
  };

  assert(Array.isArray(history), `${label} should be an array`);
  for (let i = 0; i < history.length; i++) {
    const snapshot = history[i];
    const keys = Object.keys(snapshot).sort();
    for (let j = 0; j < keys.length; j++) {
      assert(allowedKeys[keys[j]], `${label} should not retain ${keys[j]} in snapshot ${i}`);
      assert(
        typeof snapshot[keys[j]] !== "object" || snapshot[keys[j]] === null,
        `${label} should keep compact primitive values in snapshot ${i}`,
      );
    }
  }
}

function addOpsLogisticsHaulers(room, count) {
  for (let i = 0; i < count; i++) {
    createCreep(`${room.name}_logistics_hauler_${i}`, "hauler", 24 + i, 27, {
      roomName: room.name,
      store: {},
      storeCapacity: 200,
    });
  }
}

function seedOpsLogisticsRequest(room, options) {
  const settings = options || {};
  const result = opsLogisticsManager.createMoveRequest(
    settings.resourceType || RESOURCE_ENERGY,
    settings.amount || 500,
    room.name,
    settings.from || "storage",
    settings.to || "terminal",
    { priority: settings.priority || 50 },
  );
  assert(result.ok, `expected logistics request seed, got ${result.message}`);

  const request = result.request;
  if (settings.status) request.status = settings.status;
  if (typeof settings.remaining === "number") request.remaining = settings.remaining;
  if (typeof settings.createdAt === "number") request.createdAt = settings.createdAt;
  if (typeof settings.updatedAt === "number") request.updatedAt = settings.updatedAt;
  if (settings.reason) request.reason = settings.reason;
  if (settings.claims) request.claims = settings.claims;

  return request;
}

function captureOpsLogisticsSection(room) {
  const captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "logistics");
  });

  assertCleanOpsString(captured.result, "ops.room logistics");
  assert(
    captured.lines.every(function (line) {
      return typeof line === "string" && line.indexOf("[object Object]") === -1;
    }),
    `expected printable logistics lines, got ${captured.lines.join(" / ")}`,
  );

  return captured;
}

function assertLogisticsLine(lines, fragment) {
  assert(
    lines.some(function (line) {
      return line.indexOf(fragment) !== -1;
    }),
    `expected logistics line containing ${fragment}, got ${lines.join(" / ")}`,
  );
}

function captureConsoleLines(fn) {
  const originalLog = console.log;
  const lines = [];
  console.log = function (line) {
    lines.push(line);
  };

  try {
    return {
      result: fn(),
      lines: lines,
    };
  } finally {
    console.log = originalLog;
  }
}

function installFakeMarket(orders, options) {
  const settings = options || {};
  const orderRows = orders || [];
  const deals = [];
  const createdOrders = [];
  const changedOrders = [];

  Game.market = {
    credits: settings.credits !== undefined ? settings.credits : 1000000,
    getAllOrders(filter) {
      return orderRows.filter(function (order) {
        if (filter && filter.type && order.type !== filter.type) return false;
        if (filter && filter.resourceType && order.resourceType !== filter.resourceType) return false;
        return true;
      });
    },
    calcTransactionCost(amount, roomName, orderRoomName) {
      if (settings.transactionCost) {
        return settings.transactionCost(amount, roomName, orderRoomName);
      }
      if (roomName === orderRoomName) return 0;
      return Math.ceil(amount * 0.1);
    },
    deal(orderId, amount, roomName) {
      deals.push({
        orderId: orderId,
        amount: amount,
        roomName: roomName,
      });
      return settings.dealResult !== undefined ? settings.dealResult : OK;
    },
    createOrder(order) {
      createdOrders.push(order);
      return OK;
    },
    changeOrderPrice(orderId, newPrice) {
      changedOrders.push({
        orderId: orderId,
        newPrice: newPrice,
      });
      return OK;
    },
  };

  deals.createdOrders = createdOrders;
  deals.changedOrders = changedOrders;

  return deals;
}

function buildHaulerExecutionOrderRoom(name, options) {
  const settings = options || {};
  const room = buildLabOpsRoom(name, {
    tick: settings.tick || 1320,
    storageEnergy: settings.storageEnergy || 200000,
    terminalStore: settings.terminalStore || { energy: 10000, U: 500, H: 500 },
    labStores: settings.labStores || [{}, {}, {}, {}, {}],
    creeps: settings.creeps || [
      { name: `${name}_hauler`, role: "hauler", x: 24, y: 27, store: {}, storeCapacity: 50 },
    ],
  });
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  return room;
}

function collectHaulerExecutionState(room) {
  const state = roomState.collect(room);
  utils.setRoomRuntimeState(room, state);
  return state;
}

function getLastCreepAction(creep) {
  for (let i = currentRuntime.creepActions.length - 1; i >= 0; i--) {
    if (currentRuntime.creepActions[i].creep === creep.name) {
      return currentRuntime.creepActions[i];
    }
  }
  return null;
}

function assertHaulerAction(creep, action, targetId, message) {
  const last = getLastCreepAction(creep);
  assert(last, `${message}: expected ${action}, got no action`);
  assert(last.action === action, `${message}: expected ${action}, got ${last.action}`);
  assert(last.targetId === targetId, `${message}: expected target ${targetId}, got ${last.targetId}`);
}

function assertHaulerTargetAction(creep, targetId, message) {
  const last = getLastCreepAction(creep);
  assert(last, `${message}: expected action targeting ${targetId}, got no action`);
  assert(last.targetId === targetId, `${message}: expected target ${targetId}, got ${last.targetId}`);
}

function firstSourceContainer(room) {
  const containers = room
    .find(FIND_STRUCTURES)
    .filter(function (structure) {
      return structure.structureType === STRUCTURE_CONTAINER;
    });
  assert(containers.length > 0, "expected at least one source container");
  return containers[0];
}

function runHaulerExecutionOrderCoverageScenario() {
  let room = buildHaulerExecutionOrderRoom("VAL_HAULER_ORDER_OPS_MARKET", {
    tick: 1320,
    storageEnergy: 200000,
    terminalStore: { energy: 10000 },
  });
  room.storage.store.H = 500;
  room.storage.store.Z = 500;
  collectHaulerExecutionState(room);
  let hauler = Game.creeps.VAL_HAULER_ORDER_OPS_MARKET_hauler;
  const opsResult = opsLogisticsManager.createMoveRequest("H", 50, room.name, "storage", "terminal");
  const marketResult = marketRequestManager.createStageRequest("Z", 50, room.name);
  assert(opsResult.ok, `expected ops logistics request, got ${opsResult.message}`);
  assert(marketResult.ok, `expected legacy market request, got ${marketResult.message}`);
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(hauler.memory.opsLogisticsTask, "ops logistics should outrank legacy market request");
  assert(!hauler.memory.marketTask, "legacy market task should not be selected while ops logistics is available");
  assert(!hauler.memory.advancedTask, "advanced task should not be selected while ops logistics is available");
  assertHaulerTargetAction(hauler, room.storage.id, "ops logistics priority");

  room = buildHaulerExecutionOrderRoom("VAL_HAULER_ORDER_MARKET_ADV", {
    tick: 1321,
    terminalStore: { energy: 10000, U: 500, H: 500 },
  });
  room.storage.store.Z = 500;
  collectHaulerExecutionState(room);
  hauler = Game.creeps.VAL_HAULER_ORDER_MARKET_ADV_hauler;
  const advancedPreview = advancedStructureManager.getHaulerTask(room, hauler, utils.getRoomRuntimeCache(room).state);
  assert(advancedPreview && advancedPreview.label === "lab_input", `expected lab_input advanced task, got ${advancedPreview ? advancedPreview.label : "none"}`);
  delete hauler.memory.advancedTask;
  const legacyMarket = marketRequestManager.createStageRequest("Z", 50, room.name);
  assert(legacyMarket.ok, `expected legacy market request, got ${legacyMarket.message}`);
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(hauler.memory.marketTask, "legacy market should outrank advanced structure task");
  assert(!hauler.memory.advancedTask, "advanced task should not be selected while legacy market is available");
  assertHaulerTargetAction(hauler, room.storage.id, "legacy market priority");

  room = buildHaulerExecutionOrderRoom("VAL_HAULER_ORDER_ADV_NORMAL", {
    tick: 1322,
    terminalStore: { energy: 10000, U: 500, H: 500 },
  });
  room.storage.store.energy = 200000;
  collectHaulerExecutionState(room);
  hauler = Game.creeps.VAL_HAULER_ORDER_ADV_NORMAL_hauler;
  const sourceContainer = firstSourceContainer(room);
  assert((sourceContainer.store.energy || 0) > 0, "expected normal pickup opportunity");
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(hauler.memory.advancedTask, "advanced structure task should outrank normal hauling");
  assert(!hauler.memory.pickupTargetId, "normal pickup target should not be selected while advanced task is available");
  assert(!hauler.memory.deliveryTargetId, "normal delivery target should not be selected while advanced task is available");
  assertHaulerTargetAction(hauler, room.terminal.id, "advanced structure priority");

  room = buildOpsLogisticsRoom("VAL_HAULER_ORDER_NORMAL_PICKUP", {
    tick: 1323,
    storageStore: { energy: 200000 },
    terminalStore: { energy: 10000 },
  });
  collectHaulerExecutionState(room);
  hauler = createCreep("normalPickupHauler", "hauler", 16, 25, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  const normalPickup = firstSourceContainer(room);
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(hauler.memory.pickupTargetId === normalPickup.id, "normal hauling should select an energy pickup target");
  assert(hauler.memory.pickupTargetKind === "withdraw", "normal hauling should record pickup target kind");
  assertHaulerAction(hauler, "withdraw", normalPickup.id, "normal pickup fallback");

  room = buildOpsLogisticsRoom("VAL_HAULER_ORDER_NORMAL_DELIVER", {
    tick: 1324,
    storageStore: { energy: 200000 },
    terminalStore: { energy: 10000 },
  });
  room.spawn.store.energy = 0;
  collectHaulerExecutionState(room);
  hauler = createCreep("normalDeliveryHauler", "hauler", 25, 25, {
    roomName: room.name,
    memory: { delivering: true },
    store: { energy: 50 },
    storeCapacity: 50,
  });
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(hauler.memory.deliveryTargetId === room.spawn.id, "normal hauling should select an energy delivery target");
  assertHaulerAction(hauler, "transfer", room.spawn.id, "normal delivery fallback");

  room = buildHaulerExecutionOrderRoom("VAL_HAULER_ORDER_CARRY_SAFETY", {
    tick: 1325,
    terminalStore: { energy: 10000, U: 500, H: 500 },
  });
  room.storage.store.H = 500;
  room.storage.store.Z = 500;
  collectHaulerExecutionState(room);
  hauler = createCreep("carrySafetyHauler", "hauler", 25, 31, {
    roomName: room.name,
    store: { Z: 25 },
    storeCapacity: 50,
  });
  const staleAdvanced = advancedStructureManager.getHaulerTask(
    room,
    createCreep("carrySafetyPreview", "hauler", 24, 27, {
      roomName: room.name,
      store: {},
      storeCapacity: 50,
    }),
    utils.getRoomRuntimeCache(room).state,
  );
  assert(staleAdvanced, "expected advanced task for carry-state safety setup");
  hauler.memory.advancedTask = Object.assign({}, staleAdvanced);
  opsLogisticsManager.createMoveRequest("H", 50, room.name, "storage", "terminal");
  marketRequestManager.createStageRequest("Z", 50, room.name);
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(!hauler.memory.opsLogisticsTask, "non-matching carry should not claim ops logistics task");
  assert(!hauler.memory.marketTask, "non-matching carry should not claim legacy market task");
  assert(!hauler.memory.advancedTask, "non-matching carry should clear stale advanced task");
  assert(!hauler.memory.pickupTargetId, "non-matching carry should not create normal pickup memory");
  assert(!hauler.memory.deliveryTargetId, "non-matching carry should not create normal delivery memory");
  assertHaulerAction(hauler, "transfer", room.terminal.id, "non-matching advanced carry return");

  room = buildHaulerExecutionOrderRoom("VAL_HAULER_ORDER_CLEANUP", {
    tick: 1326,
    terminalStore: { energy: 10000, U: 50, H: 50 },
  });
  room.storage.store.Z = 500;
  collectHaulerExecutionState(room);
  hauler = createCreep("cleanupMarketHauler", "hauler", 24, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  const cleanupMarket = marketRequestManager.createStageRequest("Z", 50, room.name);
  assert(cleanupMarket.ok, `expected cleanup market request, got ${cleanupMarket.message}`);
  hauler.pos = new RoomPosition(room.storage.pos.x, room.storage.pos.y, room.name);
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(hauler.memory.marketTask, "expected market task before cleanup");
  hauler.pos = new RoomPosition(25, 32, room.name);
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(!hauler.memory.marketTask, "completed legacy market task should clear marketTask memory");

  room = buildHaulerExecutionOrderRoom("VAL_HAULER_ORDER_ADV_CLEANUP", {
    tick: 1327,
    terminalStore: { energy: 10000, U: 500, H: 500 },
    creeps: [
      { name: "VAL_HAULER_ORDER_ADV_CLEANUP_hauler", role: "hauler", x: 25, y: 32, store: {}, storeCapacity: 500 },
    ],
  });
  collectHaulerExecutionState(room);
  hauler = Game.creeps.VAL_HAULER_ORDER_ADV_CLEANUP_hauler;
  hauler.pos = new RoomPosition(room.terminal.pos.x, room.terminal.pos.y, room.name);
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(hauler.memory.advancedTask, "expected advanced task before cleanup");
  const advancedTask = hauler.memory.advancedTask;
  const advancedDelivery = Game.getObjectById(advancedTask.deliveryId);
  hauler.pos = new RoomPosition(advancedDelivery.pos.x, advancedDelivery.pos.y, room.name);
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(!hauler.memory.advancedTask, "completed advanced task should clear advancedTask memory");

  room = buildOpsLogisticsRoom("VAL_HAULER_ORDER_PICKUP_CLEANUP", {
    tick: 1328,
    storageStore: { energy: 200000 },
    terminalStore: { energy: 10000 },
  });
  collectHaulerExecutionState(room);
  hauler = createCreep("cleanupPickupHauler", "hauler", 16, 25, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(hauler.memory.pickupTargetId && hauler.memory.pickupTargetKind, "expected normal pickup memory before cleanup");
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(!hauler.memory.pickupTargetId, "full hauler should clear pickupTargetId when switching to delivery");
  assert(!hauler.memory.pickupTargetKind, "full hauler should clear pickupTargetKind when switching to delivery");

  hauler.memory.deliveryTargetId = room.spawn.id;
  hauler.memory.delivering = true;
  hauler.store.energy = 0;
  roleHauler.run(hauler, { thinkInterval: 1 });
  assert(!hauler.memory.deliveryTargetId, "empty delivering hauler should clear deliveryTargetId");
}

function runTerminalHygieneCommandsScenario() {
  let room = buildOpsLogisticsRoom("VAL_TERMINAL_HYGIENE", {
    tick: 1330,
    storageStore: { energy: 200000, H: 8000 },
    terminalStore: { energy: 12000, H: 60000, Z: 5000 },
  });

  let captured = captureConsoleLines(function () {
    return ops.terminalStatus(room.name);
  });
  assert(typeof captured.result === "string", "room terminalStatus should return a printable string");
  assert(captured.result.indexOf(`Terminal ${room.name}: HEALTHY`) !== -1, "room terminalStatus should return the requested room report");
  assert(captured.result.indexOf("used 77,000") !== -1, `expected terminal used 77000, got ${captured.result}`);
  assert(captured.result.indexOf("free 223,000") !== -1, `expected terminal free 223000, got ${captured.result}`);
  assert(captured.result.indexOf("energy 12,000") !== -1, `expected terminal energy 12000, got ${captured.result}`);
  assert(
    captured.lines.some(function (line) { return line.indexOf("H: 60,000") !== -1; }),
    `room terminalStatus should list all resources, got ${captured.lines.join(" / ")}`,
  );

  const addTerminalStatusRoom = function (name, terminalStore) {
    const statusRoom = new FakeRoom(name, new FakeTerrain());
    statusRoom.setController(
      createController(20, 20, {
        roomName: name,
        level: 8,
        my: true,
        owner: { username: "tester" },
      }),
    );
    statusRoom.controller.my = true;
    statusRoom.controller.owner = { username: "tester" };
    statusRoom.addStructure(
      createStructure(STRUCTURE_SPAWN, 25, 25, {
        roomName: name,
        name: `${name}_spawn`,
        store: { energy: 300 },
        storeCapacityResource: { energy: 300 },
      }),
    );
    statusRoom.addSource(createSource(15, 25, { roomName: name }));
    statusRoom.addMineral(createMineral(40, 10, { roomName: name }));
    statusRoom.addStructure(
      createStructure(STRUCTURE_TERMINAL, 25, 32, {
        roomName: name,
        store: terminalStore,
        storeCapacity: 300000,
        cooldown: 0,
      }),
    );
    return statusRoom;
  };

  const busyRoom = addTerminalStatusRoom("VAL_TERMINAL_BUSY", { energy: 260000, H: 10000 });
  const congestedRoom = addTerminalStatusRoom("VAL_TERMINAL_CONGESTED", { energy: 285000 });
  const fullRoom = addTerminalStatusRoom("VAL_TERMINAL_FULL", { energy: 300000 });

  captured = captureConsoleLines(function () {
    return ops.terminalStatus();
  });
  const empireReport = captured.result;
  assert(typeof empireReport === "string", "empire terminalStatus should return a printable string");
  assert(
    empireReport.indexOf(`${room.name} | HEALTHY`) !== -1,
    "empire terminalStatus should include healthy room",
  );
  assert(
    empireReport.indexOf(`${busyRoom.name} | BUSY`) !== -1,
    "empire terminalStatus should include busy room",
  );
  assert(
    empireReport.indexOf(`${congestedRoom.name} | CONGESTED`) !== -1,
    "empire terminalStatus should include congested room",
  );
  assert(
    empireReport.indexOf(`${fullRoom.name} | FULL`) !== -1,
    "empire terminalStatus should include full room",
  );
  assert(
    captured.lines.some(function (line) {
      return line.indexOf(room.name) !== -1 && line.indexOf("top H 60,000") !== -1;
    }),
    `empire terminalStatus should include top resources, got ${captured.lines.join(" / ")}`,
  );

  const noTerminalRoom = buildRoomScenario("VAL_TERMINAL_NONE", {
    tick: 1334,
    controllerLevel: 8,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
  });
  noTerminalRoom.controller.my = true;
  captured = captureConsoleLines(function () {
    return ops.terminalStatus(noTerminalRoom.name);
  });
  assert(
    captured.result.indexOf("has no terminal") !== -1,
    `no-terminal status should print a clear message, got ${captured.result}`,
  );

  room = buildOpsLogisticsRoom("VAL_TERMINAL_CLEAR", {
    tick: 1335,
    storageStore: { energy: 200000 },
    terminalStore: { energy: 12000, H: 60000 },
  });
  let result = ops.clearTerminal(room.name, "H", 50000);
  assert(result.ok && !result.skipped, `expected clearTerminal request, got ${result.message}`);
  assert(result.request.amount === 50000, `clearTerminal should request 50000, got ${result.request.amount}`);
  assertOpsLogisticsRequestShape(result.request, {
    status: "open",
    roomName: room.name,
    resourceType: "H",
    from: "terminal",
    to: "storage",
  });

  const duplicateClear = ops.clearTerminal(room.name, "H", 10000);
  assert(duplicateClear.ok && duplicateClear.skipped, `duplicate clearTerminal should be skipped, got ${duplicateClear.message}`);
  assert(duplicateClear.request.id === result.request.id, "duplicate clearTerminal should return existing request");

  result = ops.clearTerminal("VAL_TERMINAL_CLEAR_MISSING", "H", 5000);
  assert(!result.ok, "clearTerminal should reject invalid rooms");

  result = ops.clearTerminal(room.name, "Z", 5000);
  assert(!result.ok, "clearTerminal should reject resources missing from terminal");

  result = ops.clearTerminal(room.name, "H", 0);
  assert(!result.ok, "clearTerminal should reject non-positive amounts");

  room = buildOpsLogisticsRoom("VAL_TERMINAL_FILL", {
    tick: 1336,
    storageStore: { energy: 200000, H: 8000 },
    terminalStore: { energy: 12000 },
  });
  result = ops.fillTerminal(room.name, "H", 5000);
  assert(result.ok && !result.skipped, `expected fillTerminal request, got ${result.message}`);
  assert(result.request.amount === 5000, `fillTerminal should request 5000, got ${result.request.amount}`);
  assertOpsLogisticsRequestShape(result.request, {
    status: "open",
    roomName: room.name,
    resourceType: "H",
    from: "storage",
    to: "terminal",
  });

  const duplicateFill = ops.fillTerminal(room.name, "H", 1000);
  assert(duplicateFill.ok && duplicateFill.skipped, `duplicate fillTerminal should be skipped, got ${duplicateFill.message}`);
  assert(duplicateFill.request.id === result.request.id, "duplicate fillTerminal should return existing request");

  result = ops.fillTerminal("VAL_TERMINAL_FILL_MISSING", "H", 5000);
  assert(!result.ok, "fillTerminal should reject invalid rooms");

  result = ops.fillTerminal(room.name, "Z", 5000);
  assert(!result.ok, "fillTerminal should reject resources missing from storage");

  result = ops.fillTerminal(room.name, "H", 0);
  assert(!result.ok, "fillTerminal should reject non-positive amounts");

  room = buildOpsLogisticsRoom("VAL_TERMINAL_CLEAR_AUTO", {
    tick: 1337,
    storageStore: { energy: 200000 },
    terminalStore: { energy: 20000, H: 120000, Z: 5000 },
  });
  const autoClear = ops.clearTerminal(room.name);
  assert(autoClear.ok, `expected automatic clearTerminal ok, got ${autoClear.message}`);
  assert(
    autoClear.requests.some(function (entry) {
      return entry.request && entry.request.resourceType === "H" && entry.request.from === "terminal" && entry.request.to === "storage";
    }),
    "automatic clearTerminal should request non-energy mineral cleanup",
  );
  assert(
    autoClear.requests.every(function (entry) {
      return entry.request && entry.request.resourceType !== RESOURCE_ENERGY;
    }),
    "automatic clearTerminal should not create energy cleanup requests",
  );
}

function getOnlyTransferPlan() {
  const plans = Memory.ops && Memory.ops.transfers ? Object.values(Memory.ops.transfers) : [];
  assert(plans.length === 1, `expected exactly one transfer plan, got ${plans.length}`);
  return plans[0];
}

function assertCleanTransferString(value, label) {
  assert(typeof value === "string", `${label} should return a clean string`);
  assert(value.indexOf("[object Object]") === -1, `${label} must not return raw object text`);
}

function runOpsTransferScenario() {
  resetRuntime(1340);
  const source = addTransferRoom("W41N7", {
    withStorage: true,
    storageStore: { energy: 200000, power: 5000 },
    terminalStore: { energy: 10000 },
  });
  const destination = addTransferRoom("W42N9", {
    withStorage: true,
    storageStore: { energy: 100000 },
    terminalStore: { energy: 5000 },
    terminalCapacity: 300000,
  });
  ops.registerGlobals();

  assert(typeof global.ops.transfer === "function", "ops.transfer should be registered");
  assert(typeof global.ops.transfers === "function", "ops.transfers should be registered");
  assert(typeof global.ops.transferStatus === "function", "ops.transferStatus should be registered");
  assert(typeof global.ops.cancelTransfer === "function", "ops.cancelTransfer should be registered");
  assert(typeof global.ops.transferCancel === "undefined", "ops.transferCancel must not be registered");

  let captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "storage", "W42N9", "terminal", "check");
  });
  assertCleanTransferString(captured.result, "ops.transfer storage->terminal check");
  assert(captured.result.indexOf("status CHECK") !== -1, `expected check status, got ${captured.result}`);
  assert(captured.result.indexOf("resource power") !== -1, `expected normalized power resource, got ${captured.result}`);
  assert(captured.result.indexOf("source 5,000") !== -1, `expected source storage amount, got ${captured.result}`);
  assert(currentRuntime.terminalSends.length === 0, "check mode must not call terminal.send");

  captured = captureConsoleLines(function () {
    return global.ops.transfer("power", 1000, "W41N7", "storage", "W42N9", "terminal");
  });
  assert(captured.result.indexOf("mode check") !== -1, `omitted mode should default to check, got ${captured.result}`);
  assert(currentRuntime.terminalSends.length === 0, "omitted mode check must not call terminal.send");

  captured = captureConsoleLines(function () {
    return global.ops.transfer("power", 1000, "W41N7", "storage", "W42N9", "terminal", "confirm");
  });
  assertCleanTransferString(captured.result, "ops.transfer storage->terminal confirm");
  assert(captured.result.indexOf("status SOURCE_STAGE") !== -1, `storage source should stage first, got ${captured.result}`);
  let plan = getOnlyTransferPlan();
  assert(plan.fromLocation === "storage" && plan.toLocation === "terminal", "storage->terminal plan should retain endpoints");
  assert(plan.sourceRequestId, "storage->terminal should create a source staging request");
  assertOpsLogisticsRequestShape(Memory.ops.logistics.requests[plan.sourceRequestId], {
    status: "open",
    roomName: source.name,
    resourceType: RESOURCE_POWER,
    from: "storage",
    to: "terminal",
  });

  captured = captureConsoleLines(function () {
    return global.ops.transfer("power", 1000, "W41N7", "storage", "W42N9", "terminal", "confirm");
  });
  assert(captured.result.indexOf("duplicate_active_transfer_") !== -1, `duplicate active transfer should block, got ${captured.result}`);

  source.storage.store[RESOURCE_POWER] -= 1000;
  source.terminal.store[RESOURCE_POWER] = (source.terminal.store[RESOURCE_POWER] || 0) + 1000;
  Memory.ops.logistics.requests[plan.sourceRequestId].status = "done";
  Memory.ops.logistics.requests[plan.sourceRequestId].remaining = 0;
  transferManager.run();
  assert(currentRuntime.terminalSends.length === 1, "staged storage->terminal should send after source staging completes");
  assert(destination.terminal.store[RESOURCE_POWER] === 1000, "storage->terminal should deliver to destination terminal");
  assert(plan.status === "COMPLETE", `storage->terminal should complete, got ${plan.status}`);

  let listReport = global.ops.transfers();
  assertCleanTransferString(listReport, "ops.transfers");
  assert(listReport.indexOf("active 0") !== -1, `completed transfer should not remain active, got ${listReport}`);
  let statusReport = global.ops.transferStatus(plan.id);
  assertCleanTransferString(statusReport, "ops.transferStatus");
  assert(statusReport.indexOf("status COMPLETE") !== -1, `transferStatus should show completion, got ${statusReport}`);
  assert(statusReport.indexOf("progress sent 1,000/1,000") !== -1, `transferStatus should show progress, got ${statusReport}`);

  resetRuntime(1341);
  addTransferRoom("W41N7", {
    withStorage: true,
    storageStore: { energy: 200000 },
    terminalStore: { energy: 10000, power: 3000 },
  });
  const terminalToStorageDest = addTransferRoom("W42N9", {
    withStorage: true,
    storageStore: { energy: 100000 },
    terminalStore: { energy: 5000 },
  });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "storage", "confirm");
  });
  assert(captured.result.indexOf("status DESTINATION_STAGE") !== -1, `terminal->storage should enter destination stage, got ${captured.result}`);
  plan = getOnlyTransferPlan();
  assert(plan.destinationRequestId, "terminal->storage should create destination unload request");
  assertOpsLogisticsRequestShape(Memory.ops.logistics.requests[plan.destinationRequestId], {
    status: "open",
    roomName: terminalToStorageDest.name,
    resourceType: RESOURCE_POWER,
    from: "terminal",
    to: "storage",
  });
  terminalToStorageDest.terminal.store[RESOURCE_POWER] -= 1000;
  terminalToStorageDest.storage.store[RESOURCE_POWER] = (terminalToStorageDest.storage.store[RESOURCE_POWER] || 0) + 1000;
  Memory.ops.logistics.requests[plan.destinationRequestId].status = "done";
  Memory.ops.logistics.requests[plan.destinationRequestId].remaining = 0;
  transferManager.run();
  assert(plan.status === "COMPLETE", `terminal->storage should complete after unload, got ${plan.status}`);

  resetRuntime(1342);
  const storageSource = addTransferRoom("W41N7", {
    withStorage: true,
    storageStore: { energy: 200000, power: 4000 },
    terminalStore: { energy: 10000 },
  });
  const storageDest = addTransferRoom("W42N9", {
    withStorage: true,
    storageStore: { energy: 100000 },
    terminalStore: { energy: 5000 },
  });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "storage", "W42N9", "storage", "confirm");
  });
  assert(captured.result.indexOf("status SOURCE_STAGE") !== -1, `storage->storage should source-stage first, got ${captured.result}`);
  plan = getOnlyTransferPlan();
  storageSource.storage.store[RESOURCE_POWER] -= 1000;
  storageSource.terminal.store[RESOURCE_POWER] = (storageSource.terminal.store[RESOURCE_POWER] || 0) + 1000;
  Memory.ops.logistics.requests[plan.sourceRequestId].status = "done";
  Memory.ops.logistics.requests[plan.sourceRequestId].remaining = 0;
  transferManager.run();
  assert(plan.status === "DESTINATION_STAGE", `storage->storage should unload after send, got ${plan.status}`);
  assert(plan.destinationRequestId, "storage->storage should create destination unload request");
  storageDest.terminal.store[RESOURCE_POWER] -= 1000;
  storageDest.storage.store[RESOURCE_POWER] = (storageDest.storage.store[RESOURCE_POWER] || 0) + 1000;
  Memory.ops.logistics.requests[plan.destinationRequestId].status = "done";
  Memory.ops.logistics.requests[plan.destinationRequestId].remaining = 0;
  transferManager.run();
  assert(plan.status === "COMPLETE", `storage->storage should complete, got ${plan.status}`);

  resetRuntime(1343);
  const terminalSource = addTransferRoom("W41N7", {
    withStorage: true,
    storageStore: { energy: 200000 },
    terminalStore: { energy: 10000, power: 5000 },
  });
  const terminalDest = addTransferRoom("W42N9", {
    withStorage: true,
    storageStore: { energy: 100000 },
    terminalStore: { energy: 5000 },
    terminalCapacity: 300000,
  });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "terminal", "confirm");
  });
  assert(captured.result.indexOf("status COMPLETE") !== -1, `terminal->terminal should still work, got ${captured.result}`);
  assert(currentRuntime.terminalSends.length === 1, "terminal->terminal confirm should call terminal.send once through the plan");
  assert(currentRuntime.terminalSends[0].description.indexOf("Omega ops.transfer") !== -1, "terminal.send should use ops.transfer description");
  assert(terminalSource.terminal.store[RESOURCE_POWER] === 4000, "terminal->terminal should debit source power");
  assert(terminalDest.terminal.store[RESOURCE_POWER] === 1000, "terminal->terminal should credit destination power");

  resetRuntime(1344);
  addTransferRoom("W41N7", { withStorage: true, storageStore: { energy: 10000 }, terminalStore: { energy: 10000, power: 5000 }, cooldown: 7 });
  addTransferRoom("W42N9", { withStorage: true, storageStore: { energy: 10000 }, terminalStore: { energy: 1000 } });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "terminal", "confirm");
  });
  assert(captured.result.indexOf("status BLOCKED") !== -1 && captured.result.indexOf("source_terminal_cooldown") !== -1, `cooldown should block, got ${captured.result}`);
  plan = getOnlyTransferPlan();
  assert(plan.status === "BLOCKED", "blocked transfer should remain in plan storage");

  resetRuntime(1345);
  addTransferRoom("W41N7", { withStorage: true, storageStore: { energy: 10000 }, terminalStore: { energy: 10000, power: 5000 } });
  addTransferRoom("W42N9", { withStorage: true, storageStore: { energy: 10000 }, terminalStore: { energy: 1000 } });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "storage", "confirm");
  });
  plan = getOnlyTransferPlan();
  const cancelResult = global.ops.cancelTransfer(plan.id);
  assertCleanTransferString(cancelResult, "ops.cancelTransfer");
  assert(cancelResult.indexOf("cancelled") !== -1, `cancelTransfer should confirm cancellation, got ${cancelResult}`);
  assert(plan.status === "CANCELLED", `cancelTransfer should mark plan cancelled, got ${plan.status}`);

  resetRuntime(1346);
  addTransferRoom("W41N7", { withStorage: true, storageStore: { energy: 10000 }, terminalStore: { energy: 10000, power: 50 } });
  addTransferRoom("W42N9", { withStorage: true, storageStore: { energy: 10000 }, terminalStore: { energy: 1000 } });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "terminal", "confirm");
  });
  assert(captured.result.indexOf("blocked source_resource_insufficient") !== -1, `source amount should block, got ${captured.result}`);
  assert(!Memory.ops || !Memory.ops.transfers || Object.keys(Memory.ops.transfers).length === 0, "invalid confirms should not create plans");

  resetRuntime(1347);
  addTransferRoom("W41N7", { withStorage: true, terminalStore: { energy: 50, power: 5000 } });
  addTransferRoom("W42N9", { withStorage: true });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "terminal", "confirm");
  });
  assert(captured.result.indexOf("blocked transaction_energy_insufficient") !== -1, `transaction energy should block, got ${captured.result}`);

  resetRuntime(1348);
  addTransferRoom("W41N7", { owned: false });
  addTransferRoom("W42N9", { withStorage: true });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "terminal", "confirm");
  });
  assert(captured.result.indexOf("blocked source_room_not_owned") !== -1, `unowned source should block, got ${captured.result}`);

  resetRuntime(1349);
  addTransferRoom("W41N7", { withTerminal: false, withStorage: true });
  addTransferRoom("W42N9", { withStorage: true });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "terminal", "confirm");
  });
  assert(captured.result.indexOf("blocked source_terminal_missing") !== -1, `missing source terminal should block, got ${captured.result}`);

  resetRuntime(1350);
  addTransferRoom("W41N7", { withStorage: true, terminalStore: { energy: 10000, power: 5000 } });
  addTransferRoom("W42N9", { withStorage: true, terminalStore: { energy: 300000 }, terminalCapacity: 300000 });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "terminal", "check");
  });
  assert(captured.result.indexOf("blocked destination_capacity_insufficient") !== -1, `destination capacity should block, got ${captured.result}`);

  resetRuntime(1351);
  addTransferRoom("W41N7", { withStorage: true, terminalStore: { energy: 10000, power: 5000 } });
  addTransferRoom("W42N9", { withTerminal: false, withStorage: true });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "terminal", "confirm");
  });
  assert(captured.result.indexOf("blocked destination_terminal_missing") !== -1, `visible owned destination without terminal should block, got ${captured.result}`);

  resetRuntime(1352);
  addTransferRoom("W41N7", { withStorage: true, terminalStore: { energy: 10000, power: 5000 } });
  Memory.rooms.W41N7 = { state: { defense: { hasThreats: true } } };
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "terminal", "confirm");
  });
  assert(captured.result.indexOf("blocked source_room_threat") !== -1, `source threat should block, got ${captured.result}`);

  resetRuntime(1353);
  addTransferRoom("W41N7", { withStorage: true, terminalStore: { energy: 10000, power: 5000 } });
  addTransferRoom("W42N9", { withStorage: true });
  Game.cpu.bucket = 500;
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "terminal", "confirm");
  });
  assert(captured.result.indexOf("blocked critical_cpu_pressure") !== -1, `critical CPU should block, got ${captured.result}`);

  resetRuntime(1354);
  addTransferRoom("W41N7", { withStorage: true, terminalStore: { energy: 10000, power: 5000 } });
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.transfer(RESOURCE_POWER, 1000, "W41N7", "terminal", "W42N9", "terminal", "check");
  });
  assert(captured.result.indexOf("destFree not_visible") !== -1, `invisible terminal destination should be allowed for check, got ${captured.result}`);

  const moveSource = ops.move.toString();
  assert(moveSource.indexOf("opsLogisticsManager.createMoveRequest") !== -1, "ops.move should remain delegated to opsLogisticsManager.createMoveRequest");
  assert(moveSource.indexOf("transferManager") === -1, "ops.move should not be rewritten to use transferManager");
}

function runOpsLogisticsHarnessCoverageScenario() {
  let room = buildOpsLogisticsRoom("VAL_OPS_LOGISTICS_CREATE", {
    storageStore: { energy: 5000, H: 500 },
    terminalStore: { energy: 1000 },
  });

  let result = ops.move(RESOURCE_ENERGY, 1200, room.name, "storage", "terminal");
  assert(result.ok && !result.skipped, `expected storage -> terminal request, got ${result.message}`);
  assert(result.request.amount === 1200, `expected request amount 1200, got ${result.request.amount}`);
  assertOpsLogisticsRequestShape(result.request, {
    status: "open",
    roomName: room.name,
    resourceType: RESOURCE_ENERGY,
    from: "storage",
    to: "terminal",
  });

  result = ops.move(RESOURCE_ENERGY, 500, room.name, "terminal", "storage");
  assert(result.ok && !result.skipped, `expected terminal -> storage request, got ${result.message}`);
  assertOpsLogisticsRequestShape(result.request, {
    status: "open",
    roomName: room.name,
    resourceType: RESOURCE_ENERGY,
    from: "terminal",
    to: "storage",
  });

  result = ops.move(RESOURCE_ENERGY, 100, room.name, "container", "terminal");
  assert(!result.ok, "invalid endpoint should be rejected");

  result = ops.move(RESOURCE_ENERGY, 100, "VAL_OPS_LOGISTICS_MISSING", "storage", "terminal");
  assert(!result.ok, "missing owned room should be rejected");

  room = buildRoomScenario("VAL_OPS_LOGISTICS_NO_STORAGE", {
    tick: 1301,
    controllerLevel: 8,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
  });
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  room.addStructure(
    createStructure(STRUCTURE_TERMINAL, 25, 32, {
      roomName: room.name,
      store: { energy: 1000 },
      storeCapacity: 300000,
    }),
  );
  result = ops.move(RESOURCE_ENERGY, 100, room.name, "storage", "terminal");
  assert(!result.ok, "missing storage should be rejected");

  room = buildRoomScenario("VAL_OPS_LOGISTICS_NO_TERMINAL", {
    tick: 1302,
    controllerLevel: 8,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
  });
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  room.addStructure(
    createStructure(STRUCTURE_STORAGE, 24, 27, {
      roomName: room.name,
      store: { energy: 1000 },
      storeCapacity: 1000000,
    }),
  );
  result = ops.move(RESOURCE_ENERGY, 100, room.name, "storage", "terminal");
  assert(!result.ok, "missing terminal should be rejected");

  room = buildOpsLogisticsRoom("VAL_OPS_LOGISTICS_DUP", {
    tick: 1303,
    storageStore: { energy: 5000 },
    terminalStore: { energy: 1000 },
  });
  const first = opsLogisticsManager.createMoveRequest(RESOURCE_ENERGY, 1000, room.name, "storage", "terminal");
  const duplicate = opsLogisticsManager.createMoveRequest(RESOURCE_ENERGY, 500, room.name, "storage", "terminal");
  assert(first.ok && duplicate.ok && duplicate.skipped, `expected duplicate to be skipped, got ${duplicate.message}`);
  assert(duplicate.request.id === first.request.id, "duplicate should return the existing open request");
  assert(duplicate.request.amount === 1000, `duplicate should not merge amount, got ${duplicate.request.amount}`);

  let requestReport = ops.requests(room.name);
  assert(typeof requestReport === "string", "ops.requests should return a printable string");
  assert(requestReport.indexOf(first.request.id) !== -1, "ops.requests should list the active logistics request");
  const cancel = ops.cancel(first.request.id);
  assert(cancel.ok && cancel.request.status === "canceled", "cancel should mark request canceled");
  requestReport = ops.requests(room.name);
  assert(requestReport.indexOf(first.request.id) === -1, "ops.requests should hide canceled history by default");
  requestReport = ops.requests(room.name, "all");
  assert(requestReport.indexOf(first.request.id) !== -1, "ops.requests(roomName, all) should include canceled history");
  requestReport = ops.requests("history");
  assert(requestReport.indexOf(first.request.id) !== -1, "ops.requests(history) should include all room history");
  assert(
    requestReport.indexOf("canceled 1") !== -1,
    `ops.requests should include status counts, got ${requestReport}`,
  );
  const canceledHauler = createCreep("opsCancelHauler", "hauler", 25, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 100,
  });
  assert(opsLogisticsManager.getHaulerTask(room, canceledHauler) === null, "canceled request should not be claimable");

  room = buildOpsLogisticsRoom("VAL_OPS_LOGISTICS_CLAIM", {
    tick: 1304,
    storageStore: { energy: 1000 },
    terminalStore: { energy: 1000 },
  });
  const claimResult = opsLogisticsManager.createMoveRequest(RESOURCE_ENERGY, 80, room.name, "storage", "terminal");
  const haulerA = createCreep("opsClaimA", "hauler", 25, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  const haulerB = createCreep("opsClaimB", "hauler", 25, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  const taskA = opsLogisticsManager.getHaulerTask(room, haulerA);
  const taskB = opsLogisticsManager.getHaulerTask(room, haulerB);
  assert(taskA && taskA.amount === 50, `expected first claim to use creep capacity 50, got ${taskA ? taskA.amount : "none"}`);
  assert(taskB && taskB.amount === 30, `expected second claim to cap at remaining 30, got ${taskB ? taskB.amount : "none"}`);
  let listed = opsLogisticsManager.listRequests(room.name).find((row) => row.id === claimResult.request.id);
  assert(listed.claimed === 80, `expected claimed amount 80, got ${listed.claimed}`);

  delete Game.creeps[haulerB.name];
  Game.time += 26;
  listed = opsLogisticsManager.listRequests(room.name).find((row) => row.id === claimResult.request.id);
  assert(listed.claimed === 0, `expected expired and missing creep claims to be cleaned up, got ${listed.claimed}`);

  opsLogisticsManager.completeHaulerTask(haulerA, 50);
  assert(claimResult.request.remaining === 30, `expected remaining 30 after completion, got ${claimResult.request.remaining}`);
  assert(!claimResult.request.claims[haulerA.name], "completion should release hauler claim");
  assert(!haulerA.memory.opsLogisticsTask, "completion should clear creep task memory");

  const haulerC = createCreep("opsClaimC", "hauler", 25, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 100,
  });
  const taskC = opsLogisticsManager.getHaulerTask(room, haulerC);
  assert(taskC && taskC.amount === 30, `expected final claim of 30, got ${taskC ? taskC.amount : "none"}`);
  opsLogisticsManager.completeHaulerTask(haulerC, 30);
  assert(claimResult.request.remaining === 0, "request should have zero remaining after final completion");
  assert(claimResult.request.status === "done", `expected done request, got ${claimResult.request.status}`);
  assert(!claimResult.request.claims[haulerC.name], "final completion should release claim");

  const releaseResult = opsLogisticsManager.createMoveRequest(RESOURCE_ENERGY, 50, room.name, "storage", "terminal");
  const releaseHauler = createCreep("opsReleaseHauler", "hauler", 25, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  assert(opsLogisticsManager.getHaulerTask(room, releaseHauler), "expected release hauler to claim request");
  opsLogisticsManager.releaseHaulerTask(releaseHauler, "test_release");
  assert(!releaseResult.request.claims[releaseHauler.name], "release should remove claim");
  assert(!releaseHauler.memory.opsLogisticsTask, "release should clear creep task memory");

  room = buildOpsLogisticsRoom("VAL_OPS_LOGISTICS_CAPS", {
    tick: 1305,
    storageStore: { energy: 40 },
    terminalStore: { energy: 299980 },
  });
  const capped = opsLogisticsManager.createMoveRequest(RESOURCE_ENERGY, 100, room.name, "storage", "terminal");
  const cappedHauler = createCreep("opsCappedHauler", "hauler", 25, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  const cappedTask = opsLogisticsManager.getHaulerTask(room, cappedHauler);
  assert(capped.request.amount === 20, `creation should cap by target free capacity, got ${capped.request.amount}`);
  assert(cappedTask && cappedTask.amount === 20, `claim should cap by request/source/target/creep limits, got ${cappedTask ? cappedTask.amount : "none"}`);

  room = buildOpsLogisticsRoom("VAL_OPS_LOGISTICS_BLOCKS", {
    tick: 1306,
    storageStore: { energy: 0 },
    terminalStore: { energy: 1000 },
  });
  Memory.ops = {
    logistics: {
      requests: {
        blocked_empty: {
          id: "blocked_empty",
          type: "move",
          status: "open",
          roomName: room.name,
          resourceType: RESOURCE_ENERGY,
          amount: 50,
          remaining: 50,
          from: "storage",
          to: "terminal",
          sourceId: room.storage.id,
          targetId: room.terminal.id,
          priority: 50,
          createdAt: Game.time,
          updatedAt: Game.time,
          expiresAt: Game.time + 1000,
          claims: {},
        },
      },
    },
  };
  const blockedHauler = createCreep("opsBlockedEmpty", "hauler", 25, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  assert(opsLogisticsManager.getHaulerTask(room, blockedHauler) === null, "empty source should prevent task assignment");
  assert(Memory.ops.logistics.requests.blocked_empty.status === "blocked", "empty source should mark request blocked");
  assert(Memory.ops.logistics.requests.blocked_empty.reason === "source_empty", "empty source should record source_empty reason");
  requestReport = ops.requests(room.name);
  assert(requestReport.indexOf("blocked_empty") !== -1, "ops.requests should show blocked requests as active");
  assertCleanOpsString(requestReport, "ops.requests active");
  requestReport = ops.requests(room.name, "blocked");
  assertCleanOpsString(requestReport, "ops.requests blocked");
  assert(requestReport.indexOf("blocked_empty") !== -1, "ops.requests blocked should include blocked requests");

  room = buildOpsLogisticsRoom("VAL_OPS_LOGISTICS_CANCEL_BLOCKED", {
    tick: 5000,
    storageStore: { energy: 1000, power: 1000, H: 1000 },
    terminalStore: { energy: 1000, power: 1000, H: 1000 },
  });
  const claimedHauler = createCreep("opsBlockedClaimed", "hauler", 25, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  Memory.ops = {
    logistics: {
      requests: {
        cancel_power_old: {
          id: "cancel_power_old",
          type: "move",
          status: "blocked",
          roomName: room.name,
          resourceType: RESOURCE_POWER,
          amount: 100,
          remaining: 100,
          from: "terminal",
          to: "powerSpawn",
          sourceId: "terminal_id",
          targetId: "power_spawn_id",
          priority: 50,
          reason: "source_empty",
          createdAt: Game.time - 1500,
          updatedAt: Game.time - 1200,
          expiresAt: Game.time + 1000,
          claims: {},
        },
        cancel_energy_open: {
          id: "cancel_energy_open",
          type: "move",
          status: "open",
          roomName: room.name,
          resourceType: RESOURCE_ENERGY,
          amount: 100,
          remaining: 100,
          from: "storage",
          to: "powerSpawn",
          sourceId: "storage_id",
          targetId: "power_spawn_id",
          priority: 50,
          createdAt: Game.time - 1500,
          updatedAt: Game.time - 1200,
          expiresAt: Game.time + 1000,
          claims: {},
        },
        cancel_power_claimed: {
          id: "cancel_power_claimed",
          type: "move",
          status: "blocked",
          roomName: room.name,
          resourceType: RESOURCE_POWER,
          amount: 100,
          remaining: 100,
          from: "terminal",
          to: "powerSpawn",
          sourceId: "terminal_id",
          targetId: "power_spawn_id",
          priority: 50,
          reason: "target_full",
          createdAt: Game.time - 1500,
          updatedAt: Game.time - 1200,
          expiresAt: Game.time + 1000,
          claims: {
            opsBlockedClaimed: {
              amount: 50,
              until: Game.time + 100,
            },
          },
        },
        cancel_done: {
          id: "cancel_done",
          type: "move",
          status: "done",
          roomName: room.name,
          resourceType: RESOURCE_POWER,
          amount: 100,
          remaining: 0,
          from: "terminal",
          to: "powerSpawn",
          sourceId: "terminal_id",
          targetId: "power_spawn_id",
          priority: 50,
          createdAt: Game.time - 1500,
          updatedAt: Game.time - 1200,
          expiresAt: Game.time + 1000,
          claims: {},
        },
        cancel_canceled: {
          id: "cancel_canceled",
          type: "move",
          status: "canceled",
          roomName: room.name,
          resourceType: RESOURCE_POWER,
          amount: 100,
          remaining: 100,
          from: "terminal",
          to: "powerSpawn",
          sourceId: "terminal_id",
          targetId: "power_spawn_id",
          priority: 50,
          createdAt: Game.time - 1500,
          updatedAt: Game.time - 1200,
          expiresAt: Game.time + 1000,
          claims: {},
        },
        cancel_expired: {
          id: "cancel_expired",
          type: "move",
          status: "expired",
          roomName: room.name,
          resourceType: RESOURCE_POWER,
          amount: 100,
          remaining: 100,
          from: "terminal",
          to: "powerSpawn",
          sourceId: "terminal_id",
          targetId: "power_spawn_id",
          priority: 50,
          createdAt: Game.time - 1500,
          updatedAt: Game.time - 1200,
          expiresAt: Game.time - 10,
          claims: {},
        },
        cancel_power_young: {
          id: "cancel_power_young",
          type: "move",
          status: "blocked",
          roomName: room.name,
          resourceType: RESOURCE_POWER,
          amount: 100,
          remaining: 100,
          from: "terminal",
          to: "powerSpawn",
          sourceId: "terminal_id",
          targetId: "power_spawn_id",
          priority: 50,
          reason: "source_empty",
          createdAt: Game.time - 500,
          updatedAt: Game.time - 200,
          expiresAt: Game.time + 1000,
          claims: {},
        },
        cancel_h_old: {
          id: "cancel_h_old",
          type: "move",
          status: "blocked",
          roomName: room.name,
          resourceType: "H",
          amount: 100,
          remaining: 100,
          from: "terminal",
          to: "storage",
          sourceId: "terminal_id",
          targetId: "storage_id",
          priority: 50,
          reason: "target_full",
          createdAt: Game.time - 1500,
          updatedAt: Game.time - 1200,
          expiresAt: Game.time + 1000,
          claims: {},
        },
      },
    },
  };
  assert(Game.creeps[claimedHauler.name], "claimed hauler should be visible for claim safety");
  assert(typeof global.ops.cancelRequests === "function", "ops.cancelRequests should be registered");
  let missingCancel = global.ops.cancelRequests();
  assertCleanOpsString(missingCancel, "ops.cancelRequests missing room");
  assert(missingCancel.indexOf("roomName required") !== -1, `missing room should be rejected, got ${missingCancel}`);

  requestReport = ops.requests(room.name, "blocked");
  assertCleanOpsString(requestReport, "ops.requests blocked seeded");
  assert(requestReport.indexOf("cancel_power_old") !== -1, "blocked report should include old blocked request");
  assert(requestReport.indexOf("cancel_energy_open") === -1, "blocked report should filter out open requests");
  assert(requestReport.indexOf("age 1,500") !== -1, `blocked report should include age, got ${requestReport}`);
  assert(requestReport.indexOf("reason source_empty") !== -1, "blocked report should include blocked reason");

  let cancelReport = global.ops.cancelRequests(room.name, "blocked", {
    resource: RESOURCE_POWER,
    from: "terminal",
    to: "powerSpawn",
    olderThan: 1000,
  });
  assertCleanOpsString(cancelReport, "ops.cancelRequests filtered");
  assert(cancelReport.indexOf("matched 5") !== -1, `filtered cancel should match five stale power requests, got ${cancelReport}`);
  assert(cancelReport.indexOf("canceled 1") !== -1, `filtered cancel should cancel one safe request, got ${cancelReport}`);
  assert(cancelReport.indexOf("skipped 4") !== -1, `filtered cancel should skip unsafe statuses/claims, got ${cancelReport}`);
  assert(cancelReport.indexOf("cancel_power_old") !== -1, "cancel report should include canceled id");
  assert(Memory.ops.logistics.requests.cancel_power_old.status === "canceled", "stale blocked unclaimed request should be canceled");
  assert(Memory.ops.logistics.requests.cancel_energy_open.status === "open", "open request must not be canceled");
  assert(Memory.ops.logistics.requests.cancel_power_claimed.status === "blocked", "claimed blocked request must not be canceled");
  assert(Memory.ops.logistics.requests.cancel_done.status === "done", "done request must not be canceled");
  assert(Memory.ops.logistics.requests.cancel_canceled.status === "canceled", "already canceled request should remain canceled");
  assert(Memory.ops.logistics.requests.cancel_expired.status === "expired", "expired request must not be canceled");
  assert(Memory.ops.logistics.requests.cancel_power_young.status === "blocked", "younger blocked request should not match olderThan filter");
  assert(Memory.ops.logistics.requests.cancel_h_old.status === "blocked", "resource/from/to filters should leave non-matching blocked request");

  cancelReport = global.ops.cancelRequests(room.name, "blocked", { resource: "H", from: "terminal", to: "storage", olderThan: 1000 });
  assertCleanOpsString(cancelReport, "ops.cancelRequests resource from to");
  assert(cancelReport.indexOf("canceled 1") !== -1, `resource/from/to filters should cancel matching H request, got ${cancelReport}`);
  assert(Memory.ops.logistics.requests.cancel_h_old.status === "canceled", "resource/from/to filtered blocked request should be canceled");

  cancelReport = global.ops.cancelRequests(room.name, "blocked", { resource: RESOURCE_POWER, from: "terminal", to: "powerSpawn", olderThan: 100 });
  assertCleanOpsString(cancelReport, "ops.cancelRequests olderThan");
  assert(cancelReport.indexOf("cancel_power_young") !== -1, "olderThan filter should allow younger request when threshold is lower");
  assert(Memory.ops.logistics.requests.cancel_power_young.status === "canceled", "olderThan filter should cancel matching stale-enough blocked request");

  room = buildOpsLogisticsRoom("VAL_OPS_LOGISTICS_FULL_TARGET", {
    tick: 1307,
    storageStore: { energy: 1000 },
    terminalStore: { energy: 300000 },
  });
  const fullResult = opsLogisticsManager.createMoveRequest(RESOURCE_ENERGY, 50, room.name, "storage", "terminal");
  assert(!fullResult.ok, "full target should prevent request creation");

  Memory.ops = {
    logistics: {
      requests: {
        blocked_full: {
          id: "blocked_full",
          type: "move",
          status: "open",
          roomName: room.name,
          resourceType: RESOURCE_ENERGY,
          amount: 50,
          remaining: 50,
          from: "storage",
          to: "terminal",
          sourceId: room.storage.id,
          targetId: room.terminal.id,
          priority: 50,
          createdAt: Game.time,
          updatedAt: Game.time,
          expiresAt: Game.time + 1000,
          claims: {},
        },
      },
    },
  };
  const fullHauler = createCreep("opsBlockedFull", "hauler", 25, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  assert(opsLogisticsManager.getHaulerTask(room, fullHauler) === null, "full target should prevent task assignment");
  assert(Memory.ops.logistics.requests.blocked_full.status === "blocked", "full target should mark request blocked");
  assert(Memory.ops.logistics.requests.blocked_full.reason === "target_full", "full target should record target_full reason");

  room = buildOpsLogisticsRoom("VAL_OPS_LOGISTICS_MISSING_ENDPOINT", {
    tick: 1308,
    storageStore: { energy: 1000 },
    terminalStore: { energy: 1000 },
  });
  const missingEndpointResult = opsLogisticsManager.createMoveRequest(RESOURCE_ENERGY, 50, room.name, "storage", "terminal");
  delete room.terminal;
  const missingEndpointHauler = createCreep("opsMissingEndpoint", "hauler", 25, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 50,
  });
  assert(opsLogisticsManager.getHaulerTask(room, missingEndpointHauler) === null, "missing endpoint should prevent task assignment");
  assert(missingEndpointResult.request.status === "blocked", "missing endpoint should mark request blocked");
  assert(missingEndpointResult.request.reason === "missing_endpoint", "missing endpoint should record reason");

  room = buildOpsLogisticsRoom("VAL_OPS_LOGISTICS_BALANCE", {
    tick: 1309,
    storageStore: { energy: 200000 },
    terminalStore: { energy: 10000, H: 120000 },
  });
  const balance = opsLogisticsManager.balanceTerminal(room.name);
  assert(balance.ok, `expected balanceTerminal ok, got ${balance.message}`);
  assert(
    balance.requests.some(function (entry) {
      return entry.request && entry.request.resourceType === RESOURCE_ENERGY && entry.request.from === "storage" && entry.request.to === "terminal";
    }),
    "balanceTerminal should create storage -> terminal energy request below target",
  );
  assert(
    balance.requests.some(function (entry) {
      return entry.request && entry.request.resourceType === "H" && entry.request.from === "terminal" && entry.request.to === "storage";
    }),
    "balanceTerminal should create terminal -> storage mineral excess request",
  );
  const duplicateBalance = opsLogisticsManager.balanceTerminal(room.name);
  assert(
    duplicateBalance.requests.length > 0 && duplicateBalance.requests.every(function (entry) { return entry.skipped; }),
    "balanceTerminal should skip duplicate open requests",
  );

  room = buildOpsLogisticsRoom("VAL_OPS_LOGISTICS_BALANCE_IMPOSSIBLE", {
    tick: 1310,
    storageStore: { energy: 0 },
    terminalStore: { energy: 30000 },
  });
  const impossibleBalance = opsLogisticsManager.balanceTerminal(room.name);
  assert(impossibleBalance.ok && impossibleBalance.requests.length === 0, "balanceTerminal should not create impossible requests");

  room = buildOpsLogisticsRoom("VAL_OPS_LOGISTICS_MARKET", {
    tick: 1311,
    storageStore: { energy: 200000, Z: 1000 },
    terminalStore: { energy: 10000, Z: 250 },
  });
  marketConsole.stage("Z", 500, room.name);
  let marketRows = opsLogisticsManager.listRequests(room.name);
  assert(
    marketRows.some(function (row) { return row.resourceType === "Z" && row.from === "storage" && row.to === "terminal"; }),
    "market.stage should create storage -> terminal ops logistics request",
  );
  marketConsole.unstage("Z", 100, room.name);
  marketRows = opsLogisticsManager.listRequests(room.name);
  assert(
    marketRows.some(function (row) { return row.resourceType === "Z" && row.from === "terminal" && row.to === "storage"; }),
    "market.unstage should create terminal -> storage ops logistics request",
  );
  const originalLog = console.log;
  const marketRequestLines = [];
  console.log = function (line) {
    marketRequestLines.push(line);
  };
  try {
    const marketRequestReport = marketConsole.requests(room.name);
    assert(typeof marketRequestReport === "string", "market.requests should return a printable string");
  } finally {
    console.log = originalLog;
  }
  assert(
    marketRequestLines.some(function (line) {
      return line.indexOf("storage -> terminal") >= 0 && line.indexOf("Z") >= 0;
    }),
    "market.requests should include ops logistics storage -> terminal request",
  );
  assert(
    marketRequestLines.some(function (line) {
      return line.indexOf("terminal -> storage") >= 0 && line.indexOf("Z") >= 0;
    }),
    "market.requests should include ops logistics terminal -> storage request",
  );
  const canceledMarketRow = marketRows.find(function (row) {
    return row.resourceType === "Z" && row.from === "storage" && row.to === "terminal";
  });
  assert(canceledMarketRow, "expected a market-compatible ops logistics row to cancel");
  marketConsole.cancel(canceledMarketRow.id);
  let marketRequestReport = marketConsole.requests(room.name);
  assert(
    marketRequestReport.indexOf(canceledMarketRow.id) === -1,
    "market.requests should hide canceled history by default",
  );
  marketRequestReport = marketConsole.requests(room.name, "all");
  assert(
    marketRequestReport.indexOf(canceledMarketRow.id) !== -1,
    "market.requests(roomName, all) should include canceled history",
  );
  marketRequestReport = marketConsole.requests("history");
  assert(
    marketRequestReport.indexOf(canceledMarketRow.id) !== -1,
    "market.requests(history) should include all room history",
  );
  assert(
    marketRequestReport.indexOf("canceled 1") !== -1,
    `market.requests should include status counts, got ${marketRequestReport}`,
  );

  const originalMarketHelpLog = console.log;
  const helpLines = [];
  console.log = function (line) {
    helpLines.push(String(line));
  };
  try {
    marketConsole.help();
  } finally {
    console.log = originalMarketHelpLog;
  }
  assert(
    helpLines.some(function (line) { return line.indexOf("market.stage(resource, amount, roomName)") !== -1; }) &&
      helpLines.some(function (line) { return line.indexOf("market.unstage(resource, amount, roomName)") !== -1; }) &&
      helpLines.some(function (line) { return line.indexOf("market.requests()") !== -1; }) &&
      helpLines.some(function (line) { return line.indexOf("market.requests(roomName)") !== -1; }) &&
      helpLines.some(function (line) { return line.indexOf('market.requests("all"|"history")') !== -1; }) &&
      helpLines.some(function (line) { return line.indexOf('market.requests(roomName, "all"|"history")') !== -1; }),
    `expected Layer 2 market request help, got ${helpLines.join(" / ")}`,
  );
}

function runAdvancedHaulBacklogReportingScenario() {
  let room = buildOpsLogisticsRoom("VAL_LOGISTICS_REPORT_HEALTHY", {
    tick: 1500,
    storageStore: { energy: 100000 },
    terminalStore: { energy: 10000 },
  });
  addOpsLogisticsHaulers(room, 2);
  ops.registerGlobals();

  let report = roomReporting.build(room, null, { updateProgress: false });
  assert(report.logistics.openRequests === 0, "healthy queue should count zero open requests");
  assert(report.logistics.blockedRequests === 0, "healthy queue should count zero blocked requests");
  assert(report.logistics.state === "clear", `healthy queue should be clear, got ${report.logistics.state}`);
  let captured = captureOpsLogisticsSection(room);
  assertLogisticsLine(captured.lines, "Open Requests 0 | Blocked Requests 0");
  assertLogisticsLine(captured.lines, "Haulers 2 / 2 | State clear");
  assertLogisticsLine(captured.lines, "Waiting: none");

  room = buildOpsLogisticsRoom("VAL_LOGISTICS_REPORT_BLOCKED", {
    tick: 1510,
    storageStore: { energy: 100000 },
    terminalStore: { energy: 10000 },
  });
  addOpsLogisticsHaulers(room, 2);
  seedOpsLogisticsRequest(room, {
    amount: 500,
    status: "blocked",
    reason: "target_full",
    createdAt: Game.time - 30,
    updatedAt: Game.time - 5,
  });
  ops.registerGlobals();
  report = roomReporting.build(room, null, { updateProgress: false });
  assert(report.logistics.openRequests === 0, `expected zero open blocked-state requests, got ${report.logistics.openRequests}`);
  assert(report.logistics.blockedRequests === 1, `expected one blocked request, got ${report.logistics.blockedRequests}`);
  assert(report.logistics.state === "blocked", `blocked queue should be blocked, got ${report.logistics.state}`);
  captured = captureOpsLogisticsSection(room);
  assertLogisticsLine(captured.lines, "Open Requests 0 | Blocked Requests 1");
  assertLogisticsLine(captured.lines, "State blocked");
  assertLogisticsLine(captured.lines, "blocked target_full");

  room = buildOpsLogisticsRoom("VAL_LOGISTICS_REPORT_UNCLAIMED", {
    tick: 1520,
    storageStore: { energy: 100000 },
    terminalStore: { energy: 10000 },
  });
  addOpsLogisticsHaulers(room, 2);
  const claimedHauler = createCreep("VAL_LOGISTICS_REPORT_UNCLAIMED_claim", "hauler", 24, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 200,
  });
  seedOpsLogisticsRequest(room, {
    amount: 500,
    remaining: 500,
    createdAt: Game.time - 80,
    updatedAt: Game.time - 10,
    claims: {
      [claimedHauler.name]: {
        amount: 200,
        until: Game.time + 10,
      },
    },
  });
  ops.registerGlobals();
  report = roomReporting.build(room, null, { updateProgress: false });
  assert(report.logistics.openRequests === 1, `expected one open request, got ${report.logistics.openRequests}`);
  assert(report.logistics.totalClaimed === 200, `expected claimed 200, got ${report.logistics.totalClaimed}`);
  assert(report.logistics.totalUnclaimed === 300, `expected unclaimed 300, got ${report.logistics.totalUnclaimed}`);
  assert(report.logistics.oldestUnclaimedAge === 80, `expected oldest unclaimed age 80, got ${report.logistics.oldestUnclaimedAge}`);
  assert(report.logistics.state === "unclaimed", `old unclaimed work should be signaled, got ${report.logistics.state}`);
  captured = captureOpsLogisticsSection(room);
  assertLogisticsLine(captured.lines, "Remaining 500 | Claimed 200 | Unclaimed 300");
  assertLogisticsLine(captured.lines, "Oldest Open 80 ticks | Oldest Unclaimed 80 ticks");
  assertLogisticsLine(captured.lines, "State unclaimed");

  room = buildOpsLogisticsRoom("VAL_LOGISTICS_REPORT_ADVANCED", {
    tick: 1530,
    storageStore: { energy: 100000 },
    terminalStore: { energy: 10000 },
  });
  addOpsLogisticsHaulers(room, 2);
  if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
  Memory.rooms[room.name].advancedOps = {
    summary: {
      labStatus: "inactive",
      factoryStatus: "ready",
      powerSpawnStatus: "inactive",
      nukerStatus: "inactive",
      taskLabel: "factory_input",
      taskBacklog: [
        { label: "factory_input", resourceType: "H", amount: 300 },
        { label: "lab_input", resourceType: "O", amount: 200 },
      ],
    },
  };
  ops.registerGlobals();
  report = roomReporting.build(room, null, { updateProgress: false });
  assert(
    report.logistics.advancedBacklog.labels.indexOf("factory_input") !== -1 &&
      report.logistics.advancedBacklog.labels.indexOf("lab_input") !== -1,
    `expected advanced backlog labels, got ${JSON.stringify(report.logistics.advancedBacklog)}`,
  );
  captured = captureOpsLogisticsSection(room);
  assertLogisticsLine(captured.lines, "Advanced Backlog factory_input, lab_input");

  room = buildOpsLogisticsRoom("VAL_LOGISTICS_REPORT_HAULER_SHORT", {
    tick: 1540,
    storageStore: { energy: 100000 },
    terminalStore: { energy: 10000 },
  });
  seedOpsLogisticsRequest(room, {
    amount: 500,
    remaining: 500,
    createdAt: Game.time - 5,
    updatedAt: Game.time - 5,
  });
  ops.registerGlobals();
  report = roomReporting.build(room, null, { updateProgress: false });
  assert(report.logistics.haulers.current === 0, `expected zero haulers, got ${report.logistics.haulers.current}`);
  assert(report.logistics.haulers.desired === 2, `expected desired haulers 2, got ${report.logistics.haulers.desired}`);
  assert(report.logistics.state === "hauler_short", `visible demand without haulers should be hauler_short, got ${report.logistics.state}`);
  captured = captureOpsLogisticsSection(room);
  assertLogisticsLine(captured.lines, "Haulers 0 / 2 | State hauler_short");
  assertLogisticsLine(captured.lines, "Waiting: Storage -> Terminal energy (500)");
}

function runLogisticsStarvationHistoryScenario() {
  const room = buildOpsLogisticsRoom("VAL_LOGISTICS_HISTORY", {
    tick: 1600,
    storageStore: { energy: 100000 },
    terminalStore: { energy: 10000 },
  });
  addOpsLogisticsHaulers(room, 2);
  const claimedHauler = createCreep("VAL_LOGISTICS_HISTORY_claim", "hauler", 24, 27, {
    roomName: room.name,
    store: {},
    storeCapacity: 200,
  });
  const request = seedOpsLogisticsRequest(room, {
    amount: 900,
    remaining: 900,
    createdAt: Game.time - 10,
    updatedAt: Game.time - 5,
  });
  const originalRequestId = request.id;
  ops.registerGlobals();

  function sample(tick, settings) {
    Game.time = tick;
    request.status = settings.status || "open";
    request.remaining = typeof settings.remaining === "number" ? settings.remaining : 900;
    request.createdAt = tick - (settings.age || 0);
    request.updatedAt = tick;
    request.reason = settings.reason || null;
    request.claims = settings.claimed
      ? {
          [claimedHauler.name]: {
            amount: settings.claimed,
            until: tick + 10,
          },
        }
      : {};

    if (settings.haulers === 0) {
      delete Game.creeps[`${room.name}_logistics_hauler_0`];
      delete Game.creeps[`${room.name}_logistics_hauler_1`];
    } else {
      if (!Game.creeps[`${room.name}_logistics_hauler_0`]) {
        addOpsLogisticsHaulers(room, 2);
      }
    }

    return roomReporting.build(room, null, { updateProgress: false });
  }

  sample(1600, { remaining: 0, age: 0 });
  sample(1650, { age: 10 });
  sample(1700, { age: 120 });
  sample(1750, { status: "blocked", age: 20, reason: "target_full" });
  Memory.ops.logistics.history[room.name].push({
    t: 1775,
    roomName: room.name,
    state: "blocked",
    open: 1,
    blocked: 1,
    unclaimed: 900,
    claimed: 0,
    remaining: 900,
    oldestOpenAge: 20,
    oldestUnclaimedAge: 20,
    haulers: 2,
    desiredHaulers: 2,
    rawRequest: request,
    rawCreep: claimedHauler,
    rawRoom: room,
  });
  sample(1800, { age: 80, claimed: 200 });
  sample(1850, { haulers: 0, age: 5 });
  sample(1900, { haulers: 0, age: 10 });
  sample(1950, { haulers: 0, age: 15 });
  sample(2000, { haulers: 0, age: 20 });
  const report = sample(2050, { haulers: 0, age: 25 });

  const history = Memory.ops.logistics.history[room.name];
  assert(Array.isArray(history), "expected logistics history array");
  assert(
    history.length === opsLogisticsManager.getHistoryLimit(),
    `expected bounded history length ${opsLogisticsManager.getHistoryLimit()}, got ${history.length}`,
  );
  assertCompactLogisticsHistory(history, "logistics history");
  assert(report.logistics.history.trend === "persistent", `expected persistent trend, got ${report.logistics.history.trend}`);
  assert(report.logistics.history.starvationSamples >= 5, `expected repeated starvation samples, got ${report.logistics.history.starvationSamples}`);
  assert(report.logistics.history.blockedSamples >= 1, `expected blocked sample count, got ${report.logistics.history.blockedSamples}`);
  assert(report.logistics.history.unclaimedAgingSamples >= 1, `expected unclaimed aging sample count, got ${report.logistics.history.unclaimedAgingSamples}`);
  assert(report.logistics.history.haulerShortSamples >= 3, `expected hauler-short samples, got ${report.logistics.history.haulerShortSamples}`);
  assert(report.logistics.history.worstState === "hauler_short", `expected hauler_short worst state, got ${report.logistics.history.worstState}`);
  assert(report.logistics.history.recent.length === 3, `expected three recent samples, got ${report.logistics.history.recent.length}`);

  const captured = captureOpsLogisticsSection(room);
  assertLogisticsLine(captured.lines, "Trend persistent");
  assertLogisticsLine(captured.lines, "Blocked Samples");
  assertLogisticsLine(captured.lines, "Unclaimed Aging Samples");
  assertLogisticsLine(captured.lines, "Hauler Short Samples");
  assertLogisticsLine(captured.lines, "Worst Recent State hauler_short");
  assertLogisticsLine(captured.lines, "Recent 2050: hauler_short");
  assert(
    captured.lines.every(function (line) {
      return line.indexOf("[object Object]") === -1 && line.indexOf("{") === -1;
    }),
    `expected no raw object dumps in logistics output, got ${captured.lines.join(" / ")}`,
  );

  assert(Object.keys(Memory.ops.logistics.requests).length === 1, "reporting should not create logistics requests");
  assert(Memory.ops.logistics.requests[originalRequestId].status === "open", "reporting should not complete or cancel logistics requests");
  assert(
    !Memory.rooms[room.name].spawnQueue || Memory.rooms[room.name].spawnQueue.length === 0,
    "reporting should not create spawn requests",
  );
  assert(
    !claimedHauler.memory.opsLogisticsTask && !claimedHauler.memory.advancedTask && !claimedHauler.memory.marketTask,
    "reporting should not assign hauler tasks or change logistics priority",
  );
}

function runEmpireLogisticsPressureRollupScenario() {
  resetRuntime(2100);
  Memory.ops = { logistics: { requests: {}, history: {} } };

  const persistentRoom = addOwnedMarketIntelRoom("VAL_EMPIRE_LOG_A", {
    storageStore: { energy: 200000, H: 1000, O: 1000, Z: 1000, K: 1000, L: 1000 },
    terminalStore: { energy: 10000 },
  });
  const recurringRoom = addOwnedMarketIntelRoom("VAL_EMPIRE_LOG_B", {
    storageStore: { energy: 200000 },
    terminalStore: { energy: 10000 },
  });
  const blockedRoom = addOwnedMarketIntelRoom("VAL_EMPIRE_LOG_C", {
    storageStore: { energy: 200000 },
    terminalStore: { energy: 10000 },
  });
  const tieRoom = addOwnedMarketIntelRoom("VAL_EMPIRE_LOG_AA", {
    storageStore: { energy: 200000 },
    terminalStore: { energy: 10000 },
  });
  const clearRoom = addOwnedMarketIntelRoom("VAL_EMPIRE_LOG_D", {
    storageStore: { energy: 200000 },
    terminalStore: { energy: 10000 },
  });

  addOpsLogisticsHaulers(recurringRoom, 1);
  addOpsLogisticsHaulers(tieRoom, 1);
  addOpsLogisticsHaulers(blockedRoom, 1);
  addOpsLogisticsHaulers(clearRoom, 1);

  const resources = [RESOURCE_ENERGY, "H", "O", "Z", "K", "L"];
  for (let i = 0; i < resources.length; i++) {
    seedOpsLogisticsRequest(persistentRoom, {
      resourceType: resources[i],
      amount: 500,
      remaining: 500,
      createdAt: Game.time - 20 - i,
      updatedAt: Game.time - 5,
    });
  }
  Memory.ops.logistics.history[persistentRoom.name] = [
    {
      t: Game.time - 2,
      roomName: persistentRoom.name,
      state: "hauler_short",
      open: 3,
      blocked: 0,
      unclaimed: 1500,
      claimed: 0,
      remaining: 1500,
      oldestOpenAge: 20,
      oldestUnclaimedAge: 20,
      haulers: 0,
      desiredHaulers: 1,
    },
    {
      t: Game.time - 1,
      roomName: persistentRoom.name,
      state: "hauler_short",
      open: 4,
      blocked: 0,
      unclaimed: 2000,
      claimed: 0,
      remaining: 2000,
      oldestOpenAge: 21,
      oldestUnclaimedAge: 21,
      haulers: 0,
      desiredHaulers: 1,
    },
  ];

  const recurringHauler = Game.creeps[`${recurringRoom.name}_logistics_hauler_0`];
  seedOpsLogisticsRequest(recurringRoom, {
    amount: 600,
    remaining: 600,
    createdAt: Game.time - 120,
    updatedAt: Game.time - 5,
    claims: {
      [recurringHauler.name]: {
        amount: 600,
        until: Game.time + 10,
      },
    },
  });
  Memory.ops.logistics.history[recurringRoom.name] = [
    {
      t: Game.time - 3,
      roomName: recurringRoom.name,
      state: "aging",
      open: 1,
      blocked: 0,
      unclaimed: 0,
      claimed: 600,
      remaining: 600,
      oldestOpenAge: 120,
      oldestUnclaimedAge: 0,
      haulers: 1,
      desiredHaulers: 1,
    },
    {
      t: Game.time - 2,
      roomName: recurringRoom.name,
      state: "clear",
      open: 0,
      blocked: 0,
      unclaimed: 0,
      claimed: 0,
      remaining: 0,
      oldestOpenAge: 0,
      oldestUnclaimedAge: 0,
      haulers: 1,
      desiredHaulers: 1,
    },
  ];

  const blockedRequest = seedOpsLogisticsRequest(blockedRoom, {
    amount: 700,
    remaining: 700,
    status: "blocked",
    reason: "target_full",
    createdAt: Game.time - 20,
    updatedAt: Game.time - 5,
  });
  seedOpsLogisticsRequest(tieRoom, {
    amount: 700,
    remaining: 700,
    status: "blocked",
    reason: "target_full",
    createdAt: Game.time - 20,
    updatedAt: Game.time - 5,
  });
  Memory.ops.logistics.history[clearRoom.name] = [
    {
      t: Game.time - 1,
      roomName: clearRoom.name,
      state: "unclaimed",
      open: 1,
      blocked: 0,
      unclaimed: 700,
      claimed: 0,
      remaining: 700,
      oldestOpenAge: 80,
      oldestUnclaimedAge: 80,
      haulers: 1,
      desiredHaulers: 1,
    },
  ];

  ops.registerGlobals();
  const beforeRequestCount = opsLogisticsManager.listRequests().length;
  const beforeSpawnEvents = currentRuntime.spawnEvents.length;
  const beforeTerminalSends = currentRuntime.terminalSends.length;
  const deals = installFakeMarket([]);

  const captured = captureConsoleLines(function () {
    return global.ops.empire("logistics");
  });
  const result = captured.result;
  const lines = captured.lines;

  assert(result && result.section === "logistics", "ops.empire(logistics) should return logistics section result");
  assert(result.rollup.roomsEvaluated === 5, `expected five rooms evaluated, got ${result.rollup.roomsEvaluated}`);
  assert(result.rollup.pressuredRooms === 4, `expected four currently pressured rooms, got ${result.rollup.pressuredRooms}`);
  assert(result.rollup.recurringRooms === 1, `expected one recurring room, got ${result.rollup.recurringRooms}`);
  assert(result.rollup.persistentRooms === 1, `expected one persistent room, got ${result.rollup.persistentRooms}`);
  assert(result.rollup.blockedSampleRooms === 2, `expected two blocked sample rooms, got ${result.rollup.blockedSampleRooms}`);
  assert(result.rollup.unclaimedAgingSampleRooms === 1, `expected one unclaimed aging room, got ${result.rollup.unclaimedAgingSampleRooms}`);
  assert(result.rollup.haulerShortSampleRooms === 1, `expected one hauler short room, got ${result.rollup.haulerShortSampleRooms}`);
  assert(result.rollup.topRows[0].roomName === persistentRoom.name, `expected persistent room first, got ${result.rollup.topRows[0].roomName}`);
  assert(result.rollup.topRows[1].roomName === recurringRoom.name, `expected recurring room second, got ${result.rollup.topRows[1].roomName}`);
  assert(result.rollup.topRows[2].roomName === tieRoom.name, `expected alphabetic tie room third, got ${result.rollup.topRows[2].roomName}`);
  assert(result.rollup.topRows[3].roomName === blockedRoom.name, `expected blocked room fourth, got ${result.rollup.topRows[3].roomName}`);

  assert(lines.some(function (line) { return line === "Empire Logistics Pressure"; }), `expected rollup title, got ${lines.join(" / ")}`);
  assert(lines.some(function (line) { return line === "Rooms Evaluated: 5"; }), `expected room count, got ${lines.join(" / ")}`);
  assert(lines.some(function (line) { return line === "Pressured Rooms: 4"; }), `expected pressure count, got ${lines.join(" / ")}`);
  assert(lines.some(function (line) { return line === "Recurring: 1"; }), `expected recurring count, got ${lines.join(" / ")}`);
  assert(lines.some(function (line) { return line === "Persistent: 1"; }), `expected persistent count, got ${lines.join(" / ")}`);
  assert(lines.some(function (line) { return line === "Blocked Samples: 2"; }), `expected blocked sample count, got ${lines.join(" / ")}`);
  assert(lines.some(function (line) { return line === "Unclaimed Aging Samples: 1"; }), `expected unclaimed aging sample count, got ${lines.join(" / ")}`);
  assert(lines.some(function (line) { return line === "Hauler Short Samples: 1"; }), `expected hauler short sample count, got ${lines.join(" / ")}`);
  assert(
    lines.some(function (line) {
      return line.indexOf(`${persistentRoom.name}: persistent, state hauler_short`) !== -1 &&
        line.indexOf("open 6") !== -1 &&
        line.indexOf("haulers 0 / 1") !== -1;
    }),
    `expected top persistent room summary, got ${lines.join(" / ")}`,
  );
  assert(
    lines.some(function (line) {
      return line.indexOf(`${recurringRoom.name}: recurring, state aging`) !== -1 &&
        line.indexOf("open 1") !== -1 &&
        line.indexOf("haulers 1 / 1") !== -1;
    }),
    `expected recurring room summary, got ${lines.join(" / ")}`,
  );
  assert(
    lines.some(function (line) {
      return line.indexOf(`ops.room("${persistentRoom.name}", "logistics")`) !== -1;
    }),
    `expected inspect guidance, got ${lines.join(" / ")}`,
  );
  assert(
    lines.every(function (line) {
      return line.indexOf("[object Object]") === -1 && line.indexOf("{") === -1;
    }),
    `expected printable logistics rollup, got ${lines.join(" / ")}`,
  );

  const roomCaptured = captureConsoleLines(function () {
    return global.ops.room(persistentRoom.name, "logistics");
  });
  assert(
    roomCaptured.result === `[OPS][${persistentRoom.name}][LOGISTICS] report generated`,
    `room-level logistics reporting should still return printable status, got ${roomCaptured.result}`,
  );
  assert(
    roomCaptured.lines.some(function (line) { return line.indexOf("Open Requests 6") !== -1; }),
    `room-level logistics report should still show open requests, got ${roomCaptured.lines.join(" / ")}`,
  );

  assert(opsLogisticsManager.listRequests().length === beforeRequestCount, "empire logistics rollup should not create logistics requests");
  assert(blockedRequest.status === "blocked", "empire logistics rollup should not cancel blocked requests");
  assert(currentRuntime.spawnEvents.length === beforeSpawnEvents, "empire logistics rollup should not spawn creeps");
  assert(currentRuntime.terminalSends.length === beforeTerminalSends, "empire logistics rollup should not send terminal resources");
  assert(deals.length === 0, "empire logistics rollup should not execute market deals");
  assert(
    Object.keys(Game.creeps).every(function (creepName) {
      const memory = Game.creeps[creepName].memory || {};
      return !memory.opsLogisticsTask && !memory.advancedTask && !memory.marketTask;
    }),
    "empire logistics rollup should not assign hauler tasks or change priorities",
  );
}

function runTerminalBalanceManagerScenario() {
  let room = buildOpsLogisticsRoom("VAL_TERMINAL_BALANCE", {
    tick: 1320,
    storageStore: {
      energy: 160000,
      H: 12000,
      power: 900,
      G: 9000,
    },
    terminalStore: {
      energy: 10000,
      H: 1000,
      power: 100,
      G: 1000,
      O: 8000,
    },
  });
  const sendsBefore = currentRuntime.terminalSends.length;
  const deals = installFakeMarket([]);
  const result = terminalBalanceManager.evaluate(room);
  assert(result.ok, `expected terminal balance ok, got ${result.message}`);
  assert(result.summary.state === "balancing", `expected balancing state, got ${result.summary.state}`);
  assert(result.summary.terminalEnergy === 10000, `expected terminal energy in summary, got ${result.summary.terminalEnergy}`);
  assert(
    result.requests.some(function (entry) {
      return entry.request &&
        entry.request.resourceType === RESOURCE_ENERGY &&
        entry.request.from === "storage" &&
        entry.request.to === "terminal";
    }),
    "terminal balance should stage energy from storage",
  );
  assert(
    result.requests.some(function (entry) {
      return entry.request &&
        entry.request.resourceType === "H" &&
        entry.request.from === "storage" &&
        entry.request.to === "terminal";
    }),
    "terminal balance should stage minerals already present in storage",
  );
  assert(
    result.requests.some(function (entry) {
      return entry.request &&
        entry.request.resourceType === RESOURCE_POWER &&
        entry.request.from === "storage" &&
        entry.request.to === "terminal";
    }),
    "terminal balance should stage power already present in storage",
  );
  assert(
    result.requests.some(function (entry) {
      return entry.request &&
        entry.request.resourceType === RESOURCE_GHODIUM &&
        entry.request.from === "storage" &&
        entry.request.to === "terminal";
    }),
    "terminal balance should stage ghodium already present in storage",
  );
  assert(
    result.requests.some(function (entry) {
      return entry.request &&
        entry.request.resourceType === "O" &&
        entry.request.from === "terminal" &&
        entry.request.to === "storage";
    }),
    "terminal balance should return terminal mineral excess to storage",
  );
  assert(
    currentRuntime.terminalSends.length === sendsBefore,
    "terminal balance must not send resources between rooms",
  );
  assert(deals.length === 0 && deals.createdOrders.length === 0, "terminal balance must not use market automation");

  const duplicate = terminalBalanceManager.evaluate(room);
  assert(
    duplicate.requests.length > 0 &&
      duplicate.requests.every(function (entry) { return entry.skipped; }),
    "terminal balance should skip duplicate open logistics requests",
  );

  const report = roomReporting.build(room, roomState.collect(room, null, null), {
    updateProgress: false,
  });
  const resourceLines = roomReporting.getSectionLines(report, "resources");
  assert(
    resourceLines.some(function (line) { return line.indexOf("Terminal Energy 10,000/50,000") !== -1; }),
    `resources report should expose terminal energy, got ${resourceLines.join(" / ")}`,
  );
  assert(
    resourceLines.some(function (line) { return line.indexOf("Terminal Power 100/500") !== -1; }),
    `resources report should expose terminal power, got ${resourceLines.join(" / ")}`,
  );
  assert(
    resourceLines.some(function (line) { return line.indexOf("Balance State balancing") !== -1; }),
    `resources report should expose balance state, got ${resourceLines.join(" / ")}`,
  );

  const previousTerminalBalance = Object.assign({}, config.TERMINAL_BALANCE || {});
  config.TERMINAL_BALANCE = Object.assign({}, config.TERMINAL_BALANCE || {}, {
    MIN_STORAGE_ENERGY: 50000,
  });
  try {
    room = buildOpsLogisticsRoom("VAL_TERMINAL_BALANCE_STORAGE_RESERVE", {
      tick: 1321,
      storageStore: { energy: 50000 },
      terminalStore: { energy: 10000 },
    });
    const reserveResult = terminalBalanceManager.evaluate(room);
    assert(
      reserveResult.requests.length === 0,
      "terminal balance should not drain storage below reserve for energy staging",
    );
  } finally {
    config.TERMINAL_BALANCE = previousTerminalBalance;
  }

  room = buildOpsLogisticsRoom("VAL_TERMINAL_BALANCE_NO_DEMAND", {
    tick: 1322,
    storageStore: { energy: 200000, Z: 5000 },
    terminalStore: { energy: 50000 },
  });
  const noDemandResult = terminalBalanceManager.evaluate(room);
  assert(
    !noDemandResult.requests.some(function (entry) {
      return entry.request && entry.request.resourceType === "O";
    }),
    "terminal balance should not create demand for minerals absent from storage",
  );
}

function runOperatorReportCleanupScenario() {
  let room = buildOpsLogisticsRoom("VAL_OPERATOR_REPORTS", {
    tick: 1340,
    storageStore: { energy: 200000, H: 10000, Z: 1000 },
    terminalStore: { energy: 10000, H: 5000, Z: 250 },
  });
  installFakeMarket([
    {
      id: "buy_H_small",
      type: ORDER_BUY,
      resourceType: "H",
      amount: 58,
      price: 0.25,
      roomName: "W42N9",
    },
    {
      id: "sell_H_small",
      type: ORDER_SELL,
      resourceType: "H",
      amount: 75,
      price: 0.35,
      roomName: "W42N9",
    },
  ]);

  let report = marketConsole.stock();
  assert(typeof report === "string" && report.indexOf("[MARKET] Empire stock") !== -1, "market.stock should return a report string");
  report = marketConsole.stock(room.name);
  assert(typeof report === "string" && report.indexOf(`Stock for ${room.name}`) !== -1, "market.stock(room) should return a report string");
  report = marketConsole.needs();
  assert(typeof report === "string" && report.indexOf("[MARKET] Empire needs") !== -1, "market.needs should return a report string");
  report = marketConsole.surplus();
  assert(typeof report === "string" && report.indexOf("[MARKET] Empire surplus") !== -1, "market.surplus should return a report string");
  report = marketConsole.buyOptions("H");
  assert(typeof report === "string" && report.indexOf("Buy options for H") !== -1, "market.buyOptions(resource) should return a report string");

  report = marketConsole.sellOptions("H");
  assert(typeof report === "string", "market.sellOptions(resource) should return a report string");
  assert(report.indexOf("ready") !== -1, `sellOptions should show ready options, got ${report}`);
  assert(report.indexOf("maxNow") !== -1, `sellOptions should show maxNow, got ${report}`);
  assert(report.indexOf("terminal amount") !== -1, `sellOptions should show terminal amount, got ${report}`);
  assert(report.indexOf("sample energy need") !== -1, `sellOptions should show sample energy need, got ${report}`);

  room.terminal.cooldown = 5;
  report = marketConsole.sellOptions("H");
  assert(report.indexOf("blocked") !== -1, `sellOptions should show cooldown-blocked options, got ${report}`);
  assert(report.indexOf("cooldown 5") !== -1, `sellOptions should show cooldown reason, got ${report}`);
  room.terminal.cooldown = 0;

  let deals = installFakeMarket([
    {
      id: "buy_H_58",
      type: ORDER_BUY,
      resourceType: "H",
      amount: 58,
      price: 0.25,
      roomName: "W42N9",
    },
  ]);
  report = marketConsole.sell("H", 2580, room.name);
  assert(deals.length === 1 && deals[0].amount === 58, `expected sell deal amount 58, got ${JSON.stringify(deals)}`);
  assert(report.indexOf("requested 2,580") !== -1, `sell report should include requested amount, got ${report}`);
  assert(report.indexOf("sold 58") !== -1, `sell report should include actual sold amount, got ${report}`);
  assert(report.indexOf("limited by order amount") !== -1, `sell report should include limit reason, got ${report}`);

  room = buildOpsLogisticsRoom("VAL_OPERATOR_REPORTS_BUY", {
    tick: 1341,
    storageStore: { energy: 200000 },
    terminalStore: { energy: 10000 },
  });
  deals = installFakeMarket([
    {
      id: "sell_Z_75",
      type: ORDER_SELL,
      resourceType: "Z",
      amount: 75,
      price: 0.35,
      roomName: "W42N9",
    },
  ]);
  report = marketConsole.buy("Z", 1000, room.name);
  assert(deals.length === 1 && deals[0].amount === 75, `expected buy deal amount 75, got ${JSON.stringify(deals)}`);
  assert(report.indexOf("requested 1,000") !== -1, `buy report should include requested amount, got ${report}`);
  assert(report.indexOf("bought 75") !== -1, `buy report should include actual bought amount, got ${report}`);
  assert(report.indexOf("limited by order amount") !== -1, `buy report should include limit reason, got ${report}`);
}

function addOwnedMarketIntelRoom(name, options) {
  const settings = options || {};
  const room = new FakeRoom(name, new FakeTerrain());
  room.setController(
    createController(20, 20, {
      roomName: name,
      level: 8,
      my: true,
      owner: { username: "tester" },
    }),
  );
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  room.addStructure(
    createStructure(STRUCTURE_SPAWN, 25, 25, {
      roomName: name,
      name: `${name}_spawn`,
      store: { energy: 300 },
      storeCapacityResource: { energy: 300 },
    }),
  );
  room.addSource(createSource(15, 25, { roomName: name }));
  room.addMineral(createMineral(40, 10, { roomName: name }));

  if (settings.storage !== false) {
    room.addStructure(
      createStructure(STRUCTURE_STORAGE, 24, 27, {
        roomName: name,
        store: settings.storageStore || { energy: 200000, H: 5000 },
        storeCapacity: 1000000,
      }),
    );
  }

  if (settings.terminal !== false) {
    room.addStructure(
      createStructure(STRUCTURE_TERMINAL, 25, 32, {
        roomName: name,
        store: settings.terminalStore || { energy: 10000 },
        storeCapacity: 300000,
        cooldown: settings.cooldown || 0,
      }),
    );
  }

  return room;
}

function runMarketIntelligenceReportsScenario() {
  const readyRoom = buildOpsLogisticsRoom("VAL_MARKET_INTEL_READY", {
    tick: 1350,
    storageStore: { energy: 250000, H: 10000 },
    terminalStore: { energy: 12000, H: 5000 },
  });
  const lowEnergyRoom = addOwnedMarketIntelRoom("VAL_MARKET_INTEL_LOW", {
    terminalStore: { energy: 0, H: 2000 },
  });
  const fullRoom = addOwnedMarketIntelRoom("VAL_MARKET_INTEL_FULL", {
    terminalStore: { energy: 1000, H: 299000 },
  });
  const noTerminalRoom = addOwnedMarketIntelRoom("VAL_MARKET_INTEL_NONE", {
    terminal: false,
  });
  const noStorageRoom = addOwnedMarketIntelRoom("VAL_MARKET_INTEL_NOSTORE", {
    storage: false,
    terminalStore: { energy: 10000, H: 2000 },
  });

  Memory.ops = { logistics: { requests: {} } };
  Memory.market = { requests: {} };

  const deals = installFakeMarket([
    {
      id: "buy_H_intel",
      type: ORDER_BUY,
      resourceType: "H",
      amount: 5000,
      price: 0.71,
      roomName: "W42N9",
    },
  ]);
  const memoryBefore = JSON.stringify(Memory);
  const requestCountBefore = opsLogisticsManager.listRequests().length;

  let captured = captureConsoleLines(function () {
    return marketConsole.help();
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("market.readiness()") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.opportunities(resource)") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.recommendations()") !== -1; }),
    `market.help should include Layer 3 intelligence commands, got ${captured.lines.join(" / ")}`,
  );

  let report = marketConsole.readiness();
  assert(typeof report === "string", "market.readiness should return a printable string");
  assert(report.indexOf(`${readyRoom.name} | READY`) !== -1, `readiness should include READY room, got ${report}`);
  assert(report.indexOf(`${lowEnergyRoom.name} | LOW_ENERGY`) !== -1, `readiness should include LOW_ENERGY room, got ${report}`);
  assert(report.indexOf(`${fullRoom.name} | FULL`) !== -1, `readiness should include FULL room, got ${report}`);
  assert(report.indexOf(`${noTerminalRoom.name} | NO_TERMINAL`) !== -1, `readiness should include NO_TERMINAL room, got ${report}`);
  assert(report.indexOf(`${noStorageRoom.name} | NO_STORAGE`) !== -1, `readiness should include NO_STORAGE room, got ${report}`);

  report = marketConsole.readiness(lowEnergyRoom.name);
  assert(report.indexOf(`ops.fillTerminal("${lowEnergyRoom.name}", "energy", 10000)`) !== -1, `blocked room readiness should suggest terminal energy fill, got ${report}`);

  report = marketConsole.readiness(fullRoom.name);
  assert(report.indexOf(`ops.clearTerminal("${fullRoom.name}")`) !== -1, `full room readiness should suggest terminal clear, got ${report}`);

  report = marketConsole.readiness("H");
  assert(report.indexOf("[MARKET] H readiness") !== -1, `resource readiness should be resource-specific, got ${report}`);
  assert(report.indexOf(`${readyRoom.name} | READY`) !== -1, `resource readiness should include ready room, got ${report}`);
  assert(report.indexOf(`${lowEnergyRoom.name} | LOW_ENERGY`) !== -1, `resource readiness should include blocked room, got ${report}`);

  report = marketConsole.opportunities("H");
  assert(report.indexOf("[MARKET] H opportunities") !== -1, `resource opportunities should have heading, got ${report}`);
  assert(report.indexOf("ready") !== -1, `resource opportunities should include ready data, got ${report}`);
  assert(report.indexOf("blocked") !== -1, `resource opportunities should include blocked data, got ${report}`);
  assert(report.indexOf("maxNow") !== -1, `resource opportunities should include maxNow, got ${report}`);
  assert(report.indexOf("effective") !== -1, `resource opportunities should include effective price, got ${report}`);

  report = marketConsole.opportunities();
  assert(typeof report === "string", "market.opportunities should return a printable string");
  assert(report.split("\n").length <= 10, `market.opportunities default output should be bounded, got ${report}`);
  assert(report.indexOf("[MARKET] Opportunities") !== -1, `market.opportunities should include heading, got ${report}`);

  report = marketConsole.recommendations();
  assert(report.indexOf("[MARKET] Recommendations") !== -1, `recommendations should include heading, got ${report}`);
  assert(report.indexOf("SELL_READY") !== -1, `recommendations should include conservative sell review, got ${report}`);
  assert(report.indexOf("FILL_ENERGY") !== -1, `recommendations should include energy fill command, got ${report}`);
  assert(report.indexOf("CLEAR_TERMINAL") !== -1, `recommendations should include terminal clear command, got ${report}`);
  assert(report.indexOf("market.sellOptions(\"H\")") !== -1, `recommendations should prefer sellOptions before selling, got ${report}`);

  assert(deals.length === 0, `intelligence reports must not execute Game.market.deal, got ${JSON.stringify(deals)}`);
  assert(deals.createdOrders.length === 0, `intelligence reports must not create market orders, got ${JSON.stringify(deals.createdOrders)}`);
  assert(deals.changedOrders.length === 0, `intelligence reports must not manipulate order prices, got ${JSON.stringify(deals.changedOrders)}`);
  assert(
    opsLogisticsManager.listRequests().length === requestCountBefore,
    "intelligence reports must not create ops logistics requests",
  );
  assert(JSON.stringify(Memory) === memoryBefore, "intelligence reports should not mutate Memory");
}

function getMarketPlanIdFromReport(report) {
  const match = String(report).match(/\[MARKET\] (?:Sell|Buy) plan ([^:]+):/);
  assert(match && match[1], `expected market plan id in report, got ${report}`);
  return match[1];
}

function assertLayer3CompletionHelpSurface() {
  const captured = captureConsoleLines(function () {
    return marketConsole.help();
  });
  const requiredHelpLines = [
    "market.stock()",
    "market.needs()",
    "market.surplus()",
    "market.stage(resource, amount, roomName)",
    "market.unstage(resource, amount, roomName)",
    "market.requests()",
    "market.cancel(requestId)",
    "market.readiness()",
    "market.opportunities()",
    "market.recommendations()",
    "market.planSell(resource, amount, roomName)",
    "market.planBuy(resource, amount, roomName)",
    "market.plans()",
    "market.plan(planId)",
    "market.planSummary()",
    "market.planReview(planId)",
    "market.planAudit()",
    "market.executionStatus()",
    "market.executionDryRun(planId)",
    "market.executionLimits()",
    "market.executePlan(planId)",
    "market.history()",
    "market.historySummary()",
    "market.historyAudit()",
    "market.clearHistory(mode)",
    "market.historyLimit()",
    "market.clearPlan(planId)",
    'market.clearPlan("all")',
    "market.deletePlan(planId) [deprecated",
    "market.removePlan(planId) [deprecated",
    "market.clearPlans() [deprecated",
  ];
  const missing = requiredHelpLines.filter(function (expected) {
    return !captured.lines.some(function (line) {
      return line.indexOf(expected) !== -1;
    });
  });
  assert(missing.length === 0, `market.help is missing Layer 3 completion commands: ${missing.join(", ")}`);
}

function runMarketDryRunPlanningScenario() {
  Memory.consoleTools = { market: { plans: {} } };
  Memory.ops = { logistics: { requests: {} } };

  const sellRoom = buildOpsLogisticsRoom("VAL_MARKET_PLAN_SELL", {
    tick: 1360,
    storageStore: { energy: 250000, H: 10000 },
    terminalStore: { energy: 12000, H: 5000 },
  });
  const fakeMarketTrackers = [];
  const installPlanMarket = function (orders, options) {
    const tracker = installFakeMarket(orders, options);
    fakeMarketTrackers.push(tracker);
    return tracker;
  };
  const readyOrders = [
    {
      id: "buy_H_plan",
      type: ORDER_BUY,
      resourceType: "H",
      amount: 3000,
      price: 0.71,
      roomName: "W42N9",
    },
    {
      id: "sell_Z_plan",
      type: ORDER_SELL,
      resourceType: "Z",
      amount: 4000,
      price: 0.35,
      roomName: "W42N9",
    },
  ];
  installPlanMarket(readyOrders);
  const requestCountBefore = opsLogisticsManager.listRequests().length;

  assertLayer3CompletionHelpSurface();

  let captured = captureConsoleLines(function () {
    return marketConsole.help();
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("market.planSell(resource, amount, roomName)") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.planBuy(resource, amount, roomName)") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.plans()") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.planSummary()") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.planReview(planId)") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.planAudit()") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.executionStatus()") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.executionDryRun(planId)") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.executionLimits()") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.clearPlan(planId)") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf('market.clearPlan("all")') !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.deletePlan(planId) [deprecated") !== -1; }),
    `market.help should include dry-run plan commands, got ${captured.lines.join(" / ")}`,
  );

  let report = marketConsole.executionStatus();
  assert(typeof report === "string", "market.executionStatus should return a printable string");
  assert(report.indexOf("Engine: MANUAL_APPROVAL_GATED") !== -1, `executionStatus should state manual approval-gated engine, got ${report}`);
  assert(report.indexOf("market.executePlan(planId)") !== -1, `executionStatus should point to executePlan gate, got ${report}`);

  report = marketConsole.executionLimits();
  assert(typeof report === "string", "market.executionLimits should return a printable string");
  assert(report.indexOf("maxSellAmount") !== -1, `executionLimits should list sell amount limit, got ${report}`);
  assert(report.indexOf("maxBuyEffectivePrice") !== -1, `executionLimits should list buy effective price limit, got ${report}`);

  report = marketConsole.setExecutionLimit("maxSellAmount", "5000");
  assert(report.indexOf("maxSellAmount set to 5,000") !== -1, `setExecutionLimit should set numeric strings, got ${report}`);
  assert(Memory.consoleTools.market.executionLimits.maxSellAmount === 5000, "setExecutionLimit should write numeric limit");
  report = marketConsole.clearExecutionLimit("maxSellAmount");
  assert(report.indexOf("maxSellAmount reset to 10,000") !== -1, `clearExecutionLimit should restore default, got ${report}`);
  assert(Memory.consoleTools.market.executionLimits.maxSellAmount === 10000, "clearExecutionLimit should restore maxSellAmount default");
  report = marketConsole.setExecutionLimit("maxBuyEffectivePrice", 0.5);
  assert(report.indexOf("maxBuyEffectivePrice set to 0.5") !== -1, `setExecutionLimit should set maxBuyEffectivePrice, got ${report}`);
  assert(Memory.consoleTools.market.executionLimits.maxBuyEffectivePrice === 0.5, "setExecutionLimit should store maxBuyEffectivePrice");
  report = marketConsole.setExecutionLimit("maxBuyEffectivePrice", "null");
  assert(report.indexOf("maxBuyEffectivePrice set to unlimited") !== -1, `setExecutionLimit should clear maxBuyEffectivePrice with null, got ${report}`);
  assert(Memory.consoleTools.market.executionLimits.maxBuyEffectivePrice === null, "setExecutionLimit null should store unlimited maxBuyEffectivePrice");
  report = marketConsole.setExecutionLimit("notALimit", 10);
  assert(report.indexOf("Invalid execution limit") !== -1, `invalid limit names should be rejected, got ${report}`);
  report = marketConsole.setExecutionLimit("maxSellAmount", "not-a-number");
  assert(report.indexOf("invalid value") !== -1, `invalid limit values should be rejected, got ${report}`);

  report = marketConsole.planSell("H", 10000, sellRoom.name);
  assert(typeof report === "string", "market.planSell should return a printable string");
  assert(report.indexOf("READY") !== -1, `planSell should create a ready plan, got ${report}`);
  assert(report.indexOf("next: market.sell(\"H\"") !== -1, `planSell should show manual next command, got ${report}`);
  const sellPlanId = getMarketPlanIdFromReport(report);
  let savedPlan = Memory.consoleTools.market.plans[sellPlanId];
  assert(savedPlan.status === "ready", `expected ready sell plan, got ${savedPlan.status}`);
  assert(savedPlan.type === "sell", `expected sell plan type, got ${savedPlan.type}`);
  assert(savedPlan.selectedOrderId === "buy_H_plan", `expected selected buy order, got ${savedPlan.selectedOrderId}`);
  assert(savedPlan.executableAmount === 3000, `expected sell executable 3000, got ${savedPlan.executableAmount}`);

  report = marketConsole.planSell("H", 10000, sellRoom.name);
  assert(report.indexOf("READY") !== -1, `duplicate sell plan should be ready, got ${report}`);
  const duplicateSellPlanId = getMarketPlanIdFromReport(report);

  report = marketConsole.planSell("Z", 1000, sellRoom.name);
  assert(report.indexOf("BLOCKED") !== -1, `missing resource sell plan should be blocked, got ${report}`);
  savedPlan = Memory.consoleTools.market.plans[getMarketPlanIdFromReport(report)];
  assert(savedPlan.status === "blocked", `expected blocked sell plan, got ${savedPlan.status}`);
  assert(savedPlan.blockers.indexOf("no resource in terminal") !== -1, `expected no-resource blocker, got ${savedPlan.blockers.join(",")}`);

  const lowEnergyRoom = addOwnedMarketIntelRoom("VAL_MARKET_PLAN_LOW_ENERGY", {
    storageStore: { energy: 250000, H: 10000 },
    terminalStore: { energy: 0, H: 5000 },
  });
  installPlanMarket(readyOrders);
  report = marketConsole.planSell("H", 1000, lowEnergyRoom.name);
  assert(report.indexOf("BLOCKED") !== -1, `low-energy sell plan should be blocked, got ${report}`);
  assert(report.indexOf("insufficient terminal energy") !== -1 || report.indexOf("low terminal energy") !== -1, `expected energy blocker, got ${report}`);
  const lowEnergyPlanId = getMarketPlanIdFromReport(report);
  report = marketConsole.executionDryRun(lowEnergyPlanId);
  assert(report.indexOf("BLOCKED") !== -1, `executionDryRun should block no-energy sell plans, got ${report}`);
  assert(report.indexOf("terminal energy") !== -1, `executionDryRun should explain no terminal energy, got ${report}`);
  assert(report.indexOf("No execution performed.") !== -1, `executionDryRun should state no execution, got ${report}`);

  const buyRoom = addOwnedMarketIntelRoom("VAL_MARKET_PLAN_BUY", {
    storageStore: { energy: 250000 },
    terminalStore: { energy: 12000 },
  });
  installPlanMarket(readyOrders);
  report = marketConsole.planBuy("Z", 5000, buyRoom.name);
  assert(typeof report === "string", "market.planBuy should return a printable string");
  assert(report.indexOf("READY") !== -1, `planBuy should create a ready plan, got ${report}`);
  assert(report.indexOf("next: market.buy(\"Z\"") !== -1, `planBuy should show manual next command, got ${report}`);
  const buyPlanId = getMarketPlanIdFromReport(report);
  savedPlan = Memory.consoleTools.market.plans[buyPlanId];
  assert(savedPlan.status === "ready", `expected ready buy plan, got ${savedPlan.status}`);
  assert(savedPlan.type === "buy", `expected buy plan type, got ${savedPlan.type}`);
  assert(savedPlan.selectedOrderId === "sell_Z_plan", `expected selected sell order, got ${savedPlan.selectedOrderId}`);
  assert(savedPlan.executableAmount === 4000, `expected buy executable 4000, got ${savedPlan.executableAmount}`);

  report = marketConsole.executionDryRun(sellPlanId);
  assert(report.indexOf("READY") !== -1, `ready sell plan executionDryRun should return READY, got ${report}`);
  assert(report.indexOf("final executable amount 3,000") !== -1, `sell executionDryRun should show final amount, got ${report}`);
  assert(report.indexOf("selected order buy_H_plan") !== -1, `sell executionDryRun should show selected order, got ${report}`);
  assert(report.indexOf("No execution performed.") !== -1, `sell executionDryRun should state no execution, got ${report}`);

  marketConsole.setExecutionLimit("maxSellAmount", 1000);
  report = marketConsole.executionDryRun(sellPlanId);
  assert(report.indexOf("LIMIT_BLOCKED") !== -1, `maxSellAmount overage should limit-block sell dry run, got ${report}`);
  assert(report.indexOf("maxSellAmount") !== -1, `sell dry run should name maxSellAmount blocker, got ${report}`);
  marketConsole.clearExecutionLimit("maxSellAmount");

  marketConsole.setExecutionLimit("minSellEffectivePrice", 99);
  report = marketConsole.executionDryRun(sellPlanId);
  assert(report.indexOf("LIMIT_BLOCKED") !== -1, `minSellEffectivePrice violation should limit-block sell dry run, got ${report}`);
  assert(report.indexOf("minSellEffectivePrice") !== -1, `sell dry run should name minSellEffectivePrice blocker, got ${report}`);
  marketConsole.clearExecutionLimit("minSellEffectivePrice");

  marketConsole.setExecutionLimit("minTerminalEnergyReserve", 11901);
  report = marketConsole.executionDryRun(sellPlanId);
  assert(report.indexOf("LIMIT_BLOCKED") !== -1, `minTerminalEnergyReserve violation should limit-block sell dry run, got ${report}`);
  assert(report.indexOf("minTerminalEnergyReserve") !== -1, `sell dry run should name minTerminalEnergyReserve blocker, got ${report}`);
  marketConsole.clearExecutionLimit("minTerminalEnergyReserve");

  report = marketConsole.executionDryRun(buyPlanId);
  assert(report.indexOf("READY") !== -1, `ready buy plan executionDryRun should return READY, got ${report}`);
  assert(report.indexOf("final executable amount 4,000") !== -1, `buy executionDryRun should show final amount, got ${report}`);
  assert(report.indexOf("selected order sell_Z_plan") !== -1, `buy executionDryRun should show selected order, got ${report}`);

  marketConsole.setExecutionLimit("maxBuyAmount", 1000);
  report = marketConsole.executionDryRun(buyPlanId);
  assert(report.indexOf("LIMIT_BLOCKED") !== -1, `maxBuyAmount overage should limit-block buy dry run, got ${report}`);
  assert(report.indexOf("maxBuyAmount") !== -1, `buy dry run should name maxBuyAmount blocker, got ${report}`);
  marketConsole.clearExecutionLimit("maxBuyAmount");

  marketConsole.setExecutionLimit("maxCreditsPerBuy", 100);
  report = marketConsole.executionDryRun(buyPlanId);
  assert(report.indexOf("LIMIT_BLOCKED") !== -1, `maxCreditsPerBuy violation should limit-block buy dry run, got ${report}`);
  assert(report.indexOf("maxCreditsPerBuy") !== -1, `buy dry run should name maxCreditsPerBuy blocker, got ${report}`);
  marketConsole.clearExecutionLimit("maxCreditsPerBuy");

  marketConsole.setExecutionLimit("maxBuyEffectivePrice", 0.01);
  report = marketConsole.executionDryRun(buyPlanId);
  assert(report.indexOf("LIMIT_BLOCKED") !== -1, `maxBuyEffectivePrice violation should limit-block buy dry run, got ${report}`);
  assert(report.indexOf("maxBuyEffectivePrice") !== -1, `buy dry run should name maxBuyEffectivePrice blocker, got ${report}`);
  marketConsole.clearExecutionLimit("maxBuyEffectivePrice");

  const fullRoom = addOwnedMarketIntelRoom("VAL_MARKET_PLAN_FULL", {
    storageStore: { energy: 250000 },
    terminalStore: { energy: 300000 },
  });
  installPlanMarket(readyOrders);
  report = marketConsole.planBuy("Z", 1000, fullRoom.name);
  assert(report.indexOf("BLOCKED") !== -1, `full terminal buy plan should be blocked, got ${report}`);
  assert(report.indexOf("no terminal capacity") !== -1, `expected capacity blocker, got ${report}`);
  const fullPlanId = getMarketPlanIdFromReport(report);
  report = marketConsole.executionDryRun(fullPlanId);
  assert(report.indexOf("BLOCKED") !== -1, `executionDryRun should block no-capacity buy plans, got ${report}`);
  assert(report.indexOf("capacity") !== -1, `executionDryRun should explain no capacity, got ${report}`);
  assert(report.indexOf("final executable amount 0") !== -1, `no-capacity buy dry run should have final amount 0, got ${report}`);

  const creditRoom = addOwnedMarketIntelRoom("VAL_MARKET_PLAN_CREDITS", {
    storageStore: { energy: 250000 },
    terminalStore: { energy: 12000 },
  });
  installPlanMarket([
    {
      id: "sell_Z_plan_expensive",
      type: ORDER_SELL,
      resourceType: "Z",
      amount: 4000,
      price: 100,
      roomName: "W42N9",
    },
  ], { credits: 0 });
  report = marketConsole.planBuy("Z", 1000, creditRoom.name);
  assert(report.indexOf("BLOCKED") !== -1, `unaffordable buy plan should be blocked, got ${report}`);
  assert(report.indexOf("insufficient credits") !== -1, `expected credits blocker, got ${report}`);
  const creditPlanId = getMarketPlanIdFromReport(report);
  report = marketConsole.executionDryRun(creditPlanId);
  assert(report.indexOf("BLOCKED") !== -1, `executionDryRun should block insufficient-credit buy plans, got ${report}`);
  assert(report.indexOf("credits") !== -1, `executionDryRun should explain insufficient credits, got ${report}`);

  installPlanMarket([]);
  report = marketConsole.planBuy("Z", 1000, creditRoom.name);
  assert(report.indexOf("BLOCKED") !== -1, `missing order buy plan should be blocked, got ${report}`);
  assert(report.indexOf("no sell orders") !== -1, `expected no-order blocker, got ${report}`);

  installPlanMarket(readyOrders);
  report = marketConsole.plans();
  assert(typeof report === "string", "market.plans should return a printable string");
  assert(report.indexOf(sellPlanId) !== -1 && report.indexOf(buyPlanId) !== -1, `market.plans should list active plans, got ${report}`);

  report = marketConsole.planReview(sellPlanId);
  assert(typeof report === "string", "market.planReview should return a printable string");
  assert(report.indexOf("READY") !== -1, `planReview should confirm ready plans, got ${report}`);
  assert(report.indexOf("Plan still executable.") !== -1, `ready planReview should include operator summary, got ${report}`);

  report = marketConsole.planReview(lowEnergyPlanId);
  assert(report.indexOf("BLOCKED") !== -1, `planReview should detect blocked plans, got ${report}`);
  assert(report.indexOf("terminal energy") !== -1, `blocked planReview should explain energy blocker, got ${report}`);

  report = marketConsole.planAudit();
  assert(typeof report === "string", "market.planAudit should return a printable string");
  assert(report.indexOf("DUPLICATES:") !== -1, `planAudit should flag duplicate plans, got ${report}`);
  assert(report.indexOf(duplicateSellPlanId) !== -1, `planAudit should include duplicate plan id, got ${report}`);
  assert(report.indexOf("BLOCKED:") !== -1, `planAudit should flag blocked plans, got ${report}`);
  assert(report.indexOf(lowEnergyPlanId) !== -1, `planAudit should include blocked plan id, got ${report}`);

  report = marketConsole.planSummary();
  assert(typeof report === "string", "market.planSummary should return a printable string");
  assert(report.indexOf("Ready: 3") !== -1, `planSummary should count ready plans, got ${report}`);
  assert(report.indexOf("Blocked: 2") !== -1, `planSummary should count blocked plans, got ${report}`);
  assert(report.indexOf("Stale: 3") !== -1, `planSummary should count stale plans, got ${report}`);
  assert(report.indexOf("Deleted: 0") !== -1, `planSummary should count deleted plans, got ${report}`);
  assert(report.indexOf("Buy Plans: 4") !== -1, `planSummary should count buy plans, got ${report}`);
  assert(report.indexOf("Sell Plans: 4") !== -1, `planSummary should count sell plans, got ${report}`);

  installPlanMarket([]);
  report = marketConsole.executionDryRun(sellPlanId);
  assert(report.indexOf("STALE") !== -1, `executionDryRun should mark missing selected order stale, got ${report}`);
  assert(report.indexOf("order missing") !== -1, `executionDryRun should explain missing order, got ${report}`);
  report = marketConsole.plan(sellPlanId);
  assert(typeof report === "string", "market.plan should return a printable string");
  assert(report.indexOf("STALE") !== -1, `market.plan should detect missing selected order as stale, got ${report}`);
  assert(Memory.consoleTools.market.plans[sellPlanId].status === "stale", "market.plan should mark stale plans stale");

  report = marketConsole.planReview(duplicateSellPlanId);
  assert(report.indexOf("STALE") !== -1, `planReview should detect stale missing-order plans, got ${report}`);
  assert(Memory.consoleTools.market.plans[duplicateSellPlanId].status === "stale", "planReview should mark stale plans stale");

  report = marketConsole.planAudit();
  assert(report.indexOf("STALE:") !== -1, `planAudit should flag stale plans, got ${report}`);
  assert(report.indexOf(sellPlanId) !== -1, `planAudit should include stale plan id, got ${report}`);
  assert(report.indexOf("MISSING ORDER:") !== -1, `planAudit should flag missing-order plans, got ${report}`);

  report = marketConsole.planSummary();
  assert(typeof report === "string", "market.planSummary should return a printable string");
  assert(report.indexOf("Ready: 0") !== -1, `planSummary should count ready plans, got ${report}`);
  assert(report.indexOf("Blocked: 0") !== -1, `planSummary should count blocked plans, got ${report}`);
  assert(report.indexOf("Stale: 8") !== -1, `planSummary should count stale plans, got ${report}`);
  assert(report.indexOf("Deleted: 0") !== -1, `planSummary should count deleted plans, got ${report}`);
  assert(report.indexOf("Buy Plans: 4") !== -1, `planSummary should count buy plans, got ${report}`);
  assert(report.indexOf("Sell Plans: 4") !== -1, `planSummary should count sell plans, got ${report}`);

  report = marketConsole.clearPlan(buyPlanId);
  assert(report.indexOf(`Plan ${buyPlanId} deleted.`) !== -1, `clearPlan should return a printable deletion report, got ${report}`);
  assert(Memory.consoleTools.market.plans[buyPlanId].status === "deleted", "deletePlan should soft-delete plans");
  report = marketConsole.plans();
  assert(
    !report.split("\n").some(function (line) { return line.indexOf(`  ${buyPlanId} |`) === 0; }),
    `default market.plans should hide deleted plans, got ${report}`,
  );
  report = marketConsole.plans("all");
  assert(
    report.split("\n").some(function (line) { return line.indexOf(`  ${buyPlanId} |`) === 0; }),
    `market.plans(all) should include deleted plans, got ${report}`,
  );

  installPlanMarket(readyOrders);
  report = marketConsole.planBuy("Z", 1000, buyRoom.name);
  const deleteAliasPlanId = getMarketPlanIdFromReport(report);
  captured = captureConsoleLines(function () {
    return marketConsole.deletePlan(deleteAliasPlanId);
  });
  assert(captured.result.indexOf(`Plan ${deleteAliasPlanId} deleted.`) !== -1, `deletePlan alias should route to clearPlan, got ${captured.result}`);
  assert(
    captured.lines.some(function (line) { return line.indexOf("deletePlan() is deprecated. Use market.clearPlan().") !== -1; }),
    `deletePlan alias should print deprecation, got ${captured.lines.join(" / ")}`,
  );

  report = marketConsole.planBuy("Z", 1000, buyRoom.name);
  const removeAliasPlanId = getMarketPlanIdFromReport(report);
  captured = captureConsoleLines(function () {
    return marketConsole.removePlan(removeAliasPlanId);
  });
  assert(captured.result.indexOf(`Plan ${removeAliasPlanId} deleted.`) !== -1, `removePlan alias should route to clearPlan, got ${captured.result}`);
  assert(
    captured.lines.some(function (line) { return line.indexOf("removePlan() is deprecated. Use market.clearPlan().") !== -1; }),
    `removePlan alias should print deprecation, got ${captured.lines.join(" / ")}`,
  );

  report = marketConsole.planBuy("Z", 1000, buyRoom.name);
  const clearAllPlanId = getMarketPlanIdFromReport(report);
  report = marketConsole.clearPlan("all");
  assert(report.indexOf("plans deleted.") !== -1, `clearPlan(all) should return deleted count, got ${report}`);
  assert(Memory.consoleTools.market.plans[clearAllPlanId].status === "deleted", "clearPlan(all) should soft-delete active plans");

  report = marketConsole.planSell("H", 1000, sellRoom.name);
  const clearPlansAliasPlanId = getMarketPlanIdFromReport(report);
  captured = captureConsoleLines(function () {
    return marketConsole.clearPlans();
  });
  assert(captured.result.indexOf("plans deleted.") !== -1, `clearPlans alias should route to clearPlan(all), got ${captured.result}`);
  assert(Memory.consoleTools.market.plans[clearPlansAliasPlanId].status === "deleted", "clearPlans alias should soft-delete active plans");
  assert(
    captured.lines.some(function (line) { return line.indexOf('clearPlans() is deprecated. Use market.clearPlan("all").') !== -1; }),
    `clearPlans alias should print deprecation, got ${captured.lines.join(" / ")}`,
  );

  const dealCount = fakeMarketTrackers.reduce(function (total, tracker) {
    return total + tracker.length;
  }, 0);
  const createdOrderCount = fakeMarketTrackers.reduce(function (total, tracker) {
    return total + tracker.createdOrders.length;
  }, 0);
  assert(dealCount === 0, `dry-run plans must not execute Game.market.deal, got ${dealCount}`);
  assert(createdOrderCount === 0, `dry-run plans must not create market orders, got ${createdOrderCount}`);
  assert(currentRuntime.terminalSends.length === 0, `dry-run plans must not send terminal resources, got ${currentRuntime.terminalSends.length}`);
  assert(
    opsLogisticsManager.listRequests().length === requestCountBefore,
    "dry-run plans must not create ops logistics requests",
  );
}

function runMarketApprovalGatedExecutionScenario() {
  Memory.consoleTools = { market: { plans: {} } };
  Memory.ops = { logistics: { requests: {} } };

  const orders = [
    {
      id: "buy_H_execute",
      type: ORDER_BUY,
      resourceType: "H",
      amount: 5000,
      price: 0.72,
      roomName: "W42N9",
    },
    {
      id: "sell_Z_execute",
      type: ORDER_SELL,
      resourceType: "Z",
      amount: 4000,
      price: 0.35,
      roomName: "W42N9",
    },
  ];
  const sellRoom = buildOpsLogisticsRoom("VAL_MARKET_EXEC_SELL", {
    tick: 1370,
    storageStore: { energy: 250000, H: 10000 },
    terminalStore: { energy: 12000, H: 5000 },
  });
  const buyRoom = addOwnedMarketIntelRoom("VAL_MARKET_EXEC_BUY", {
    storageStore: { energy: 250000 },
    terminalStore: { energy: 12000 },
  });
  const fakeTrackers = [];
  const installPlanMarket = function (marketOrders, options) {
    const tracker = installFakeMarket(marketOrders, options);
    fakeTrackers.push(tracker);
    return tracker;
  };

  installPlanMarket(orders);
  const requestCountBefore = opsLogisticsManager.listRequests().length;

  let captured = captureConsoleLines(function () {
    return marketConsole.help();
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("market.executePlan(planId)") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.history()") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.history(resource)") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.history(roomName)") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf('market.history("all")') !== -1; }),
    `market.help should include Layer 3.6 execution and history commands, got ${captured.lines.join(" / ")}`,
  );

  let report = marketConsole.planSell("H", 3000, sellRoom.name);
  const sellPlanId = getMarketPlanIdFromReport(report);
  const sellDeals = installPlanMarket(orders);
  report = marketConsole.executePlan(sellPlanId);
  assert(typeof report === "string", "market.executePlan should return a printable string");
  assert(sellDeals.length === 1, `executePlan should call Game.market.deal once for ready sell, got ${sellDeals.length}`);
  assert(sellDeals[0].orderId === "buy_H_execute", `sell executePlan should use saved order, got ${JSON.stringify(sellDeals[0])}`);
  assert(sellDeals[0].amount === 3000, `sell executePlan should use final amount 3000, got ${sellDeals[0].amount}`);
  assert(report.indexOf("EXECUTED") !== -1, `sell executePlan should report executed, got ${report}`);
  let savedPlan = Memory.consoleTools.market.plans[sellPlanId];
  assert(savedPlan.executionStatus === "executed", `sell plan should record executed status, got ${savedPlan.executionStatus}`);
  assert(savedPlan.executedAmount === 3000, `sell plan should record executed amount, got ${savedPlan.executedAmount}`);
  assert(savedPlan.resultLabel === "OK", `sell plan should record OK result, got ${savedPlan.resultLabel}`);
  assert(Memory.consoleTools.market.history.length === 1, "sell execution should create history entry");

  report = marketConsole.planBuy("Z", 2000, buyRoom.name);
  const buyPlanId = getMarketPlanIdFromReport(report);
  const buyDeals = installPlanMarket(orders);
  report = marketConsole.executePlan(buyPlanId);
  assert(buyDeals.length === 1, `executePlan should call Game.market.deal once for ready buy, got ${buyDeals.length}`);
  assert(buyDeals[0].orderId === "sell_Z_execute", `buy executePlan should use saved order, got ${JSON.stringify(buyDeals[0])}`);
  assert(report.indexOf("EXECUTED") !== -1, `buy executePlan should report executed, got ${report}`);
  savedPlan = Memory.consoleTools.market.plans[buyPlanId];
  assert(savedPlan.executionStatus === "executed", `buy plan should record executed status, got ${savedPlan.executionStatus}`);
  assert(Memory.consoleTools.market.history.length === 2, "buy execution should create history entry");

  const lowEnergyRoom = addOwnedMarketIntelRoom("VAL_MARKET_EXEC_LOW", {
    storageStore: { energy: 250000, H: 10000 },
    terminalStore: { energy: 0, H: 5000 },
  });
  installPlanMarket(orders);
  report = marketConsole.planSell("H", 1000, lowEnergyRoom.name);
  const blockedPlanId = getMarketPlanIdFromReport(report);
  const blockedDeals = installPlanMarket(orders);
  report = marketConsole.executePlan(blockedPlanId);
  assert(blockedDeals.length === 0, `blocked executePlan must not deal, got ${blockedDeals.length}`);
  assert(report.indexOf("BLOCKED") !== -1, `blocked executePlan should report blocked, got ${report}`);
  assert(Memory.consoleTools.market.plans[blockedPlanId].executionStatus === "blocked", "blocked plan should record blocked execution status");

  installPlanMarket(orders);
  report = marketConsole.planSell("H", 1000, sellRoom.name);
  const stalePlanId = getMarketPlanIdFromReport(report);
  const staleDeals = installPlanMarket([]);
  report = marketConsole.executePlan(stalePlanId);
  assert(staleDeals.length === 0, `stale executePlan must not deal, got ${staleDeals.length}`);
  assert(report.indexOf("STALE") !== -1, `stale executePlan should report stale, got ${report}`);
  assert(Memory.consoleTools.market.plans[stalePlanId].executionStatus === "stale", "stale plan should record stale execution status");

  installPlanMarket(orders);
  report = marketConsole.planSell("H", 3000, sellRoom.name);
  const limitPlanId = getMarketPlanIdFromReport(report);
  marketConsole.setExecutionLimit("maxSellAmount", 1000);
  const limitDeals = installPlanMarket(orders);
  report = marketConsole.executePlan(limitPlanId);
  assert(limitDeals.length === 0, `limit-blocked executePlan must not deal, got ${limitDeals.length}`);
  assert(report.indexOf("LIMIT_BLOCKED") !== -1, `limit-blocked executePlan should report limit blocked, got ${report}`);
  assert(Memory.consoleTools.market.plans[limitPlanId].executionStatus === "limit_blocked", "limit-blocked plan should record limit_blocked status");
  marketConsole.clearExecutionLimit("maxSellAmount");

  installPlanMarket(orders);
  report = marketConsole.planSell("H", 1000, sellRoom.name);
  const failedPlanId = getMarketPlanIdFromReport(report);
  const failedDeals = installPlanMarket(orders, { dealResult: ERR_BUSY });
  report = marketConsole.executePlan(failedPlanId);
  assert(failedDeals.length === 1, `failed deal executePlan should call deal once, got ${failedDeals.length}`);
  assert(report.indexOf("FAILED") !== -1, `failed executePlan should report failed, got ${report}`);
  assert(Memory.consoleTools.market.plans[failedPlanId].executionStatus === "failed", "failed plan should record failed status");
  assert(Memory.consoleTools.market.plans[failedPlanId].resultLabel === "ERR_BUSY", "failed plan should record result label");

  installPlanMarket(orders);
  report = marketConsole.planSell("H", 6000, sellRoom.name);
  const partialPlanId = getMarketPlanIdFromReport(report);
  const partialDeals = installPlanMarket(orders);
  report = marketConsole.executePlan(partialPlanId);
  assert(partialDeals.length === 1, `partial executePlan should call deal once, got ${partialDeals.length}`);
  assert(partialDeals[0].amount === 5000, `partial executePlan should deal final order amount 5000, got ${partialDeals[0].amount}`);
  assert(report.indexOf("PARTIAL") !== -1, `partial executePlan should report partial, got ${report}`);
  savedPlan = Memory.consoleTools.market.plans[partialPlanId];
  assert(savedPlan.executionStatus === "partial", `partial plan should record partial, got ${savedPlan.executionStatus}`);
  assert(savedPlan.executedAmount < savedPlan.requestedAmount, "partial plan should record executedAmount below requestedAmount");

  report = marketConsole.history();
  assert(typeof report === "string" && report.indexOf("[MARKET] Execution History") !== -1, `history should return printable string, got ${report}`);
  report = marketConsole.history("H");
  assert(report.indexOf("| H |") !== -1, `history(resource) should include H entries, got ${report}`);
  assert(report.indexOf("| Z |") === -1, `history(resource) should filter out Z entries, got ${report}`);
  report = marketConsole.history(sellRoom.name);
  assert(report.indexOf(sellRoom.name) !== -1, `history(roomName) should include room entries, got ${report}`);
  assert(report.indexOf(buyRoom.name) === -1, `history(roomName) should filter other rooms, got ${report}`);
  report = marketConsole.history("all");
  assert(report.indexOf("showing") !== -1, `history(all) should return bounded all history, got ${report}`);

  const executeTrackers = [sellDeals, buyDeals, failedDeals, partialDeals];
  const autonomousDealCount = fakeTrackers.filter(function (tracker) {
    return executeTrackers.indexOf(tracker) === -1;
  }).reduce(function (total, tracker) {
    return total + tracker.length;
  }, 0);
  assert(autonomousDealCount === 0, `non-execution market commands should not call deal in this scenario, got ${autonomousDealCount}`);
  const executeDealCount = executeTrackers.reduce(function (total, tracker) {
    return total + tracker.length;
  }, 0);
  assert(executeDealCount === 4, `expected four executePlan deal calls, got ${executeDealCount}`);
  const createdOrderCount = fakeTrackers.reduce(function (total, tracker) {
    return total + tracker.createdOrders.length;
  }, 0);
  assert(createdOrderCount === 0, `executePlan must not create market orders, got ${createdOrderCount}`);
  assert(currentRuntime.terminalSends.length === 0, `executePlan must not send terminal resources, got ${currentRuntime.terminalSends.length}`);
  assert(
    opsLogisticsManager.listRequests().length === requestCountBefore,
    "executePlan must not create ops logistics requests",
  );
}

function buildMarketHistoryEntry(overrides) {
  const settings = overrides || {};
  const status = settings.status || "executed";
  const type = settings.type || "sell";
  const resourceType = settings.resourceType || "H";
  const roomName = settings.roomName || "W42N9";
  const executedAmount = settings.executedAmount !== undefined
    ? settings.executedAmount
    : status === "executed" || status === "partial"
      ? 1000
      : 0;
  const creditsDelta = settings.creditsDelta !== undefined
    ? settings.creditsDelta
    : type === "buy"
      ? -350
      : 720;

  return {
    id: settings.id || `mx_seed_${Game.time}_${settings.executedAt || 0}_${status}`,
    planId: settings.planId || `plan_${resourceType}_${roomName}_${status}`,
    type: type,
    roomName: roomName,
    resourceType: resourceType,
    requestedAmount: settings.requestedAmount || 1000,
    plannedExecutableAmount: settings.plannedExecutableAmount || 1000,
    finalExecutableAmount: settings.finalExecutableAmount || 1000,
    executedAmount: executedAmount,
    orderId: settings.orderId || "seed_order",
    price: settings.price || 0.72,
    effectivePrice: settings.effectivePrice || 0.7,
    creditsDelta: creditsDelta,
    energyCost: settings.energyCost || 100,
    resultCode: settings.resultCode !== undefined ? settings.resultCode : status === "failed" ? ERR_BUSY : OK,
    resultLabel: settings.resultLabel || (status === "failed" ? "ERR_BUSY" : "OK"),
    status: status,
    reason: settings.reason || "none",
    blockers: settings.blockers || [],
    createdAt: settings.createdAt || Game.time,
    executedAt: settings.executedAt || Game.time,
  };
}

function seedMarketHistory() {
  Memory.consoleTools = {
    market: {
      history: [
        buildMarketHistoryEntry({ id: "hist_exec_1", status: "executed", executedAt: 1, creditsDelta: 720, energyCost: 100 }),
        buildMarketHistoryEntry({ id: "hist_exec_2", status: "executed", executedAt: 2, resourceType: "Z", roomName: "W42N8", creditsDelta: 350, energyCost: 50 }),
        buildMarketHistoryEntry({ id: "hist_partial_1", status: "partial", executedAt: 3, creditsDelta: -175, energyCost: 25, type: "buy" }),
        buildMarketHistoryEntry({ id: "hist_failed_1", status: "failed", executedAt: 4, reason: "ERR_BUSY", resultLabel: "ERR_BUSY" }),
        buildMarketHistoryEntry({ id: "hist_failed_2", status: "failed", executedAt: 5, reason: "ERR_BUSY", resultLabel: "ERR_BUSY" }),
        buildMarketHistoryEntry({ id: "hist_blocked_1", status: "blocked", executedAt: 6, reason: "terminal energy too low", blockers: ["terminal energy too low"] }),
        buildMarketHistoryEntry({ id: "hist_blocked_2", status: "blocked", executedAt: 7, reason: "terminal energy too low", blockers: ["terminal energy too low"] }),
        buildMarketHistoryEntry({ id: "hist_stale_1", status: "stale", executedAt: 8, reason: "order missing", blockers: ["order missing"] }),
        buildMarketHistoryEntry({ id: "hist_stale_2", status: "stale", executedAt: 9, reason: "order missing", blockers: ["order missing"] }),
        buildMarketHistoryEntry({ id: "hist_limit_1", status: "limit_blocked", executedAt: 10, reason: "maxSellAmount", blockers: ["maxSellAmount"] }),
        buildMarketHistoryEntry({ id: "hist_limit_2", status: "limit_blocked", executedAt: 11, reason: "maxSellAmount", blockers: ["maxSellAmount"] }),
      ],
      plans: {
        deleted_plan: { id: "deleted_plan", status: "deleted" },
      },
    },
  };
  Memory.consoleTools.market.history.push(
    buildMarketHistoryEntry({ id: "hist_deleted_1", status: "blocked", planId: "deleted_plan", executedAt: 12 }),
  );
  Memory.ops = { logistics: { requests: {} } };
}

function runMarketHistoryGovernanceScenario() {
  seedMarketHistory();
  const requestCountBefore = opsLogisticsManager.listRequests().length;
  const dealTracker = installFakeMarket([]);
  const sendsBefore = currentRuntime.terminalSends.length;

  let captured = captureConsoleLines(function () {
    return marketConsole.help();
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("market.historySummary()") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.historyAudit()") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.clearHistory(mode)") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.setHistoryLimit(limit)") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("market.historyLimit()") !== -1; }),
    `market.help should include Layer 3.7 history governance commands, got ${captured.lines.join(" / ")}`,
  );

  let report = marketConsole.historySummary();
  assert(typeof report === "string", "market.historySummary should return a printable string");
  assert(report.indexOf("Entries: 12") !== -1, `historySummary should count total entries, got ${report}`);
  assert(report.indexOf("Executed: 2") !== -1, `historySummary should count executed entries, got ${report}`);
  assert(report.indexOf("Partial: 1") !== -1, `historySummary should count partial entries, got ${report}`);
  assert(report.indexOf("Failed: 2") !== -1, `historySummary should count failed entries, got ${report}`);
  assert(report.indexOf("Blocked: 3") !== -1, `historySummary should count blocked entries, got ${report}`);
  assert(report.indexOf("Stale: 2") !== -1, `historySummary should count stale entries, got ${report}`);
  assert(report.indexOf("Limit Blocked: 2") !== -1, `historySummary should count limit-blocked entries, got ${report}`);
  assert(report.indexOf("Credits Gained: 1,070") !== -1, `historySummary should total gained credits, got ${report}`);
  assert(report.indexOf("Credits Spent: 175") !== -1, `historySummary should total spent credits, got ${report}`);
  assert(report.indexOf("Energy Spent: 175") !== -1, `historySummary should total execution energy, got ${report}`);

  report = marketConsole.historyAudit();
  assert(typeof report === "string", "market.historyAudit should return a printable string");
  assert(report.indexOf("Repeated Failures:") !== -1 && report.indexOf("H sell plan (2)") !== -1, `historyAudit should identify repeated failures, got ${report}`);
  assert(report.indexOf("Repeated Limit Blocks:") !== -1 && report.indexOf("maxSellAmount (2)") !== -1, `historyAudit should identify repeated limit blocks, got ${report}`);
  assert(report.indexOf("Repeated Stale Plans:") !== -1 && report.indexOf("W42N9 H sell (2)") !== -1, `historyAudit should identify repeated stale plans, got ${report}`);
  assert(report.indexOf("Repeated Blocked Executions:") !== -1 && report.indexOf("terminal energy too low (2)") !== -1, `historyAudit should identify repeated blocked executions, got ${report}`);
  assert(report.indexOf("Healthy Executions: 3") !== -1, `historyAudit should count healthy executions, got ${report}`);

  report = marketConsole.historyLimit();
  assert(report.indexOf("History Limit: 100") !== -1, `historyLimit should show default limit, got ${report}`);
  report = marketConsole.setHistoryLimit(9);
  assert(report.indexOf("Invalid history limit") !== -1, `setHistoryLimit should reject limits below minimum, got ${report}`);
  report = marketConsole.setHistoryLimit("not-a-number");
  assert(report.indexOf("Invalid history limit") !== -1, `setHistoryLimit should reject invalid values, got ${report}`);
  report = marketConsole.setHistoryLimit(10);
  assert(report.indexOf("History limit set to 10") !== -1, `setHistoryLimit should accept valid values, got ${report}`);
  assert(Memory.consoleTools.market.historyLimit === 10, "setHistoryLimit should write historyLimit memory");
  assert(Memory.consoleTools.market.history.length === 10, "setHistoryLimit should trim existing history to the new limit");
  assert(!Memory.consoleTools.market.history.some(function (entry) { return entry.id === "hist_exec_1"; }), "history trimming should remove oldest entries first");

  Memory.consoleTools.market.history = [];
  for (let i = 0; i < 10; i++) {
    Memory.consoleTools.market.history.push(buildMarketHistoryEntry({ id: `trim_seed_${i}`, executedAt: i + 1 }));
  }
  const trimRoom = buildOpsLogisticsRoom("VAL_MARKET_HISTORY_TRIM", {
    tick: 1380,
    storageStore: { energy: 250000, H: 10000 },
    terminalStore: { energy: 12000, H: 5000 },
  });
  installFakeMarket([
    {
      id: "buy_H_history_trim",
      type: ORDER_BUY,
      resourceType: "H",
      amount: 1000,
      price: 0.72,
      roomName: "W42N9",
    },
  ]);
  report = marketConsole.planSell("H", 1000, trimRoom.name);
  const trimPlanId = getMarketPlanIdFromReport(report);
  marketConsole.setHistoryLimit(10);
  Memory.consoleTools.market.history = [];
  for (let i = 0; i < 10; i++) {
    Memory.consoleTools.market.history.push(buildMarketHistoryEntry({ id: `trim_seed_${i}`, executedAt: i + 1 }));
  }
  const trimDeals = installFakeMarket([
    {
      id: "buy_H_history_trim",
      type: ORDER_BUY,
      resourceType: "H",
      amount: 1000,
      price: 0.72,
      roomName: "W42N9",
    },
  ]);
  report = marketConsole.executePlan(trimPlanId);
  assert(trimDeals.length === 1, `executePlan should still record one deal during trim check, got ${trimDeals.length}`);
  assert(Memory.consoleTools.market.history.length === 10, "executePlan should trim history above configured limit");
  assert(!Memory.consoleTools.market.history.some(function (entry) { return entry.id === "trim_seed_0"; }), "executePlan history trim should remove oldest entry first");
  assert(Memory.consoleTools.market.history.some(function (entry) { return entry.planId === trimPlanId; }), "executePlan should retain the newest history entry");

  seedMarketHistory();
  report = marketConsole.clearHistory("failed");
  assert(report.indexOf("History entries removed: 2") !== -1, `clearHistory(failed) should remove failed entries, got ${report}`);
  assert(!Memory.consoleTools.market.history.some(function (entry) { return entry.status === "failed"; }), "clearHistory(failed) should remove failed entries only");
  report = marketConsole.clearHistory("blocked");
  assert(report.indexOf("History entries removed: 5") !== -1, `clearHistory(blocked) should remove blocked and limit-blocked entries, got ${report}`);
  assert(!Memory.consoleTools.market.history.some(function (entry) { return entry.status === "blocked" || entry.status === "limit_blocked"; }), "clearHistory(blocked) should remove blocked and limit_blocked entries");
  report = marketConsole.clearHistory("stale");
  assert(report.indexOf("History entries removed: 2") !== -1, `clearHistory(stale) should remove stale entries, got ${report}`);
  assert(!Memory.consoleTools.market.history.some(function (entry) { return entry.status === "stale"; }), "clearHistory(stale) should remove stale entries");
  seedMarketHistory();
  report = marketConsole.clearHistory("deleted");
  assert(report.indexOf("History entries removed: 1") !== -1, `clearHistory(deleted) should remove entries tied to deleted plans, got ${report}`);
  assert(!Memory.consoleTools.market.history.some(function (entry) { return entry.planId === "deleted_plan"; }), "clearHistory(deleted) should remove deleted-plan history entries");
  report = marketConsole.clearHistory("invalid");
  assert(report.indexOf("Invalid history clear mode") !== -1, `clearHistory should reject unsupported modes, got ${report}`);
  report = marketConsole.clearHistory("all");
  assert(report.indexOf("History entries removed: 11") !== -1, `clearHistory(all) should remove all remaining entries, got ${report}`);
  assert(Memory.consoleTools.market.history.length === 0, "clearHistory(all) should clear all history");

  assert(dealTracker.length === 0, `history governance commands must not execute Game.market.deal, got ${dealTracker.length}`);
  assert(dealTracker.createdOrders.length === 0, `history governance commands must not create market orders, got ${JSON.stringify(dealTracker.createdOrders)}`);
  assert(currentRuntime.terminalSends.length === sendsBefore, `history governance commands must not send terminal resources, got ${currentRuntime.terminalSends.length - sendsBefore}`);
  assert(
    opsLogisticsManager.listRequests().length === requestCountBefore,
    "history governance commands must not create ops logistics requests",
  );
}

function buildEmpireMineralRooms(options) {
  const settings = options || {};
  const donor = buildRoomScenario("VAL_MINERAL_DONOR", {
    tick: settings.tick || 1000,
    controllerLevel: 8,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
  });
  addOwnedStorageAndTerminal(donor, settings.donorStore || { energy: 10000, U: 1500 });

  const target = createOwnedSupportTargetRoom("VAL_MINERAL_TARGET", {
    controllerLevel: 8,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
  });
  addOwnedStorageAndTerminal(target, settings.targetStore || { energy: 10000, H: 500 });

  Memory.rooms[target.name] = Memory.rooms[target.name] || {};
  Memory.rooms[target.name].advancedOps = {
    summary: {
      labStatus: "missing_reagents",
      labGoal: "UH",
      labProduct: "UH",
      labNeed: 1000,
      labReason: "missing_reagents",
    },
  };

  return { donor: donor, target: target };
}

function runEmpireMineralTransferScenario() {
  const rooms = buildEmpireMineralRooms({ tick: 1000 });
  empireManager.record([rooms.donor, rooms.target], {});

  assert(currentRuntime.terminalSends.length === 1, `expected one terminal send, got ${currentRuntime.terminalSends.length}`);
  const send = currentRuntime.terminalSends[0];
  assert(send.from === rooms.donor.name && send.to === rooms.target.name, `expected donor -> target send, got ${JSON.stringify(send)}`);
  assert(send.resourceType === "U", `expected U send, got ${send.resourceType}`);
  assert(send.amount === 500, `expected missing reagent batch of 500, got ${send.amount}`);
  assert(rooms.target.terminal.store.U === 500, `expected target terminal to receive U, got ${rooms.target.terminal.store.U || 0}`);
}

function runEmpireMineralBlockedScenario() {
  const rooms = buildEmpireMineralRooms({
    tick: 1000,
    donorStore: { energy: 10000, U: 500 },
  });
  empireManager.record([rooms.donor, rooms.target], {});

  assert(currentRuntime.terminalSends.length === 0, `expected no terminal sends when sender reserve blocks, got ${currentRuntime.terminalSends.length}`);
  assert(
    Memory.empire.minerals.status === "pending",
    `expected pending mineral status, got ${Memory.empire.minerals.status}`,
  );
}

function runEmpireMineralOneTransferScenario() {
  const rooms = buildEmpireMineralRooms({ tick: 1000 });
  const secondTarget = createOwnedSupportTargetRoom("VAL_MINERAL_TARGET_B", {
    controllerLevel: 8,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
  });
  addOwnedStorageAndTerminal(secondTarget, { energy: 10000, H: 500 });
  Memory.rooms[secondTarget.name] = {
    advancedOps: {
      summary: {
        labStatus: "missing_reagents",
        labGoal: "UH",
        labProduct: "UH",
        labNeed: 1000,
        labReason: "missing_reagents",
      },
    },
  };

  empireManager.record([rooms.donor, rooms.target, secondTarget], {});

  assert(currentRuntime.terminalSends.length === 1, `expected one transfer per tick, got ${currentRuntime.terminalSends.length}`);
}

function buildEmpireSupportRooms(options) {
  const settings = options || {};
  const donor = buildRoomScenario("VAL_SUPPORT_DONOR", {
    tick: settings.tick || 1100,
    controllerLevel: 8,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    creeps: [
      { name: "supportDonorWorker", role: "worker", x: 24, y: 25 },
    ],
  });
  donor.controller.my = true;
  satisfyDevelopmentRequirements(donor);
  donor.storage.store.energy = settings.donorStorageEnergy || 200000;

  const target = createOwnedSupportTargetRoom("VAL_SUPPORT_TARGET", {
    controllerLevel: settings.targetControllerLevel || 5,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
  });
  if (settings.buildSite !== false) {
    target.createConstructionSite(24, 26, STRUCTURE_EXTENSION);
  }
  if (settings.downgradeTicks !== undefined) {
    target.controller.ticksToDowngrade = settings.downgradeTicks;
  }

  return { donor: donor, target: target };
}

function runEmpireSupportWorkerScenario() {
  const rooms = buildEmpireSupportRooms({});
  const donorState = roomState.collect(rooms.donor);
  const targetState = roomState.collect(rooms.target);
  empireManager.record([rooms.donor, rooms.target], {
    [rooms.donor.name]: donorState,
    [rooms.target.name]: targetState,
  });

  const requests = spawnManager.getSpawnRequests(rooms.donor, donorState);
  const support = requests.find(function (request) {
    return request.operation === "empire_support" && request.role === "worker";
  });

  assert(support, `expected worker support request, got ${JSON.stringify(requests)}`);
  assert(support.targetRoom === rooms.target.name, `expected target room assignment, got ${support.targetRoom}`);
}

function runEmpireSupportUpgraderScenario() {
  const rooms = buildEmpireSupportRooms({ buildSite: false, downgradeTicks: 5000 });
  const donorState = roomState.collect(rooms.donor);
  const targetState = roomState.collect(rooms.target);
  empireManager.record([rooms.donor, rooms.target], {
    [rooms.donor.name]: donorState,
    [rooms.target.name]: targetState,
  });

  const requests = spawnManager.getSpawnRequests(rooms.donor, donorState);
  const support = requests.find(function (request) {
    return request.operation === "empire_support" && request.role === "upgrader";
  });

  assert(support, `expected upgrader support request, got ${JSON.stringify(requests)}`);
  assert(support.targetRoom === rooms.target.name, `expected target room assignment, got ${support.targetRoom}`);
}

function runEmpireSupportDonorBlockedScenario() {
  const rooms = buildEmpireSupportRooms({});
  const donorState = roomState.collect(rooms.donor);
  const targetState = roomState.collect(rooms.target);
  Memory.rooms[rooms.donor.name] = Memory.rooms[rooms.donor.name] || {};
  Memory.rooms[rooms.donor.name].spawnQueue = [{ role: "miner", priority: 100 }];
  empireManager.record([rooms.donor, rooms.target], {
    [rooms.donor.name]: donorState,
    [rooms.target.name]: targetState,
  });

  const requests = empireManager.getEmpireSupportSpawnRequests(rooms.donor, donorState);
  assert(requests.length === 0, `expected donor local backlog to block support, got ${JSON.stringify(requests)}`);
}

function runEmpireSupportTravelScenario() {
  const rooms = buildEmpireSupportRooms({ buildSite: false });
  const worker = createCreep("supportWorker", "worker", 1, 1, {
    roomName: rooms.donor.name,
    memory: {
      role: "worker",
      room: rooms.donor.name,
      homeRoom: rooms.donor.name,
      targetRoom: rooms.target.name,
      operation: "empire_support",
      supportRole: "worker",
    },
  });
  roleWorker.run(worker);

  const move = currentRuntime.creepActions.find(function (action) {
    return action.creep === "supportWorker" && action.action === "moveTo";
  });
  assert(move && move.targetRoom === rooms.target.name, `expected support worker to travel to target room, got ${JSON.stringify(currentRuntime.creepActions)}`);

  const upgrader = createCreep("supportUpgrader", "upgrader", 1, 2, {
    roomName: rooms.donor.name,
    memory: {
      role: "upgrader",
      room: rooms.donor.name,
      homeRoom: rooms.donor.name,
      targetRoom: rooms.target.name,
      operation: "empire_support",
      supportRole: "upgrader",
    },
  });
  roleUpgrader.run(upgrader);

  const upgraderMove = currentRuntime.creepActions.find(function (action) {
    return action.creep === "supportUpgrader" && action.action === "moveTo";
  });
  assert(upgraderMove && upgraderMove.targetRoom === rooms.target.name, `expected support upgrader to travel to target room, got ${JSON.stringify(currentRuntime.creepActions)}`);
}

function runEmpireSupportLocalConstructionPriorityScenario() {
  const rooms = buildEmpireSupportRooms({});
  rooms.donor.createConstructionSite(23, 26, STRUCTURE_EXTENSION);
  rooms.donor.createConstructionSite(23, 27, STRUCTURE_EXTENSION);
  rooms.donor.createConstructionSite(23, 28, STRUCTURE_EXTENSION);
  rooms.donor.createConstructionSite(23, 29, STRUCTURE_EXTENSION);
  const donorState = roomState.collect(rooms.donor);
  const targetState = roomState.collect(rooms.target);
  empireManager.record([rooms.donor, rooms.target], {
    [rooms.donor.name]: donorState,
    [rooms.target.name]: targetState,
  });

  const requests = spawnManager.getSpawnRequests(rooms.donor, donorState);
  const localWorkerIndex = requests.findIndex(function (request) {
    return request.role === "worker" && request.operation !== "empire_support";
  });
  const supportWorkerIndex = requests.findIndex(function (request) {
    return request.role === "worker" && request.operation === "empire_support";
  });

  assert(localWorkerIndex !== -1, `expected donor local construction worker request, got ${JSON.stringify(requests)}`);
  assert(supportWorkerIndex !== -1, `expected donor support worker request, got ${JSON.stringify(requests)}`);
  assert(
    localWorkerIndex < supportWorkerIndex,
    `expected local construction worker to outrank support worker, got local ${localWorkerIndex} support ${supportWorkerIndex} requests ${JSON.stringify(requests)}`,
  );
}

function runEmpireAwarenessScenario() {
  const roomA = buildRoomScenario("VAL_EMPIRE_A", {
    tick: 850,
    controllerLevel: 3,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    creeps: [
      { name: "empireWorkerA", role: "worker", x: 24, y: 25 },
    ],
  });
  roomA.controller.my = true;

  const roomB = new FakeRoom("VAL_EMPIRE_B", new FakeTerrain());
  roomB.setController(
    createController(20, 20, {
      roomName: roomB.name,
      level: 2,
      progress: 100,
    }),
  );
  roomB.controller.my = true;
  roomB.addStructure(
    createStructure(STRUCTURE_SPAWN, 25, 25, {
      roomName: roomB.name,
      name: "SpawnB",
      store: { energy: 300 },
      storeCapacityResource: { energy: 300 },
      hits: 5000,
      hitsMax: 5000,
    }),
  );
  roomB.addSource(createSource(15, 25, { roomName: roomB.name }));
  roomB.addMineral(createMineral(35, 20, { roomName: roomB.name }));
  roomB.energyAvailable = 300;
  roomB.energyCapacityAvailable = 300;
  createCreep("empireWorkerB", "worker", 25, 24, {
    roomName: roomB.name,
  });

  Game.gcl = {
    level: 3,
    progress: 1500,
    progressTotal: 3000,
  };

  const ownedRooms = empireManager.collectOwnedRooms();
  assert(
    ownedRooms.length === 2,
    `expected two owned rooms, got ${ownedRooms.map((room) => room.name).join(",") || "none"}`,
  );
  assert(
    ownedRooms[0].name === "VAL_EMPIRE_A" && ownedRooms[1].name === "VAL_EMPIRE_B",
    `expected sorted owned rooms, got ${ownedRooms.map((room) => room.name).join(",")}`,
  );

  const states = {
    VAL_EMPIRE_A: roomState.collect(roomA),
    VAL_EMPIRE_B: roomState.collect(roomB),
  };
  const memory = empireManager.record(ownedRooms, states);

  assert(memory.ownedRooms.length === 2, "empire memory should list owned rooms");
  assert(memory.gcl.roomSlotsUsed === 2, `expected two used room slots, got ${memory.gcl.roomSlotsUsed}`);
  assert(memory.gcl.roomSlotsLimit === 3, `expected GCL room limit 3, got ${memory.gcl.roomSlotsLimit}`);
  assert(memory.gcl.roomSlotsAvailable === 1, `expected one open room slot, got ${memory.gcl.roomSlotsAvailable}`);
  assert(memory.rooms.VAL_EMPIRE_A.creepCount === 1, "room A snapshot should count home creeps");
  assert(memory.rooms.VAL_EMPIRE_B.rcl === 2, `room B snapshot should record RCL2, got ${memory.rooms.VAL_EMPIRE_B.rcl}`);

  const reports = empireManager.buildRoomReports(ownedRooms, states, {
    updateProgress: false,
  });
  const report = empireManager.buildReport(reports);

  assert(report.summary.roomCount === 2, `expected empire report room count 2, got ${report.summary.roomCount}`);
  assert(report.summary.gcl.roomSlotsAvailable === 1, "empire report should expose open GCL slot");
  assert(
    report.lines.some(function (line) {
      return line.indexOf("Rooms: 2/3") !== -1;
    }),
    `expected empire lines to include slot summary, got ${report.lines.join(" / ")}`,
  );
}

function runRoomReviewSchedulerScenario() {
  const roomA = buildRoomScenario("VAL_REVIEW_A", {
    tick: 1000,
    controllerLevel: 4,
    spawnEnergy: 300,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 500 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
  });
  roomA.controller.my = true;
  const roomB = new FakeRoom("VAL_REVIEW_B", new FakeTerrain());
  roomB.setController(createController(20, 20, { roomName: roomB.name, level: 4, my: true, owner: { username: "tester" } }));
  roomB.addStructure(createStructure(STRUCTURE_SPAWN, 25, 25, {
    roomName: roomB.name,
    name: "SpawnB",
    hits: 5000,
    hitsMax: 5000,
    store: { energy: 300 },
    storeCapacityResource: { energy: 300 },
  }));
  roomB.addSource(createSource(15, 25, { roomName: roomB.name }));
  roomB.addMineral(createMineral(40, 10, { roomName: roomB.name }));
  roomB.addStructure(createStructure(STRUCTURE_STORAGE, 24, 29, { roomName: roomB.name, store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 }));
  roomB.addStructure(createStructure(STRUCTURE_TOWER, 22, 24, { roomName: roomB.name, store: { energy: 500 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 }));
  roomB.energyAvailable = 800;
  roomB.energyCapacityAvailable = 800;
  roomB.controller.my = true;

  Memory.rooms[roomA.name] = { roomFocus: "legacy" };
  Memory.rooms[roomB.name] = { roomFocus: "legacy" };
  const ownedRooms = [roomA, roomB];
  const states = {
    [roomA.name]: roomState.collect(roomA),
    [roomB.name]: roomState.collect(roomB),
  };

  let summary = kernelMemory.reviewOwnedRooms(ownedRooms, states);
  assert(summary.reviewed.length === 1, `expected one reviewed room, got ${JSON.stringify(summary)}`);
  assert(summary.reviewed[0].room === roomA.name, `expected first review room A, got ${summary.reviewed[0].room}`);
  assert(!Object.prototype.hasOwnProperty.call(Memory.rooms[roomA.name], "roomFocus"), "review should remove room A legacy focus");
  assert(Object.prototype.hasOwnProperty.call(Memory.rooms[roomB.name], "roomFocus"), "room B should wait for its turn");

  Game.time = 1100;
  summary = kernelMemory.reviewOwnedRooms(ownedRooms, states);
  assert(summary.tick === 1000, "review should keep previous summary before interval elapses");

  Game.time = 1500;
  summary = kernelMemory.reviewOwnedRooms(ownedRooms, states);
  assert(summary.reviewed[0].room === roomB.name, `expected second room B at next interval, got ${JSON.stringify(summary)}`);

  Game.time = 2000;
  summary = kernelMemory.reviewOwnedRooms(ownedRooms, states);
  assert(summary.skipped === "cooldown", `expected cooldown skip, got ${JSON.stringify(summary)}`);

  Game.time = 6501;
  summary = kernelMemory.reviewOwnedRooms(ownedRooms, states);
  assert(summary.reviewed[0].room === roomA.name, `expected room A after cooldown, got ${JSON.stringify(summary)}`);
  assert(!Object.prototype.hasOwnProperty.call(Memory.rooms[roomB.name], "roomFocus"), "review should remove room B legacy focus");
}

function runRoomReviewBucketSkipScenario() {
  const room = buildRoomScenario("VAL_REVIEW_BUCKET", {
    tick: 2000,
    controllerLevel: 4,
    spawnEnergy: 300,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
  });
  room.controller.my = true;
  Memory.rooms[room.name] = { roomFocus: "legacy" };
  Game.cpu.bucket = 1000;

  const summary = kernelMemory.reviewOwnedRooms([room], { [room.name]: roomState.collect(room) });
  assert(summary.skipped === "bucket", `expected bucket skip, got ${JSON.stringify(summary)}`);
  assert(Object.prototype.hasOwnProperty.call(Memory.rooms[room.name], "roomFocus"), "bucket skip should not mutate room memory");
}

function runRoomReviewRecoveryCleanupScenario() {
  const room = buildRoomScenario("VAL_REVIEW_RECOVERY", {
    tick: 3000,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 500 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
  });
  room.controller.my = true;
  Memory.rooms[room.name] = {
    defense: {
      recovery: { active: true, eligible: true, reason: "post_attack", startedAt: 2000, lastThreatSeen: 2000 },
      spawnLocks: { defender: { lastQueued: 2990 } },
      support: { stale: true },
    },
  };

  const summary = kernelMemory.reviewOwnedRooms([room], { [room.name]: roomState.collect(room) });
  assert(summary.reviewed[0].changed.indexOf("defense.recovery") !== -1, `expected recovery cleanup, got ${JSON.stringify(summary)}`);
  assert(!Memory.rooms[room.name].defense, `expected empty defense memory to be removed, got ${JSON.stringify(Memory.rooms[room.name].defense)}`);
}

function runRoomReviewHostilePreservesDefenseScenario() {
  const room = buildRoomScenario("VAL_REVIEW_HOSTILE", {
    tick: 3100,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    extraStructures: [
      { type: STRUCTURE_TOWER, x: 22, y: 24, options: { store: { energy: 500 }, storeCapacityResource: { energy: 1000 }, hits: 3000, hitsMax: 3000 } },
    ],
    hostiles: [{ name: "reviewHostile", x: 23, y: 24, body: [{ type: ATTACK }, { type: MOVE }] }],
  });
  room.controller.my = true;
  Memory.rooms[room.name] = {
    defense: {
      recovery: { active: true, eligible: true, reason: "post_attack", startedAt: 3000, lastThreatSeen: 3000 },
    },
  };

  kernelMemory.reviewOwnedRooms([room], { [room.name]: roomState.collect(room) });
  assert(
    Memory.rooms[room.name].defense && Memory.rooms[room.name].defense.recovery,
    "review should preserve defense recovery while hostiles are visible",
  );
}

function runRoomReviewSpawnQueueScenario() {
  const room = buildRoomScenario("VAL_REVIEW_QUEUE", {
    tick: 3200,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
  });
  room.controller.my = true;
  const sourceId = room.find(FIND_SOURCES)[0].id;
  Memory.rooms[room.name] = {
    spawnQueue: [
      { role: "miner", sourceId: sourceId },
      { role: "hauler", sourceId: "missing_source" },
      { role: "worker", operation: "empire_support", homeRoom: room.name, targetRoom: "W9N9" },
    ],
  };

  kernelMemory.reviewOwnedRooms([room], { [room.name]: roomState.collect(room) });
  const queue = Memory.rooms[room.name].spawnQueue;
  assert(queue.length === 2, `expected invalid queue entry to be removed, got ${JSON.stringify(queue)}`);
  assert(queue.some(function (request) { return request.operation === "empire_support"; }), "review should preserve empire support queue entries");
}

function runRoomReviewConstructionAdvancedScenario() {
  const room = buildRoomScenario("VAL_REVIEW_ADVANCED", {
    tick: 3300,
    controllerLevel: 6,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    extraStructures: [
      { type: STRUCTURE_STORAGE, x: 24, y: 29, options: { store: { energy: 50000 }, storeCapacity: 1000000, hits: 10000, hitsMax: 10000 } },
    ],
  });
  room.controller.my = true;
  const state = roomState.collect(room);
  Memory.rooms[room.name] = {
    construction: {
      futurePlan: { roadmapPhase: "obsolete_phase", signature: "old" },
      lastAdvancedPlan: 1000,
    },
    advancedOps: {
      task: { label: "lab_input", pickupId: "missing_pickup", deliveryId: "missing_delivery", resourceType: "H", amount: 100 },
      summary: { labId: "missing_lab" },
    },
  };

  kernelMemory.reviewOwnedRooms([room], { [room.name]: state });
  assert(!Memory.rooms[room.name].construction, "review should clear obsolete construction future plan cache");
  assert(!Memory.rooms[room.name].advancedOps, "review should clear invalid advanced task memory");
}

function runRoomReviewEmpireReportScenario() {
  const room = buildRoomScenario("VAL_REVIEW_REPORT", {
    tick: 3400,
    controllerLevel: 4,
    spawnEnergy: 300,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
  });
  room.controller.my = true;
  Memory.rooms[room.name] = { roomFocus: "legacy" };
  const state = roomState.collect(room);

  kernelMemory.reviewOwnedRooms([room], { [room.name]: state });
  empireManager.record([room], { [room.name]: state });
  const report = empireManager.buildReport(empireManager.buildRoomReports([room], { [room.name]: state }, { updateProgress: false }));
  assert(
    report.lines.some(function (line) { return line.indexOf("Review:") !== -1 && line.indexOf(room.name) !== -1; }),
    `expected empire report review summary, got ${report.lines.join(" / ")}`,
  );
}

function runExpansionClaimRequestScenario() {
  const parent = buildRoomScenario("VAL_EXPAND_PARENT", {
    tick: 875,
    controllerLevel: 4,
    spawnEnergy: 800,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "parentWorker", role: "worker", x: 24, y: 25 },
      { name: "parentMiner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "parentMiner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "parentHauler", role: "hauler", x: 26, y: 25 },
      { name: "parentUpgrader", role: "upgrader", x: 25, y: 24 },
    ],
  });
  parent.controller.my = true;
  addRcl4StableStructures(parent);

  const target = new FakeRoom("VAL_EXPAND_TARGET", new FakeTerrain());
  target.setController(
    createController(20, 20, {
      roomName: target.name,
      level: 0,
    }),
  );
  target.addSource(createSource(15, 25, { roomName: target.name }));
  target.addMineral(createMineral(35, 20, { roomName: target.name }));

  Game.gcl = {
    level: 2,
    progress: 0,
    progressTotal: 1000,
  };

  const result = empireManager.createExpansion(target.name, parent.name);
  assert(result.ok, `expected expansion plan to be created, got ${result.message}`);
  empireManager.getActiveExpansion(target.name).focus = "legacy";
  kernelMemory.reviewOwnedRooms([parent], { [parent.name]: roomState.collect(parent) });
  assert(
    !Object.prototype.hasOwnProperty.call(empireManager.getActiveExpansion(target.name), "focus"),
    "legacy expansion focus should be removed by scheduled memory review",
  );

  const empireReport = empireManager.buildReport();
  assert(
    empireReport.lines.some(function (line) {
      return line.indexOf("expansion VA") !== -1 &&
        line.indexOf("Claim controller") !== -1;
    }),
    `expected empire report to group expansion under parent without focus, got ${empireReport.lines.join(" / ")}`,
  );
  let lines = empireManager.getExpansionLines();
  assert(
    lines.some(function (line) {
      return line.indexOf(target.name) !== -1 && line.indexOf("parent " + parent.name) !== -1;
    }),
    `expected expansion report to show parent without focus, got ${lines.join(" / ")}`,
  );
  assert(!lines.some(function (line) { return line.indexOf("focus") !== -1; }), `expected no expansion focus output, got ${lines.join(" / ")}`);

  const state = roomState.collect(parent);
  const requests = spawnManager.getSpawnRequests(parent, state);
  const claimRequest = requests.find(function (request) {
    return request.role === "claimer" && request.targetRoom === target.name;
  });

  assert(claimRequest, "active expansion should request a claimer from the parent room");
  assert(claimRequest.homeRoom === parent.name, "claimer request should keep parent as home room");
  assert(claimRequest.operation === "expansion", "claimer request should be marked as expansion work");
}

function runExpansionFullConstructionScenario() {
  const room = buildRoomScenario("VAL_FOCUS_ROOM", {
    tick: 890,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
  });
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  Memory.empire = { expansion: { plans: {} } };
  Memory.empire.expansion.plans[room.name] = {
    targetRoom: room.name,
    parentRoom: "VAL_PARENT",
    focus: "legacy",
    createdAt: Game.time,
  };
  if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
  Memory.rooms[room.name].roomFocus = "legacy";
  Memory.rooms[room.name].roomFocusMigratedAt = Game.time - 10;
  Memory.rooms[room.name].roomFocusUpdatedAt = Game.time - 5;

  let state = roomState.collect(room);
  state.phase = "command";
  let status = constructionStatus.getStatus(room, state);
  assert(status.towersNeeded > 2, `expansion should keep normal tower max, got ${status.towersNeeded}`);
  assert(status.labsNeeded === 10, `expansion should keep full labs, got ${status.labsNeeded}`);
  assert(status.factoryNeeded === 1, `expansion should keep factory, got ${status.factoryNeeded}`);
  assert(status.terminalNeeded === 1, `expansion should keep terminal, got ${status.terminalNeeded}`);
  assert(status.extractorNeeded === 1, `expansion should keep extractor, got ${status.extractorNeeded}`);
  assert(status.mineralContainersNeeded === 1, `expansion should keep mineral container, got ${status.mineralContainersNeeded}`);
  kernelMemory.reviewOwnedRooms([room], { [room.name]: state });
  assert(
    !Object.prototype.hasOwnProperty.call(empireManager.getActiveExpansion(room.name), "focus"),
    "legacy expansion plan focus should be deleted by scheduled memory review",
  );
  empireManager.record([room], { [room.name]: state });
  assert(
    !Object.prototype.hasOwnProperty.call(Memory.rooms[room.name], "roomFocus") &&
      !Object.prototype.hasOwnProperty.call(Memory.rooms[room.name], "roomFocusMigratedAt") &&
      !Object.prototype.hasOwnProperty.call(Memory.rooms[room.name], "roomFocusUpdatedAt"),
    `legacy room focus memory should be deleted, got ${JSON.stringify(Memory.rooms[room.name])}`,
  );

  const report = roomReporting.build(room, state, { updateProgress: false });
  assert(
    report.hudLines.some(function (line) {
      return line.indexOf("Expansion | Independent") !== -1;
    }),
    `expected room HUD to show expansion context without focus, got ${JSON.stringify(report.hudLines)}`,
  );
  assert(
    !report.hudLines.some(function (line) { return line.indexOf("focus") !== -1 || line.indexOf("Focus") !== -1; }),
    `expected room HUD to omit focus labels, got ${JSON.stringify(report.hudLines)}`,
  );
  assert(
    report.hudLines[0].indexOf("RCL") === -1 &&
      report.hudLines[1].indexOf("RCL") === 0 &&
      report.hudLines[1].indexOf("ETA") !== -1,
    `expected expansion room HUD to put RCL/ETA on second line, got ${JSON.stringify(report.hudLines)}`,
  );
}

function runFocusRemovedOpsScenario() {
  const room = buildRoomScenario("W4N4", {
    tick: 982,
    controllerLevel: 4,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "roleWorker", role: "worker", x: 24, y: 25 },
    ],
  });
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  addRcl4StableStructures(room);
  if (!Memory.rooms) Memory.rooms = {};
  if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
  Memory.rooms[room.name].roomFocus = "legacy";
  Memory.rooms[room.name].roomFocusMigratedAt = Game.time - 10;
  Memory.rooms[room.name].roomFocusUpdatedAt = Game.time - 5;

  ops.registerGlobals();
  global.ops.room(room.name, "overview");
  assert(typeof global.ops.roomRole === "undefined", "ops.roomRole should no longer be registered");
  kernelMemory.reviewOwnedRooms([room], { [room.name]: roomState.collect(room) });
  assert(
    !Object.prototype.hasOwnProperty.call(Memory.rooms[room.name], "roomFocus") &&
      !Object.prototype.hasOwnProperty.call(Memory.rooms[room.name], "roomFocusMigratedAt") &&
      !Object.prototype.hasOwnProperty.call(Memory.rooms[room.name], "roomFocusUpdatedAt"),
    "scheduled review should remove legacy owned room focus memory",
  );

  const parent = buildStableReservationParent("W4N5", 983);
  const remote = buildNeutralReserveRoom("W4N6");
  const reserve = reservationManager.createReservation(remote.name, parent.name);
  assert(reserve.ok, `expected reservation setup, got ${reserve.message}`);
  reservationManager.getActiveReservation(remote.name).focus = "hold";
  kernelMemory.reviewOwnedRooms([parent], { [parent.name]: roomState.collect(parent) });
  assert(
    !Object.prototype.hasOwnProperty.call(reservationManager.getActiveReservation(remote.name), "focus"),
    "legacy reservation focus should be removed by scheduled memory review",
  );

  const target = new FakeRoom("W4N7", new FakeTerrain());
  target.setController(
    createController(20, 20, {
      roomName: target.name,
      level: 1,
      my: true,
      owner: { username: "tester" },
    }),
  );
  target.addSource(createSource(15, 25, { roomName: target.name }));
  target.addMineral(createMineral(35, 20, { roomName: target.name }));
  const expansion = empireManager.createExpansion(target.name, parent.name);
  assert(expansion.ok, `expected expansion setup, got ${expansion.message}`);
  const oldExpansionFocusResult = global.ops.expand(target.name, "mineral");
  assert(
    !oldExpansionFocusResult.ok && oldExpansionFocusResult.message.indexOf("Parent room mineral") !== -1,
    `expected old expansion focus argument to be treated as invalid parent, got ${JSON.stringify(oldExpansionFocusResult)}`,
  );
  empireManager.getActiveExpansion(target.name).focus = "mineral";
  Game.time += 500;
  kernelMemory.reviewOwnedRooms([parent], { [parent.name]: roomState.collect(parent) });
  assert(
    !Object.prototype.hasOwnProperty.call(empireManager.getActiveExpansion(target.name), "focus"),
    "legacy expansion focus should be removed by scheduled memory review",
  );
}

function runExpansionIndependenceScenario() {
  const parent = buildStableReservationParent("W3N3", 984);
  const target = new FakeRoom("W3N4", new FakeTerrain());
  target.setController(
    createController(20, 20, {
      roomName: target.name,
      level: 4,
      my: true,
      owner: { username: "tester" },
    }),
  );
  target.addStructure(
    createStructure(STRUCTURE_SPAWN, 25, 25, {
      roomName: target.name,
      name: "ExpansionSpawn",
      store: { energy: 300 },
      storeCapacityResource: { energy: 300 },
      hits: 5000,
      hitsMax: 5000,
    }),
  );
  target.addSource(createSource(15, 25, { roomName: target.name }));
  target.addSource(createSource(35, 25, { roomName: target.name }));
  target.addMineral(createMineral(35, 20, { roomName: target.name }));
  target.energyAvailable = 800;
  target.energyCapacityAvailable = 800;
  createCreep("independentWorker", "worker", 24, 25, {
    roomName: target.name,
    memory: {
      role: "worker",
      room: target.name,
      homeRoom: target.name,
    },
  });
  if (!Memory.rooms[parent.name]) Memory.rooms[parent.name] = {};
  const expansion = empireManager.createExpansion(target.name, parent.name);
  assert(expansion.ok, `expected expansion setup, got ${expansion.message}`);
  assert(empireManager.getActiveExpansion(target.name).parentRoom === null, "self-hosted expansion should detach from parent");

  let parentState = roomState.collect(parent);
  let requests = spawnManager.getSpawnRequests(parent, parentState);
  assert(
    !requests.some(function (request) {
      return request.role === "pioneer" && request.targetRoom === target.name;
    }),
    `healthy spawned expansion should not request parent pioneers, got ${JSON.stringify(requests)}`,
  );

  const plan = empireManager.getActiveExpansion(target.name);
  assert(plan && plan.parentRoom === null, `self-hosted expansion should remain independent, got ${JSON.stringify(plan)}`);
  assert(!Object.prototype.hasOwnProperty.call(plan, "focus"), "self-hosted expansion should not store focus");

  const report = empireManager.buildReport();
  assert(
    !report.lines.some(function (line) { return line.indexOf(`expansion ${target.name}`) !== -1; }),
    `independent expansion should not render as child row, got ${report.lines.join(" / ")}`,
  );

  const targetWorkers = target.find(FIND_MY_CREEPS).filter(function (creep) {
    return creep.memory && (creep.memory.role === "worker" || creep.memory.role === "jrworker");
  });
  for (let i = 0; i < targetWorkers.length; i++) {
    delete Game.creeps[targetWorkers[i].name];
    delete currentRuntime.objectsById[targetWorkers[i].id];
  }

  const targetHaulers = target.find(FIND_MY_CREEPS).filter(function (creep) {
    return creep.memory && creep.memory.role === "hauler";
  });
  for (let j = 0; j < targetHaulers.length; j++) {
    delete Game.creeps[targetHaulers[j].name];
    delete currentRuntime.objectsById[targetHaulers[j].id];
  }

  target.energyAvailable = 0;
  target.controller.my = true;
  target.controller.owner = { username: "tester" };
  if (Game.rooms[target.name]) {
    Game.rooms[target.name].energyAvailable = 0;
    Game.rooms[target.name].controller.my = true;
    Game.rooms[target.name].controller.owner = { username: "tester" };
  }

  parentState = roomState.collect(parent);
  requests = spawnManager.getSpawnRequests(parent, parentState);
  assert(empireManager.getActiveExpansion(target.name).parentRoom === parent.name, "collapsed independent expansion should reattach to a parent");
  assert(
    requests.some(function (request) {
      return request.role === "pioneer" && request.targetRoom === target.name;
    }),
    `collapsed spawned expansion should request parent pioneers, got ${JSON.stringify(requests)}`,
  );
}

function runExpansionPioneerRequestScenario() {
  const parent = buildRoomScenario("VAL_BOOT_PARENT", {
    tick: 900,
    controllerLevel: 4,
    spawnEnergy: 800,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "bootParentWorker", role: "worker", x: 24, y: 25 },
      { name: "bootParentMiner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "bootParentMiner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "bootParentHauler", role: "hauler", x: 26, y: 25 },
      { name: "bootParentUpgrader", role: "upgrader", x: 25, y: 24 },
    ],
  });
  parent.controller.my = true;
  addRcl4StableStructures(parent);

  const target = new FakeRoom("VAL_BOOT_TARGET", new FakeTerrain());
  target.setController(
    createController(20, 20, {
      roomName: target.name,
      level: 1,
      progress: 250,
      my: true,
      owner: { username: "tester" },
    }),
  );
  target.controller.progressTotal = 1000;
  target.addSource(createSource(15, 25, { roomName: target.name }));
  target.addMineral(createMineral(35, 20, { roomName: target.name }));

  Game.gcl = {
    level: 3,
    progress: 0,
    progressTotal: 1000,
  };

  const result = empireManager.createExpansion(target.name, parent.name);
  assert(result.ok, `expected expansion plan to be created, got ${result.message}`);

  if (!Memory.rooms) Memory.rooms = {};
  if (!Memory.rooms[target.name]) Memory.rooms[target.name] = {};
  Memory.rooms[target.name].progressTracker = {
    lastTick: Game.time,
    lastProgress: target.controller.progress,
    rate: 10,
    etaTicks: 75,
  };
  const empireReport = empireManager.buildReport();
  assert(
    empireReport.lines.some(function (line) {
      return line.indexOf("expansion VA") !== -1 &&
        line.indexOf("RCL 1 25%") !== -1 &&
        line.indexOf("ETA 0d 0h 3m") !== -1;
    }),
    `expected expansion row to include RCL progress and ETA, got ${empireReport.lines.join(" / ")}`,
  );

  const state = roomState.collect(parent);
  const requests = spawnManager.getSpawnRequests(parent, state);
  const pioneers = requests.filter(function (request) {
    return request.role === "pioneer" && request.targetRoom === target.name;
  });

  assert(pioneers.length >= 2, `expected pioneer requests for spawnless owned target, got ${pioneers.length}`);
}

function runExpansionClaimerRoleScenario() {
  const room = buildRoomScenario("VAL_CLAIMER_TARGET", {
    tick: 925,
    controllerLevel: 1,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
  });
  room.controller.my = false;
  room.controller.owner = null;

  const claimer = createCreep("claimer1", "claimer", room.controller.pos.x + 1, room.controller.pos.y, {
    roomName: room.name,
    body: [{ type: CLAIM }, { type: MOVE }],
    memory: {
      role: "claimer",
      room: "VAL_CLAIMER_PARENT",
      homeRoom: "VAL_CLAIMER_PARENT",
      targetRoom: room.name,
    },
  });

  roleClaimer.run(claimer);

  assert(room.controller.my === true, "claimer should claim the target controller when adjacent");
}

function runExpansionPioneerSpawnSiteScenario() {
  const room = buildRoomScenario("VAL_PIONEER_TARGET", {
    tick: 950,
    controllerLevel: 1,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
  });
  room.controller.my = true;

  const spawns = room.find(FIND_MY_SPAWNS);
  for (let i = 0; i < spawns.length; i++) {
    spawns[i].destroy();
  }

  const pioneer = createCreep("pioneer1", "pioneer", 25, 25, {
    roomName: room.name,
    store: { energy: 50 },
    storeCapacity: 50,
    memory: {
      role: "pioneer",
      room: "VAL_PIONEER_PARENT",
      homeRoom: "VAL_PIONEER_PARENT",
      targetRoom: room.name,
      working: true,
    },
  });

  rolePioneer.run(pioneer);

  const spawnSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter: function (site) {
      return site.structureType === STRUCTURE_SPAWN;
    },
  });

  assert(spawnSites.length === 1, `expected pioneer to place first spawn site, got ${spawnSites.length}`);
}

function runExpansionHudLabelsScenario() {
  const room = buildRoomScenario("VAL_EXPANSION_HUD", {
    tick: 975,
    controllerLevel: 1,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
  });
  room.controller.my = true;

  createCreep("hudClaimer", "claimer", 24, 25, {
    roomName: room.name,
    memory: {
      role: "claimer",
      room: "VAL_HUD_PARENT",
      homeRoom: "VAL_HUD_PARENT",
      targetRoom: room.name,
    },
  });
  createCreep("hudPioneer", "pioneer", 26, 25, {
    roomName: room.name,
    memory: {
      role: "pioneer",
      room: "VAL_HUD_PARENT",
      homeRoom: "VAL_HUD_PARENT",
      targetRoom: room.name,
    },
  });

  hud.drawCreepLabels(room, {
    creeps: room.find(FIND_MY_CREEPS),
    homeCreeps: [],
  });

  const labels = currentRuntime.visuals
    .filter(function (item) {
      return item.type === "text";
    })
    .map(function (item) {
      return item.text;
    });

  assert(labels.indexOf("Cl") !== -1, `expected claimer HUD label, got ${labels.join(",")}`);
  assert(labels.indexOf("Pi") !== -1, `expected pioneer HUD label, got ${labels.join(",")}`);
}

function buildStableReservationParent(name, tick) {
  const parent = buildRoomScenario(name, {
    tick: tick,
    controllerLevel: 4,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: `${name}_worker`, role: "worker", x: 24, y: 25 },
      { name: `${name}_miner1`, role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: `${name}_miner2`, role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: `${name}_hauler`, role: "hauler", x: 25, y: 24 },
      { name: `${name}_upgrader`, role: "upgrader", x: 26, y: 25 },
    ],
  });
  parent.controller.my = true;
  parent.controller.owner = { username: "tester" };
  addRcl4StableStructures(parent);
  return parent;
}

function buildNeutralReserveRoom(name, options) {
  const settings = options || {};
  const room = new FakeRoom(name, new FakeTerrain());
  room.setController(
    createController(settings.controllerX || 20, settings.controllerY || 20, {
      roomName: name,
      level: 0,
      reservation: settings.reservation || null,
    }),
  );
  room.addSource(createSource(settings.sourceAX || 15, settings.sourceAY || 25, { roomName: name }));
  if (settings.sourceCount !== 1) {
    room.addSource(createSource(settings.sourceBX || 35, settings.sourceBY || 25, { roomName: name }));
  }
  room.addMineral(createMineral(35, 20, { roomName: name }));

  if (settings.sourceContainers) {
    addContainersForSources(room, room.find(FIND_SOURCES));
  }

  if (settings.hostiles) {
    for (let i = 0; i < settings.hostiles.length; i++) {
      const spec = settings.hostiles[i];
      const hostile = createCreep(spec.name || `reserveHostile${i + 1}`, "hostile", spec.x, spec.y, {
        roomName: name,
        my: false,
        body: spec.body || [{ type: ATTACK }, { type: MOVE }],
      });
      hostile.owner = { username: spec.username || "Invader" };
      room._hostileCreeps.push(hostile);
    }
  }

  return room;
}

function runReservationOpsScenario() {
  const parent = buildStableReservationParent("W5N5", 1000);
  buildNeutralReserveRoom("W5N6");

  ops.registerGlobals();
  const missingParent = global.ops.reserve("W5N6");
  assert(missingParent && missingParent.ok === false, "reserve without current room should error when parent omitted");

  global.ops.room(parent.name, "overview");
  const result = global.ops.reserve("W5N6");
  assert(result.ok, `expected reserve plan through current room, got ${result.message}`);
  reservationManager.getActiveReservation("W5N6").focus = "legacy";
  delete reservationManager.getActiveReservation("W5N6").operation;
  reservationManager.getActiveReservation("W5N6");
  kernelMemory.reviewOwnedRooms([parent], { [parent.name]: roomState.collect(parent) });
  assert(
    !Object.prototype.hasOwnProperty.call(reservationManager.getActiveReservation("W5N6"), "focus") &&
      reservationManager.getActiveReservation("W5N6").operation === "reservation",
    "scheduled review should delete legacy reservation focus and defaults should backfill operation marker",
  );

  const lines = global.ops.reserved(parent.name);
  assert(
    lines.some(function (line) { return line.indexOf("W5N6") !== -1; }),
    `expected reserved report to list W5N6, got ${lines.join(" / ")}`,
  );
  assert(
    !lines.some(function (line) { return line.indexOf("full") !== -1 || line.indexOf("hold") !== -1; }),
    `expected reserved report to omit focus labels, got ${lines.join(" / ")}`,
  );

  Memory.rooms[parent.name].spawnQueue = [
    { role: "remoteworker", targetRoom: "W5N6", operation: "reservation" },
    { role: "remoteminer", targetRoom: "W5N6", operation: "reservation" },
    { role: "remotehauler", targetRoom: "W5N6", operation: "reservation" },
    { role: "reserver", targetRoom: "W5N6", operation: "reservation" },
    { role: "defender", targetRoom: "W5N6", operation: "reservation_defense" },
  ];
  const oldFocusResult = global.ops.reserve("W5N6", "hold");
  assert(
    !oldFocusResult.ok && oldFocusResult.message.indexOf("Parent room hold") !== -1,
    `expected old hold argument to be treated as invalid parent, got ${JSON.stringify(oldFocusResult)}`,
  );
  assert(Memory.rooms[parent.name].spawnQueue.length === 5, "old focus argument should not prune remote economy queue");
  const parentResult = global.ops.reserve("W5N6", parent.name);
  assert(parentResult.ok, `expected reservation update with parent argument, got ${parentResult.message}`);
  assert(
    !Object.prototype.hasOwnProperty.call(reservationManager.getActiveReservation("W5N6"), "focus"),
    "reservation update should not store focus",
  );

  const empireReport = global.ops.empire();
  assert(
    empireReport.lines.some(function (line) { return line.indexOf("Rooms: 1/") !== -1; }),
    `expected empire report summary line, got ${empireReport.lines.join(" / ")}`,
  );
  assert(
    empireReport.lines.some(function (line) { return line.indexOf("GCL") !== -1 && line.indexOf("Phases:") !== -1; }),
    `expected empire report to include GCL and phase detail, got ${empireReport.lines.join(" / ")}`,
  );
  assert(
    empireReport.lines.some(function (line) { return line.indexOf("reserved W5N6") !== -1; }),
    `expected empire report to group reserved room under parent, got ${empireReport.lines.join(" / ")}`,
  );
  assert(
    !empireReport.lines.some(function (line) { return line.indexOf("reserved:hold") !== -1 || line.indexOf(" hold ") !== -1 || line.indexOf(" full ") !== -1; }),
    `expected empire report to omit reservation focus labels, got ${empireReport.lines.join(" / ")}`,
  );
  assert(
    !empireReport.lines.some(function (line) { return line === "[OPS][EMPIRE][RESERVED]"; }),
    `expected empire report to remove the separate reserved block, got ${empireReport.lines.join(" / ")}`,
  );

  const fallbackParent = new FakeRoom("W5N4", new FakeTerrain());
  fallbackParent.setController(
    createController(20, 20, {
      roomName: fallbackParent.name,
      level: 4,
    }),
  );
  fallbackParent.controller.my = true;
  fallbackParent.controller.owner = { username: "tester" };
  fallbackParent.addStructure(
    createStructure(STRUCTURE_SPAWN, 25, 25, {
      roomName: fallbackParent.name,
      name: "FallbackSpawn",
      store: { energy: 300 },
      storeCapacityResource: { energy: 300 },
      hits: 5000,
      hitsMax: 5000,
    }),
  );
  fallbackParent.addSource(createSource(15, 25, { roomName: fallbackParent.name }));
  fallbackParent.addMineral(createMineral(35, 20, { roomName: fallbackParent.name }));
  fallbackParent.energyAvailable = 300;
  fallbackParent.energyCapacityAvailable = 300;
  delete Game.rooms[parent.name];
  const adoptedEmpireReport = global.ops.empire();
  assert(
    adoptedEmpireReport.lines.some(function (line) { return line.indexOf("W5N4") !== -1; }) &&
      adoptedEmpireReport.lines.some(function (line) { return line.indexOf("reserved W5N6") !== -1; }) &&
      !adoptedEmpireReport.lines.some(function (line) { return line === "Unattached"; }),
    `expected reserved room to be adopted by nearby parent, got ${adoptedEmpireReport.lines.join(" / ")}`,
  );
  assert(
    reservationManager.getActiveReservation("W5N6").parentRoom === "W5N4",
    "reserved room should update its parent after adoption",
  );

  const strandedParent = new FakeRoom("W9N5", new FakeTerrain());
  strandedParent.setController(
    createController(20, 20, {
      roomName: strandedParent.name,
      level: 4,
    }),
  );
  strandedParent.controller.my = true;
  strandedParent.controller.owner = { username: "tester" };
  strandedParent.addStructure(
    createStructure(STRUCTURE_SPAWN, 25, 25, {
      roomName: strandedParent.name,
      name: "StrandedSpawn",
      store: { energy: 300 },
      storeCapacityResource: { energy: 300 },
      hits: 5000,
      hitsMax: 5000,
    }),
  );
  strandedParent.addSource(createSource(15, 25, { roomName: strandedParent.name }));
  strandedParent.addMineral(createMineral(35, 20, { roomName: strandedParent.name }));
  strandedParent.energyAvailable = 300;
  strandedParent.energyCapacityAvailable = 300;
  buildNeutralReserveRoom("W9N6");
  const strandedResult = reservationManager.createReservation("W9N6", strandedParent.name);
  assert(strandedResult.ok, `expected stranded reservation setup, got ${strandedResult.message}`);
  delete Game.rooms[strandedParent.name];
  reservationManager.getReservedLines();
  assert(
    !reservationManager.getActiveReservation("W9N6"),
    "reserved room should auto-cancel when no nearby parent can support it",
  );
  assert(
    Memory.empire.reservation.plans.W9N6.cancelReason === "no_parent_in_range",
    `expected no_parent_in_range cancel reason, got ${Memory.empire.reservation.plans.W9N6.cancelReason}`,
  );
}

function runReservedRoomHudScenario() {
  const parent = buildStableReservationParent("W5N5", 1010);
  const remote = buildNeutralReserveRoom("W5N6", {
    reservation: { username: "tester", ticksToEnd: 3200 },
    sourceContainers: true,
  });
  const sources = remote.find(FIND_SOURCES);
  if (sources.length > 1) {
    const containers = remote.find(FIND_STRUCTURES, {
      filter: function (structure) {
        return structure.structureType === STRUCTURE_CONTAINER &&
          structure.pos.getRangeTo(sources[1]) <= 1;
      },
    });
    for (let i = 0; i < containers.length; i++) {
      containers[i].destroy();
    }
  }
  createCreep("hudRemoteMiner", "remoteminer", 15, 24, {
    roomName: remote.name,
    memory: {
      role: "remoteminer",
      room: parent.name,
      homeRoom: parent.name,
      targetRoom: remote.name,
      sourceId: sources[0].id,
    },
  });
  createCreep("hudRemoteHauler", "remotehauler", 16, 24, {
    roomName: remote.name,
    memory: {
      role: "remotehauler",
      room: parent.name,
      homeRoom: parent.name,
      targetRoom: remote.name,
      sourceId: sources[0].id,
    },
  });
  createCreep("hudRemoteWorker", "remoteworker", 17, 24, {
    roomName: remote.name,
    memory: {
      role: "remoteworker",
      room: parent.name,
      homeRoom: parent.name,
      targetRoom: remote.name,
    },
  });
  createCreep("hudReserver", "reserver", remote.controller.pos.x + 1, remote.controller.pos.y, {
    roomName: remote.name,
    memory: {
      role: "reserver",
      room: parent.name,
      homeRoom: parent.name,
      targetRoom: remote.name,
    },
  });

  const result = reservationManager.createReservation(remote.name, parent.name);
  assert(result.ok, `expected reservation plan, got ${result.message}`);
  const report = reservationManager.getReservedRoomHudReport(remote);
  assert(report && report.hudLines[0].indexOf("Reserved W5N6") === 0, `expected reserved HUD report, got ${JSON.stringify(report)}`);
  assert(report.hudLines[0] === "Reserved W5N6", `expected reserved HUD header without focus, got ${report.hudLines[0]}`);
  assert(
    report.hudLines.some(function (line) { return line.indexOf("Parent W5N5") !== -1 && line.indexOf("Reserve 3200") !== -1; }),
    `expected parent and reserve ticks in reserved HUD, got ${JSON.stringify(report.hudLines)}`,
  );
  assert(
    report.hudLines.some(function (line) { return line.indexOf("Sources 1/2 ctr") !== -1 && line.indexOf("M 1 H 1 W 1") !== -1; }),
    `expected source and remote creep counts in reserved HUD, got ${JSON.stringify(report.hudLines)}`,
  );
  currentRuntime.visuals = [];
  hud.runReservedRooms();
  const labels = currentRuntime.visuals
    .filter(function (item) { return item.type === "text"; })
    .map(function (item) { return item.text; });
  assert(labels.indexOf("RM") !== -1, `expected remoteminer label, got ${labels.join(",")}`);
  assert(labels.indexOf("RH") !== -1, `expected remotehauler label, got ${labels.join(",")}`);
  assert(labels.indexOf("RW") !== -1, `expected remoteworker label, got ${labels.join(",")}`);
  assert(labels.indexOf("Rs") !== -1, `expected reserver label, got ${labels.join(",")}`);
}

function runReservationStableGateScenario() {
  const parent = buildRoomScenario("W6N5", {
    tick: 1025,
    controllerLevel: 4,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [{ name: "unstableWorker", role: "worker", x: 24, y: 25 }],
  });
  parent.controller.my = true;
  buildNeutralReserveRoom("W6N6");

  let result = reservationManager.createReservation("W6N6", parent.name);
  assert(result.ok, `expected reservation plan creation, got ${result.message}`);

  let state = roomState.collect(parent);
  let requests = spawnManager.getSpawnRequests(parent, state);
  assert(
    !requests.some(function (request) { return request.role === "reserver"; }),
    "unstable RCL4 parent should not spawn reservation creeps",
  );

  addRcl4StableStructures(parent);
  state = roomState.collect(parent);
  requests = spawnManager.getSpawnRequests(parent, state);
  assert(
    requests.some(function (request) { return request.role === "reserver" && request.targetRoom === "W6N6"; }),
    "stable RCL4 parent should request a reserver",
  );

  buildNeutralReserveRoom("W6N7");
  result = reservationManager.createReservation("W6N7", parent.name);
  assert(result.ok, `expected reservation plan creation, got ${result.message}`);
  state = roomState.collect(parent);
  requests = spawnManager.getSpawnRequests(parent, state);
  assert(
    requests.some(function (request) { return request.role === "reserver" && request.targetRoom === "W6N7"; }),
    "reservation should request a reserver",
  );
  assert(
    requests.some(function (request) { return request.role === "remoteworker" && request.targetRoom === "W6N7"; }),
    "reservation should request remote worker for source-container construction",
  );
  assert(
    !requests.some(function (request) {
      return request.targetRoom === "W6N7" && (request.role === "remoteminer" || request.role === "remotehauler");
    }),
    "reservation should not request miners or haulers before source containers are built",
  );
}

function runReservationEarlyPlanScenario() {
  const parent = buildRoomScenario("W6N3", {
    tick: 1030,
    controllerLevel: 2,
    spawnEnergy: 300,
    energyAvailable: 550,
    energyCapacityAvailable: 550,
    sourceContainers: true,
    supportContainers: true,
    creeps: [{ name: "earlyReserveWorker", role: "worker", x: 24, y: 25 }],
  });
  parent.controller.my = true;
  buildNeutralReserveRoom("W6N4");

  const result = reservationManager.createReservation("W6N4", parent.name);
  assert(result.ok, `expected early reservation plan creation, got ${result.message}`);

  let state = roomState.collect(parent);
  let requests = spawnManager.getSpawnRequests(parent, state);
  assert(
    !requests.some(function (request) { return request.targetRoom === "W6N4"; }),
    `expected pre-stable RCL2 reservation to hold off on energy use, got ${JSON.stringify(requests)}`,
  );

  reservationManager.run([parent], { W6N3: state });
  const target = Game.rooms.W6N4;
  assert(
    target.find(FIND_CONSTRUCTION_SITES).length === 0,
    "pre-stable RCL2 reservation should not place remote construction sites",
  );
}

function runReservationReserverRoleScenario() {
  const room = buildNeutralReserveRoom("W7N6", { sourceCount: 1 });
  const reserver = createCreep("reserver1", "reserver", room.controller.pos.x + 1, room.controller.pos.y, {
    roomName: room.name,
    body: [{ type: CLAIM }, { type: MOVE }],
    memory: {
      role: "reserver",
      room: "W7N5",
      homeRoom: "W7N5",
      targetRoom: room.name,
      operation: "reservation",
    },
  });

  roleReserver.run(reserver);

  assert(room.controller.reservation, "reserver should reserve the target controller when adjacent");
  assert(
    currentRuntime.creepActions.some(function (action) {
      return action.creep === "reserver1" && action.action === "reserveController";
    }),
    "expected reserveController action to be recorded",
  );
}

function runReservationRemoteConstructionScenario() {
  const parent = buildStableReservationParent("W8N5", 1075);
  const target = buildNeutralReserveRoom("W8N6");
  const result = reservationManager.createReservation(target.name, parent.name);
  assert(result.ok, `expected reservation plan, got ${result.message}`);

  const state = roomState.collect(parent);
  reservationManager.run([parent], { W8N5: state });

  const containerSites = target.find(FIND_CONSTRUCTION_SITES, {
    filter: function (site) { return site.structureType === STRUCTURE_CONTAINER; },
  });
  assert(containerSites.length > 0, "remote planner should create source container sites");

  addContainersForSources(target, target.find(FIND_SOURCES));
  const roadPlaced = reservationManager.placeRemoteRoads(target, target, 5);
  assert(roadPlaced > 0, "remote road planner should create minimal de-duplicated road sites when route is visible");
}

function runReservationRemoteRequestsScenario() {
  const parent = buildStableReservationParent("W9N5", 1100);
  buildNeutralReserveRoom("W9N6", { sourceContainers: true });
  const result = reservationManager.createReservation("W9N6", parent.name);
  assert(result.ok, `expected reservation plan, got ${result.message}`);

  const state = roomState.collect(parent);
  const requests = spawnManager.getSpawnRequests(parent, state);
  const roles = requests.map(function (request) { return request.role; });

  assert(roles.indexOf("reserver") !== -1, `expected reserver request, got ${roles.join(",")}`);
  assert(roles.indexOf("remoteminer") !== -1, `expected remoteminer request, got ${roles.join(",")}`);
  assert(roles.indexOf("remotehauler") !== -1, `expected remotehauler request, got ${roles.join(",")}`);
}

function runReservationRemoteRolesScenario() {
  const room = buildNeutralReserveRoom("W10N6", { sourceContainers: true });
  const source = room.find(FIND_SOURCES)[0];
  const container = room.find(FIND_STRUCTURES, {
    filter: function (structure) {
      return structure.structureType === STRUCTURE_CONTAINER && structure.pos.getRangeTo(source) <= 1;
    },
  })[0];
  container.store.energy = 0;

  const miner = createCreep("remoteMiner1", "remoteminer", container.pos.x, container.pos.y, {
    roomName: room.name,
    store: { energy: 0 },
    storeCapacity: 50,
    body: [{ type: WORK }, { type: WORK }, { type: CARRY }, { type: MOVE }],
    memory: {
      role: "remoteminer",
      room: "W10N5",
      homeRoom: "W10N5",
      targetRoom: room.name,
      sourceId: source.id,
      targetId: container.id,
      operation: "reservation",
    },
  });
  roleRemoteMiner.run(miner);
  assert(
    currentRuntime.creepActions.some(function (action) {
      return action.creep === "remoteMiner1" && action.action === "harvest";
    }),
    "remote miner should harvest its assigned source",
  );

  container.store.energy = 500;
  const hauler = createCreep("remoteHauler1", "remotehauler", container.pos.x, container.pos.y, {
    roomName: room.name,
    store: { energy: 0 },
    storeCapacity: 100,
    body: [{ type: CARRY }, { type: CARRY }, { type: MOVE }],
    memory: {
      role: "remotehauler",
      room: "W10N5",
      homeRoom: "W10N5",
      targetRoom: room.name,
      sourceId: source.id,
      targetId: container.id,
      operation: "reservation",
    },
  });
  roleRemoteHauler.run(hauler);
  assert(
    currentRuntime.creepActions.some(function (action) {
      return action.creep === "remoteHauler1" && action.action === "withdraw";
    }),
    "remote hauler should withdraw from its source container",
  );

  room.createConstructionSite(source.pos.x + 1, source.pos.y + 1, STRUCTURE_ROAD);
  const worker = createCreep("remoteWorker1", "remoteworker", source.pos.x, source.pos.y + 1, {
    roomName: room.name,
    store: { energy: 50 },
    storeCapacity: 50,
    body: [{ type: WORK }, { type: CARRY }, { type: MOVE }],
    memory: {
      role: "remoteworker",
      room: "W10N5",
      homeRoom: "W10N5",
      targetRoom: room.name,
      working: true,
      operation: "reservation",
    },
  });
  roleRemoteWorker.run(worker);
  assert(
    currentRuntime.creepActions.some(function (action) {
      return action.creep === "remoteWorker1" && action.action === "build";
    }),
    "remote worker should build visible remote construction sites",
  );
}

function runReservationDefenseScenario() {
  const parent = buildStableReservationParent("W11N5", 1150);
  buildNeutralReserveRoom("W11N6", {
    sourceContainers: true,
    hostiles: [{ name: "reserveInvader", x: 23, y: 23, body: [{ type: ATTACK }, { type: MOVE }] }],
  });
  const result = reservationManager.createReservation("W11N6", parent.name);
  assert(result.ok, `expected reservation plan, got ${result.message}`);

  const state = roomState.collect(parent);
  const requests = spawnManager.getSpawnRequests(parent, state);
  const defense = requests.find(function (request) {
    return request.role === "defender" && request.targetRoom === "W11N6";
  });

  assert(defense, "reserved-room threat should request a parent defender");
  assert(defense.operation === "reservation_defense", `expected reservation_defense, got ${defense.operation}`);
}

function runReservationThreatDefenseScenario() {
  const parent = buildStableReservationParent("W11N7", 1160);
  buildNeutralReserveRoom("W11N8", {
    reservation: { username: "tester", ticksToEnd: 3500 },
    sourceContainers: true,
    hostiles: [{ name: "reserveInvader", x: 23, y: 23, body: [{ type: ATTACK }, { type: MOVE }] }],
  });
  const result = reservationManager.createReservation("W11N8", parent.name);
  assert(result.ok, `expected reservation plan, got ${result.message}`);

  const state = roomState.collect(parent);
  const requests = spawnManager.getSpawnRequests(parent, state);
  const reserver = requests.find(function (request) {
    return request.role === "reserver" && request.targetRoom === "W11N8";
  });
  const defender = requests.find(function (request) {
    return request.role === "defender" && request.targetRoom === "W11N8";
  });

  assert(reserver, `expected threatened reservation to keep a reserver active, got ${JSON.stringify(requests)}`);
  assert(defender, `expected threatened reservation to request defense support, got ${JSON.stringify(requests)}`);
  assert(
    !requests.some(function (request) {
      return request.targetRoom === "W11N8" && (
        request.role === "remoteworker" ||
        request.role === "remoteminer" ||
        request.role === "remotehauler"
      );
    }),
    `threatened reservation should not request remote economy creeps, got ${JSON.stringify(requests)}`,
  );
}

function runReservationStaleThreatDefenseScenario() {
  const parent = buildRoomScenario("W11N7", {
    tick: 1160,
    controllerLevel: 4,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "reserveThreatWorker", role: "worker", x: 24, y: 25 },
      { name: "reserveThreatMiner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "reserveThreatMiner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "reserveThreatHauler", role: "hauler", x: 26, y: 25 },
      { name: "reserveThreatUpgrader", role: "upgrader", x: 25, y: 24 },
    ],
  });
  parent.controller.my = true;
  parent.controller.owner = { username: "tester" };

  const target = buildNeutralReserveRoom("W11N8", {
    sourceContainers: true,
    hostiles: [{ name: "staleReserveInvader", x: 24, y: 24, body: [{ type: ATTACK }, { type: MOVE }] }],
  });

  const result = reservationManager.createReservation(target.name, parent.name);
  assert(result.ok, `expected reservation plan, got ${result.message}`);

  const plan = reservationManager.getActiveReservation(target.name);
  plan.startedAt = Game.time - 25;

  delete Game.rooms[target.name];
  delete currentRuntime.rooms[target.name];
  Game.time += 25;

  const state = roomState.collect(parent);
  const requests = spawnManager.getSpawnRequests(parent, state);
  const defender = requests.find(function (request) {
    return request.role === "defender" && request.targetRoom === target.name;
  });
  const reserver = requests.find(function (request) {
    return request.role === "reserver" && request.targetRoom === target.name;
  });

  assert(defender, `expected stale reservation threat to keep a defender queued, got ${JSON.stringify(requests)}`);
  assert(defender.operation === "reservation_defense", `expected reservation_defense, got ${defender.operation}`);
  assert(reserver, `expected active reservation to refresh visibility with a reserver, got ${JSON.stringify(requests)}`);
}

function runReservationExpansionTakeoverScenario() {
  const parent = buildStableReservationParent("W12N5", 1175);
  buildNeutralReserveRoom("W12N6", {
    sourceContainers: true,
    reservation: { username: "tester", ticksToEnd: 4000 },
  });
  const reserveResult = reservationManager.createReservation("W12N6", parent.name);
  assert(reserveResult.ok, `expected reservation plan, got ${reserveResult.message}`);

  const expandResult = empireManager.createExpansion("W12N6");
  assert(expandResult.ok, `expected expansion takeover, got ${expandResult.message}`);
  assert(expandResult.plan.parentRoom === parent.name, "expansion should inherit reservation parent when parent omitted");
  assert(
    !reservationManager.getActiveReservation("W12N6"),
    "reservation should be converted after expansion takeover",
  );

  const state = roomState.collect(parent);
  const requests = spawnManager.getSpawnRequests(parent, state);
  assert(
    requests.some(function (request) {
      return request.role === "claimer" && request.targetRoom === "W12N6";
    }),
    "takeover should request a claimer",
  );
  assert(
    !requests.some(function (request) {
      return request.role === "pioneer" && request.targetRoom === "W12N6";
    }),
    "takeover should not request pioneers before the room is claimed",
  );
}

function runExpansionReservationTakeoverScenario() {
  const parent = buildStableReservationParent("W12N7", 1182);
  buildNeutralReserveRoom("W12N8", {
    sourceContainers: true,
  });
  const expandResult = empireManager.createExpansion("W12N8", parent.name);
  assert(expandResult.ok, `expected expansion plan, got ${expandResult.message}`);

  if (!Memory.rooms[parent.name]) Memory.rooms[parent.name] = {};
  Memory.rooms[parent.name].spawnQueue = [
    { role: "claimer", targetRoom: "W12N8", operation: "expansion" },
    { role: "pioneer", targetRoom: "W12N8", operation: "expansion" },
  ];

  ops.registerGlobals();
  const reserveResult = global.ops.reserve("W12N8");
  assert(reserveResult.ok, `expected reservation takeover, got ${reserveResult.message}`);
  assert(
    reserveResult.plan.parentRoom === parent.name,
    "reservation should inherit expansion parent when parent omitted",
  );
  assert(
    !empireManager.getActiveExpansion("W12N8"),
    "expansion should be converted after reservation takeover",
  );
  assert(
    !Object.prototype.hasOwnProperty.call(reservationManager.getActiveReservation("W12N8"), "focus"),
    "reservation takeover should not store focus",
  );

  const queue = Memory.rooms[parent.name] && Memory.rooms[parent.name].spawnQueue
    ? Memory.rooms[parent.name].spawnQueue
    : [];
  assert(
    !queue.some(function (item) {
      return item.targetRoom === "W12N8" && item.operation === "expansion";
    }),
    `reservation takeover should prune queued expansion requests, got ${JSON.stringify(queue)}`,
  );
}

function runExpansionCancellationScenario() {
  const parent = buildStableReservationParent("W13N5", 1190);
  const target = buildNeutralReserveRoom("W13N6", { sourceCount: 1 });

  const result = empireManager.createExpansion(target.name, parent.name);
  assert(result.ok, `expected expansion plan, got ${result.message}`);

  let state = roomState.collect(parent);
  spawnManager.run(parent, state);
  let queue = Memory.rooms[parent.name] && Memory.rooms[parent.name].spawnQueue
    ? Memory.rooms[parent.name].spawnQueue
    : [];
  assert(
    queue.some(function (item) { return item.operation === "expansion" && item.targetRoom === target.name; }),
    "expected queued expansion spawn requests before cancellation",
  );

  const cancelResult = empireManager.cancelExpansion(target.name);
  assert(cancelResult.ok, `expected expansion cancellation, got ${cancelResult.message}`);
  assert(!empireManager.getActiveExpansion(target.name), "cancelled expansion should no longer be active");

  queue = Memory.rooms[parent.name] && Memory.rooms[parent.name].spawnQueue
    ? Memory.rooms[parent.name].spawnQueue
    : [];
  assert(
    !queue.some(function (item) { return item.targetRoom === target.name && item.operation === "expansion"; }),
    `expected expansion queue entries to be pruned, got ${JSON.stringify(queue)}`,
  );

  state = roomState.collect(parent);
  const requests = spawnManager.getSpawnRequests(parent, state);
  assert(
    !requests.some(function (request) { return request.targetRoom === target.name && request.operation === "expansion"; }),
    "cancelled expansion should stop requesting claimer or pioneer spawns",
  );

  const claimer = createCreep("cancelledClaimer", "claimer", target.controller.pos.x + 1, target.controller.pos.y, {
    roomName: target.name,
    body: [{ type: CLAIM }, { type: MOVE }],
    memory: {
      role: "claimer",
      room: parent.name,
      homeRoom: parent.name,
      targetRoom: target.name,
      operation: "expansion",
    },
  });
  currentRuntime.creepActions = [];
  creepManager.run(
    target,
    roomState.collect(target),
    null,
    null,
    { pressure: "normal", thinkIntervalMultiplier: 1 },
  );
  assert(
    !currentRuntime.creepActions.some(function (action) { return action.creep === claimer.name; }),
    "cancelled expansion should stop active claimer control",
  );
}

function runReservationCancellationScenario() {
  const parent = buildStableReservationParent("W14N5", 1210);
  const target = buildNeutralReserveRoom("W14N6", { sourceContainers: true, sourceCount: 1 });

  const result = reservationManager.createReservation(target.name, parent.name);
  assert(result.ok, `expected reservation plan, got ${result.message}`);

  let state = roomState.collect(parent);
  spawnManager.run(parent, state);
  let queue = Memory.rooms[parent.name] && Memory.rooms[parent.name].spawnQueue
    ? Memory.rooms[parent.name].spawnQueue
    : [];
  assert(
    queue.some(function (item) { return item.targetRoom === target.name && item.operation === "reservation"; }),
    "expected queued reservation spawn requests before cancellation",
  );

  ops.registerGlobals();
  const cancelResult = global.ops.cancelReserve(target.name);
  assert(cancelResult.ok, `expected reservation cancellation, got ${cancelResult.message}`);
  assert(!reservationManager.getActiveReservation(target.name), "cancelled reservation should no longer be active");

  queue = Memory.rooms[parent.name] && Memory.rooms[parent.name].spawnQueue
    ? Memory.rooms[parent.name].spawnQueue
    : [];
  assert(
    !queue.some(function (item) { return item.targetRoom === target.name; }),
    `expected reservation queue entries to be pruned, got ${JSON.stringify(queue)}`,
  );

  state = roomState.collect(parent);
  const requests = spawnManager.getSpawnRequests(parent, state);
  assert(
    !requests.some(function (request) { return request.targetRoom === target.name; }),
    "cancelled reservation should stop requesting remote creeps",
  );

  const reserver = createCreep("cancelledReserver", "reserver", target.controller.pos.x + 1, target.controller.pos.y, {
    roomName: target.name,
    body: [{ type: CLAIM }, { type: MOVE }],
    memory: {
      role: "reserver",
      room: parent.name,
      homeRoom: parent.name,
      targetRoom: target.name,
      operation: "reservation",
    },
  });
  currentRuntime.creepActions = [];
  creepManager.run(
    target,
    roomState.collect(target),
    null,
    null,
    { pressure: "normal", thinkIntervalMultiplier: 1 },
  );
  assert(
    !currentRuntime.creepActions.some(function (action) { return action.creep === reserver.name; }),
    "cancelled reservation should stop active reserver control",
  );
}

function runReservationRemoteHaulerStorageDeliveryScenario() {
  const parent = buildStableReservationParent("W13N5", 1210);
  parent.addStructure(
    createStructure(STRUCTURE_STORAGE, 24, 27, {
      roomName: parent.name,
      store: { energy: 2000 },
      storeCapacityResource: { energy: 1000000 },
      hits: 10000,
      hitsMax: 10000,
    }),
  );
  const remote = buildNeutralReserveRoom("W13N6", {
    reservation: { username: "tester", ticksToEnd: 3200 },
    sourceContainers: true,
  });
  const result = reservationManager.createReservation(remote.name, parent.name);
  assert(result.ok, `expected reservation plan, got ${result.message}`);

  const hauler = createCreep("remoteStorageHauler", "remotehauler", 25, 25, {
    roomName: parent.name,
    store: { energy: 100 },
    storeCapacity: 100,
    body: [{ type: CARRY }, { type: CARRY }, { type: MOVE }],
    memory: {
      role: "remotehauler",
      room: parent.name,
      homeRoom: parent.name,
      targetRoom: remote.name,
      sourceId: remote.find(FIND_SOURCES)[0].id,
      delivering: true,
      operation: "reservation",
    },
  });

  roleRemoteHauler.run(hauler);

  assert(
    currentRuntime.creepActions.some(function (action) {
      return action.creep === "remoteStorageHauler" &&
        action.action === "transfer" &&
        action.targetId === parent.storage.id;
    }),
    `remote hauler should prioritize parent storage delivery, got ${JSON.stringify(currentRuntime.creepActions)}`,
  );
}

function runExpansionStaleThreatDefenseScenario() {
  const parent = buildRoomScenario("W15N5", {
    tick: 1220,
    controllerLevel: 4,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "expandThreatWorker", role: "worker", x: 24, y: 25 },
      { name: "expandThreatMiner1", role: "miner", x: 16, y: 25, memory: { sourceId: "source1" } },
      { name: "expandThreatMiner2", role: "miner", x: 36, y: 25, memory: { sourceId: "source2" } },
      { name: "expandThreatHauler", role: "hauler", x: 26, y: 25 },
      { name: "expandThreatUpgrader", role: "upgrader", x: 25, y: 24 },
    ],
  });
  parent.controller.my = true;
  parent.controller.owner = { username: "tester" };

  const target = buildNeutralReserveRoom("W15N6", {
    sourceContainers: true,
    hostiles: [{ name: "staleExpandInvader", x: 24, y: 24, body: [{ type: ATTACK }, { type: MOVE }] }],
  });

  const result = empireManager.createExpansion(target.name, parent.name);
  assert(result.ok, `expected expansion plan, got ${result.message}`);

  const plan = empireManager.getActiveExpansion(target.name);
  plan.startedAt = Game.time - 25;

  delete Game.rooms[target.name];
  delete currentRuntime.rooms[target.name];
  Game.time += 25;

  const state = roomState.collect(parent);
  const requests = spawnManager.getSpawnRequests(parent, state);
  const defender = requests.find(function (request) {
    return request.role === "defender" && request.targetRoom === target.name;
  });

  assert(defender, `expected stale expansion threat to keep a defender queued, got ${JSON.stringify(requests)}`);
  assert(defender.operation === "expansion_defense", `expected expansion_defense, got ${defender.operation}`);
}

function runExpansionThreatRetreatScenario() {
  const parent = buildStableReservationParent("W16N5", 1235);
  const target = buildNeutralReserveRoom("W16N6", {
    sourceContainers: true,
    hostiles: [{ name: "expandInvader", x: 23, y: 23, body: [{ type: ATTACK }, { type: MOVE }] }],
  });

  const result = empireManager.createExpansion(target.name, parent.name);
  assert(result.ok, `expected expansion plan, got ${result.message}`);

  const plan = empireManager.getActiveExpansion(target.name);
  plan.startedAt = Game.time - 25;

  const claimer = createCreep("threatenedClaimer", "claimer", 24, 24, {
    roomName: target.name,
    body: [{ type: CLAIM }, { type: MOVE }],
    memory: {
      role: "claimer",
      room: parent.name,
      homeRoom: parent.name,
      targetRoom: target.name,
      operation: "expansion",
    },
  });

  currentRuntime.creepActions = [];
  creepManager.run(
    parent,
    roomState.collect(parent),
    null,
    null,
    { pressure: "normal", thinkIntervalMultiplier: 1 },
  );

  assert(
    currentRuntime.creepActions.some(function (action) {
      return action.creep === claimer.name && action.action === "moveTo";
    }),
    "threatened expansion creeps should retreat toward home instead of continuing expansion control",
  );
}

function runHudConfigControlsScenario() {
  const originalHud = Object.assign({}, config.HUD);
  const room = buildRoomScenario("VAL_HUD_CONFIG", {
    tick: 1000,
    controllerLevel: 2,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 550,
    creeps: [
      { name: "hudWorker", role: "worker", x: 24, y: 25 },
    ],
  });
  const state = roomState.collect(room);

  try {
    config.HUD.ROOM_SUMMARY = false;
    config.HUD.CREEP_LABELS = false;
    hud.run(room, state);

    assert(
      currentRuntime.visuals.length === 0,
      `expected HUD config off switches to suppress visuals, got ${JSON.stringify(currentRuntime.visuals)}`,
    );

    config.HUD.ROOM_SUMMARY = true;
    config.HUD.ROOM_SUMMARY_INTERVAL = 10;
    config.HUD.CREEP_LABELS = false;
    room.energyAvailable = 300;
    hud.drawSummary(room, state);

    let energyLine = currentRuntime.visuals.find(function (item) {
      return item.type === "text" && String(item.text).indexOf("Energy ") === 0;
    });
    assert(energyLine && energyLine.text.indexOf("Energy 300/550") === 0, `expected initial room HUD energy line, got ${energyLine ? energyLine.text : "none"}`);

    currentRuntime.visuals = [];
    Game.time = 1005;
    room.energyAvailable = 500;
    hud.drawSummary(room, state);
    energyLine = currentRuntime.visuals.find(function (item) {
      return item.type === "text" && String(item.text).indexOf("Energy ") === 0;
    });
    assert(energyLine && energyLine.text.indexOf("Energy 300/550") === 0, `expected cached room HUD before configured interval, got ${energyLine ? energyLine.text : "none"}`);

    currentRuntime.visuals = [];
    Game.time = 1010;
    hud.drawSummary(room, state);
    energyLine = currentRuntime.visuals.find(function (item) {
      return item.type === "text" && String(item.text).indexOf("Energy ") === 0;
    });
    assert(energyLine && energyLine.text.indexOf("Energy 500/550") === 0, `expected room HUD refresh at configured interval, got ${energyLine ? energyLine.text : "none"}`);

    currentRuntime.visuals = [];
    config.HUD.ROOM_SUMMARY = false;
    config.HUD.CREEP_LABELS = true;
    config.HUD.LABEL_INTERVAL = 2;
    Game.time = 1011;
    hud.run(room, state);
    assert(
      currentRuntime.visuals.length === 0,
      `expected creep labels to wait for configured interval, got ${JSON.stringify(currentRuntime.visuals)}`,
    );

    Game.time = 1012;
    hud.run(room, state);
    assert(
      currentRuntime.visuals.some(function (item) {
        return item.type === "text" && item.text === "W";
      }),
      `expected creep label on configured interval, got ${JSON.stringify(currentRuntime.visuals)}`,
    );
  } finally {
    config.HUD = originalHud;
  }
}

function runCpuRoomScaleScenario() {
  const policy = config.STATS.RUNTIME_POLICY;
  const twoRooms = statsManager.getRoomScale(policy, 2);
  const threeRooms = statsManager.getRoomScale(policy, 3);
  const sixRooms = statsManager.getRoomScale(policy, 6);

  assert(!twoRooms.active, "room scaling should stay inactive below the configured start room count");
  assert(threeRooms.active, "room scaling should activate at three owned rooms");
  assert(
    threeRooms.thinkMultiplier > 1 &&
      threeRooms.constructionMultiplier > 1 &&
      threeRooms.advancedOpsInterval > 1,
    `expected room scaling to stretch non-critical work, got ${JSON.stringify(threeRooms)}`,
  );
  assert(
    sixRooms.thinkMultiplier <= policy.ROOM_SCALE.MAX_THINK_MULTIPLIER &&
      sixRooms.constructionMultiplier <= policy.ROOM_SCALE.MAX_CONSTRUCTION_MULTIPLIER &&
      sixRooms.advancedOpsInterval <= policy.ROOM_SCALE.MAX_ADVANCED_OPS_INTERVAL,
    `expected room scaling to respect configured caps, got ${JSON.stringify(sixRooms)}`,
  );
}

function runCpuSoftLimitScenario() {
  const originalLimit = Game.cpu.limit;
  const originalSoftLimit = config.STATS.RUNTIME_POLICY.SOFT_CPU_LIMIT;

  try {
    Game.cpu.limit = 80;
    config.STATS.RUNTIME_POLICY.SOFT_CPU_LIMIT = 0;

    const softLimit = statsManager.getSoftCpuLimit();
    assert(
      softLimit === 80,
      `expected zero soft CPU limit config to use actual CPU limit, got ${softLimit}`,
    );
  } finally {
    Game.cpu.limit = originalLimit;
    config.STATS.RUNTIME_POLICY.SOFT_CPU_LIMIT = originalSoftLimit;
  }
}

function runOpsCpuReportShapeScenario() {
  const room = buildRoomScenario("VAL_CPU_REPORT", {
    tick: 1075,
    controllerLevel: 6,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "cpuWorker", role: "worker", x: 24, y: 25 },
      { name: "cpuHauler", role: "hauler", x: 23, y: 25 },
    ],
  });
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  addRcl4StableStructures(room);

  Memory.stats = {
    last: {
      tick: Game.time,
      cpu: {
        used: 12.34,
        tickCost: 12.34,
        limit: 20,
        tickLimit: 500,
        bucket: 9876,
      },
      creepCount: 2,
      roomCount: 1,
      pressure: "tight",
    },
    averages: { cpuUsed: 10.5 },
    max: { cpuUsed: 14.75 },
    runtime: {
      pressure: "tight",
      thinkIntervalMultiplier: 2,
      constructionIntervalMultiplier: 3,
      advancedOpsInterval: 5,
      roomScaleActive: true,
      skipDirectives: false,
      skipHud: true,
    },
    rooms: {},
  };
  Memory.stats.rooms[room.name] = {
    cpu: {
      tick: Game.time,
      current: 4.321,
      average: 3.21,
      peak: 5.432,
      minimum: 2.1,
      pressure: "tight",
      pressureCounts: { normal: 0.6, tight: 0.3, critical: 0.1 },
      creepCount: 2,
      phase: "logistics",
      rcl: 6,
      sections: [
        {
          label: "spawn_manager",
          current: 1.2,
          average: 1.1,
          lastTick: Game.time,
        },
        {
          label: "creep_manager",
          current: 2.3,
          average: 1.8,
          lastTick: Game.time,
        },
      ],
      hotspots: [
        { label: "creep_manager", average: 1.8 },
        { label: "spawn_manager", average: 1.1 },
      ],
      scheduler: {
        skippedThisTick: 1,
        tasks: [
          {
            key: "room.cpu.construction",
            lastSkipReason: "budget",
            lastSkipped: Game.time,
          },
        ],
      },
    },
  };

  ops.registerGlobals();
  assert(typeof global.ops.cpu === "function", "ops.cpu should be registered");

  let captured = captureConsoleLines(function () {
    return global.ops.cpu(room.name);
  });
  assert(
    typeof captured.result === "string",
    `ops.cpu should return a printable string, got ${typeof captured.result}`,
  );
  assert(
    captured.result === `[OPS][${room.name}][CPU] report generated`,
    `ops.cpu should return a concise CPU status, got ${captured.result}`,
  );
  assert(
    captured.lines.some(function (line) {
      return line.indexOf("Room current 4.321") !== -1 && line.indexOf("Avg 3.210") !== -1;
    }),
    `CPU report should include room current/average CPU, got ${captured.lines.join(" / ")}`,
  );
  assert(
    captured.lines.some(function (line) {
      return (
        line.indexOf("Pressure tight") !== -1 &&
        line.indexOf("Phase logistics") !== -1 &&
        line.indexOf("RCL 6") !== -1 &&
        line.indexOf("Creeps 2") !== -1
      );
    }),
    `CPU report should include pressure/phase/RCL/creeps, got ${captured.lines.join(" / ")}`,
  );
  assert(
    captured.lines.some(function (line) { return line === "Hotspots by avg"; }) &&
      captured.lines.some(function (line) { return line.indexOf("creep_manager") !== -1 && line.indexOf("1.800") !== -1; }),
    `CPU report should include hotspot section lines, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "cpu");
  });
  assert(
    typeof captured.result === "string",
    `ops.room(room, "cpu") should return a printable string, got ${typeof captured.result}`,
  );
  assert(
    captured.result === `[OPS][${room.name}][CPU] report generated`,
    `ops.room(room, "cpu") should return a concise CPU status, got ${captured.result}`,
  );
}

function runProductionFactoryVisibilityScenario() {
  const room = buildRoomScenario("VAL_FACTORY_VIS", {
    tick: 1085,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 3000,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
  });
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  const storage = room.addStructure(createStructure(STRUCTURE_STORAGE, 24, 24, {
    roomName: room.name,
    store: { energy: 100000, battery: 500 },
    storeCapacity: 1000000,
  }));
  room.addStructure(createStructure(STRUCTURE_TERMINAL, 25, 24, {
    roomName: room.name,
    store: { energy: 5000, battery: 100 },
    storeCapacity: 300000,
  }));
  const factory = room.addStructure(createStructure(STRUCTURE_FACTORY, 26, 24, {
    roomName: room.name,
    store: { energy: 600, battery: 250 },
    storeCapacity: 50000,
    cooldown: 0,
  }));
  Memory.rooms[room.name] = {
    advancedOps: {
      summary: {
        factoryStatus: "ready",
        factoryProduct: "battery",
        batteryPolicy: "reserve",
        labStatus: "inactive",
        powerSpawnStatus: "inactive",
        nukerStatus: "inactive",
        taskLabel: "factory_output",
        taskBacklog: [
          { label: "factory_output", resourceType: "battery", amount: 250 },
        ],
      },
      batteryPolicy: "reserve",
    },
  };
  ops.registerGlobals();
  const terminalSendsBefore = currentRuntime.terminalSends.length;
  const spawnEventsBefore = currentRuntime.spawnEvents.length;

  let captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "factory");
  });
  assert(captured.result === `[OPS][${room.name}][FACTORY] report generated`, `factory report should return printable status, got ${captured.result}`);
  assert(
      captured.lines.some(function (line) { return line.indexOf("[FACTORY]") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Factory exists") !== -1 && line.indexOf("State accumulating") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Recipe battery") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Battery policy reserve") !== -1 && line.indexOf("Stock 850") !== -1 && line.indexOf("Classification reserve") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Battery energy 600") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Output accumulation battery 250>=100") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Ownership supply unknown") !== -1 && line.indexOf("withdraw advanced-hauler") !== -1 && line.indexOf("alignment bypasses request standards") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Production Requests") !== -1 && line.indexOf("request-style only") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("factory_withdraw battery") !== -1 && line.indexOf("lifecycle needed") !== -1 && line.indexOf("ownership advanced-hauler") !== -1 && line.indexOf("execution advanced-hauler") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Production Ownership Guard dual-owned 0") !== -1; }) &&
      captured.lines.join("\n").indexOf("[object Object]") === -1,
    `factory report should include printable battery/energy/state/output details, got ${captured.lines.join(" / ")}`,
  );

  Memory.ops.logistics.requests.dualFactoryVisibility = {
    id: "dualFactoryVisibility",
    roomName: room.name,
    type: "move",
    status: "open",
    resourceType: "battery",
    amount: 250,
    remaining: 250,
    from: "factory",
    to: "storage",
    sourceId: factory.id,
    targetId: storage.id,
    claims: {},
    createdAt: Game.time,
    updatedAt: Game.time,
  };
  captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "factory");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("factory_withdraw battery") !== -1 && line.indexOf("ownership dual-owned") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Production Ownership Guard dual-owned 1") !== -1; }),
    `factory report should make dual ownership printable, got ${captured.lines.join(" / ")}`,
  );
  delete Memory.ops.logistics.requests.dualFactoryVisibility;

  captured = captureConsoleLines(function () {
    return global.ops.factory(room.name, "battery");
  });
  assert(
    captured.result === `[OPS][${room.name}][FACTORY] report generated` &&
      captured.lines.some(function (line) { return line.indexOf("preview battery | No production executed") !== -1; }),
    `ops.factory battery should be report-only preview, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.factory(room.name, "battery", "commodity");
  });
  assert(
    Memory.rooms[room.name].advancedOps.batteryPolicy === "commodity" &&
      captured.lines.some(function (line) { return line.indexOf("battery policy commodity stored") !== -1; }),
    `ops.factory battery commodity should persist policy, got ${captured.lines.join(" / ")}`,
  );
  captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "factory");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("Battery policy commodity") !== -1 && line.indexOf("Classification commodity") !== -1; }),
    `factory report should represent commodity battery policy, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.factory(room.name, "battery", "disabled");
  });
  assert(
    Memory.rooms[room.name].advancedOps.batteryPolicy === "disabled" &&
      captured.lines.some(function (line) { return line.indexOf("battery policy disabled stored") !== -1; }),
    `ops.factory battery disabled should persist policy, got ${captured.lines.join(" / ")}`,
  );
  captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "factory");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("Battery policy disabled") !== -1 && line.indexOf("Classification disabled") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("factory_supply battery") !== -1 && line.indexOf("lifecycle disabled") !== -1 && line.indexOf("blocked battery policy disabled") !== -1; }),
    `factory report should represent disabled battery policy endpoint, got ${captured.lines.join(" / ")}`,
  );

  Game.time += 1;
  let state = roomState.collect(room);
  let summary = advancedStructureManager.getStatus(room, state);
  assert(summary.factoryProduct === null, `disabled battery policy should suppress battery product, got ${summary.factoryProduct}`);

  delete Memory.rooms[room.name].advancedOps.batteryPolicy;
  captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "factory");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("Battery policy unknown") !== -1 && line.indexOf("Classification unknown") !== -1; }),
    `factory report should represent unknown battery policy, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.factory(room.name, "battery", "reserve");
  });
  assert(
    Memory.rooms[room.name].advancedOps.batteryPolicy === "reserve" &&
      captured.lines.some(function (line) { return line.indexOf("battery policy reserve stored") !== -1; }),
    `ops.factory battery reserve should persist policy, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.factory(room.name, "pause");
  });
  assert(
    Memory.rooms[room.name].advancedOps.factoryPaused === true &&
      captured.lines.some(function (line) { return line.indexOf("factory pause enabled") !== -1; }),
    `ops.factory pause should persist pause state, got ${captured.lines.join(" / ")}`,
  );
  Game.time += 1;
  state = roomState.collect(room);
  advancedStructureManager.run(room, state);
  assert(currentRuntime.factoryActions.length === 0, "paused factory must not call produce");
  captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "factory");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("Status paused") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Blocked operator paused") !== -1; }),
    `factory report should reflect pause state, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.factory(room.name, "resume");
  });
  assert(
    Memory.rooms[room.name].advancedOps.factoryPaused === false &&
      captured.lines.some(function (line) { return line.indexOf("factory pause cleared") !== -1; }),
    `ops.factory resume should clear pause state, got ${captured.lines.join(" / ")}`,
  );
  Game.time += 1;
  state = roomState.collect(room);
  advancedStructureManager.run(room, state);
  assert(currentRuntime.factoryActions.length === 1, "resumed ready factory should call produce exactly once");
  assert(currentRuntime.terminalSends.length === terminalSendsBefore, "factory reports must not send terminal resources");
  assert(currentRuntime.spawnEvents.length === spawnEventsBefore, "factory reports must not spawn creeps");
  assert(storage.store.energy === 100000 && factory.store.energy === 600, "factory reports must not move resources");

  const missingRoom = buildRoomScenario("VAL_FACTORY_MISSING", {
    tick: 1086,
    controllerLevel: 8,
    sourceContainers: true,
    supportContainers: true,
  });
  missingRoom.controller.my = true;
  missingRoom.controller.owner = { username: "tester" };
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.room(missingRoom.name, "factory");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("Factory missing") !== -1; }) &&
      captured.lines.join("\n").indexOf("[object Object]") === -1,
    `missing factory report should be printable, got ${captured.lines.join(" / ")}`,
  );
  captured = captureConsoleLines(function () {
    return global.ops.factory(missingRoom.name, "battery", "reserve");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("blocked; factory missing") !== -1; }),
    `battery control should validate factory existence, got ${captured.lines.join(" / ")}`,
  );
}

function runProductionLabVisibilityScenario() {
  const room = buildRoomScenario("VAL_LABS_VIS", {
    tick: 1090,
    controllerLevel: 8,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 3000,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
  });
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  room.addStructure(createStructure(STRUCTURE_STORAGE, 24, 24, {
    roomName: room.name,
    store: { energy: 100000, H: 1000, O: 1000 },
    storeCapacity: 1000000,
  }));
  room.addStructure(createStructure(STRUCTURE_TERMINAL, 25, 24, {
    roomName: room.name,
    store: { energy: 5000 },
    storeCapacity: 300000,
  }));
  const inputA = room.addStructure(createStructure(STRUCTURE_LAB, 26, 24, {
    roomName: room.name,
    store: { energy: 500, H: 100 },
    storeCapacity: 3000,
    cooldown: 0,
  }));
  inputA.mineralType = "H";
  const inputB = room.addStructure(createStructure(STRUCTURE_LAB, 27, 24, {
    roomName: room.name,
    store: { energy: 500, O: 100 },
    storeCapacity: 3000,
    cooldown: 0,
  }));
  inputB.mineralType = "O";
  const reactor = room.addStructure(createStructure(STRUCTURE_LAB, 26, 25, {
    roomName: room.name,
    store: { energy: 250, OH: 300 },
    storeCapacity: 3000,
    cooldown: 2,
  }));
  reactor.mineralType = "OH";
  Memory.rooms[room.name] = {
    advancedOps: {
      labLayout: {
        signature: [inputA.id, inputB.id, reactor.id].sort().join(":"),
        inputIds: [inputA.id, inputB.id],
        reactorIds: [reactor.id],
      },
      summary: {
        labStatus: "making_boost",
        labProduct: "OH",
        labGoal: "OH",
        labNeed: 700,
        labReason: "priority_fallback",
        factoryStatus: "inactive",
        powerSpawnStatus: "inactive",
        nukerStatus: "inactive",
        taskLabel: "lab_output",
        taskBacklog: [
          { label: "lab_output", resourceType: "OH", amount: 300 },
        ],
      },
    },
  };
  ops.registerGlobals();
  const terminalSendsBefore = currentRuntime.terminalSends.length;
  const spawnEventsBefore = currentRuntime.spawnEvents.length;

  let captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "labs");
  });
  assert(captured.result === `[OPS][${room.name}][LABS] report generated`, `labs report should return printable status, got ${captured.result}`);
  assert(
    captured.lines.some(function (line) { return line.indexOf("Labs 3") !== -1 && line.indexOf("State accumulating") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Reaction OH") !== -1 && line.indexOf("Reagents H + O") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Energy 1,250") !== -1 && line.indexOf("Cooldowns 1") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Missing reagents none") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Output accumulation") !== -1 && line.indexOf("OH 300") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Ownership supply unknown") !== -1 && line.indexOf("withdraw advanced-hauler") !== -1 && line.indexOf("alignment bypasses request standards") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Production Requests") !== -1 && line.indexOf("request-style only") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("lab_withdraw OH") !== -1 && line.indexOf("lifecycle needed") !== -1 && line.indexOf("ownership advanced-hauler") !== -1 && line.indexOf("execution advanced-hauler") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Production Ownership Guard dual-owned 0") !== -1; }) &&
      captured.lines.join("\n").indexOf("[object Object]") === -1,
    `labs report should include printable reaction/reagent/output details, got ${captured.lines.join(" / ")}`,
  );

  Memory.ops.logistics.requests.dualLabVisibility = {
    id: "dualLabVisibility",
    roomName: room.name,
    type: "move",
    status: "open",
    resourceType: "OH",
    amount: 300,
    remaining: 300,
    from: "lab",
    to: "storage",
    sourceId: reactor.id,
    targetId: room.storage.id,
    claims: {},
    createdAt: Game.time,
    updatedAt: Game.time,
  };
  captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "labs");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("lab_withdraw OH") !== -1 && line.indexOf("ownership dual-owned") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Production Ownership Guard dual-owned 1") !== -1; }),
    `labs report should make dual ownership printable, got ${captured.lines.join(" / ")}`,
  );
  delete Memory.ops.logistics.requests.dualLabVisibility;

  captured = captureConsoleLines(function () {
    return global.ops.labs(room.name, "preview");
  });
  assert(
    captured.result === `[OPS][${room.name}][LABS] report generated` &&
      captured.lines.some(function (line) { return line.indexOf("preview | No reaction executed") !== -1; }),
    `ops.labs preview should be report-only, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.labs(room.name, "pause");
  });
  assert(
    Memory.rooms[room.name].advancedOps.labsPaused === true &&
      captured.lines.some(function (line) { return line.indexOf("lab pause enabled") !== -1; }),
    `ops.labs pause should persist pause state, got ${captured.lines.join(" / ")}`,
  );
  Game.time += 1;
  let state = roomState.collect(room);
  const pausedSummary = advancedStructureManager.getStatus(room, state);
  assert(pausedSummary.labStatus === "paused", `paused labs should report paused status, got ${pausedSummary.labStatus}`);
  advancedStructureManager.run(room, state);
  assert(currentRuntime.labReactionActions.length === 0, "paused labs must not call runReaction");
  captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "labs");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("Status paused") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Blocked operator paused") !== -1; }),
    `lab report should reflect pause state, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.labs(room.name, "resume");
  });
  assert(
    Memory.rooms[room.name].advancedOps.labsPaused === false &&
      captured.lines.some(function (line) { return line.indexOf("lab pause cleared") !== -1; }),
    `ops.labs resume should clear pause state, got ${captured.lines.join(" / ")}`,
  );
  assert(currentRuntime.terminalSends.length === terminalSendsBefore, "lab reports must not send terminal resources");
  assert(currentRuntime.spawnEvents.length === spawnEventsBefore, "lab reports must not spawn creeps");

  const missingRoom = buildRoomScenario("VAL_LABS_MISSING", {
    tick: 1091,
    controllerLevel: 6,
    sourceContainers: true,
    supportContainers: true,
  });
  missingRoom.controller.my = true;
  missingRoom.controller.owner = { username: "tester" };
  ops.registerGlobals();
  captured = captureConsoleLines(function () {
    return global.ops.room(missingRoom.name, "labs");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("Labs missing") !== -1; }) &&
      captured.lines.join("\n").indexOf("[object Object]") === -1,
    `missing labs report should be printable, got ${captured.lines.join(" / ")}`,
  );
  captured = captureConsoleLines(function () {
    return global.ops.labs(missingRoom.name, "pause");
  });
  assert(
    captured.lines.some(function (line) { return line.indexOf("blocked; labs missing") !== -1; }),
    `lab pause should validate lab existence, got ${captured.lines.join(" / ")}`,
  );
}

function addMinimalOwnedRoom(name, options) {
  const settings = options || {};
  const room = new FakeRoom(name, new FakeTerrain());
  room.setController(createController(20, 20, {
    roomName: name,
    level: settings.controllerLevel || 3,
  }));
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  room.addStructure(createStructure(STRUCTURE_SPAWN, 25, 25, {
    roomName: name,
    name: settings.spawnName || "Spawn1",
    store: { energy: settings.spawnEnergy || 300 },
    storeCapacityResource: { energy: 300 },
    spawning: settings.spawning || null,
  }));
  room.addSource(createSource(15, 25, { roomName: name }));
  room.addSource(createSource(35, 25, { roomName: name }));
  room.addMineral(createMineral(40, 10, { roomName: name }));
  room.energyAvailable = settings.energyAvailable !== undefined ? settings.energyAvailable : 300;
  room.energyCapacityAvailable = settings.energyCapacityAvailable || 300;
  if (settings.sourceContainers) {
    addContainersForSources(room, room.find(FIND_SOURCES));
  }
  return room;
}

function runLaborDiagnosticsVisibilityScenario() {
  const room = buildRoomScenario("VAL_LABOR_BUSY", {
    tick: 1095,
    controllerLevel: 3,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 550,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    creeps: [],
  });
  room.controller.my = true;
  room.controller.owner = { username: "tester" };
  room.spawn.spawning = { name: "miner_1095", remainingTime: 10 };
  Memory.rooms[room.name] = {
    spawnQueue: [
      {
        role: "worker",
        priority: 90,
        bodyCost: 300,
        energyAvailable: 300,
        energyCapacity: 550,
      },
    ],
  };
  const lowEnergyRoom = addMinimalOwnedRoom("VAL_LABOR_ENERGY", {
    controllerLevel: 3,
    energyAvailable: 100,
    energyCapacityAvailable: 300,
    sourceContainers: true,
  });
  Memory.rooms[lowEnergyRoom.name] = {
    spawnQueue: [
      {
        role: "worker",
        priority: 90,
        bodyCost: 300,
        energyAvailable: 100,
        energyCapacity: 300,
      },
    ],
  };
  ops.registerGlobals();
  const spawnEventsBefore = currentRuntime.spawnEvents.length;

  let captured = captureConsoleLines(function () {
    return global.ops.room(room.name, "labor");
  });
  assert(captured.result === `[OPS][${room.name}][LABOR] report generated`, `labor report should return printable status, got ${captured.result}`);
  assert(
    captured.lines.some(function (line) { return line.indexOf("Labor 0/2") !== -1 && line.indexOf("Deficit 2") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Next stabilize the early economy backbone") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Pending worker") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Blocked reason busy spawn") !== -1; }) &&
      captured.lines.join("\n").indexOf("[object Object]") === -1,
    `labor report should explain worker deficit and blocker, got ${captured.lines.join(" / ")}`,
  );

  captured = captureConsoleLines(function () {
    return global.ops.empire("labor");
  });
  assert(
    captured.result &&
      captured.result.section === "labor" &&
      captured.lines.some(function (line) { return line.indexOf("Rooms evaluated 2") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Labor deficit rooms 2") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Spawn busy 1") !== -1 && line.indexOf("Energy insufficient 1") !== -1; }) &&
      captured.lines.some(function (line) { return line.indexOf("Repeated restore-next 0") !== -1; }) &&
      captured.lines.join("\n").indexOf("[object Object]") === -1,
    `empire labor rollup should count deficits and blockers, got ${captured.lines.join(" / ")}`,
  );
  assert(currentRuntime.spawnEvents.length === spawnEventsBefore, "labor diagnostics must not spawn creeps");
}

function runObserverSchedulerScenario() {
  const room = buildRoomScenario("W5N5", {
    tick: 1000,
    controllerLevel: 8,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    extraStructures: [
      { type: STRUCTURE_OBSERVER, x: 23, y: 23, options: { hits: 500, hitsMax: 500 } },
    ],
  });
  room.controller.my = true;
  room.controller.owner = { username: "tester" };

  const target = new FakeRoom("W5N6", new FakeTerrain());
  target.setController(
    createController(20, 20, {
      roomName: target.name,
      level: 3,
      reservation: { username: "ally", ticksToEnd: 1234 },
    }),
  );
  target.addSource(createSource(12, 25, { roomName: target.name }));
  target.addSource(createSource(38, 25, { roomName: target.name }));
  target.addMineral(createMineral(25, 12, { roomName: target.name, mineralType: RESOURCE_UTRIUM }));
  target.addStructure(createStructure(STRUCTURE_TOWER, 24, 24, { roomName: target.name, my: false }));
  target.addStructure(createStructure(STRUCTURE_SPAWN, 25, 25, { roomName: target.name, my: false }));
  target.addStructure(createStructure(STRUCTURE_TERMINAL, 26, 25, { roomName: target.name, my: false, store: {}, storeCapacity: 300000 }));
  target.addStructure(createStructure(STRUCTURE_STORAGE, 26, 26, { roomName: target.name, my: false, store: {}, storeCapacity: 1000000 }));
  target.addStructure(createStructure(STRUCTURE_NUKER, 27, 27, { roomName: target.name, my: false }));
  const hostile = createCreep("observerHostile", "hostile", 10, 10, {
    roomName: target.name,
    my: false,
  });
  hostile.owner = { username: "Invader" };
  target._hostileCreeps.push(hostile);

  const originalObserverConfig = config.OBSERVER;
  config.OBSERVER = {
    ENABLED: true,
    MIN_RCL: 8,
    RUN_INTERVAL: 1,
    MAX_TARGETS_PER_ROOM: 3,
    INTEL_MAX_AGE: 50,
    INCLUDE_ADJACENT_ROOMS: true,
    INCLUDE_REMOTE_ROOMS: true,
    TARGETS: {
      W5N5: ["W5N6", "W6N5", "W4N5", "W5N4", "W7N5"],
    },
  };

  try {
    const state = roomState.collect(room);
    const first = observerManager.run(room, state);
    assert(first.observerCount === 1, `expected one observer, got ${first.observerCount}`);
    assert(first.queuedTargets === 3, `expected bounded queue of 3, got ${first.queuedTargets}`);
    assert(
      currentRuntime.observerActions.length === 1 &&
        currentRuntime.observerActions[0].targetRoom === "W5N6",
      `expected first observer target W5N6, got ${JSON.stringify(currentRuntime.observerActions)}`,
    );

    Game.time = 1001;
    const second = observerManager.run(room, state);
    assert(second.lastObservedTarget === "W6N5", `expected second target W6N5, got ${second.lastObservedTarget}`);
    const intel = Memory.intel.rooms.W5N6;
    assert(intel, "expected visible observed room intel to be stored");
    assert(intel.lastObserved === 1001, `expected lastObserved 1001, got ${intel.lastObserved}`);
    assert(intel.observerRoom === room.name, `expected observer room ${room.name}, got ${intel.observerRoom}`);
    assert(intel.controller.reservation.username === "ally", "expected reservation summary");
    assert(intel.hostileCount === 1, `expected hostile count 1, got ${intel.hostileCount}`);
    assert(intel.sourceCount === 2, `expected source count 2, got ${intel.sourceCount}`);
    assert(intel.mineralType === RESOURCE_UTRIUM, `expected mineral U, got ${intel.mineralType}`);
    assert(intel.structures[STRUCTURE_TOWER] === 1, "expected tower count");
    assert(intel.structures[STRUCTURE_TERMINAL] === 1, "expected terminal count");
    assert(intel.structures[STRUCTURE_STORAGE] === 1, "expected storage count");
    assert(intel.structures[STRUCTURE_NUKER] === 1, "expected nuker count");
    assert(
      JSON.stringify(intel).indexOf('"pos"') === -1 &&
        JSON.stringify(intel).indexOf('"room"') === -1,
      `observer intel should not store raw objects, got ${JSON.stringify(intel)}`,
    );

    Memory.intel.rooms.STALE_OBSERVER_ROOM = {
      roomName: "STALE_OBSERVER_ROOM",
      observerRoom: room.name,
      lastObserved: 900,
    };
    Memory.observer.lastCleanup = 900;
    observerManager.cleanupIntel(observerManager.getSettings());
    assert(
      !Memory.intel.rooms.STALE_OBSERVER_ROOM,
      "expected old observer intel to be removed on cleanup",
    );

    const report = roomReporting.build(room, Object.assign({}, state, {
      observer: observerManager.getStatus(room),
    }), { updateProgress: false });
    assert(roomReporting.normalizeSection("observer") === "observer", "observer section should normalize");
    assert(
      report.sections.observer.some(function (line) {
        return line.indexOf("Observers 1") !== -1;
      }),
      `expected observer count in report, got ${report.sections.observer.join(" / ")}`,
    );
    assert(
      report.sections.observer.some(function (line) {
        return line.indexOf("Intel 1") !== -1;
      }),
      `expected intel count in report, got ${report.sections.observer.join(" / ")}`,
    );

    ops.registerGlobals();
    const captured = captureConsoleLines(function () {
      return global.ops.room(room.name, "observer");
    });
    assert(
      captured.lines.some(function (line) { return line === `[OPS][${room.name}][OBSERVER]`; }),
      `expected observer ops room report, got ${captured.lines.join(" / ")}`,
    );
  } finally {
    config.OBSERVER = originalObserverConfig;
  }
}

function runSchedulerStaggerScenario() {
  resetRuntime(1000);

  const interval = 7;
  const keys = [];
  const seenOffsets = {};
  for (let i = 0; i < 100 && keys.length < 3; i++) {
    const key = `sched.room.${i}.construction`;
    const offset = scheduler.getOffset(key, interval);
    if (seenOffsets[offset]) continue;
    seenOffsets[offset] = true;
    keys.push(key);
  }

  assert(keys.length === 3, `expected three staggerable keys, got ${keys.length}`);

  let totalDue = 0;
  let maxDue = 0;
  for (let t = 1000; t < 1000 + interval; t++) {
    Game.time = t;
    scheduler.startTick();
    let due = 0;
    for (let i = 0; i < keys.length; i++) {
      if (scheduler.canRunOptional(keys[i], interval).ok) due++;
    }
    totalDue += due;
    maxDue = Math.max(maxDue, due);
  }

  assert(maxDue <= 1, `expected staggered keys not to align, max due ${maxDue}`);
  assert(totalDue === keys.length, `expected each key due once, got ${totalDue}`);
}

function runSchedulerBudgetScenario() {
  resetRuntime(1100);

  const originalMax = config.SCHEDULING.MAX_OPTIONAL_TASKS;
  try {
    config.SCHEDULING.MAX_OPTIONAL_TASKS = {
      normal: 1,
      tight: 1,
      critical: 0,
    };
    Memory.stats.runtime = { pressure: "normal" };
    scheduler.startTick();

    assert(
      scheduler.canRunOptional("sched.budget.first", 1).ok,
      "expected first optional task to fit budget",
    );
    scheduler.recordRun("sched.budget.first", 0.1);

    const second = scheduler.canRunOptional("sched.budget.second", 1);
    assert(!second.ok && second.reason === "count", `expected count deferral, got ${JSON.stringify(second)}`);

    Memory.stats.runtime = { pressure: "critical" };
    Game.time += 1;
    scheduler.startTick();
    const critical = scheduler.canRunOptional("sched.budget.critical", 1);
    assert(!critical.ok && critical.reason === "count", `expected critical optional block, got ${JSON.stringify(critical)}`);
  } finally {
    config.SCHEDULING.MAX_OPTIONAL_TASKS = originalMax;
  }
}

function runSchedulerReportScenario() {
  resetRuntime(1200);
  scheduler.startTick();
  scheduler.recordRun("sched.report.task", 0.25);
  scheduler.recordSkip("sched.report.deferred", "budget");

  const report = empireManager.buildReport([]);
  const line = report.lines.find(function (entry) {
    return entry.indexOf("Sched:") === 0;
  });

  assert(line && line.indexOf("ran 1") !== -1 && line.indexOf("deferred 1") !== -1, `expected scheduler report line, got ${JSON.stringify(report.lines)}`);
}

function runSpawnBodyValidationScenario() {
  const validBody = bodies.validateBody([WORK, CARRY, MOVE]);
  assert(validBody.valid, `expected [WORK,CARRY,MOVE] to validate, got ${JSON.stringify(validBody)}`);

  const invalidBody = bodies.validateBody([WORK, undefined, MOVE]);
  assert(
    !invalidBody.valid && invalidBody.reason === "invalid_part",
    `expected invalid part validation, got ${JSON.stringify(invalidBody)}`,
  );

  const room = buildRoomScenario("VAL_SPAWN_BODY_VALIDATION", {
    tick: 900,
    controllerLevel: 3,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    sourceContainers: true,
    roads: true,
    constructionSites: [],
    creeps: [],
  });

  const originalPlan = bodies.plan;

  try {
    bodies.plan = function () {
      return {
        role: "upgrader",
        profile: "broken_test_plan",
        body: [WORK, undefined, MOVE],
        cost: 150,
      };
    };

    const repairedPlan = spawnManager.getValidatedBodyPlan(
      room,
      roomState.collect(room),
      { role: "upgrader" },
    );
    const repairedValidation = bodies.validateBody(repairedPlan.body);

    assert(
      repairedPlan.emergencyFallback === true,
      `expected invalid upgrader plan to fall back, got ${JSON.stringify(repairedPlan)}`,
    );
    assert(
      repairedValidation.valid,
      `expected fallback plan body to validate, got ${JSON.stringify(repairedValidation)}`,
    );
  } finally {
    bodies.plan = originalPlan;
  }
}

function runSpawnBodyMissingEnergyCapacityScenario() {
  const room = buildRoomScenario("VAL_SPAWN_BODY_MISSING_CAPACITY", {
    tick: 905,
    controllerLevel: 3,
    spawnEnergy: 300,
    energyAvailable: 300,
    energyCapacityAvailable: 300,
    sourceContainers: true,
    roads: true,
    creeps: [],
  });

  room.energyCapacityAvailable = undefined;

  const workerPlan = bodies.plan("worker", room, { role: "worker" }, roomState.collect(room));
  const upgraderPlan = bodies.plan("upgrader", room, { role: "upgrader" }, roomState.collect(room));

  assert(
    bodies.validateBody(workerPlan.body).valid,
    `expected worker plan to stay valid when energy capacity is missing, got ${JSON.stringify(workerPlan)}`,
  );
  assert(
    bodies.validateBody(upgraderPlan.body).valid,
    `expected upgrader plan to stay valid when energy capacity is missing, got ${JSON.stringify(upgraderPlan)}`,
  );
}

function runAttackOpsScenario() {
  const parent = buildRoomScenario("W5N5", {
    tick: 910,
    controllerLevel: 4,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    backboneRoads: true,
    creeps: [
      { name: "miner_attack_test", role: "miner", x: 15, y: 25 },
      { name: "hauler_attack_test", role: "hauler", x: 25, y: 25 },
    ],
  });
  parent.controller.my = true;
  parent.controller.owner = { username: "tester" };
  const ally = new FakeRoom("W5N4", new FakeTerrain());
  ally.setController(
    createController(20, 20, {
      roomName: "W5N4",
      level: 4,
      my: true,
      owner: { username: "tester" },
    }),
  );
  ally.addStructure(
    createStructure(STRUCTURE_SPAWN, 25, 25, {
      roomName: "W5N4",
      name: "AllySpawn",
      hits: 5000,
      hitsMax: 5000,
      store: { energy: 1300 },
      storeCapacityResource: { energy: 300 },
    }),
  );
  const allySources = [
    ally.addSource(createSource(15, 25, { roomName: "W5N4" })),
    ally.addSource(createSource(35, 25, { roomName: "W5N4" })),
  ];
  ally.addMineral(createMineral(40, 10, { roomName: "W5N4" }));
  addContainersForSources(ally, allySources);
  addRcl4StableStructures(ally);
  createCreep("ally_miner_attack_test", "miner", 15, 25, {
    roomName: ally.name,
    memory: { sourceId: allySources[0].id },
  });
  createCreep("ally_hauler_attack_test", "hauler", 25, 25, {
    roomName: ally.name,
  });
  Game.gcl = { level: 2, progress: 0, progressTotal: 1000 };

  const target = new FakeRoom("W5N6", new FakeTerrain());
  target.setController(
    createController(20, 20, {
      roomName: "W5N6",
      level: 3,
      owner: { username: "enemy" },
    }),
  );
  target.addStructure(
    createStructure(STRUCTURE_TOWER, 22, 20, {
      roomName: "W5N6",
      my: false,
      hits: 3000,
      hitsMax: 3000,
      store: { energy: 1000 },
      storeCapacityResource: { energy: 1000 },
    }),
  );

  const result = ops.attack("W5N6", "expand", parent.name, [ally.name]);
  assert(result.ok, `expected attack plan creation, got ${result.message}`);
  assert(result.plan.postAction === "expand", `expected default expand postAction, got ${result.plan.postAction}`);
  assert(result.plan.parentRoom === parent.name, `expected parent ${parent.name}, got ${result.plan.parentRoom}`);
  assert(result.plan.allies.indexOf(ally.name) !== -1, `expected explicit ally ${ally.name}, got ${result.plan.allies.join(",")}`);

  const requests = spawnManager.getSpawnRequests(parent, roomState.collect(parent));
  const roles = requests.map((request) => request.role);
  assert(roles.indexOf("dismantler") !== -1, `expected attack to request dismantler, got ${roles.join(",")}`);
  assert(roles.indexOf("upgrader") === -1, `attack hard-war mode should suppress upgraders, got ${roles.join(",")}`);
  assert(roles.indexOf("worker") === -1, `attack hard-war mode should suppress workers, got ${roles.join(",")}`);
  assert(attackManager.isRoomInAttackMode(parent.name), "parent should enter attack mode after offensive request");

  const allyRequests = spawnManager.getSpawnRequests(ally, roomState.collect(ally));
  const allyAttackRoles = allyRequests
    .filter((request) => request.operation === "attack")
    .map((request) => request.role);
  assert(allyAttackRoles.indexOf("dismantler") !== -1, `expected ally to request dismantler, got ${allyAttackRoles.join(",")}`);
  assert(allyAttackRoles.indexOf("assault") !== -1, `expected ally to request assault, got ${allyAttackRoles.join(",")}`);
  assert(allyAttackRoles.indexOf("combat_healer") !== -1, `expected ally to request healer, got ${allyAttackRoles.join(",")}`);
  assert(attackManager.isRoomInAttackMode(ally.name), "ally should enter attack mode after offensive request");
}

function runAttackPostActionFallbackScenario() {
  const parent = buildRoomScenario("W6N5", {
    tick: 915,
    controllerLevel: 4,
    spawnEnergy: 1300,
    energyAvailable: 1300,
    energyCapacityAvailable: 1300,
    sourceContainers: true,
    backboneRoads: true,
    creeps: [],
  });
  parent.controller.my = true;
  parent.controller.owner = { username: "tester" };
  Game.gcl = { level: 1, progress: 0, progressTotal: 1000 };

  const target = new FakeRoom("W6N6", new FakeTerrain());
  target.setController(
    createController(20, 20, {
      roomName: "W6N6",
      level: 0,
    }),
  );

  const result = ops.attack("W6N6", {
    parentRoom: parent.name,
  });
  assert(result.ok, `expected neutral attack plan creation, got ${result.message}`);

  attackManager.run();
  const reservation = reservationManager.getActiveReservation("W6N6");
  assert(reservation, "expand postAction should fall back to reservation when GCL is full");
  assert(!Object.prototype.hasOwnProperty.call(reservation, "focus"), `expected focusless reservation fallback, got ${JSON.stringify(reservation)}`);
  assert(!attackManager.getActiveAttack("W6N6"), "attack should complete after post-neutral reservation fallback");
}

function main() {
  const scenarios = [
    ["bootstrap", runBootstrapScenario],
    ["foundation", runFoundationScenario],
    ["foundation_partial_economy", runFoundationPartialEconomyScenario],
    ["foundation_extensions", runFoundationExtensionScenario],
    ["bootstrap_harvest_spread", runBootstrapHarvestSpreadScenario],
    ["bootstrap_spawn_cap", runBootstrapSpawnCapScenario],
    ["foundation_worker_harvest_spread", runFoundationWorkerHarvestSpreadScenario],
    ["worker_dropped_energy_pickup", runWorkerDroppedEnergyPickupScenario],
    ["worker_closest_energy_buffer", runWorkerClosestEnergyBufferScenario],
    ["worker_reserve_closest_skip_storage", runWorkerReserveClosestSkipsStorageScenario],
    ["worker_energy_harvest_fallback", runWorkerEnergyHarvestFallbackScenario],
    ["jrworker_dropped_energy_pickup", runJrWorkerDroppedEnergyPickupScenario],
    ["storage_cap", runStorageCapScenario],
    ["development", runDevelopmentScenario],
    ["development_storage_priority", runDevelopmentStoragePriorityScenario],
    ["foundation_upgrader_pressure", runFoundationUpgraderPressureScenario],
    ["extension_core", runCompactExtensionCoreScenario],
    ["extension_terrain", runTerrainAwareExtensionPlanScenario],
    ["controller_road_dedup", runControllerRoadDedupScenario],
    ["stamp_road_budget", runStampRoadBudgetScenario],
    ["shared_internal_roads", runSharedInternalRoadScenario],
    ["compact_lab_plan", runCompactLabPlanScenario],
    ["development_storage_gate", runDevelopmentStorageGateScenario],
    ["storage_planning_road_conflict", runStoragePlanningRoadConflictScenario],
    ["storage_planning_dense_terrain", runStoragePlanningDenseTerrainScenario],
    ["storage_planning_harsh_terrain", runStoragePlanningHarshTerrainScenario],
    ["container_usage", runContainerUsageScenario],
    ["logistics", runLogisticsScenario],
    ["specialization", runSpecializationScenario],
    ["extractor_wall_mineral", runExtractorWallMineralScenario],
    ["specialization_transition", runSpecializationTransitionScenario],
    ["mineral_blocked", runMineralMiningBlockedScenario],
    ["mineral_ops", runMineralOpsScenario],
    ["upgrader_reserve", runUpgraderReserveScenario],
    ["rcl8_gcl_push_policy", runRcl8GclPushPolicyScenario],
    ["worker_reserve_banking", runWorkerReserveBankingScenario],
    ["worker_construction_body", runWorkerConstructionBodyScenario],
    ["worker_construction_demand", runWorkerConstructionDemandScenario],
    ["worker_spawn_site_cache", runWorkerSpawnSiteCacheScenario],
    ["worker_construction_priority_consolidation", runWorkerConstructionPriorityConsolidationScenario],
    ["worker_extension_fallback", runWorkerExtensionFallbackScenario],
    ["worker_extension_with_hauler", runWorkerExtensionFallbackWithHaulerScenario],
    ["tower_banking_threshold", runTowerBankingThresholdScenario],
    ["role_task_economy_reconciliation", runRoleTaskEconomyReconciliationScenario],
    ["role_intent_waste_diagnostics", runRoleIntentWasteDiagnosticsScenario],
    ["mineral_access_road", runMineralAccessRoadScenario],
    ["defense_border_support", runDefenseBorderSupportScenario],
    ["defense_west_gate_centering", runDefenseWestGateCenteringScenario],
    ["defense_north_split_gate", runDefenseNorthSplitGateScenario],
    ["defense_corner_gate_coalesce", runDefenseCornerGateCoalesceScenario],
    ["defense_corner_approach_grouping", runDefenseCornerApproachGroupingScenario],
    ["defense_asset_perimeter", runDefenseAssetPerimeterScenario],
    ["defense_tower_only", runDefensePlanLockScenario],
    ["defense_spawn_escalation", runDefenseConflictCleanupScenario],
    ["defense_dismantler_threat", runDefenseDismantlerThreatScenario],
    ["defense_low_tower_core_breach", runDefenseLowTowerCoreBreachScenario],
    ["defense_civilian_evacuation", runCivilianCoreBreachEvacuationScenario],
    ["defense_civilian_fallback", runCivilianCoreBreachFallbackScenario],
    ["defense_burst_queue", runDefenseBurstQueueScenario],
    ["cross_room_defense_no_overcommit", runCrossRoomDefenseNoOvercommitScenario],
    ["cross_room_defense_core_breach_support", runCrossRoomDefenseCoreBreachSupportScenario],
    ["cross_room_defense_support_request", runCrossRoomDefenseSupportRequestScenario],
    ["cross_room_defender_role", runCrossRoomDefenderRoleScenario],
    ["defense_recovery", runDefenseRecoveryScenario],
    ["recovery_tower_banking_deadlock", runRecoveryTowerBankingDeadlockScenario],
    ["recovery_tower_reserve_ignores_banking", runRecoveryTowerReserveIgnoresBankingScenario],
    ["light_recovery", runLightRecoveryScenario],
    ["full_recovery_requires_reserve", runFullRecoveryRequiresReserveScenario],
    ["recovery_failsafe", runRecoveryFailsafeScenario],
    ["recovery_failsafe_blocked", runRecoveryFailsafeBlockedScenario],
    ["recovery_reporting_context", runRecoveryReportingContextScenario],
    ["recovery_build_intent", runRecoveryBuildIntentScenario],
    ["construction_site_worker_floor", runConstructionSiteWorkerFloorScenario],
    ["spawn_energy_fallback", runSpawnEnergyFallbackScenario],
    ["spawn_request_age_tracking", runSpawnRequestAgeTrackingScenario],
    ["invasion_log_owned", runInvasionLogOwnedScenario],
    ["invasion_log_remote", runInvasionLogRemoteScenario],
    ["invasion_log_ops", runInvasionLogOpsScenario],
    ["invasion_log_cap", runInvasionLogCapScenario],
    ["fortification", runFortificationScenario],
    ["rcl7_transition", runRcl7UpgradeTransitionScenario],
    ["rcl8_mineral_catchup", runRcl8MineralCatchupScenario],
    ["legacy_tower_fallback", runLegacyTowerFallbackScenario],
    ["passive_defense_ramparts", runPassiveDefenseRampartBaselineScenario],
    ["passive_defense_early_room", runPassiveDefenseEarlyRoomScenario],
    ["command", runCommandScenario],
    ["command_links", runCommandUtilityLinksScenario],
    ["multi_spawn_balance", runMultiSpawnBalancingScenario],
    ["factory_ops", runFactoryOpsScenario],
    ["power_spawn_processing", runPowerSpawnProcessingScenario],
    ["power_spawn_reserve_block", runPowerSpawnReserveBlockScenario],
    ["power_spawn_threat_block", runPowerSpawnThreatBlockScenario],
    ["power_spawn_cpu_block", runPowerSpawnCpuBlockScenario],
    ["power_reporting", runPowerReportingScenario],
    ["power_operator_controls", runPowerOperatorControlsScenario],
    ["pcl_readiness_commands", runPclReadinessCommandsScenario],
    ["pcl_blocked_readiness", runPclBlockedReadinessScenario],
    ["power_creep_lifecycle_controls", runPowerCreepLifecycleControlsScenario],
    ["power_creep_positioning_support", runPowerCreepPositioningSupportScenario],
    ["power_creep_renewal_assist", runPowerCreepRenewalAssistScenario],
    ["power_creep_ops_generation_controls", runPowerCreepOpsGenerationControlsScenario],
    ["power_creep_generate_ops_automation", runPowerCreepGenerateOpsAutomationScenario],
    ["power_creep_ops_banking", runPowerCreepOpsBankingScenario],
    ["operator_spawn_and_scan_commands", runOperatorSpawnAndScanCommandsScenario],
    ["operator_readiness_reports", runOperatorReadinessReportsScenario],
    ["ops_inventory_and_staging_controls", runOpsInventoryAndStagingControlsScenario],
    ["power_spawn_refill_visibility", runPowerSpawnRefillVisibilityScenario],
    ["power_spawn_refill_energy_request", runPowerSpawnEnergyRefillRequestScenario],
    ["power_spawn_refill_power_request", runPowerSpawnPowerRefillRequestScenario],
    ["power_spawn_refill_reserve_block", runPowerSpawnRefillReserveBlockScenario],
    ["power_spawn_refill_threat_block", runPowerSpawnRefillThreatBlockScenario],
    ["power_spawn_refill_duplicate_suppression", runPowerSpawnRefillDuplicateSuppressionScenario],
    ["power_spawn_refill_report_shape", runPowerSpawnRefillReportShapeScenario],
    ["power_spawn_refill_ownership", runPowerSpawnRefillOwnershipScenario],
    ["power_spawn_refill_hauler_execution", runPowerSpawnRefillHaulerExecutionScenario],
    ["lab_boost_direct", runLabBoostDirectScenario],
    ["lab_boost_intermediate", runLabBoostIntermediateScenario],
    ["lab_loaded_reaction_preserved", runLabLoadedReactionPreservedScenario],
    ["lab_switch_after_target_met", runLabSwitchAfterTargetMetScenario],
    ["lab_targets_met", runLabTargetsMetScenario],
    ["lab_tight_replan", runLabTightReplanScenario],
    ["ops_transfer", runOpsTransferScenario],
    ["ops_logistics_harness_coverage", runOpsLogisticsHarnessCoverageScenario],
    ["advanced_haul_backlog_reporting", runAdvancedHaulBacklogReportingScenario],
    ["logistics_starvation_history", runLogisticsStarvationHistoryScenario],
    ["empire_logistics_pressure_rollup", runEmpireLogisticsPressureRollupScenario],
    ["terminal_balance_manager", runTerminalBalanceManagerScenario],
    ["terminal_hygiene_commands", runTerminalHygieneCommandsScenario],
    ["operator_report_cleanup", runOperatorReportCleanupScenario],
    ["market_intelligence_reports", runMarketIntelligenceReportsScenario],
    ["market_dry_run_planning", runMarketDryRunPlanningScenario],
    ["market_approval_gated_execution", runMarketApprovalGatedExecutionScenario],
    ["market_history_governance", runMarketHistoryGovernanceScenario],
    ["hauler_execution_order_coverage", runHaulerExecutionOrderCoverageScenario],
    ["empire_mineral_transfer", runEmpireMineralTransferScenario],
    ["empire_mineral_blocked", runEmpireMineralBlockedScenario],
    ["empire_mineral_one_transfer", runEmpireMineralOneTransferScenario],
    ["empire_support_worker", runEmpireSupportWorkerScenario],
    ["empire_support_upgrader", runEmpireSupportUpgraderScenario],
    ["empire_support_donor_blocked", runEmpireSupportDonorBlockedScenario],
    ["empire_support_travel", runEmpireSupportTravelScenario],
    ["empire_support_local_construction_priority", runEmpireSupportLocalConstructionPriorityScenario],
    ["empire_awareness", runEmpireAwarenessScenario],
    ["room_review_scheduler", runRoomReviewSchedulerScenario],
    ["room_review_bucket_skip", runRoomReviewBucketSkipScenario],
    ["room_review_recovery_cleanup", runRoomReviewRecoveryCleanupScenario],
    ["room_review_hostile_preserves_defense", runRoomReviewHostilePreservesDefenseScenario],
    ["room_review_spawn_queue", runRoomReviewSpawnQueueScenario],
    ["room_review_construction_advanced", runRoomReviewConstructionAdvancedScenario],
    ["room_review_empire_report", runRoomReviewEmpireReportScenario],
    ["expansion_claim_request", runExpansionClaimRequestScenario],
    ["expansion_full_construction", runExpansionFullConstructionScenario],
    ["focus_removed_ops", runFocusRemovedOpsScenario],
    ["expansion_independence", runExpansionIndependenceScenario],
    ["expansion_pioneer_request", runExpansionPioneerRequestScenario],
    ["expansion_claimer_role", runExpansionClaimerRoleScenario],
    ["expansion_pioneer_spawn_site", runExpansionPioneerSpawnSiteScenario],
    ["expansion_hud_labels", runExpansionHudLabelsScenario],
    ["reservation_ops", runReservationOpsScenario],
    ["reserved_room_hud", runReservedRoomHudScenario],
    ["reservation_stable_gate", runReservationStableGateScenario],
    ["reservation_early_plan", runReservationEarlyPlanScenario],
    ["reservation_reserver_role", runReservationReserverRoleScenario],
    ["reservation_remote_construction", runReservationRemoteConstructionScenario],
    ["reservation_remote_requests", runReservationRemoteRequestsScenario],
    ["reservation_remote_roles", runReservationRemoteRolesScenario],
    ["reservation_defense", runReservationDefenseScenario],
    ["reservation_threat_defense", runReservationThreatDefenseScenario],
    ["reservation_stale_threat_defense", runReservationStaleThreatDefenseScenario],
    ["reservation_remote_hauler_storage", runReservationRemoteHaulerStorageDeliveryScenario],
    ["reservation_expansion_takeover", runReservationExpansionTakeoverScenario],
    ["expansion_reservation_takeover", runExpansionReservationTakeoverScenario],
    ["expansion_cancel", runExpansionCancellationScenario],
    ["reservation_cancel", runReservationCancellationScenario],
    ["expansion_stale_threat_defense", runExpansionStaleThreatDefenseScenario],
    ["expansion_threat_retreat", runExpansionThreatRetreatScenario],
    ["hud_config_controls", runHudConfigControlsScenario],
    ["cpu_soft_limit", runCpuSoftLimitScenario],
    ["ops_cpu_report_shape", runOpsCpuReportShapeScenario],
    ["production_factory_visibility", runProductionFactoryVisibilityScenario],
    ["production_lab_visibility", runProductionLabVisibilityScenario],
    ["labor_diagnostics_visibility", runLaborDiagnosticsVisibilityScenario],
    ["observer_scheduler", runObserverSchedulerScenario],
    ["cpu_room_scale", runCpuRoomScaleScenario],
    ["scheduler_stagger", runSchedulerStaggerScenario],
    ["scheduler_budget", runSchedulerBudgetScenario],
    ["scheduler_report", runSchedulerReportScenario],
    ["attack_ops", runAttackOpsScenario],
    ["attack_post_action_fallback", runAttackPostActionFallbackScenario],
    ["spawn_body_validation", runSpawnBodyValidationScenario],
    ["spawn_body_missing_energy_capacity", runSpawnBodyMissingEnergyCapacityScenario],
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
