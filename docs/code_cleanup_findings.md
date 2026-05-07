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
