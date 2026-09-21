#!/usr/bin/env node
// Syntax-check every JS file in assets/js and assets/data (no build step, so
// this is the cheapest possible regression guard). Run via `npm test` or CI.
const { execFileSync } = require("child_process");
const { globSync } = require("./lib/glob");

const files = [
  ...globSync("assets/js/*.js"),
  ...globSync("assets/data/*.js"),
  ...globSync("scripts/*.js"),
  "sw.js"
];

let failed = false;
for (const f of files) {
  try {
    execFileSync(process.execPath, ["--check", f], { stdio: "pipe" });
  } catch (e) {
    failed = true;
    console.error(`✗ ${f}`);
    console.error(e.stderr ? e.stderr.toString() : e.message);
  }
}
if (failed) {
  console.error("\nSyntax check failed.");
  process.exit(1);
}
console.log(`✓ ${files.length} JS files parse cleanly`);
