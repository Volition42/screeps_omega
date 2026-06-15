const VERSION = "0.0.1-layer0-source-integrated";

function printLine(line) {
  console.log(line);
  return line;
}

function printBlock(lines) {
  for (let i = 0; i < lines.length; i++) {
    console.log(lines[i]);
  }
}

function getMemoryRoot() {
  if (!Memory.consoleTools) Memory.consoleTools = {};
  if (!Memory.consoleTools.market) {
    Memory.consoleTools.market = {};
  }
  return Memory.consoleTools.market;
}

function touchMemory() {
  const memory = getMemoryRoot();

  if (!memory.installedAt) {
    memory.installedAt = Game.time;
  }

  memory.version = VERSION;
  memory.lastRegisteredAt = Game.time;
  memory.mode = "source-integrated";
  memory.commandRoot = "market.xxx";

  return memory;
}

function help() {
  const lines = [
    "[MARKET] Screeps Market Console Helper",
    `[MARKET] Version: ${VERSION}`,
    "",
    "[MARKET] Layer 0 commands:",
    "  market.help()",
    "  market.info()",
    "  market.ping()",
    "  market.install()",
    "  market.restore()",
    "  market.uninstall()",
    "",
    "[MARKET] Status:",
    "  Source-integrated skeleton only.",
    "  Market, room, stock, transfer, buy, and sell commands are not added yet.",
  ];

  printBlock(lines);
  return lines;
}

function info() {
  const memory = touchMemory();

  const lines = [
    "[MARKET] Helper info:",
    `  runtime object: ${global.market ? "loaded" : "missing"}`,
    "  memory object: exists",
    `  version: ${memory.version || "unknown"}`,
    `  mode: ${memory.mode || "unknown"}`,
    `  installedAt: ${memory.installedAt || "unknown"}`,
    `  lastRegisteredAt: ${memory.lastRegisteredAt || "unknown"}`,
    `  Game.time: ${Game.time}`,
    "  command root: market.xxx",
  ];

  printBlock(lines);
  return {
    runtimeLoaded: !!global.market,
    memory,
    lines,
  };
}

function ping() {
  return printLine(`[MARKET] pong at Game.time ${Game.time}`);
}

function install() {
  const memory = touchMemory();
  memory.installedAt = Game.time;
  memory.uninstalled = false;

  registerGlobals();

  return printLine("[MARKET] installed and registered as market.xxx");
}

function restore() {
  const memory = touchMemory();
  memory.uninstalled = false;

  registerGlobals();

  return printLine("[MARKET] restored as market.xxx");
}

function uninstall() {
  const memory = getMemoryRoot();
  memory.uninstalled = true;
  memory.uninstalledAt = Game.time;

  delete global.market;

  return printLine(
    "[MARKET] uninstalled from runtime. Source module remains available next upload.",
  );
}

function registerGlobals() {
  const memory = touchMemory();

  if (memory.uninstalled) {
    delete global.market;
    return null;
  }

  global.market = {
    version: VERSION,
    help,
    info,
    ping,
    install,
    restore,
    uninstall,
  };

  return global.market;
}

module.exports = {
  VERSION,
  registerGlobals,
  help,
  info,
  ping,
  install,
  restore,
  uninstall,
};
