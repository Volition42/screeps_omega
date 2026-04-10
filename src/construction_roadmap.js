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
    compact extensions + first tower + storage + shared internal roads + active defense runtime
- logistics:
    add first link backbone for a stronger core economy
- specialization:
    add terminal + extractor + first compact lab cluster
- fortification:
    hold the mature room on compact late-game infrastructure
- command:
    final room command phase for RCL8 completion work

Design Notes:
- This module defines INTENT, not placement logic.
- Later phases can be stubbed here before new placement logic exists.
- Stamp placement logic lives in stamp_library.js and construction_manager.js.
- The "defense" build action is currently a legacy no-op; tower and defender runtime own default defense.
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
        "extensionStamps",
        "mineralAccessRoad",
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
      summary: "Fill out the compact home-room core with storage, tower coverage, and shared roads.",
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
        "mineralAccessRoad",
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
        "mineralAccessRoad",
      ],
      goals: {
        logisticsTier: "link_backbone",
        linkPlanning: {
          enabled: true,
          controllerLink: true,
          sourceLinks: 2,
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
        "mineralContainer",
        "extractor",
        "labs",
        "mineralAccessRoad",
      ],
      goals: {
        logisticsTier: "advanced_logistics",
        linkPlanning: {
          enabled: true,
          controllerLink: true,
          sourceLinks: 2,
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
      focus: "mature_infrastructure",
      summary: "Late-game infrastructure phase for the factory, expanded compact labs, and mature logistics.",
      buildList: [
        "spawns",
        "factory",
        "terminal",
        "mineralContainer",
        "extractor",
        "labs",
        "mineralAccessRoad",
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
        structureTargets: {
          spawn: 2,
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
        "spawns",
        "observer",
        "powerSpawn",
        "nuker",
        "factory",
        "terminal",
        "mineralContainer",
        "extractor",
        "labs",
        "mineralAccessRoad",
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
          terminalLink: true,
          mineralLink: true,
        },
        advancedStructures: {
          terminal: true,
          extractor: true,
          labs: 10,
        },
        structureTargets: {
          spawn: 3,
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

  mergeBuildLists(baseBuildList, unlockedBuildList) {
    var merged = (baseBuildList || []).slice();
    var additions = unlockedBuildList || [];

    for (var i = 0; i < additions.length; i++) {
      if (merged.indexOf(additions[i]) !== -1) continue;
      merged.push(additions[i]);
    }

    return merged;
  },

  mergeGoals(baseGoals, unlockedGoals) {
    var target = this.cloneGoals(baseGoals || {});
    var source = unlockedGoals || {};

    for (var key in source) {
      if (!Object.prototype.hasOwnProperty.call(source, key)) continue;

      var sourceValue = source[key];
      var targetValue = target[key];

      if (
        targetValue &&
        sourceValue &&
        typeof targetValue === "object" &&
        typeof sourceValue === "object" &&
        !Array.isArray(targetValue) &&
        !Array.isArray(sourceValue)
      ) {
        target[key] = this.mergeGoals(targetValue, sourceValue);
        continue;
      }

      if (typeof targetValue === "boolean" && typeof sourceValue === "boolean") {
        target[key] = targetValue || sourceValue;
        continue;
      }

      if (typeof targetValue === "number" && typeof sourceValue === "number") {
        target[key] = Math.max(targetValue, sourceValue);
        continue;
      }

      if (typeof targetValue === "string" && typeof sourceValue === "string") {
        continue;
      }

      if (targetValue === undefined) {
        target[key] = this.cloneGoals(sourceValue);
      }
    }

    return target;
  },
};
