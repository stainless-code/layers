#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Pack with Bun (resolves workspace:*) then npm-publish the tarball — Bun can't do npm OIDC/provenance.
// Build first and assert `exports` dist paths exist (CI checkout has no dist/).
// After publish: annotated `name@version` tag + `New tag:` line for changesets/action (push + GitHub Release).
// Skip versions already on the registry so partial releases can retry.
import { $ } from "bun";

const PACKAGES_DIR = "packages";

interface PackageJson {
  name?: string;
  version?: string;
  private?: boolean;
  exports?: unknown;
}

async function isAlreadyPublished(
  name: string,
  version: string,
): Promise<boolean> {
  const spec = `${name}@${version}`;
  const res = await $`npm view ${spec}`.quiet().nothrow();
  return res.exitCode === 0;
}

async function ensureReleaseTag(tag: string): Promise<void> {
  const exists = await $`git rev-parse -q --verify ${`refs/tags/${tag}`}`
    .quiet()
    .nothrow();
  if (exists.exitCode === 0) return;
  await $`git tag -a ${tag} -m ${tag}`;
}

function distExportPaths(exportsField: unknown): string[] {
  const out = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      if (value.startsWith("./dist/")) out.add(value.slice(2));
      return;
    }
    if (value && typeof value === "object") {
      for (const nested of Object.values(value as Record<string, unknown>)) {
        visit(nested);
      }
    }
  };
  visit(exportsField);
  return [...out].sort();
}

function assertDistReady(dir: string, pkg: PackageJson): void {
  const missing = distExportPaths(pkg.exports).filter(
    (rel) => !existsSync(join(dir, rel)),
  );
  if (missing.length === 0) return;
  throw new Error(
    `${pkg.name}: missing dist export targets after build:\n  - ${missing.join("\n  - ")}`,
  );
}

console.log("release: building packages…");
await $`bun run build`;

let published = 0;
for (const entry of readdirSync(PACKAGES_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const dir = join(PACKAGES_DIR, entry.name);

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    continue;
  }
  if (pkg.private || !pkg.name || !pkg.version) continue;

  if (await isAlreadyPublished(pkg.name, pkg.version)) {
    console.log(`Skipping ${pkg.name}@${pkg.version} (already on registry)`);
    continue;
  }

  assertDistReady(dir, pkg);

  const packOut = await $`bun pm pack`.cwd(dir).text();
  const tarball = packOut
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.endsWith(".tgz"))
    .pop();
  if (!tarball) {
    throw new Error(`Could not determine packed tarball for ${pkg.name}`);
  }

  await $`npm publish ${tarball} --provenance --access public`.cwd(dir);
  const tag = `${pkg.name}@${pkg.version}`;
  await ensureReleaseTag(tag);
  console.log(`New tag: ${tag}`);
  published++;
}

console.log(`release: published ${published} package(s)`);
