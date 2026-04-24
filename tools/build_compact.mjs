#!/usr/bin/env node

import fs from "fs";
import os from "os";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const srcRoot = path.join(repoRoot, "src");
const releaseRoot = path.join(repoRoot, "release");
const outputPath = path.join(releaseRoot, "main.js");

function getModuleFiles() {
  return fs.readdirSync(srcRoot)
    .filter((file) => file.endsWith(".js"))
    .sort();
}

function buildBundleSource(files) {
  const moduleEntries = files.map((file) => {
    const moduleName = path.basename(file, ".js");
    const source = fs.readFileSync(path.join(srcRoot, file), "utf8");

    return `${JSON.stringify(moduleName)}:function(module,exports,require){\n${source}\n}`;
  });

  return `(function(){var __nativeRequire=typeof require==="function"?require:null;var __modules={${moduleEntries.join(",")}};var __cache={};function __require(name){if(Object.prototype.hasOwnProperty.call(__modules,name)){if(Object.prototype.hasOwnProperty.call(__cache,name)){return __cache[name].exports;}var module={exports:{}};__cache[name]=module;__modules[name](module,module.exports,__require);return module.exports;}if(__nativeRequire){return __nativeRequire(name);}throw new Error("Cannot find module '"+name+"'");}function __getEntry(){return __require("main");}var __bundle={__omega_require:__require,__omega_modules:Object.keys(__modules).sort(),__omega_entry:"main",__omega_getEntry:__getEntry};Object.defineProperty(__bundle,"loop",{enumerable:!0,get:function(){return __getEntry().loop;}});if(typeof module!=="undefined"&&module&&module.exports!==undefined){module.exports=__bundle;}return __bundle;})();\n`;
}

function minifyBundle(rawSource) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "screeps-omega-compact-"));
  const rawPath = path.join(tempDir, "compact.raw.js");

  fs.mkdirSync(releaseRoot, { recursive: true });
  fs.writeFileSync(rawPath, rawSource, "utf8");

  try {
    execFileSync(
      "npx",
      [
        "-y",
        "terser",
        rawPath,
        "--compress",
        "--mangle",
        "--ecma",
        "2019",
        "--output",
        outputPath,
      ],
      {
        cwd: repoRoot,
        stdio: "inherit",
      },
    );
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

const files = getModuleFiles();
const rawSource = buildBundleSource(files);

minifyBundle(rawSource);

const stats = fs.statSync(outputPath);
console.log(JSON.stringify({
  output: outputPath,
  modules: files.length,
  bytes: stats.size,
}, null, 2));
