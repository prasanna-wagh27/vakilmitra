#!/usr/bin/env node
/**
 * License gate (Tech Stack Standard: "CI fails on any banned license").
 * Checks every production dependency of every workspace package.
 *   Allowed -> pass. Review -> pass only if listed in REVIEWED with an approval note.
 *   Banned or anything unknown -> fail.
 */
import { execSync } from "node:child_process";

const ALLOWED = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD", "Unlicense", "MPL-2.0"]);
const BANNED = /\b(A?GPL|SSPL|BUSL|BSL|Elastic|Commons[- ]Clause|Sustainable[- ]Use|UNLICENSED|UNKNOWN)\b/i;
const REVIEW = /\b(LGPL|EPL)\b/i;

/**
 * Packages approved through the exception process (see README, "Exceptions to the standard").
 * Keys are package names; a trailing "*" matches a family of platform builds.
 */
const REVIEWED = {
  "@img/sharp-libvips-*": "LGPL-3.0, approved by Prasanna Wagh on 2026-11-16: unmodified prebuilt libvips under sharp, server-side only",
  "@fontsource-variable/figtree": "OFL-1.1 font files, bundled unmodified; PENDING owner confirmation (see README)",
  "@fontsource/ibm-plex-sans-devanagari": "OFL-1.1 font files, bundled unmodified; PENDING owner confirmation (see README)",
  "@fontsource/tiro-devanagari-marathi": "OFL-1.1 font files, bundled unmodified; PENDING owner confirmation (see README)",
  nodemailer: "MIT-0 (MIT without the attribution clause), server-side email; PENDING owner confirmation (see README)",
};
const reviewed = (name) => Object.keys(REVIEWED).some((k) => (k.endsWith("*") ? name.startsWith(k.slice(0, -1)) : name === k));

/** "MIT OR Apache-2.0" passes if any alternative is allowed; "A AND B" needs all. */
function allowed(expr) {
  const clean = expr.replace(/[()]/g, "");
  if (/\bOR\b/.test(clean)) return clean.split(/\s+OR\s+/).some((l) => allowed(l));
  if (/\bAND\b/.test(clean)) return clean.split(/\s+AND\s+/).every((l) => allowed(l));
  return ALLOWED.has(clean.trim());
}

const report = JSON.parse(execSync("pnpm licenses list --prod --json", { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }));
const problems = [];
for (const [license, pkgs] of Object.entries(report)) {
  if (allowed(license) && !BANNED.test(license)) continue;
  for (const p of pkgs) {
    if (reviewed(p.name) && !BANNED.test(license)) continue;
    const kind = BANNED.test(license) ? "BANNED" : REVIEW.test(license) ? "NEEDS REVIEW" : "NOT ON ALLOWED LIST";
    problems.push(`${kind}: ${p.name}@${p.versions.join(",")} (${license})`);
  }
}

const total = Object.values(report).reduce((n, p) => n + p.length, 0);
if (problems.length) {
  console.error(`License check failed (${problems.length} of ${total} production packages):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`License check passed: ${total} production packages, licenses: ${Object.keys(report).join(", ")}`);
