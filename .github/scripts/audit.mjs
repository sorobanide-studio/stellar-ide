#!/usr/bin/env node
/**
 * Dependency vulnerability gate for CI.
 *
 * Runs `npm audit --json` in the current working directory and fails the job
 * when an unfixed advisory at or above HIGH severity is present. LOW and
 * MODERATE advisories are printed but never fail the build, so the check stays
 * actionable.
 *
 * An advisory that has no upstream fix can be suppressed by adding an entry to
 * `.github/audit-allowlist.json`. Every entry must carry an `expires` date in
 * `YYYY-MM-DD` form; once that date has passed the suppression stops applying
 * and the advisory fails the build again, so an entry cannot live forever.
 * The format is documented in that file.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SEVERITY_RANK = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };
const FAIL_AT = 3; // high

const scriptDir = dirname(fileURLToPath(import.meta.url));
const allowlistPath = resolve(scriptDir, "..", "audit-allowlist.json");

function loadAllowlist() {
  if (!existsSync(allowlistPath)) return [];
  const parsed = JSON.parse(readFileSync(allowlistPath, "utf8"));
  return Array.isArray(parsed.allow) ? parsed.allow : [];
}

function isActive(entry, now) {
  if (!entry || !entry.expires) return false;
  const expires = new Date(`${entry.expires}T23:59:59Z`);
  return Number.isFinite(expires.getTime()) && expires >= now;
}

function runAudit() {
  try {
    return JSON.parse(
      execFileSync("npm", ["audit", "--json"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        maxBuffer: 32 * 1024 * 1024,
      }),
    );
  } catch (error) {
    // npm audit exits non-zero when advisories are found; the JSON is on stdout.
    if (error.stdout) return JSON.parse(error.stdout.toString());
    console.error("npm audit could not run:", error.message);
    process.exit(1);
  }
}

const report = runAudit();
if (report.error) {
  console.error("npm audit reported an error:", JSON.stringify(report.error));
  process.exit(1);
}

const advisories = [];
for (const [pkg, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via === "string") continue; // transitive dependency edge
    advisories.push({
      package: pkg,
      id: via.source ? String(via.source) : via.url ?? via.title ?? pkg,
      url: via.url ?? "",
      severity: via.severity ?? vuln.severity ?? "low",
      title: via.title ?? "",
    });
  }
}

const now = new Date();
const allow = loadAllowlist();
const failing = [];
for (const advisory of advisories) {
  if ((SEVERITY_RANK[advisory.severity] ?? 0) < FAIL_AT) continue;
  const allowed = allow.some(
    (entry) =>
      isActive(entry, now) &&
      (entry.id === advisory.id || entry.url === advisory.url) &&
      (!entry.package || entry.package === advisory.package),
  );
  if (!allowed) failing.push(advisory);
}

if (failing.length > 0) {
  console.error(
    `Found ${failing.length} high/critical advisory(ies) with no active allowlist entry:`,
  );
  for (const advisory of failing) {
    console.error(
      `  - [${advisory.severity}] ${advisory.package}: ${advisory.title || advisory.id} ${advisory.url}`,
    );
  }
  process.exit(1);
}

console.log("No unallowlisted high or critical advisories found.");
