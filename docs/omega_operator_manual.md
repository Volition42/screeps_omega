# Omega Operator Command Manual

Repository: `screeps_omega`

Repository version used: `0cc71c9e0f81bc94e02c8b06509e8d680bc13648`

Generation date: `2026-06-18 00:18:00 PDT`

Source authority: `src/main.js`, `src/kernel_loop.js`, `src/ops.js`, `src/transfer_manager.js`, `src/market_console.js`, `src/room_reporting.js`, `src/pcl_manager.js`, `src/power_manager.js`, `src/empire_manager.js`, `src/reservation_manager.js`, `src/attack_manager.js`, `src/ops_logistics_manager.js`, `src/terminal_balance_manager.js`, and `src/config.js`.

This manual documents commands discovered from the source tree. Existing documentation was not used as command authority.

## 1. Getting Started

Omega exposes its operator surface through runtime globals registered every tick by `src/main.js`: `ops` and `market`. `src/ops.js` also registers global `view(mode)` plus convenience constants `on` and `off`. `src/market_console.js` registers `market`.

Command philosophy:

- Use `ops` for empire, room, logistics, reservation, attack, power, Power Creep, observer, CPU, and reporting workflows.
- Use `market` for market visibility, terminal staging, dry-run planning, market execution preflight, explicit market execution, and history.
- Most commands print operator-readable console output and return either that printed string, a lines array, or a structured result object.
- Commands that mutate memory are still operator commands: they create plans, set policies, stage logistics requests, cancel requests, or update console workflow memory.

Approval-gated workflow:

- Power Creep actions use a `check` versus `confirm` pattern. `check` reports readiness and does not call the Screeps API action. `confirm` is required before commands call `powerCreep.usePower(...)` or `powerCreep.enableRoom(...)`.
- Market plan execution is a two-step workflow: create or inspect a saved plan, run `market.executionDryRun(planId)`, then intentionally run `market.executePlan(planId)`.
- Staged room-to-room transfers use `ops.transfer(..., "check")` versus `ops.transfer(..., "confirm")`. `check` reports readiness only. `confirm` creates a bounded transfer plan in `Memory.ops.transfers`; Omega advances approved plans each tick through room-local logistics requests and terminal sends.
- Direct manual market commands `market.buy(...)`, `market.sell(...)`, and `market.send(...)` execute immediately after local validation. They are not dry-run commands.

Execution levels used in this manual:

- Read Only: reads runtime or Memory state and prints a report.
- Planning: writes Memory, creates a plan, creates a logistics request, changes policy, or clears stored workflow/log history without directly calling market deal, terminal send, or Power Creep APIs.
- Approval Required: requires an explicit `confirm` or saved-plan execution command before calling an executing Screeps API.
- Executes Immediately: directly calls an execution API such as `Game.market.deal`, `terminal.send`, `powerCreep.usePower`, or `powerCreep.enableRoom`.

## 2. Global Command Index

### Global aliases and constants

- `view(on|off)`
- `on`
- `off`

### Ops commands

- `ops.attack(targetRoom, [postAction], [parentRoom], [allies])`
- `ops.attacks()`
- `ops.balanceTerminal(roomName)`
- `ops.balanceTerminals()`
- `ops.cancel(requestId)`
- `ops.cancelAttack(targetRoom)`
- `ops.cancelExpansion(targetRoom)`
- `ops.cancelRequests(roomName, "blocked", [filters])`
- `ops.cancelReserve(targetRoom)`
- `ops.clearTerminal(roomName, [resource], [amount])`
- `ops.cpu([roomName])`
- `ops.cpuStatus(roomName)`
- `ops.empire(["logistics"])`
- `ops.expand(targetRoom, [parentRoom])`
- `ops.expansions()`
- `ops.fillTerminal(roomName, resource, amount)`
- `ops.help()`
- `ops.hud(on|off)`
- `ops.log([roomName], [limit])`
- `ops.logClear([roomName])`
- `ops.move(resource, amount, roomName, from, to)`
- `ops.operator(name, [roomName], ["powers"])`
- `ops.operator(name, roomName, "operateExtension", mode)`
- `ops.operator(name, roomName, "operateSpawn", [spawnNameOrId], mode)`
- `ops.ops([roomName], ["stage", from, to, amount])`
- `ops.pcl([roomName])`
- `ops.phase(roomName)`
- `ops.power([roomName], [mode], [on|off])`
- `ops.powerCreep(name, "assign", room)`
- `ops.powerCreep(name, "generateOps", mode)`
- `ops.powerCreep(name, "renewAssist", on|off)`
- `ops.powerCreep(name, "renewStatus")`
- `ops.powerCreep(name, action, room, [target], [mode])`
- `ops.powerCreeps()`
- `ops.powerEnable(roomName, mode, [name])`
- `ops.reports(on|off)`
- `ops.reserve(targetRoom, [parentRoom])`
- `ops.reserved([parentRoom])`
- `ops.room([roomName], [section])`
- `ops.rooms()`
- `ops.scan(roomName, [section], [role])`
- `ops.spawn(roomName, role, [size|options])`
- `ops.spawn("power", name, [room|options])`
- `ops.requests([roomName], ["blocked"|"all"|"history"])`
- `ops.terminalStatus([roomName])`
- `ops.tickRate([sampleTicks|status|cancel])`
- `ops.tickSpeed([sampleTicks|status|cancel])`
- `ops.transfer(resource, amount, fromRoom, fromLocation, toRoom, toLocation, mode)`
- `ops.transfers()`
- `ops.transferStatus(id)`
- `ops.cancelTransfer(id)`

### Market commands

- `market.buy(resource, amount, roomName)`
- `market.buyOptions([resource])`
- `market.cancel(requestId)`
- `market.clearExecutionLimit(name)`
- `market.clearHistory(mode)`
- `market.clearLimit(name)`
- `market.clearPlan(planId)`
- `market.clearPlan("all")`
- `market.clearPlans()`
- `market.deletePlan(planId)`
- `market.execute(planId)`
- `market.executePlan(planId)`
- `market.executionDryRun(planId)`
- `market.executionLimits()`
- `market.executionStatus()`
- `market.help()`
- `market.history([resource|roomName|"all"])`
- `market.historyAudit()`
- `market.historyLimit()`
- `market.historySummary()`
- `market.info()`
- `market.install()`
- `market.limits()`
- `market.needs()`
- `market.opportunities([resource])`
- `market.ping()`
- `market.plan(planId)`
- `market.planAudit()`
- `market.planBuy(resource, amount, roomName)`
- `market.planBuys()`
- `market.planReview(planId)`
- `market.planSell(resource, amount, roomName)`
- `market.planSells()`
- `market.planSummary()`
- `market.plans(["all"|"history"])`
- `market.readiness([roomName|resource])`
- `market.recommendations()`
- `market.removePlan(planId)`
- `market.requests([roomName], ["all"|"history"])`
- `market.restore()`
- `market.rooms()`
- `market.sell(resource, amount, roomName)`
- `market.sellOptions([resource])`
- `market.send(resource, amount, fromRoom, toRoom)`
- `market.setExecutionLimit(name, value)`
- `market.setHistoryLimit(limit)`
- `market.setLimit(name, value)`
- `market.stage(resource, amount, roomName)`
- `market.stock([roomName])`
- `market.surplus()`
- `market.uninstall()`
- `market.unstage(resource, amount, roomName)`

## 3. Command Reference

### Global

| Command | Description | Parameters | Example | Returns | Side Effects | Execution Level | Source |
|---|---|---|---|---|---|---|---|
| `view(mode)` | Toggle HUD and critical reports together and optionally print the current room report when enabling. | `mode`: boolean, number, or string toggle. | `view(on)` | Object with enabled, HUD, and report state. | Updates ops view, HUD, and report flags. | Planning | `src/ops.js:1122`, `src/ops.js:2124` |
| `on` | Convenience global value for `true`. | None. | `ops.hud(on)` | Boolean constant. | None. | Read Only | `src/ops.js:990` |
| `off` | Convenience global value for `false`. | None. | `ops.reports(off)` | Boolean constant. | None. | Read Only | `src/ops.js:991` |

### Ops

| Command | Description | Parameters | Example | Returns | Side Effects | Execution Level | Source |
|---|---|---|---|---|---|---|---|
| `ops.help()` | Print the ops help surface. | None. | `ops.help()` | Help row array. | Prints help. | Read Only | `src/ops.js:1000`, `src/ops.js:1127` |
| `ops.hud(mode)` | Toggle the room HUD overlay. | `mode`: `on`, `off`, boolean, or equivalent. | `ops.hud(on)` | Toggle result object. | Updates HUD flag in ops state. | Planning | `src/ops.js:994`, `src/ops.js:1135` |
| `ops.reports(mode)` | Toggle critical room reports. | `mode`: `on`, `off`, boolean, or equivalent. | `ops.reports(off)` | Toggle result object. | Updates reports flag in ops state. | Planning | `src/ops.js:997`, `src/ops.js:1149` |
| `ops.room(arg1, arg2)` | Show one room report. If one argument is a section, uses the current/default room. | `arg1`: room name or section. `arg2`: section. Sections: `overview`, `economy`, `build`, `defense`, `creeps`, `sources`, `resources`, `factory`, `labs`, `labor`, `logistics`, `advanced`, `power`, `observer`, `cpu`, `all`. | `ops.room("W5N5", "labor")` | Report object, except CPU, factory, labs, labor, and logistics sections return printable status strings. | Sets current room and may update room progress/logistics history. Does not create logistics requests or execute hauler, market, terminal, spawn, factory, lab, or boost actions. | Read Only | `src/ops.js`, `src/room_reporting.js` |
| `ops.cpu(roomName)` | Show measured room CPU, top section costs, pressure, and scheduler skips. | `roomName`: optional owned room. | `ops.cpu("W5N5")` | Printable CPU report status string. | Sets current room through `ops.room`. | Read Only | `src/ops.js:1006`, `src/ops.js:2116` |
| `ops.cpuStatus(roomName)` | Alias for `ops.room(roomName, "cpu")`. | `roomName`: optional owned room. | `ops.cpuStatus("W5N5")` | Printable CPU report status string. | Sets current room through `ops.room`. | Read Only | `src/ops.js:1114`, `src/ops.js:2112` |
| `ops.phase(roomName)` | Alias for the build section of `ops.room`. | `roomName`: optional owned room. | `ops.phase("W5N5")` | Room report object for build section. | Sets current room through `ops.room`. | Read Only | `src/ops.js:1117`, `src/ops.js:2120` |
| `ops.rooms()` | Show overview lines for all owned rooms. | None. | `ops.rooms()` | Room reports array. | Updates progress in generated reports. | Read Only | `src/ops.js:1009`, `src/ops.js:1509` |
| `ops.scan(roomName, section, role)` | Read-only owned-room object discovery for spawns, Power Spawns, creeps, PowerCreeps, structures, sites, and resources. | `roomName`: owned room. `section`: optional `spawns`, `powerSpawns`, `creeps`, `powerCreeps`, `structures`, `sites`, or `resources`. `role`: optional creep role filter. | `ops.scan("W42N9", "spawns")` | Printable scan block. | Prints concise object summaries only. Does not mutate memory or call Screeps action APIs. | Read Only | `src/ops.js` |
| `ops.spawn(roomName, role, sizeOrOptions)` | Preview or manually spawn one normal creep after validating owned room, supported role, small/medium/large profile, selected owned spawn, idle spawn state, body, cost, spawn time, and room energy. | `roomName`: owned room. `role`: supported creep role. `sizeOrOptions`: optional size string or object with `size`, `spawn`, `preview`, and `dryRun`. A fourth options object may be used with a size string. | `ops.spawn("W42N9", "worker", "medium", { preview: true })` | Preview block or printable result line with Screeps result code. | Calls `spawn.spawnCreep` only after validation and only outside `preview`/`dryRun`. Does not alter autonomous spawn policy. | Executes Immediately | `src/ops.js` |
| `ops.spawn("power", name, roomOrOptions)` | Manually spawn one existing PowerCreep at an owned Power Spawn. | `name`: `Game.powerCreeps` name. `roomOrOptions`: optional room string or object with `room`, `powerSpawn`, and `dryRun`. | `ops.spawn("power", "Operator_GenOps", { room: "W42N9", powerSpawn: "id" })` | Printable result line with Screeps result code. | Calls `powerCreep.spawn(powerSpawn)` only after validation; never calls `enableRoom`, movement, or power-use APIs. | Executes Immediately | `src/ops.js` |
| `ops.empire(section)` | Show empire summary and owned-room overview, logistics pressure rollup, or labor coverage rollup. | `section`: optional; use `logistics` for pressure or `labor` for labor deficits. | `ops.empire("labor")` | Empire report object, or section object with lines and rollup. | Updates progress/logistics history in generated reports. Logistics and labor rollups do not create logistics requests or execute hauler, market, terminal, spawn, factory, lab, or boost actions. | Read Only | `src/ops.js`, `src/room_reporting.js` |
| `ops.factory(roomName, mode, product)` | Show factory status or explicitly set factory battery/pause controls. | `roomName`: owned room. `mode`: optional `status`, `preview`, `battery`, `pause`, or `resume`. `product`: for `battery`, use `reserve`, `commodity`, or `disabled`; otherwise optional preview product. | `ops.factory("W5N5", "battery", "reserve")` | Printable factory report/control status string. | `status`, `preview`, and bare `battery` print reports only. Battery policies and pause/resume write room `advancedOps` memory only. Does not call `produce`, market, terminal, planner, or logistics actions. | Planning | `src/ops.js`, `src/room_reporting.js`, `src/advanced_structure_manager.js` |
| `ops.labs(roomName, mode)` | Show lab status or explicitly set lab pause controls. | `roomName`: owned room. `mode`: optional `status`, `preview`, `pause`, or `resume`. | `ops.labs("W5N5", "pause")` | Printable lab report/control status string. | `status` and `preview` print reports only. `pause`/`resume` write room `advancedOps` memory only. Does not call `runReaction`, boost, market, terminal, planner, or logistics actions. | Planning | `src/ops.js`, `src/room_reporting.js`, `src/advanced_structure_manager.js` |
| `ops.log(arg1, arg2)` | Show compact invasion history. | `arg1`: room name or limit. `arg2`: optional limit. | `ops.log("W43N6")` | Lines array. | Prints invasion log lines. | Read Only | `src/ops.js:1015`, `src/ops.js:1541` |
| `ops.logClear(roomName)` | Clear invasion history for one room, or all rooms when omitted. | `roomName`: optional room or `all`. | `ops.logClear("W43N6")` | Clear result object. | Deletes invasion log entries. | Planning | `src/ops.js:1018`, `src/ops.js:1567` |
| `ops.tickRate(sampleTicks)` | Sample wall-clock milliseconds per tick over a short window; supports status and cancel. | `sampleTicks`: positive integer, `status`, or `cancel`. | `ops.tickRate(5)` | Printable status line. | Stores or clears probe state under runtime ops console memory. | Planning | `src/ops.js:1021`, `src/ops.js:1579` |
| `ops.tickSpeed(sampleTicks)` | Alias for `ops.tickRate`. | Same as `ops.tickRate`. | `ops.tickSpeed("status")` | Printable status line. | Same as `ops.tickRate`. | Planning | `src/ops.js:1024`, `src/ops.js:1579` |
| `ops.power(roomName, arg1, arg2)` | Show empire Power Spawn status, show a room power report, or set room-local processing/refill policy. | `roomName`: optional room. `arg1`: `detail`, `on`, `off`, `process`, `refill`, or reserve amount. `arg2`: toggle or amount depending on mode. | `ops.power("W5N5", "process", "off")` | Printable report or policy line. | Policy forms update room power policy memory. | Planning | `src/ops.js:1027`, `src/ops.js:1192`, `src/power_manager.js:242` |
| `ops.pcl(roomName)` | Show GPL/PCL status and optional room enablement readiness. | `roomName`: optional room. | `ops.pcl("W5N5")` | Printable report string. | Prints report. | Read Only | `src/ops.js:1030`, `src/ops.js:1239`, `src/pcl_manager.js:2265` |
| `ops.powerCreeps()` | List friendly Power Creeps without controlling them. | None. | `ops.powerCreeps()` | Printable report string. | Prints report. | Read Only | `src/ops.js:1033`, `src/ops.js:1245`, `src/pcl_manager.js:2289` |
| `ops.operator(powerCreepName, roomName, mode, targetOrMode, maybeMode)` | Report operator readiness or check/confirm manual `OPERATE_SPAWN` and `OPERATE_EXTENSION`. | `powerCreepName`: name. `roomName`: room. `mode`: `powers`, `operateSpawn`, or `operateExtension`. Additional target/mode args as needed. | `ops.operator("OperatorOne", "W5N5", "operateSpawn", "Spawn1", "check")` | Printable report string. | `confirm` for operate commands calls `powerCreep.usePower`; report mode does not. | Approval Required | `src/ops.js:1036`, `src/ops.js:1251`, `src/pcl_manager.js:2379` |
| `ops.powerCreep(powerCreepName, action, roomName, targetOrMode, mode)` | Assign, unassign, report, check, or confirm Power Creep lifecycle and movement actions. | `action`: `assign`, `unassign`, `renewAssist`, `renewStatus`, `spawn`, `renew`, `position`, `move`, `generateOps`. | `ops.powerCreep("OperatorOne", "move", "W5N5", "powerSpawn", "check")` | Printable line or report string. | Assignment and renew-assist update memory. `confirm` lifecycle/generateOps calls Power Creep API actions. | Approval Required | `src/ops.js:1039`, `src/ops.js:1311`, `src/pcl_manager.js:2407` |
| `ops.ops(roomName, action, from, to, amount, powerCreepName)` | Show ops resource inventory or stage `RESOURCE_OPS` between room storage and terminal. | `roomName`: optional room. `action`: optional `stage`. `from`/`to`: `storage` or `terminal`. `amount`: positive number. | `ops.ops("W5N5", "stage", "storage", "terminal", 1000)` | Printable inventory block or request line. | Stage creates an ops logistics move request. | Planning | `src/ops.js:1042`, `src/ops.js:1387` |
| `ops.powerEnable(roomName, mode, powerCreepName)` | Check room power enablement readiness or confirm `enableRoom`. | `roomName`: owned room. `mode`: `check` or `confirm`. `powerCreepName`: required when confirming if more than one candidate exists. | `ops.powerEnable("W5N5", "check")` | Printable report string. | `confirm` calls `powerCreep.enableRoom`. | Approval Required | `src/ops.js:1045`, `src/ops.js:1488`, `src/pcl_manager.js:2578` |
| `ops.move(resource, amount, roomName, from, to)` | Create a room-local logistics request between storage and terminal. | `resource`: resource constant or string. `amount`: positive number. `roomName`: room. `from`/`to`: endpoints. | `ops.move("H", 50000, "W42N9", "terminal", "storage")` | Logistics result object. | Creates a move request in ops logistics memory. | Planning | `src/ops.js:1048`, `src/ops.js:1619` |
| `ops.transfer(resource, amount, fromRoom, fromLocation, toRoom, toLocation, mode)` | Check or confirm an explicit staged transfer plan. Supports `storage -> terminal`, `terminal -> storage`, `storage -> storage`, and `terminal -> terminal`. | `resource`: resource constant or string. `amount`: positive number. `fromRoom`/`toRoom`: room names. `fromLocation`/`toLocation`: `storage` or `terminal`. `mode`: `check` or `confirm`; omitted mode defaults to `check`. | `ops.transfer(RESOURCE_POWER, 1000, "W41N7", "storage", "W42N9", "storage", "confirm")` | Printable transfer line. | `check` is report-only. `confirm` creates a plan in `Memory.ops.transfers`; approved plans may create ops logistics requests and call `terminal.send` as they advance each tick. | Approval Required | `src/ops.js:1051`, `src/ops.js:1631`, `src/transfer_manager.js:676` |
| `ops.transfers()` | Show active staged transfer plans. | None. | `ops.transfers()` | Printable summary block. | Prints active transfer summaries. | Read Only | `src/ops.js:1054`, `src/ops.js:1645`, `src/transfer_manager.js:731` |
| `ops.transferStatus(id)` | Show detailed status for one staged transfer plan. | `id`: transfer plan id. | `ops.transferStatus("ot_123_W41N7_W42N9_4567")` | Printable detail block. | Prints plan detail and may refresh delivered/completion progress from visible storage. | Read Only | `src/ops.js:1057`, `src/ops.js:1649`, `src/transfer_manager.js:741` |
| `ops.cancelTransfer(id)` | Cancel an active staged transfer plan. | `id`: transfer plan id. | `ops.cancelTransfer("ot_123_W41N7_W42N9_4567")` | Printable cancellation line. | Marks the transfer `CANCELLED` and cancels associated source/destination ops logistics requests when present. | Planning | `src/ops.js:1060`, `src/ops.js:1653`, `src/transfer_manager.js:772` |
| `ops.terminalStatus(roomName)` | Show terminal capacity, energy, resources, and congestion status. | `roomName`: optional owned room. | `ops.terminalStatus("W42N9")` | Printable block. | Prints report. | Read Only | `src/ops.js:1063`, `src/ops.js:1657` |
| `ops.clearTerminal(roomName, resource, amount)` | Create terminal-to-storage logistics requests for terminal cleanup. | `roomName`: owned room. Optional `resource` and `amount`; when omitted, source selects cleanup resources. | `ops.clearTerminal("W42N9", "H", 50000)` | Result object or cleanup summary. | Creates one or more logistics requests. | Planning | `src/ops.js:1066`, `src/ops.js:1714` |
| `ops.fillTerminal(roomName, resource, amount)` | Create a storage-to-terminal logistics request for market staging. | `roomName`, `resource`, `amount`. | `ops.fillTerminal("W42N9", "energy", 10000)` | Logistics result object. | Creates a logistics request. | Planning | `src/ops.js:1069`, `src/ops.js:1795` |
| `ops.requests(roomName, mode)` | Show active, blocked-only, or historical ops logistics requests. | `roomName`: optional room. `mode`: optional `blocked`, `all`, or `history`; `blocked` can also be the first argument. | `ops.requests("W42N9", "blocked")` | Printable block with counts, age, reason, created, and updated fields. | Prints report. | Read Only | `src/ops.js:1072`, `src/ops.js:1807` |
| `ops.cancelRequests(roomName, status, filters)` | Cancel stale blocked unclaimed ops logistics requests for one room. | `roomName`: owned room. `status`: only `blocked`. `filters`: optional `resource` or `resourceType`, `from`, `to`, and `olderThan`; default age is 1000 ticks. | `ops.cancelRequests("W42N9", "blocked", { resource: RESOURCE_POWER, from: "terminal", to: "powerSpawn", olderThan: 1000 })` | Printable cleanup block. | Marks matching blocked, unclaimed requests as canceled; skips open, done, expired, canceled, claimed, or non-matching requests. | Planning | `src/ops.js:1075`, `src/ops.js:1881`, `src/ops_logistics_manager.js:496` |
| `ops.cancel(requestId)` | Cancel an ops logistics request. | `requestId`: request id. | `ops.cancel("ol_123_W42N9_H_1")` | Cancel result object. | Marks request canceled. | Planning | `src/ops.js:1078`, `src/ops.js:1910` |
| `ops.balanceTerminal(roomName)` | Evaluate one terminal balance target set and create conservative logistics requests. | `roomName`: owned room. | `ops.balanceTerminal("W42N9")` | Terminal balance result object. | May create logistics requests. | Planning | `src/ops.js:1081`, `src/ops.js:1916` |
| `ops.balanceTerminals()` | Evaluate terminal balance targets for all owned rooms with storage and terminal. | None. | `ops.balanceTerminals()` | Aggregate result object. | May create logistics requests. | Planning | `src/ops.js:1084`, `src/ops.js:1934` |
| `ops.expand(targetRoom, parentRoom)` | Start or update a manual expansion plan. | `targetRoom`: room to claim. `parentRoom`: optional support room. | `ops.expand("W5N6", "W5N5")` | Expansion result object. | Creates/updates expansion memory; may convert reservation to expansion. | Planning | `src/ops.js:1087`, `src/ops.js:1963`, `src/empire_manager.js:1390` |
| `ops.reserve(targetRoom, parentRoom)` | Start or update a reserved-room plan. | `targetRoom`: remote room. `parentRoom`: optional parent; current room is used when omitted. | `ops.reserve("W5N6", "W5N5")` | Reservation result object. | Creates/updates reservation memory; may convert expansion to reservation. | Planning | `src/ops.js:1090`, `src/ops.js:1988`, `src/reservation_manager.js:806` |
| `ops.reserved(parentRoom)` | Show active reserved rooms grouped by parent. | `parentRoom`: optional parent filter. | `ops.reserved("W5N5")` | Lines array. | Prints report. | Read Only | `src/ops.js:1093`, `src/ops.js:2033` |
| `ops.expansions()` | Show active expansion plans. | None. | `ops.expansions()` | Lines array. | Prints report. | Read Only | `src/ops.js:1096`, `src/ops.js:2039` |
| `ops.attack(targetRoom, postActionOrOptions, parentRoom, allies)` | Start or update a manual attack plan. | `targetRoom`: target. `postAction`: `expand`, `reserve`, or `none`; options object also accepted. `parentRoom`: support room. `allies`: array. | `ops.attack("W5N6", "expand", "W5N5", ["W4N6"])` | Attack result object. | Creates/updates attack memory. | Planning | `src/ops.js:1099`, `src/ops.js:2045`, `src/attack_manager.js:301` |
| `ops.attacks()` | Show active attack plans. | None. | `ops.attacks()` | Lines array. | Prints report. | Read Only | `src/ops.js:1102`, `src/ops.js:2088` |
| `ops.cancelAttack(targetRoom)` | Cancel an active attack plan. | `targetRoom`: target room. | `ops.cancelAttack("W5N6")` | Cancel result object. | Cancels attack plan memory. | Planning | `src/ops.js:1105`, `src/ops.js:2094`, `src/attack_manager.js:395` |
| `ops.cancelExpansion(targetRoom)` | Cancel an active expansion plan. | `targetRoom`: target room. | `ops.cancelExpansion("W5N6")` | Cancel result object. | Cancels expansion plan memory. | Planning | `src/ops.js:1108`, `src/ops.js:2100`, `src/empire_manager.js:1516` |
| `ops.cancelReserve(targetRoom)` | Cancel an active reserved-room plan. | `targetRoom`: reserved room. | `ops.cancelReserve("W5N6")` | Cancel result object. | Cancels reservation plan memory. | Planning | `src/ops.js:1111`, `src/ops.js:2106`, `src/reservation_manager.js:871` |

### Market

| Command | Description | Parameters | Example | Returns | Side Effects | Execution Level | Source |
|---|---|---|---|---|---|---|---|
| `market.help()` | Print the market command help surface. | None. | `market.help()` | Printable block. | Prints help. | Read Only | `src/market_console.js:2135`, `src/market_console.js:3079` |
| `market.info()` | Show helper runtime and memory status. | None. | `market.info()` | Object with runtime status and memory. | Touches market console memory registration fields. | Planning | `src/market_console.js:2225`, `src/market_console.js:3080` |
| `market.ping()` | Confirm market helper availability. | None. | `market.ping()` | Printable pong line. | Prints line. | Read Only | `src/market_console.js:2249`, `src/market_console.js:3081` |
| `market.install()` | Install and register market helper in runtime memory. | None. | `market.install()` | Printable line. | Updates market memory and registers global. | Planning | `src/market_console.js:2253`, `src/market_console.js:3082` |
| `market.restore()` | Restore a previously uninstalled helper. | None. | `market.restore()` | Printable line. | Updates market memory and registers global. | Planning | `src/market_console.js:2263`, `src/market_console.js:3083` |
| `market.uninstall()` | Mark helper uninstalled and delete `global.market` for current runtime. | None. | `market.uninstall()` | Printable line. | Updates memory and deletes runtime global. | Planning | `src/market_console.js:2272`, `src/market_console.js:3084` |
| `market.rooms()` | List owned rooms and terminal availability. | None. | `market.rooms()` | Printable block. | Prints report. | Read Only | `src/market_console.js:2284`, `src/market_console.js:3086` |
| `market.stock(roomName)` | Show empire or room storage/terminal stock. | `roomName`: optional owned room. | `market.stock("W42N9")` | Printable block. | Prints report. | Read Only | `src/market_console.js:2301`, `src/market_console.js:3087` |
| `market.needs()` | Show obvious room-level market/logistics needs. | None. | `market.needs()` | Printable block. | Prints report. | Read Only | `src/market_console.js:2348`, `src/market_console.js:3088` |
| `market.surplus()` | Show obvious surplus resources. | None. | `market.surplus()` | Printable block. | Prints report. | Read Only | `src/market_console.js:2400`, `src/market_console.js:3089` |
| `market.stage(resource, amount, roomName)` | Stage a resource from storage to terminal. | `resource`, `amount`, `roomName`. | `market.stage("H", 10000, "W42N9")` | Printable logistics message. | Creates ops logistics request. | Planning | `src/market_console.js:2452`, `src/market_console.js:3091` |
| `market.unstage(resource, amount, roomName)` | Move a resource from terminal to storage. | `resource`, `amount`, `roomName`. | `market.unstage("H", 10000, "W42N9")` | Printable logistics message. | Creates ops logistics request. | Planning | `src/market_console.js:2464`, `src/market_console.js:3092` |
| `market.requests(roomName, mode)` | Show market-compatible logistics requests. | `roomName`: optional. `mode`: optional `all` or `history`. | `market.requests("W42N9", "all")` | Printable block. | Prints report. | Read Only | `src/market_console.js:2476`, `src/market_console.js:3093` |
| `market.cancel(requestId)` | Cancel an ops or market request by id. | `requestId`: request id. | `market.cancel("ol_123_W42N9_H_1")` | Printable cancel message. | Marks request canceled when found. | Planning | `src/market_console.js:2541`, `src/market_console.js:3094` |
| `market.send(resource, amount, fromRoom, toRoom)` | Send resources directly between owned terminals. | `resource`, `amount`, `fromRoom`, `toRoom`. | `market.send("energy", 5000, "W42N9", "W41N8")` | Printable send result. | Calls `terminal.send`. | Executes Immediately | `src/market_console.js:2551`, `src/market_console.js:3095` |
| `market.buyOptions(resource)` | Show usable buy options from sell orders. | `resource`: optional resource. | `market.buyOptions("energy")` | Printable block. | Reads market orders. | Read Only | `src/market_console.js:2599`, `src/market_console.js:3097` |
| `market.sellOptions(resource)` | Show usable sell options against buy orders. | `resource`: optional resource. | `market.sellOptions("H")` | Printable block. | Reads market orders. | Read Only | `src/market_console.js:2662`, `src/market_console.js:3098` |
| `market.readiness(input)` | Show market readiness by empire, room, or resource. | `input`: optional room name or resource. | `market.readiness("H")` | Printable block. | Prints report. | Read Only | `src/market_console.js:321`, `src/market_console.js:3099` |
| `market.opportunities(resource)` | Show ready market sell opportunities. | `resource`: optional resource. | `market.opportunities("H")` | Printable block. | Reads market and terminal state. | Read Only | `src/market_console.js:595`, `src/market_console.js:3100` |
| `market.recommendations()` | Show conservative next manual market/logistics commands. | None. | `market.recommendations()` | Printable block. | Prints report. | Read Only | `src/market_console.js:636`, `src/market_console.js:3101` |
| `market.planSell(resource, amount, roomName)` | Save a dry-run sell plan. | `resource`, `amount`, `roomName`. | `market.planSell("H", 10000, "W42N9")` | Printable plan report. | Writes saved plan memory. | Planning | `src/market_console.js:994`, `src/market_console.js:3102` |
| `market.planBuy(resource, amount, roomName)` | Save a dry-run buy plan. | `resource`, `amount`, `roomName`. | `market.planBuy("energy", 5000, "W41N8")` | Printable plan report. | Writes saved plan memory. | Planning | `src/market_console.js:1028`, `src/market_console.js:3103` |
| `market.plans(mode)` | List saved plans. | `mode`: optional `all` or `history`. | `market.plans("all")` | Printable block. | May mark expired plans during listing. | Planning | `src/market_console.js:1069`, `src/market_console.js:3104` |
| `market.plan(planId)` | Recheck and show one saved plan. | `planId`: saved plan id. | `market.plan("ms_223455_H_W42N9")` | Printable plan report. | May update plan status. | Planning | `src/market_console.js:1222`, `src/market_console.js:3105` |
| `market.planSummary()` | Summarize saved plan counts. | None. | `market.planSummary()` | Printable block. | Reads plan memory. | Read Only | `src/market_console.js:1987`, `src/market_console.js:3106` |
| `market.planReview(planId)` | Review saved plan readiness before execution. | `planId`: saved plan id. | `market.planReview("ms_223455_H_W42N9")` | Printable review report. | May update plan status. | Planning | `src/market_console.js:1230`, `src/market_console.js:3107` |
| `market.planAudit()` | Audit active saved plans for stale, duplicate, blocked, or missing-order cases. | None. | `market.planAudit()` | Printable block. | May update stale status through rechecks. | Planning | `src/market_console.js:2052`, `src/market_console.js:3108` |
| `market.clearPlan(planId)` | Soft-delete one plan or active plans. | `planId` or `all`. | `market.clearPlan("all")` | Printable line. | Marks plan(s) deleted. | Planning | `src/market_console.js:1950`, `src/market_console.js:3109` |
| `market.deletePlan(planId)` | Deprecated alias for `market.clearPlan(planId)`. | `planId`: saved plan id. | `market.deletePlan("ms_223455_H_W42N9")` | Printable deprecation line and clear result. | Marks plan deleted. | Planning | `src/market_console.js:1972`, `src/market_console.js:3110` |
| `market.removePlan(planId)` | Deprecated alias for `market.clearPlan(planId)`. | `planId`: saved plan id. | `market.removePlan("ms_223455_H_W42N9")` | Printable deprecation line and clear result. | Marks plan deleted. | Planning | `src/market_console.js:1977`, `src/market_console.js:3111` |
| `market.clearPlans()` | Deprecated alias for `market.clearPlan("all")`. | None. | `market.clearPlans()` | Printable deprecation line and clear result. | Marks active plans deleted. | Planning | `src/market_console.js:1982`, `src/market_console.js:3112` |
| `market.executionStatus()` | Show execution design and safety status. | None. | `market.executionStatus()` | Printable block. | Prints report. | Read Only | `src/market_console.js:1262`, `src/market_console.js:3113` |
| `market.executionDryRun(planId)` | Recompute execution preflight without executing. | `planId`: saved plan id. | `market.executionDryRun("ms_223455_H_W42N9")` | Printable preflight report. | Reads current market/terminal state. | Read Only | `src/market_console.js:1520`, `src/market_console.js:3114` |
| `market.executionLimits()` | Show configured execution limits. | None. | `market.executionLimits()` | Printable block. | Ensures default limit memory exists. | Planning | `src/market_console.js:1276`, `src/market_console.js:3115` |
| `market.setExecutionLimit(name, value)` | Set a numeric execution safety limit. | `name`: supported limit. `value`: number or `null` for `maxBuyEffectivePrice`. | `market.setExecutionLimit("maxSellAmount", 5000)` | Printable line. | Updates execution limit memory. | Planning | `src/market_console.js:1312`, `src/market_console.js:3116` |
| `market.clearExecutionLimit(name)` | Reset one execution limit to its default. | `name`: supported limit. | `market.clearExecutionLimit("maxSellAmount")` | Printable line. | Updates execution limit memory. | Planning | `src/market_console.js:1326`, `src/market_console.js:3117` |
| `market.limits()` | Alias for `market.executionLimits()`. | None. | `market.limits()` | Printable block. | Ensures default limit memory exists. | Planning | `src/market_console.js:3118` |
| `market.setLimit(name, value)` | Alias for `market.setExecutionLimit`. | `name`, `value`. | `market.setLimit("maxBuyAmount", 5000)` | Printable line. | Updates execution limit memory. | Planning | `src/market_console.js:3119` |
| `market.clearLimit(name)` | Alias for `market.clearExecutionLimit`. | `name`. | `market.clearLimit("maxBuyAmount")` | Printable line. | Updates execution limit memory. | Planning | `src/market_console.js:3120` |
| `market.executePlan(planId)` | Execute a saved market plan after current-state preflight passes. | `planId`: saved plan id. | `market.executePlan("ms_223455_H_W42N9")` | Printable execution report. | Calls `Game.market.deal`; appends history and updates plan execution fields. | Approval Required | `src/market_console.js:1688`, `src/market_console.js:3121` |
| `market.execute(planId)` | Alias for `market.executePlan(planId)`. | `planId`: saved plan id. | `market.execute("ms_223455_H_W42N9")` | Printable execution report. | Calls `Game.market.deal`; appends history and updates plan execution fields. | Approval Required | `src/market_console.js:3122` |
| `market.history(filter)` | Show recent market execution history. | `filter`: optional resource, room, or `all`. | `market.history("H")` | Printable block. | Trims history to current limit. | Planning | `src/market_console.js:1722`, `src/market_console.js:3123` |
| `market.historySummary()` | Summarize market execution history counts and accounting. | None. | `market.historySummary()` | Printable block. | Reads history. | Read Only | `src/market_console.js:1769`, `src/market_console.js:3124` |
| `market.historyAudit()` | Audit history for repeated failures, stale plans, and limit blocks. | None. | `market.historyAudit()` | Printable block. | Reads history. | Read Only | `src/market_console.js:1844`, `src/market_console.js:3125` |
| `market.clearHistory(mode)` | Remove selected execution history entries. | `mode`: `failed`, `blocked`, `stale`, `deleted`, or `all`. | `market.clearHistory("failed")` | Printable line. | Deletes history entries. | Planning | `src/market_console.js:1898`, `src/market_console.js:3126` |
| `market.setHistoryLimit(limit)` | Set maximum market history size. | `limit`: integer at least 10. | `market.setHistoryLimit(100)` | Printable line. | Updates history limit and trims old entries. | Planning | `src/market_console.js:1932`, `src/market_console.js:3127` |
| `market.historyLimit()` | Show current history retention limit. | None. | `market.historyLimit()` | Printable line. | Ensures default history limit exists. | Planning | `src/market_console.js:1946`, `src/market_console.js:3128` |
| `market.buy(resource, amount, roomName)` | Directly buy a resource from the best usable sell order. | `resource`, `amount`, `roomName`. | `market.buy("energy", 5000, "W41N8")` | Printable execution line. | Calls `Game.market.deal`. | Executes Immediately | `src/market_console.js:2769`, `src/market_console.js:3129` |
| `market.sell(resource, amount, roomName)` | Directly sell a resource to the best usable buy order. | `resource`, `amount`, `roomName`. | `market.sell("H", 2580, "W42N9")` | Printable execution line. | Calls `Game.market.deal`. | Executes Immediately | `src/market_console.js:2881`, `src/market_console.js:3130` |
| `market.planBuys()` | Print suggested buy or receive actions. | None. | `market.planBuys()` | Printable block. | Prints report. | Read Only | `src/market_console.js:2982`, `src/market_console.js:3132` |
| `market.planSells()` | Print suggested sell or send actions. | None. | `market.planSells()` | Printable block. | Prints report. | Read Only | `src/market_console.js:3030`, `src/market_console.js:3133` |

## 4. Room Operations

Economy:

- `ops.room([roomName], "economy")`: room energy, storage, hub/controller container, upgrade rate, spawn queue, and hauler mode.
- `ops.room([roomName], "resources")`: storage energy, terminal energy, terminal power, ghodium, minerals, and terminal balance state.
- `ops.room("ROOM", "factory")` and `ops.factory("ROOM", "status")`: read-only factory status, battery policy/stock/trend/classification, recipe, bottlenecks, output accumulation, and ownership alignment.
- `ops.factory("ROOM", "battery", "reserve"|"commodity"|"disabled")`: explicitly stores battery intent only; it does not create market behavior, terminal balancing, commodity planning, or logistics requests.
- `ops.factory("ROOM", "pause"|"resume")`: explicitly stores or clears factory pause state. The advanced structure manager honors the pause state before selecting/running factory production.
- `ops.room("ROOM", "labs")` and `ops.labs("ROOM", "status")`: read-only lab count, input/output layout when known, reaction, stores, reagent/output blockers, cooldowns, and ownership alignment.
- `ops.labs("ROOM", "pause"|"resume")`: explicitly stores or clears lab pause state. The advanced structure manager honors the pause state before running reactions.
- `ops.terminalStatus([roomName])`: terminal stock and congestion status.
- `market.stock([roomName])`, `market.needs()`, and `market.surplus()`: economy visibility from the market helper.

Logistics:

- `ops.move(resource, amount, roomName, from, to)`: create storage/terminal movement requests.
- `ops.room("ROOM", "logistics")`: read-only room logistics diagnostics for open/blocked requests, unclaimed work, hauler pressure, advanced backlog labels, recent history, and starvation trend.
- `ops.empire("logistics")`: read-only empire logistics pressure rollup across owned rooms, with top rooms and suggested room-level inspection commands.
- `ops.room("ROOM", "labor")` and `ops.empire("labor")`: read-only worker labor coverage diagnostics for current/desired labor, deficits, spawn state, pending worker intents, low-energy/busy-spawn/priority blockers, and repeated `restore worker labor coverage` rooms.
- `ops.transfer(resource, amount, fromRoom, fromLocation, toRoom, toLocation, "check")`: preview an explicit staged cross-room transfer without creating a plan.
- `ops.transfer(resource, amount, fromRoom, fromLocation, toRoom, toLocation, "confirm")`: approve what should move; Omega advances the plan each tick through source staging, terminal send, destination staging, completion, block, or cancellation states.
- `ops.transfers()`, `ops.transferStatus(id)`, and `ops.cancelTransfer(id)`: list, inspect, and cancel staged transfers. The command is `ops.cancelTransfer(id)`; `ops.transferCancel(id)` is not implemented.
- `ops.clearTerminal(...)`, `ops.fillTerminal(...)`, `ops.balanceTerminal(...)`, and `ops.balanceTerminals()`: terminal hygiene and balance workflows.
- `ops.requests(...)`, `ops.requests("blocked")`, `ops.cancelRequests(room, "blocked", filters)`, `ops.cancel(...)`, `market.stage(...)`, `market.unstage(...)`, `market.requests(...)`, and `market.cancel(...)`: logistics request visibility and control.

Diagnostics boundary:

- `ops.room("ROOM", "logistics")`, `ops.empire("logistics")`, `ops.room("ROOM", "factory")`, `ops.room("ROOM", "labs")`, `ops.room("ROOM", "labor")`, and `ops.empire("labor")` are reporting-only diagnostics. They may read current room state and update bounded report history already owned by existing diagnostics, but they must not create or cancel requests, assign hauler tasks, change priorities, spawn creeps, run factory/lab actions, send terminal resources, use boosts, or execute market deals.
- `ops.factory("ROOM", "battery", policy)`, `ops.factory("ROOM", "pause"|"resume")`, and `ops.labs("ROOM", "pause"|"resume")` are explicit operator controls that write only room `advancedOps` intent. They must not create a production planner, market automation, terminal balancing expansion, or autonomous pause/resume behavior.

Construction:

- `ops.room([roomName], "build")`: roadmap status, current/future phase work, storage planning, mineral road needs, and next task.
- `ops.phase(roomName)`: undocumented alias for the build section.

Remotes:

- `ops.reserve(targetRoom, [parentRoom])`, `ops.reserved([parentRoom])`, and `ops.cancelReserve(targetRoom)`: reserved-room lifecycle.
- `ops.expand(targetRoom, [parentRoom])`, `ops.expansions()`, and `ops.cancelExpansion(targetRoom)`: expansion lifecycle.
- `ops.attack(targetRoom, [postAction], [parentRoom], [allies])`, `ops.attacks()`, and `ops.cancelAttack(targetRoom)`: attack plan lifecycle and post-action planning.

Defense:

- `ops.room([roomName], "defense")`: alert state, safe mode, hostiles, threat score, response mode, breach severity, tower status, defender readiness, support, and target focus.
- `ops.log([roomName], [limit])` and `ops.logClear([roomName])`: invasion log inspection and cleanup.

CPU:

- `ops.cpu([roomName])` and `ops.cpuStatus([roomName])`: room CPU report.
- `ops.tickRate([sampleTicks|status|cancel])` and `ops.tickSpeed(...)`: wall-clock tick-speed probe.

Reporting:

- `ops.room([roomName], "overview"|"all")`, `ops.room([roomName], "logistics")`, `ops.rooms()`, `ops.empire()`, and `ops.empire("logistics")`: primary room, logistics, and empire reports.
- `ops.hud(on|off)`, `ops.reports(on|off)`, and `view(on|off)`: reporting visibility controls.

## 5. Power Operations

GPL:

- `ops.pcl([roomName])` prints global GPL/PCL status and optional room enablement readiness.

PCL:

- `ops.pcl([roomName])` is the PCL summary entry point.
- `ops.powerCreeps()` lists friendly Power Creeps.

Power Spawn:

- `ops.power()` shows empire Power Spawn status.
- `ops.power("ROOM", "detail")` or `ops.room("ROOM", "power")` shows a room power report.
- `ops.power("ROOM", "process", "on"|"off")`, `ops.power("ROOM", "refill", "on"|"off")`, and reserve forms set room-local Power Spawn policy.
- Power Spawn refill policy is owned by `power_manager`; execution uses `ops_logistics_manager` requests, and haulers execute those requests through the normal ops logistics priority. `advanced_structure_manager` reports Power Spawn readiness only and does not create Power Spawn refill haul tasks.
- The room power report also shows configured `Operator_GenOps` banking action, target, result, and blocked reason when carried ops are deposited locally.

Power Creeps:

- `ops.powerCreep(name, "assign", room)` and `ops.powerCreep(name, "unassign")` manage renewal-assist assignment memory.
- `ops.powerCreep(name, "renewAssist", on|off)` toggles per-creep renewal assist.
- `ops.powerCreep(name, "renewStatus")` reports renewal assist state.
- `ops.powerCreep(name, "position", room)` reports target positioning.
- `ops.powerCreep(name, "move", room, target, "check"|"confirm")` checks or confirms movement preparation.
- `ops.powerCreep(name, "spawn", room, "check"|"confirm")`, `ops.powerCreep(name, "renew", room, "check"|"confirm")`, and `ops.powerCreep(name, "generateOps", "check"|"confirm")` are approval-gated lifecycle/power actions.
- Configured `Operator_GenOps` may bank carried `RESOURCE_OPS` only into same-room terminal/storage in its configured home room before the automatic generate-ops pass continues.

Operators:

- `ops.operator(name, [room], "powers")` reports `OPERATE_*` readiness and target visibility.
- `ops.operator(name, room, "operateSpawn", [spawnNameOrId], "check"|"confirm")` checks or confirms `PWR_OPERATE_SPAWN`.
- `ops.operator(name, room, "operateExtension", "check"|"confirm")` checks or confirms `PWR_OPERATE_EXTENSION`.

Ops resource management:

- `ops.ops()` shows empire ops inventory.
- `ops.ops("ROOM")` shows room ops inventory.
- `ops.ops("ROOM", "stage", "storage", "terminal", amount)` stages ops between storage and terminal through logistics requests.

## 6. Market Operations

Visibility:

- `market.rooms()`, `market.stock([roomName])`, `market.needs()`, and `market.surplus()`.

Internal terminal logistics:

- `market.stage(resource, amount, roomName)`, `market.unstage(resource, amount, roomName)`, `market.requests(...)`, `market.cancel(requestId)`, and `market.send(...)`.

Market scanning:

- `market.buyOptions([resource])` and `market.sellOptions([resource])`.

Market intelligence:

- `market.readiness([roomName|resource])`, `market.opportunities([resource])`, and `market.recommendations()`.

Dry-run planning:

- `market.planSell(...)`, `market.planBuy(...)`, `market.plans(...)`, `market.plan(...)`, `market.planSummary()`, `market.planReview(...)`, `market.planAudit()`, and `market.clearPlan(...)`.
- Deprecated aliases remain implemented: `market.deletePlan(...)`, `market.removePlan(...)`, and `market.clearPlans()`.

Execution design and safety:

- `market.executionStatus()`, `market.executionDryRun(planId)`, `market.executionLimits()`, `market.setExecutionLimit(name, value)`, `market.clearExecutionLimit(name)`, `market.limits()`, `market.setLimit(name, value)`, `market.clearLimit(name)`, `market.executePlan(planId)`, and `market.execute(planId)`.

Execution history:

- `market.history([filter])`, `market.historySummary()`, `market.historyAudit()`, `market.clearHistory(mode)`, `market.setHistoryLimit(limit)`, and `market.historyLimit()`.

Manual trading:

- `market.buy(resource, amount, roomName)` and `market.sell(resource, amount, roomName)` execute immediately through `Game.market.deal`.

## 7. Observer Operations

No `observer.*` command root is registered in source.

Observer reporting is exposed through room reports:

- `ops.room("observer")`: prints observer report for the current/default room.
- `ops.room("ROOM", "observer")`: prints observer report for a specific room.
- `ops.room("ROOM", "all")`: includes observer lines with the rest of the room report.

The observer section reports whether observer logic is enabled, visible observer count, last target, last result, queued targets, target list, intel count, newest/oldest intel age, run interval, and last run tick. Source: `src/room_reporting.js:1576`.

## 8. Troubleshooting

Cannot create first Power Creep:

- Run `ops.pcl("ROOM")` to inspect GPL/PCL and room enablement readiness.
- Run `ops.powerEnable("ROOM", "check")` before attempting confirmation.
- If readiness is blocked, inspect the printed next step from the enablement report.

Power Spawn not processing:

- Run `ops.power()` for empire summary.
- Run `ops.power("ROOM", "detail")` or `ops.room("ROOM", "power")`.
- Check global and room-local process/refill overrides, energy/power levels, terminal balance, refill pending count, and blocked reason.
- For refill stalls, inspect the `Refill owner power_manager | execution ops_logistics` line plus pending refill ids; stale blocked requests should be canceled or allowed to expire through existing ops logistics controls.
- Use `ops.power("ROOM", "process", "on")` or `ops.power("ROOM", "refill", "on")` only when you intend to change policy.

Remote reservation lost:

- Run `ops.reserved("PARENT")` to check active plans.
- Run `ops.room("PARENT", "defense")` and `ops.log("TARGET")` for threat context.
- Recreate or update with `ops.reserve("TARGET", "PARENT")`.

Room CPU high:

- Run `ops.cpu("ROOM")`.
- Review pressure, trend, scheduler skips, and top section cost lines.
- Run `ops.tickRate("status")` if a wall-clock probe is already active, or `ops.tickRate(5)` to sample.

Terminal clogged or market blocked:

- Run `ops.terminalStatus("ROOM")` and `market.readiness("ROOM")`.
- Run `ops.room("ROOM", "logistics")` for room-level backlog, starvation, hauler pressure, and recent logistics history.
- Run `ops.empire("logistics")` when more than one room may be under logistics pressure.
- Use `ops.clearTerminal("ROOM")` for source-selected cleanup or `ops.clearTerminal("ROOM", resource, amount)` for a specific resource.
- Run `ops.requests("ROOM", "blocked")` or `market.requests("ROOM", "all")` to find stuck logistics.
- Use `ops.cancelRequests("ROOM", "blocked", filters)` only for stale blocked requests that are unclaimed and safe to clear.

Market plan will not execute:

- Run `market.planReview(planId)` and `market.executionDryRun(planId)`.
- Check stale order, terminal cooldown, resource amount, terminal energy, credits, and execution limits.
- Run `market.executionLimits()` before changing limits.

Power Creep operation does not fire:

- Run `ops.operator(name, room, "powers")`.
- Use `check` mode first for the specific action.
- Use `confirm` only when the check report is ready and the target is correct.

## 9. Quick Reference

Read-only first:

- Rooms: `ops.room("ROOM")`, `ops.room("ROOM", "economy")`, `ops.room("ROOM", "defense")`, `ops.room("ROOM", "logistics")`, `ops.rooms()`, `ops.empire()`, `ops.empire("logistics")`
- CPU: `ops.cpu("ROOM")`, `ops.tickRate(5)`, `ops.tickRate("status")`
- Power: `ops.power()`, `ops.power("ROOM", "detail")`, `ops.pcl("ROOM")`, `ops.powerCreeps()`
- Observer: `ops.room("ROOM", "observer")`
- Market: `market.readiness()`, `market.opportunities("H")`, `market.recommendations()`

Planning and memory updates:

- Reservations: `ops.reserve("TARGET", "PARENT")`, `ops.cancelReserve("TARGET")`
- Expansions: `ops.expand("TARGET", "PARENT")`, `ops.cancelExpansion("TARGET")`
- Attack plans: `ops.attack("TARGET", "expand", "PARENT", ["ALLY"])`, `ops.cancelAttack("TARGET")`
- Logistics: `ops.move("H", 50000, "ROOM", "terminal", "storage")`, `ops.transfer(RESOURCE_POWER, 1000, "W41N7", "storage", "W42N9", "storage", "confirm")`, `ops.cancelRequests("ROOM", "blocked", { olderThan: 1000 })`, `ops.fillTerminal("ROOM", "energy", 10000)`, `ops.clearTerminal("ROOM")`
- Market plans: `market.planSell("H", 10000, "ROOM")`, `market.planReview(planId)`, `market.executionDryRun(planId)`

Executing commands:

- Power: `ops.powerCreep(name, "generateOps", "confirm")`, `ops.operator(name, "ROOM", "operateSpawn", "Spawn1", "confirm")`, `ops.powerEnable("ROOM", "confirm", name)`
- Market: `market.executePlan(planId)`, `market.buy(resource, amount, roomName)`, `market.sell(resource, amount, roomName)`, `market.send(resource, amount, fromRoom, toRoom)`

## Command Surface Findings

Counts by category:

- Global callable aliases: 1 (`view`).
- Global convenience constants: 2 (`on`, `off`).
- `ops.*` callable functions: 44.
- `market.*` callable functions: 51.
- Total callable operator commands documented: 96.
- Ops help signature rows: 48.
- Market help signature rows: 65.

Missing documentation:

- `ops.tickSpeed(sampleTicks)` is implemented as an alias for `ops.tickRate` but has no ops help entry.
- `ops.cpuStatus(roomName)` is implemented as an alias for `ops.room(roomName, "cpu")` but has no ops help entry.
- `ops.phase(roomName)` is implemented as an alias for `ops.room(roomName, "build")` but has no ops help entry.
- `market.version` and `market.config` are exposed fields, not commands; they are intentionally excluded from the command count.
- Current logistics diagnostics are implemented and documented as `ops.room("ROOM", "logistics")` and `ops.empire("logistics")`; older logistics docs should point operators to these before request mutation commands.

Duplicate commands:

- `ops.tickSpeed` duplicates `ops.tickRate`.
- `ops.cpuStatus` duplicates `ops.cpu`.
- `ops.phase` duplicates `ops.room(..., "build")`.
- `market.limits`, `market.setLimit`, and `market.clearLimit` duplicate the execution-limit commands.
- `market.execute` duplicates `market.executePlan`.
- `market.deletePlan`, `market.removePlan`, and `market.clearPlans` are deprecated aliases for `market.clearPlan`.

Stale help entries:

- No `ops.help()` or `market.help()` entry was found that references a missing callable implementation.
- Some help rows intentionally document variants of the same function, for example `market.stock()` and `market.stock(roomName)`.

Broken references:

- No broken help-to-implementation references were found in the source-registered help surfaces.
- No `attack.*`, `expansion.*`, `reservation.*`, `logistics.*`, `power.*`, `powerCreep.*`, `operator.*`, or `observer.*` global roots are registered. These workflows are exposed under `ops.*`.

Opportunities to consolidate command surfaces:

- Add help rows for implemented aliases or intentionally hide them as internal compatibility aliases.
- Consider documenting `ops.room` sections directly in `ops.help()` so `observer`, `resources`, and `advanced` are discoverable from the console.
- Consider aligning deprecated market plan aliases around one compatibility section so operators do not confuse aliases with preferred commands.
- Consider separating immediate market execution commands from approval-gated saved-plan execution in `market.help()` to make risk levels clearer.
