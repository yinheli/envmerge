#!/usr/bin/env bun

/**
 * Version synchronization script for envmerge
 *
 * This script ensures version consistency across:
 * - package.json
 * - jsr.json
 * - src/cli.ts (CLI version display)
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Get version from package.json (single source of truth)
function getCurrentVersion(): string {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  return packageJson.version;
}

// Update version in all files
function updateVersion(newVersion: string) {
  console.log(`Updating version to ${newVersion}...`);

  // 1. Update package.json
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  packageJson.version = newVersion;
  writeFileSync("package.json", JSON.stringify(packageJson, null, 2) + "\n");
  console.log("✓ Updated package.json");

  // 2. Update jsr.json
  const jsrConfig = JSON.parse(readFileSync("jsr.json", "utf8"));
  jsrConfig.version = newVersion;
  writeFileSync("jsr.json", JSON.stringify(jsrConfig, null, 2) + "\n");
  console.log("✓ Updated jsr.json");

  // 3. Update src/cli.ts
  const cliTsPath = resolve("src/cli.ts");
  let cliContent = readFileSync(cliTsPath, "utf8");

  // Find and replace the version line in CLI
  const versionRegex = /\.version\("([^"]+)"\)/;
  const match = cliContent.match(versionRegex);

  if (match) {
    cliContent = cliContent.replace(versionRegex, `.version("${newVersion}")`);
    writeFileSync(cliTsPath, cliContent);
    console.log("✓ Updated src/cli.ts");
  } else {
    console.error("❌ Could not find version line in src/cli.ts");
    process.exit(1);
  }
}

// Verify all versions are in sync
function verifyVersions(): boolean {
  const packageVersion = getCurrentVersion();
  const jsrVersion = JSON.parse(readFileSync("jsr.json", "utf8")).version;

  const cliTsPath = resolve("src/cli.ts");
  const cliContent = readFileSync(cliTsPath, "utf8");
  const versionMatch = cliContent.match(/\.version\("([^"]+)"\)/);
  const cliVersion = versionMatch?.[1];

  const allVersions = {
    "package.json": packageVersion,
    "jsr.json": jsrVersion,
    "src/cli.ts": cliVersion,
  };

  console.log("Current versions:");
  Object.entries(allVersions).forEach(([file, version]) => {
    console.log(`  ${file}: ${version}`);
  });

  const versions = Object.values(allVersions);
  const isConsistent = versions.every((v) => v === versions[0]);

  if (isConsistent) {
    console.log("\n✅ All versions are in sync!");
  } else {
    console.log("\n❌ Versions are inconsistent!");
  }

  return isConsistent;
}

// Parse command line arguments
const command = process.argv[2];
const versionArg = process.argv[3];

switch (command) {
  case "get":
    console.log(getCurrentVersion());
    break;

  case "set":
    if (!versionArg) {
      console.error("Error: Please provide a version number");
      console.log("Usage: bun scripts/version.ts set <version>");
      process.exit(1);
    }

    // Validate version format (semver)
    const semverRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9\-]+)?(\+[a-zA-Z0-9\-]+)?$/;
    if (!semverRegex.test(versionArg)) {
      console.error(
        "Error: Invalid version format. Please use semantic versioning (e.g., 1.0.0, 2.1.3-beta)",
      );
      process.exit(1);
    }

    updateVersion(versionArg);
    verifyVersions();
    break;

  case "verify":
    verifyVersions();
    break;

  case "bump-patch":
    const current = getCurrentVersion();
    const [major, minor, patch] = current.split(".").map(Number);
    const newPatch = `${major}.${minor}.${patch + 1}`;
    updateVersion(newPatch);
    verifyVersions();
    break;

  case "bump-minor":
    const [mj, mn, _] = getCurrentVersion().split(".").map(Number);
    const newMinor = `${mj}.${mn + 1}.0`;
    updateVersion(newMinor);
    verifyVersions();
    break;

  case "bump-major":
    const [ma] = getCurrentVersion().split(".").map(Number);
    const newMajor = `${ma + 1}.0.0`;
    updateVersion(newMajor);
    verifyVersions();
    break;

  default:
    console.error("Usage:");
    console.error(
      "  bun scripts/version.ts get                   - Get current version",
    );
    console.error(
      "  bun scripts/version.ts set <version>         - Set specific version",
    );
    console.error(
      "  bun scripts/version.ts verify                - Verify version consistency",
    );
    console.error(
      "  bun scripts/version.ts bump-patch            - Bump patch version",
    );
    console.error(
      "  bun scripts/version.ts bump-minor            - Bump minor version",
    );
    console.error(
      "  bun scripts/version.ts bump-major            - Bump major version",
    );
    process.exit(1);
}
