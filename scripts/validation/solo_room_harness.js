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

function resetRuntime(tick) {
  currentRuntime = {
    nextId: 0,
    rooms: {},
    objectsById: {},
    spawnEvents: [],
    towerActions: [],
    creepActions: [],
    visuals: [],
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
const ops = require("ops");
const creepManager = require("creep_manager");
const hud = require("hud");
const advancedStructureManager = require("advanced_structure_manager");
const defenseManager = require("defense_manager");
const defenseLayout = require("defense_layout");
const linkManager = require("link_manager");
const logisticsManager = require("logistics_manager");
const roleWorker = require("role_worker");
const roleJrWorker = require("role_jrworker");
const roleClaimer = require("role_claimer");
const rolePioneer = require("role_pioneer");
const roleReserver = require("role_reserver");
const roleRemoteWorker = require("role_remoteworker");
const roleRemoteMiner = require("role_remoteminer");
const roleRemoteHauler = require("role_remotehauler");
const roleDefender = require("role_defender");
const towerManager = require("tower_manager");
const statsManager = require("stats_manager");
const utils = require("utils");
const config = require("config");
const stamps = require("stamp_library");

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
      { type: STRUCTURE_TERMINAL, x: 25, y: 32, options: { store: { energy: 10000 }, storeCapacity: 300000, hits: 3000, hitsMax: 3000 } },
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

  room.storage.store.energy = 120000;
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
        x: 23,
        y: 21,
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
    helpLines.some(function (line) { return line === "ops.roomRole([roomName], [role])"; }),
    `expected help to include roomRole command, got ${helpLines.join(" / ")}`,
  );
  assert(
    helpLines.every(function (line) { return line.length <= 80; }),
    `expected help output lines to stay within 80 chars, got ${helpLines.filter(function (line) { return line.length > 80; }).join(" / ")}`,
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
  assert(
    empireManager.getActiveExpansion(target.name).focus === "full",
    "expansion should default to full focus",
  );
  delete empireManager.getActiveExpansion(target.name).focus;
  assert(
    empireManager.getActiveExpansion(target.name).focus === "full",
    "legacy expansion plan should backfill full focus",
  );

  const empireReport = empireManager.buildReport();
  assert(
    empireReport.lines.some(function (line) {
      return line.indexOf("expansion VA") !== -1 &&
        line.indexOf("full") !== -1 &&
        line.indexOf("Claim controller") !== -1;
    }),
    `expected empire report to group expansion with focus under parent, got ${empireReport.lines.join(" / ")}`,
  );
  let lines = empireManager.getExpansionLines();
  assert(
    lines.some(function (line) {
      return line.indexOf(target.name) !== -1 && line.indexOf("focus full") !== -1;
    }),
    `expected expansion report to show full focus, got ${lines.join(" / ")}`,
  );

  const mineralResult = empireManager.createExpansion(target.name, parent.name, "mineral");
  assert(mineralResult.ok, `expected mineral focus conversion, got ${mineralResult.message}`);
  assert(
    empireManager.getActiveExpansion(target.name).focus === "mineral",
    "expansion should switch to mineral focus",
  );
  lines = empireManager.getExpansionLines();
  assert(
    lines.some(function (line) {
      return line.indexOf(target.name) !== -1 && line.indexOf("focus mineral") !== -1;
    }),
    `expected expansion report to show mineral focus, got ${lines.join(" / ")}`,
  );

  const energyResult = empireManager.createExpansion(target.name, parent.name, "energy");
  assert(energyResult.ok, `expected energy focus conversion, got ${energyResult.message}`);
  assert(
    empireManager.getActiveExpansion(target.name).focus === "energy",
    "expansion should switch to energy focus",
  );

  const state = roomState.collect(parent);
  const requests = spawnManager.getSpawnRequests(parent, state);
  const claimRequest = requests.find(function (request) {
    return request.role === "claimer" && request.targetRoom === target.name;
  });

  assert(claimRequest, "active expansion should request a claimer from the parent room");
  assert(claimRequest.homeRoom === parent.name, "claimer request should keep parent as home room");
  assert(claimRequest.operation === "expansion", "claimer request should be marked as expansion work");
}

function runExpansionFocusConstructionScenario() {
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
    focus: "full",
    createdAt: Game.time,
  };

  let state = roomState.collect(room);
  state.phase = "command";
  let status = constructionStatus.getStatus(room, state);
  assert(status.towersNeeded > 2, `full focus should keep normal tower max, got ${status.towersNeeded}`);
  assert(status.labsNeeded === 10, `full focus should keep full labs, got ${status.labsNeeded}`);
  assert(status.factoryNeeded === 1, `full focus should keep factory, got ${status.factoryNeeded}`);
  assert(status.terminalNeeded === 1, `full focus should keep terminal, got ${status.terminalNeeded}`);
  assert(status.extractorNeeded === 1, `full focus should keep extractor, got ${status.extractorNeeded}`);

  Memory.empire.expansion.plans[room.name].focus = "mineral";
  state = roomState.collect(room);
  state.phase = "command";
  status = constructionStatus.getStatus(room, state);
  assert(status.towersNeeded === 2, `mineral focus should cap towers at 2, got ${status.towersNeeded}`);
  assert(status.labsNeeded === 3, `mineral focus should keep minimal 3 labs, got ${status.labsNeeded}`);
  assert(status.factoryNeeded === 0, `mineral focus should skip factory, got ${status.factoryNeeded}`);
  assert(status.terminalNeeded === 1, `mineral focus should keep terminal, got ${status.terminalNeeded}`);
  assert(status.extractorNeeded === 1, `mineral focus should keep extractor, got ${status.extractorNeeded}`);
  assert(status.mineralContainersNeeded === 1, `mineral focus should keep mineral container, got ${status.mineralContainersNeeded}`);

  Memory.empire.expansion.plans[room.name].focus = "energy";
  state = roomState.collect(room);
  state.phase = "command";
  status = constructionStatus.getStatus(room, state);
  assert(status.towersNeeded === 2, `energy focus should cap towers at 2, got ${status.towersNeeded}`);
  assert(status.labsNeeded === 0, `energy focus should skip labs, got ${status.labsNeeded}`);
  assert(status.factoryNeeded === 0, `energy focus should skip factory, got ${status.factoryNeeded}`);
  assert(status.terminalNeeded === 1, `energy focus should keep terminal, got ${status.terminalNeeded}`);
  assert(status.extractorNeeded === 0, `energy focus should skip extractor, got ${status.extractorNeeded}`);
  assert(status.mineralContainersNeeded === 0, `energy focus should skip mineral container, got ${status.mineralContainersNeeded}`);

  const report = roomReporting.build(room, state, { updateProgress: false });
  assert(
    report.hudLines.some(function (line) {
      return line.indexOf("Expansion energy") !== -1;
    }),
    `expected room HUD to show expansion energy focus, got ${JSON.stringify(report.hudLines)}`,
  );
  assert(
    report.hudLines[0].indexOf("RCL") === -1 &&
      report.hudLines[1].indexOf("RCL") === 0 &&
      report.hudLines[1].indexOf("ETA") !== -1,
    `expected expansion room HUD to put RCL/ETA on second line, got ${JSON.stringify(report.hudLines)}`,
  );
}

function runRoomRoleOpsScenario() {
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

  ops.registerGlobals();
  global.ops.room(room.name, "overview");
  let result = global.ops.roomRole();
  assert(result.ok && result.role === "full", `expected legacy owned room focus to migrate to full, got ${JSON.stringify(result)}`);
  assert(Memory.rooms[room.name].roomFocus === "full", "owned room focus migration should write full to room memory");

  result = global.ops.roomRole("energy");
  assert(result.ok && result.role === "energy", `expected current room energy focus, got ${JSON.stringify(result)}`);
  assert(Memory.rooms[room.name].roomFocus === "energy", "roomRole should update owned room focus memory");

  const parent = buildStableReservationParent("W4N5", 983);
  const remote = buildNeutralReserveRoom("W4N6");
  const reserve = reservationManager.createReservation(remote.name, parent.name);
  assert(reserve.ok, `expected reservation setup, got ${reserve.message}`);
  result = global.ops.roomRole(remote.name, "energy");
  assert(!result.ok && result.message.indexOf("reserved rooms use") !== -1, `expected energy focus rejection for reservation, got ${JSON.stringify(result)}`);
  result = global.ops.roomRole(remote.name, "hold");
  assert(result.ok && reservationManager.getActiveReservation(remote.name).focus === "hold", `expected reservation hold focus, got ${JSON.stringify(result)}`);

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
  const expansion = empireManager.createExpansion(target.name, parent.name, "full");
  assert(expansion.ok, `expected expansion setup, got ${expansion.message}`);
  result = global.ops.roomRole(target.name, "mineral");
  assert(result.ok && empireManager.getActiveExpansion(target.name).focus === "mineral", `expected expansion mineral focus, got ${JSON.stringify(result)}`);
}

function runExpansionIndependenceScenario() {
  const target = buildRoomScenario("W3N4", {
    tick: 984,
    controllerLevel: 3,
    spawnEnergy: 800,
    energyAvailable: 800,
    energyCapacityAvailable: 800,
    sourceContainers: true,
    supportContainers: true,
    foundationRoads: true,
    backboneRoads: true,
    creeps: [
      { name: "independentWorker", role: "worker", x: 24, y: 25 },
    ],
  });
  target.controller.my = true;
  target.controller.owner = { username: "tester" };
  const parent = new FakeRoom("W3N3", new FakeTerrain());
  parent.setController(
    createController(20, 20, {
      roomName: parent.name,
      level: 4,
    }),
  );
  parent.controller.my = true;
  parent.controller.owner = { username: "tester" };
  parent.addStructure(
    createStructure(STRUCTURE_SPAWN, 25, 25, {
      roomName: parent.name,
      name: "ParentSpawn",
      store: { energy: 300 },
      storeCapacityResource: { energy: 300 },
      hits: 5000,
      hitsMax: 5000,
    }),
  );
  parent.addSource(createSource(15, 25, { roomName: parent.name }));
  parent.addMineral(createMineral(35, 20, { roomName: parent.name }));
  parent.energyAvailable = 300;
  parent.energyCapacityAvailable = 1300;
  if (!Memory.rooms[parent.name]) Memory.rooms[parent.name] = {};
  const expansion = empireManager.createExpansion(target.name, parent.name, "energy");
  assert(expansion.ok, `expected expansion setup, got ${expansion.message}`);
  assert(empireManager.getActiveExpansion(target.name).parentRoom === parent.name, "RCL3 expansion should keep parent");

  target.controller.level = 4;
  addRcl4StableStructures(target);
  Memory.rooms[parent.name].spawnQueue = [
    { role: "pioneer", targetRoom: target.name, operation: "expansion" },
    { role: "defender", targetRoom: target.name, operation: "expansion_defense" },
  ];
  const plan = empireManager.getActiveExpansion(target.name);
  assert(plan && plan.parentRoom === null, `RCL4 expansion should clear parent, got ${JSON.stringify(plan)}`);
  assert(plan.independentAt === Game.time, "RCL4 expansion should record independentAt");
  assert(plan.focus === "energy", "RCL4 expansion should preserve focus");
  assert(Memory.rooms[parent.name].spawnQueue.length === 0, "RCL4 independence should prune parent expansion queue");

  const report = empireManager.buildReport();
  assert(
    !report.lines.some(function (line) { return line.indexOf(`expansion ${target.name}`) !== -1; }),
    `independent expansion should not render as child row, got ${report.lines.join(" / ")}`,
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
  assert(
    reservationManager.getActiveReservation("W5N6").focus === "full",
    "reservation should default to full focus",
  );
  delete reservationManager.getActiveReservation("W5N6").focus;
  delete reservationManager.getActiveReservation("W5N6").operation;
  assert(
    reservationManager.getActiveReservation("W5N6").focus === "full" &&
      reservationManager.getActiveReservation("W5N6").operation === "reservation",
    "legacy reservation plan should backfill full focus and operation marker",
  );

  const lines = global.ops.reserved(parent.name);
  assert(
    lines.some(function (line) { return line.indexOf("W5N6") !== -1; }),
    `expected reserved report to list W5N6, got ${lines.join(" / ")}`,
  );
  assert(
    lines.some(function (line) { return line.indexOf("W5N6") !== -1 && line.indexOf("full") !== -1; }),
    `expected reserved report to list full focus, got ${lines.join(" / ")}`,
  );

  Memory.rooms[parent.name].spawnQueue = [
    { role: "remoteworker", targetRoom: "W5N6", operation: "reservation" },
    { role: "remoteminer", targetRoom: "W5N6", operation: "reservation" },
    { role: "remotehauler", targetRoom: "W5N6", operation: "reservation" },
    { role: "reserver", targetRoom: "W5N6", operation: "reservation" },
    { role: "defender", targetRoom: "W5N6", operation: "reservation_defense" },
  ];
  const holdResult = global.ops.reserve("W5N6", "hold");
  assert(holdResult.ok, `expected hold reservation conversion, got ${holdResult.message}`);
  assert(
    reservationManager.getActiveReservation("W5N6").focus === "hold",
    "reservation should switch to hold focus",
  );
  assert(
    Memory.rooms[parent.name].spawnQueue.length === 2 &&
      Memory.rooms[parent.name].spawnQueue.some(function (item) { return item.role === "reserver"; }) &&
      Memory.rooms[parent.name].spawnQueue.some(function (item) { return item.role === "defender"; }),
    "hold conversion should prune queued remote economy creeps but keep reserver and defense requests",
  );
  const fullResult = global.ops.reserve("W5N6", "full");
  assert(fullResult.ok, `expected full reservation conversion, got ${fullResult.message}`);
  assert(
    reservationManager.getActiveReservation("W5N6").focus === "full",
    "reservation should switch back to full focus",
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
  result = reservationManager.createReservation("W6N7", parent.name, "hold");
  assert(result.ok, `expected hold reservation plan creation, got ${result.message}`);
  state = roomState.collect(parent);
  requests = spawnManager.getSpawnRequests(parent, state);
  assert(
    requests.some(function (request) { return request.role === "reserver" && request.targetRoom === "W6N7"; }),
    "hold reservation should request a reserver",
  );
  assert(
    !requests.some(function (request) {
      return (
        request.targetRoom === "W6N7" &&
        (
          request.role === "remoteworker" ||
          request.role === "remoteminer" ||
          request.role === "remotehauler"
        )
      );
    }),
    "hold reservation should not request remote economy creeps",
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

function runReservationHoldDefenseScenario() {
  const parent = buildStableReservationParent("W11N7", 1160);
  buildNeutralReserveRoom("W11N8", {
    reservation: { username: "tester", ticksToEnd: 3500 },
    sourceContainers: true,
    hostiles: [{ name: "holdInvader", x: 23, y: 23, body: [{ type: ATTACK }, { type: MOVE }] }],
  });
  const result = reservationManager.createReservation("W11N8", parent.name, "hold");
  assert(result.ok, `expected hold reservation plan, got ${result.message}`);

  const state = roomState.collect(parent);
  const requests = spawnManager.getSpawnRequests(parent, state);
  const reserver = requests.find(function (request) {
    return request.role === "reserver" && request.targetRoom === "W11N8";
  });
  const defender = requests.find(function (request) {
    return request.role === "defender" && request.targetRoom === "W11N8";
  });

  assert(reserver, `expected hold reservation to keep a reserver active, got ${JSON.stringify(requests)}`);
  assert(defender, `expected hold reservation threat to request defense support, got ${JSON.stringify(requests)}`);
  assert(
    !requests.some(function (request) {
      return request.targetRoom === "W11N8" && (
        request.role === "remoteworker" ||
        request.role === "remoteminer" ||
        request.role === "remotehauler"
      );
    }),
    `hold reservation should not request remote economy creeps, got ${JSON.stringify(requests)}`,
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
  const reserveResult = global.ops.reserve("W12N8", "hold");
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
    reservationManager.getActiveReservation("W12N8").focus === "hold",
    "reservation takeover should keep requested focus",
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
    ["worker_reserve_banking", runWorkerReserveBankingScenario],
    ["worker_spawn_site_cache", runWorkerSpawnSiteCacheScenario],
    ["tower_banking_threshold", runTowerBankingThresholdScenario],
    ["mineral_access_road", runMineralAccessRoadScenario],
    ["defense_border_support", runDefenseBorderSupportScenario],
    ["defense_west_gate_centering", runDefenseWestGateCenteringScenario],
    ["defense_north_split_gate", runDefenseNorthSplitGateScenario],
    ["defense_corner_gate_coalesce", runDefenseCornerGateCoalesceScenario],
    ["defense_corner_approach_grouping", runDefenseCornerApproachGroupingScenario],
    ["defense_asset_perimeter", runDefenseAssetPerimeterScenario],
    ["defense_tower_only", runDefensePlanLockScenario],
    ["defense_spawn_escalation", runDefenseConflictCleanupScenario],
    ["cross_room_defense_support_request", runCrossRoomDefenseSupportRequestScenario],
    ["cross_room_defender_role", runCrossRoomDefenderRoleScenario],
    ["fortification", runFortificationScenario],
    ["rcl7_transition", runRcl7UpgradeTransitionScenario],
    ["rcl8_mineral_catchup", runRcl8MineralCatchupScenario],
    ["legacy_tower_fallback", runLegacyTowerFallbackScenario],
    ["command", runCommandScenario],
    ["command_links", runCommandUtilityLinksScenario],
    ["multi_spawn_balance", runMultiSpawnBalancingScenario],
    ["factory_ops", runFactoryOpsScenario],
    ["empire_awareness", runEmpireAwarenessScenario],
    ["expansion_claim_request", runExpansionClaimRequestScenario],
    ["expansion_focus_construction", runExpansionFocusConstructionScenario],
    ["room_role_ops", runRoomRoleOpsScenario],
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
    ["reservation_hold_defense", runReservationHoldDefenseScenario],
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
    ["cpu_room_scale", runCpuRoomScaleScenario],
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
