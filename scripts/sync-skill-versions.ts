#!/usr/bin/env bun
// Keep skill metadata aligned in the changesets version PR, avoiding a separate
// stale-metadata review after each release.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FIELD = /^( *library_version:\s*")([^"]*)(")/m;
const PACKAGES_DIR = "packages";

let touched = 0;
for (const pkg of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
  if (!pkg.isDirectory()) continue;
  const pkgDir = join(PACKAGES_DIR, pkg.name);
  const manifest = join(pkgDir, "package.json");
  if (!existsSync(manifest)) continue;
  const { version } = JSON.parse(readFileSync(manifest, "utf8"));
  if (!version) continue;

  const skillsDir = join(pkgDir, "skills");
  if (!existsSync(skillsDir)) continue;
  for (const skill of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!skill.isDirectory()) continue;
    const file = join(skillsDir, skill.name, "SKILL.md");
    if (!existsSync(file)) continue;
    const before = readFileSync(file, "utf8");
    const after = before.replace(FIELD, `$1${version}$3`);
    if (after !== before) {
      writeFileSync(file, after);
      touched++;
    }
  }
}
console.log(`sync-skill-versions: ${touched} skill(s) stamped`);
