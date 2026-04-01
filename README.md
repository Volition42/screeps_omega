# screeps_omega

Working overview and operator reference for the `src/` game code.

## What This Bot Does

- Runs one manager loop per owned room.
- Uses room phases to control spawning, construction, logistics, defense, and remotes.
- Favors simple, reactive behavior over wide automation.
- Tracks CPU and can reduce work when pressure rises.

## Runtime Flow

1. `src/main.js`
   Starts the bot by calling `kernel_loop`.
2. `src/kernel_loop.js`
   Cleans memory, collects owned rooms, runs each room, records CPU stats.
3. `src/room_manager.js`
   Builds room state, then runs construction, towers, spawning, creeps, signing, directives, and HUD.
4. `src/room_state.js`
   Collects shared room facts and decides the current room phase.

## Room Phases

- `bootstrap`
  Early survival. `jrworker` keeps the room alive and pushes to RCL2.
- `foundation`
  Builds source containers and the road backbone.
- `development`
  Builds extensions, first tower, storage, internal roads, and defense.
- `logistics`
  Adds link planning and first link placement from the cached future plan.
- `specialization`
  Adds terminal, extractor, and first lab cluster from the cached future plan.
- `fortification`
  Stubbed late-game hardening phase for future RCL7 construction work.
- `command`
  Stubbed final room-completion phase for future RCL8 construction work.

## Construction System

- `src/construction_roadmap.js`
  Defines what each named room phase is trying to build.
- `src/construction_status.js`
  Measures current build progress and readiness against the roadmap.
- `src/construction_manager.js`
  Places construction sites in roadmap order.

Construction rules:

- Current phase work is placed before later work.
- Site caps are always respected.
- Remote construction is planned on its own slower interval.
- Advanced-phase layout planning is cached in room memory and reused for placement.

## Spawning And Roles

- `src/spawn_manager.js`
  Builds the spawn queue from room phase, economy needs, defense, and remote assignments.
- `src/bodies.js`
  Selects creep bodies from room energy capacity and threat level.
- `src/creep_manager.js`
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

- `src/logistics_manager.js`
  Shared withdrawal and delivery priorities.
- `src/defense_manager.js`
  Threat classification for home and configured remotes.
- `src/tower_manager.js`
  Tower attack, heal, and repair behavior.
- `src/role_defender.js`
  Home threat response.
- `src/role_ranged_defender.js`
  Remote threat response with sticky remote alerts.

Defense notes:

- Defense is reactive only.
- Remote alerts can stay latched from cached intel until vision clears the room.
- Civilian creeps retreat from threatened rooms.

## Remote Mining

- `src/remote_manager.js`
  Normalizes remote config, caches remote intel, and schedules remote scans.

Remote notes:

- Remotes are configured in `src/config.js`.
- Remote work is budgeted to save CPU.
- Cached intel is reused when a remote does not need a fresh scan.

## CPU And Visibility

- `src/kernel_profiler.js`
  Captures per-section CPU timing.
- `src/stats_manager.js`
  Stores rolling CPU stats and prints overview or detail logs.
- `src/hud.js`
  Draws room and remote status.
- `src/directive_manager.js`
  Optional console reporting.

CPU notes:

- `STATS.CPU_CONSOLE_MODE` supports `off`, `overview`, and `detail`.
- Runtime pressure can reduce HUD, directives, planning cadence, and remote scan work.

## Config And Setup

- `src/config.js`
  Main operator file. Use this for creep counts, construction settings, defense tuning, CPU reporting, and remote room setup.
- `src/stamp_library.js`
  Holds reusable room layout stamps and reserved anchor slots.
- `src/utils.js`
  Shared helpers used across managers and roles.

Common operator tasks:

- Change remote rooms in `REMOTE_MINING.SITES`.
- Change creep targets in `CREEPS`.
- Change construction cadence and advanced planning in `CONSTRUCTION`.
- Change CPU logging in `STATS`.
- Change defense behavior in `DEFENSE`.

## Source Layout

- `src/` is the single Screeps source tree for both local validation and live deployment updates.
- Private-server workflow details live in `docs/private_server_dev_workflow.md`.
- The local browser client for that workflow runs separately on `http://127.0.0.1:8080/`.
- The repo also includes private-server admin helpers for room reseed, tick-speed changes, and invader injection.

## Deterministic Validation

- `scripts/validation/solo_room_harness.js`
  Runs a deterministic single-room validation pass against `src/` without relying on the private server.

Validation notes:

- The harness checks the named room phases from `bootstrap` through `command`.
- It also validates late-game factory operations and advanced haul task selection.
- Run it with `node scripts/validation/solo_room_harness.js`.
- Use it for fast correctness checks, then use the private server for spot-checking live behavior.

## Memory And Cache Use

- Room runtime state is cached during the tick for reuse by managers.
- Construction future plans are stored in `Memory.rooms[roomName].construction.futurePlan`.
- Remote intel is stored in `Memory.rooms[targetRoom].remoteIntel`.
- CPU history is stored in `Memory.stats`.

## Quick File Map

- `src/main.js`: Screeps entry point
- `src/kernel_*`: top-level loop, memory cleanup, profiler
- `src/room_*`: room orchestration and room state
- `src/construction_*`: roadmap, status, site placement
- `src/spawn_manager.js`: spawn queue builder
- `src/creep_manager.js`: role dispatcher
- `src/role_*.js`: creep role behavior
- `src/remote_manager.js`: remote planning and cache
- `src/defense_manager.js`: threat planning
- `src/logistics_manager.js`: shared energy rules
- `src/hud.js`: visuals and room console summary
- `src/stats_manager.js`: CPU and runtime reporting
- `src/config.js`: operator settings

## Practical Notes

- Keep changes narrow. Most behavior is intentionally phase-driven.
- Prefer changing `config.js` before changing logic when tuning behavior.
- If construction or spawning looks stuck, check room phase first, then `buildStatus`, then spawn queue.
- If CPU is high, switch console mode to `overview` or `off` before deeper profiling.
