const opsState = require("ops_state");
const roomReporting = require("room_reporting");
const empireManager = require("empire_manager");
const reservationManager = require("reservation_manager");
const attackManager = require("attack_manager");
const invasionLog = require("invasion_log");

function getOwnedRooms() {
  return empireManager.collectOwnedRooms();
}

function resolveOwnedRoom(roomName) {
  if (roomName) {
    const room = Game.rooms[roomName];
    if (room && room.controller && room.controller.my) {
      return room;
    }

    return null;
  }

  const currentRoomName = opsState.getCurrentRoomName();
  if (currentRoomName) {
    const currentRoom = Game.rooms[currentRoomName];
    if (currentRoom && currentRoom.controller && currentRoom.controller.my) {
      return currentRoom;
    }
  }

  const ownedRooms = getOwnedRooms();
  return ownedRooms.length > 0 ? ownedRooms[0] : null;
}

function parseToggleMode(mode, currentEnabled) {
  if (typeof mode === "undefined") {
    return !currentEnabled;
  }

  if (typeof mode === "boolean") {
    return mode;
  }

  if (typeof mode === "number") {
    if (mode === 1) return true;
    if (mode === 0) return false;
    return null;
  }

  if (typeof mode === "string") {
    const normalized = mode.trim().toLowerCase();

    if (
      normalized === "on" ||
      normalized === "true" ||
      normalized === "enable" ||
      normalized === "enabled"
    ) {
      return true;
    }

    if (
      normalized === "off" ||
      normalized === "false" ||
      normalized === "disable" ||
      normalized === "disabled"
    ) {
      return false;
    }
  }

  return null;
}

function getModeLabel(enabled) {
  return enabled ? "ON" : "OFF";
}

function printLine(line) {
  console.log(line);
  return line;
}

function printBlock(lines) {
  for (let i = 0; i < lines.length; i++) {
    console.log(lines[i]);
  }
}

function getRuntimeMemory() {
  if (!Memory.runtime) Memory.runtime = {};
  return Memory.runtime;
}

function getOpsConsoleMemory() {
  const runtime = getRuntimeMemory();
  if (!runtime.opsConsole) runtime.opsConsole = {};
  return runtime.opsConsole;
}

function buildToggleResult(label, enabled) {
  return {
    enabled: enabled,
    label: label,
  };
}

function getTargetRoomOrPrintError(roomName, commandLabel) {
  const room = resolveOwnedRoom(roomName);

  if (room) {
    return room;
  }

  if (roomName) {
    printLine(`[OPS] ${commandLabel}: owned room "${roomName}" not found.`);
    return null;
  }

  printLine(`[OPS] ${commandLabel}: no owned room available.`);
  return null;
}

function normalizeTickRateSampleTicks(sampleTicks) {
  if (typeof sampleTicks === "undefined") return 5;

  if (typeof sampleTicks === "string") {
    const trimmed = sampleTicks.trim();
    if (!trimmed) return null;
    sampleTicks = Number(trimmed);
  }

  if (
    typeof sampleTicks !== "number" ||
    !isFinite(sampleTicks) ||
    sampleTicks <= 0
  ) {
    return null;
  }

  return Math.floor(sampleTicks);
}

function formatTickRateSummary(sample) {
  if (!sample) return "[OPS] Tick rate: no completed sample recorded.";

  return (
    `[OPS] Tick rate: ${sample.avgMs.toFixed(2)} ms/tick over ${sample.ticks} ticks ` +
    `(ticks ${sample.startTick}-${sample.endTick}, reported at tick ${sample.reportedAtTick}).`
  );
}

function buildTickRateStatusLine() {
  const opsConsole = getOpsConsoleMemory();
  const probe = opsConsole.tickRateProbe;

  if (!probe) {
    if (opsConsole.lastTickRateSample) {
      return `${formatTickRateSummary(opsConsole.lastTickRateSample)} No active probe.`;
    }

    return "[OPS] Tick rate: no active probe.";
  }

  if (typeof probe.startTick === "number") {
    const remainingTicks = Math.max(
      0,
      probe.startTick + probe.sampleTicks - Game.time,
    );

    return (
      `[OPS] Tick rate running: ${probe.sampleTicks} ticks from tick ${probe.startTick}. ` +
      `${remainingTicks} ticks remaining.`
    );
  }

  return (
    `[OPS] Tick rate armed: sampling ${probe.sampleTicks} ticks starting at tick ${probe.armTick}.`
  );
}

function processTickRateProbe() {
  const opsConsole = getOpsConsoleMemory();
  const probe = opsConsole.tickRateProbe;

  if (!probe) return null;

  if (typeof probe.startTick !== "number") {
    if (Game.time < probe.armTick) return null;

    probe.startTick = Game.time;
    probe.startMs = Date.now();
    return null;
  }

  if (Game.time < probe.startTick + probe.sampleTicks) return null;

  const ticks = Math.max(1, Game.time - probe.startTick);
  const elapsedMs = Math.max(0, Date.now() - probe.startMs);
  const avgMs = elapsedMs / ticks;
  const sample = {
    avgMs: avgMs,
    elapsedMs: elapsedMs,
    endTick: Game.time,
    reportedAtTick: Game.time,
    sampleTicks: probe.sampleTicks,
    startTick: probe.startTick,
    ticks: ticks,
  };

  opsConsole.lastTickRateSample = sample;
  delete opsConsole.tickRateProbe;

  return printLine(formatTickRateSummary(sample));
}

function getConsoleCommandHelp() {
  return [
    {
      command: "view(on|off)",
      description: "Toggle HUD and critical reports together.",
      example: "view(on)",
    },
    {
      command: "ops.hud(on|off)",
      description: "Toggle the HUD overlay.",
      example: "ops.hud(on)",
    },
    {
      command: "ops.reports(on|off)",
      description: "Toggle critical room reports.",
      example: "ops.reports(off)",
    },
    {
      command: "ops.room([roomName], [section])",
      description:
        "Show one room report. Defaults to the current room and all sections.",
      example: 'ops.room("W5N5", "build")',
    },
    {
      command: "ops.rooms()",
      description: "Show overview lines for all owned rooms.",
      example: "ops.rooms()",
    },
    {
      command: "ops.empire()",
      description: "Show empire summary and owned-room overview.",
      example: "ops.empire()",
    },
    {
      command: "ops.log([roomName], [limit])",
      description: "Show compact invasion history. Defaults to newest 20 entries across all rooms.",
      example: 'ops.log("W43N6")',
    },
    {
      command: "ops.logClear([roomName])",
      description: "Clear invasion history for one room, or all rooms when omitted.",
      example: 'ops.logClear("W43N6")',
    },
    {
      command: "ops.tickRate([sampleTicks|status|cancel])",
      description:
        "Sample wall-clock ms per tick over a short window and auto-print the result.",
      example: "ops.tickRate(5)",
    },
    {
      command: "ops.expand(targetRoom, [parentRoom])",
      description: "Start or update a manual expansion plan.",
      example: 'ops.expand("W5N6", "W5N5")',
    },
    {
      command: "ops.reserve(targetRoom, [parentRoom])",
      description: "Start or update a reserved-room plan.",
      example: 'ops.reserve("W5N6", "W5N5")',
    },
    {
      command: "ops.reserved([parentRoom])",
      description: "Show active reserved rooms grouped by parent.",
      example: 'ops.reserved("W5N5")',
    },
    {
      command: "ops.expansions()",
      description: "Show active expansion plans.",
      example: "ops.expansions()",
    },
    {
      command: "ops.attack(targetRoom, [postAction], [parentRoom], [allies])",
      description: 'Start or update a manual attack plan. postAction defaults to "expand"; use "expand", "reserve", or "none".',
      example: 'ops.attack("W5N6", "expand", "W5N5", ["W4N6"])',
    },
    {
      command: "ops.attacks()",
      description: "Show active attack plans.",
      example: "ops.attacks()",
    },
    {
      command: "ops.cancelAttack(targetRoom)",
      description: "Cancel an active attack plan.",
      example: 'ops.cancelAttack("W5N6")',
    },
    {
      command: "ops.cancelExpansion(targetRoom)",
      description: "Cancel an active expansion plan.",
      example: 'ops.cancelExpansion("W5N6")',
    },
    {
      command: "ops.cancelReserve(targetRoom)",
      description: "Cancel an active reserved-room plan.",
      example: 'ops.cancelReserve("W5N6")',
    },
  ];
}

function wrapHelpLine(prefix, text, width) {
  const limit = width || 80;
  const words = String(text || "").split(/\s+/);
  const lines = [];
  let current = prefix;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (!word) continue;
    const next = current === prefix ? current + word : current + " " + word;
    if (next.length > limit && current !== prefix) {
      lines.push(current);
      current = "  " + word;
    } else {
      current = next;
    }
  }

  lines.push(current);
  return lines;
}

function formatHelpLines(rows) {
  const lines = ["[OPS] Available console commands"];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    lines.push(row.command);
    const descriptionLines = wrapHelpLine("  ", row.description, 80);
    for (let j = 0; j < descriptionLines.length; j++) {
      lines.push(descriptionLines[j]);
    }
    const exampleLines = wrapHelpLine("  ", row.example, 80);
    for (let k = 0; k < exampleLines.length; k++) {
      lines.push(exampleLines[k]);
    }
  }

  return lines;
}

function parseRoomCommandArgs(arg1, arg2) {
  const firstSection = roomReporting.normalizeSection(arg1);
  const secondSection = roomReporting.normalizeSection(arg2);

  if (typeof arg1 === "undefined" && typeof arg2 === "undefined") {
    return {
      roomName: null,
      section: "all",
    };
  }

  if (firstSection && typeof arg2 === "undefined") {
    return {
      roomName: null,
      section: firstSection,
    };
  }

  return {
    roomName: arg1 || null,
    section: secondSection || "all",
  };
}

module.exports = {
  registerGlobals() {
    processTickRateProbe();

    global.on = true;
    global.off = false;

    global.ops = {
      hud: function (mode) {
        return module.exports.hud(mode);
      },
      reports: function (mode) {
        return module.exports.reports(mode);
      },
      help: function () {
        return module.exports.help();
      },
      room: function (arg1, arg2) {
        return module.exports.room(arg1, arg2);
      },
      rooms: function () {
        return module.exports.rooms();
      },
      empire: function () {
        return module.exports.empire();
      },
      log: function (arg1, arg2) {
        return module.exports.log(arg1, arg2);
      },
      logClear: function (roomName) {
        return module.exports.logClear(roomName);
      },
      tickRate: function (sampleTicks) {
        return module.exports.tickRate(sampleTicks);
      },
      tickSpeed: function (sampleTicks) {
        return module.exports.tickRate(sampleTicks);
      },
      expand: function (targetRoom, parentRoom) {
        return module.exports.expand(targetRoom, parentRoom);
      },
      reserve: function (targetRoom, parentRoom) {
        return module.exports.reserve(targetRoom, parentRoom);
      },
      reserved: function (parentRoom) {
        return module.exports.reserved(parentRoom);
      },
      expansions: function () {
        return module.exports.expansions();
      },
      attack: function (targetRoom, postAction, parentRoom, allies) {
        return module.exports.attack(targetRoom, postAction, parentRoom, allies);
      },
      attacks: function () {
        return module.exports.attacks();
      },
      cancelAttack: function (targetRoom) {
        return module.exports.cancelAttack(targetRoom);
      },
      cancelExpansion: function (targetRoom) {
        return module.exports.cancelExpansion(targetRoom);
      },
      cancelReserve: function (targetRoom) {
        return module.exports.cancelReserve(targetRoom);
      },
      cpuStatus: function (roomName) {
        return module.exports.cpuStatus(roomName);
      },
      phase: function (roomName) {
        return module.exports.phase(roomName);
      },
    };

    global.view = function (mode) {
      return module.exports.view(mode);
    };
  },

  help() {
    const rows = getConsoleCommandHelp();
    const lines = formatHelpLines(rows);

    printBlock(lines);
    return rows;
  },

  hud(mode) {
    const currentEnabled = opsState.getHudEnabled();
    const nextEnabled = parseToggleMode(mode, currentEnabled);

    if (nextEnabled === null) {
      return printLine('[OPS] HUD: invalid mode. Use "on" or "off".');
    }

    opsState.setHudEnabled(nextEnabled);
    printLine(`[OPS] HUD ${getModeLabel(nextEnabled)}`);

    return buildToggleResult("hud", nextEnabled);
  },

  reports(mode) {
    const currentEnabled = opsState.getReportsEnabled();
    const nextEnabled = parseToggleMode(mode, currentEnabled);

    if (nextEnabled === null) {
      return printLine('[OPS] Reports: invalid mode. Use "on" or "off".');
    }

    opsState.setReportsEnabled(nextEnabled);
    printLine(`[OPS] Reports ${getModeLabel(nextEnabled)}`);

    return buildToggleResult("reports", nextEnabled);
  },

  room(arg1, arg2) {
    const parsed = parseRoomCommandArgs(arg1, arg2);
    const room = getTargetRoomOrPrintError(parsed.roomName, "room");
    if (!room) return null;
    opsState.setCurrentRoomName(room.name);

    const report = roomReporting.build(room, null, { updateProgress: true });
    const lines = roomReporting.getSectionLines(report, parsed.section);

    if (!lines) {
      return printLine(
        '[OPS] room: invalid section. Use overview, economy, build, defense, creeps, sources, advanced, cpu, or all.',
      );
    }

    printBlock(lines);

    return {
      room: room.name,
      section: parsed.section,
      nextTask: report.nextTask,
      lines: lines,
    };
  },

  rooms() {
    const ownedRooms = getOwnedRooms();
    if (ownedRooms.length === 0) {
      return printLine("[OPS] rooms: no owned rooms available.");
    }

    const reports = empireManager.buildRoomReports(ownedRooms, null, {
      updateProgress: true,
    });

    const lines = roomReporting.buildRoomsOverview(reports);
    printBlock(lines);

    return reports;
  },

  empire() {
    const ownedRooms = getOwnedRooms();
    if (ownedRooms.length === 0) {
      return printLine("[OPS] empire: no owned rooms available.");
    }

    const reports = empireManager.buildRoomReports(ownedRooms, null, {
      updateProgress: true,
    });
    const report = empireManager.buildReport(reports);

    printBlock(report.lines);

    return report;
  },

  log(arg1, arg2) {
    let roomName = null;
    let limit = 20;

    if (typeof arg1 === "number") {
      limit = arg1;
    } else if (typeof arg1 === "string") {
      const trimmed = arg1.trim();
      if (/^\d+$/.test(trimmed)) {
        limit = Number(trimmed);
      } else if (trimmed.length > 0) {
        roomName = trimmed;
      }
    }

    if (typeof arg2 === "number") {
      limit = arg2;
    } else if (typeof arg2 === "string" && /^\d+$/.test(arg2.trim())) {
      limit = Number(arg2.trim());
    }

    const lines = invasionLog.formatLines(roomName, limit, 85);
    printBlock(lines);
    return lines;
  },

  logClear(roomName) {
    const normalized =
      typeof roomName === "string" && roomName.trim().length > 0
        ? roomName.trim()
        : "all";
    const result = invasionLog.clear(normalized);
    printLine(
      `[OPS] Invasion log cleared rooms=${result.clearedRooms} entries=${result.clearedEntries}.`,
    );
    return result;
  },

  tickRate(sampleTicks) {
    if (typeof sampleTicks === "string") {
      const action = sampleTicks.trim().toLowerCase();
      const opsConsole = getOpsConsoleMemory();

      if (action === "status") {
        return printLine(buildTickRateStatusLine());
      }

      if (action === "cancel") {
        if (!opsConsole.tickRateProbe) {
          return printLine("[OPS] Tick rate: no active probe to cancel.");
        }

        delete opsConsole.tickRateProbe;
        return printLine("[OPS] Tick rate probe cancelled.");
      }
    }

    const resolvedSampleTicks = normalizeTickRateSampleTicks(sampleTicks);
    if (resolvedSampleTicks === null) {
      return printLine(
        '[OPS] tickRate: invalid sample. Use a positive integer, "status", or "cancel".',
      );
    }

    const opsConsole = getOpsConsoleMemory();
    opsConsole.tickRateProbe = {
      armTick: Game.time + 1,
      requestedAtTick: Game.time,
      sampleTicks: resolvedSampleTicks,
      startMs: null,
      startTick: null,
    };

    return printLine(
      `[OPS] Tick rate armed: sampling ${resolvedSampleTicks} ticks starting next tick.`,
    );
  },

  expand(targetRoom, parentRoom) {
    const resolvedParent = parentRoom || null;

    const reservation = reservationManager.getActiveReservation(targetRoom);
    const takeoverParent = resolvedParent || (reservation ? reservation.parentRoom : null);
    const result = empireManager.createExpansion(
      targetRoom,
      takeoverParent,
    );
    printLine(`[OPS] ${result.message}`);

    if (result.ok) {
      if (reservation) {
        reservationManager.convertReservationToExpansion(
          targetRoom,
          result.plan ? result.plan.parentRoom : takeoverParent,
        );
        printLine(`[OPS] Reserved room ${targetRoom} converted to expansion.`);
      }
      printBlock(empireManager.getExpansionLines());
    }

    return result;
  },

  reserve(targetRoom, parentRoom) {
    let resolvedParent = parentRoom || null;

    const expansion = empireManager.getActiveExpansion(targetRoom);
    if (!resolvedParent && expansion && expansion.parentRoom) {
      resolvedParent = expansion.parentRoom;
    }

    if (!resolvedParent) {
      const currentRoomName = opsState.getCurrentRoomName();
      const currentRoom = currentRoomName ? Game.rooms[currentRoomName] : null;

      if (!currentRoom || !currentRoom.controller || !currentRoom.controller.my) {
        const message =
          "reserve: parent room is required because no current owned room is selected.";
        printLine(`[OPS] ${message}`);
        return {
          ok: false,
          message: message,
        };
      }

      resolvedParent = currentRoom.name;
    }

    const result = reservationManager.createReservation(
      targetRoom,
      resolvedParent,
    );
    printLine(`[OPS] ${result.message}`);

    if (result.ok) {
      if (expansion) {
        empireManager.convertExpansionToReservation(
          targetRoom,
          result.plan ? result.plan.parentRoom : resolvedParent,
        );
        printLine(`[OPS] Expansion room ${targetRoom} converted to reservation.`);
      }
      printBlock(reservationManager.getReservedLines(resolvedParent));
    }

    return result;
  },

  reserved(parentRoom) {
    const lines = reservationManager.getReservedLines(parentRoom);
    printBlock(lines);
    return lines;
  },

  expansions() {
    const lines = empireManager.getExpansionLines();
    printBlock(lines);
    return lines;
  },

  attack(targetRoom, postActionOrOptions, parentRoom, allies) {
    let options = {};

    if (
      postActionOrOptions &&
      typeof postActionOrOptions === "object" &&
      !Array.isArray(postActionOrOptions)
    ) {
      options = {
        postAction: postActionOrOptions.postAction,
        parentRoom: postActionOrOptions.parentRoom,
        allies: postActionOrOptions.allies,
      };
    } else {
      const possiblePostAction = attackManager.normalizePostAction(postActionOrOptions);

      if (
        typeof postActionOrOptions !== "undefined" &&
        possiblePostAction === null &&
        (typeof parentRoom === "undefined" || Array.isArray(parentRoom))
      ) {
        options = {
          postAction: undefined,
          parentRoom: postActionOrOptions,
          allies: parentRoom,
        };
      } else {
        options = {
          postAction: postActionOrOptions,
          parentRoom: parentRoom,
          allies: allies,
        };
      }
    }

    const result = attackManager.createAttack(targetRoom, options);
    printLine(`[OPS] ${result.message}`);
    if (result.ok) {
      printBlock(attackManager.getAttacksLines());
    }
    return result;
  },

  attacks() {
    const lines = attackManager.getAttacksLines();
    printBlock(lines);
    return lines;
  },

  cancelAttack(targetRoom) {
    const result = attackManager.cancelAttack(targetRoom);
    printLine(`[OPS] ${result.message}`);
    return result;
  },

  cancelExpansion(targetRoom) {
    const result = empireManager.cancelExpansion(targetRoom);
    printLine(`[OPS] ${result.message}`);
    return result;
  },

  cancelReserve(targetRoom) {
    const result = reservationManager.cancelReservation(targetRoom);
    printLine(`[OPS] ${result.message}`);
    return result;
  },

  cpuStatus(roomName) {
    return this.room(roomName, "cpu");
  },

  phase(roomName) {
    return this.room(roomName, "build");
  },

  view(mode) {
    const currentEnabled = opsState.getViewEnabled();
    const nextEnabled = parseToggleMode(mode, currentEnabled);

    if (nextEnabled === null) {
      return printLine('[OPS] view: invalid mode. Use "on" or "off".');
    }

    if (nextEnabled) {
      this.hud(true);
      this.reports(true);
      this.room();
    } else {
      this.hud(false);
      this.reports(false);
    }

    return {
      enabled: nextEnabled,
      hud: opsState.getHudEnabled(),
      reports: opsState.getReportsEnabled(),
    };
  },
};
