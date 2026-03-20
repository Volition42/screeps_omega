# screeps_omega

Working overview and operator reference for the `dev/` game code.

## What This Bot Does

- Runs one manager loop per owned room.
- Uses room phases to control spawning, construction, logistics, defense, and remotes.
- Favors simple, reactive behavior over wide automation.
- Tracks CPU and can reduce work when pressure rises.

## Runtime Flow

1. `dev/main.js`
   Starts the bot by calling `kernel_loop`.
2. `dev/kernel_loop.js`
   Cleans memory, collects owned rooms, runs each room, records CPU stats.
3. `dev/room_manager.js`
   Builds room state, then runs construction, towers, spawning, creeps, signing, directives, and HUD.
4. `dev/room_state.js`
   Collects shared room facts and decides the current room phase.

## Room Phases

- `bootstrap_jr`
  Early survival. `jrworker` keeps the room alive.
- `bootstrap`
  Builds source containers, controller container, and the road backbone.
- `developing`
  Builds extensions, first tower, storage, internal roads, and defense.
- `stable`
  Keeps the current RCL core buildout complete and economy healthy.
- `rcl5`
  Adds link planning and link placement from the cached future plan.
- `rcl6`
  Adds terminal, extractor, and first lab cluster from the cached future plan.

## Construction System

- `dev/construction_roadmap.js`
  Defines what each phase and RCL is trying to build.
- `dev/construction_status.js`
  Measures current build progress and readiness against the roadmap.
- `dev/construction_manager.js`
  Places construction sites in roadmap order.

Construction rules:

- Current phase work is placed before later work.
- Site caps are always respected.
- Remote construction is planned on its own slower interval.
- RCL5 and RCL6 layout planning is cached in room memory and reused for placement.

## Spawning And Roles

- `dev/spawn_manager.js`
  Builds the spawn queue from room phase, economy needs, defense, and remote assignments.
- `dev/bodies.js`
  Selects creep bodies from room energy capacity and threat level.
- `dev/creep_manager.js`
  Dispatches each creep to its role and handles retreat behavior.

Home roles:

- `jrworker`
  Bootstrap-only recovery labor.
- `worker`
  Builds and fills core structures.
- `miner`
  Harvests source containers.
- `hauler`
  Moves energy through the room.
- `upgrader`
  Feeds controller progress.
- `repair`
  Maintains roads, containers, and defenses.
- `defender`
  Home-room melee defense.

Remote roles:

- `remotejrworker`
  Early remote bootstrap.
- `remoteworker`
  Remote infrastructure build support.
- `remoteminer`
  Remote source harvesting.
- `remotehauler`
  Remote energy transport.
- `reserver`
  Reservation maintenance.
- `rangeddefender`
  Remote-only ranged defense.

## Logistics And Defense

- `dev/logistics_manager.js`
  Shared withdrawal and delivery priorities.
- `dev/defense_manager.js`
  Threat classification for home and configured remotes.
- `dev/tower_manager.js`
  Tower attack, heal, and repair behavior.
- `dev/role_defender.js`
  Home threat response.
- `dev/role_ranged_defender.js`
  Remote threat response with sticky remote alerts.

Defense notes:

- Defense is reactive only.
- Remote alerts can stay latched from cached intel until vision clears the room.
- Civilian creeps retreat from threatened rooms.

## Remote Mining

- `dev/remote_manager.js`
  Normalizes remote config, caches remote intel, and schedules remote scans.

Remote notes:

- Remotes are configured in `dev/config.js`.
- Remote work is budgeted to save CPU.
- Cached intel is reused when a remote does not need a fresh scan.

## CPU And Visibility

- `dev/kernel_profiler.js`
  Captures per-section CPU timing.
- `dev/stats_manager.js`
  Stores rolling CPU stats and prints overview or detail logs.
- `dev/hud.js`
  Draws room and remote status.
- `dev/directive_manager.js`
  Optional console reporting.

CPU notes:

- `STATS.CPU_CONSOLE_MODE` supports `off`, `overview`, and `detail`.
- Runtime pressure can reduce HUD, directives, planning cadence, and remote scan work.

## Config And Setup

- `dev/config.js`
  Main operator file. Use this for creep counts, construction settings, defense tuning, CPU reporting, and remote room setup.
- `dev/stamp_library.js`
  Holds reusable room layout stamps and reserved anchor slots.
- `dev/utils.js`
  Shared helpers used across managers and roles.

Common operator tasks:

- Change remote rooms in `REMOTE_MINING.SITES`.
- Change creep targets in `CREEPS`.
- Change construction cadence and advanced planning in `CONSTRUCTION`.
- Change CPU logging in `STATS`.
- Change defense behavior in `DEFENSE`.

## Memory And Cache Use

- Room runtime state is cached during the tick for reuse by managers.
- Construction future plans are stored in `Memory.rooms[roomName].construction.futurePlan`.
- Remote intel is stored in `Memory.rooms[targetRoom].remoteIntel`.
- CPU history is stored in `Memory.stats`.

## Quick File Map

- `dev/main.js`: Screeps entry point
- `dev/kernel_*`: top-level loop, memory cleanup, profiler
- `dev/room_*`: room orchestration and room state
- `dev/construction_*`: roadmap, status, site placement
- `dev/spawn_manager.js`: spawn queue builder
- `dev/creep_manager.js`: role dispatcher
- `dev/role_*.js`: creep role behavior
- `dev/remote_manager.js`: remote planning and cache
- `dev/defense_manager.js`: threat planning
- `dev/logistics_manager.js`: shared energy rules
- `dev/hud.js`: visuals and room console summary
- `dev/stats_manager.js`: CPU and runtime reporting
- `dev/config.js`: operator settings

## Practical Notes

- Keep changes narrow. Most behavior is intentionally phase-driven.
- Prefer changing `config.js` before changing logic when tuning behavior.
- If construction or spawning looks stuck, check room phase first, then `buildStatus`, then spawn queue.
- If CPU is high, switch console mode to `overview` or `off` before deeper profiling.
