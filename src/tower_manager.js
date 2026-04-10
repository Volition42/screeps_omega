const reservePolicy = require("economy_reserve_policy");
const defenseManager = require("defense_manager");
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
    const threat =
      state && state.defense && state.defense.homeThreat
        ? state.defense.homeThreat
        : defenseManager.getOwnedRoomThreat(
            room,
            state || cache.state,
            defenseManager.getReactionConfig(),
          );
    const towerTarget = threat && threat.towerTargetId
      ? Game.getObjectById(threat.towerTargetId)
      : null;
    const roomCreeps = state && state.creeps ? state.creeps : cache.creeps;
    const injured = _.filter(roomCreeps, function (creep) {
      return creep.hits < creep.hitsMax;
    });
    const repairTargets = utils.getTowerRepairTargets(room);

    for (const tower of towers) {
      if (hostiles.length) {
        const target =
          towerTarget && towerTarget.pos && towerTarget.pos.roomName === room.name
            ? towerTarget
            : tower.pos.findClosestByRange(hostiles);

        if (target && typeof tower.attack === "function") {
          tower.attack(target);
        }
        continue;
      }

      if (injured.length) {
        const closest = tower.pos.findClosestByRange(injured);
        if (closest && typeof tower.heal === "function") {
          tower.heal(closest);
        }
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
        if (typeof tower.repair === "function") {
          tower.repair(repairTarget);
        }
      }
    }
  },
};
