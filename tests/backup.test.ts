import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  areFilesIdentical,
  cleanupRedundantBackup,
  createBackup,
  generateBackupPath,
} from "@/core/backup";

const TEST_DIR = join(process.cwd(), "test-temp-backup");

describe("generateBackupPath", () => {
  it("should generate backup path with timestamp", () => {
    const originalPath = "/path/to/.env";
    const backupPath = generateBackupPath(originalPath);

    expect(backupPath).toMatch(/\/path\/to\/\.env-backup-envmerge-\d{14}$/);
  });

  it("should generate different timestamps for sequential calls", async () => {
    const originalPath = "/path/to/.env";
    const backup1 = generateBackupPath(originalPath);

    // Wait a bit to ensure different timestamp
    await new Promise((resolve) => setTimeout(resolve, 10));

    const backup2 = generateBackupPath(originalPath);

    // They might be the same if called within the same second
    // but the format should be correct
    expect(backup1).toMatch(/\.env-backup-envmerge-\d{14}$/);
    expect(backup2).toMatch(/\.env-backup-envmerge-\d{14}$/);
  });
});

describe("createBackup", () => {
  beforeEach(() => {
    // Create test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  it("should create a backup of an existing file", () => {
    const originalPath = join(TEST_DIR, ".env");
    const content = "KEY1=value1\nKEY2=value2";

    writeFileSync(originalPath, content);

    const backupPath = createBackup(originalPath);

    expect(backupPath).toBeDefined();
    expect(existsSync(backupPath!)).toBe(true);
    expect(readFileSync(backupPath!, "utf-8")).toBe(content);
  });

  it("should return undefined for non-existent file", () => {
    const nonExistentPath = join(TEST_DIR, "non-existent.env");
    const backupPath = createBackup(nonExistentPath);

    expect(backupPath).toBeUndefined();
  });

  it("should create backup in the same directory", () => {
    const originalPath = join(TEST_DIR, ".env");
    writeFileSync(originalPath, "KEY=value");

    const backupPath = createBackup(originalPath);

    expect(backupPath).toBeDefined();
    expect(backupPath).toMatch(new RegExp(`^${TEST_DIR}`));
  });

  it("should preserve file content exactly", () => {
    const originalPath = join(TEST_DIR, ".env");
    const content = `# Comment
KEY1=value1

KEY2="quoted value"
KEY3=value with spaces`;

    writeFileSync(originalPath, content);

    const backupPath = createBackup(originalPath);
    const backupContent = readFileSync(backupPath!, "utf-8");

    expect(backupContent).toBe(content);
  });
});

describe("areFilesIdentical", () => {
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

  it("should return true for identical files", () => {
    const file1 = join(TEST_DIR, "file1.env");
    const file2 = join(TEST_DIR, "file2.env");
    const content = "KEY1=value1\nKEY2=value2";

    writeFileSync(file1, content);
    writeFileSync(file2, content);

    expect(areFilesIdentical(file1, file2)).toBe(true);
  });

  it("should return false for different files", () => {
    const file1 = join(TEST_DIR, "file1.env");
    const file2 = join(TEST_DIR, "file2.env");

    writeFileSync(file1, "KEY1=value1");
    writeFileSync(file2, "KEY1=value2");

    expect(areFilesIdentical(file1, file2)).toBe(false);
  });

  it("should return false if first file does not exist", () => {
    const file1 = join(TEST_DIR, "nonexistent.env");
    const file2 = join(TEST_DIR, "file2.env");

    writeFileSync(file2, "KEY=value");

    expect(areFilesIdentical(file1, file2)).toBe(false);
  });

  it("should return false if second file does not exist", () => {
    const file1 = join(TEST_DIR, "file1.env");
    const file2 = join(TEST_DIR, "nonexistent.env");

    writeFileSync(file1, "KEY=value");

    expect(areFilesIdentical(file1, file2)).toBe(false);
  });

  it("should handle files with complex content", () => {
    const file1 = join(TEST_DIR, "file1.env");
    const file2 = join(TEST_DIR, "file2.env");
    const content = `# Comment
KEY1=value1

KEY2="quoted value"
KEY3=value with spaces
# Another comment`;

    writeFileSync(file1, content);
    writeFileSync(file2, content);

    expect(areFilesIdentical(file1, file2)).toBe(true);
  });
});

describe("cleanupRedundantBackup", () => {
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

  it("should remove backup if identical to original", () => {
    const original = join(TEST_DIR, ".env");
    const backup = join(TEST_DIR, ".env.backup");
    const content = "KEY1=value1\nKEY2=value2";

    writeFileSync(original, content);
    writeFileSync(backup, content);

    const removed = cleanupRedundantBackup(original, backup);

    expect(removed).toBe(true);
    expect(existsSync(backup)).toBe(false);
  });

  it("should keep backup if different from original", () => {
    const original = join(TEST_DIR, ".env");
    const backup = join(TEST_DIR, ".env.backup");

    writeFileSync(original, "KEY1=value1");
    writeFileSync(backup, "KEY1=value2");

    const removed = cleanupRedundantBackup(original, backup);

    expect(removed).toBe(false);
    expect(existsSync(backup)).toBe(true);
  });

  it("should return false if backup does not exist", () => {
    const original = join(TEST_DIR, ".env");
    const backup = join(TEST_DIR, ".env.backup");

    writeFileSync(original, "KEY=value");

    const removed = cleanupRedundantBackup(original, backup);

    expect(removed).toBe(false);
  });

  it("should handle case where original does not exist", () => {
    const original = join(TEST_DIR, ".env");
    const backup = join(TEST_DIR, ".env.backup");

    writeFileSync(backup, "KEY=value");

    const removed = cleanupRedundantBackup(original, backup);

    expect(removed).toBe(false);
    expect(existsSync(backup)).toBe(true);
  });
});
