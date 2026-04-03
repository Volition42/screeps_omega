#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime
import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path


def load_modules(source_dir: Path) -> dict[str, str]:
    modules: dict[str, str] = {}
    for path in sorted(source_dir.glob("*.js")):
        modules[path.stem] = path.read_text(encoding="utf8")
    if not modules:
        raise SystemExit(f"no .js modules found in {source_dir}")
    return modules


def run_git(repo_root: Path, *args: str) -> str | None:
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=repo_root,
            check=True,
            capture_output=True,
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None

    return result.stdout.strip()


def build_info_payload(repo_root: Path, branch: str, source_dir: Path) -> dict[str, str | None]:
    commit = run_git(repo_root, "rev-parse", "--short", "HEAD") or "unknown"
    dirty = bool(run_git(repo_root, "status", "--porcelain"))
    branch_name = run_git(repo_root, "branch", "--show-current") or branch or "unknown"
    deployed_at = datetime.datetime.now(datetime.UTC).replace(microsecond=0).isoformat()
    source_name = source_dir.name
    build_id = f"{commit}{'-dirty' if dirty else ''}"

    return {
        "buildId": build_id,
        "gitCommit": commit,
        "gitBranch": branch_name,
        "deployedAt": deployed_at,
        "source": source_name,
    }


def build_info_module(payload: dict[str, str | None]) -> str:
    return "module.exports = " + json.dumps(payload, indent=2) + ";\n"


def api_request(url: str, token: str, payload: dict | None = None) -> dict:
    data = None
    headers = {"X-Token": token}
    if payload is not None:
        data = json.dumps(payload).encode("utf8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers)
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode("utf8"))


def main() -> int:
    repo_root = Path(__file__).resolve().parents[2]

    parser = argparse.ArgumentParser(
        description="Upload a Screeps source tree to the local private server.",
    )
    parser.add_argument(
        "source",
        nargs="?",
        default=str(repo_root / "src"),
        help="source directory to upload, default is repo src/",
    )
    parser.add_argument(
        "--server-url",
        default=os.environ.get("SCREEPS_SERVER_URL", "http://127.0.0.1:21035"),
        help="private server base URL",
    )
    parser.add_argument(
        "--token",
        default=os.environ.get("SCREEPS_LOCAL_TOKEN", "screeps-omega-dev-token"),
        help="local dev auth token",
    )
    parser.add_argument(
        "--branch",
        default="$activeWorld",
        help="server branch to upload to",
    )
    args = parser.parse_args()

    source_dir = Path(args.source).resolve()
    modules = load_modules(source_dir)
    build_info = build_info_payload(repo_root, args.branch, source_dir)
    modules["build_info"] = build_info_module(build_info)
    payload = {"branch": args.branch, "modules": modules}

    try:
        result = api_request(
            f"{args.server_url}/api/user/code",
            args.token,
            payload,
        )
        me = api_request(f"{args.server_url}/api/auth/me", args.token)
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf8", errors="replace")
        print(body, file=sys.stderr)
        return 1

    print(
        json.dumps(
            {
                "uploaded_modules": len(modules),
                "source": str(source_dir),
                "branch": args.branch,
                "build_id": build_info.get("buildId"),
                "timestamp": result.get("timestamp"),
                "user": me.get("username"),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
