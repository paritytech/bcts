#!/usr/bin/env bun
/**
 * Script to bump all package versions
 */

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface PackageJson {
  name: string;
  version: string;
  [key: string]: unknown;
}

const ROOT_DIR = join(import.meta.dirname, '..');
const WORKSPACE_DIRS = ['packages'];
const NEW_VERSION = process.argv[2];

if (!NEW_VERSION) {
  console.error('Usage: bun run scripts/bump-version.ts <new-version>');
  console.error('Example: bun run scripts/bump-version.ts 1.0.0-alpha.7');
  process.exit(1);
}

async function main() {
  console.log(`Bumping all packages to version ${NEW_VERSION}\n`);

  for (const dir of WORKSPACE_DIRS) {
    const dirPath = join(ROOT_DIR, dir);
    try {
      const packages = await readdir(dirPath);
      for (const pkg of packages) {
        const packageJsonPath = join(dirPath, pkg, 'package.json');
        try {
          const content = await readFile(packageJsonPath, 'utf-8');
          const packageJson: PackageJson = JSON.parse(content);

          const oldVersion = packageJson.version;
          packageJson.version = NEW_VERSION;

          await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
          console.log(`✓ ${packageJson.name}: ${oldVersion} → ${NEW_VERSION}`);
        } catch {
          // Skip packages without package.json
        }
      }
    } catch {
      // Skip if directory doesn't exist
    }
  }

  console.log('\nDone! All packages updated.');
}

main().catch(console.error);
