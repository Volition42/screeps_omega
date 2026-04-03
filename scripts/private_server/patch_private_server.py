#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
from pathlib import Path


SERVER_ROOT = Path(
    os.environ.get(
        "SCREEPS_PRIVATE_SERVER_DIR",
        str(Path.home() / "screeps_private_server_ptr"),
    )
)
STEAM_ROOT = Path(
    os.environ.get(
        "SCREEPS_STEAM_INSTALL",
        str(Path.home() / ".steam/steam/steamapps/common/Screeps"),
    )
)
SERVER_PORT = int(os.environ.get("SCREEPS_SERVER_PORT", "21035"))
CLI_PORT = int(os.environ.get("SCREEPS_CLI_PORT", "21036"))
SERVER_HOST = os.environ.get("SCREEPS_SERVER_HOST", "0.0.0.0")
CLI_HOST = os.environ.get("SCREEPS_CLI_HOST", "localhost")
DEFAULT_CPU = int(os.environ.get("SCREEPS_TEST_CPU", "20"))


def copy_if_missing(src: Path, dst: Path) -> None:
    if dst.exists():
        return
    if not src.exists():
        return
    if src.is_dir():
        shutil.copytree(src, dst)
    else:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)


def patch_text(path: Path, before: str, after: str) -> None:
    text = path.read_text(encoding="utf8")
    if after in text:
        return
    if before not in text:
        return
    path.write_text(text.replace(before, after), encoding="utf8")


def write_server_config(server_root: Path) -> None:
    config = f"""; Local private-server config for screeps_omega dev testing
steam_api_key =
port = {SERVER_PORT}
host = {SERVER_HOST}
password =
cli_port = {CLI_PORT}
cli_host = {CLI_HOST}
runners_cnt = 1
runner_threads = 4
processors_cnt = 2
logdir = logs
modfile = mods.json
assetdir = assets
db = db.json
log_console = true
log_rotate_keep = 5
storage_disabled = false
restart_interval = 3600

[auth]
registerCpu = {DEFAULT_CPU}

[maptool]
user = admin
pass = admin
"""
    (server_root / ".screepsrc").write_text(config, encoding="utf8")


def write_mods_config(server_root: Path) -> None:
    mods = """{
  "mods": [
    "node_modules/screepsmod-auth",
    "node_modules/screepsmod-admin-utils",
    "node_modules/screepsmod-map-tool"
  ],
  "bots": {
    "simplebot": "node_modules/@screeps/simplebot/src"
  }
}
"""
    (server_root / "mods.json").write_text(mods, encoding="utf8")


def patch_greenworks(backend_root: Path) -> None:
    steam_backend_greenworks = (
        STEAM_ROOT
        / "server"
        / "package"
        / "node_modules"
        / "@screeps"
        / "backend"
        / "greenworks"
    )
    arm64_greenworks_root = (
        STEAM_ROOT
        / "nwjs.app"
        / "Contents"
        / "Frameworks"
        / "nwjs Framework.framework"
        / "Versions"
        / "126.0.6478.57"
        / "Helpers"
        / "nwjs Helper (Renderer).app"
        / "Contents"
        / "MacOS"
        / "greenworks"
    )

    if not steam_backend_greenworks.exists() or not arm64_greenworks_root.exists():
        return

    copy_if_missing(steam_backend_greenworks, backend_root / "greenworks")

    shutil.copy2(
        arm64_greenworks_root / "greenworks.node",
        backend_root / "greenworks" / "lib" / "greenworks-osxarm64.node",
    )
    shutil.copy2(
        arm64_greenworks_root / "libsteam_api.dylib",
        backend_root / "greenworks" / "lib" / "libsteam_api.dylib",
    )
    shutil.copy2(
        arm64_greenworks_root / "libsdkencryptedappticket.dylib",
        backend_root / "greenworks" / "lib" / "libsdkencryptedappticket.dylib",
    )

    patch_text(
        backend_root / "greenworks" / "greenworks.js",
        "if (process.arch == 'x64')\n    greenworks = require('./lib/greenworks-osx64');",
        "if (process.arch == 'x64')\n    greenworks = require('./lib/greenworks-osx64');\n  else if (process.arch == 'arm64')\n    greenworks = require('./lib/greenworks-osxarm64');",
    )


def main() -> int:
    init_dist = SERVER_ROOT / "node_modules" / "@screeps" / "launcher" / "init_dist"
    backend_root = SERVER_ROOT / "node_modules" / "@screeps" / "backend"

    if not init_dist.exists():
        raise SystemExit(f"server install not found at {SERVER_ROOT}")

    for name in ["assets", "db.json", "example-mods", "mods.example.json"]:
        copy_if_missing(init_dist / name, SERVER_ROOT / name)

    copy_if_missing(init_dist / "node_modules" / ".hooks", SERVER_ROOT / "node_modules" / ".hooks")
    copy_if_missing(
        init_dist / "node_modules" / "@screeps" / "simplebot",
        SERVER_ROOT / "node_modules" / "@screeps" / "simplebot",
    )

    write_server_config(SERVER_ROOT)
    write_mods_config(SERVER_ROOT)

    for rel in ["node_modules/.hooks/install", "node_modules/.hooks/uninstall"]:
        hook = SERVER_ROOT / rel
        if hook.exists():
            hook.chmod(hook.stat().st_mode | 0o111)

    patch_greenworks(backend_root)

    patch_text(
        backend_root / "lib" / "game" / "server.js",
        "const PROTOCOL = 14;\n",
        "const PROTOCOL = 14;\nconst localNoAuth = process.env.LOCAL_NOAUTH === '1';\n",
    )
    patch_text(
        backend_root / "lib" / "game" / "server.js",
        "    if (process.env.STEAM_KEY) {\n",
        "    if (localNoAuth) {\n        console.log(\"LOCAL_NOAUTH enabled, skipping Steam authentication\");\n        useNativeAuth = false;\n    }\n    else if (process.env.STEAM_KEY) {\n",
    )
    patch_text(
        backend_root / "lib" / "game" / "server.js",
        "    return (useNativeAuth ? q.when() : connectToSteam()).then(() => {\n",
        "    return ((useNativeAuth || localNoAuth) ? q.when() : connectToSteam()).then(() => {\n",
    )

    patch_text(
        backend_root / "lib" / "game" / "api" / "auth.js",
        "var useNativeAuth = false;\n",
        "var useNativeAuth = false;\nvar localNoAuth = process.env.LOCAL_NOAUTH === '1';\nvar localNoAuthToken = process.env.LOCAL_NOAUTH_TOKEN || 'local-dev-token';\nvar localNoAuthCpu = parseInt(process.env.LOCAL_NOAUTH_CPU || '20', 10);\n\nfunction findOrCreateLocalUser() {\n\n    var user;\n\n    return db.users.findOne({username: 'local-dev'})\n    .then(data => {\n        if(data) {\n            user = data;\n            var nextCpu = user.fixedCPU || user.cpu || localNoAuthCpu;\n            if(user.cpu === nextCpu) {\n                return user;\n            }\n            user.cpu = nextCpu;\n            return db.users.update({_id: user._id}, {$set: {cpu: nextCpu}})\n            .then(() => user);\n        }\n\n        user = {\n            username: 'local-dev',\n            cpu: localNoAuthCpu,\n            cpuAvailable: 0,\n            registeredDate: new Date(),\n            credits: 0,\n            gcl: 0,\n            active: 10000,\n            powerExperimentations: 30\n        };\n\n        return db.users.insert(user)\n        .then(result => {\n            user = result;\n            return db['users.code'].insert({\n                user: user._id,\n                modules: {main: ''},\n                branch: 'default',\n                activeWorld: true,\n                activeSim: true\n            });\n        })\n        .then(() => env.set('scrUserMemory:'+user._id, JSON.stringify({})))\n        .then(() => user);\n    });\n}\n",
    )
    patch_text(
        backend_root / "lib" / "game" / "api" / "auth.js",
        "    if(!useNativeAuth) {\n        steam = new steamApi();\n    }\n",
        "    if(!useNativeAuth && !localNoAuth) {\n        steam = new steamApi();\n    }\n",
    )
    patch_text(
        backend_root / "lib" / "game" / "api" / "auth.js",
        "function tokenAuth (request, response, next) {\n    passport.authenticate('token', {session: false}, function (err, user) {\n",
        "function tokenAuth (request, response, next) {\n    if(localNoAuth) {\n        var token = request.get('X-Token') || request.query.token;\n        if(token === localNoAuthToken) {\n            findOrCreateLocalUser()\n            .then(user => {\n                request.user = user;\n                response.set('X-Token', localNoAuthToken);\n                next();\n            })\n            .catch(next);\n            return;\n        }\n    }\n\n    passport.authenticate('token', {session: false}, function (err, user) {\n",
    )
    patch_text(
        backend_root / "lib" / "game" / "api" / "auth.js",
        "function tokenAuth (request, response, next) {\n    if(localNoAuth) {\n        var token = request.get('X-Token') || request.query.token;\n        if(token === localNoAuthToken) {\n            findOrCreateLocalUser()\n            .then(user => {\n                request.user = user;\n                response.set('X-Token', localNoAuthToken);\n                next();\n            })\n            .catch(next);\n            return;\n        }\n    }\n\n    passport.authenticate('token', {session: false}, function (err, user) {\n        if (err) {\n            return next(err);\n        }\n        if (!user) {\n            response.status(401).send({error: 'unauthorized'});\n            return;\n        }\n        request.user = user;\n        authlib.genToken(user._id).then((token) => {\n            response.set('X-Token', token);\n            next();\n        });\n    })(request, response, next);\n}\n",
        "function tokenAuth (request, response, next) {\n    var token = request.get('X-Token') || request.query.token || (request.body && request.body.token);\n    if (!token) {\n        response.status(401).send({error: 'unauthorized'});\n        return;\n    }\n\n    authlib.checkToken(token, true)\n    .then((user) => {\n        request.user = user;\n        response.set('X-Token', token);\n        next();\n    })\n    .catch((error) => {\n        if (error === false) {\n            response.status(401).send({error: 'unauthorized'});\n            return;\n        }\n        next(error);\n    });\n}\n",
    )
    patch_text(
        backend_root / "lib" / "game" / "api" / "auth.js",
        "router.post('/steam-ticket', jsonResponse(request => {\n\n    var doAuth;\n",
        "router.post('/steam-ticket', jsonResponse(request => {\n\n    if(localNoAuth) {\n        return findOrCreateLocalUser()\n        .then(user => {\n            var steamId = (user.steam && user.steam.id) || 'local-dev';\n            console.log(`Sign in: ${user.username} (${user._id}), IP=${request.ip}, steamid=${steamId}, LOCAL_NOAUTH`);\n            return {token: localNoAuthToken, steamid: steamId};\n        });\n    }\n\n    var doAuth;\n",
    )

    patch_text(
        backend_root / "lib" / "authlib.js",
        "    common = require('@screeps/common'),\n    env = common.storage.env;\n",
        "    common = require('@screeps/common'),\n    env = common.storage.env;\n\nvar localNoAuth = process.env.LOCAL_NOAUTH === '1';\nvar localNoAuthToken = process.env.LOCAL_NOAUTH_TOKEN || 'local-dev-token';\n",
    )
    patch_text(
        backend_root / "lib" / "authlib.js",
        "exports.checkToken = function (token, noConsume) {\n\n    var authKey = `auth_${token}`;\n",
        "exports.checkToken = function (token, noConsume) {\n\n    if (localNoAuth && token === localNoAuthToken) {\n        return common.storage.db.users.findOne({username: 'local-dev'})\n        .then((user) => {\n            if (!user) {\n                return q.reject(false);\n            }\n            env.set(env.keys.USER_ONLINE+user._id, Date.now());\n            return user;\n        });\n    }\n\n    var authKey = `auth_${token}`;\n",
    )
    patch_text(
        backend_root / "lib" / "authlib.js",
        "        if (!noConsume) {\n            env.ttl(authKey)\n            .then((ttl) => {\n                if (ttl > 100) {\n                    env.expire(authKey, 60);\n                }\n            });\n        }\n",
        "        if (!noConsume) {\n            env.expire(authKey, 60);\n        }\n",
    )
    patch_text(
        backend_root / "lib" / "game" / "socket" / "server.js",
        "var common = require('@screeps/common'),\n    config = common.configManager.config,\n    authlib = require('../../authlib'),\n",
        "var common = require('@screeps/common'),\n    config = common.configManager.config,\n    authlib = require('../../authlib'),\n    localNoAuth = process.env.LOCAL_NOAUTH === '1',\n    localNoAuthToken = process.env.LOCAL_NOAUTH_TOKEN || 'local-dev-token',\n",
    )
    patch_text(
        backend_root / "lib" / "game" / "socket" / "server.js",
        "            if (m = message.match(/^auth (.*)$/)) {\n\n                authlib.checkToken(m[1])\n                .then((_user) => {\n                    user = _user;\n                    env.set(env.keys.USER_ONLINE+user._id, Date.now());\n                    return authlib.genToken(user._id);\n                })\n                .then((token) => {\n                    conn.write('auth ok ' + token);\n                })\n                .catch(() => conn.write('auth failed'));\n            }\n",
        "            if (m = message.match(/^auth (.*)$/)) {\n\n                authlib.checkToken(m[1])\n                .then((_user) => {\n                    user = _user;\n                    env.set(env.keys.USER_ONLINE+user._id, Date.now());\n                    if (localNoAuth && m[1] === localNoAuthToken) {\n                        return localNoAuthToken;\n                    }\n                    return authlib.genToken(user._id);\n                })\n                .then((token) => {\n                    conn.write('auth ok ' + token);\n                })\n                .catch(() => conn.write('auth failed'));\n            }\n",
    )

    auth_mod_backend = SERVER_ROOT / "node_modules" / "screepsmod-auth" / "lib" / "backend.js"
    if auth_mod_backend.exists():
        patch_text(
            auth_mod_backend,
            "  router.post('/api/auth/signin', bodyParse, passport.authenticate(['local', 'basic']), (req, res) => {\n",
            "  router.post('/api/auth/signin', bodyParse, (req, res, next) => {\n    if (req.body && req.body.username && !req.body.email) {\n      req.body.email = req.body.username\n    }\n    next()\n  }, passport.authenticate(['local', 'basic']), (req, res) => {\n",
        )
        patch_text(
            auth_mod_backend,
            "const authroute = require('@screeps/backend/lib/game/api/auth')\n\nBasicStrategy.prototype._challenge = function () { return '' }\n",
            "const authroute = require('@screeps/backend/lib/game/api/auth')\n\nconst localNoAuth = process.env.LOCAL_NOAUTH === '1'\nconst localNoAuthToken = process.env.LOCAL_NOAUTH_TOKEN || 'local-dev-token'\n\nBasicStrategy.prototype._challenge = function () { return '' }\n",
        )
        patch_text(
            auth_mod_backend,
            "    authlib.genToken(req.user._id)\n      .then(token => {\n        req.headers['x-server-password'] = process.env.SERVER_PASSWORD || ''\n        res.json({ ok: 1, token })\n      })\n",
            "    Promise.resolve(localNoAuth && req.user && req.user.username === 'local-dev' ? localNoAuthToken : null)\n      .then(token => token || authlib.genToken(req.user._id))\n      .then(token => {\n        req.headers['x-server-password'] = process.env.SERVER_PASSWORD || ''\n        res.json({ ok: 1, token })\n      })\n",
        )
        patch_text(
            auth_mod_backend,
            "      authlib.genToken(req.user._id)\n        .then(token => {\n          req.headers['x-server-password'] = process.env.SERVER_PASSWORD || ''\n          req.headers['x-token'] = token\n          req.headers['x-username'] = token\n          next()\n        }).catch(() => next())\n",
            "      Promise.resolve(localNoAuth && req.user && req.user.username === 'local-dev' ? localNoAuthToken : null)\n        .then(token => token || authlib.genToken(req.user._id))\n        .then(token => {\n          req.headers['x-server-password'] = process.env.SERVER_PASSWORD || ''\n          req.headers['x-token'] = token\n          req.headers['x-username'] = token\n          next()\n        }).catch(() => next())\n",
        )

    auth_mod_cronjobs = SERVER_ROOT / "node_modules" / "screepsmod-auth" / "lib" / "cronjobs.js"
    if auth_mod_cronjobs.exists():
        patch_text(
            auth_mod_cronjobs,
            "function authUpdates (config) {\n  const { common: { storage: { db }}, auth: { screepsrc: { auth: { preventSpawning, registerCpu = 100} = {}} = {}}} = config\n  let tgt = new Date(Date.now() - 15000)\n  let newCpu = registerCpu;\n",
            "function authUpdates (config) {\n  const localNoAuth = process.env.LOCAL_NOAUTH === '1'\n  const localNoAuthCpu = parseInt(process.env.LOCAL_NOAUTH_CPU || '20', 10)\n  const { common: { storage: { db }}, auth: { screepsrc: { auth: { preventSpawning, registerCpu = localNoAuthCpu} = {}} = {}}} = config\n  let newCpu = localNoAuth ? localNoAuthCpu : registerCpu;\n",
        )
        patch_text(
            auth_mod_cronjobs,
            "  let tgt = new Date(Date.now() - 15000)\n  let newCpu = localNoAuth ? localNoAuthCpu : registerCpu;\n",
            "  let newCpu = localNoAuth ? localNoAuthCpu : registerCpu;\n",
        )
        patch_text(
            auth_mod_cronjobs,
            "  let tgt = new Date(Date.now() - 15000)\n  let newCpu = localNoAuth ? localNoAuthCpu : registerCpu;\n  if (typeof newCpu === 'string') newCpu = parseInt(newCpu, 10);\n",
            "  let newCpu = localNoAuth ? localNoAuthCpu : registerCpu;\n  if (typeof newCpu === 'string') newCpu = parseInt(newCpu, 10);\n",
        )
        patch_text(
            auth_mod_cronjobs,
            "  db.users.update({ $or: [{ registeredDate: { $gt: tgt }}, { authTouched: { $ne: true } }] }, { $set })\n",
            "  if (localNoAuth) {\n    return db.users.findOne({ username: 'local-dev' })\n      .then(user => {\n        if (!user) return null\n        let localSet = Object.assign({}, $set, { cpu: user.fixedCPU || user.cpu || newCpu })\n        return db.users.update({ _id: user._id }, { $set: localSet })\n      })\n  }\n  let tgt = new Date(Date.now() - 15000)\n  return db.users.update({ $or: [{ registeredDate: { $gt: tgt }}, { authTouched: { $ne: true } }] }, { $set })\n",
        )

    auth_mod_register = SERVER_ROOT / "node_modules" / "screepsmod-auth" / "lib" / "register.js"
    if auth_mod_register.exists():
        patch_text(
            auth_mod_register,
            "    let preventSpawning = config.auth.screepsrc.auth.preventSpawning\n    let body = req.body\n    let user = {\n",
            "    let preventSpawning = config.auth.screepsrc.auth.preventSpawning\n    let registerCpu = parseInt(process.env.LOCAL_NOAUTH_CPU || config.auth.screepsrc.auth.registerCpu || '100', 10)\n    let body = req.body\n    let user = {\n",
        )
        patch_text(
            auth_mod_register,
            "      cpu: config.auth.screepsrc.auth.registerCpu || 100,\n",
            "      cpu: registerCpu,\n",
        )

    patch_text(
        backend_root / "lib" / "game" / "server.js",
        "                            Use your <a href=\"http://store.steampowered.com/app/464350\">Steam game client</a> to connect.\n",
        "                            LOCAL_NOAUTH development mode may be enabled for this server. This browser page is only a status page; use the Screeps client or the repo helper scripts to interact with the world.\n",
    )

    print(f"patched {SERVER_ROOT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
