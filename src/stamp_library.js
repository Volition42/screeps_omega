/*
Developer Summary:
Stamp Library

Purpose:
- Define reusable stamp / tile-set layouts
- Provide shared origin and candidate placement helpers
- Keep stamp logic centralized so construction and status stay synced

Current Stamps:
- anchor_v1:
    spawn-centered minimal road spine / hub seed
- extension_hall_v1:
    compact extension pod with a short internal hallway
- tower_cluster_v1:
    compact tower support stamp
- storage_hub_v1:
    storage-centered utility hub with minimal cardinals for advanced logistics
- lab_cluster_v1:
    first 3-lab cluster with minimal access roads
- lab_compact_v1:
    compact multi-lab cluster for the full reaction set

Important Notes:
- The anchor uses the first owned spawn as its origin.
- Stamps are defined relative to an origin tile.
- Roads may overlap existing roads safely, but not blocking structures.
*/

module.exports = {
  STAMPS: {
    anchor_v1: {
      name: "anchor_v1",
      roads: [
        { x: 0, y: -3 },
        { x: 0, y: -2 },
        { x: 0, y: -1 },
        { x: -1, y: -1 },
        { x: 1, y: -1 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
      extensions: [],
      towers: [],
      reserved: [
        { x: -2, y: 0, tag: "spawn_slot" },
        { x: 2, y: 0, tag: "spawn_slot" },
        { x: -1, y: 2, tag: "hub_slot" },
        { x: 1, y: 2, tag: "hub_slot" },
        { x: -3, y: 1, tag: "utility_slot" },
        { x: 3, y: 1, tag: "utility_slot" },
        { x: -3, y: -1, tag: "utility_slot" },
        { x: 3, y: -1, tag: "utility_slot" },
        { x: 0, y: -4, tag: "late_slot" },
        { x: -3, y: -3, tag: "late_slot" },
        { x: 3, y: -3, tag: "late_slot" },
        { x: 0, y: -6, tag: "late_slot" },
      ],
    },

    extension_hall_v1: {
      name: "extension_hall_v1",
      roads: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
      ],
      extensions: [
        { x: -1, y: -1 },
        { x: 0, y: -1 },
        { x: 1, y: -1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: -1, y: 1 },
        { x: 1, y: 1 },
        { x: -1, y: 2 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
      ],
      towers: [],
      reserved: [],
    },

    tower_cluster_v1: {
      name: "tower_cluster_v1",
      roads: [],
      extensions: [],
      towers: [{ x: 0, y: 0 }],
      reserved: [],
    },

    storage_hub_v1: {
      name: "storage_hub_v1",
      roads: [
        { x: 0, y: -1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
      storages: [{ x: 0, y: 0 }],
      extensions: [],
      towers: [],
      labs: [],
      reserved: [
        { x: -2, y: 0, tag: "storage_link_slot" },
        { x: 2, y: 0, tag: "terminal_slot" },
        { x: 0, y: 2, tag: "lab_anchor_slot" },
        { x: -2, y: 1, tag: "utility_slot" },
        { x: 2, y: 1, tag: "utility_slot" },
        { x: 0, y: 3, tag: "utility_slot" },
      ],
    },

    lab_cluster_v1: {
      name: "lab_cluster_v1",
      roads: [
        { x: 1, y: 0 },
        { x: 0, y: 1 },
      ],
      storages: [],
      extensions: [],
      towers: [],
      labs: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
      ],
      reserved: [],
    },

    lab_compact_v1: {
      name: "lab_compact_v1",
      roads: [
        { x: 0, y: 1 },
        { x: 1, y: 0 },
      ],
      storages: [],
      extensions: [],
      towers: [],
      labs: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: -1, y: 0 },
        { x: 0, y: -1 },
        { x: 1, y: -1 },
        { x: 2, y: 0 },
        { x: -1, y: 1 },
        { x: 0, y: 2 },
        { x: 1, y: 2 },
        { x: 2, y: 1 },
      ],
      reserved: [],
    },
  },

  getStamp(name) {
    return this.STAMPS[name];
  },

  isRoomCoordinateValid(value) {
    return typeof value === "number" && value >= 1 && value <= 48;
  },

  isOriginValid(origin) {
    return (
      !!origin &&
      !!origin.roomName &&
      this.isRoomCoordinateValid(origin.x) &&
      this.isRoomCoordinateValid(origin.y)
    );
  },

  filterValidOrigins(origins) {
    var results = [];

    for (var i = 0; i < origins.length; i++) {
      if (this.isOriginValid(origins[i])) {
        results.push(origins[i]);
      }
    }

    return results;
  },

  getCellPosition(origin, cell) {
    if (!this.isOriginValid(origin) || !cell) return null;

    var x = origin.x + cell.x;
    var y = origin.y + cell.y;

    if (!this.isRoomCoordinateValid(x) || !this.isRoomCoordinateValid(y)) {
      return null;
    }

    return new RoomPosition(x, y, origin.roomName);
  },

  getAnchorOrigin(room, state) {
    var spawn = null;

    if (state && state.spawns && state.spawns.length > 0) {
      spawn = state.spawns[0];
    } else {
      var spawns = room.find(FIND_MY_SPAWNS);
      if (spawns.length > 0) spawn = spawns[0];
    }

    if (!spawn) return null;

    return {
      x: spawn.pos.x,
      y: spawn.pos.y,
      roomName: room.name,
    };
  },

  getDefaultExtensionStampName() {
    return "extension_hall_v1";
  },

  getExtensionStampOrigins(anchor) {
    if (!anchor) return [];

    return this.filterValidOrigins([
      { x: anchor.x - 4, y: anchor.y - 6, roomName: anchor.roomName },
      { x: anchor.x + 4, y: anchor.y - 6, roomName: anchor.roomName },
      { x: anchor.x - 6, y: anchor.y - 1, roomName: anchor.roomName },
      { x: anchor.x + 6, y: anchor.y - 1, roomName: anchor.roomName },
      { x: anchor.x - 4, y: anchor.y + 4, roomName: anchor.roomName },
      { x: anchor.x + 4, y: anchor.y + 4, roomName: anchor.roomName },
      { x: anchor.x - 8, y: anchor.y + 4, roomName: anchor.roomName },
      { x: anchor.x + 8, y: anchor.y + 4, roomName: anchor.roomName },
      { x: anchor.x - 8, y: anchor.y - 4, roomName: anchor.roomName },
      { x: anchor.x + 8, y: anchor.y - 4, roomName: anchor.roomName },
    ]);
  },

  getTowerStampOrigins(anchor) {
    if (!anchor) return [];

    return this.filterValidOrigins([
      { x: anchor.x - 6, y: anchor.y, roomName: anchor.roomName },
      { x: anchor.x - 4, y: anchor.y, roomName: anchor.roomName },
      { x: anchor.x + 4, y: anchor.y, roomName: anchor.roomName },
      { x: anchor.x + 6, y: anchor.y, roomName: anchor.roomName },
      { x: anchor.x - 2, y: anchor.y - 4, roomName: anchor.roomName },
      { x: anchor.x + 2, y: anchor.y - 4, roomName: anchor.roomName },
    ]);
  },

  getStorageStampOrigins(anchor) {
    if (!anchor) return [];

    return this.filterValidOrigins([
      { x: anchor.x, y: anchor.y + 4, roomName: anchor.roomName },
      { x: anchor.x + 4, y: anchor.y, roomName: anchor.roomName },
      { x: anchor.x - 4, y: anchor.y, roomName: anchor.roomName },
      { x: anchor.x, y: anchor.y - 4, roomName: anchor.roomName },
    ]);
  },

  getLabCompactStampOrigins(storagePos) {
    if (!this.isOriginValid(storagePos)) return [];

    return this.filterValidOrigins([
      { x: storagePos.x + 2, y: storagePos.y + 2, roomName: storagePos.roomName },
      { x: storagePos.x - 3, y: storagePos.y + 2, roomName: storagePos.roomName },
      { x: storagePos.x + 2, y: storagePos.y - 3, roomName: storagePos.roomName },
      { x: storagePos.x - 3, y: storagePos.y - 3, roomName: storagePos.roomName },
      { x: storagePos.x + 4, y: storagePos.y + 1, roomName: storagePos.roomName },
      { x: storagePos.x - 5, y: storagePos.y + 1, roomName: storagePos.roomName },
    ]);
  },

  getExtensionCapacity(stampName) {
    var stamp = this.getStamp(stampName);
    if (!stamp) return 0;
    return stamp.extensions.length;
  },

  getTowerCapacity(stampName) {
    var stamp = this.getStamp(stampName);
    if (!stamp) return 0;
    return stamp.towers.length;
  },

  forEachRoadPosition(origin, stampName, fn, context) {
    var stamp = this.getStamp(stampName);
    if (!stamp) return;

    for (var i = 0; i < stamp.roads.length; i++) {
      var cell = stamp.roads[i];
      var pos = this.getCellPosition(origin, cell);
      if (!pos) continue;
      fn.call(context, pos, cell);
    }
  },

  forEachExtensionPosition(origin, stampName, fn, context) {
    var stamp = this.getStamp(stampName);
    if (!stamp) return;

    for (var i = 0; i < stamp.extensions.length; i++) {
      var cell = stamp.extensions[i];
      var pos = this.getCellPosition(origin, cell);
      if (!pos) continue;
      fn.call(context, pos, cell);
    }
  },

  forEachTowerPosition(origin, stampName, fn, context) {
    var stamp = this.getStamp(stampName);
    if (!stamp) return;

    for (var i = 0; i < stamp.towers.length; i++) {
      var cell = stamp.towers[i];
      var pos = this.getCellPosition(origin, cell);
      if (!pos) continue;
      fn.call(context, pos, cell);
    }
  },

  forEachStoragePosition(origin, stampName, fn, context) {
    var stamp = this.getStamp(stampName);
    if (!stamp || !stamp.storages) return;

    for (var i = 0; i < stamp.storages.length; i++) {
      var cell = stamp.storages[i];
      var pos = this.getCellPosition(origin, cell);
      if (!pos) continue;
      fn.call(context, pos, cell);
    }
  },

  forEachLabPosition(origin, stampName, fn, context) {
    var stamp = this.getStamp(stampName);
    if (!stamp || !stamp.labs) return;

    for (var i = 0; i < stamp.labs.length; i++) {
      var cell = stamp.labs[i];
      var pos = this.getCellPosition(origin, cell);
      if (!pos) continue;
      fn.call(context, pos, cell);
    }
  },

  forEachReservedPosition(origin, stampName, fn, context) {
    var stamp = this.getStamp(stampName);
    if (!stamp) return;

    for (var i = 0; i < stamp.reserved.length; i++) {
      var cell = stamp.reserved[i];
      var pos = this.getCellPosition(origin, cell);
      if (!pos) continue;
      fn.call(context, pos, cell);
    }
  },

  getReservedPositions(origin, stampName, tag) {
    var positions = [];

    this.forEachReservedPosition(
      origin,
      stampName,
      function (pos, cell) {
        if (tag && cell.tag !== tag) return;
        positions.push(pos);
      },
      this,
    );

    return positions;
  },
};
