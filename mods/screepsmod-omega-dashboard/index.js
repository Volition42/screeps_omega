const { requireFromServer } = require("./lib/server_require");

module.exports = function omegaDashboard(config) {
  requireFromServer("screepsmod-admin-utils/lib/common")(config);
  if (config.cli) {
    requireFromServer("screepsmod-admin-utils/lib/cli")(config);
  }
  if (config.engine) {
    requireFromServer("screepsmod-admin-utils/lib/engine")(config);
  }
  if (config.backend) {
    require("./lib/backend")(config);
  }
  requireFromServer("screepsmod-admin-utils/lib/services")(config);
};
