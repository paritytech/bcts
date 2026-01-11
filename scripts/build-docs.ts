/**
 * Build and organize documentation for all packages and tools
 *
 * This script:
 * 1. Runs typedoc for all packages and tools (via turbo)
 * 2. Copies all generated docs into a single docs-site directory
 *
 * Output structure:
 * docs-site/
 *   api/
 *     dcbor/
 *     envelope/
 *     dcbor-cli/
 *     envelope-cli/
 *     ...
 */

import { execSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";

const ROOT_DIR = join(import.meta.dirname, "..");
const PACKAGES_DIR = join(ROOT_DIR, "packages");
const TOOLS_DIR = join(ROOT_DIR, "tools");
const OUTPUT_DIR = join(ROOT_DIR, "docs-site");
const API_DIR = join(OUTPUT_DIR, "api");

// Clean output directory
if (existsSync(OUTPUT_DIR)) {
  rmSync(OUTPUT_DIR, { recursive: true });
}
mkdirSync(API_DIR, { recursive: true });

// Generate docs for all packages and tools
console.log("Generating documentation for all packages and tools...\n");
execSync(`bunx turbo run docs`, { cwd: ROOT_DIR, stdio: "inherit" });

// Helper function to copy docs from a directory
function copyDocsFrom(sourceDir: string, label: string): number {
  let count = 0;
  const items = readdirSync(sourceDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const item of items) {
    const docsDir = join(sourceDir, item, "docs");
    if (existsSync(docsDir)) {
      const destDir = join(API_DIR, item);
      cpSync(docsDir, destDir, { recursive: true });
      console.log(`  ✓ ${item} (${label})`);
      count++;
    }
  }
  return count;
}

// Copy docs from packages and tools
console.log("\nOrganizing documentation...");
const packagesCount = copyDocsFrom(PACKAGES_DIR, "package");
const toolsCount = copyDocsFrom(TOOLS_DIR, "tool");

console.log(`\nDocumentation built to: ${OUTPUT_DIR}`);
console.log(`Total: ${packagesCount + toolsCount} (${packagesCount} packages, ${toolsCount} tools)`);
