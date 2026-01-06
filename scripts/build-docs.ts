/**
 * Build and organize documentation for all packages
 *
 * This script:
 * 1. Runs typedoc for all packages (via turbo)
 * 2. Copies all generated docs into a single docs-site directory
 *
 * Output structure:
 * docs-site/
 *   api/
 *     dcbor/
 *     envelope/
 *     ...
 */

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT_DIR = join(import.meta.dirname, "..");
const PACKAGES_DIR = join(ROOT_DIR, "packages");
const OUTPUT_DIR = join(ROOT_DIR, "docs-site");
const API_DIR = join(OUTPUT_DIR, "api");

// Packages to ignore (no docs generated)
const IGNORED_PACKAGES = [
  "envelope-pattern",
  "envelope-cli",
  "dcbor-cli",
  "dcbor-pattern",
  "dcbor-parse",
];

// Clean output directory
if (existsSync(OUTPUT_DIR)) {
  rmSync(OUTPUT_DIR, { recursive: true });
}
mkdirSync(API_DIR, { recursive: true });

// Build turbo filter to exclude ignored packages
const ignoreFilters = IGNORED_PACKAGES.map((pkg) => `--filter=!@bcts/${pkg}`).join(" ");

// Generate docs for all packages (excluding ignored ones)
console.log("Generating documentation for all packages...");
console.log(`Ignoring: ${IGNORED_PACKAGES.join(", ")}\n`);
execSync(`bunx turbo run docs ${ignoreFilters}`, { cwd: ROOT_DIR, stdio: "inherit" });

// Copy each package's docs to the output directory
console.log("\nOrganizing documentation...");
const packages = readdirSync(PACKAGES_DIR, { withFileTypes: true })
  .filter((dirent) => dirent.isDirectory())
  .map((dirent) => dirent.name)
  .filter((name) => !IGNORED_PACKAGES.includes(name));

let copiedCount = 0;
for (const pkg of packages) {
  const docsDir = join(PACKAGES_DIR, pkg, "docs");
  if (existsSync(docsDir)) {
    const destDir = join(API_DIR, pkg);
    cpSync(docsDir, destDir, { recursive: true });
    console.log(`  ✓ ${pkg}`);
    copiedCount++;
  }
}

console.log(`\nDocumentation built to: ${OUTPUT_DIR}`);
console.log(`Total packages: ${copiedCount}`);
