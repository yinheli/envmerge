import { writeFileSync } from "node:fs";
import type { Block } from "../types";
import { serializeToString } from "./parser";

/**
 * Write parsed env blocks to disk
 */
export function writeEnvFile(filePath: string, head: Block | null): void {
  const content = serializeToString(head);
  writeFileSync(filePath, content, "utf-8");
}
