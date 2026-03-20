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

Important Notes:
- Keep the hauler override example in place for future tuning.
- HUD options should stay easy to toggle during testing.
- Directive settings control both recurring reports and one-time milestone announcements.
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
    // These are the target counts once the room transitions into the
    // normal colony phases.
    workers: 4,

    // Developer note:
    // Upgraders now self-supply from shared room energy buffers instead of
    // standing on a dedicated controller container.
    upgraders: 1,
    repairs: 1,

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
      repair: 2,
      upgrader: 2,
    },
  },

  /*
  Developer Notes:
  Construction System Controls

  Roadmap intent by phase:
  - bootstrap_jr: no formal room buildout, just survive and upgrade
  - bootstrap: source containers and road backbone
  - developing: extensions, first tower, storage, internal roads, and defense
  - stable: finish the current RCL core layout cleanly
  - rcl5: add link backbone from the cached future plan
  - rcl6: add terminal, extractor, and first lab cluster from the cached future plan

  CPU policy:
  - live construction placement stays on the normal plan interval
  - advanced RCL5/RCL6 layout planning is cached and rebuilt slowly
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

    rampartMinHits: 1000,
    wallMinHits: 1000,
  },

  /*
  Developer Notes:
  Logistics Controls

  towerEmergencyThreshold
  If any tower drops below this level, or if hostiles are present,
  haulers switch to threat mode and towers move ahead of storage reserve work.

  towerReserveThreshold
  In normal mode, towers are only topped up after storage and only if they are
  below this reserve level.
  */
  LOGISTICS: {
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
    // These tiers are keyed off room.energyCapacityAvailable, not current energy.
    maxTierEnergy: 1800,
  },

  STATS: {
    // Developer note:
    // CPU console reporting modes:
    // - off: no CPU console output
    // - overview: top-level sections only
    // - detail: top-level sections plus per-room and per-role breakdowns
    CPU_CONSOLE_MODE: "off",
    CPU_PRINT_INTERVAL: 25,
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
    SHOW_PROGRESS_DIRECTIVES: false,
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
};
