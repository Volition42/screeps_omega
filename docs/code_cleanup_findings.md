# Code Cleanup Findings

## Scheduled Memory Review

- Added a long-interval room memory review so stale room memory cleanup is centralized instead of scattered through normal report and plan-read paths.
- The review owns legacy room focus cleanup for `Memory.rooms`, expansion plans, and reservation plans.
- Runtime managers still keep active compatibility for physically nonstandard rooms; layout tolerance and migrated-room advancement behavior were intentionally retained.

## Removed Or Moved

- Removed opportunistic legacy focus cleanup from empire expansion default reads and empire recording.
- Removed opportunistic legacy focus cleanup from reservation default reads.
- Kept create/update paths from writing new focus fields.

## Retained

- Construction and room-state compatibility for migrated rooms remains active because live rooms may have valid physical layouts that do not perfectly match current stamps.
- Reservation operation default backfill remains active because current request/reporting logic expects `operation: "reservation"`.

## Role Planning Review - Operator Control and Economy Planning Consolidation

- `role_worker`, `role_repair`, `role_upgrader`, and `role_hauler` still directly self-select some local work targets and cache target ids in creep memory.
- Worker and repair construction/maintenance selection should keep moving toward request-aware inputs, but the current safe boundary is target sorting and cache invalidation, not a new planner.
- Risky cached patterns remain around `workTargetId`, `withdrawTargetId`, `pickupTargetId`, `deliveryTargetId`, and hauler task ids when live pressure or endpoint state changes between think intervals.
- Next improvements should bridge existing room/request state into role target selection, add stale-cache assertions around each cached id family, and keep ops logistics requests as the execution-owned queue.
- A centralized task/request bridge is warranted later only as an adapter over existing request managers and role helpers; a replacement queue or broad role rewrite is not warranted in this phase.
