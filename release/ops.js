const config = require("config");
const directiveManager = require("directive_manager");
const opsState = require("ops_state");
const statsManager = require("stats_manager");

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

function buildToggleResult(label, enabled) {
  return {
    enabled: enabled,
    label: label,
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
      nextRCL: function (roomName) {
        return module.exports.nextRCL(roomName);
      },
      cpuStatus: function (roomName) {
        return module.exports.cpuStatus(roomName);
      },
    };

    global.view = function (mode) {
      return module.exports.view(mode);
    };
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

  nextRCL(roomName) {
    const room = getTargetRoomOrPrintError(roomName, "nextRCL");
    if (!room) return null;

    if (!room.controller || !room.controller.my) {
      printLine(`[OPS] nextRCL: room ${room.name} is not owned.`);
      return null;
    }

    if (!room.controller.progressTotal || room.controller.level >= 8) {
      printBlock([
        `[OPS] [Growth] [Room:${room.name}]`,
        `RCL ${room.controller.level} is already at the current maximum.`,
      ]);
      return {
        room: room.name,
        rcl: room.controller.level,
        eta: null,
        rate: 0,
      };
    }

    const roomMemory = directiveManager.getRoomMemory(room);
    const progress = directiveManager.updateProgressTracker(room, roomMemory);
    const pct = Math.round(
      (room.controller.progress / room.controller.progressTotal) * 100,
    );

    const lines = [
      `[OPS] [Growth] [Room:${room.name}]`,
      `RCL ${room.controller.level} -> ${room.controller.level + 1}: ${pct}% (${room.controller.progress}/${room.controller.progressTotal})`,
    ];

    if (!progress || progress.rate <= 0) {
      lines.push("Avg upgrade speed: 0.00 progress/tick");
      lines.push("ETA: undetermined");
      printBlock(lines);

      return {
        room: room.name,
        rcl: room.controller.level,
        progress: room.controller.progress,
        progressTotal: room.controller.progressTotal,
        rate: 0,
        eta: null,
      };
    }

    const eta = directiveManager.formatTicksAsDhM(progress.etaTicks);
    lines.push(`Avg upgrade speed: ${progress.rate.toFixed(2)} progress/tick`);
    lines.push(`ETA: ${eta}`);
    printBlock(lines);

    return {
      room: room.name,
      rcl: room.controller.level,
      progress: room.controller.progress,
      progressTotal: room.controller.progressTotal,
      rate: progress.rate,
      eta: eta,
      etaTicks: progress.etaTicks,
    };
  },

  cpuStatus(roomName) {
    const room = getTargetRoomOrPrintError(roomName, "cpuStatus");
    if (!room) return null;

    if (!Memory.stats || !Memory.stats.last) {
      printLine(`[OPS] cpuStatus: CPU stats are not available yet for ${room.name}.`);
      return null;
    }

    const last = Memory.stats.last;
    const averages = Memory.stats.averages || {};
    const runtime = Memory.stats.runtime || statsManager.getRuntimeMode();
    const policy =
      config.STATS && config.STATS.RUNTIME_POLICY
        ? config.STATS.RUNTIME_POLICY
        : {};

    const lines = [
      `[OPS] [CPU] [Room:${room.name}]`,
      `Current ${last.cpu.used.toFixed(2)}/${last.cpu.limit} | Avg ${Number(averages.cpuUsed || last.cpu.used).toFixed(2)} | Bucket ${last.cpu.bucket} | Pressure ${runtime.pressure.toUpperCase()}`,
      `Shedding think x${runtime.thinkIntervalMultiplier} | build x${runtime.constructionIntervalMultiplier} | skipDirectives ${runtime.skipDirectives ? "yes" : "no"} | skipHud ${runtime.skipHud ? "yes" : "no"}`,
      `Policy skipDirectivesAt=${policy.SKIP_DIRECTIVES_AT || "never"} | skipHudAt=${policy.SKIP_HUD_AT || "never"} | forceOverview ${runtime.forceOverview ? "yes" : "no"}`,
    ];

    printBlock(lines);

    return {
      room: room.name,
      current: last.cpu.used,
      average: averages.cpuUsed || last.cpu.used,
      bucket: last.cpu.bucket,
      pressure: runtime.pressure,
      thinkIntervalMultiplier: runtime.thinkIntervalMultiplier,
      constructionIntervalMultiplier: runtime.constructionIntervalMultiplier,
      skipDirectives: runtime.skipDirectives,
      skipHud: runtime.skipHud,
      forceOverview: runtime.forceOverview,
    };
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
      this.nextRCL();
      this.cpuStatus();
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
