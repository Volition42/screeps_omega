# Market Layer 3 Readiness Plan

Layer 3 should not start until terminals are healthy enough for reliable manual operations. Layer 2 must remain the live baseline: ops owns logistics requests, market uses ops for prep/staging, and every buy or sell deal is explicitly operator-driven.

This document is planning only. It does not authorize or imply Layer 3 runtime automation.

## Candidate Layer 3 Work

- refine `market.planSells()` into clearer readiness and priority reporting
- refine `market.planBuys()` into clearer shortage and affordability reporting
- add `market.prepareSell(resource, amount, roomName)` to create request-backed prep only
- add `market.prepareBuy(resource, amount, roomName)` to create request-backed prep only
- optionally add semi-automatic order selection recommendations

## Explicitly Prohibited For Now

- autonomous buying
- autonomous selling
- autonomous `terminal.send` balancing
- cross-room terminal arbitrage
- order manipulation bots

## Safety Gates

Layer 3 proposals must include:

- dry-run first
- request-backed prep only
- explicit operator confirmation for any deal
- hard limits for credits, amount, and terminal energy
- clear requested vs executed reporting

Any command that can execute a market deal must be manual, visible, and bounded.

## Proposed Layer 3 Phases

- Layer 3.0 market readiness reports
- Layer 3.1 `prepareSell`/`prepareBuy` request generation
- Layer 3.2 dry-run deal planner
- Layer 3.3 manual execute from plan id
- Layer 3.4 optional recurring advisory reports

## Readiness Checklist

Before Layer 3 implementation starts:

- `ops.terminalStatus()` reports mostly healthy terminals.
- Stale active logistics requests are cleared or understood.
- Terminal hygiene commands have been used live enough to trust request throughput.
- Market sell and buy reports clearly show requested amount, executed amount, and limiting reason.
- Operators agree on maximum deal size, credit spend, and terminal energy thresholds.
