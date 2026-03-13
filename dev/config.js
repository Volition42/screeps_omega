/*
Developer Summary:
Global configuration for CODENAME: INFRASTRUCTURE.

Purpose:
- Central place for colony behavior tuning
- Keep future changes understandable
- Preserve useful examples for future reference

Major sections:
- HUD
- CREEPS
- CONSTRUCTION
- REPAIR
- LOGISTICS
- DEFENSE
- BODIES
- DIRECTIVES

Important Notes:
- Keep the hauler override example in place for future tuning.
- HUD options should stay easy to toggle during testing.
- Directive settings control both recurring reports and one-time milestone announcements.
*/

module.exports = {
  CODENAME: "INFRASTRUCTURE",

  HUD: {
    ENABLED: true,
    CREEP_LABELS: true,
    LABEL_INTERVAL: 1,
    CONSOLE_INTERVAL: 25,

    // Developer note:
    // Show a tiny performance line using Memory.stats from stats_manager.
    SHOW_PERFORMANCE: true,

    // Developer note:
    // Construction checklist block shown in the room HUD.
    // ENABLED:
    //   true  = show construction progress lines
    //   false = hide them
    //
    // MODE:
    //   "compact"  = one summary line
    //   "detailed" = two lines, easier to read
    SHOW_CONSTRUCTION_CHECKLIST: true,
    CONSTRUCTION_CHECKLIST_MODE: "detailed",
  },

  CREEPS: {
    // Developer note:
    // JrWorkers are only used during the pre-infrastructure bootstrap phase.
    jrWorkers: 4,

    // Developer note:
    // These are the target counts once the room transitions into the
    // normal INFRASTRUCTURE phases.
    workers: 4,
    upgraders: 1,
    repairs: 2,

    // Developer note:
    // Miners are currently locked to one per source.
    minersPerSource: 1,

    // Developer note:
    // Default hauler count per source when no source-specific override exists.
    haulersPerSourceDefault: 1,

    // Developer note:
    // Optional per-source overrides.
    // Use this when one source needs more hauling than the others.
    // Example:
    // haulersPerSourceBySourceId: {
    //   "5bbcab1c9099fc012e632dbc": 2,
    //   "5bbcab1c9099fc012e632dbd": 1
    // }
    haulersPerSourceBySourceId: {},
  },

  CONSTRUCTION: {
    MAX_SITES: 8,
    PLAN_INTERVAL: 50,
  },

  REPAIR: {
    criticalContainerThreshold: 0.5,
    importantThreshold: 0.8,
    spawnExtensionThreshold: 0.9,
    roadThreshold: 0.35,

    rampartMinHits: 1000,
    wallMinHits: 1000,
  },

  LOGISTICS: {
    controllerContainerReserve: 100,
  },

  DEFENSE: {
    ENABLED: true,
    MIN_CONTROLLER_LEVEL: 2,

    PADDING_X: 5,
    PADDING_Y: 5,
    GATE_WIDTH: 1,

    towerCountAtRCL3: 1,
  },

  BODIES: {
    // Developer note:
    // These tiers are keyed off room.energyCapacityAvailable, not current energy.
    // That means the room "plans" for what it can support consistently.
    //
    // Current intended progression:
    // 300  = early room
    // 550  = RCL2 with extensions
    // 800  = early RCL3 strength
    maxTierEnergy: 800,
  },

  DIRECTIVES: {
    // Developer note:
    // Controls how often the vCORP Corporate Directive System logs updates.
    ENABLED: true,
    INTERVAL: 25,

    // Developer note:
    // Performance-aware directive settings.
    SHOW_PERFORMANCE_DIRECTIVES: true,
    CPU_SPIKE_MULTIPLIER: 1.5,
    BUCKET_WARNING_THRESHOLD: 8000,
    HEALTHY_REPORT_INTERVAL: 100,

    // Developer note:
    // Progress / ETA directives for controller advancement.
    SHOW_PROGRESS_DIRECTIVES: true,
    PROGRESS_SAMPLE_INTERVAL: 25,
    PROGRESS_REPORT_INTERVAL: 100,

    // Developer note:
    // Construction checklist directives.
    SHOW_CONSTRUCTION_DIRECTIVES: true,
    CONSTRUCTION_REPORT_INTERVAL: 75,

    // Developer note:
    // One-time announcement system.
    // These fire once when the tracked event first occurs.
    SHOW_PHASE_TRANSITION_DIRECTIVES: true,
    SHOW_MILESTONE_DIRECTIVES: true,
  },
};
