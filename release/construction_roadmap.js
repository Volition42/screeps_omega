/*
Developer Summary:
Phase Construction Roadmap

Purpose:
- Define what each room phase is trying to build
- Keep phase intent explicit and easy to evolve
- Let construction_manager and construction_status read the same plan

Phases:
- bootstrap_jr:
    no formal construction targets
- bootstrap:
    containers + anchor roads + backbone roads
- developing:
    extension stamps + tower + defense + internal roads
- stable:
    finish current-RCL roadmap and keep the core clean

Design Notes:
- This module defines INTENT, not placement logic.
- Stamp placement logic lives in stamp_library.js and construction_manager.js.
*/

module.exports = {
  getPlan(phase, controllerLevel) {
    switch (phase) {
      case "bootstrap_jr":
        return {
          phase: "bootstrap_jr",
          actions: [],
        };

      case "bootstrap":
        return {
          phase: "bootstrap",
          actions: [
            "sourceContainers",
            "controllerContainer",
            "anchorRoads",
            "backboneRoads",
          ],
        };

      case "developing":
        return {
          phase: "developing",
          actions: [
            "sourceContainers",
            "controllerContainer",
            "anchorRoads",
            "backboneRoads",
            "extensionStamps",
            "towerStamp",
            "storage",
            "internalRoads",
            "defense",
          ],
        };

      case "stable":
        return {
          phase: "stable",
          actions: [
            "anchorRoads",
            "backboneRoads",
            "extensionStamps",
            "towerStamp",
            "internalRoads",
            "defense",
          ],
        };

      default:
        return this.getPlan("bootstrap", controllerLevel);
    }
  },

  getDesiredExtensionCount(controllerLevel) {
    return CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][controllerLevel] || 0;
  },

  getDesiredTowerCount(controllerLevel) {
    return CONTROLLER_STRUCTURES[STRUCTURE_TOWER][controllerLevel] || 0;
  },
};
