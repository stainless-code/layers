import fs from "node:fs";
import path from "node:path";

function toPosixRel(file) {
  return path.relative(process.cwd(), file).replace(/\\/g, "/");
}

function packageDirOf(relFile) {
  const m = /^(packages\/[^/]+)\//.exec(relFile);
  return m ? m[1] : null;
}

// Limit expensive checks to packages containing staged TypeScript files.
// Returns an array of commands: lint-staged runs each separately (no shell),
// so a single `&&`-joined string would pass `&&`/`--filter` as literal args.
function affectedPackageChecks(filenames) {
  const dirs = new Set();
  for (const f of filenames) {
    const dir = packageDirOf(toPosixRel(f));
    if (dir) dirs.add(dir);
  }
  const tasks = [];
  for (const dir of dirs) {
    tasks.push(`bun run --filter ./${dir} typecheck`);
    tasks.push(`bun run --filter ./${dir} test`);
    if (fs.existsSync(path.join(dir, "vitest.config.ts"))) {
      tasks.push(`bun run --filter ./${dir} test:dom`);
    }
  }
  return tasks;
}

/** @type {import('lint-staged').Configuration} */
export default {
  "*.{js,jsx,ts,tsx,mjs,mts,cjs,cts}": ["bun run format:check", "bun run lint"],
  "*.{css,json,md,mdc,html,yaml,yml}": "bun run format:check",
  "packages/*/**/*.{ts,tsx}": affectedPackageChecks,
};
