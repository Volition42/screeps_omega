const reservePolicy = require("economy_reserve_policy");
const utils = require("utils");

module.exports = {
  run(room, state) {
    const cache = utils.getRoomRuntimeCache(room);
    const towers =
      state && state.structuresByType
        ? state.structuresByType[STRUCTURE_TOWER] || []
        : cache.structuresByType[STRUCTURE_TOWER] || [];

    if (!towers.length) return;

    const hostiles = utils.getDefenseIntruders(room);
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

      if (reservePolicy.shouldBankStorageEnergy(room, state)) {
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
