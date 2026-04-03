#!/usr/bin/env python3
from __future__ import annotations

import os
from pathlib import Path


CLIENT_ROOT = Path(
    os.environ.get(
        "SCREEPS_BROWSER_CLIENT_DIR",
        str(Path.home() / "screeps_browser_client"),
    )
)


def patch_text(path: Path, before: str, after: str) -> None:
    text = path.read_text(encoding="utf8")
    if after in text:
        return
    if before not in text:
        raise SystemExit(f"expected text not found in {path}")
    path.write_text(text.replace(before, after), encoding="utf8")


def main() -> int:
    client_app = CLIENT_ROOT / "node_modules" / "screepers-steamless-client" / "dist" / "clientApp.js"
    if not client_app.exists():
        raise SystemExit(f"browser client install not found at {client_app}")

    patch_text(
        client_app,
        "import { fileURLToPath, URL as URL$1 } from 'url';\n",
        "import { fileURLToPath, pathToFileURL, URL as URL$1 } from 'url';\n",
    )
    patch_text(
        client_app,
        "function clientAuth(backend, guest) {\n",
        "function clientAuth(backend, guest, localToken, localBackend) {\n",
    )
    patch_text(
        client_app,
        "    localStorage.tipTipOfTheDay = '-1';\n",
        "    localStorage.tipTipOfTheDay = '-1';\n"
        "    if (localToken && localBackend && backend === localBackend) {\n"
        "        const authValue = JSON.stringify(localToken);\n"
        "        localStorage.auth = authValue;\n"
        "        localStorage.prevAuth = authValue;\n"
        "        localStorage.lastToken = Date.now();\n"
        "    }\n",
    )
    patch_text(
        client_app,
        "    async apply(src, server, argv) {\n        const { backend } = server;\n        // Inject startup script\n        const header = '<title>Screeps</title>';\n        const replaceHeader = [header, generateScriptTag(clientAuth, { backend, guest: argv.guest })].join('\\n');\n",
        "    async apply(src, server, argv) {\n        const { backend } = server;\n        const localToken = process.env.SCREEPS_LOCAL_TOKEN || '';\n        const localBackend = process.env.SCREEPS_SERVER_PUBLIC_URL || process.env.SCREEPS_SERVER_URL || '';\n        // Inject startup script\n        const header = '<title>Screeps</title>';\n        const replaceHeader = [header, generateScriptTag(clientAuth, { backend, guest: argv.guest, localToken, localBackend })].join('\\n');\n",
    )
    patch_text(
        client_app,
        "const koa = new Koa();\nconst { host, port } = argv;\n",
        "const koa = new Koa();\nconst extensionModulePath = process.env.SCREEPS_BROWSER_EXTENSION_MODULE;\nif (extensionModulePath) {\n    const extensionModule = await import(pathToFileURL(extensionModulePath).href);\n    if (typeof extensionModule.register === 'function') {\n        await extensionModule.register({ koa, argv, publicURL, hostURL });\n    }\n}\nconst { host, port } = argv;\n",
    )

    print(f"patched {client_app}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
