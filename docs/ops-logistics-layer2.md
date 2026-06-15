# Layer 2 Ops Logistics Operator Guide

## Purpose

Layer 2 gives operators a manual, request-backed way to move resources between storage and terminal without introducing autonomous market automation. Ops owns logistics requests, market commands use ops logistics for prep/staging, and haulers execute ops logistics before legacy market staging and normal hauling.

Market buy and sell actions remain manual console commands. Terminal hygiene is request-driven and hauler-executed.

## Command List

Ops logistics and terminal hygiene:

- `ops.help()`
- `ops.move(resource, amount, roomName, from, to)`
- `ops.requests()`
- `ops.requests(roomName)`
- `ops.requests("all"|"history")`
- `ops.requests(roomName, "all"|"history")`
- `ops.cancel(requestId)`
- `ops.balanceTerminal(roomName)`
- `ops.balanceTerminals()`
- `ops.terminalStatus()`
- `ops.terminalStatus(roomName)`
- `ops.clearTerminal(roomName, resource, amount)`
- `ops.clearTerminal(roomName)`
- `ops.fillTerminal(roomName, resource, amount)`

Market prep and manual market commands:

- `market.help()`
- `market.stock()`
- `market.stock(roomName)`
- `market.needs()`
- `market.surplus()`
- `market.stage(resource, amount, roomName)`
- `market.unstage(resource, amount, roomName)`
- `market.requests()`
- `market.requests(roomName)`
- `market.requests("all"|"history")`
- `market.requests(roomName, "all"|"history")`
- `market.cancel(requestId)`
- `market.send(resource, amount, fromRoom, toRoom)`
- `market.buyOptions()`
- `market.buyOptions(resource)`
- `market.sellOptions()`
- `market.sellOptions(resource)`
- `market.buy(resource, amount, roomName)`
- `market.sell(resource, amount, roomName)`
- `market.planBuys()`
- `market.planSells()`

## Safe Live Workflow

1. Inspect the room before issuing logistics commands.
2. Create one request at a time for high-value resources.
3. Watch `ops.requests()` until the request is done or blocked.
4. Use `ops.requests("all")` when you need canceled, done, or expired history.
5. Cancel stale or incorrect requests with `ops.cancel(requestId)`.

Default request views show active work only. Canceled and done requests are intentionally hidden unless `all` or `history` is requested.

## Terminal Hygiene Workflow

Check terminal status:

```js
ops.terminalStatus()
ops.terminalStatus("W42N9")
```

Clear a clogged terminal:

```js
ops.clearTerminal("W42N9")
ops.clearTerminal("W42N9", "H", 50000)
```

Fill terminal energy:

```js
ops.fillTerminal("W42N9", "energy", 10000)
```

Inspect requests:

```js
ops.requests()
ops.requests("all")
```

`ops.clearTerminal(roomName)` creates cleanup requests for terminal resources that should move back to storage. `ops.fillTerminal(roomName, resource, amount)` creates a storage-to-terminal request for staging or energy support.

## Market Prep Workflow

Use market reports first:

```js
market.stock()
market.needs()
market.surplus()
market.sellOptions("H")
```

Stage resources only when terminal capacity and energy look healthy:

```js
market.stage("H", 50000, "W42N9")
market.requests("W42N9")
```

Manual market sell:

```js
market.sellOptions("H")
market.sell("H", 1000, "W42N9")
```

`market.sell()` may sell less than requested if the selected order has less available amount, terminal energy is limiting, or the terminal cannot execute the full requested amount safely. The report shows requested amount, executed amount, and the limiting reason.

## Intentionally Not Automated

Layer 2 does not provide:

- autonomous buying
- autonomous selling
- autonomous `terminal.send` balancing
- cross-room terminal arbitrage
- order manipulation bots
- recurring market execution

## Troubleshooting Examples

- Request missing from default view: run `ops.requests("all")` or `market.requests("all")` and check for `done`, `canceled`, or `expired`.
- Request blocked: inspect the source and target. A storage-to-terminal request can block if storage is empty or terminal capacity is full.
- Terminal clogged: run `ops.terminalStatus(roomName)`, then `ops.clearTerminal(roomName)` or a resource-specific clear request.
- Market sell did less than requested: check the sell report for `limited by order amount`, terminal energy, cooldown, or `maxNow`.
- Duplicate request skipped: an open request already moves the same resource in the same direction for that room. Use `ops.requests(roomName)` before creating another.
