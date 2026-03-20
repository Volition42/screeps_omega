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
    source containers + anchor roads + backbone roads
- developing:
    extension stamps + tower + storage + defense + internal roads
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
      goals: {
        logisticsTier: "survival_bootstrap",
        linkPlanning: {
          enabled: false,
          controllerLink: false,
          sourceLinks: 0,
          storageLink: false,
        },
        advancedStructures: {
          terminal: false,
          extractor: false,
          labs: 0,
        },
      },
    },

    bootstrap: {
      phase: "bootstrap",
      buildList: [
        "sourceContainers",
        "anchorRoads",
        "backboneRoads",
      ],
      goals: {
        logisticsTier: "container_bootstrap",
        linkPlanning: {
          enabled: false,
          controllerLink: false,
          sourceLinks: 0,
          storageLink: false,
        },
        advancedStructures: {
          terminal: false,
          extractor: false,
          labs: 0,
        },
      },
    },

    developing: {
      phase: "developing",
      buildList: [
        "sourceContainers",
        "anchorRoads",
        "backboneRoads",
        "extensionStamps",
        "towerStamp",
        "storage",
        "internalRoads",
        "defense",
      ],
      goals: {
        logisticsTier: "development_backbone",
        linkPlanning: {
          enabled: false,
          controllerLink: false,
          sourceLinks: 0,
          storageLink: false,
        },
        advancedStructures: {
          terminal: false,
          extractor: false,
          labs: 0,
        },
      },
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
      goals: {
        logisticsTier: "storage_backbone",
        linkPlanning: {
          enabled: false,
          controllerLink: false,
          sourceLinks: 0,
          storageLink: false,
        },
        advancedStructures: {
          terminal: false,
          extractor: false,
          labs: 0,
        },
      },
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
        "links",
      ],
      goals: {
        logisticsTier: "link_backbone",
        linkPlanning: {
          enabled: true,
          controllerLink: true,
          sourceLinks: 1,
          storageLink: false,
        },
        advancedStructures: {
          terminal: false,
          extractor: false,
          labs: 0,
        },
      },
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
        "links",
        "terminal",
        "extractor",
        "labs",
      ],
      goals: {
        logisticsTier: "advanced_logistics",
        linkPlanning: {
          enabled: true,
          controllerLink: true,
          sourceLinks: 1,
          storageLink: true,
        },
        advancedStructures: {
          terminal: true,
          extractor: true,
          labs: 3,
        },
      },
    },
  },

  getPlan(phase, controllerLevel) {
    var roadmapPhase = this.getRoadmapPhase(phase, controllerLevel);
    var plan = this.ROADMAPS[roadmapPhase] || this.ROADMAPS.bootstrap;

    return {
      phase: phase,
      roadmapPhase: roadmapPhase,
      buildList: plan.buildList.slice(),
      goals: this.cloneGoals(plan.goals || {}),
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

  getDesiredLinkCount(controllerLevel) {
    return CONTROLLER_STRUCTURES[STRUCTURE_LINK][controllerLevel] || 0;
  },

  getDesiredLabCount(controllerLevel) {
    return CONTROLLER_STRUCTURES[STRUCTURE_LAB][controllerLevel] || 0;
  },

  getDesiredStructureCount(controllerLevel, structureType) {
    if (!CONTROLLER_STRUCTURES[structureType]) return 0;
    return CONTROLLER_STRUCTURES[structureType][controllerLevel] || 0;
  },

  cloneGoals(goals) {
    return JSON.parse(JSON.stringify(goals || {}));
  },
};
