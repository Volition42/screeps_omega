#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.request
from collections import deque
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SERVER_ROOT = Path(
    os.environ.get("SCREEPS_PRIVATE_SERVER_DIR", "/Users/jaysheldon/screeps_private_server_ptr")
)
DEFAULT_SERVER_URL = os.environ.get("SCREEPS_SERVER_URL", "http://127.0.0.1:21035")
DEFAULT_TOKEN = os.environ.get("SCREEPS_LOCAL_TOKEN", "screeps-omega-dev-token")
DEFAULT_CLI_HOST = os.environ.get("SCREEPS_CLI_HOST", "localhost")
DEFAULT_CLI_PORT = int(os.environ.get("SCREEPS_CLI_PORT", "21036"))
GCL_MULTIPLY = 1_000_000
GCL_POW = 2.4
POWER_LEVEL_MULTIPLY = 1_000
POWER_LEVEL_POW = 2

CONTROLLER_LEVELS = {
    1: 200,
    2: 45000,
    3: 135000,
    4: 405000,
    5: 1215000,
    6: 3645000,
    7: 10935000,
}

CONTROLLER_DOWNGRADE = {
    1: 20000,
    2: 10000,
    3: 20000,
    4: 40000,
    5: 80000,
    6: 120000,
    7: 150000,
    8: 200000,
}

STRUCTURE_DEFAULTS = {
    "spawn": {
        "notifyWhenAttacked": True,
        "store": {"energy": 0},
        "storeCapacityResource": {"energy": 300},
        "hits": 5000,
        "hitsMax": 5000,
    },
    "extension": {
        "notifyWhenAttacked": True,
        "store": {"energy": 0},
        "storeCapacityResource": {"energy": 0},
        "hits": 1000,
        "hitsMax": 1000,
    },
    "road": {
        "notifyWhenAttacked": True,
        "hits": 5000,
        "hitsMax": 5000,
        "nextDecayTime": "__GAME_TIME_PLUS__:1000",
    },
    "constructedWall": {
        "notifyWhenAttacked": True,
        "hits": 1,
        "hitsMax": 300000000,
    },
    "rampart": {
        "notifyWhenAttacked": True,
        "hits": 1,
        "hitsMax": 300000,
        "nextDecayTime": "__GAME_TIME_PLUS__:100",
    },
    "container": {
        "notifyWhenAttacked": True,
        "store": {"energy": 0},
        "storeCapacity": 2000,
        "hits": 250000,
        "hitsMax": 250000,
        "nextDecayTime": "__GAME_TIME_PLUS__:100",
    },
    "tower": {
        "notifyWhenAttacked": True,
        "store": {"energy": 0},
        "storeCapacityResource": {"energy": 1000},
        "hits": 3000,
        "hitsMax": 3000,
    },
    "storage": {
        "notifyWhenAttacked": True,
        "store": {"energy": 0},
        "storeCapacity": 1000000,
        "hits": 10000,
        "hitsMax": 10000,
    },
    "link": {
        "notifyWhenAttacked": True,
        "store": {"energy": 0},
        "storeCapacityResource": {"energy": 800},
        "cooldown": 0,
        "hits": 1000,
        "hitsMax": 1000,
    },
    "terminal": {
        "notifyWhenAttacked": True,
        "store": {"energy": 0},
        "storeCapacity": 300000,
        "hits": 3000,
        "hitsMax": 3000,
    },
    "extractor": {
        "notifyWhenAttacked": True,
        "hits": 500,
        "hitsMax": 500,
    },
    "lab": {
        "notifyWhenAttacked": True,
        "hits": 500,
        "hitsMax": 500,
        "mineralAmount": 0,
        "cooldown": 0,
        "store": {"energy": 0},
        "storeCapacity": 5000,
        "storeCapacityResource": {"energy": 2000},
    },
    "factory": {
        "notifyWhenAttacked": True,
        "store": {"energy": 0},
        "storeCapacity": 50000,
        "hits": 1000,
        "hitsMax": 1000,
        "cooldown": 0,
    },
    "observer": {
        "notifyWhenAttacked": True,
        "hits": 500,
        "hitsMax": 500,
    },
    "powerSpawn": {
        "notifyWhenAttacked": True,
        "store": {"energy": 0, "power": 0},
        "storeCapacityResource": {"energy": 5000, "power": 100},
        "hits": 5000,
        "hitsMax": 5000,
    },
    "nuker": {
        "notifyWhenAttacked": True,
        "store": {"energy": 0, "G": 0},
        "storeCapacityResource": {"energy": 300000, "G": 5000},
        "hits": 1000,
        "hitsMax": 1000,
        "cooldownTime": "__GAME_TIME_PLUS__:100000",
    },
}

ENERGY_FILL_PRIORITY = [
    "spawn",
    "extension",
    "tower",
    "link",
    "storage",
    "container",
    "terminal",
    "lab",
    "factory",
    "powerSpawn",
    "nuker",
]

FILLABLE_STORE_TYPES = {
    "spawn",
    "extension",
    "tower",
    "link",
    "storage",
    "container",
    "terminal",
    "lab",
    "factory",
    "powerSpawn",
    "nuker",
}


def calc_gcl_total(level: int) -> int:
    if level <= 1:
        return 0
    return int(GCL_MULTIPLY * pow(level - 1, GCL_POW))


def calc_gcl_status(value: int) -> dict:
    value = max(0, int(value or 0))
    level = int(pow(value / GCL_MULTIPLY, 1 / GCL_POW)) + 1 if value > 0 else 1
    while calc_gcl_total(level + 1) <= value:
        level += 1
    while level > 1 and calc_gcl_total(level) > value:
        level -= 1

    base = calc_gcl_total(level)
    next_total = calc_gcl_total(level + 1)
    return {
        "gcl": value,
        "gclLevel": level,
        "gclProgress": value - base,
        "gclProgressTotal": next_total - base,
    }


def calc_power_total(level: int) -> int:
    if level <= 0:
        return 0
    return int(POWER_LEVEL_MULTIPLY * pow(level, POWER_LEVEL_POW))


def calc_power_status(value: int) -> dict:
    value = max(0, int(value or 0))
    level = int(pow(value / POWER_LEVEL_MULTIPLY, 1 / POWER_LEVEL_POW)) if value > 0 else 0
    while calc_power_total(level + 1) <= value:
        level += 1
    while level > 0 and calc_power_total(level) > value:
        level -= 1

    base = calc_power_total(level)
    next_total = calc_power_total(level + 1)
    return {
        "power": value,
        "pclLevel": level,
        "pclProgress": value - base,
        "pclProgressTotal": next_total - base,
    }


def parse_structured_output(text: str):
    trimmed = (text or "").strip()
    if not trimmed:
        return None

    attempts = [trimmed]
    if trimmed.startswith("'") and trimmed.endswith("'"):
        attempts.append(trimmed[1:-1])

    for attempt in attempts:
        try:
            return json.loads(attempt)
        except json.JSONDecodeError:
            continue

    return None


def api_request(url: str, payload: dict | None = None, token: str | None = None) -> dict:
    data = None
    headers: dict[str, str] = {}
    if token:
        headers["X-Token"] = token
    if payload is not None:
        data = json.dumps(payload).encode("utf8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode("utf8"))


def js_literal(value):
    if isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return "null"
    if isinstance(value, dict):
        parts = []
        for key, nested in value.items():
            parts.append(f"{json.dumps(str(key))}: {js_literal(nested)}")
        return "{" + ", ".join(parts) + "}"
    if isinstance(value, (list, tuple)):
        return "[" + ", ".join(js_literal(item) for item in value) + "]"
    return json.dumps(value)


def defaults_to_js(defaults: dict) -> str:
    parts: list[str] = []

    for key, value in defaults.items():
        if isinstance(value, str) and value.startswith("__GAME_TIME_PLUS__:"):
            offset = int(value.split(":", 1)[1])
            parts.append(f"{json.dumps(key)}: gameTime + {offset}")
            continue

        parts.append(f"{json.dumps(key)}: {js_literal(value)}")

    return "{" + ", ".join(parts) + "}"


def run_cli(command: str, server_root: Path, host: str, port: int) -> str:
    del server_root
    with socket.create_connection((host, port), timeout=10) as sock:
        sock.settimeout(2)

        def read_until_prompt(idle_timeout: float = 1.5) -> str:
            chunks: list[bytes] = []
            last_data_at = time.monotonic()
            while True:
                try:
                    chunk = sock.recv(4096)
                except TimeoutError:
                    if chunks and time.monotonic() - last_data_at >= idle_timeout:
                        break
                    if not chunks and time.monotonic() - last_data_at >= idle_timeout:
                        break
                    continue
                if not chunk:
                    break
                chunks.append(chunk)
                last_data_at = time.monotonic()
                data = b"".join(chunks)
                if data.startswith(b"< ") or b"\n< " in data:
                    return data.decode("utf8", errors="replace")
            return b"".join(chunks).decode("utf8", errors="replace")

        read_until_prompt()
        sock.sendall(command.encode("utf8") + b"\r\n")
        output = read_until_prompt()
        sock.shutdown(socket.SHUT_RDWR)

    return output.strip()


def ensure_local_user(server_url: str) -> dict:
    result = api_request(
        f"{server_url}/api/auth/steam-ticket",
        {"ticket": "local-dev-bootstrap", "useNativeAuth": False},
    )
    token = result.get("token", DEFAULT_TOKEN)
    me = api_request(f"{server_url}/api/auth/me", token=token)
    return {"token": token, "user": me}


def load_db(server_root: Path) -> dict:
    return json.loads((server_root / "db.json").read_text(encoding="utf8"))


def wait_for_room_terrain(server_root: Path, room: str, timeout_seconds: float = 5.0) -> tuple[dict, dict]:
    deadline = time.monotonic() + timeout_seconds

    while True:
        db = load_db(server_root)
        terrains_collection = next(c for c in db["collections"] if c["name"] == "rooms.terrain")
        terrain = next((entry for entry in terrains_collection["data"] if entry["room"] == room), None)

        if terrain is not None:
            return db, terrain

        if time.monotonic() >= deadline:
            raise SystemExit(f"terrain not found for room {room}")

        time.sleep(0.1)


def terrain_char_is_wall(value: str) -> bool:
    return bool(int(value) & 1)


def iter_spawn_positions(
    server_root: Path,
    room: str,
    preferred_x: int,
    preferred_y: int,
) -> list[tuple[int, int]]:
    db, terrain = wait_for_room_terrain(server_root, room)
    objects = db["collections"][db["collections"].index(next(c for c in db["collections"] if c["name"] == "rooms.objects"))]["data"]

    occupied = {
        (obj["x"], obj["y"])
        for obj in objects
        if obj.get("room") == room and "x" in obj and "y" in obj
    }

    def is_open(x: int, y: int) -> bool:
        if x < 1 or x > 48 or y < 1 or y > 48:
            return False
        if terrain_char_is_wall(terrain["terrain"][y * 50 + x]):
            return False
        if (x, y) in occupied:
            return False
        return True

    candidates: list[tuple[int, int]] = []

    if is_open(preferred_x, preferred_y):
        candidates.append((preferred_x, preferred_y))

    for radius in range(1, 25):
        min_x = max(1, preferred_x - radius)
        max_x = min(48, preferred_x + radius)
        min_y = max(1, preferred_y - radius)
        max_y = min(48, preferred_y + radius)

        for y in range(min_y, max_y + 1):
            for x in range(min_x, max_x + 1):
                if max(abs(x - preferred_x), abs(y - preferred_y)) != radius:
                    continue
                if is_open(x, y):
                    candidates.append((x, y))

    if not candidates:
        raise SystemExit(f"no valid spawn position found in {room}")

    return candidates


def count_walkable_adjacent_tiles(terrain: str, x: int, y: int) -> int:
    count = 0

    for dy in range(-1, 2):
        for dx in range(-1, 2):
            if dx == 0 and dy == 0:
                continue

            nx = x + dx
            ny = y + dy

            if nx < 1 or nx > 48 or ny < 1 or ny > 48:
                continue
            if terrain_char_is_wall(terrain[ny * 50 + nx]):
                continue

            count += 1

    return count


def get_room_terrain_and_objects(server_root: Path, room: str) -> tuple[str, list[dict]]:
    db, terrain = wait_for_room_terrain(server_root, room)
    objects = next(c for c in db["collections"] if c["name"] == "rooms.objects")["data"]

    room_objects = [obj for obj in objects if obj.get("room") == room]
    return terrain["terrain"], room_objects


def get_walkable_objective_tiles(
    terrain: str,
    room_objects: list[dict],
) -> list[set[tuple[int, int]]]:
    objectives: list[set[tuple[int, int]]] = []

    def is_walkable(x: int, y: int) -> bool:
        if x < 1 or x > 48 or y < 1 or y > 48:
            return False
        return not terrain_char_is_wall(terrain[y * 50 + x])

    controller = next((obj for obj in room_objects if obj.get("type") == "controller"), None)
    if controller:
        tiles = set()
        for y in range(controller["y"] - 1, controller["y"] + 2):
            for x in range(controller["x"] - 1, controller["x"] + 2):
                if is_walkable(x, y):
                    tiles.add((x, y))
        if tiles:
            objectives.append(tiles)

    for source in room_objects:
        if source.get("type") != "source":
            continue
        tiles = set()
        for y in range(source["y"] - 1, source["y"] + 2):
            for x in range(source["x"] - 1, source["x"] + 2):
                if (x, y) == (source["x"], source["y"]):
                    continue
                if is_walkable(x, y):
                    tiles.add((x, y))
        if tiles:
            objectives.append(tiles)

    return objectives


def is_spawn_position_connected(
    server_root: Path,
    room: str,
    spawn_x: int,
    spawn_y: int,
) -> bool:
    terrain, room_objects = get_room_terrain_and_objects(server_root, room)
    objectives = get_walkable_objective_tiles(terrain, room_objects)
    if not objectives:
        return True

    seen: set[tuple[int, int]] = {(spawn_x, spawn_y)}
    queue: deque[tuple[int, int]] = deque([(spawn_x, spawn_y)])

    def is_walkable(x: int, y: int) -> bool:
        if x < 1 or x > 48 or y < 1 or y > 48:
            return False
        return not terrain_char_is_wall(terrain[y * 50 + x])

    while queue:
        x, y = queue.popleft()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if (nx, ny) in seen:
                continue
            if not is_walkable(nx, ny):
                continue
            seen.add((nx, ny))
            queue.append((nx, ny))

    return all(any(tile in seen for tile in objective) for objective in objectives)


def score_spawn_position(
    server_root: Path,
    room: str,
    spawn_x: int,
    spawn_y: int,
    preferred_x: int,
    preferred_y: int,
) -> tuple[float, int, int, int]:
    terrain, room_objects = get_room_terrain_and_objects(server_root, room)
    objectives = get_walkable_objective_tiles(terrain, room_objects)

    if objectives:
        objective_distance = 0.0
        for objective in objectives:
            objective_distance += min(
                abs(spawn_x - tile_x) + abs(spawn_y - tile_y)
                for tile_x, tile_y in objective
            )
        objective_distance /= len(objectives)
    else:
        objective_distance = 0.0

    open_adjacent = count_walkable_adjacent_tiles(terrain, spawn_x, spawn_y)
    edge_distance = min(spawn_x - 1, 48 - spawn_x, spawn_y - 1, 48 - spawn_y)
    preferred_distance = abs(spawn_x - preferred_x) + abs(spawn_y - preferred_y)

    # Lower is better. Prefer good access to controller/sources, enough local
    # breathing room, and not hugging the room edge.
    return (
        objective_distance - (open_adjacent * 1.5) - min(edge_distance, 6),
        preferred_distance,
        -open_adjacent,
        -edge_distance,
    )


def build_reseed_command(room: str, controller: bool, sources: int, terrain_type: int | None) -> str:
    opts: dict[str, object] = {"controller": controller, "sources": sources}
    if terrain_type is not None:
        opts["terrainType"] = terrain_type
    opts_json = json.dumps(opts)
    room_json = json.dumps(room)
    return (
        "Promise.resolve()"
        f".then(() => storage.db['rooms'].findOne({{_id: {room_json}}}))"
        f".then(roomData => roomData ? map.removeRoom({room_json}) : null)"
        f".then(() => map.generateRoom({room_json}, {opts_json}))"
        f".then(() => map.openRoom({room_json}))"
        ".then(() => map.updateTerrainData())"
        f".then(() => print('reseeded {room}'))"
        ".catch(err => print(err && (err.stack || err.toString()) || 'unknown error'))"
    )


def command_reset_world(args: argparse.Namespace) -> int:
    output = run_cli(
        "system.resetAllData()",
        server_root=args.server_root,
        host=args.cli_host,
        port=args.cli_port,
    )
    if output:
        print(output)
    print("world reset complete")
    return 0


def command_status(args: argparse.Namespace) -> int:
    output = run_cli(
        "Promise.resolve()"
        ".then(() => Promise.all(["
        " storage.env.get('gameTime'),"
        " storage.env.get(storage.env.keys.MAIN_LOOP_PAUSED),"
        " storage.env.get(storage.env.keys.MAIN_LOOP_MIN_DURATION),"
        " storage.db.users.findOne({username: 'local-dev'})"
        "]))"
        ".then(([gameTime, paused, tickDuration, user]) => Promise.all(["
        " user ? storage.db['users.code'].findOne({user: user._id, activeWorld: true}) : null,"
        " user ? storage.env.get('scrUserMemory:' + user._id) : null"
        "]).then(([code, memory]) => ({gameTime, paused, tickDuration, user, code, memory})))"
        ".then(({gameTime, paused, tickDuration, user, code, memory}) => {"
        " let parsedMemory = null;"
        " let runtimeStats = null;"
        " try {"
        "   parsedMemory = memory ? JSON.parse(memory) : null;"
        "   runtimeStats = parsedMemory && parsedMemory.stats && parsedMemory.stats.last ? parsedMemory.stats.last : null;"
        " } catch (err) {"
        "   runtimeStats = null;"
        " }"
        " print(JSON.stringify({"
        " gameTime: parseInt(gameTime || '0', 10) || 0,"
        " paused: paused === '1',"
        " tickDuration: parseInt(tickDuration || '0', 10) || 0,"
        " user: user ? {"
        "   username: user.username,"
        "   cpu: user.cpu,"
        "   fixedCPU: user.fixedCPU || null,"
        "   lastUsedCpu: user.lastUsedCpu || 0,"
        "   lastUsedDirtyTime: user.lastUsedDirtyTime || 0,"
        "   cpuAvailable: user.cpuAvailable || 0,"
        "   gcl: user.gcl || 0,"
        "   power: user.power || 0"
        " } : null,"
        " activeBranch: code ? code.branch : null,"
        " runtimeStats: runtimeStats ? {"
        "   tick: runtimeStats.tick || 0,"
        "   cpu: runtimeStats.cpu ? {"
        "     used: runtimeStats.cpu.used || 0,"
        "     tickCost: runtimeStats.cpu.tickCost || 0,"
        "     limit: runtimeStats.cpu.limit || 0,"
        "     tickLimit: runtimeStats.cpu.tickLimit || 0,"
        "     bucket: runtimeStats.cpu.bucket || 0"
        "   } : null"
        " } : null"
        " }));"
        "})"
        ".catch(err => print(err && (err.stack || err.toString()) || 'unknown error'))",
        args.server_root,
        args.cli_host,
        args.cli_port,
    )
    data = parse_structured_output(output)
    if data is None:
        print(output)
        return 0

    user = data.get("user") or {}
    if user:
        user.update(calc_gcl_status(user.get("gcl", 0)))
        user.update(calc_power_status(user.get("power", 0)))
        data["user"] = user

    print(json.dumps(data))
    return 0


def command_pause(args: argparse.Namespace) -> int:
    print(run_cli("system.pauseSimulation()", args.server_root, args.cli_host, args.cli_port))
    return 0


def command_resume(args: argparse.Namespace) -> int:
    print(run_cli("system.resumeSimulation()", args.server_root, args.cli_host, args.cli_port))
    return 0


def command_set_tick_duration(args: argparse.Namespace) -> int:
    print(
        run_cli(
            f"system.setTickDuration({args.milliseconds})",
            args.server_root,
            args.cli_host,
            args.cli_port,
        )
    )
    print(f"tick duration set to {args.milliseconds} ms")
    return 0


def command_ensure_local_user(args: argparse.Namespace) -> int:
    result = ensure_local_user(args.server_url)
    print(json.dumps(result, indent=2))
    return 0


def command_set_user_cpu(args: argparse.Namespace) -> int:
    user_id = args.user_id
    if not user_id:
        if args.username != "local-dev":
            raise SystemExit("set-user-cpu requires --user-id for non-local-dev users")
        user_id = ensure_local_user(args.server_url)["user"]["_id"]

    output = run_cli(
        f"Promise.resolve(storage.db.users.findOne({{_id:'{user_id}'}}))"
        ".then(user => {"
        " if (!user) { throw new Error('user not found'); }"
        f" return storage.db.users.update({{_id: user._id}}, {{$set: {{cpu: {args.cpu}, fixedCPU: {args.cpu}}}}})"
        " .then(() => storage.db.users.findOne({_id: user._id}));"
        "})"
        ".then(user => print(JSON.stringify({username: user.username, cpu: user.cpu, fixedCPU: user.fixedCPU || null, cpuAvailable: user.cpuAvailable || null})))"
        ".catch(err => print(err && (err.stack || err.toString()) || 'unknown error'))",
        args.server_root,
        args.cli_host,
        args.cli_port,
    )
    data = parse_structured_output(output)
    if data is None:
        print(output)
        return 0

    print(json.dumps(data))
    return 0


def command_set_user_gcl(args: argparse.Namespace) -> int:
    if args.level < 1:
        raise SystemExit("--level must be at least 1")

    user_id = args.user_id
    if not user_id:
        if args.username != "local-dev":
            raise SystemExit("set-user-gcl requires --user-id for non-local-dev users")
        user_id = ensure_local_user(args.server_url)["user"]["_id"]

    progress = max(0, int(args.progress or 0))
    total_gcl = calc_gcl_total(args.level) + progress

    output = run_cli(
        f"Promise.resolve(storage.db.users.findOne({{_id:'{user_id}'}}))"
        ".then(user => {"
        " if (!user) { throw new Error('user not found'); }"
        f" return storage.db.users.update({{_id: user._id}}, {{$set: {{gcl: {total_gcl}}}}})"
        " .then(() => storage.db.users.findOne({_id: user._id}));"
        "})"
        ".then(user => print(JSON.stringify({username: user.username, gcl: user.gcl || 0})))"
        ".catch(err => print(err && (err.stack || err.toString()) || 'unknown error'))",
        args.server_root,
        args.cli_host,
        args.cli_port,
    )

    data = parse_structured_output(output)
    if data is None:
        print(output)
        return 0

    data.update(calc_gcl_status(data.get("gcl", 0)))
    print(json.dumps(data))
    return 0


def command_set_user_pcl(args: argparse.Namespace) -> int:
    if args.level < 0:
        raise SystemExit("--level must be at least 0")

    user_id = args.user_id
    if not user_id:
        if args.username != "local-dev":
            raise SystemExit("set-user-pcl requires --user-id for non-local-dev users")
        user_id = ensure_local_user(args.server_url)["user"]["_id"]

    progress = max(0, int(args.progress or 0))
    total_power = calc_power_total(args.level) + progress

    output = run_cli(
        f"Promise.resolve(storage.db.users.findOne({{_id:'{user_id}'}}))"
        ".then(user => {"
        " if (!user) { throw new Error('user not found'); }"
        f" return storage.db.users.update({{_id: user._id}}, {{$set: {{power: {total_power}}}}})"
        " .then(() => storage.db.users.findOne({_id: user._id}));"
        "})"
        ".then(user => print(JSON.stringify({username: user.username, power: user.power || 0})))"
        ".catch(err => print(err && (err.stack || err.toString()) || 'unknown error'))",
        args.server_root,
        args.cli_host,
        args.cli_port,
    )

    data = parse_structured_output(output)
    if data is None:
        print(output)
        return 0

    data.update(calc_power_status(data.get("power", 0)))
    print(json.dumps(data))
    return 0


def command_set_controller_level(args: argparse.Namespace) -> int:
    ensure_local_user(args.server_url)

    if args.level < 1 or args.level > 8:
        raise SystemExit("--level must be between 1 and 8")

    progress = args.progress
    if progress is None:
        progress = 0

    controller_json = json.dumps(args.room)
    output = run_cli(
        "Promise.resolve()"
        ".then(() => storage.env.get('gameTime'))"
        f".then(gameTime => storage.db['rooms.objects'].findOne({{room: {controller_json}, type: 'controller'}})"
        ".then(controller => ({gameTime: parseInt(gameTime || '0', 10) || 0, controller})))"
        ".then(({gameTime, controller}) => {"
        " if (!controller) { throw new Error('controller not found'); }"
        f" const level = {args.level};"
        f" const progress = {progress};"
        f" const total = {json.dumps(CONTROLLER_LEVELS)};"
        f" const downgrade = {json.dumps(CONTROLLER_DOWNGRADE)};"
        " const update = {"
        "   level,"
        "   progress,"
        "   downgradeTime: gameTime + (downgrade[level] || 200000) + 1"
        " };"
        " if (level >= 8) { update.progress = 0; }"
        " return storage.db['rooms.objects'].update({_id: controller._id}, {$set: update})"
        "   .then(() => storage.db['rooms.objects'].findOne({_id: controller._id}));"
        "})"
        ".then(controller => print(JSON.stringify({room: controller.room, level: controller.level, progress: controller.progress, downgradeTime: controller.downgradeTime})))"
        ".catch(err => print(err && (err.stack || err.toString()) || 'unknown error'))",
        args.server_root,
        args.cli_host,
        args.cli_port,
    )
    print(output)
    return 0


def command_complete_owned_sites(args: argparse.Namespace) -> int:
    ensure_local_user(args.server_url)
    defaults_by_type = {
        structure_type: defaults_to_js(defaults)
        for structure_type, defaults in STRUCTURE_DEFAULTS.items()
    }
    output = run_cli(
        "Promise.resolve()"
        ".then(() => storage.env.get('gameTime'))"
        ".then(gameTime => storage.db.users.findOne({username: 'local-dev'})"
        ".then(user => ({gameTime: parseInt(gameTime || '0', 10) || 0, user})))"
        ".then(({gameTime, user}) => {"
        " if (!user) { throw new Error('local-dev user not found'); }"
        f" const room = {json.dumps(args.room)};"
        f" const structureDefaults = {js_literal(defaults_by_type)};"
        " return storage.db['rooms.objects'].find({room, type: 'constructionSite', user: '' + user._id})"
        "   .then(sites => ({sites, user, gameTime, room, structureDefaults}));"
        "})"
        ".then(({sites, user, gameTime, room, structureDefaults}) => {"
        " let completed = 0;"
        " const ops = [];"
        " for (const site of sites) {"
        "   const defaultSource = structureDefaults[site.structureType];"
        "   if (!defaultSource) { continue; }"
        "   const defaults = Function('gameTime', 'return ' + defaultSource)(gameTime);"
        "   const structure = Object.assign({"
        "     type: site.structureType,"
        "     x: site.x,"
        "     y: site.y,"
        "     room: site.room"
        "   }, defaults);"
        "   if (site.user) { structure.user = site.user; }"
        "   if (site.name) { structure.name = site.name; }"
        "   ops.push(storage.db['rooms.objects'].insert(structure));"
        "   ops.push(storage.db['rooms.objects'].removeWhere({_id: site._id}));"
        "   completed++;"
        " }"
        " return Promise.all(ops).then(() => ({room, completed}));"
        "})"
        ".then(result => print(JSON.stringify(result)))"
        ".catch(err => print(err && (err.stack || err.toString()) || 'unknown error'))",
        args.server_root,
        args.cli_host,
        args.cli_port,
    )
    print(output)
    return 0


def command_fill_room_energy(args: argparse.Namespace) -> int:
    ensure_local_user(args.server_url)
    structure_types = args.types or ENERGY_FILL_PRIORITY
    for structure_type in structure_types:
        if structure_type not in FILLABLE_STORE_TYPES:
            raise SystemExit(f"unsupported structure type for energy fill: {structure_type}")

    output = run_cli(
        "Promise.resolve()"
        ".then(() => storage.db.users.findOne({username: 'local-dev'}))"
        ".then(user => {"
        " if (!user) { throw new Error('local-dev user not found'); }"
        f" const room = {json.dumps(args.room)};"
        f" const fillAmount = {args.amount};"
        f" const types = {js_literal(structure_types)};"
        " return storage.db['rooms.objects'].find({room, user: '' + user._id})"
        "   .then(objects => ({objects, fillAmount, types, room}));"
        "})"
        ".then(({objects, fillAmount, types, room}) => {"
        " let remaining = fillAmount;"
        " let touched = 0;"
        " const ops = [];"
        " for (const type of types) {"
        "   for (const object of objects) {"
        "     if (remaining <= 0) { break; }"
        "     if (object.type !== type) { continue; }"
        "     if (!object.store) { continue; }"
        "     const capacityByResource = object.storeCapacityResource || {};"
        "     const totalCapacity = object.storeCapacity || capacityByResource.energy || 0;"
        "     const energyCapacity = capacityByResource.energy || totalCapacity;"
        "     if (!energyCapacity) { continue; }"
        "     const current = (object.store.energy || 0);"
        "     const add = Math.max(0, Math.min(energyCapacity - current, remaining));"
        "     if (!add) { continue; }"
        "     const nextStore = Object.assign({}, object.store, {energy: current + add});"
        "     ops.push(storage.db['rooms.objects'].update({_id: object._id}, {$set: {store: nextStore}}));"
        "     remaining -= add;"
        "     touched++;"
        "   }"
        " }"
        " return Promise.all(ops).then(() => ({room, touched, remaining}));"
        "})"
        ".then(result => print(JSON.stringify(result)))"
        ".catch(err => print(err && (err.stack || err.toString()) || 'unknown error'))",
        args.server_root,
        args.cli_host,
        args.cli_port,
    )
    print(output)
    return 0


def command_reseed_room(args: argparse.Namespace) -> int:
    ensure_local_user(args.server_url)
    output = run_cli(
        build_reseed_command(
            room=args.room,
            controller=not args.no_controller,
            sources=args.sources,
            terrain_type=args.terrain_type,
        ),
        args.server_root,
        args.cli_host,
        args.cli_port,
    )
    if output:
        print(output)
    else:
        print(f"reseed request completed for {args.room}")
    if args.skip_spawn:
        return 0

    spawn_candidates = iter_spawn_positions(
        args.server_root,
        args.room,
        args.spawn_x,
        args.spawn_y,
    )
    valid_candidates: list[tuple[int, int]] = []
    for spawn_x, spawn_y in spawn_candidates:
        if is_spawn_position_connected(
            args.server_root,
            args.room,
            spawn_x,
            spawn_y,
        ):
            valid_candidates.append((spawn_x, spawn_y))

    if not valid_candidates:
        raise SystemExit(f"unable to find connected spawn position in {args.room}")

    valid_candidates.sort(
        key=lambda pos: score_spawn_position(
            args.server_root,
            args.room,
            pos[0],
            pos[1],
            args.spawn_x,
            args.spawn_y,
        )
    )

    last_result: dict | None = None
    for spawn_x, spawn_y in valid_candidates:
        payload = {
            "room": args.room,
            "x": spawn_x,
            "y": spawn_y,
            "name": args.spawn_name,
        }
        result = api_request(
            f"{args.server_url}/api/game/place-spawn",
            payload=payload,
            token=args.token,
        )
        last_result = result
        if result.get("ok") == 1:
            print(json.dumps(result, indent=2))
            print(f"spawn placed at {spawn_x},{spawn_y}")
            return 0

    print(json.dumps(last_result or {"error": "spawn placement failed"}, indent=2))
    raise SystemExit(f"unable to place spawn in {args.room}")


def command_create_invader(args: argparse.Namespace) -> int:
    ensure_local_user(args.server_url)
    payload = {
        "room": args.room,
        "x": args.x,
        "y": args.y,
        "size": args.size,
        "type": args.type,
        "boosted": args.boosted,
    }
    result = api_request(
        f"{args.server_url}/api/game/create-invader",
        payload=payload,
        token=args.token,
    )
    print(json.dumps(result, indent=2))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Private-server admin helpers for faster Screeps test loops.",
    )
    parser.set_defaults(server_root=DEFAULT_SERVER_ROOT)
    parser.set_defaults(server_url=DEFAULT_SERVER_URL)
    parser.set_defaults(token=DEFAULT_TOKEN)
    parser.set_defaults(cli_host=DEFAULT_CLI_HOST)
    parser.set_defaults(cli_port=DEFAULT_CLI_PORT)

    subparsers = parser.add_subparsers(dest="command", required=True)

    status = subparsers.add_parser("status", help="show private-server runtime status")
    status.set_defaults(func=command_status)

    reset_world = subparsers.add_parser("reset-world", help="wipe the private server world")
    reset_world.set_defaults(func=command_reset_world)

    pause = subparsers.add_parser("pause", help="pause simulation")
    pause.set_defaults(func=command_pause)

    resume = subparsers.add_parser("resume", help="resume simulation")
    resume.set_defaults(func=command_resume)

    tick = subparsers.add_parser("set-tick-duration", help="set tick duration in milliseconds")
    tick.add_argument("milliseconds", type=int)
    tick.set_defaults(func=command_set_tick_duration)

    ensure = subparsers.add_parser("ensure-local-user", help="bootstrap the local-dev user")
    ensure.set_defaults(func=command_ensure_local_user)

    set_cpu = subparsers.add_parser("set-user-cpu", help="set a private-server user's CPU limit")
    set_cpu.add_argument("cpu", type=int)
    set_cpu.add_argument("--username", default="local-dev")
    set_cpu.add_argument("--user-id")
    set_cpu.set_defaults(func=command_set_user_cpu)

    set_gcl = subparsers.add_parser("set-user-gcl", help="set a private-server user's GCL level")
    set_gcl.add_argument("level", type=int)
    set_gcl.add_argument("--progress", type=int, default=0)
    set_gcl.add_argument("--username", default="local-dev")
    set_gcl.add_argument("--user-id")
    set_gcl.set_defaults(func=command_set_user_gcl)

    set_pcl = subparsers.add_parser("set-user-pcl", help="set a private-server user's PCL level")
    set_pcl.add_argument("level", type=int)
    set_pcl.add_argument("--progress", type=int, default=0)
    set_pcl.add_argument("--username", default="local-dev")
    set_pcl.add_argument("--user-id")
    set_pcl.set_defaults(func=command_set_user_pcl)

    set_controller = subparsers.add_parser(
        "set-controller-level",
        help="set a room controller to a target level for staged testing",
    )
    set_controller.add_argument("--room", default="W5N5")
    set_controller.add_argument("--level", type=int, required=True)
    set_controller.add_argument("--progress", type=int)
    set_controller.set_defaults(func=command_set_controller_level)

    complete_sites = subparsers.add_parser(
        "complete-owned-sites",
        help="instantly finish local-dev construction sites in a room",
    )
    complete_sites.add_argument("--room", default="W5N5")
    complete_sites.set_defaults(func=command_complete_owned_sites)

    fill_energy = subparsers.add_parser(
        "fill-room-energy",
        help="fill owned room structures with energy for faster testing",
    )
    fill_energy.add_argument("--room", default="W5N5")
    fill_energy.add_argument("--amount", type=int, default=300000)
    fill_energy.add_argument(
        "--types",
        nargs="+",
        choices=sorted(FILLABLE_STORE_TYPES),
    )
    fill_energy.set_defaults(func=command_fill_room_energy)

    reseed = subparsers.add_parser("reseed-room", help="reset and regenerate a room")
    reseed.add_argument("--room", default="W5N5")
    reseed.add_argument("--sources", type=int, default=2)
    reseed.add_argument("--terrain-type", type=int)
    reseed.add_argument("--no-controller", action="store_true")
    reseed.add_argument("--skip-spawn", action="store_true")
    reseed.add_argument("--spawn-name", default="Spawn1")
    reseed.add_argument("--spawn-x", type=int, default=25)
    reseed.add_argument("--spawn-y", type=int, default=25)
    reseed.set_defaults(func=command_reseed_room)

    invader = subparsers.add_parser("create-invader", help="spawn a hostile invader in an owned room")
    invader.add_argument("--room", default="W5N5")
    invader.add_argument("--x", type=int, default=10)
    invader.add_argument("--y", type=int, default=10)
    invader.add_argument("--size", choices=["small", "big"], default="small")
    invader.add_argument("--type", choices=["Melee", "Ranged", "Healer"], default="Melee")
    invader.add_argument("--boosted", action="store_true")
    invader.set_defaults(func=command_create_invader)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
