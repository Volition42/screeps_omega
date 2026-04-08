# Home Room Phases Reference

Code-derived reference for the current home-room phase system.

This document describes what the phase resolver does today, not an aspirational design. The source of truth lives in:

- `src/room_state.js` for phase resolution
- `src/construction_roadmap.js` for phase intent
- `src/construction_status.js` for completion gates
- `src/spawn_manager.js` for workforce behavior
- `src/room_reporting.js` for blocked-task reporting

## Phase Order

`bootstrap -> foundation -> development -> logistics -> specialization -> fortification -> command`

Minimum controller levels by phase:

- `bootstrap`: RCL1
- `foundation`: RCL2
- `development`: RCL3+
- `logistics`: RCL5+
- `specialization`: RCL6+
- `fortification`: RCL7+
- `command`: RCL8

## How Phase Resolution Works

Each tick, the room phase is recomputed from current room state.

1. The resolver starts at `bootstrap` if the room is below RCL2, otherwise `foundation`.
2. It then checks each later phase in order.
3. A room only advances if the current phase's real readiness gate passes.
4. The phase is not permanently latched in memory. If the controller unlocks new structure caps and the room has not caught up yet, the room can temporarily present as an earlier phase again.

Important consequences:

- A fresh RCL7 or RCL8 room can fall back to `development` until new extension and tower targets are built.
- Legacy or migrated rooms are allowed to advance with "good enough" infrastructure instead of perfect symmetry.
- Advanced placement plans are helpful for logistics and later phases, but `futurePlanReady` is not itself a phase transition gate.

## Quick Reference

| Phase | Main focus | Enter when | Exit when |
| --- | --- | --- | --- |
| `bootstrap` | survive and reach RCL2 | controller below RCL2 | controller reaches RCL2 |
| `foundation` | containers and backbone roads | RCL2+ and not yet development-ready | economy backbone exists and foundation is complete enough |
| `development` | core economy and defenses | foundation gate passed | RCL5+, stable economy, and development is complete enough |
| `logistics` | first link backbone | RCL5+ and development gate passed | RCL6+ and logistics link goal is complete |
| `specialization` | terminal, mineral access, labs | RCL6+ and logistics complete | RCL7+ and specialization targets are complete |
| `fortification` | factory and mature-room hardening | RCL7+ and specialization complete | RCL8+ and factory is complete |
| `command` | final RCL8 structures | RCL8+ and fortification complete | no later phase; command is "done" when observer, power spawn, nuker, and spawn targets are complete |

## Global Notes

- `bootstrap` is the only phase with no formal construction completion flag.
- Construction intent is broader than the actual advance gate. Some phases place optional or opportunistic work that does not block the next phase.
- Reactive defense spawning can happen in every phase.
- Recovery logic can temporarily force bootstrap-style spawning even in later rooms if the economy collapses.

## Bootstrap

Purpose:

- Keep the room alive.
- Harvest directly.
- Push the controller to RCL2 as fast as possible.

Entry:

- Controller level is below `2`.

Exit:

- Controller reaches `2`.

Primary steps:

1. Spawn `jrworker` creeps to cover basic harvesting, filling, building, and upgrading.
2. Keep the spawn supplied well enough to avoid a dead room.
3. Upgrade out of RCL1 into the first real infrastructure phase.

Spawn and workforce behavior:

- Normal bootstrap spawning is almost entirely `jrworker`.
- The configured `jrworker` target is capped to `2` while the room is still truly RCL1.
- If the economy is fully collapsed, recovery logic also prefers `jrworker` first.

Construction scope:

- No formal roadmap build list.
- The room is expected to survive first and unlock RCL2 before the structured roadmap begins.

Typical blocker:

- `waiting on RCL2`

## Foundation

Purpose:

- Convert the room from direct-harvest survival into a container-backed backbone economy.

Entry:

- Controller is at least `2`.
- The room is not yet ready for `development`.

Advance gate to `development`:

- Controller is at least `2`.
- `hasDevelopingEconomyBackbone` is true.
- In practice that means the room has at least one laborer (`worker` or `jrworker`), is not effectively dead, and is not stuck at critically low energy with only one economy creep left.
- And one of these build conditions is true:
- `foundationComplete`
- Legacy tolerance: controller is at least `3` and all source containers exist

What `foundationComplete` means:

- All source containers are built or sited
- Hub container goal is met
- Controller container goal is met
- Roads are "good enough"

Road tolerance:

- Full road count passes
- Or at least `60%` of the road target is built
- Or at RCL3+, at least `8` roads exist

Primary steps:

1. Build one container per source.
2. Build a hub container near the spawn until storage exists.
3. Build a controller container until controller-link logistics later replaces it.
4. Build anchor and backbone roads.
5. Start laying future core footprint pieces such as extension stamp space when legal.

Spawn and workforce behavior:

- If source containers are not ready yet, the room spawns `worker` only for economy labor and returns early.
- Once source containers are ready, normal core economy spawning begins: `miner`, `worker`, `upgrader`, and `hauler`.
- `repair` creeps are intentionally disabled during foundation.

Construction scope from the roadmap:

- `sourceContainers`
- `hubContainer`
- `controllerContainer`
- `anchorRoads`
- `backboneRoads`
- `extensionStamps`
- `mineralAccessRoad`

What actually blocks advancement:

- Source containers
- Hub container
- Controller container
- Enough roads
- A minimally functioning economy backbone

Typical blockers:

- `source containers incomplete`
- `hub container missing`
- `controller container missing`
- `roads below target`
- `economy backbone not stable`

## Development

Purpose:

- Build the first durable home-room core.

Entry:

- The room has cleared foundation readiness.
- In practice this usually starts at RCL3+, but higher-RCL rooms can also fall back here if core unlocks are not caught up.

Advance gate to `logistics`:

- Controller is at least `5`
- Stable economy requirements are met.
- In practice that means at least one laborer, at least one `upgrader` unless RCL8 upgrading is intentionally suppressed, enough `miner` creeps to satisfy `minersPerSource`, and enough `hauler` creeps to satisfy the minimum haul target.
- And one of these build conditions is true:
- `developmentComplete`
- Legacy tolerance: RCL3+, no construction backlog, extensions are complete, and towers are complete

What `developmentComplete` means:

- `foundationComplete`
- Extension target is met
- Tower target is met
- Storage target is met
- Baseline wall target is met
- Baseline rampart target is met

Primary steps:

1. Fill extension capacity for the current controller level.
2. Build the first tower baseline.
3. Place and finish storage as soon as the controller unlock allows it.
4. Build internal roads and the first defense shell.
5. Stabilize a normal miner-hauler-upgrader economy.

Spawn and workforce behavior:

- Normal core economy spawning is active.
- `repair` creeps are enabled from this phase onward.
- Worker demand scales with active construction sites.
- Upgrader work is reduced when the room has a large construction backlog.
- If storage exists and the room is intentionally banking energy, worker demand can drop to zero.

Construction scope from the roadmap:

- Foundation items carried forward
- `extensionStamps`
- `towerStamp`
- `storage`
- `internalRoads`
- `defense`
- `mineralAccessRoad`

What actually blocks advancement:

- RCL5
- Extensions
- Towers
- Storage
- Walls
- Ramparts
- Enough labor, miners, haulers, and an upgrader

Typical blockers:

- `waiting on RCL5`
- `extensions incomplete`
- `towers incomplete`
- `storage missing`
- `walls below target`
- `ramparts below target`
- `worker labor thin`
- `upgrader missing`
- `miners below target`
- `haulers below target`

## Logistics

Purpose:

- Replace pure container hauling with the first real link backbone.

Entry:

- Controller is at least `5`
- Development readiness gate passes

Advance gate to `specialization`:

- Controller is at least `6`
- `logisticsComplete` is true

What `logisticsComplete` means:

- `developmentComplete`
- Link target for the logistics plan is met

Current logistics link target:

- `1` controller link
- `1` source link
- No storage link yet

Primary steps:

1. Finish the RCL5 core if anything is still behind.
2. Place and build the first controller/source link backbone.
3. Shift the room toward stronger controller throughput and lower hauling pressure.

Spawn and workforce behavior:

- The standard development workforce remains active.
- No special bootstrap exceptions remain unless the room enters recovery.

Construction scope from the roadmap:

- Development scope carried forward
- `links`

What actually blocks advancement:

- RCL6
- Links for the logistics plan

Typical blockers:

- `waiting on RCL6`
- `link network incomplete`

## Specialization

Purpose:

- Turn the room into an advanced infrastructure hub.

Entry:

- Controller is at least `6`
- `logisticsComplete` is true

Advance gate to `fortification`:

- Controller is at least `7`
- `specializationComplete` is true

What `specializationComplete` means:

- `logisticsComplete`
- Terminal target is met
- Mineral container target is met
- Extractor target is met
- Lab target is met

Current specialization goals:

- `3` total links at RCL6: controller link, one source link, and one storage link
- `1` terminal
- `1` mineral container
- `1` extractor
- `3` labs

Primary steps:

1. Add a storage-adjacent logistics link.
2. Build the terminal.
3. Open mineral harvesting with container and extractor support.
4. Place the first lab cluster.

Spawn and workforce behavior:

- Standard economy roles stay active.
- `mineral_miner` spawning becomes possible only after the mineral program is truly unlocked, which also requires storage, extractor, mineral container access, enough stored energy, and no active hostiles.

Construction scope from the roadmap:

- Logistics scope carried forward
- `terminal`
- `mineralContainer`
- `extractor`
- `labs`
- `mineralAccessRoad`

What actually blocks advancement:

- RCL7
- Terminal
- Mineral container
- Extractor
- Labs

Typical blockers:

- `waiting on RCL7`
- `terminal missing`
- `mineral container missing`
- `extractor missing`
- `labs incomplete`

## Fortification

Purpose:

- Start the mature RCL7 room shape and late-game hardening layer.

Entry:

- Controller is at least `7`
- `specializationComplete` is true

Advance gate to `command`:

- Controller is at least `8`
- `fortificationComplete` is true

What `fortificationComplete` means today:

- `specializationComplete`
- Factory target is met

Important note:

- The fortification roadmap includes stronger late-room goals such as more labs, more links, and hardened infrastructure.
- The current advance gate is intentionally narrower than the full roadmap and only hard-requires the factory after specialization is done.

Current fortification goals in the roadmap:

- `4` total links at RCL7: controller link, two source links, and one storage link
- `6` labs
- `1` factory

Primary steps:

1. Catch up newly unlocked RCL7 core structures if needed.
2. Add the second source link.
3. Expand the lab cluster.
4. Place and complete the factory.
5. Continue hardening roads and defenses.

Spawn and workforce behavior:

- Same general workforce model as development and logistics.
- Mature rooms can still fall back to `development` immediately after an RCL unlock if extension or tower caps increased and are not yet built.

Construction scope from the roadmap:

- `factory`
- `terminal`
- `mineralContainer`
- `extractor`
- `labs`
- `mineralAccessRoad`
- `links`
- `storage`
- `anchorRoads`
- `backboneRoads`
- `extensionStamps`
- `towerStamp`
- `internalRoads`
- `defense`

What actually blocks advancement:

- RCL8
- Factory

Typical blockers:

- `waiting on RCL8`
- `factory missing`

## Command

Purpose:

- Finish the RCL8 room structure set.

Entry:

- Controller is at least `8`
- `fortificationComplete` is true

Completion state:

- There is no later phase after `command`.
- `commandComplete` means `fortificationComplete` is already true and the spawn, observer, power spawn, and nuker targets are all met.

Current command goals in the roadmap:

- Full spawn network for the room's RCL8 cap
- `1` observer
- `1` power spawn
- `1` nuker
- Continued factory, lab, storage, link, road, and defense support

Primary steps:

1. Catch up newly unlocked RCL8 core structures if needed.
2. Add the extra spawn(s).
3. Place observer, power spawn, and nuker.
4. Keep the mature room core coherent while late-ops runtime catches up.

Spawn and workforce behavior:

- Normal mature-room economy and repair behavior continues.
- Command completion is construction-only; some late-game runtime behavior is still intentionally conservative or incomplete compared with the full long-term roadmap.

Construction scope from the roadmap:

- `spawns`
- `observer`
- `powerSpawn`
- `nuker`
- `factory`
- `terminal`
- `mineralContainer`
- `extractor`
- `labs`
- `mineralAccessRoad`
- `links`
- `storage`
- `anchorRoads`
- `backboneRoads`
- `extensionStamps`
- `towerStamp`
- `internalRoads`
- `defense`

What actually marks the phase complete:

- Spawns
- Observer
- Power spawn
- Nuker

Typical blockers:

- `spawn network incomplete`
- `observer missing`
- `power spawn missing`
- `nuker missing`

## Practical Reading Tips

- If a room looks "stuck," check the current phase first, then the build-status counters, then the spawn queue.
- If an advanced room unexpectedly shows `development`, verify whether the latest RCL unlock increased extension or tower goals.
- If a room has the controller level for a later phase but is not advancing, check the exact completion flag for the current phase:
- `foundationComplete`
- `developmentComplete`
- `logisticsComplete`
- `specializationComplete`
- `fortificationComplete`
- `commandComplete`
- Use the room reporting output as the operator-facing explanation of what the phase resolver thinks is still missing.
