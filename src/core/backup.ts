import { copyFileSync, existsSync, readFileSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";

/**
 * Generate a backup file path with timestamp
 */
export function generateBackupPath(originalPath: string): string {
  const dir = dirname(originalPath);
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "");

  return join(dir, `.env-backup-envmerge-${timestamp}`);
}

/**
 * Create a backup of a file
 * @returns The backup file path, or undefined if file doesn't exist
 */
export function createBackup(filePath: string): string | undefined {
  if (!existsSync(filePath)) {
    return undefined;
  }

  const backupPath = generateBackupPath(filePath);
  copyFileSync(filePath, backupPath);

  return backupPath;
}

/**
 * Compare two files to check if they have identical content
 * @returns true if files are identical, false otherwise
 */
export function areFilesIdentical(
  filePath1: string,
  filePath2: string,
): boolean {
  if (!existsSync(filePath1) || !existsSync(filePath2)) {
    return false;
  }

  const content1 = readFileSync(filePath1, "utf-8");
  const content2 = readFileSync(filePath2, "utf-8");

  return content1 === content2;
}

/**
 * Remove a backup file if it's identical to the original file
 * @returns true if backup was removed, false if kept or doesn't exist
 */
export function cleanupRedundantBackup(
  originalPath: string,
  backupPath: string,
): boolean {
  if (!existsSync(backupPath)) {
    return false;
  }

  if (areFilesIdentical(originalPath, backupPath)) {
    unlinkSync(backupPath);
    return true;
  }

  return false;
}
