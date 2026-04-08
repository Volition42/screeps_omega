const { execFile } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const util = require("util");

const { requireFromServer, serverModulePath } = require("./server_require");

const express = requireFromServer("express");
const basicAuth = requireFromServer("basic-auth");
const authroute = requireFromServer("@screeps/backend/lib/game/api/auth");

const execFileAsync = util.promisify(execFile);
const readFile = util.promisify(fs.readFile);

const packageJson = require("../package.json");
const adminUtilsPackageJson = requireFromServer("screepsmod-admin-utils/package.json");
let lastHostCpuSample = null;

module.exports = function registerOmegaDashboard(config) {
  config.backend.features = config.backend.features || [];
  config.backend.features.push(
    {
      name: "screepsmod-admin-utils",
      version: adminUtilsPackageJson.version,
    },
    {
      name: "screepsmod-omega-dashboard",
      version: packageJson.version,
    },
  );

  config.backend.on("expressPreConfig", (app) => {
    const {
      common: {
        storage: { env, db, pubsub },
      },
    } = config;

    env.get(env.keys.TICK_RATE).then(async (val) => {
      if (!val) return;
      env.del(env.keys.TICK_RATE);
      await env.set(env.keys.MAIN_LOOP_MIN_DURATION, val);
      pubsub.publish("setTickRate", val);
    });

    config.common.storage.pubsub.subscribe("setSocketUpdateRate", setSocketUpdateRate);
    config.common.storage.pubsub.subscribe("setConstants", (constants) => {
      for (const [key, value] of Object.entries(JSON.parse(constants))) {
        config.common.constants[key] = value;
      }
    });
    config.common.storage.pubsub.subscribe("tickTiming", (timing) => {
      config.utils.tickTiming = [JSON.parse(timing), ...config.utils.tickTiming.slice(0, 99)];
    });

    app.get("/", (_req, res) => res.redirect("/web"));
    registerApiRoutes(app, db, env);
    registerDashboardRoutes(app);
  });

  function setSocketUpdateRate(value) {
    value = parseInt(value, 10);
    const { env } = config.common.storage;
    if (typeof value === "number" && !Number.isNaN(value)) {
      config.backend.socketUpdateThrottle = value || 200;
      env.set(env.keys.SOCKET_UPDATE_RATE, value);
      console.log(`Socket Update Rate set to ${value}ms`);
      return;
    }
    setSocketUpdateRate(200);
  }

  function registerDashboardRoutes(app) {
    const uiDist = path.join(__dirname, "..", "ui", "dist");
    const omegaAdminRoot = path.join(__dirname, "..", "admin");
    const mapToolPublicRoot = serverModulePath("screepsmod-map-tool/public");

    app.get(/^\/omega-admin$/, (_req, res) => {
      res.redirect(302, "/omega-admin/");
    });
    app.get(/^\/omega-admin\/$/, (_req, res) => {
      res.set("Cache-Control", "no-store");
      res.sendFile(path.join(omegaAdminRoot, "index.html"));
    });
    app.get("/omega-admin/style.css", (_req, res) => {
      res.set("Cache-Control", "no-store");
      res.sendFile(path.join(omegaAdminRoot, "style.css"));
    });
    app.get("/omega-admin/app.js", (_req, res) => {
      res.set("Cache-Control", "no-store");
      res.type("application/javascript");
      res.sendFile(path.join(omegaAdminRoot, "app.js"));
    });
    app.get("/omega-admin/maptool-bridge.js", (_req, res) => {
      res.set("Cache-Control", "no-store");
      res.type("application/javascript");
      res.sendFile(path.join(omegaAdminRoot, "maptool_bridge.js"));
    });

    app.get(["/web/omega-admin", "/web/omega-admin/"], (_req, res) => {
      res.redirect(302, "/omega-admin/");
    });
    app.get("/web/omega-admin/:asset", (req, res) => {
      res.redirect(302, `/omega-admin/${req.params.asset}`);
    });

    app.get(
      ["/maptool", "/maptool/", "/maptool/index.html"],
      createMapToolAuthMiddleware(config),
      async (_req, res, next) => {
        try {
          const html = await readFile(path.join(mapToolPublicRoot, "index.html"), "utf8");
          res.set("Cache-Control", "no-store");
          res.send(injectMapToolBridge(html));
        } catch (error) {
          next(error);
        }
      },
    );

    app.use("/web", express.static(uiDist));
    app.get("/web/*", (_req, res) => {
      res.sendFile(path.join(uiDist, "index.html"));
    });
  }

  function registerApiRoutes(app, db, env) {
    app.get("/api/mods", async (_req, res) => {
      const { mods = [] } = JSON.parse(await readFile("mods.json")) || {};
      const installedMods = [];
      for (const mod of mods) {
        const match = mod.match(/screepsmod-[\w-]+/);
        if (match && match[0]) {
          installedMods.push(match[0]);
        }
      }
      res.json(installedMods);
    });

    app.get(
      "/api/version",
      config.utils.errCatch(async (_req, res) => {
        const users = await db.users.count({
          $and: [{ active: { $ne: 0 } }, { cpu: { $gt: 0 } }, { bot: { $aeq: null } }],
        });
        const {
          welcomeText,
          customObjectTypes,
          historyChunkSize,
          socketUpdateThrottle,
          renderer,
          features = [],
          additionalServerData = {},
        } = config.backend;
        const shards = [await env.get(env.keys.SHARD_NAME)];
        const useNativeAuth = !process.env.STEAM_KEY;

        res.json({
          ok: 1,
          protocol: 14,
          useNativeAuth,
          users,
          serverData: {
            shards,
            welcomeText,
            customObjectTypes,
            historyChunkSize,
            socketUpdateThrottle,
            renderer,
            features,
            ...additionalServerData,
          },
        });
      }),
    );

    app.get(
      "/api/game/room-objects",
      config.utils.errCatch(async (req, res) => {
        const { room } = req.query;
        const objects = await db["rooms.objects"].find({ room });
        const userIds = new Set(objects.map((object) => object.user).filter(Boolean));
        userIds.add("2");
        userIds.add("3");
        const users = await db.users.find(
          { _id: { $in: Array.from(userIds) } },
          { username: 1, badge: 1 },
        );
        const usersById = {};
        for (const user of users) {
          usersById[user._id] = user;
        }
        res.json({ objects, users: usersById });
      }),
    );

    app.get(
      "/api/game/shards/info",
      config.utils.errCatch(async (_req, res) => {
        const lastTicks = JSON.parse((await env.get(env.keys.LAST_TICKS)) || "[]").slice(0, 30);
        const shard = {
          cpuLimit: 0,
          lastTicks,
          name: await env.get(env.keys.SHARD_NAME),
          rooms: await db.rooms.count(),
          tick: lastTicks.reduce((sum, value) => sum + value, 0) / (lastTicks.length || 1),
        };
        res.json({ ok: 1, shards: [shard] });
      }),
    );

    app.get(
      "/api/user/world-start-room",
      authroute.tokenAuth,
      config.utils.errCatch(async (req, res) => {
        const controllers = await db["rooms.objects"].find({
          $and: [{ user: String(req.user._id) }, { type: "controller" }],
        });

        let room = "";
        if (controllers.length) {
          room = controllers[Math.floor(Math.random() * controllers.length)].room;
        }
        if (!room) {
          const rooms = await db.rooms.find({ _id: { $regex: "^[EW]\\d*5[NS]\\d*5$" } });
          if (rooms.length) {
            room = rooms[Math.floor(Math.random() * rooms.length)]._id;
          }
        }
        if (!room) {
          room = "W5N5";
        }
        res.json({ ok: 1, room: [room] });
      }),
    );

    app.get(
      "/api/experimental/pvp",
      config.utils.errCatch(async (req, res) => {
        const start = parseInt(req.query.start, 10);
        const interval = Math.min(Math.max(parseInt(req.query.interval, 10), 1), 10000) || 1000;
        const time = parseInt(await env.get(env.keys.GAMETIME), 10);
        const rooms = await db.rooms.find(
          { lastPvpTime: { $gte: (start || time) - interval } },
          { lastPvpTime: true },
        );
        const shard = await env.get(env.keys.SHARD_NAME);
        res.send({ ok: 1, time, pvp: { [shard]: { rooms } } });
      }),
    );

    app.get(
      "/api/experimental/nukes",
      config.utils.errCatch(async (_req, res) => {
        const nukes = await db["rooms.objects"].find({ type: "nuke" });
        const shard = await env.get(env.keys.SHARD_NAME);
        res.send({ ok: 1, nukes: { [shard]: nukes } });
      }),
    );

    app.get(["/omega-admin/api/status", "/web/omega-admin/api/status"], async (req, res) => {
      const result = await runWorldTool(["status"]);
      const parsed = extractStructuredOutput(result.stdout) || {};
      const hostCpu = sampleHostCpuUsage();
      const serverPublicUrl = getServerPublicUrl(req);
      const browserPublicUrl = getBrowserPublicUrl();

      res.set("Cache-Control", "no-store");
      res.json({
        ok: result.ok,
        stdout: result.stdout,
        stderr: result.stderr,
        data: {
          ...parsed,
          serverPublicUrl,
          browserPublicUrl,
          clientRouteUrl:
            browserPublicUrl && serverPublicUrl
              ? `${browserPublicUrl}/(${serverPublicUrl})/`
              : "/",
          clientOverviewUrl:
            browserPublicUrl && serverPublicUrl
              ? `${browserPublicUrl}/(${serverPublicUrl})/#!/overview`
              : "/",
          dashboardUrl: joinUrl(serverPublicUrl, "/web/"),
          maptoolUrl: joinUrl(serverPublicUrl, "/maptool/"),
          adminUrl: joinUrl(serverPublicUrl, "/omega-admin/"),
          hostCpu,
          testRoom: process.env.SCREEPS_TEST_ROOM || "W5N5",
        },
      });
    });

    app.post(["/omega-admin/api/:action", "/web/omega-admin/api/:action"], async (req, res) => {
      const body = await readJsonBody(req);
      const room = String(body.room || process.env.SCREEPS_TEST_ROOM || "W5N5").trim();
      let result;
      let data = null;

      switch (req.params.action) {
        case "pause":
          result = await runWorldTool(["pause"]);
          break;
        case "resume":
          result = await runWorldTool(["resume"]);
          break;
        case "set-tick": {
          const milliseconds = Number(body.milliseconds || 200);
          result = await runWorldTool(["set-tick-duration", `${milliseconds}`]);
          data = { milliseconds };
          break;
        }
        case "set-cpu": {
          const cpu = Number(body.cpu || 20);
          result = await runWorldTool(["set-user-cpu", `${cpu}`]);
          data = { cpu };
          break;
        }
        case "set-gcl": {
          const level = Number(body.level || 1);
          result = await runWorldTool(["set-user-gcl", `${level}`]);
          data = { level };
          break;
        }
        case "set-pcl": {
          const level = Number(body.level || 0);
          result = await runWorldTool(["set-user-pcl", `${level}`]);
          data = { level };
          break;
        }
        case "reseed-room":
          result = await runScript(process.env.SCREEPS_OMEGA_RESEED_SCRIPT, {
            SCREEPS_TEST_ROOM: room,
          });
          data = { room };
          break;
        case "reset-world":
          result = await runScript(process.env.SCREEPS_OMEGA_RESET_SCRIPT);
          break;
        case "complete-sites":
          result = await runWorldTool(["complete-owned-sites", "--room", room]);
          data = { room };
          break;
        case "fill-energy": {
          const amount = Number(body.amount || 300000);
          result = await runWorldTool([
            "fill-room-energy",
            "--room",
            room,
            "--amount",
            `${amount}`,
          ]);
          data = { room, amount };
          break;
        }
        case "set-rcl": {
          const level = Number(body.level || 1);
          result = await runWorldTool(["set-controller-level", "--room", room, "--level", `${level}`]);
          data = { room, level };
          break;
        }
        case "spawn-invader": {
          const type = body.type || "Melee";
          const size = body.size || "small";
          result = await runWorldTool([
            "create-invader",
            "--room",
            room,
            "--type",
            type,
            "--size",
            size,
          ]);
          data = { room, type, size };
          break;
        }
        case "upload-code":
          result = await runScript(process.env.SCREEPS_OMEGA_UPLOAD_SCRIPT);
          break;
        default:
          res.status(404).json({ ok: false, error: `unknown action ${req.params.action}` });
          return;
      }

      res.json(actionResponse(req.params.action, result, data));
    });
  }
};

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch (_error) {
    return {};
  }
}

async function runWorldTool(args) {
  return runCommand("python3", [process.env.SCREEPS_OMEGA_WORLD_TOOL].concat(args || []), {});
}

async function runScript(scriptPath, extraEnv) {
  return runCommand("bash", [scriptPath], extraEnv || {});
}

async function runCommand(command, args, extraEnv) {
  try {
    const result = await execFileAsync(command, args || [], {
      cwd: process.env.SCREEPS_OMEGA_REPO_ROOT,
      env: Object.assign({}, process.env, extraEnv || {}),
      maxBuffer: 8 * 1024 * 1024,
    });
    return {
      ok: true,
      stdout: (result.stdout || "").trim(),
      stderr: (result.stderr || "").trim(),
    };
  } catch (error) {
    return {
      ok: false,
      stdout: (error.stdout || "").trim(),
      stderr: (error.stderr || "").trim() || error.message,
      code: typeof error.code === "number" ? error.code : 1,
    };
  }
}

function extractStructuredOutput(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  const attempts = [trimmed];
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    attempts.push(trimmed.slice(1, -1));
  }

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (_error) {
      // Ignore parse failures and fall through.
    }
  }

  return null;
}

function actionResponse(action, result, data) {
  return Object.assign(
    {
      ok: !!result.ok,
      action,
      stdout: result.stdout || "",
      stderr: result.stderr || "",
    },
    data ? { data } : {},
  );
}

function sampleHostCpuUsage() {
  const cpus = os.cpus() || [];
  if (!cpus.length) {
    return {
      percent: null,
      cores: 0,
      model: "",
      sampleWindowMs: 0,
    };
  }

  const totals = cpus.reduce(
    (accumulator, cpu) => {
      const times = cpu.times || {};
      accumulator.user += times.user || 0;
      accumulator.nice += times.nice || 0;
      accumulator.sys += times.sys || 0;
      accumulator.idle += times.idle || 0;
      accumulator.irq += times.irq || 0;
      return accumulator;
    },
    { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 },
  );

  const currentSample = {
    takenAt: Date.now(),
    idle: totals.idle,
    total: totals.user + totals.nice + totals.sys + totals.idle + totals.irq,
  };

  let percent = null;
  let sampleWindowMs = 0;

  if (lastHostCpuSample) {
    const deltaTotal = currentSample.total - lastHostCpuSample.total;
    const deltaIdle = currentSample.idle - lastHostCpuSample.idle;
    sampleWindowMs = Math.max(0, currentSample.takenAt - lastHostCpuSample.takenAt);

    if (deltaTotal > 0) {
      const busyRatio = 1 - deltaIdle / deltaTotal;
      percent = Math.max(0, Math.min(100, busyRatio * 100));
    }
  }

  lastHostCpuSample = currentSample;

  return {
    percent,
    cores: cpus.length,
    model: cpus[0].model || "",
    sampleWindowMs,
  };
}

function getServerPublicUrl(req) {
  return normalizeBaseUrl(
    process.env.SCREEPS_SERVER_PUBLIC_URL ||
      process.env.SCREEPS_SERVER_URL ||
      requestOrigin(req),
  );
}

function getBrowserPublicUrl() {
  return normalizeBaseUrl(process.env.SCREEPS_BROWSER_PUBLIC_URL || process.env.SCREEPS_BROWSER_URL || "");
}

function requestOrigin(req) {
  if (!req) return "";
  const host = req.get("x-forwarded-host") || req.get("host");
  if (!host) return "";
  const protocol = req.get("x-forwarded-proto") || req.protocol || "http";
  return `${protocol}://${host}`;
}

function normalizeBaseUrl(value) {
  return String(value || "").replace(/\/+$/, "");
}

function joinUrl(base, pathname) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

function createMapToolAuthMiddleware(config) {
  return (req, res, next) => {
    const credentials = basicAuth(req);
    const mapToolConfig = config && config.maptool && config.maptool.config ? config.maptool.config : null;

    if (
      mapToolConfig &&
      credentials &&
      credentials.name === mapToolConfig.user &&
      credentials.pass === mapToolConfig.pass
    ) {
      next();
      return;
    }

    res.statusCode = 401;
    res.setHeader("WWW-Authenticate", 'Basic realm="Map Tool"');
    res.end("Unauthorized");
  };
}

function injectMapToolBridge(html) {
  if (!html || html.includes("omega-admin-maptool-bridge.js")) {
    return html;
  }

  return html.replace(
    "</body>",
    '  <script id="omega-admin-maptool-bridge.js" src="/omega-admin/maptool-bridge.js"></script>\n</body>',
  );
}
