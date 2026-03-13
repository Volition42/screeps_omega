module.exports = {
  run(room) {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: (s) => s.structureType === STRUCTURE_TOWER,
    });

    if (!towers.length) return;

    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    const injured = room.find(FIND_MY_CREEPS, {
      filter: (c) => c.hits < c.hitsMax,
    });

    for (const tower of towers) {
      // 1️⃣ Attack enemies
      if (hostiles.length) {
        const closest = tower.pos.findClosestByRange(hostiles);
        tower.attack(closest);
        continue;
      }

      // 2️⃣ Heal friendly creeps
      if (injured.length) {
        const closest = tower.pos.findClosestByRange(injured);
        tower.heal(closest);
        continue;
      }

      // 3️⃣ Repair nearby roads or walls
      const repairTarget = tower.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
          (s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax * 0.5) ||
          (s.structureType === STRUCTURE_WALL && s.hits < 2000) ||
          (s.structureType === STRUCTURE_RAMPART && s.hits < 2000),
      });

      if (repairTarget) {
        tower.repair(repairTarget);
      }
    }
  },
};
