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
        f" return storage.db.users.update({{_id: user._id}}, {{$set: {{cpu: {args.cpu}}}}})"
        " .then(() => storage.db.users.findOne({_id: user._id}));"
        "})"
        ".then(user => print(JSON.stringify({username: user.username, cpu: user.cpu, cpuAvailable: user.cpuAvailable || null})))"
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
    last_result: dict | None = None
    for spawn_x, spawn_y in spawn_candidates:
        if not is_spawn_position_connected(
            args.server_root,
            args.room,
            spawn_x,
            spawn_y,
        ):
            continue

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
