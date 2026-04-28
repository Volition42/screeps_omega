/*
Developer Summary:
Attack operation controller pressure.

Purpose:
- Travel to a hostile/reserved controller
- Apply attackController until the room becomes neutral
*/

const attackManager = require("attack_manager");
const utils = require("utils");

const ROOM_TRAVEL_OPTIONS = {
  reusePath: 20,
  range: 20,
  visualizePathStyle: { stroke: "#ffbe0b" },
};

const CONTROLLER_MOVE_OPTIONS = {
  reusePath: 10,
  range: 1,
  visualizePathStyle: { stroke: "#ffbe0b" },
};

module.exports = {
  run(creep) {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) return;
    if (!attackManager.getActiveAttack(targetRoom)) return;

    if (creep.room.name !== targetRoom) {
      utils.moveTo(creep, new RoomPosition(25, 25, targetRoom), ROOM_TRAVEL_OPTIONS);
      return;
    }

    const controller = creep.room.controller;
    if (!controller || controller.my) return;
    if (!controller.owner && !controller.reservation) return;

    if (creep.pos.getRangeTo(controller) > 1) {
      utils.moveTo(creep, controller, CONTROLLER_MOVE_OPTIONS);
      return;
    }

    if (typeof creep.attackController === "function") {
      creep.attackController(controller);
    }
  },
};
