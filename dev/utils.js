module.exports = {
  getWalkableAdjacentPositions(pos) {
    const terrain = Game.map.getRoomTerrain(pos.roomName);
    const results = [];

    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;

        const x = pos.x + dx;
        const y = pos.y + dy;

        if (x < 1 || x > 48 || y < 1 || y > 48) continue;
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

        results.push(new RoomPosition(x, y, pos.roomName));
      }
    }

    return results;
  },

  getControllerContainerPositions(room, count) {
    if (!room.controller) return [];

    const terrain = Game.map.getRoomTerrain(room.name);
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const candidates = [];

    for (
      let x = room.controller.pos.x - 3;
      x <= room.controller.pos.x + 3;
      x++
    ) {
      for (
        let y = room.controller.pos.y - 3;
        y <= room.controller.pos.y + 3;
        y++
      ) {
        if (x < 1 || x > 48 || y < 1 || y > 48) continue;

        const pos = new RoomPosition(x, y, room.name);
        const range = pos.getRangeTo(room.controller.pos);

        // Preferred controller container placement is 2-3 away.
        if (range < 2 || range > 3) continue;
        if (terrain.get(x, y) === TERRAIN_MASK_WALL) continue;

        candidates.push(pos);
      }
    }

    candidates.sort(function (a, b) {
      const aScore = spawn ? a.getRangeTo(spawn) : 0;
      const bScore = spawn ? b.getRangeTo(spawn) : 0;
      return aScore - bScore;
    });

    const chosen = [];

    for (const pos of candidates) {
      const blocked = pos.lookFor(LOOK_STRUCTURES).length > 0;
      const siteBlocked = pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0;
      if (blocked || siteBlocked) continue;

      const tooClose = _.some(chosen, function (other) {
        return pos.getRangeTo(other) <= 1;
      });

      if (!tooClose) {
        chosen.push(pos);
      }

      if (chosen.length >= count) break;
    }

    return chosen;
  },

  getSourceContainerPosition(room, source) {
    const spawn = room.find(FIND_MY_SPAWNS)[0];
    const positions = this.getWalkableAdjacentPositions(source.pos);

    positions.sort(function (a, b) {
      const aScore = spawn ? a.getRangeTo(spawn) : 0;
      const bScore = spawn ? b.getRangeTo(spawn) : 0;
      return aScore - bScore;
    });

    for (const pos of positions) {
      const blocked = pos.lookFor(LOOK_STRUCTURES).length > 0;
      const siteBlocked = pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0;

      if (!blocked && !siteBlocked) {
        return pos;
      }
    }

    return null;
  },

  getSourceContainerBySource(room, sourceId) {
    const source = Game.getObjectById(sourceId);
    if (!source) return null;

    return (
      source.pos.findInRange(FIND_STRUCTURES, 1, {
        filter: function (s) {
          return s.structureType === STRUCTURE_CONTAINER;
        },
      })[0] || null
    );
  },

  getControllerContainers(room) {
    if (!room.controller) return [];

    return room.find(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          s.pos.getRangeTo(room.controller) <= 4
        );
      },
    });
  },

  getSourceContainers(room) {
    const sources = room.find(FIND_SOURCES);

    return room.find(FIND_STRUCTURES, {
      filter: function (s) {
        return (
          s.structureType === STRUCTURE_CONTAINER &&
          _.some(sources, function (source) {
            return s.pos.getRangeTo(source) <= 1;
          })
        );
      },
    });
  },

  getUpgraderWorkPosition(room, container) {
    if (!room.controller || !container) return null;

    const terrain = Game.map.getRoomTerrain(room.name);
    const candidates = [];
    const spawn = room.find(FIND_MY_SPAWNS)[0];

    const around = [container.pos].concat(
      this.getWalkableAdjacentPositions(container.pos),
    );

    for (const pos of around) {
      if (pos.getRangeTo(container.pos) > 1) continue;
      if (pos.getRangeTo(room.controller.pos) > 3) continue;

      if (
        !pos.isEqualTo(container.pos) &&
        terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL
      ) {
        continue;
      }

      const structures = pos.lookFor(LOOK_STRUCTURES);
      const blockingStructure = _.some(structures, function (s) {
        return (
          s.structureType !== STRUCTURE_ROAD &&
          s.structureType !== STRUCTURE_CONTAINER
        );
      });

      if (blockingStructure) continue;

      candidates.push(pos);
    }

    if (candidates.length === 0) return null;

    candidates.sort(function (a, b) {
      const aScore = spawn ? a.getRangeTo(spawn) : 0;
      const bScore = spawn ? b.getRangeTo(spawn) : 0;
      return aScore - bScore;
    });

    return candidates[0];
  },

  getBalancedSourceContainer(room, creep) {
    const containers = this.getSourceContainers(room).filter(
      function (container) {
        return (container.store[RESOURCE_ENERGY] || 0) > 0;
      },
    );

    if (containers.length === 0) return null;

    const scored = _.map(containers, function (container) {
      const users = _.filter(Game.creeps, function (other) {
        return (
          other.name !== creep.name &&
          other.memory &&
          other.memory.room === room.name &&
          other.memory.withdrawTargetId === container.id
        );
      }).length;

      return {
        container: container,
        users: users,
        energy: container.store[RESOURCE_ENERGY] || 0,
        range: creep.pos.getRangeTo(container),
      };
    });

    scored.sort(function (a, b) {
      if (a.users !== b.users) return a.users - b.users;
      if (a.energy !== b.energy) return b.energy - a.energy;
      return a.range - b.range;
    });

    return scored[0].container;
  },
};
