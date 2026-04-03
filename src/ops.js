const opsState = require("ops_state");
const roomReporting = require("room_reporting");

function getOwnedRooms() {
  const ownedRooms = [];

  for (const roomName in Game.rooms) {
    if (!Object.prototype.hasOwnProperty.call(Game.rooms, roomName)) continue;

    const room = Game.rooms[roomName];
    if (!room.controller || !room.controller.my) continue;

    ownedRooms.push(room);
  }

  ownedRooms.sort(function (a, b) {
    return a.name.localeCompare(b.name);
  });

  return ownedRooms;
}

function resolveOwnedRoom(roomName) {
  if (roomName) {
    const room = Game.rooms[roomName];
    if (room && room.controller && room.controller.my) {
      return room;
    }

    return null;
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
        "Show room overview or one section: overview, economy, build, defense, creeps, sources, advanced, cpu, all.",
      example: 'ops.room("W5N5", "build")',
    },
    {
      command: "ops.rooms()",
      description: "Show overview lines for all owned rooms.",
      example: "ops.rooms()",
    },
  ];
}

function parseRoomCommandArgs(arg1, arg2) {
  const firstSection = roomReporting.normalizeSection(arg1);
  const secondSection = roomReporting.normalizeSection(arg2);

  if (firstSection && typeof arg2 === "undefined") {
    return {
      roomName: null,
      section: firstSection,
    };
  }

  return {
    roomName: arg1 || null,
    section: secondSection || "overview",
  };
}

module.exports = {
  registerGlobals() {
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
    const lines = ["[OPS] Available console commands"];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      lines.push(`${row.command} - ${row.description} Example: ${row.example}`);
    }

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

    const reports = [];

    for (let i = 0; i < ownedRooms.length; i++) {
      reports.push(
        roomReporting.build(ownedRooms[i], null, { updateProgress: true }),
      );
    }

    const lines = roomReporting.buildRoomsOverview(reports);
    printBlock(lines);

    return reports;
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
