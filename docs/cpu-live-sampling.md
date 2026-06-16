# Live CPU Sampling Operator Guide

## Purpose

Use this workflow after an `ops.cpu(roomName)` reporting fix is deployed to collect repeatable live CPU snapshots from mature rooms. The goal is observation only: capture enough room-level and section-level CPU data to choose the next optimization target without changing gameplay settings during the sample window.

## Command

Run one report per mature owned room:

```js
ops.cpu("W42N9")
```

If an operator room is already selected, the room name may be omitted:

```js
ops.cpu()
```

For multi-room comparisons, run the command separately for each mature room and keep the outputs grouped by room and tick.

## Recommended Cadence

Collect the same room set at these points:

- Immediate after deploy: confirms the command works and captures the cold-start shape.
- After 100 ticks: catches early rolling-average movement and obvious pressure.
- After 500 ticks: gives the rolling window time to settle around normal room behavior.
- After 1000+ ticks: provides the best baseline for mature-room follow-up work.

Avoid changing spawn settings, construction settings, remote plans, market staging, or defense settings between samples unless the change itself is the thing being measured.

## Values To Watch

Record these values from each report:

- Room current CPU: the latest measured room cost for the sampled tick.
- Rolling average CPU: the stable cost to compare across rooms and sample windows.
- Rolling peak and min: the operating range and whether spikes are isolated or recurring.
- Top hotspot sections: the highest average section costs.
- Pressure mode: normal, tight, or critical pressure observed by the room.
- Scheduler skips: work skipped this tick or recently skipped because pressure was high.
- CPU per creep, source, and remote: rough scale-normalized cost for comparing mature rooms.

## Sample Notes Template

```text
Room:
Tick:
Cadence point: immediate | 100 ticks | 500 ticks | 1000+ ticks
Room current CPU:
Rolling average CPU:
Peak / min:
Pressure:
Scheduler skips:
Efficiency creep / source / remote:
Top hotspots:
1.
2.
3.
Operator notes:
```

## Interpretation Guide

Use the highest repeated hotspot, not a single noisy tick, to pick the next phase:

- `room_state` high means room scans and caching are the next likely target.
- `creep_manager` high means role execution or pathing is the next likely target.
- `construction_manager` high means planning or path generation is the next likely target.
- `advancedOps` high means labs, factory, power, or nuker staging is the next likely target.
- Reservation or remote sections high means remote scaling is the next likely target.
- `hud` high means HUD throttling or caching is the next likely target.

Pressure and scheduler skips should be read together. A room with acceptable average CPU but frequent tight or critical pressure may need spike reduction before average reduction. A room with repeated scheduler skips needs the skipped task names captured before deciding whether to cache, throttle, or simplify that work.

## Comparison Guidance

When comparing rooms, prefer rooms with similar maturity and remote footprint. A command-room with labs, factory, power, nuker planning, and several remotes should not be compared directly against a quiet single-room economy unless the per-creep, per-source, and per-remote values are also included.

Keep the raw `ops.cpu(roomName)` output with the notes. The exact printed section names are useful when turning the sampling results into a targeted optimization phase.
