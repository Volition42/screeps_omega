const utils = require("utils");

module.exports = {
  run(room, state) {
    const cache = utils.getRoomRuntimeCache(room);
    const towers =
      state && state.structuresByType
        ? state.structuresByType[STRUCTURE_TOWER] || []
        : cache.structuresByType[STRUCTURE_TOWER] || [];

    if (!towers.length) return;

    const hostiles = utils.getDefenseIntruders(
      room,
      state && state.hostileCreeps ? state.hostileCreeps : cache.hostileCreeps,
      typeof FIND_HOSTILE_POWER_CREEPS !== "undefined"
        ? room.find(FIND_HOSTILE_POWER_CREEPS)
        : [],
    );
    const roomCreeps = state && state.creeps ? state.creeps : cache.creeps;
    const injured = _.filter(roomCreeps, function (creep) {
      return creep.hits < creep.hitsMax;
    });
    const repairTargets = utils.getTowerRepairTargets(room);

    for (const tower of towers) {
      if (hostiles.length) {
        const closest = tower.pos.findClosestByRange(hostiles);
        tower.attack(closest);
        continue;
      }

      if (injured.length) {
        const closest = tower.pos.findClosestByRange(injured);
        tower.heal(closest);
        continue;
      }

      const repairTarget =
        repairTargets.length > 0
          ? tower.pos.findClosestByRange(repairTargets)
          : null;

      if (repairTarget) {
        tower.repair(repairTarget);
      }
    }
  },
};
