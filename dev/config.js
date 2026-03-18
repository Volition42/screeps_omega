/*
Developer Summary:
Global configuration for current dev.

Purpose:
- Central place for colony behavior tuning
- Keep future changes understandable
- Preserve useful examples for future reference

Major sections:
- VERSION
- HUD
- CREEPS
- CONSTRUCTION
- REPAIR
- LOGISTICS
- DEFENSE
- BODIES
- DIRECTIVES
- REMOTE_MINING

Important Notes:
- Keep the hauler override example in place for future tuning.
- HUD options should stay easy to toggle during testing.
- Directive settings control both recurring reports and one-time milestone announcements.
- Remote mining starts with a simple manual setup and expands by phase.
*/

module.exports = {
  VERSION: "0.9.0",

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
    SHOW_CONSTRUCTION_CHECKLIST: true,
    CONSTRUCTION_CHECKLIST_MODE: "detailed",

    /*
    Developer note:
    Remote site status block shown in the room HUD.

    SHOW_REMOTE_SITES
    Master toggle for showing configured remote rooms in the home room HUD.

    REMOTE_SITE_MODE
    "compact"  = one shorter line per remote site
    "detailed" = one fuller line per remote site
    */
    SHOW_REMOTE_SITES: true,
    REMOTE_SITE_MODE: "detailed",
  },

  CREEPS: {
    // Developer note:
    // JrWorkers are only used during the earliest bootstrap phase.
    jrWorkers: 4,

    // Developer note:
    // These are the target counts once the room transitions into the
    // normal colony phases.
    workers: 4,
    upgraders: 1,
    repairs: 2,

    /*
    Developer note:
    Miners are always one per source.
    Multi-miner source logic is no longer used.
    */
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

    // Developer note:
    // These are target-selection think intervals, not full action skips.
    // Roles still act every tick, but they only recompute expensive targets on
    // these cadences unless their cached target becomes invalid.
    THINK_INTERVALS: {
      worker: 2,
      hauler: 2,
      remotejrworker: 2,
      remoteworker: 3,
      remotehauler: 2,
      repair: 2,
      upgrader: 2,
    },
  },

  /*
  Developer Notes:
  Construction System Controls

  MAX_SITES
  Limits the total number of construction sites the AI will create at once.

  PLAN_INTERVAL
  How often the construction planner runs in ticks.
  Lower value = more responsive planning, slightly higher CPU.
  Higher value = slower reaction, lower CPU.
  */
  CONSTRUCTION: {
    MAX_SITES: 8,
    PLAN_INTERVAL: 50,
    REMOTE_MAX_SITES: 4,
    REMOTE_PLAN_INTERVAL: 75,
    ADVANCED_PLAN_INTERVAL: 250,
    FUTURE_INFRA: {
      LINK_CONTROLLER_RANGE: 2,
      LINK_SOURCE_RANGE: 2,
      STORAGE_LINK_RANGE: 2,
      TERMINAL_RANGE_FROM_STORAGE: 2,
      LAB_RANGE_FROM_STORAGE: 4,
      LAB_CLUSTER_SIZE_AT_RCL6: 3,
    },
  },

  /*
  Developer Notes:
  Repair Behavior Thresholds
  */
  REPAIR: {
    criticalContainerThreshold: 0.5,
    importantThreshold: 0.8,
    spawnExtensionThreshold: 0.9,
    roadThreshold: 0.35,

    rampartMinHits: 5000,
    wallMinHits: 5000,
  },

  /*
  Developer Notes:
  Logistics Controls

  controllerContainerReserve
  Preferred minimum energy to keep in the controller container.

  towerEmergencyThreshold
  If any tower drops below this level, or if hostiles are present,
  haulers switch to threat mode and towers move ahead of extensions.

  towerReserveThreshold
  In normal mode, towers are only topped up after storage and only if they are
  below this reserve level.
  */
  LOGISTICS: {
    controllerContainerReserve: 1000,
    towerEmergencyThreshold: 400,
    towerReserveThreshold: 700,
  },

  /*
  Developer Notes:
  Defense Planning Configuration
  */
  DEFENSE: {
    ENABLED: true,
    MIN_CONTROLLER_LEVEL: 2,

    PADDING_X: 5,
    PADDING_Y: 5,
    GATE_WIDTH: 1,

    towerCountAtRCL3: 1,

    // Developer note:
    // Wall and rampart upkeep scales by controller level so maintenance work
    // rises with room maturity without changing gate planning behavior.
    maintenanceByControllerLevel: {
      2: 5000,
      3: 10000,
      4: 25000,
      5: 50000,
      6: 100000,
    },

    // Developer note:
    // Reactive defender spawning stays narrow in Phase 1:
    // - owned rooms always defend when hostiles appear
    // - configured remote rooms only escalate when active and threatened
    REACTION: {
      ENABLED: true,
      REMOTE_ENABLED: true,
      MAX_HOME_DEFENDERS: 3,
      MAX_REMOTE_DEFENDERS: 3,
      HOME_INVASION_PRIORITY: 1100,
      REMOTE_INVASION_PRIORITY: 180,
      REMOTE_CLAIM_PRIORITY: 130,
      HOME_SPAWN_COOLDOWN: 5,
      REMOTE_SPAWN_COOLDOWN: 15,
      REPLACE_TTL: 90,
      SCORE_PER_HOME_DEFENDER: 6,
      SCORE_PER_REMOTE_DEFENDER: 5,
      HOSTILE_CREEP_BASE_SCORE: 1,
      ATTACK_PART_SCORE: 1,
      RANGED_PART_SCORE: 1,
      HEAL_PART_SCORE: 2,
      CLAIM_PART_SCORE: 2,
      INVADER_CORE_BASE_SCORE: 4,
      INVADER_CORE_LEVEL_SCORE: 2,
      INVADER_CORE_HITS_STEP: 100000,
      THREAT_MEMORY_TTL: 25,
    },
  },

  BODIES: {
    // Developer note:
    // These tiers are keyed off room.energyCapacityAvailable, not current energy.
    maxTierEnergy: 800,
  },

  STATS: {
    // Developer note:
    // CPU console reporting modes:
    // - off: no CPU console output
    // - overview: top-level sections only
    // - detail: top-level sections plus per-room and per-remote breakdowns
    CPU_CONSOLE_MODE: "overview",
    CPU_PRINT_INTERVAL: 25,
    RUNTIME_POLICY: {
      TIGHT_CPU_RATIO: 0.8,
      CRITICAL_CPU_RATIO: 0.92,
      TIGHT_BUCKET: 8000,
      CRITICAL_BUCKET: 4000,
      DETAIL_DOWNGRADE_AT_TIGHT: true,
      REMOTE_SCAN_BUDGET: {
        normal: 1,
        tight: 1,
        critical: 0,
      },
      THINK_INTERVAL_MULTIPLIER: {
        normal: 1,
        tight: 2,
        critical: 3,
      },
      CONSTRUCTION_INTERVAL_MULTIPLIER: {
        normal: 1,
        tight: 2,
        critical: 3,
      },
      SKIP_DIRECTIVES_AT: "tight",
      SKIP_HUD_AT: "critical",
    },
  },

  DIRECTIVES: {
    // Developer note:
    // Controls how often the corporate directive system logs updates.
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
    SHOW_PHASE_TRANSITION_DIRECTIVES: true,
    SHOW_MILESTONE_DIRECTIVES: true,
  },

  /*
  Developer Notes:
  Remote Mining Configuration

  Remote spawning policy:
  - Allowed only when the home room is in developing or stable
  - Pauses automatically if the home room falls back into bootstrap
  - Phase 2 uses remote workers to establish containers and roads before
    source-specialized remote miners and haulers take over

  Source configuration model:
  - One miner per source always
  - Haulers are configurable per source
  - Source-specific overrides are defined by source id
  - This model is intended for all remote sources going forward

  reservation:
  - enabled: whether this remote should be reserved
  - reservers: number of reserver creeps to maintain
  - renewBelow: if reservation ticks fall below this, spawn/replace reserver

  sourceDefaults:
  - miners is always 1
  - haulers defaults per remote source

  sourcesById example:
  // sourcesById: {
  //   "5bbcab1c9099fc012e632dbc": { miners: 1, haulers: 1 },
  //   "5bbcab1c9099fc012e632dbd": { miners: 1, haulers: 2 }
  // }
  */
  REMOTE_MINING: {
    ENABLED: true,
    phase2WorkersDefault: 1,
    SCHEDULER: {
      ENABLED: true,
      THREAT_SCAN_INTERVAL: 1,
      ACTIVE_SCAN_INTERVAL: 5,
      IDLE_SCAN_INTERVAL: 15,
      CACHE_TTL: 50,
    },
    SCALING: {
      ENABLED: true,
      recommendedSitesByControllerLevel: {
        1: 0,
        2: 0,
        3: 1,
        4: 3,
        5: 4,
        6: 4,
      },
      profiles: {
        baseline: "manual_phase_two",
        throughput_prep: "storage_backed",
        advanced_prep: "terminal_ready",
      },
    },

    SITES: {
      E11N33: {
        enabled: true,
        homeRoom: "E12N33",
        phase: 2,
        jrWorkers: 2,
        remoteWorkers: 2,

        reservation: {
          enabled: true,
          reservers: 2,
          renewBelow: 5000,
        },

        sourceDefaults: {
          miners: 1,
          haulers: 1,
        },

        sourcesById: {},
      } /*
      E13N32: {
        enabled: true,
        homeRoom: "E12N33",
        phase: 1,
        jrWorkers: 2,
        remoteWorkers: 1,

        reservation: {
          enabled: true,
          reservers: 1,
          renewBelow: 2000,
        },

        sourceDefaults: {
          miners: 1,
          haulers: 1,
        },

        sourcesById: {},
      },
      E12N32: {
        enabled: true,
        homeRoom: "E12N33",
        phase: 1,
        jrWorkers: 2,
        remoteWorkers: 1,

        reservation: {
          enabled: true,
          reservers: 2,
          renewBelow: 5000,
        },

        sourceDefaults: {
          miners: 1,
          haulers: 1,
        },

        sourcesById: {},
      },
      E11N32: {
        enabled: true,
        homeRoom: "E12N33",
        phase: 1,
        jrWorkers: 2,
        remoteWorkers: 1,

        reservation: {
          enabled: true,
          reservers: 1,
          renewBelow: 2000,
        },

        sourceDefaults: {
          miners: 1,
          haulers: 1,
        },

        sourcesById: {},
      },
      */,
    },
  },
};
