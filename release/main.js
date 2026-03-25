const loop = require("kernel_loop");
const ops = require("ops");

module.exports.loop = function () {
  try {
    ops.registerGlobals();
    loop.run();

    if (!Memory.runtime) Memory.runtime = {};
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
