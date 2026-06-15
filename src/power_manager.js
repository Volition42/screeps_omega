/*
Developer Summary:
Power Manager

Purpose:
- Start safe GPL progress in mature RCL8 rooms
- Process power through built Power Spawns when resources are already present
- Keep this first phase intentionally narrow and low CPU

Current Scope:
- Finds owned Power Spawns in RCL8 rooms
- Calls processPower only when the Power Spawn has enough energy and power
- Writes lightweight status into Memory.rooms[roomName].power
- Does not buy power
- Does not harvest Power Banks
- Does not spawn or manage Power Creeps
- Does not move energy or power into the Power Spawn yet

Important Notes:
- processPower consumes 1 POWER and 50 ENERGY per successful call.
- Logistics/refill support will come in a later phase.
*/

const config = require("config");

module.exports = {
  run(room, state) {
    if (!config.POWER || !config.POWER.ENABLED) return;
    if (!room.controller || !room.controller.my) return;
    if (room.controller.level < (config.POWER.MIN_RCL || 8)) return;

    if (!Memory.rooms) Memory.rooms = {};
    if (!Memory.rooms[room.name]) Memory.rooms[room.name] = {};
    if (!Memory.rooms[room.name].power) Memory.rooms[room.name].power = {};

    const powerSpawns = this.getPowerSpawns(room, state);
    const mem = Memory.rooms[room.name].power;

    mem.lastSeen = Game.time;
    mem.powerSpawns = powerSpawns.length;
    mem.processed = false;
    mem.result = null;
    mem.reason = null;

    if (powerSpawns.length === 0) {
      mem.reason = "no_power_spawn";
      return;
    }

    const powerSpawn = powerSpawns[0];
    const energy = powerSpawn.store[RESOURCE_ENERGY] || 0;
    const power = powerSpawn.store[RESOURCE_POWER] || 0;

    mem.powerSpawnId = powerSpawn.id;
    mem.energy = energy;
    mem.power = power;

    if (energy < (config.POWER.PROCESS_ENERGY_COST || 50)) {
      mem.reason = "not_enough_energy";
      return;
    }

    if (power < (config.POWER.PROCESS_POWER_COST || 1)) {
      mem.reason = "not_enough_power";
      return;
    }

    const result = powerSpawn.processPower();

    mem.result = result;

    if (result === OK) {
      mem.processed = true;
      mem.reason = "processed";
      mem.lastProcessed = Game.time;
      mem.totalProcessed = (mem.totalProcessed || 0) + 1;
      return;
    }

    mem.reason = this.describeResult(result);
  },

  getPowerSpawns(room, state) {
    if (state && state.structures) {
      return _.filter(state.structures, function (structure) {
        return structure.structureType === STRUCTURE_POWER_SPAWN;
      });
    }

    return room.find(FIND_MY_STRUCTURES, {
      filter: function (structure) {
        return structure.structureType === STRUCTURE_POWER_SPAWN;
      },
    });
  },

  describeResult(result) {
    switch (result) {
      case ERR_NOT_OWNER:
        return "not_owner";
      case ERR_NOT_ENOUGH_RESOURCES:
        return "not_enough_resources";
      case ERR_RCL_NOT_ENOUGH:
        return "rcl_not_enough";
      default:
        return "result_" + result;
    }
  },
};
