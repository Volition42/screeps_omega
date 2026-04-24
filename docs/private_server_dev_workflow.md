# Private Server Dev Workflow

Current layout:

- `src/` is the single Screeps source tree used for local `screeps@ptr` validation and live deployment uploads.

As of April 2, 2026:

- Live-world testing has moved to Node 24, so local validation should use Node 24 by default.
- `npm view screeps` currently reports `latest=4.3.0`, `ptr=4.3.0-beta`, and package engines `node >=22.9.0`.
- The repo `ptr` profile now defaults to Node 24 even though the published package metadata still advertises a lower minimum.
- The default private-server target is now `ptr`.

## Local Paths

- PTR private server root: `/home/vadmin/screeps_private_server_ptr`
- Optional alternate local server root: `/home/vadmin/screeps_private_server`
- Browser client root: `/home/vadmin/screeps_browser_client`
- PTR Node binary path: `/usr/bin`
- Browser client Node binary path: `/home/vadmin/.local/opt/node24/bin`
- PTR server URL: `http://127.0.0.1:21035`
- PTR CLI port: `21036`
- Local dev auth token: `screeps-omega-dev-token`
- Default local test CPU cap: `100`
- Default browser login: `local-dev` / `screeps-local-pass`

The private server stays outside the repo on purpose. Only the helper scripts and docs live in source control.

## Current Local Server Notes

- The primary local server is installed with `screeps@ptr`.
- The server is configured in local-only no-auth mode for development so scripted testing, browser login, and fixed local CPU limits stay deterministic.
- This no-auth mode exists only in the external private-server install. It is not part of the repo game code.
- `http://127.0.0.1:21035/` is only a server status page. It is not a browser game client.
- The local no-auth patch now also bridges `/api/auth/steam-ticket`, so the Screeps client login flow can complete without live Steam auth against this private server.
- Browser access is provided by a separate `screepers-steamless-client` install on `http://127.0.0.1:8080/`, not by the private server itself.
- The private server also loads `node_modules/screepsmod-auth`, which provides `/api/auth/signin` and password auth for the browser client.
- The browser helper now defaults both the public browser URL and the public server URL to `127.0.0.1`. Keep this unless intentionally testing through a remote/Tailscale route; stale public routes can break room subscriptions and make the room view show `WAITING FOR DATA / Too many tabs opened`.
- All repo helper scripts source `scripts/private_server/load_server_profile.sh`. The default `ptr` profile now uses Node 24. Set `SCREEPS_SERVER_PROFILE=feat-node24` only when you intentionally want the alternate local install.

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
  Rebuilds the default test room, uploads `src/`, and restores browser login.
- `scripts/private_server/reset_dev_world.sh`
  Wipes the world, recreates `local-dev`, uploads `src/`, and reseeds the default test room.
- `scripts/private_server/set_fast_tick.sh`
  Lowers tick duration for faster local progression.
- `scripts/private_server/set_test_cpu.sh`
  Writes the next private-server `LOCAL_NOAUTH_CPU` value for `local-dev`. Restart the private server after using it.
- `scripts/private_server/pause_simulation.sh`
  Pauses the simulation loop.
- `scripts/private_server/resume_simulation.sh`
  Resumes the simulation loop.
- `scripts/private_server/spawn_test_invader.sh`
  Spawns a hostile in the test room for defense validation.
- `scripts/private_server/upload_src.sh`
  Uploads `src/` to the private server active world branch.
- `scripts/private_server/upload_code.py`
  Generic uploader for any Screeps source directory.
- `scripts/private_server/load_server_profile.sh`
  Central profile switch between the default `ptr` server and the optional `feat-node24` alternate local install.
- `scripts/private_server/patch_private_server.py`
  Reapplies the external private-server bootstrap and local auth/browser patches after a reinstall or package update.
- `scripts/private_server/patch_feat_node24_server.py`
  Compatibility wrapper that forwards to `patch_private_server.py`.

## Standard Dev Loop

1. Start the server:

```bash
scripts/private_server/start_dev_server.sh
```

2. Check server health:

```bash
scripts/private_server/check_dev_server.sh
```

3. Upload current `src/`:

```bash
scripts/private_server/upload_src.sh
```

4. Validate behavior against the private server before pushing online changes.

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
  http://127.0.0.1:8080/(http://127.0.0.1:21035)/
```

Avoid using the Tailscale/public hostname for normal local testing unless the server and browser client were both started with matching public host overrides.

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
scripts/private_server/set_test_cpu.sh 100
scripts/private_server/set_fast_tick.sh 100
scripts/private_server/reseed_dev_room.sh
scripts/private_server/spawn_test_invader.sh
```

If you change the CPU cap, restart the private server before resetting or reseeding:

```bash
scripts/private_server/set_test_cpu.sh 100
scripts/private_server/stop_dev_server.sh
scripts/private_server/start_dev_server.sh
```

Full world reset back to a fresh `src/` room:

```bash
scripts/private_server/reset_dev_world.sh
```

If the room view is stuck at `WAITING FOR DATA` after a reset, restart the browser client and reopen the localhost route:

```bash
scripts/private_server/stop_browser_client.sh
scripts/private_server/start_browser_client.sh
```

Simulation control:

```bash
scripts/private_server/pause_simulation.sh
scripts/private_server/resume_simulation.sh
```

Reserved-room validation loop:

```bash
scripts/private_server/check_dev_server.sh
scripts/private_server/reset_dev_world.sh
python3 scripts/private_server/world_tool.py set-controller-level --room W5N5 --level 4
python3 scripts/private_server/world_tool.py complete-owned-sites --room W5N5
python3 scripts/private_server/world_tool.py fill-room-energy --room W5N5
npm run upload:ptr
```

Then in the Screeps console:

```js
ops.room("W5N5", "build")
ops.reserve("W5N6", "W5N5")
ops.reserved("W5N5")
ops.empire()
```

Expected behavior:

- The parent only starts reservation work after it is RCL4+ and development/stable.
- A `reserver` maintains the target controller reservation.
- Visible reserved rooms receive source container sites first, then minimal road sites.
- `remoteminer` and `remotehauler` creeps move source energy back to the parent.
- Visible hostiles in the reserved room pause remote civilian work and request parent defense.
- `ops.expand("W5N6")` converts the reservation into a normal expansion plan and stops reserved-room mining.

## Deployment Role

- Keep `src/` as the single source of truth.
- Validate in PTR first, then push the same code online intentionally.

## Current Validation State

The private server has already been bootstrapped successfully enough to:

- start the current PTR server
- authenticate with the local dev token
- upload the repo `src/` modules
- create a local user
- place a first spawn in `W5N5`
- observe the uploaded code spawning a `jrworker`
- run the current HUD/client path through the localhost browser route
- maintain the local user at the configured local test CPU cap

That means `src/` is now executing on the private PTR server instead of being limited to syntax checks.
