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
- REMOTE_MINING

Important Notes:
- Keep the hauler override example in place for future tuning.
- HUD options should stay easy to toggle during testing.
- Directive settings control both recurring reports and one-time milestone announcements.
- Remote mining starts with a simple manual phase 1 setup and can expand later.
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

    /*
    Developer note:
    Remote site status block shown in the room HUD.

    SHOW_REMOTE_SITES
    Master toggle for showing configured remote rooms in the home room HUD.

    REMOTE_SITE_MODE
    "compact"  = one shorter line per remote site
    "detailed" = one fuller line per remote site

    This is currently tuned for Remote Phase 1 and will expand later.
    */
    SHOW_REMOTE_SITES: true,
    REMOTE_SITE_MODE: "detailed",
  },

  CREEPS: {
    // Developer note:
    // JrWorkers are only used during the pre-infrastructure bootstrap phase.
    jrWorkers: 4,

    // Developer note:
    // These are the target counts once the room transitions into the
    // normal colony phases.
    workers: 4,
    upgraders: 1,
    repairs: 2,

    // Developer note:
    // Miners are currently locked to one per source.
    minersPerSource: 1,

    // Developer note:
    // Default hauler count per source when no source-specific override exists.
    haulersPerSourceDefault: 2,

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

  /*
  Developer Notes:
  Construction System Controls

  MAX_SITES
  Limits the total number of construction sites the AI will create at once.
  Screeps allows up to 100 sites globally, but large numbers slow worker focus
  and can create chaotic build queues. A lower limit keeps construction orderly.

  PLAN_INTERVAL
  How often the construction planner runs in ticks.
  Lower value = more responsive planning, slightly higher CPU.
  Higher value = slower reaction, lower CPU.
  */
  CONSTRUCTION: {
    MAX_SITES: 8,
    PLAN_INTERVAL: 50,
  },

  /*
  Developer Notes:
  Repair Behavior Thresholds

  criticalContainerThreshold
  Containers are critical infrastructure for mining and upgrading.
  When below this threshold, they become high priority repairs.

  importantThreshold
  General important structures are considered repair candidates below this level.

  spawnExtensionThreshold
  Spawn and extensions are energy infrastructure and should stay near full HP.

  roadThreshold
  Roads decay constantly, so this is lower to avoid wasting energy over-repairing.

  rampartMinHits / wallMinHits
  Early defensive baseline targets. These should scale upward later.
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
  */
  LOGISTICS: {
    controllerContainerReserve: 1500,
  },

  /*
  Developer Notes:
  Defense Planning Configuration

  ENABLED
  Master toggle for automated defense planning.

  MIN_CONTROLLER_LEVEL
  Defense construction starts only at or above this controller level.

  PADDING_X / PADDING_Y
  Size of the planned perimeter around the core.

  GATE_WIDTH
  Reserved for future wider gate support.

  towerCountAtRCL3
  Desired number of towers once RCL3 is reached.
  */
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
    // That means the room plans for what it can support consistently.
    //
    // Current intended progression:
    // 300 = early room
    // 550 = RCL2 with extensions
    // 800 = early RCL3 strength
    maxTierEnergy: 800,
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

  Phase 1:
  - Manual remote room config
  - Remote JrWorkers only
  - Harvest in remote room and bring energy home
  - No containers, roads, reservation, or defense yet

  Remote spawning policy:
  - Allowed only when the home room is in developing or stable
  - Pauses automatically if the home room falls back into bootstrap
  - Existing remote creeps may continue running, but no new ones should spawn

  homeRoom
  The owned room responsible for spawning and receiving energy.

  phase
  Current remote rollout stage.
  Use 1 for Remote JrWorker bootstrap only.

  jrWorkers
  Number of remote bootstrap workers to maintain for this site.
  */
  REMOTE_MINING: {
    ENABLED: true,

    SITES: {
      E11N33: {
        enabled: true,
        homeRoom: "E12N33",
        phase: 1,
        jrWorkers: 2,
      },
    },
  },
};
