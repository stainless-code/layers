// The upgrade skill judges this artifact instead of querying external sources;
// source URLs keep its conclusions grounded in captured evidence.

import { readdirSync } from "node:fs";

type BumpClass = "patch" | "minor" | "major" | "prerelease" | "no-op";

interface OutdatedPkg {
  pkg: string;
  current: string;
  latest: string;
  bumpClass: BumpClass;
  coupledWith: string[];
}

interface AdvisoryVuln {
  id: string;
  cveId: string | null;
  severity: string;
  vulnerableRange: string | null;
  fixedIn: string | null;
  installedInRange: boolean;
  verdict:
    | "priority-bump"
    | "needs-higher-target"
    | "cleared-at-current"
    | "unpatched"
    | "check-failed"; // Collection failure is inconclusive, not a vulnerability.
  url: string;
  error?: string;
}

interface Delta {
  version: string;
  date: string | null;
  breaking: string[];
  deprecations: string[];
  features: string[];
  security: string[];
  peerEngine: string[];
  releaseNotes: string | null;
  diffUrl: string | null;
  changelogUrl: string | null;
  source: "github-release" | "none";
  error: string | null;
}

interface Usage {
  importedSymbols: string[];
  typeOnlySymbols: string[];
  sites: string[];
  callSites: string[];
  source: "codemap" | "grep";
}

interface Evidence {
  generatedAt: string;
  inventory: {
    direct: {
      name: string;
      version: string;
      range: "exact" | "caret" | "tilde";
      dev: boolean;
    }[];
    transitiveDuplicates: { pkg: string; versions: string[] }[];
  };
  outdated: OutdatedPkg[];
  audit: {
    bunAudit: unknown;
    ghsa: { pkg: string; advisories: AdvisoryVuln[] }[];
  };
  deltas: Record<string, Delta[]>;
  usage: Record<string, Usage>;
}

async function run(
  cmd: string[],
  opts: { cwd?: string; retries?: number } = {},
): Promise<string> {
  const retries = opts.retries ?? 0;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (cmd[0] === "gh") await ghGate();
    const proc = Bun.spawn(cmd, {
      stdout: "pipe",
      stderr: "pipe",
      cwd: opts.cwd ?? process.cwd(),
    });
    const [stdout, stderr] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ]);
    const code = await proc.exited;
    if (code === 0) return stdout;
    if (attempt < retries) {
      // gh secondary rate-limit / transient failures: back off and retry.
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }
    throw new Error(`${cmd.join(" ")} exited ${code}\n${stderr.slice(0, 500)}`);
  }
  throw new Error("unreachable");
}

async function runSoft(
  cmd: string[],
): Promise<{ ok: boolean; stdout: string; code: number }> {
  const proc = Bun.spawn(cmd, {
    stdout: "pipe",
    stderr: "pipe",
    cwd: process.cwd(),
  });
  // Drain stderr alongside stdout — a full pipe buffer deadlocks the subprocess.
  const [stdout, , code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  return { ok: code === 0, stdout, code };
}

// Pace GitHub calls to avoid its secondary burst limit.
let lastGhCall = 0;
const GH_MIN_GAP_MS = 1000;
async function ghGate() {
  const wait = GH_MIN_GAP_MS - (Date.now() - lastGhCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGhCall = Date.now();
}

// Disk cache for gh release/advisory data — iterative runs don't re-fetch,
// avoiding repeated rate-limit failures.

const SCRIPT_DIR = import.meta.dir;
const CACHE_DIR = `${SCRIPT_DIR}/.cache`;
const DEFAULT_OUT = `${SCRIPT_DIR}/artifact.json`;
const CACHE_MAX_AGE_MS = 1000 * 60 * 60; // 1 hour

function cachePath(key: string): string {
  return `${CACHE_DIR}/${key.replace(/[^a-z0-9._-]/gi, "_")}.json`;
}

async function readCache(key: string): Promise<string | null> {
  const f = Bun.file(cachePath(key));
  if (!(await f.exists())) return null;
  if (Date.now() - f.lastModified > CACHE_MAX_AGE_MS) return null;
  return await f.text();
}

async function writeCache(key: string, data: string): Promise<void> {
  try {
    await Bun.write(cachePath(key), data);
  } catch {
    // Evidence collection must continue if the cache is unwritable.
  }
}

/** bun emits a `[Xms] ".env"` header before JSON output — strip leading non-JSON lines. */
function stripBunHeader(s: string): string {
  const lines = s.split("\n");
  let i = 0;
  while (
    i < lines.length &&
    !lines[i].trim().startsWith("{") &&
    !lines[i].trim().startsWith("[")
  )
    i++;
  return lines.slice(i).join("\n");
}

function parseVer(v: string): number[] {
  const core = v.split(/[-+]/)[0];
  return core.split(".").map((n) => Number(n) || 0);
}

function cmpVer(a: string, b: string): number {
  const pa = parseVer(a);
  const pb = parseVer(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

function isPrerelease(v: string): boolean {
  return /-(dev|canary|next|beta|alpha|rc|preview)/i.test(v);
}

function bumpClass(current: string, latest: string): BumpClass {
  if (cmpVer(current, latest) === 0) return "no-op";
  if (isPrerelease(latest) || isPrerelease(current)) return "prerelease";
  const [ca, cb] = parseVer(current);
  const [la, lb] = parseVer(latest);
  if (la !== ca) return "major";
  if (ca === 0) return lb !== cb ? "minor" : "patch";
  return lb !== cb ? "minor" : "patch";
}

function semverInRange(version: string, range: string | null): boolean {
  if (!range) return false;
  // Covers GHSA comparator groups without adding `semver` to this dev script.
  const orGroups = range.split("||");
  for (const group of orGroups) {
    const clauses = group
      .split(/,|\s+(?=(?:>=|<=|>|<|=))/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (clauses.length === 0) continue;
    let groupOk = true;
    for (const clause of clauses) {
      const m = clause.match(/^(>=|<=|>|<|=)?\s*(\d[^-+]*)/);
      if (!m) continue;
      const [, op, ver] = m;
      const c = cmpVer(version, ver);
      if (op === ">=" && !(c >= 0)) groupOk = false;
      if (op === ">" && !(c > 0)) groupOk = false;
      if (op === "<=" && !(c <= 0)) groupOk = false;
      if (op === "<" && !(c < 0)) groupOk = false;
      if ((!op || op === "=") && c !== 0) groupOk = false;
    }
    if (groupOk) return true;
  }
  return false;
}

const HIGH_RISK = [
  "better-sqlite3",
  "oxc-parser",
  "oxc-resolver",
  "lightningcss",
  "zod",
  "@modelcontextprotocol/sdk",
  "chokidar",
  "tsdown",
];

function workspaceManifests(): string[] {
  const manifests = ["package.json"];
  try {
    for (const entry of readdirSync("packages", { withFileTypes: true })) {
      if (entry.isDirectory()) {
        manifests.push(`packages/${entry.name}/package.json`);
      }
    }
  } catch {
    // The root manifest is sufficient in a single-package repository.
  }
  return manifests;
}

async function parsePackageJson(): Promise<Evidence["inventory"]> {
  const direct: Evidence["inventory"]["direct"] = [];
  const classify = (v: string): "exact" | "caret" | "tilde" =>
    v.startsWith("^") ? "caret" : v.startsWith("~") ? "tilde" : "exact";
  // Internal workspace dependencies are not registry-upgradable.
  const seen = new Set<string>();
  const add = (name: string, version: string, dev: boolean) => {
    if (version.startsWith("workspace:")) return;
    const key = `${name}@${version}:${dev}`;
    if (seen.has(key)) return;
    seen.add(key);
    direct.push({ name, version, range: classify(version), dev });
  };
  for (const manifest of workspaceManifests()) {
    const raw = await Bun.file(manifest)
      .text()
      .catch(() => "");
    if (!raw) continue;
    const pkg = JSON.parse(raw);
    for (const [name, version] of Object.entries<string>(
      pkg.dependencies ?? {},
    )) {
      add(name, version, false);
    }
    for (const [name, version] of Object.entries<string>(
      pkg.devDependencies ?? {},
    )) {
      add(name, version, true);
    }
  }
  const lock = await Bun.file("bun.lock")
    .text()
    .catch(() => "");
  const versionMap = new Map<string, Set<string>>();
  for (const m of lock.matchAll(/"(@?[^"@]+)@([^"@]+)"/g)) {
    const [, name, ver] = m;
    if (!versionMap.has(name)) versionMap.set(name, new Set());
    versionMap.get(name)!.add(ver);
  }
  const directNames = new Set(direct.map((d) => d.name));
  const transitiveDuplicates: Evidence["inventory"]["transitiveDuplicates"] =
    [];
  for (const [name, versions] of versionMap) {
    if (versions.size < 2) continue;
    const vers = [...versions];
    const hasDirect = directNames.has(name);
    const majorSplit = new Set(vers.map((v) => parseVer(v)[0])).size > 1;
    // Same-major transitive-only duplicates are intentionally ignored.
    if (hasDirect || majorSplit) {
      transitiveDuplicates.push({
        pkg: name,
        versions: vers.sort((a, b) => cmpVer(a, b)),
      });
    }
  }
  return { direct, transitiveDuplicates };
}

async function parseBunOutdated(): Promise<OutdatedPkg[]> {
  // `--filter '*'` covers every workspace package (root-only `bun outdated`
  // misses per-package deps). Adds a trailing `Workspace` column and appends
  // ` (dev)`/` (peer)` to the package name — both handled below.
  const { stdout } = await runSoft(["bun", "outdated", "--filter", "*"]);
  const out: OutdatedPkg[] = [];
  const seen = new Set<string>();
  for (const line of stdout.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((s) => s.trim());
    if (cells.length < 4) continue;
    const [pkgRaw, current, , latest] = cells;
    if (!pkgRaw || pkgRaw === "Package" || pkgRaw.startsWith("---")) continue;
    const pkg = pkgRaw.replace(/\s*\((?:dev|peer|optional)\)\s*$/, "");
    if (!current || !latest || current === latest) continue;
    const key = `${pkg}@${current}->${latest}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      pkg,
      current,
      latest,
      bumpClass: bumpClass(current, latest),
      coupledWith: [],
    });
  }
  return out;
}

async function runBunAudit(): Promise<unknown> {
  const { stdout } = await runSoft(["bun", "audit", "--json"]);
  const body = stripBunHeader(stdout);
  try {
    return JSON.parse(body);
  } catch {
    return {
      error: "could not parse bun audit output",
      raw: body.slice(0, 500),
    };
  }
}

async function ghsaSpotCheck(
  pkgs: string[],
  installed: Map<string, string>,
  target: Map<string, string>,
): Promise<Evidence["audit"]["ghsa"]> {
  const out: Evidence["audit"]["ghsa"] = [];
  for (const pkg of pkgs) {
    try {
      const cacheKey = `ghsa:${pkg}`;
      const cached = await readCache(cacheKey);
      const raw =
        cached ??
        (await run(
          [
            "gh",
            "api",
            "-X",
            "GET",
            "/advisories",
            "-f",
            "ecosystem=npm",
            "-f",
            `affects=${pkg}`,
          ],
          { retries: 2 },
        ));
      const list = JSON.parse(raw);
      if (!Array.isArray(list)) {
        throw new Error(
          `non-array response from gh api advisories: ${String(list).slice(0, 120)}`,
        );
      }
      if (!cached) await writeCache(cacheKey, JSON.stringify(list));
      const advisories: AdvisoryVuln[] = [];
      for (const a of list) {
        const vuln =
          a.vulnerabilities?.find((v: any) => v.package?.name === pkg) ??
          a.vulnerabilities?.[0] ??
          {};
        const range: string | null = vuln.vulnerable_version_range ?? null;
        const fixedIn: string | null =
          vuln.first_patched_version?.identifier ??
          vuln.first_patched_version ??
          null;
        const installedVer = installed.get(pkg) ?? "";
        const targetVer = target.get(pkg) ?? "";
        const inRange = installedVer
          ? semverInRange(installedVer, range)
          : false;
        let verdict: AdvisoryVuln["verdict"] = "unpatched";
        if (inRange && fixedIn && targetVer && cmpVer(fixedIn, targetVer) <= 0)
          verdict = "priority-bump";
        else if (
          inRange &&
          fixedIn &&
          targetVer &&
          cmpVer(fixedIn, targetVer) > 0
        )
          verdict = "needs-higher-target";
        else if (!inRange) verdict = "cleared-at-current";
        advisories.push({
          id: a.ghsa_id,
          cveId: a.cve_id ?? null,
          severity: a.severity ?? "unknown",
          vulnerableRange: range,
          fixedIn,
          installedInRange: inRange,
          verdict,
          url: `https://github.com/advisories/${a.ghsa_id}`,
        });
      }
      out.push({ pkg, advisories });
    } catch (e) {
      out.push({
        pkg,
        advisories: [
          {
            id: "error",
            cveId: null,
            severity: "unknown",
            vulnerableRange: null,
            fixedIn: null,
            installedInRange: false,
            verdict: "check-failed",
            url: "",
            error: e instanceof Error ? e.message : String(e),
          },
        ],
      });
    }
  }
  return out;
}

async function getRepoSlug(
  pkg: string,
): Promise<{ owner: string; repo: string } | null> {
  try {
    const raw = stripBunHeader(
      await run(["bun", "pm", "view", pkg, "repository", "--json"], {
        retries: 2,
      }),
    );
    const data = JSON.parse(raw);
    const url: string = data.url ?? "";
    // Preserve dots in repo names (e.g. mozilla/pdf.js); strip a trailing .git.
    const m = url.match(
      /github\.com[/:]([^/]+)\/([^/#?]+?)(?:\.git)?(?:[/?#].*)?$/,
    );
    return m ? { owner: m[1], repo: m[2] } : null;
  } catch {
    return null;
  }
}

async function getVersions(pkg: string): Promise<string[]> {
  try {
    const raw = stripBunHeader(
      await run(["bun", "pm", "view", pkg, "versions", "--json"], {
        retries: 2,
      }),
    );
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function gatherDeltas(
  pkg: string,
  current: string,
  target: string,
): Promise<Delta[]> {
  if (isPrerelease(target) || isPrerelease(current)) {
    return [
      {
        version: target,
        date: null,
        breaking: [],
        deprecations: [],
        features: [],
        security: [],
        peerEngine: [],
        releaseNotes: null,
        diffUrl: null,
        changelogUrl: null,
        source: "none",
        error:
          "prerelease/moving-target build — no per-version changelog; gate on same-major-line only",
      },
    ];
  }
  const slug = await getRepoSlug(pkg);
  if (!slug) {
    return [
      {
        version: target,
        date: null,
        breaking: [],
        deprecations: [],
        features: [],
        security: [],
        peerEngine: [],
        releaseNotes: null,
        diffUrl: null,
        changelogUrl: null,
        source: "none",
        error: "no github repository found",
      },
    ];
  }
  const { owner, repo } = slug;
  const allVersions = await getVersions(pkg);
  const inRange = allVersions
    .filter(
      (v) =>
        !isPrerelease(v) && cmpVer(v, current) > 0 && cmpVer(v, target) <= 0,
    )
    .sort((a, b) => cmpVer(a, b));

  // Resolve actual tags once because repositories use incompatible tag formats.
  const releases = await fetchReleaseMap(owner, repo);
  const tagOf = (v: string): string | null => releases.get(v)?.tagName ?? null;

  const deltas: Delta[] = [];
  let prevTag = tagOf(current) ?? `v${current}`;
  for (const v of inRange) {
    const rel = tagOf(v) ? releases.get(v) : null;
    const tag = rel?.tagName ?? null;
    const diffUrl = tag
      ? `https://github.com/${owner}/${repo}/compare/${prevTag}...${tag}`
      : null;
    const body = rel?.body ?? null;
    const date = rel?.publishedAt ?? null;
    const source: Delta["source"] = rel ? "github-release" : "none";
    const error = rel
      ? null
      : `no github release for ${pkg}@${v} (${releases.size} releases scanned — likely a gh secondary rate-limit or monorepo squashed release; deep-dive via changelogUrl)`;
    // Preserve a source link even when no version-specific release was found.
    const changelogUrl = tag
      ? `https://github.com/${owner}/${repo}/releases/tag/${tag}`
      : `https://github.com/${owner}/${repo}/releases`;
    deltas.push({
      version: v,
      date,
      breaking: extractLines(body, /breaking|breaking change/i),
      deprecations: extractLines(body, /deprecat|removed export/i),
      features: extractLines(body, /^feat|feature|^add|^new/i),
      security: extractLines(
        body,
        /security|cve|prototype pollution|vulnerabilit/i,
      ),
      peerEngine: extractLines(
        body,
        /peer dep|engine|requires (node|bun|react)/i,
      ),
      releaseNotes: body,
      diffUrl,
      changelogUrl,
      source,
      error,
    });
    if (tag) prevTag = tag;
  }
  if (deltas.length === 0) {
    deltas.push({
      version: target,
      date: null,
      breaking: [],
      deprecations: [],
      features: [],
      security: [],
      peerEngine: [],
      releaseNotes: null,
      diffUrl: null,
      changelogUrl: null,
      source: "none",
      error: "no versions found in range",
    });
  }
  return deltas;
}

async function fetchReleaseMap(
  owner: string,
  repo: string,
): Promise<
  Map<
    string,
    { tagName: string; publishedAt: string | null; body: string | null }
  >
> {
  const map = new Map<
    string,
    { tagName: string; publishedAt: string | null; body: string | null }
  >();
  const cacheKey = `releases:${owner}/${repo}`;
  try {
    const cached = await readCache(cacheKey);
    const raw =
      cached ??
      (await run([
        "gh",
        "api",
        `repos/${owner}/${repo}/releases?per_page=100`,
      ]));
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) {
      // gh returns a JSON object (e.g. {"message":"secondary rate limit"}) on rate-limit — not an array.
      throw new Error(
        `non-array response from gh api releases: ${String(raw).slice(0, 120)}`,
      );
    }
    if (!cached) await writeCache(cacheKey, JSON.stringify(list));
    for (const r of list) {
      const m = (r.tag_name as string).match(/(\d+\.\d+\.\d+(?:-[\w.]+)?)/);
      if (m)
        map.set(m[1], {
          tagName: r.tag_name,
          publishedAt: r.published_at ?? null,
          body: r.body ? String(r.body).slice(0, 1200) : null,
        });
    }
  } catch {
    // repo has no releases or gh failed (secondary rate-limit / not found) — empty map; caller records error per version.
  }
  return map;
}

function extractLines(body: string | null, re: RegExp): string[] {
  if (!body) return [];
  return body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => re.test(l) && l.length > 0)
    .slice(0, 6)
    .map((l) => l.replace(/^[#*\-\s]+/, "").slice(0, 160));
}

let codemapAvailable: boolean | null = null;

async function checkCodemap(): Promise<boolean> {
  if (codemapAvailable !== null) return codemapAvailable;
  const { ok } = await runSoft([
    "bunx",
    "codemap",
    "query",
    "--json",
    "SELECT 1 AS ok",
  ]);
  codemapAvailable = ok;
  return codemapAvailable;
}

async function codemapQuery(sql: string): Promise<any[]> {
  const raw = stripBunHeader(
    await run(["bunx", "codemap", "query", "--json", sql], {
      retries: 1,
    }),
  );
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function sqlEscape(s: string): string {
  return s.replace(/'/g, "''");
}

function parseSpecifiers(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {}
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Batch imports and references across all packages to avoid per-package queries,
// then scope references to each package's importing files and symbols.
async function gatherAllUsage(pkgs: string[]): Promise<Map<string, Usage>> {
  const result = new Map<string, Usage>();
  if (!pkgs.length) return result;
  if (!(await checkCodemap())) return result;

  const inList = pkgs.map((p) => `'${sqlEscape(p)}'`).join(",");
  const likeClauses = pkgs
    .map((p) => `source LIKE '${sqlEscape(p)}/%'`)
    .join(" OR ");
  const importRows = await codemapQuery(
    `SELECT source, file_path, line_number, specifiers, is_type_only FROM imports WHERE source IN (${inList}) OR ${likeClauses}`,
  );

  const perPkg = new Map<
    string,
    {
      sites: Set<string>;
      imported: Set<string>;
      typeOnly: Set<string>;
      files: Set<string>;
    }
  >();
  for (const p of pkgs)
    perPkg.set(p, {
      sites: new Set(),
      imported: new Set(),
      typeOnly: new Set(),
      files: new Set(),
    });

  for (const r of importRows) {
    const pkg = pkgs.find(
      (p) => r.source === p || r.source.startsWith(p + "/"),
    );
    if (!pkg) continue;
    const bucket = perPkg.get(pkg)!;
    bucket.sites.add(`${r.file_path}:${r.line_number}`);
    bucket.files.add(r.file_path);
    for (const s of parseSpecifiers(r.specifiers)) {
      (r.is_type_only ? bucket.typeOnly : bucket.imported).add(s);
    }
  }

  const allFiles = new Set<string>();
  const allSpecs = new Set<string>();
  for (const b of perPkg.values()) {
    for (const f of b.files) allFiles.add(f);
    for (const s of b.imported) allSpecs.add(s);
    for (const s of b.typeOnly) allSpecs.add(s);
  }
  const refByFile = new Map<string, { name: string; line: number }[]>();
  if (allFiles.size && allSpecs.size) {
    const fileList = [...allFiles].map((f) => `'${sqlEscape(f)}'`).join(",");
    const specList = [...allSpecs].map((s) => `'${sqlEscape(s)}'`).join(",");
    const refRows = await codemapQuery(
      `SELECT r.file_path, r.line_start, r.name FROM "references" r JOIN bindings b ON b.reference_id = r.id WHERE b.resolution_kind='imported' AND r.name IN (${specList}) AND r.file_path IN (${fileList})`,
    );
    for (const r of refRows) {
      const key = r.file_path;
      if (!refByFile.has(key)) refByFile.set(key, []);
      refByFile.get(key)!.push({ name: r.name, line: r.line_start });
    }
  }

  for (const [pkg, b] of perPkg) {
    const specs = new Set<string>([...b.imported, ...b.typeOnly]);
    const callSites = new Set<string>();
    for (const f of b.files) {
      for (const ref of refByFile.get(f) ?? []) {
        if (specs.has(ref.name)) callSites.add(`${f}:${ref.line}`);
      }
    }
    result.set(pkg, {
      importedSymbols: [...b.imported].slice(0, 30),
      typeOnlySymbols: [...b.typeOnly].slice(0, 30),
      sites: [...b.sites].slice(0, 30),
      callSites: [...callSites].slice(0, 30),
      source: "codemap",
    });
  }
  return result;
}

async function grepUsage(pkg: string): Promise<Usage> {
  const pattern = `from ['"]${pkg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/[^'"]*)?['"]`;
  const { stdout } = await runSoft([
    "rg",
    "-n",
    "--type",
    "ts",
    "-g",
    "!**/node_modules/**",
    pattern,
  ]);
  const sites: string[] = [];
  const imported = new Set<string>();
  for (const line of stdout.split("\n").filter(Boolean)) {
    const m = line.match(/^([^:]+):(\d+):.*(import\s+([^]*?)\s+from)/);
    if (m) {
      sites.push(`${m[1]}:${m[2]}`);
      m[4]
        .replace(/[{}\s]/g, "")
        .split(",")
        .forEach((s) => s && imported.add(s));
    }
  }
  return {
    importedSymbols: [...imported].slice(0, 20),
    typeOnlySymbols: [],
    sites: sites.slice(0, 12),
    callSites: [],
    source: "grep",
  };
}

async function gatherAllUsageWithFallback(
  pkgs: string[],
): Promise<Map<string, Usage>> {
  try {
    const mapped = await gatherAllUsage(pkgs);
    if (mapped.size === pkgs.length) return mapped;
    for (const p of pkgs) {
      if (!mapped.has(p)) mapped.set(p, await grepUsage(p));
    }
    return mapped;
  } catch {
    const mapped = new Map<string, Usage>();
    for (const p of pkgs) mapped.set(p, await grepUsage(p));
    return mapped;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const onlyIdx = args.indexOf("--only");
  const onlyPkg = onlyIdx >= 0 ? args[onlyIdx + 1] : null;
  const outIdx = args.indexOf("--out");
  const outPath = outIdx >= 0 ? args[outIdx + 1] : DEFAULT_OUT;

  console.error("→ inventory");
  const inventory = await parsePackageJson();
  const installed = new Map(
    inventory.direct.map((d) => [d.name, d.version.replace(/^[~^]/, "")]),
  );

  console.error("→ bun outdated");
  let outdated = await parseBunOutdated();
  if (onlyPkg) outdated = outdated.filter((o) => o.pkg === onlyPkg);
  const target = new Map(outdated.map((o) => [o.pkg, o.latest]));

  console.error("→ bun audit");
  const bunAudit = await runBunAudit();

  console.error("→ ghsa spot-check");
  const ghsaPkgs = (onlyPkg ? [onlyPkg] : HIGH_RISK).filter(
    (p) => installed.has(p) || target.has(p),
  );
  const ghsa = await ghsaSpotCheck(ghsaPkgs, installed, target);

  console.error("→ deltas");
  const deltas: Record<string, Delta[]> = {};
  for (const o of outdated) {
    console.error(`   ${o.pkg} ${o.current} → ${o.latest}`);
    deltas[o.pkg] = await gatherDeltas(o.pkg, o.current, o.latest);
  }

  console.error("→ usage (batched codemap)");
  const usageMap = await gatherAllUsageWithFallback(outdated.map((o) => o.pkg));
  const usage: Record<string, Usage> = {};
  for (const o of outdated)
    usage[o.pkg] = usageMap.get(o.pkg) ?? (await grepUsage(o.pkg));

  const evidence: Evidence = {
    generatedAt: new Date().toISOString(),
    inventory,
    outdated,
    audit: { bunAudit, ghsa },
    deltas,
    usage,
  };

  const json = JSON.stringify(evidence, null, 2);
  if (outPath) {
    await Bun.write(outPath, json);
    console.error(`✓ wrote ${outPath}`);
  } else {
    console.log(json);
  }
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
