import { execFile } from "child_process";
import { readFile } from "fs/promises";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const repoRoot = process.env.SCREEPS_OMEGA_REPO_ROOT;
const assetsRoot = path.join(repoRoot, "scripts/private_server");
const worldToolPath = process.env.SCREEPS_OMEGA_WORLD_TOOL || path.join(assetsRoot, "world_tool.py");
const uploadScriptPath = process.env.SCREEPS_OMEGA_UPLOAD_SCRIPT || path.join(assetsRoot, "upload_src.sh");
const resetScriptPath = process.env.SCREEPS_OMEGA_RESET_SCRIPT || path.join(assetsRoot, "reset_dev_world.sh");
const reseedScriptPath = process.env.SCREEPS_OMEGA_RESEED_SCRIPT || path.join(assetsRoot, "reseed_dev_room.sh");
const testRoom = process.env.SCREEPS_TEST_ROOM || "W5N5";

async function readJsonBody(context) {
  const chunks = [];
  for await (const chunk of context.req) {
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function extractStructuredOutput(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return null;
  }

  const attempts = [trimmed];
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    attempts.push(trimmed.slice(1, -1));
  }

  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (_error) {
      // fall through
    }
  }

  return null;
}

async function runCommand(command, args = [], extraEnv = {}) {
  try {
    const result = await execFileAsync(command, args, {
      cwd: repoRoot,
      env: { ...process.env, ...extraEnv },
      maxBuffer: 8 * 1024 * 1024,
    });
    return {
      ok: true,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
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

async function runWorldTool(args) {
  return runCommand("python3", [worldToolPath, ...args]);
}

function actionResponse(label, result, data = null) {
  return {
    ok: result.ok,
    label,
    stdout: result.stdout,
    stderr: result.stderr,
    data,
    error: result.ok ? null : result.stderr || `${label} failed`,
  };
}

export async function register({ koa }) {
  const htmlPath = path.join(assetsRoot, "browser_admin_panel.html");
  const cssPath = path.join(assetsRoot, "browser_admin_panel.css");
  const jsPath = path.join(assetsRoot, "browser_admin_panel.js");

  const html = await readFile(htmlPath, "utf8");
  const css = await readFile(cssPath, "utf8");
  const js = await readFile(jsPath, "utf8");

  koa.use(async (context, next) => {
    const wrappedAdminMatch = context.path.match(/^\/\((https?:\/\/[^)]+\/omega-admin\/?)\)\/?$/);
    if (wrappedAdminMatch) {
      context.status = 302;
      context.redirect("/omega-admin/");
      return;
    }

    if (context.path === "/omega-admin" || context.path === "/omega-admin/") {
      context.set("Cache-Control", "no-store");
      context.type = "text/html";
      context.body = html;
      return;
    }

    if (context.path === "/omega-admin/style.css") {
      context.set("Cache-Control", "no-store");
      context.type = "text/css";
      context.body = css;
      return;
    }

    if (context.path === "/omega-admin/app.js") {
      context.set("Cache-Control", "no-store");
      context.type = "text/javascript";
      context.body = js;
      return;
    }

    if (context.path === "/omega-admin/api/status") {
      context.set("Cache-Control", "no-store");
      const status = await runWorldTool(["status"]);
      const data = extractStructuredOutput(status.stdout) || {};
      context.type = "application/json";
      context.body = {
        ok: status.ok,
        stdout: status.stdout,
        stderr: status.stderr,
        data: {
          ...data,
          serverPublicUrl: process.env.SCREEPS_SERVER_PUBLIC_URL || process.env.SCREEPS_SERVER_URL || "",
          browserPublicUrl: process.env.SCREEPS_BROWSER_PUBLIC_URL || process.env.SCREEPS_BROWSER_URL || "",
          clientRouteUrl:
            process.env.SCREEPS_BROWSER_PUBLIC_URL && (process.env.SCREEPS_SERVER_PUBLIC_URL || process.env.SCREEPS_SERVER_URL)
              ? `${process.env.SCREEPS_BROWSER_PUBLIC_URL}/(${process.env.SCREEPS_SERVER_PUBLIC_URL || process.env.SCREEPS_SERVER_URL})/`
              : "/",
          clientOverviewUrl:
            process.env.SCREEPS_BROWSER_PUBLIC_URL && (process.env.SCREEPS_SERVER_PUBLIC_URL || process.env.SCREEPS_SERVER_URL)
              ? `${process.env.SCREEPS_BROWSER_PUBLIC_URL}/(${process.env.SCREEPS_SERVER_PUBLIC_URL || process.env.SCREEPS_SERVER_URL})/#!/overview`
              : "/",
          dashboardUrl:
            process.env.SCREEPS_SERVER_PUBLIC_URL || process.env.SCREEPS_SERVER_URL
              ? `${process.env.SCREEPS_SERVER_PUBLIC_URL || process.env.SCREEPS_SERVER_URL}/web/`
              : "/web/",
          maptoolUrl:
            process.env.SCREEPS_SERVER_PUBLIC_URL || process.env.SCREEPS_SERVER_URL
              ? `${process.env.SCREEPS_SERVER_PUBLIC_URL || process.env.SCREEPS_SERVER_URL}/maptool/`
              : "/maptool/",
          adminUrl: process.env.SCREEPS_BROWSER_PUBLIC_URL
            ? `${process.env.SCREEPS_BROWSER_PUBLIC_URL}/omega-admin/`
            : "/omega-admin/",
          testRoom,
        },
      };
      return;
    }

    if (!context.path.startsWith("/omega-admin/api/")) {
      await next();
      if ((context.path === "/" || context.path === "/index.html") && typeof context.body === "string") {
        const shortcut = `
<style>
.omega-admin-shortcut {
  position: fixed;
  right: 18px;
  bottom: 18px;
  z-index: 9999;
  padding: 11px 16px;
  border-radius: 999px;
  border: 1px solid #254f3f;
  background: #254f3f;
  color: #f7f2e8;
  font: 600 14px/1 "Avenir Next", "Segoe UI", sans-serif;
  text-decoration: none;
  box-shadow: 0 10px 24px rgba(25, 41, 34, 0.22);
}
</style>
<a class="omega-admin-shortcut" href="/omega-admin/">Omega Admin</a>
</body>`;
        context.body = context.body.replace("</body>", shortcut);
      }
      return;
    }

    const body = await readJsonBody(context);
    const room = (body.room || testRoom).trim();
    let result;
    let data = null;

    switch (context.path) {
      case "/omega-admin/api/pause":
        result = await runWorldTool(["pause"]);
        break;
      case "/omega-admin/api/resume":
        result = await runWorldTool(["resume"]);
        break;
      case "/omega-admin/api/set-tick": {
        const milliseconds = Number(body.milliseconds || 200);
        result = await runWorldTool(["set-tick-duration", `${milliseconds}`]);
        data = { milliseconds };
        break;
      }
      case "/omega-admin/api/set-cpu": {
        const cpu = Number(body.cpu || 20);
        result = await runWorldTool(["set-user-cpu", `${cpu}`]);
        data = { cpu };
        break;
      }
      case "/omega-admin/api/set-gcl": {
        const level = Number(body.level || 1);
        result = await runWorldTool(["set-user-gcl", `${level}`]);
        data = { level };
        break;
      }
      case "/omega-admin/api/set-pcl": {
        const level = Number(body.level || 0);
        result = await runWorldTool(["set-user-pcl", `${level}`]);
        data = { level };
        break;
      }
      case "/omega-admin/api/reseed-room":
        result = await runCommand("bash", [reseedScriptPath], { SCREEPS_TEST_ROOM: room });
        data = { room };
        break;
      case "/omega-admin/api/reset-world":
        result = await runCommand("bash", [resetScriptPath]);
        break;
      case "/omega-admin/api/complete-sites":
        result = await runWorldTool(["complete-owned-sites", "--room", room]);
        data = { room };
        break;
      case "/omega-admin/api/fill-energy": {
        const amount = Number(body.amount || 300000);
        result = await runWorldTool(["fill-room-energy", "--room", room, "--amount", `${amount}`]);
        data = { room, amount };
        break;
      }
      case "/omega-admin/api/set-rcl": {
        const level = Number(body.level || 1);
        result = await runWorldTool(["set-controller-level", "--room", room, "--level", `${level}`]);
        data = { room, level };
        break;
      }
      case "/omega-admin/api/spawn-invader": {
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
      case "/omega-admin/api/upload-code":
        result = await runCommand("bash", [uploadScriptPath]);
        break;
      default:
        context.status = 404;
        context.body = { ok: false, error: `unknown admin route: ${context.path}` };
        return;
    }

    context.status = result.ok ? 200 : 500;
    context.type = "application/json";
    context.body = actionResponse(context.path.replace("/omega-admin/api/", ""), result, data);
  });
}
