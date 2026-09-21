#!/usr/bin/env node
// Fails if a file over 5MB is added anywhere outside assets/vendor/ — this
// repo has no build step, so anything committed ships verbatim to Vercel.
const { execFileSync } = require("child_process");

const MAX = 5 * 1024 * 1024;
const tracked = execFileSync("git", ["ls-files"]).toString().split("\n").filter(Boolean);

let bad = [];
for (const f of tracked) {
  if (f.startsWith("assets/vendor/")) continue;
  let size;
  try {
    size = Number(execFileSync("git", ["cat-file", "-s", `HEAD:${f}`]).toString().trim());
  } catch (e) {
    continue; // not in HEAD (e.g. new file not yet committed in this check context)
  }
  if (size > MAX) bad.push(`${f} — ${(size / 1024 / 1024).toFixed(1)}MB`);
}

if (bad.length) {
  console.error("Files over 5MB outside assets/vendor/:\n  " + bad.join("\n  "));
  process.exit(1);
}
console.log("✓ no oversized files outside assets/vendor/");
