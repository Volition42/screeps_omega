# Private Server Dev Workflow

Current split:

- `dev/` is the primary development source tree for the local Node 24 preview server.
- `release/` is the current live-compatible source tree for the existing online deployment path.

As of March 24, 2026:

- `screeps@ptr` is still `4.3.0-beta` and still declares `node >=22.9.0`.
- `screeps@feat-node24` is the Node 24 preview target now used for the local private server.
- When `screeps@ptr` catches up after April 1, 2026, the private server target should be switched from `feat-node24` to `ptr`.

## Local Paths

- Private server root: `/Users/jaysheldon/screeps_private_server`
- Browser client root: `/Users/jaysheldon/screeps_browser_client`
- Node 24 binary path: `/opt/homebrew/opt/node@24/bin`
- Local dev auth token: `screeps-omega-dev-token`
- Default browser login: `local-dev` / `screeps-local-pass`

The private server stays outside the repo on purpose. Only the helper scripts and docs live in source control.

## Current Local Server Notes

- The local preview server is installed with `screeps@feat-node24`.
- The server is configured in local-only no-auth mode for development because the native Steam auth path is ABI-incompatible with the Node 24 preview build on Apple Silicon.
- This no-auth mode exists only in the external private-server install. It is not part of the repo game code.
- `http://127.0.0.1:21025/` is only a server status page. It is not a browser game client.
- The local no-auth patch now also bridges `/api/auth/steam-ticket`, so the Screeps client login flow can complete without live Steam auth against this private server.
- Browser access is provided by a separate `screepers-steamless-client` install on `http://127.0.0.1:8080/`, not by the private server itself.
- The private server also loads `node_modules/screepsmod-auth`, which provides `/api/auth/signin` and password auth for the browser client.

## Repo Helpers

- `scripts/private_server/start_dev_server.sh`
  Starts the external private server with Node 24 and local dev auth enabled.
- `scripts/private_server/stop_dev_server.sh`
  Stops the private-server process tree.
- `scripts/private_server/check_dev_server.sh`
  Checks server version, local dev auth, and the local steam-ticket bridge used by the Screeps client.
- `scripts/private_server/set_browser_password.sh`
  Sets or resets the local browser password for `local-dev` through the token-auth bootstrap path.
- `scripts/private_server/start_browser_client.sh`
  Starts the external browser client proxy.
- `scripts/private_server/stop_browser_client.sh`
  Stops the browser client proxy.
- `scripts/private_server/check_browser_client.sh`
  Checks the browser client root and the direct route to the local server.
- `scripts/private_server/world_tool.py`
  Private-server admin entry point for world reset, room reseed, tick control, and invader creation.
- `scripts/private_server/reseed_dev_room.sh`
  Rebuilds the default test room, uploads `dev/`, and restores browser login.
- `scripts/private_server/reset_dev_world.sh`
  Wipes the world, recreates `local-dev`, uploads `dev/`, and reseeds the default test room.
- `scripts/private_server/set_fast_tick.sh`
  Lowers tick duration for faster local progression.
- `scripts/private_server/pause_simulation.sh`
  Pauses the simulation loop.
- `scripts/private_server/resume_simulation.sh`
  Resumes the simulation loop.
- `scripts/private_server/spawn_test_invader.sh`
  Spawns a hostile in the test room for defense validation.
- `scripts/private_server/upload_dev.sh`
  Uploads `dev/` to the private server active world branch.
- `scripts/private_server/upload_release.sh`
  Uploads `release/` to the private server active world branch.
- `scripts/private_server/upload_code.py`
  Generic uploader for any Screeps source directory.
- `scripts/private_server/patch_feat_node24_server.py`
  Reapplies the external private-server bootstrap and local Apple Silicon / no-auth patches after a reinstall or package update.

## Standard Dev Loop

1. Start the server:

```bash
scripts/private_server/start_dev_server.sh
```

2. Check server health:

```bash
scripts/private_server/check_dev_server.sh
```

3. Upload current `dev/`:

```bash
scripts/private_server/upload_dev.sh
```

4. Validate behavior against the private server before promoting anything toward `release/`.

## Browser Use

1. Start the browser client:

```bash
scripts/private_server/start_browser_client.sh
```

2. Open either:

```text
http://127.0.0.1:8080/
```

or the direct local-server route:

```text
http://127.0.0.1:8080/(http://127.0.0.1:21025)/
```

3. Sign in with:

```text
username: local-dev
password: screeps-local-pass
```

4. If needed, reset that password:

```bash
scripts/private_server/set_browser_password.sh
```

## Fast Testing

Common fast-loop commands:

```bash
scripts/private_server/set_fast_tick.sh 100
scripts/private_server/reseed_dev_room.sh
scripts/private_server/spawn_test_invader.sh
```

Full world reset back to a fresh `dev/` room:

```bash
scripts/private_server/reset_dev_world.sh
```

Simulation control:

```bash
scripts/private_server/pause_simulation.sh
scripts/private_server/resume_simulation.sh
```

## Release Role

- Keep `release/` as the conservative live-online source.
- Keep `dev/` as the place where new behavior is introduced and validated against the private server first.
- Promote from `dev/` to `release/` intentionally, not automatically.

## Current Validation State

The private server has already been bootstrapped successfully enough to:

- start the Node 24 preview server
- authenticate with the local dev token
- upload the repo `dev/` modules
- create a local user
- place a first spawn in `W5N5`
- observe the uploaded code spawning a `jrworker`

That means `dev/` is now executing on the private Node 24 preview server instead of being limited to syntax checks.
