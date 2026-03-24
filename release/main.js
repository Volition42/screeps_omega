const loop = require("kernel_loop");
const ops = require("ops");

module.exports.loop = function () {
  ops.registerGlobals();
  loop.run();
};
