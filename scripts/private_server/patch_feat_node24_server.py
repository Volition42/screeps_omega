#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
from pathlib import Path


SERVER_ROOT = Path(
    os.environ.get("SCREEPS_PRIVATE_SERVER_DIR", "/Users/jaysheldon/screeps_private_server")
)
STEAM_ROOT = Path(
    os.environ.get(
        "SCREEPS_STEAM_INSTALL",
        "/Users/jaysheldon/Library/Application Support/Steam/steamapps/common/Screeps",
    )
)


def copy_if_missing(src: Path, dst: Path) -> None:
    if dst.exists():
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
        raise SystemExit(f"expected text not found in {path}")
    path.write_text(text.replace(before, after), encoding="utf8")


def main() -> int:
    init_dist = SERVER_ROOT / "node_modules" / "@screeps" / "launcher" / "init_dist"
    backend_root = SERVER_ROOT / "node_modules" / "@screeps" / "backend"

    if not init_dist.exists():
        raise SystemExit(f"server install not found at {SERVER_ROOT}")

    for name in ["assets", "db.json", "example-mods", "mods.json", "mods.example.json"]:
        copy_if_missing(init_dist / name, SERVER_ROOT / name)

    copy_if_missing(init_dist / "node_modules" / ".hooks", SERVER_ROOT / "node_modules" / ".hooks")
    copy_if_missing(
        init_dist / "node_modules" / "@screeps" / "simplebot",
        SERVER_ROOT / "node_modules" / "@screeps" / "simplebot",
    )

    config = """; Local private-server config for screeps_omega dev testing
steam_api_key =
port = 21025
host = 127.0.0.1
password =
cli_port = 21026
cli_host = localhost
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
"""
    (SERVER_ROOT / ".screepsrc").write_text(config, encoding="utf8")

    for rel in ["node_modules/.hooks/install", "node_modules/.hooks/uninstall"]:
        hook = SERVER_ROOT / rel
        if hook.exists():
            hook.chmod(hook.stat().st_mode | 0o111)

    steam_backend_greenworks = (
        STEAM_ROOT
        / "server"
        / "package"
        / "node_modules"
        / "@screeps"
        / "backend"
        / "greenworks"
    )
    copy_if_missing(steam_backend_greenworks, backend_root / "greenworks")

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
        "var useNativeAuth = false;\nvar localNoAuth = process.env.LOCAL_NOAUTH === '1';\nvar localNoAuthToken = process.env.LOCAL_NOAUTH_TOKEN || 'local-dev-token';\n\nfunction findOrCreateLocalUser() {\n\n    var user;\n\n    return db.users.findOne({username: 'local-dev'})\n    .then(data => {\n        if(data) {\n            user = data;\n            return user;\n        }\n\n        user = {\n            username: 'local-dev',\n            cpu: 100,\n            cpuAvailable: 0,\n            registeredDate: new Date(),\n            credits: 0,\n            gcl: 0,\n            active: 10000,\n            powerExperimentations: 30\n        };\n\n        return db.users.insert(user)\n        .then(result => {\n            user = result;\n            return db['users.code'].insert({\n                user: user._id,\n                modules: {main: ''},\n                branch: 'default',\n                activeWorld: true,\n                activeSim: true\n            });\n        })\n        .then(() => env.set('scrUserMemory:'+user._id, JSON.stringify({})))\n        .then(() => user);\n    });\n}\n",
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
    auth_mod_backend = SERVER_ROOT / "node_modules" / "screepsmod-auth" / "lib" / "backend.js"
    if auth_mod_backend.exists():
        patch_text(
            auth_mod_backend,
            "  router.post('/api/auth/signin', bodyParse, passport.authenticate(['local', 'basic']), (req, res) => {\n",
            "  router.post('/api/auth/signin', bodyParse, (req, res, next) => {\n    if (req.body && req.body.username && !req.body.email) {\n      req.body.email = req.body.username\n    }\n    next()\n  }, passport.authenticate(['local', 'basic']), (req, res) => {\n",
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
