# Home Room RCL8 Upgrade Roadmap

Reality-based roadmap for the current `dev/` build.

The home-room construction path now reaches `command` / `RCL8` on paper and in code. This file tracks what is still missing before the single-room RCL8 path should be considered stable, validated, and feature-complete in live play.

## Already Completed In Dev

These items are no longer active roadmap work:

- Named room phases are in place: `bootstrap -> foundation -> development -> logistics -> specialization -> fortification -> command`.
- Construction roadmap, status, and placement now cover links, terminal, extractor, labs, factory, observer, power spawn, and nuker.
- Advanced structure placement is planned from a cached future-plan instead of being recomputed every tick.
- Home-room defense construction now uses terrain-based exit choke planning with two-tile rampart gates.
- HUD and directives read the shared construction status and future-plan state.
- Late structure runtime now includes lab reaction selection, a conservative factory policy, and advanced haul tasks for labs, factory, power spawn, and nuker staging.
- A deterministic solo-room harness now validates named phases from `bootstrap` through `command`, plus late factory battery task selection.
- Bootstrap solo-room logic now spreads harvesters across real source-adjacent tiles, caps the emergency RCL1 jrworker count at `2`, and uses the engine `moveTo` path before falling back to direct `PathFinder` stepping.

## Active Remaining Work

## 1. Finish Live Solo-Room Validation

Status: [~] Bootstrap and forced-stage PTR validation are now passing, full organic RCL8 climb is still pending

Purpose:

- Prove that the current home-room path can really run solo from the first placed spawn through mature room operation under the live `20` CPU cap.

Work items:

- [x] Validate first-spawn `bootstrap -> foundation` progress on the PTR private server at the real `20` CPU cap.
- [x] Confirm RCL1 no longer burns all harvested energy into extra jrworkers before the first controller upgrade.
- [x] Confirm the shared movement helper and source-harvest slot assignment no longer collapse multiple bootstrap creeps onto one tile.
- [ ] Continue live-validating the natural `development -> logistics -> specialization` climb without manual structure completion.
- [ ] Validate `specialization` lab placement in a real RCL6 room.
- [ ] Validate `fortification` factory placement in a real RCL7 room.
- [ ] Validate `command` observer, power spawn, and nuker placement in a real RCL8 room.
- [ ] Check that connector roads do not starve important structure sites under the global site cap.
- [ ] Record any terrain shapes that force poor fallback placement and tune the planner if needed.

Done when:

- At least one live room has successfully climbed from first spawn through `command` without manual structure relocation or manual workforce correction.

## 2. Harden Late-Structure Operations

Status: [~] Partially implemented in `dev/`

Purpose:

- Turn placed late-game structures into stable production and supply infrastructure.

Completed in code:

- [x] Lab operating state chooses a reaction and routes reagents to a valid lab cluster.
- [x] Factory runtime supports a conservative home-room product policy.
- [x] The deterministic harness validates the current factory battery policy and advanced task selection.
- [x] Advanced haulers can now service labs, factory, power spawn, and nuker staging.
- [x] The active advanced haul task is chosen from a config priority list instead of hardcoded manager order.
- [x] HUD now shows lab/factory state plus the chosen advanced haul task label.

Remaining work:

- [ ] Live-validate the haul priority order so advanced tasks do not interfere with core energy flow in awkward rooms.
- [ ] Decide whether terminal balancing needs its own explicit late-ops task layer or should remain an implicit hub only.
- [ ] Expand factory policy beyond the current conservative home-room baseline if more products become necessary.

Done when:

- Labs and the factory can run unattended in live rooms without destabilizing hauling or requiring repeated manual tuning.

## 3. Add Observer, Power Processing, And Nuker Operations

Status: [~] Supply staging exists, runtime use still missing

Purpose:

- Finish the RCL8 operating layer after construction placement is complete.

Work items:

- [ ] Add observer scan scheduling and a clear use for the vision it produces.
- [ ] Add power spawn processing logic with safe resource gating.
- [ ] Add nuker policy and operator controls so the structure is not just decorative.
- [ ] Decide whether observer, power processing, or nuker actions need HUD or directive visibility.

Done when:

- Observer, power spawn, and nuker all have real runtime behavior beyond construction, build-status tracking, and supply staging.

## 4. Re-Measure CPU And Simplify Again

Status: [~] Bootstrap and staged PTR checks are healthy, mature-room measurement still pending

Purpose:

- Keep CPU reduction as a standing engineering constraint while the RCL8 path hardens.

Work items:

- [x] Re-check bootstrap / foundation CPU under the real `20` account cap on PTR.
- [x] Re-check staged high-RCL planning CPU on PTR after the solo-room fixes.
- [ ] Measure construction, HUD, directives, defense planning, and advanced ops during an organic mature-room climb.
- [ ] Remove or cache any room scans that are no longer justified.
- [ ] Re-check runtime throttling behavior under normal, tight, and critical CPU modes.
- [ ] Keep memory-heavy caches if they reduce repeated CPU work safely.

Done when:

- The home-room RCL8 path is stable without pushing average CPU back toward the old regression range and without depending on heavy emergency throttling.

## Deferred Until After Home-Room RCL8 Is Stable

- Remote mining
- Remote reservation
- Remote defense
- Second-home claiming
- Empire manager
- Market automation
- Broader boost or war-room systems

## Developer Operating Notes

- Do not mark a phase "done" just because placement exists. Construction and operating logic are separate milestones.
- Prefer shared room-state scans and cached planner output over fresh manager-local scans.
- Keep the home-room path readable. If a late-game feature needs too much scaffolding, add the minimum working slice first.
- Every major late-game addition should end with a CPU re-measure and a "what can be simplified again" pass.
