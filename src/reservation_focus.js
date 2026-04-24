/*
Developer Summary:
Reserved Room Focus Constants

Purpose:
- Keep reservation focus values consistent between console commands, memory, and planning
*/

const HOLD = "hold";
const FULL = "full";

module.exports = {
  HOLD,
  FULL,
  DEFAULT: FULL,
  VALUES: [HOLD, FULL],

  normalize(value) {
    if (typeof value === "undefined" || value === null || value === "") {
      return FULL;
    }

    const normalized = String(value).trim().toLowerCase();
    if (normalized === HOLD) return HOLD;
    if (normalized === FULL) return FULL;

    return null;
  },

  isFocus(value) {
    if (typeof value === "undefined" || value === null || value === "") {
      return false;
    }

    return this.normalize(value) !== null;
  },

  isHold(value) {
    return this.normalize(value) === HOLD;
  },
};
