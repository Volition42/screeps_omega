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

## Active Remaining Work

## 1. Live Validate Late-Game Construction Fit

Status: [ ] Pending live-room validation

Purpose:

- Prove that the current RCL7/RCL8 construction planner fits real rooms cleanly instead of only passing static code review.

Work items:

- [ ] Validate `specialization` lab placement in a real RCL6 room.
- [ ] Validate `fortification` factory placement in a real RCL7 room.
- [ ] Validate `command` observer, power spawn, and nuker placement in a real RCL8 room.
- [ ] Check that connector roads do not starve important structure sites under the global site cap.
- [ ] Record any terrain shapes that force poor fallback placement and tune the planner if needed.

Done when:

- At least one live room has successfully planned and built through `command` without manual structure relocation.

## 2. Add Lab And Factory Operations

Status: [ ] Not started

Purpose:

- Turn placed late-game structures into actual production infrastructure.

Work items:

- [ ] Add lab operating state for reaction selection and reagent routing.
- [ ] Define a simple factory production policy for home-room use.
- [ ] Extend hauler logistics so labs, terminal, factory, and power spawn can be supplied without breaking core energy flow.
- [ ] Add status or HUD visibility for active lab/factory work once that logic exists.

Done when:

- Labs can run a chosen reaction cycle and the factory can produce from a defined policy without manual babysitting.

## 3. Add Observer, Power Processing, And Nuker Operations

Status: [ ] Not started

Purpose:

- Finish the RCL8 operating layer after construction placement is complete.

Work items:

- [ ] Add observer scan scheduling and a clear use for the vision it produces.
- [ ] Add power spawn processing logic with safe resource gating.
- [ ] Add nuker policy and operator controls so the structure is not just decorative.
- [ ] Decide whether any of these systems need HUD or directive visibility.

Done when:

- Observer, power spawn, and nuker all have real runtime behavior beyond construction and build-status tracking.

## 4. Re-Measure CPU And Simplify Again

Status: [ ] Pending after live validation

Purpose:

- Keep CPU reduction as a standing engineering constraint while the RCL8 path hardens.

Work items:

- [ ] Measure construction, HUD, directives, and defense planning after late-game validation.
- [ ] Remove or cache any room scans that are no longer justified.
- [ ] Re-check runtime throttling behavior under normal, tight, and critical CPU modes.
- [ ] Keep memory-heavy caches if they reduce repeated CPU work safely.

Done when:

- The home-room RCL8 path is stable without pushing average CPU back into the earlier regression range.

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
