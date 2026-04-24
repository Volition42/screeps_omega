/*
Developer Summary:
Reserved Room Controller Role

Purpose:
- Travel from a parent room to a reserved-room target
- Maintain controller reservation without claiming the room
- Clear hostile ownership/reservation only when reserveController cannot proceed
*/

const utils = require("utils");

const ROOM_TRAVEL_OPTIONS = {
  reusePath: 30,
  range: 20,
};

const CONTROLLER_MOVE_OPTIONS = {
  reusePath: 20,
  range: 1,
};

module.exports = {
  run(creep) {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) return;

    if (creep.room.name !== targetRoom) {
      utils.moveTo(
        creep,
        new RoomPosition(25, 25, targetRoom),
        ROOM_TRAVEL_OPTIONS,
      );
      return;
    }

    const controller = creep.room.controller;
    if (!controller || controller.my) return;

    if (creep.pos.getRangeTo(controller) > 1) {
      utils.moveTo(creep, controller, CONTROLLER_MOVE_OPTIONS);
      return;
    }

    const result = creep.reserveController(controller);
    if (result === ERR_INVALID_TARGET && creep.attackController) {
      creep.attackController(controller);
    }
  },
};
