const config = require("config");

function ensureControls() {
  if (!Memory.ops) Memory.ops = {};
  if (!Memory.ops.controls) Memory.ops.controls = {};

  return Memory.ops.controls;
}

function getDefaultHudEnabled() {
  return !(config.HUD && config.HUD.ENABLED === false);
}

function getDefaultReportsEnabled() {
  return !(config.DIRECTIVES && config.DIRECTIVES.ENABLED === false);
}

module.exports = {
  getHudEnabled() {
    const controls = ensureControls();

    if (typeof controls.hudEnabled === "boolean") {
      return controls.hudEnabled;
    }

    return getDefaultHudEnabled();
  },

  setHudEnabled(enabled) {
    const controls = ensureControls();
    controls.hudEnabled = !!enabled;
    return controls.hudEnabled;
  },

  getReportsEnabled() {
    const controls = ensureControls();

    if (typeof controls.reportsEnabled === "boolean") {
      return controls.reportsEnabled;
    }

    return getDefaultReportsEnabled();
  },

  setReportsEnabled(enabled) {
    const controls = ensureControls();
    controls.reportsEnabled = !!enabled;
    return controls.reportsEnabled;
  },

  getViewEnabled() {
    return this.getHudEnabled() && this.getReportsEnabled();
  },
};
