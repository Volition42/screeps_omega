module.exports = {
  plan(roomManager) {
    // defender logic later
  },

  run(roomManager) {
    const towers = roomManager.room.find(FIND_MY_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_TOWER,
    });

    for (const tower of towers) {
      const hostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
      if (hostile) {
        tower.attack(hostile);
        continue;
      }

      const injured = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
        filter: (c) => c.hits < c.hitsMax,
      });
      if (injured) {
        tower.heal(injured);
        continue;
      }

      const repairTarget = tower.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
          (s.structureType === STRUCTURE_ROAD ||
            s.structureType === STRUCTURE_CONTAINER) &&
          s.hits < s.hitsMax * 0.5,
      });

      if (repairTarget) {
        tower.repair(repairTarget);
      }
    }
  },
};
