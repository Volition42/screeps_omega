/*
Developer Note:
Automatically signs owned room controllers with rotating vCORP messaging.

Behavior:
- Uses a slow rotation cadence so the sign feels deliberate, not noisy.
- Re-signs only if the current sign text does not match the active daily message.
- Uses the first available creep in the room for now.

Future Ideas:
- Let scouts sign remote / neutral rooms
- Add room-specific sign themes by phase or room type
*/

module.exports = {
  run(room) {
    if (!room.controller || !room.controller.my) return;

    const desiredText = this.getSign();
    const currentSign = room.controller.sign;

    if (currentSign && currentSign.text === desiredText) return;

    const creep = room.find(FIND_MY_CREEPS)[0];
    if (!creep) return;

    if (creep.pos.inRangeTo(room.controller, 1)) {
      creep.signController(room.controller, desiredText);
    } else {
      creep.moveTo(room.controller);
    }
  },

  getSign() {
    const signs = [
      "vCORP — Building Tomorrow, Today.",
      "vCORP Strategic Development Zone.",
      "vCORP — We Value Sustainable Resource Utilization.",
      "vCORP Industrial Operations — Efficiency Through Automation.",
      "vCORP Asset Management — Controlled Extraction Zone.",
      "vCORP Energy Solutions — Powering Tomorrow.",
      "vCORP Market Expansion Program — Territory Secured.",
      "vCORP Infrastructure Division — Authorized Facility.",
      "vCORP Resource Development Group — Long Term Growth.",
      "vCORP — Innovation Through Automation.",
    ];

    // Developer Note:
    // Rotate once per 28,800 ticks (~1 day on the public MMO at 3 sec/tick).
    // On a faster local server this will rotate faster in real time, but still slowly in game time.
    const ticksPerDay = 28800;
    const index = Math.floor(Game.time / ticksPerDay) % signs.length;

    return signs[index];
  },
};
