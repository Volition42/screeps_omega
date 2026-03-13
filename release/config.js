module.exports = {
  CODENAME: "INFRASTRUCTURE",

  HUD: {
    ENABLED: true,
    CREEP_LABELS: true,
    LABEL_INTERVAL: 1,
    CONSOLE_INTERVAL: 25,
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

    rampartMinHits: 5000,
    wallMinHits: 5000,
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
    //
    // If you want to tune future body growth, this is the place to think first.
    maxTierEnergy: 800,
  },

  DIRECTIVES: {
    // Developer note:
    // Controls how often the vCORP Corporate Directive System logs updates.
    ENABLED: true,
    INTERVAL: 25,
  },
};
