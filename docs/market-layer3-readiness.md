# Market Layer 3 Intelligence Reports

Layer 3 starts with operator decision support only. These commands analyze terminal readiness, sell opportunities, and conservative next steps while preserving the Layer 2 rule that all logistics and market execution remain explicit operator actions.

## Layer 3.0 Readiness

```js
market.readiness()
market.readiness("W42N9")
market.readiness("H")
```

Readiness reports show owned terminal status, terminal energy, free capacity, sellable resources, blockers, and suggested manual commands such as `ops.clearTerminal("W42N9")`, `ops.fillTerminal("W42N9", "energy", 10000)`, or `market.sellOptions("H")`.

Statuses are conservative: `READY`, `LOW_ENERGY`, `CONGESTED`, `FULL`, `NO_TERMINAL`, and `NO_STORAGE`.

## Layer 3.1 Opportunities

```js
market.opportunities()
market.opportunities("H")
```

Opportunity reports compare terminal resource availability with market buy orders. They show readiness, available amount, estimated `maxNow`, order price, effective price after estimated terminal energy cost, terminal energy, and blocker reasons.

The empire-wide report is bounded by default to avoid console spam.

## Layer 3.2 Recommendations

```js
market.recommendations()
```

Recommendations combine readiness, terminal hygiene, active request awareness, and ready sell opportunities. Output is command-first and conservative, for example:

```js
ops.clearTerminal("W41N7")
ops.fillTerminal("W41N8", "energy", 10000)
market.sellOptions("H")
ops.requests()
```

## Layer 3.3 Dry-Run Planning

```js
market.planSell("H", 10000, "W42N9")
market.planBuy("energy", 5000, "W41N8")
market.plans()
market.plan("ms_223455_H_W42N9")
market.planSummary()
market.planReview("ms_223455_H_W42N9")
market.planAudit()
market.clearPlan("ms_223455_H_W42N9")
market.clearPlan("all")
```

Dry-run plans convert current market opportunities into saved operator review objects under `Memory.consoleTools.market.plans`. A plan records the selected order, executable amount, effective price, estimated credits, estimated terminal energy cost, terminal state, blockers, timestamps, and a short console-friendly id.

Plans may be `ready`, `blocked`, `stale`, or `deleted`. `market.plan(id)` re-checks the selected order and terminal state and reports stale plans when the order disappeared, changed materially, or the terminal can no longer support the planned amount. `market.plans()` shows active non-deleted, non-expired plans; `market.plans("all")` includes history.

Planning is not execution. A ready report prints the manual next command, such as:

```js
market.sell("H", 2580, "W42N9")
market.buy("energy", 5000, "W41N8")
```

The operator must still run `market.buy` or `market.sell` manually after reviewing the plan.

## Layer 3.4 Plan Review

```js
market.planSummary()
market.planReview("ms_223455_H_W42N9")
market.planAudit()
market.clearPlan("ms_223455_H_W42N9")
market.clearPlan("all")
```

Plan review turns saved dry-run plans into an operator workflow before any execution command exists. `market.planReview(id)` re-checks the selected order, order amount, room terminal, terminal energy, sell resources, buy capacity, buy credits, and cooldown. It returns a concise `READY`, `BLOCKED`, or `STALE` report and may update only the saved plan status.

`market.planSummary()` shows aggregate counts for ready, blocked, stale, deleted, buy, and sell plans. `market.planAudit()` reviews active plans and lists stale, blocked, duplicate, missing-order, unaffordable buy, insufficient-resource sell, and cooldown-blocked plans, bounded for console use.

Use `market.clearPlan(id)` to soft-delete one plan and `market.clearPlan("all")` to soft-delete active plans while preserving audit history. The older `market.deletePlan(id)`, `market.removePlan(id)`, and `market.clearPlans()` commands remain as deprecated aliases that route to `market.clearPlan`.

## Layer 3.5 Execution Design & Safety Framework

```js
market.executionStatus()
market.executionLimits()
market.setExecutionLimit("maxSellAmount", 5000)
market.executionDryRun("ms_223455_H_W42N9")
market.clearExecutionLimit("maxSellAmount")
```

Layer 3.5 prepares the execution preflight model without exposing an execution command. `market.executionStatus()` reports that the execution engine is disabled, actual deal execution is unavailable, dry-run preflight is available, limits are available, and history schema metadata is prepared for a later phase.

`market.executionDryRun(planId)` reloads a saved plan from `Memory.consoleTools.market.plans`, re-checks the selected order and current room terminal state, applies configured execution limits, calculates the final executable amount, estimates credits and terminal transaction energy, and returns `READY`, `BLOCKED`, `STALE`, or `LIMIT_BLOCKED`. The report includes plan id, type, resource, room, requested amount, planned and final executable amounts, selected order, price, effective price when available, estimated credits, estimated transaction energy, blockers, limit blockers, and `No execution performed.`

Execution limits live under `Memory.consoleTools.market.executionLimits` and default to:

```js
{
  maxSellAmount: 10000,
  maxBuyAmount: 10000,
  maxCreditsPerBuy: 1000000,
  minSellEffectivePrice: 0,
  maxBuyEffectivePrice: null,
  minTerminalEnergyReserve: 0
}
```

Use `market.executionLimits()` to print current limits and defaults, `market.setExecutionLimit(name, value)` to set a numeric limit, and `market.clearExecutionLimit(name)` to reset one limit to its default. `maxBuyEffectivePrice` may be set to `null` or `"null"` to keep it unlimited. Short aliases are available as `market.limits()`, `market.setLimit(name, value)`, and `market.clearLimit(name)`.

Actual execution remains intentionally unavailable until a later phase. Layer 3.5 does not add `market.executePlan`, does not call `Game.market.deal`, does not create market orders, does not create ops logistics requests, and does not call `terminal.send`.

## No-Execution Boundary

Market intelligence commands do not:

- execute `Game.market.deal`
- create market orders
- change market order prices
- create ops logistics requests
- send terminal resources
- schedule recurring jobs
- perform autonomous buying, selling, balancing, or arbitrage

Dry-run planning and plan review commands follow the same safety boundary. They may read market orders, credits, and terminal state, and they may write plan objects to `Memory.consoleTools.market.plans` by saving, reviewing, updating status, or soft-deleting plans. They do not move resources, create ops logistics requests, send terminal resources, create orders, or execute deals.

Use existing manual commands when you choose to act on a report: `ops.clearTerminal`, `ops.fillTerminal`, `market.sellOptions`, `market.buyOptions`, `market.planSell`, `market.planBuy`, `market.sell`, and `market.buy`.
