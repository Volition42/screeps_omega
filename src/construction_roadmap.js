/*
Developer Summary:
Phase Construction Roadmap

Purpose:
- Define what each room phase is trying to build
- Keep phase intent explicit and easy to evolve
- Let construction_manager and construction_status read the same plan

Phases:
- bootstrap:
    no formal construction targets, just survive and upgrade to RCL2
- foundation:
    source containers + anchor roads + backbone roads
- development:
    extensions + first tower + storage + defense + internal roads
- logistics:
    add first link backbone for a stronger core economy
- specialization:
    add terminal + extractor + first lab cluster
- fortification:
    hold the mature room on a hardened, late-game-ready core
- command:
    final room command phase for future RCL8 completion work

Design Notes:
- This module defines INTENT, not placement logic.
- Later phases can be stubbed here before new placement logic exists.
- Stamp placement logic lives in stamp_library.js and construction_manager.js.
*/

const LEGACY_PHASE_MAP = {
  bootstrap_jr: "bootstrap",
  developing: "development",
  stable: "development",
  rcl5: "logistics",
  rcl6: "specialization",
};

module.exports = {
  PHASE_ORDER: [
    "bootstrap",
    "foundation",
    "development",
    "logistics",
    "specialization",
    "fortification",
    "command",
  ],

  PHASE_MIN_CONTROLLER_LEVEL: {
    bootstrap: 1,
    foundation: 2,
    development: 3,
    logistics: 5,
    specialization: 6,
    fortification: 7,
    command: 8,
  },

  ROADMAPS: {
    bootstrap: {
      phase: "bootstrap",
      focus: "survival",
      summary: "Direct harvest recovery and controller progress to unlock basic infrastructure.",
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

    foundation: {
      phase: "foundation",
      focus: "backbone",
      summary: "Establish source containers, an early hub, controller feed, and the first durable road network.",
      buildList: [
        "sourceContainers",
        "hubContainer",
        "controllerContainer",
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

    development: {
      phase: "development",
      focus: "core_economy",
      summary: "Fill out the first full home-room core with storage, tower coverage, and defenses.",
      buildList: [
        "sourceContainers",
        "hubContainer",
        "controllerContainer",
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

    logistics: {
      phase: "logistics",
      focus: "energy_throughput",
      summary: "Add the first link network so hauling pressure falls and controller supply improves.",
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

    specialization: {
      phase: "specialization",
      focus: "advanced_infrastructure",
      summary: "Bring online terminal, mineral access, and the first lab cluster.",
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

    fortification: {
      phase: "fortification",
      focus: "hardening",
      summary: "Late-game hardening phase reserved for stronger defenses and mature infrastructure.",
      buildList: [
        "factory",
        "terminal",
        "extractor",
        "labs",
        "links",
        "storage",
        "anchorRoads",
        "backboneRoads",
        "extensionStamps",
        "towerStamp",
        "internalRoads",
        "defense",
      ],
      goals: {
        logisticsTier: "fortified_core",
        linkPlanning: {
          enabled: true,
          controllerLink: true,
          sourceLinks: 2,
          storageLink: true,
        },
        advancedStructures: {
          terminal: true,
          extractor: true,
          labs: 6,
        },
        lateGameStructures: {
          observer: false,
          factory: true,
          powerSpawn: false,
          nuker: false,
        },
      },
    },

    command: {
      phase: "command",
      focus: "finalization",
      summary: "Final room-completion phase reserved for future RCL8 command structures.",
      buildList: [
        "observer",
        "powerSpawn",
        "nuker",
        "factory",
        "terminal",
        "extractor",
        "labs",
        "links",
        "storage",
        "anchorRoads",
        "backboneRoads",
        "extensionStamps",
        "towerStamp",
        "internalRoads",
        "defense",
      ],
      goals: {
        logisticsTier: "command_core",
        linkPlanning: {
          enabled: true,
          controllerLink: true,
          sourceLinks: 2,
          storageLink: true,
        },
        advancedStructures: {
          terminal: true,
          extractor: true,
          labs: 10,
        },
        lateGameStructures: {
          observer: true,
          factory: true,
          powerSpawn: true,
          nuker: true,
        },
      },
    },
  },

  normalizePhase(phase) {
    if (!phase) return "bootstrap";

    return LEGACY_PHASE_MAP[phase] || phase;
  },

  getPlan(phase, controllerLevel) {
    var normalizedPhase = this.normalizePhase(phase);
    var roadmapPhase = this.getRoadmapPhase(normalizedPhase, controllerLevel);
    var plan = this.ROADMAPS[roadmapPhase] || this.ROADMAPS.bootstrap;

    return {
      phase: normalizedPhase,
      roadmapPhase: roadmapPhase,
      focus: plan.focus || roadmapPhase,
      summary: plan.summary || "",
      buildList: plan.buildList.slice(),
      goals: this.cloneGoals(plan.goals || {}),
    };
  },

  getRoadmapPhase(phase, controllerLevel) {
    var normalizedPhase = this.normalizePhase(phase);
    var highestPhase = this.getHighestPhaseForControllerLevel(controllerLevel);
    var requestedIndex = this.PHASE_ORDER.indexOf(normalizedPhase);
    var highestIndex = this.PHASE_ORDER.indexOf(highestPhase);

    if (requestedIndex === -1) return highestPhase;
    if (requestedIndex > highestIndex) return highestPhase;

    return normalizedPhase;
  },

  getHighestPhaseForControllerLevel(controllerLevel) {
    if (controllerLevel >= 8) return "command";
    if (controllerLevel >= 7) return "fortification";
    if (controllerLevel >= 6) return "specialization";
    if (controllerLevel >= 5) return "logistics";
    if (controllerLevel >= 3) return "development";
    if (controllerLevel >= 2) return "foundation";
    return "bootstrap";
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
