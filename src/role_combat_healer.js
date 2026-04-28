/*
Developer Summary:
Attack operation healer.

Purpose:
- Follow offensive creeps assigned to the same target
- Heal the most injured nearby friendly creep
*/

const attackManager = require("attack_manager");
const utils = require("utils");

const ROOM_TRAVEL_OPTIONS = {
  reusePath: 20,
  range: 20,
  visualizePathStyle: { stroke: "#f15bb5" },
};

module.exports = {
  run(creep) {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) return;
    if (!attackManager.getActiveAttack(targetRoom)) return;

    const patient = this.getPatient(creep, targetRoom);
    if (patient) {
      this.healPatient(creep, patient);
      return;
    }

    if (creep.room.name !== targetRoom) {
      utils.moveTo(creep, new RoomPosition(25, 25, targetRoom), ROOM_TRAVEL_OPTIONS);
      return;
    }

    if (creep.room.controller && creep.pos.getRangeTo(creep.room.controller) > 5) {
      utils.moveTo(creep, creep.room.controller, {
        reusePath: 10,
        range: 5,
        visualizePathStyle: { stroke: "#f15bb5" },
      });
    }
  },

  getPatient(creep, targetRoom) {
    const candidates = [];

    for (const creepName in Game.creeps) {
      if (!Object.prototype.hasOwnProperty.call(Game.creeps, creepName)) continue;
      const candidate = Game.creeps[creepName];
      if (!candidate || !candidate.memory) continue;
      if (candidate.memory.operation !== "attack") continue;
      if (candidate.memory.targetRoom !== targetRoom) continue;
      if (candidate.name === creep.name) continue;
      if (candidate.hits < candidate.hitsMax || candidate.room.name === creep.room.name) {
        candidates.push(candidate);
      }
    }

    if (candidates.length <= 0) return null;
    candidates.sort(function (a, b) {
      const aInjured = a.hitsMax - a.hits;
      const bInjured = b.hitsMax - b.hits;
      if (aInjured !== bInjured) return bInjured - aInjured;
      if (a.room.name === creep.room.name && b.room.name !== creep.room.name) return -1;
      if (a.room.name !== creep.room.name && b.room.name === creep.room.name) return 1;
      return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
    });

    return candidates[0];
  },

  healPatient(creep, patient) {
    const range = creep.pos.getRangeTo(patient);

    if (range <= 1 && typeof creep.heal === "function") {
      creep.heal(patient);
    } else if (range <= 3 && typeof creep.rangedHeal === "function") {
      creep.rangedHeal(patient);
    }

    if (range > 1) {
      utils.moveTo(creep, patient, {
        reusePath: 4,
        range: 1,
        visualizePathStyle: { stroke: "#f15bb5" },
      });
    }
  },
};
