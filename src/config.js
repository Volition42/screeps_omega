/*
Developer Summary:
Global configuration for current dev.

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
- Directive output should read like an analyst snapshot, not executive narration.
*/

module.exports = {
  HUD: {
    ENABLED: true,
    LEAN_MODE: true,
    SUMMARY_INTERVAL: 1,
    CREEP_LABELS: true,
    LABEL_INTERVAL: 1,
    CONSOLE_ENABLED: false,
    CONSOLE_INTERVAL: 50,

    // Developer note:
    // Show a tiny performance line using Memory.stats from stats_manager.
    SHOW_PERFORMANCE: false,

    // Developer note:
    // Construction checklist shown in the top-left home-room panel.
    // This now includes roadmap phase, future-plan readiness, and advanced
    // structure progress so construction status can be read quickly.
    SHOW_CONSTRUCTION_CHECKLIST: true,
    CONSTRUCTION_CHECKLIST_MODE: "detailed",
  },

  CREEPS: {
    // Developer note:
    // JrWorkers are only used during the earliest bootstrap phase.
    jrWorkers: 4,

    // Developer note:
    // Normal economy roles now use demand-based spawning. Keep only the
    // fixed-count knobs that are still true constants.
    //
    // Miners are always one per source.
    minersPerSource: 1,
    mineralMinersPerRoom: 1,

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
      repair: 2,
      upgrader: 2,
    },
  },

  /*
  Developer Notes:
  Construction System Controls

  Roadmap intent by phase:
  - bootstrap: no formal room buildout, just survive and upgrade
  - foundation: source containers and road backbone
  - development: extensions, first tower, storage, internal roads, and defense
  - logistics: add the first link backbone from the cached future plan
  - specialization: add terminal, extractor, and the first lab cluster
  - fortification: stubbed late-game hardening phase for future RCL7 work
  - command: stubbed finalization phase for future RCL8 work

  CPU policy:
  - live construction placement stays on the normal plan interval
  - advanced phase layout planning is cached and rebuilt slowly
  - cached advanced plans are reused for actual site placement

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
    ADVANCED_PLAN_INTERVAL: 250,
    ADVANCED_ACTIONS: {
      // Developer note:
      // Advanced structure placement should normally use the cached future plan.
      // Disable only when manually debugging future-plan generation.
      USE_CACHED_FUTURE_PLAN: true,

      // Developer note:
      // Rebuild the cached future plan immediately when the room layout context
      // changes enough to affect advanced structure placement.
      REPLAN_ON_LAYOUT_CHANGE: true,
    },
    FUTURE_INFRA: {
      // Developer note:
      // These ranges define the planner's preferred placement envelope.
      // They are planning hints, not transfer logic.
      LINK_CONTROLLER_RANGE: 2,
      LINK_SOURCE_RANGE: 2,
      STORAGE_LINK_RANGE: 2,
      TERMINAL_RANGE_FROM_STORAGE: 2,
      LAB_RANGE_FROM_STORAGE: 6,
      LAB_CLUSTER_SIZE_AT_RCL6: 3,
      FACTORY_RANGE_FROM_STORAGE: 3,
      POWER_SPAWN_RANGE_FROM_STORAGE: 4,
      OBSERVER_RANGE_FROM_ANCHOR: 6,
      NUKER_RANGE_FROM_ANCHOR: 7,
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

    rampartMinHits: 1000,
    wallMinHits: 1000,
  },

  /*
  Developer Notes:
  Logistics Controls

  towerEmergencyThreshold
  If any tower drops below this level, haulers top towers up to this threshold
  after spawn/extensions are safe. Under hostile pressure, towers are filled
  more aggressively toward capacity.

  towerReserveThreshold
  In normal mode, towers are only topped up after storage and only if they are
  below this reserve level.
  */
  LOGISTICS: {
    towerEmergencyThreshold: 400,
    towerReserveThreshold: 700,
    storageEnergyCap: 200000,
    hubContainerTarget: 1000,
    controllerContainerTarget: 1500,
  },

  /*
  Developer Notes:
  Advanced Structure Operations

  These settings control the first runtime slice for late-game structures.
  Keep policies conservative and CPU-cheap:
  - labs only run when a valid reaction can be supplied
  - factory currently focuses on simple battery production
  - haulers only service advanced tasks when the room economy is already stable
  */
  ADVANCED: {
    HAULER_MIN_STORAGE_ENERGY: 20000,
    TASK_LOCK_TTL: 10,
    HAUL_TASK_PRIORITY: [
      "lab_cleanup",
      "lab_output",
      "lab_input",
      "mineral_output",
      "factory_output",
      "factory_input",
      "factory_energy",
      "power_spawn_power",
      "power_spawn_energy",
      "nuker_ghodium",
      "nuker_energy",
    ],
    LABS: {
      ENABLED: true,
      INPUT_TARGET: 500,
      INPUT_START_MIN: 100,
      OUTPUT_UNLOAD_AT: 250,
      PRODUCT_PRIORITY: [
        "OH",
        "ZK",
        "UL",
        "G",
        "GH",
        "GO",
        "UH",
        "UO",
        "KH",
        "KO",
        "LH",
        "LO",
        "ZH",
        "ZO",
      ],
    },
    MINERAL_MINING_MIN_STORAGE_ENERGY: 20000,
    MINERAL_EXPORT_AT: 100,
    FACTORY: {
      ENABLED: true,
      PRODUCT_PRIORITY: ["battery"],
      MIN_STORAGE_ENERGY: 50000,
      FACTORY_ENERGY_TARGET: 1200,
      EXPORT_BATCH: 100,
    },
    POWER_SPAWN: {
      ENABLED: true,
      MIN_STORAGE_ENERGY: 100000,
      ENERGY_TARGET: 3000,
      POWER_TARGET: 50,
    },
    NUKER: {
      ENABLED: true,
      MIN_STORAGE_ENERGY: 150000,
      ENERGY_TARGET: 50000,
      GHODIUM_TARGET: 1000,
    },
  },

  /*
  Developer Notes:
  Defense Planning Configuration
  */
  DEFENSE: {
    ENABLED: true,
    MIN_CONTROLLER_LEVEL: 2,
    MAX_CHOKE_DEPTH: 8,
    // Developer note:
    // Wall and rampart upkeep scales by controller level so maintenance work
    // rises with room maturity without changing choke or gate planning.
    maintenanceByControllerLevel: {
      2: 5000,
      3: 10000,
      4: 25000,
      5: 50000,
      6: 100000,
    },

    // Developer note:
    // Reactive defender spawning stays narrow in Phase 1:
    // - owned rooms defend reactively when hostiles appear
    REACTION: {
      ENABLED: true,
      MAX_HOME_DEFENDERS: 3,
      HOME_INVASION_PRIORITY: 1100,
      HOME_SPAWN_COOLDOWN: 5,
      REPLACE_TTL: 90,
      SCORE_PER_HOME_DEFENDER: 6,
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
    // Body planning is role-specific and uses room energy capacity plus
    // infrastructure state instead of a single shared tier ladder.
    workerMaxWork: 8,
    minerMaxWork: 5,
    mineralMinerMaxWork: 5,
    haulerMaxCarry: 16,
    upgraderMaxWork: 8,
    repairMaxWork: 6,
    haulerRoundTripBuffer: 4,
    sourceIncomePerTick: 10,
  },

  STATS: {
    RUNTIME_POLICY: {
      TIGHT_CPU_RATIO: 0.8,
      CRITICAL_CPU_RATIO: 0.92,
      TIGHT_BUCKET: 8000,
      CRITICAL_BUCKET: 4000,
      DETAIL_DOWNGRADE_AT_TIGHT: true,
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
    // Controls how often the room snapshot system logs updates.
    ENABLED: true,
    INTERVAL: 50,

    // Developer note:
    // Keep directive output easy to scan in the console.
    // HEADER_LABEL sets the snapshot prefix and SEPARATOR_LINE prints after
    // each directive block so later console messages do not run together.
    HEADER_LABEL: "Room Snapshot",
    SEPARATOR_LINE:
      "------------------------------------------------------------",

    // Developer note:
    // Performance-aware snapshot settings.
    SHOW_PERFORMANCE_DIRECTIVES: false,
    CPU_SPIKE_MULTIPLIER: 1.5,
    BUCKET_WARNING_THRESHOLD: 8000,
    HEALTHY_REPORT_INTERVAL: 100,
    DEBUG_CPU_CONSOLE_ENABLED: false,
    DEBUG_CPU_CONSOLE_INTERVAL: 100,
    DEBUG_CPU_SHOW_SECTIONS: false,

    // Developer note:
    // Progress / ETA directives for controller advancement.
    SHOW_PROGRESS_DIRECTIVES: true,
    PROGRESS_SAMPLE_INTERVAL: 100,
    PROGRESS_REPORT_INTERVAL: 300,

    // Developer note:
    // Construction checklist directives.
    SHOW_CONSTRUCTION_DIRECTIVES: true,
    CONSTRUCTION_REPORT_INTERVAL: 75,

    // Developer note:
    // One-time snapshot announcements.
    SHOW_PHASE_TRANSITION_DIRECTIVES: true,
    SHOW_MILESTONE_DIRECTIVES: true,
  },
};
