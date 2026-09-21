// Minimal glob for flat "dir/*.ext" patterns only — enough for this repo's
// checks without adding a dependency.
const fs = require("fs");
const path = require("path");

function globSync(pattern) {
  const m = pattern.match(/^([^*]+)\*(\.[a-zA-Z0-9]+)$/);
  if (!m) throw new Error(`Unsupported glob pattern: ${pattern}`);
  const [, dirPrefix, ext] = m;
  const dir = dirPrefix.replace(/\/$/, "");
  const root = path.resolve(__dirname, "../..");
  const abs = path.join(root, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs)
    .filter(f => f.endsWith(ext))
    .map(f => path.join(dir, f));
}

module.exports = { globSync };
