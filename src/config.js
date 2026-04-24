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
- Directive settings now control critical event reporting rather than recurring narration.
- Detailed room reads should live behind ops utilities, not passive console spam.
*/

module.exports = {
  HUD: {
    ENABLED: true,
    ROOM_SUMMARY: true,
    ROOM_SUMMARY_INTERVAL: 1,
    CREEP_LABELS: true,
    LABEL_INTERVAL: 1,
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
  Expansion Controls

  Expansion is console-driven in this phase. The empire layer may observe all
  rooms, but it only spawns claimers/pioneers for rooms explicitly registered
  with ops.expand().
  */
  EXPANSION: {
    ENABLED: true,
    MIN_PARENT_RCL: 4,
    PIONEERS_PER_EXPANSION: 2,
    CLAIM_PRIORITY: 95,
    PIONEER_PRIORITY: 75,
    CLAIMER_REPLACE_TTL: 200,
    PIONEER_REPLACE_TTL: 200,
  },

  /*
  Developer Notes:
  Reserved Room Operations

  Reserved rooms are manually registered with ops.reserve(). They stay attached
  to a stable parent room and return remote source energy home. Keep planning
  throttled so extra rooms do not add owned-room-level CPU every tick.
  */
  RESERVATION: {
    ENABLED: true,
    MIN_PARENT_RCL: 4,
    REQUIRE_STABLE_PARENT: true,
    MAX_DISTANCE: 3,
    REMOTE_PLAN_INTERVAL: 100,
    MAX_REMOTE_SITES_PER_ROOM: 5,
    RESERVATION_REFRESH_TICKS: 2500,
    RESERVER_PRIORITY: 96,
    REMOTE_WORKER_PRIORITY: 74,
    REMOTE_MINER_PRIORITY: 73,
    REMOTE_HAULER_PRIORITY: 72,
    DEFENSE_PRIORITY: 1050,
    DEFENSE_SPAWN_COOLDOWN: 25,
    DEFENSE_SUPPORT_ENABLED: true,
    DEFENSE_SUPPORT_DISTANCE: 2,
    MAX_REMOTE_DEFENDERS: 1,
    RESERVER_REPLACE_TTL: 200,
    REMOTE_CREEP_REPLACE_TTL: 100,
    SOURCE_INCOME_PER_TICK: 10,
    REMOTE_HAULER_CARRY_PARTS: 8,
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
    towerBankingThreshold: 200,
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
    HAULER_MIN_STORAGE_ENERGY: 5000,
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
    MINERAL_MINING_MIN_STORAGE_ENERGY: 5000,
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
  Upgrader Reserve Policy

  Mature rooms should stop burning every stored surplus into controller
  progress. Use soft storage gates so mineral ops and buffer growth can
  coexist with upgrading:
  - body size scales up only when storage is genuinely comfortable
  - desired total work ramps later than before
  - RCL8 stays in maintenance mode unless storage is clearly ahead
  */
  UPGRADING: {
    CONTROLLER_LINK_PROFILE_STORAGE_ENERGY: 20000,
    RESERVE_BANK_MIN_STORAGE_ENERGY: 5000,
    TARGET_WORK_THRESHOLDS: [
      { energy: 20000, work: 6 },
      { energy: 60000, work: 10 },
      { energy: 120000, work: 14 },
    ],
    BODY_WORK_THRESHOLDS: [
      { energy: 0, work: 4 },
      { energy: 20000, work: 6 },
      { energy: 60000, work: 8 },
    ],
    RCL7_TARGET_WORK_BONUS: 1,
    RCL8_DOWNGRADE_SAFETY_TICKS: 50000,
    RCL8_TARGET_WORK_CAPS: [
      { energy: 0, work: 2 },
      { energy: 30000, work: 4 },
      { energy: 80000, work: 6 },
    ],
    RCL8_BODY_WORK_CAPS: [
      { energy: 0, work: 2 },
      { energy: 30000, work: 3 },
      { energy: 80000, work: 4 },
    ],
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
    // Reactive defender spawning stays narrow:
    // - owned rooms defend reactively when hostiles appear
    // - nearby owned rooms can lend one defender when local defense is thin
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
      CROSS_ROOM_ENABLED: true,
      MAX_SUPPORT_DISTANCE: 2,
      MAX_SUPPORT_DEFENDERS: 1,
      SUPPORT_PRIORITY: 1050,
      SUPPORT_SPAWN_COOLDOWN: 25,
      SUPPORT_REQUEST_TTL: 75,
      SUPPORT_MIN_RCL: 3,
      SUPPORT_MIN_ENERGY_CAPACITY: 650,
    },
  },

  BODIES: {
    // Developer note:
    // Body planning is role-specific and uses room energy capacity plus
    // infrastructure state instead of a single shared tier ladder.
    workerMaxWork: 8,
    minerMaxWork: 5,
    mineralMinerMaxWork: 5,
    remoteMinerMaxWork: 5,
    remoteWorkerMaxWork: 6,
    haulerMaxCarry: 16,
    remoteHaulerMaxCarry: 16,
    upgraderMaxWork: 8,
    repairMaxWork: 6,
    haulerRoundTripBuffer: 4,
    sourceIncomePerTick: 10,
  },

  STATS: {
    RUNTIME_POLICY: {
      SOFT_CPU_LIMIT: 20,
      TIGHT_CPU_RATIO: 0.8,
      CRITICAL_CPU_RATIO: 0.92,
      TIGHT_BUCKET: 8000,
      CRITICAL_BUCKET: 4000,
      DETAIL_DOWNGRADE_AT_TIGHT: true,
      THINK_INTERVAL_MULTIPLIER: {
        normal: 1,
        tight: 3,
        critical: 5,
      },
      CONSTRUCTION_INTERVAL_MULTIPLIER: {
        normal: 1,
        tight: 4,
        critical: 8,
      },
      ROOM_SCALE: {
        ENABLED: true,
        START_ROOMS: 3,
        THINK_STEP: 0.5,
        CONSTRUCTION_STEP: 1,
        ADVANCED_OPS_STEP: 1,
        MAX_THINK_MULTIPLIER: 3,
        MAX_CONSTRUCTION_MULTIPLIER: 4,
        MAX_ADVANCED_OPS_INTERVAL: 6,
      },
      SKIP_DIRECTIVES_AT: "tight",
      SKIP_HUD_AT: "tight",
    },
  },

  DIRECTIVES: {
    // Developer note:
    // Keep console output event-driven:
    // alerts, RCL changes, phase transitions, and milestone completions.
    ENABLED: true,

    // Developer note:
    // Print after each critical update so console utility output stays readable.
    SEPARATOR_LINE:
      "------------------------------------------------------------",

    // Developer note:
    // Debug CPU output remains opt-in and separate from critical room reports.
    DEBUG_CPU_CONSOLE_ENABLED: false,
    DEBUG_CPU_CONSOLE_INTERVAL: 100,
    DEBUG_CPU_SHOW_SECTIONS: false,

    // Developer note:
    // Sampling cadence for next-RCL estimates shown in HUD and ops.room(...).
    PROGRESS_SAMPLE_INTERVAL: 100,

    // Developer note:
    // Critical room updates only.
    SHOW_ALERT_DIRECTIVES: true,
    SHOW_RCL_DIRECTIVES: true,
    SHOW_PHASE_TRANSITION_DIRECTIVES: true,
    SHOW_MILESTONE_DIRECTIVES: true,
  },
};
