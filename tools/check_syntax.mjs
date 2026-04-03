#!/usr/bin/env node

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = process.cwd();
const srcDir = join(repoRoot, "src");

function listJsFiles(dir) {
  const entries = readdirSync(dir).sort();
  const files = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...listJsFiles(fullPath));
      continue;
    }

    if (stats.isFile() && entry.endsWith(".js")) {
      files.push(fullPath);
    }
  }

  return files;
}

const files = listJsFiles(srcDir);

if (files.length === 0) {
  console.error(`No .js files found in ${srcDir}`);
  process.exit(1);
}

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(`Syntax OK: ${files.length} files checked with ${process.version}`);
