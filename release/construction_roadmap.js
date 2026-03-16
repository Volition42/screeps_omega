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
  ROADMAPS: {
    bootstrap_jr: {
      phase: "bootstrap_jr",
      buildList: [],
    },

    bootstrap: {
      phase: "bootstrap",
      buildList: [
        "sourceContainers",
        "controllerContainer",
        "anchorRoads",
        "backboneRoads",
      ],
    },

    developing: {
      phase: "developing",
      buildList: [
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
    },

    stable: {
      phase: "stable",
      buildList: [
        "anchorRoads",
        "backboneRoads",
        "extensionStamps",
        "towerStamp",
        "storage",
        "internalRoads",
        "defense",
      ],
    },

    rcl5: {
      phase: "rcl5",
      buildList: [
        "anchorRoads",
        "backboneRoads",
        "extensionStamps",
        "towerStamp",
        "storage",
        "internalRoads",
        "defense",
      ],
      placeholders: ["links", "second_spawn_support", "remote_phase_two_rollout"],
    },

    rcl6: {
      phase: "rcl6",
      buildList: [
        "anchorRoads",
        "backboneRoads",
        "extensionStamps",
        "towerStamp",
        "storage",
        "internalRoads",
        "defense",
      ],
      placeholders: ["labs", "terminal", "remote_scoring", "advanced_defense"],
    },
  },

  getPlan(phase, controllerLevel) {
    var roadmapPhase = this.getRoadmapPhase(phase, controllerLevel);
    var plan = this.ROADMAPS[roadmapPhase] || this.ROADMAPS.bootstrap;

    return {
      phase: phase,
      roadmapPhase: roadmapPhase,
      buildList: plan.buildList.slice(),
      actions: plan.buildList.slice(),
      placeholders: plan.placeholders ? plan.placeholders.slice() : [],
    };
  },

  getRoadmapPhase(phase, controllerLevel) {
    if (controllerLevel >= 6) return "rcl6";
    if (controllerLevel >= 5) return "rcl5";

    switch (phase) {
      case "bootstrap_jr":
        return "bootstrap_jr";
      case "bootstrap":
        return "bootstrap";
      case "developing":
        return "developing";
      case "stable":
        return "stable";
      default:
        return "bootstrap";
    }
  },

  getDesiredExtensionCount(controllerLevel) {
    return CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][controllerLevel] || 0;
  },

  getDesiredTowerCount(controllerLevel) {
    return CONTROLLER_STRUCTURES[STRUCTURE_TOWER][controllerLevel] || 0;
  },
};
