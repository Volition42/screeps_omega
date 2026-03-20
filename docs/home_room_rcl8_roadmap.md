# Home Room RCL8 Upgrade Roadmap

Single-room roadmap for `screeps_omega`, focused on driving one home room to a completed `RCL8` before remote mining, claiming, or empire expansion return to scope.

## Scope Lock

- Home room only.
- Controller upgrade throughput is the primary success metric.
- Remote rooms, remote defense, and empire expansion are deferred and should be removed from active code paths.
- CPU savings are a design requirement, not a cleanup item.

## Time Estimate On Shard3

Assumptions:

- Public server `shard3`
- Tick speed averages `2.5-3.0s`
- One home room only
- No remote mining
- No market acceleration
- Normal public-server pressure, not a perfect quiet shard
- Code continues to improve around controller throughput and CPU waste

Estimated time from placing the first spawn to a completed `RCL8`:

- Fast case: about `39 days, 8 hours, 0 minutes`
- Average case: about `46 days, 18 hours, 0 minutes`
- Slow case: about `57 days, 6 hours, 0 minutes`

Probability view:

- `25%` chance the room finishes by about `43 days`
- `50%` chance the room finishes between about `43-51 days`
- `25%` chance the room takes longer than about `51 days`

## Phase 0 - Remove Remote Scope

Status: [x] Completed

Purpose:

- Remove every active remote-room code path so the bot becomes a simpler, cheaper single-room controller-growth bot.

Completed baseline:

- Remote room configuration and remote spawn paths have been removed from active runtime code.
- Remote-room HUD panels, remote creep labels, and remote CPU sections have been removed.
- Remote role files and the remote manager have been removed from `dev/`.
- Defense is now home-room only.

Done when:

- No remote rooms are scanned, shown, spawned for, defended, or planned.
- The home room HUD only shows home-room data.
- CPU logs no longer include remote sections.

Expected CPU win:

- High. This should remove the largest non-home room tax from the current runtime.

## Phase 1 - Bootstrap Hardening For One Room

Status: [x] In progress

Purpose:

- Make early survival and phase progression reliable without remote help.

Work items:

- [ ] Keep `bootstrap_jr` limited to survival labor only
- [ ] Ensure `bootstrap` reliably transitions from `jrworker` to `worker`
- [ ] Verify source containers and road backbone are first build priority
- [ ] Validate phase fallbacks so dead economies drop correctly into recovery behavior
- [ ] Trim any remaining roles or logic that only existed to support remote expansion

Done when:

- A new room can progress from first spawn through `developing` without manual intervention.
- Construction required for the phase is always spawned for before optional work.

## Phase 2 - Developing And Stable Home Economy

Status: [x] In progress

Purpose:

- Finish the home-room economy backbone needed to support controller-first growth.

Completed baseline:

- Upgraders now self-supply from shared room energy buffers instead of standing on a dedicated controller container.
- Controller-container planning is no longer part of the active home-room roadmap.

Work items:

- [ ] Validate `developing` construction order for extensions, tower, storage, and core roads
- [ ] Simplify role counts for a single-room economy
- [ ] Prioritize shared logistics flow toward spawn fill, extension fill, tower safety, storage, and then upgrader support
- [ ] Reduce idle movement and target thrash in worker and hauler roles
- [ ] Rewrite directive reporting so it reads like analyst-facing room snapshots instead of executive narration
- [ ] Add clearer console-output separation after directive reports so the next log item is visually distinct
- [ ] Keep defense strictly home-room reactive

Done when:

- The room can hold `stable` without phase flapping.
- Home creeps are not pathing between invalid targets.
- Economy CPU stays predictable with no remote overhead.

## Phase 3 - RCL5 Link Backbone

Status: [ ] Not started

Purpose:

- Unlock the first real controller-throughput jump.

Work items:

- [ ] Validate controller link placement from the cached future plan
- [ ] Validate storage link placement from the storage hub plan
- [ ] Validate source link planning for the home room only
- [ ] Add minimal, CPU-cheap link transfer logic centered on feeding the controller path first
- [ ] Reduce manual hauling pressure once links come online

Done when:

- The controller path is link-fed.
- Haulers no longer waste large amounts of time on controller delivery runs.

## Phase 4 - RCL6 Throughput Layer

Status: [ ] Not started

Purpose:

- Add only the RCL6 structures that support a stronger, more stable home room while keeping controller progress first.

Work items:

- [ ] Finish terminal placement and build support, but keep market logic out of scope
- [ ] Finish extractor placement and build support, but keep mineral economics out of scope
- [ ] Finish first lab-cluster placement and build support, but keep reaction logic out of scope
- [ ] Improve upgrader supply flow so the controller remains the main energy sink after core refill needs are met
- [ ] Keep advanced placement cache-driven and low-frequency

Done when:

- All RCL6 construction is planned and can complete without changing the room’s single-room operating model.
- The room becomes materially better at feeding upgraders, not just richer in structure count.

## Phase 5 - RCL7 Efficiency Pass

Status: [ ] Not started

Purpose:

- Convert a complete midgame room into a controller-focused late-game room.

Work items:

- [ ] Validate all RCL7 structure counts and build order
- [ ] Rebalance haulers, workers, and upgraders for higher sustained controller feed
- [ ] Tighten repair logic so roads, containers, and key defenses stay healthy without bloating CPU
- [ ] Add CPU guardrails that shed optional work when bucket or average CPU drops
- [ ] Re-measure role CPU and room-manager CPU after each major change

Done when:

- The room holds RCL7 comfortably without recovery drift.
- Controller feed remains strong even during normal repair and refill cycles.

## Phase 6 - RCL8 Completion

Status: [ ] Not started

Purpose:

- Finish the room as a stable, completed RCL8 home before empire work returns.

Work items:

- [ ] Drive the controller to `RCL8`
- [ ] Saturate the controller-upgrade path as close as practical to the `15 energy/tick` cap
- [ ] Validate final required structure placement and completion
- [ ] Keep downgrade protection, storage reserve, and tower safety stable while upgrading
- [ ] Freeze or simplify any optional behavior that steals controller energy without a strong reason

Done when:

- The room reaches `RCL8`
- The full home-room construction roadmap is complete
- The codebase is still single-room and CPU-stable

## Deferred Until After RCL8

- Remote mining
- Remote reservation
- Remote defense
- Second-home claiming
- Empire manager
- Market trading
- Lab reactions
- Power processing
- Factory, observer, and nuker automation

## Developer Operating Notes

- Prefer deleting remote logic over feature-flagging it if the code path is clearly out of scope.
- Keep per-tick home-room scans shared through room state and cache.
- Do not add broad all-creep or all-structure scans to the HUD or planner.
- Every phase should end with a CPU re-measure and a “what can be simplified again” pass.
- If a feature does not improve controller throughput, economy stability, or required construction completion, it should probably wait until after `RCL8`.
