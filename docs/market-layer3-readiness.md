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

## No-Execution Boundary

Market intelligence commands do not:

- execute `Game.market.deal`
- create market orders
- change market order prices
- create ops logistics requests
- send terminal resources
- schedule recurring jobs
- perform autonomous buying, selling, balancing, or arbitrage

Use existing manual commands when you choose to act on a report: `ops.clearTerminal`, `ops.fillTerminal`, `market.sellOptions`, `market.buyOptions`, `market.sell`, and `market.buy`.
