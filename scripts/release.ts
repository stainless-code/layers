#!/usr/bin/env bun
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Pack with Bun (resolves workspace:*) then npm-publish the tarball — Bun can't do npm OIDC/provenance.
// Build first and assert `exports` dist paths exist (CI checkout has no dist/).
// Tag after publish and on skip (partial retry): annotated `name@version` plus
// a CHANGESETS_OUTPUT `git-tag` event so action v2 can push tags / GH releases.
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

// `git tag -a` needs an identity; changesets/action `commitMode: github-api` does not set one.
async function ensureGitIdentity(): Promise<void> {
  const name = await $`git config user.name`.quiet().nothrow();
  if (name.exitCode === 0 && name.text().trim()) return;
  await $`git config user.name ${"github-actions[bot]"}`;
  await $`git config user.email ${"41898282+github-actions[bot]@users.noreply.github.com"}`;
}

function recordGitTag(packageName: string, tag: string): void {
  const out = process.env.CHANGESETS_OUTPUT;
  if (!out) return;
  appendFileSync(
    out,
    `${JSON.stringify({ type: "git-tag", tag, packageName })}\n`,
  );
}

/** @returns whether a new local tag was created */
async function ensureReleaseTag(tag: string): Promise<boolean> {
  const exists = await $`git rev-parse -q --verify ${`refs/tags/${tag}`}`
    .quiet()
    .nothrow();
  if (exists.exitCode === 0) return false;
  await ensureGitIdentity();
  await $`git tag -a ${tag} -m ${tag}`;
  return true;
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

const packageDirs = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

let published = 0;
for (const name of packageDirs) {
  const dir = join(PACKAGES_DIR, name);

  let pkg: PackageJson;
  try {
    pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  } catch {
    continue;
  }
  if (pkg.private || !pkg.name || !pkg.version) continue;

  const tag = `${pkg.name}@${pkg.version}`;

  if (await isAlreadyPublished(pkg.name, pkg.version)) {
    console.log(`Skipping ${pkg.name}@${pkg.version} (already on registry)`);
    if (await ensureReleaseTag(tag)) {
      recordGitTag(pkg.name, tag);
      console.log(`New tag: ${tag}`);
    }
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
  if (await ensureReleaseTag(tag)) {
    recordGitTag(pkg.name, tag);
    console.log(`New tag: ${tag}`);
  }
  published++;
}

console.log(`release: published ${published} package(s)`);
