import { describe, expect, it } from "vitest";
import {
  parseEnvFile,
  serializeBlocks,
  serializeToString,
} from "@/core/parser";
import { mergeSources } from "@/core/merger";
import { getVariable } from "./test-helpers";
import type { Block } from "@/types";

/**
 * Internal Line type for serialization (mirrors parser's internal type)
 */
type Line =
  | { type: "comment"; content: string }
  | { type: "empty" }
  | { type: "variable"; key: string; value: string; raw: string };

/**
 * Helper to get variable keys from linked list
 */
function getVariableKeys(head: Block | null): string[] {
  const keys: string[] = [];
  let current = head;
  while (current) {
    if (current.type === "variable") {
      keys.push(current.key);
    }
    current = current.next;
  }
  return keys;
}

/**
 * Helper function to get lines from linked list for backward compatibility with tests
 */
function getLines(head: Block | null): Line[] {
  return serializeBlocks(head);
}

describe("mergeSources", () => {
  it("should merge multiple sources with later overriding earlier", () => {
    const source1 = parseEnvFile("KEY1=value1\nKEY2=value2");
    const source2 = parseEnvFile("KEY2=overridden\nKEY3=value3");

    const merged = mergeSources(source1, source2);

    expect(getVariable(merged, "KEY1")).toBe("value1");
    expect(getVariable(merged, "KEY2")).toBe("overridden");
    expect(getVariable(merged, "KEY3")).toBe("value3");
  });

  it("should preserve comments from all sources", () => {
    const source1 = parseEnvFile("# Comment 1\nKEY1=value1");
    const source2 = parseEnvFile("# Comment 2\nKEY2=value2");

    const merged = mergeSources(source1, source2);

    // Count comments in linked list
    let commentCount = 0;
    let current = merged;
    while (current) {
      if (current.type === "variable") {
        commentCount += current.comments.length;
      } else if (current.type === "comment") {
        commentCount += current.lines.length;
      }
      current = current.next;
    }
    expect(commentCount).toBe(2);
  });

  it("should handle empty sources", () => {
    const source1 = parseEnvFile("");
    const source2 = parseEnvFile("KEY1=value1");

    const merged = mergeSources(source1, source2);

    expect(getVariable(merged, "KEY1")).toBe("value1");
  });

  it("should preserve order of first occurrence", () => {
    const source1 = parseEnvFile("KEY1=value1\nKEY2=value2\nKEY3=value3");
    const source2 = parseEnvFile("KEY3=overridden3\nKEY2=overridden2");

    const merged = mergeSources(source1, source2);

    const keys = getVariableKeys(merged);
    expect(keys).toEqual(["KEY1", "KEY2", "KEY3"]);
  });

  it("should handle same comments from multiple sources", () => {
    const source1 = parseEnvFile("# Database\nDB_HOST=localhost");
    const source2 = parseEnvFile("# Database\nDB_PORT=5432");

    const merged = mergeSources(source1, source2);

    // Count "# Database" comments
    let databaseCommentCount = 0;
    let current = merged;
    while (current) {
      if (current.type === "variable") {
        databaseCommentCount += current.comments.filter((c) =>
          c === "# Database"
        ).length;
      } else if (current.type === "comment") {
        databaseCommentCount += current.lines.filter((c) =>
          c === "# Database"
        ).length;
      }
      current = current.next;
    }

    // Should have comments preserved
    expect(databaseCommentCount).toBeGreaterThan(0);
  });

  it("should preserve same comments when far apart", () => {
    const source1 = parseEnvFile(
      "# Section A\nKEY1=value1\nKEY2=value2\nKEY3=value3\nKEY4=value4\nKEY5=value5\n\n# Section A\nKEY6=value6",
    );

    const merged = mergeSources(source1);

    // Count "# Section A" comments
    let sectionCommentCount = 0;
    let current = merged;
    while (current) {
      if (current.type === "variable") {
        sectionCommentCount += current.comments.filter((c) =>
          c === "# Section A"
        ).length;
      } else if (current.type === "comment") {
        sectionCommentCount += current.lines.filter((c) =>
          c === "# Section A"
        ).length;
      }
      current = current.next;
    }

    // Should have two "# Section A" comments (far apart in file)
    expect(sectionCommentCount).toBe(2);
  });
});

describe("Merge behavior", () => {
  it("should merge and preserve comments", () => {
    const merged = parseEnvFile("# Source comment\nKEY1=value1");
    const destination = parseEnvFile("# Dest comment\nKEY2=value2");

    const result = mergeSources(destination, merged);

    expect(getVariable(result, "KEY1")).toBe("value1");
    expect(getVariable(result, "KEY2")).toBe("value2");

    const lines = getLines(result);
    const comments = lines.filter((line) => line.type === "comment");
    expect(comments.length).toBeGreaterThan(0);
  });

  it("should add new keys from source", () => {
    const merged = parseEnvFile("KEY1=value1\nKEY2=value2");
    const destination = parseEnvFile("KEY3=value3");

    const result = mergeSources(destination, merged);

    expect(getVariable(result, "KEY1")).toBe("value1");
    expect(getVariable(result, "KEY2")).toBe("value2");
    expect(getVariable(result, "KEY3")).toBe("value3");
  });

  it("should override existing values with source values", () => {
    const merged = parseEnvFile("KEY1=new_value");
    const destination = parseEnvFile("KEY1=old_value");

    const result = mergeSources(destination, merged);

    expect(getVariable(result, "KEY1")).toBe("new_value");
  });

  it("should merge base into env preserving structure and adding missing variables", () => {
    // .env.base file with comprehensive structure
    const envBase = parseEnvFile(
      "# application environment\n\n\n# app\nAPP_NAME=my-app\nAPP_ENV=development\n# app port\nAPP_PORT=3000\n\nMOCK_VARIABLE=mock-value\n",
    );
    // .env file with existing values
    const env = parseEnvFile(
      "APP_NAME=my-app\n# env\nAPP_ENV=development\n# app port\nAPP_PORT=3000\n",
    );

    // First merge: env as base, envBase as source
    // This simulates merging .env.base into .env to add missing variables
    const firstMerge = mergeSources(env, envBase);

    // Verify all variables are present (including MOCK_VARIABLE from base)
    expect(getVariable(firstMerge, "APP_NAME")).toBe("my-app");
    expect(getVariable(firstMerge, "APP_ENV")).toBe("development");
    expect(getVariable(firstMerge, "APP_PORT")).toBe("3000");
    expect(getVariable(firstMerge, "MOCK_VARIABLE")).toBe("mock-value");

    // Verify structure comments from envBase
    const firstLines = getLines(firstMerge);
    const firstComments = firstLines.filter((line) => line.type === "comment")
      .map((line) => line.content);

    // Should have comments from envBase (source overrides base comments)
    expect(firstComments).toContain("# application environment");
    expect(firstComments).toContain("# app");
    expect(firstComments).toContain("# app port");

    // Second merge: should be idempotent
    const secondMerge = mergeSources(firstMerge, envBase);

    // Verify variables remain the same
    expect(getVariable(secondMerge, "APP_NAME")).toBe("my-app");
    expect(getVariable(secondMerge, "APP_ENV")).toBe("development");
    expect(getVariable(secondMerge, "APP_PORT")).toBe("3000");
    expect(getVariable(secondMerge, "MOCK_VARIABLE")).toBe("mock-value");

    // Verify output is identical after second merge (idempotency)
    const secondLines = getLines(secondMerge);
    expect(secondLines.length).toBe(firstLines.length);

    // Compare serialized output to ensure idempotency
    const firstSerialized = firstLines.map((line) => {
      if (line.type === "comment") return line.content;
      if (line.type === "empty") return "";
      return line.raw;
    }).join("\n");

    const secondSerialized = secondLines.map((line) => {
      if (line.type === "comment") return line.content;
      if (line.type === "empty") return "";
      return line.raw;
    }).join("\n");

    expect(secondSerialized).toBe(firstSerialized);
  });

  it("should be idempotent: multiple merges produce identical string output", () => {
    // .env.base file with comprehensive structure
    const envBaseContent =
      "# application environment\n\n\n# app\nAPP_NAME=my-app\nAPP_ENV=development\n# app port\nAPP_PORT=3000\n\nMOCK_VARIABLE=mock-value\n";

    // .env file with existing values
    const envContent =
      "APP_NAME=my-app\n# env\nAPP_ENV=development\n# app port\nAPP_PORT=3000\n";

    const base = parseEnvFile(envBaseContent);
    const env = parseEnvFile(envContent);

    const s1 = serializeToString(mergeSources(base, env));

    const s2 = serializeToString(
      mergeSources(mergeSources(base, env), parseEnvFile(s1)),
    );

    expect(s2).toBe(s1);
  });
});
