/*
Developer Summary:
Reserver Role

Purpose:
- Travel to a configured remote room
- Reserve that room's controller
- Keep remote income sites under reservation for longer mining uptime

Important Notes:
- Uses homeRoom for return ownership context
- If the remote room is not visible yet, move toward room center first
- This role is intentionally simple and does not handle combat
*/

module.exports = {
  run(creep) {
    var targetRoom = creep.memory.targetRoom;
    if (!targetRoom) return;

    if (creep.room.name !== targetRoom) {
      creep.moveTo(new RoomPosition(25, 25, targetRoom), {
        reusePath: 20,
        visualizePathStyle: { stroke: "#c77dff" },
      });
      return;
    }

    if (!creep.room.controller) return;

    var result = creep.reserveController(creep.room.controller);

    if (result === ERR_NOT_IN_RANGE) {
      creep.moveTo(creep.room.controller, {
        reusePath: 10,
        visualizePathStyle: { stroke: "#c77dff" },
      });
      return;
    }

    if (result === ERR_INVALID_TARGET) {
      return;
    }

    if (result === ERR_BUSY) {
      return;
    }
  },
};
