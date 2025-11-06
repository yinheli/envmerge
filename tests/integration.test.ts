import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { parseEnvFile } from "@/core/parser";
import { mergeSources } from "@/core/merger";
import { createBackup } from "@/core/backup";
import { writeEnvFile } from "@/core/writer";
import { getVariable } from "./test-helpers";

const TEST_DIR = join(process.cwd(), "test-temp-integration");

describe("Integration Tests", () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should merge multiple source files", () => {
    // Create source files
    const source1Path = join(TEST_DIR, ".env.source1");
    const source2Path = join(TEST_DIR, ".env.source2");
    const destPath = join(TEST_DIR, ".env");

    writeFileSync(source1Path, "KEY1=source1_value1\nKEY2=source1_value2");
    writeFileSync(source2Path, "KEY2=source2_value2\nKEY3=source2_value3");
    writeFileSync(destPath, "KEY4=dest_value4");

    // Parse and merge
    const source1 = parseEnvFile(readFileSync(source1Path, "utf-8"));
    const source2 = parseEnvFile(readFileSync(source2Path, "utf-8"));
    const dest = parseEnvFile(readFileSync(destPath, "utf-8"));

    // Merge sources first (source2 overrides source1)
    const merged = mergeSources(source1, source2);
    // Then merge with destination (merged values are added to dest)
    const final = mergeSources(merged, dest);

    writeEnvFile(destPath, final);

    // Verify result
    const result = parseEnvFile(readFileSync(destPath, "utf-8"));
    expect(getVariable(result, "KEY1")).toBe("source1_value1");
    expect(getVariable(result, "KEY2")).toBe("source2_value2"); // source2 wins
    expect(getVariable(result, "KEY3")).toBe("source2_value3");
    expect(getVariable(result, "KEY4")).toBe("dest_value4");
  });

  it("should merge sources with later sources overriding earlier ones", () => {
    const source1Path = join(TEST_DIR, ".env.source1");
    const source2Path = join(TEST_DIR, ".env.source2");
    const destPath = join(TEST_DIR, ".env");

    writeFileSync(source1Path, "KEY1=value1\nKEY2=value2");
    writeFileSync(source2Path, "KEY1=new_value");
    writeFileSync(destPath, "KEY3=dest_value");

    const source1 = parseEnvFile(readFileSync(source1Path, "utf-8"));
    const source2 = parseEnvFile(readFileSync(source2Path, "utf-8"));
    const dest = parseEnvFile(readFileSync(destPath, "utf-8"));

    const merged = mergeSources(source1, source2);
    const final = mergeSources(merged, dest);

    writeEnvFile(destPath, final);

    const result = parseEnvFile(readFileSync(destPath, "utf-8"));
    expect(getVariable(result, "KEY1")).toBe("new_value"); // source2 overrides source1
    expect(getVariable(result, "KEY2")).toBe("value2");
    expect(getVariable(result, "KEY3")).toBe("dest_value");
  });

  it("should preserve comments and empty lines", () => {
    const sourcePath = join(TEST_DIR, ".env.source");
    const destPath = join(TEST_DIR, ".env");

    writeFileSync(
      sourcePath,
      `# Source comment
KEY1=value1

KEY2=value2`,
    );

    writeFileSync(
      destPath,
      `# Destination comment
KEY3=value3`,
    );

    const source = parseEnvFile(readFileSync(sourcePath, "utf-8"));
    const dest = parseEnvFile(readFileSync(destPath, "utf-8"));

    const final = mergeSources(source, dest);

    writeEnvFile(destPath, final);

    const content = readFileSync(destPath, "utf-8");
    expect(content).toContain("# Destination comment");
    expect(content).toContain("# Source comment");
    expect(content).toContain("KEY1=value1");
    expect(content).toContain("KEY2=value2");
    expect(content).toContain("KEY3=value3");
  });

  it("should create backup when destination exists", () => {
    const destPath = join(TEST_DIR, ".env");
    const originalContent = "KEY1=original";

    writeFileSync(destPath, originalContent);

    const backupPath = createBackup(destPath);

    expect(backupPath).toBeDefined();
    expect(existsSync(backupPath!)).toBe(true);
    expect(readFileSync(backupPath!, "utf-8")).toBe(originalContent);
    expect(backupPath).toMatch(/\.env-backup-envmerge-\d{14}$/);
  });

  it("should handle quoted values correctly through full pipeline", () => {
    const sourcePath = join(TEST_DIR, ".env.source");
    const destPath = join(TEST_DIR, ".env");

    writeFileSync(sourcePath, 'KEY1="value with spaces"\nKEY2=simple');
    writeFileSync(destPath, "KEY3=existing");

    const source = parseEnvFile(readFileSync(sourcePath, "utf-8"));
    const dest = parseEnvFile(readFileSync(destPath, "utf-8"));

    const final = mergeSources(source, dest);

    writeEnvFile(destPath, final);

    // Re-parse to verify
    const result = parseEnvFile(readFileSync(destPath, "utf-8"));
    expect(getVariable(result, "KEY1")).toBe("value with spaces");
    expect(getVariable(result, "KEY2")).toBe("simple");
    expect(getVariable(result, "KEY3")).toBe("existing");
  });

  it("should handle complex merge scenario with three sources", () => {
    const source1Path = join(TEST_DIR, ".env.1");
    const source2Path = join(TEST_DIR, ".env.2");
    const source3Path = join(TEST_DIR, ".env.3");
    const destPath = join(TEST_DIR, ".env");

    writeFileSync(source1Path, "A=1\nB=1\nC=1");
    writeFileSync(source2Path, "B=2\nC=2\nD=2");
    writeFileSync(source3Path, "C=3\nD=3\nE=3");
    writeFileSync(destPath, "F=dest");

    const sources = [source1Path, source2Path, source3Path].map((path) =>
      parseEnvFile(readFileSync(path, "utf-8"))
    );
    const dest = parseEnvFile(readFileSync(destPath, "utf-8"));

    const merged = mergeSources(...sources);
    const final = mergeSources(merged, dest);

    writeEnvFile(destPath, final);

    const result = parseEnvFile(readFileSync(destPath, "utf-8"));
    expect(getVariable(result, "A")).toBe("1"); // from source1
    expect(getVariable(result, "B")).toBe("2"); // from source2 (overrides source1)
    expect(getVariable(result, "C")).toBe("3"); // from source3 (last wins)
    expect(getVariable(result, "D")).toBe("3"); // from source3 (overrides source2)
    expect(getVariable(result, "E")).toBe("3"); // from source3
    expect(getVariable(result, "F")).toBe("dest"); // from dest
  });

  it("should not create backup for non-existent destination", () => {
    const nonExistentPath = join(TEST_DIR, "non-existent.env");
    const backupPath = createBackup(nonExistentPath);

    expect(backupPath).toBeUndefined();

    const files = readdirSync(TEST_DIR);
    const backupFiles = files.filter((f) => f.includes("backup"));
    expect(backupFiles.length).toBe(0);
  });

  it("should merge into non-existent destination", () => {
    const sourcePath = join(TEST_DIR, ".env.source");
    const destPath = join(TEST_DIR, ".env");

    writeFileSync(sourcePath, "KEY1=value1\nKEY2=value2");

    const source = parseEnvFile(readFileSync(sourcePath, "utf-8"));

    // Destination doesn't exist, so merge with null
    const final = mergeSources(source, null);

    writeEnvFile(destPath, final);

    const result = parseEnvFile(readFileSync(destPath, "utf-8"));
    expect(getVariable(result, "KEY1")).toBe("value1");
    expect(getVariable(result, "KEY2")).toBe("value2");
  });

  it("should preserve variable order from sources", () => {
    const source1Path = join(TEST_DIR, ".env.source1");
    const source2Path = join(TEST_DIR, ".env.source2");
    const destPath = join(TEST_DIR, ".env");

    writeFileSync(source1Path, "A=1\nB=2\nC=3");
    writeFileSync(source2Path, "D=4\nE=5");
    writeFileSync(destPath, "F=6");

    const source1 = parseEnvFile(readFileSync(source1Path, "utf-8"));
    const source2 = parseEnvFile(readFileSync(source2Path, "utf-8"));
    const dest = parseEnvFile(readFileSync(destPath, "utf-8"));

    const merged = mergeSources(source1, source2);
    const final = mergeSources(merged, dest);

    writeEnvFile(destPath, final);

    const content = readFileSync(destPath, "utf-8");
    const lines = content.split("\n").filter((l) =>
      l.trim() && !l.startsWith("#")
    );

    // Variables should appear in the order they were first defined
    expect(lines[0]).toContain("A=");
    expect(lines[1]).toContain("B=");
    expect(lines[2]).toContain("C=");
    expect(lines[3]).toContain("D=");
    expect(lines[4]).toContain("E=");
    expect(lines[5]).toContain("F=");
  });
});
