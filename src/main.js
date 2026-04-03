const loop = require("kernel_loop");
const ops = require("ops");
const buildInfo = require("build_info");

module.exports.loop = function () {
  try {
    ops.registerGlobals();
    if (!Memory.runtime) Memory.runtime = {};

    if (Memory.runtime.lastBuildId !== buildInfo.buildId) {
      Memory.runtime.lastBuildId = buildInfo.buildId;
      Memory.runtime.lastBuildInfo = buildInfo;
      console.log(
        `[BUILD] id=${buildInfo.buildId} commit=${buildInfo.gitCommit} branch=${buildInfo.gitBranch} source=${buildInfo.source}`,
      );
    }

    loop.run();

    Memory.runtime.lastSuccessTick = Game.time;
    delete Memory.runtime.lastError;
  } catch (error) {
    if (!Memory.runtime) Memory.runtime = {};

    Memory.runtime.lastError = {
      tick: Game.time,
      message: error && error.message ? error.message : String(error),
      stack: error && error.stack ? error.stack : null,
    };

    console.log(
      `[MAIN ERROR] tick=${Game.time} ${
        error && error.stack ? error.stack : error
      }`,
    );
  }
};
