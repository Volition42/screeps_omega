#!/usr/bin/env node
"use strict";

const path = require("path");
const Module = require("module");

const repoRoot = path.resolve(__dirname, "..");
const compact = require(path.join(repoRoot, "release", "main.js"));

if (
  !compact ||
  typeof compact.__omega_require !== "function" ||
  !Array.isArray(compact.__omega_modules)
) {
  throw new Error("release/main.js did not expose the packed Screeps runtime.");
}

const bundledModules = new Set(compact.__omega_modules);
const bundledRequire = compact.__omega_require;
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (bundledModules.has(request)) {
    return bundledRequire(request);
  }

  return originalLoad.call(this, request, parent, isMain);
};

try {
  require(path.join(repoRoot, "scripts", "validation", "solo_room_harness.js"));
} finally {
  Module._load = originalLoad;
}
