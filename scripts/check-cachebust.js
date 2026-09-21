#!/usr/bin/env node
// Fails if index.html references a ?v= cache-bust query that is older than
// the file it points at was last modified in git — a stale query means a
// browser (especially mobile) can keep serving an old copy of that asset.
// See CLAUDE.md "Editing tips".
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const re = /(?:src|href)="(assets\/[^"?]+)\?v=(\d{8})"/g;

function lastCommitDate(file) {
  try {
    const out = execFileSync("git", ["log", "-1", "--format=%cs", "--", file], { cwd: root }).toString().trim();
    return out ? out.replace(/-/g, "") : null;
  } catch (e) {
    return null;
  }
}

let stale = [];
let m;
while ((m = re.exec(html))) {
  const [, rel, ver] = m;
  const commitDate = lastCommitDate(rel);
  // Only flag files with git history whose last commit is strictly newer
  // than the query string — a same-day bump is fine.
  if (commitDate && commitDate > ver) stale.push(`${rel} — last changed ${commitDate}, cache-bust says ${ver}`);
}

if (stale.length) {
  console.error("Stale ?v= cache-bust query on:\n  " + stale.join("\n  "));
  console.error("\nBump the ?v= for these assets in index.html.");
  process.exit(1);
}
console.log("✓ cache-bust versions are current");
