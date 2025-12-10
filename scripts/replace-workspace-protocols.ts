#!/usr/bin/env bun
/**
 * Script to replace workspace:* protocols with actual package versions before publishing.
 * This is necessary because bun doesn't automatically replace workspace protocols during publish.
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

const ROOT_DIR = join(import.meta.dirname, "..");
const WORKSPACE_DIRS = ["packages", "shared"];

async function getPackageVersions(): Promise<Map<string, string>> {
  const versions = new Map<string, string>();

  for (const dir of WORKSPACE_DIRS) {
    const dirPath = join(ROOT_DIR, dir);
    try {
      const packages = await readdir(dirPath);
      for (const pkg of packages) {
        const packageJsonPath = join(dirPath, pkg, "package.json");
        try {
          const content = await readFile(packageJsonPath, "utf-8");
          const packageJson: PackageJson = JSON.parse(content);
          versions.set(packageJson.name, packageJson.version);
        } catch {
          // Skip packages without package.json
        }
      }
    } catch {
      // Skip if directory doesn't exist
    }
  }

  return versions;
}

function replaceWorkspaceProtocols(
  deps: Record<string, string> | undefined,
  versions: Map<string, string>,
): Record<string, string> | undefined {
  if (!deps) return deps;

  const result: Record<string, string> = {};
  for (const [name, version] of Object.entries(deps)) {
    if (version.startsWith("workspace:")) {
      const actualVersion = versions.get(name);
      if (actualVersion) {
        // workspace:* -> ^version, workspace:^ -> ^version, workspace:~ -> ~version
        const prefix =
          version === "workspace:*" || version === "workspace:^"
            ? "^"
            : version === "workspace:~"
              ? "~"
              : "^";
        result[name] = `${prefix}${actualVersion}`;
        console.log(`  ${name}: ${version} -> ${prefix}${actualVersion}`);
      } else {
        console.warn(`  Warning: No version found for ${name}, keeping ${version}`);
        result[name] = version;
      }
    } else {
      result[name] = version;
    }
  }
  return result;
}

async function main() {
  console.log("Collecting package versions...\n");
  const versionMap = await getPackageVersions();

  console.log("Found packages:");
  for (const [name, version] of versionMap) {
    console.log(`  ${name}@${version}`);
  }
  console.log("");

  for (const dir of WORKSPACE_DIRS) {
    const dirPath = join(ROOT_DIR, dir);
    try {
      const packages = await readdir(dirPath);
      for (const pkg of packages) {
        const packageJsonPath = join(dirPath, pkg, "package.json");
        try {
          const content = await readFile(packageJsonPath, "utf-8");
          const packageJson: PackageJson = JSON.parse(content);

          console.log(`Processing ${packageJson.name}...`);

          let modified = false;

          const newDeps = replaceWorkspaceProtocols(packageJson.dependencies, versionMap);
          if (JSON.stringify(newDeps) !== JSON.stringify(packageJson.dependencies)) {
            packageJson.dependencies = newDeps;
            modified = true;
          }

          const newDevDeps = replaceWorkspaceProtocols(packageJson.devDependencies, versionMap);
          if (JSON.stringify(newDevDeps) !== JSON.stringify(packageJson.devDependencies)) {
            packageJson.devDependencies = newDevDeps;
            modified = true;
          }

          const newPeerDeps = replaceWorkspaceProtocols(packageJson.peerDependencies, versionMap);
          if (JSON.stringify(newPeerDeps) !== JSON.stringify(packageJson.peerDependencies)) {
            packageJson.peerDependencies = newPeerDeps;
            modified = true;
          }

          if (modified) {
            await writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n");
            console.log(`  Updated ${packageJsonPath}\n`);
          } else {
            console.log(`  No workspace protocols found\n`);
          }
        } catch {
          // Skip packages without package.json
        }
      }
    } catch {
      // Skip if directory doesn't exist
    }
  }

  console.log("Done!");
}

main().catch(console.error);
