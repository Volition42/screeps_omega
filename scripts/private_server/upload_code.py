#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
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
        default=str(repo_root / "dev"),
        help="source directory to upload, default is repo dev/",
    )
    parser.add_argument(
        "--server-url",
        default="http://127.0.0.1:21025",
        help="private server base URL",
    )
    parser.add_argument(
        "--token",
        default="screeps-omega-dev-token",
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
                "timestamp": result.get("timestamp"),
                "user": me.get("username"),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
