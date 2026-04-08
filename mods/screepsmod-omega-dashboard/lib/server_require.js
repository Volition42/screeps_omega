const path = require("path");

function serverModulePath(modulePath) {
  return path.join(process.cwd(), "node_modules", modulePath);
}

function requireFromServer(modulePath) {
  return require(serverModulePath(modulePath));
}

module.exports = {
  requireFromServer,
  serverModulePath,
};
