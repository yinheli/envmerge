import { describe, expect, it } from "vitest";
import { parseEnvFile, quoteValue, serializeToString } from "@/core/parser";
import { getVariable, toArray } from "./test-helpers";

describe("parseEnvFile", () => {
  it("should parse simple key-value pairs", () => {
    const content = "KEY1=value1\nKEY2=value2";
    const result = parseEnvFile(content);

    expect(getVariable(result, "KEY1")).toBe("value1");
    expect(getVariable(result, "KEY2")).toBe("value2");
    expect(toArray(result).filter((b) => b.type === "variable")).toHaveLength(
      2,
    );
  });

  it("should parse quoted values", () => {
    const content = `KEY1="quoted value"
KEY2='single quoted'
KEY3=unquoted`;

    const result = parseEnvFile(content);

    expect(getVariable(result, "KEY1")).toBe("quoted value");
    expect(getVariable(result, "KEY2")).toBe("single quoted");
    expect(getVariable(result, "KEY3")).toBe("unquoted");
  });

  it("should handle escaped characters in double quotes", () => {
    const content = 'KEY="line1\\nline2\\ttab\\\\"quote"';
    const result = parseEnvFile(content);

    expect(getVariable(result, "KEY")).toBe('line1\nline2\ttab"quote');
  });

  it("should preserve comments", () => {
    const content = `# This is a comment
KEY1=value1
# Another comment
KEY2=value2`;

    const result = parseEnvFile(content);
    const blocks = toArray(result);

    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.type).toBe("variable");
    if (blocks[0]?.type === "variable") {
      expect(blocks[0].comments).toHaveLength(1);
      expect(blocks[0].comments[0]).toBe("# This is a comment");
    }
    if (blocks[1]?.type === "variable") {
      expect(blocks[1].comments).toHaveLength(1);
      expect(blocks[1].comments[0]).toBe("# Another comment");
    }
  });

  it("should preserve empty lines", () => {
    const content = `KEY1=value1

KEY2=value2`;

    const result = parseEnvFile(content);
    const blocks = toArray(result);

    expect(blocks).toHaveLength(3);
    expect(blocks[1]?.type).toBe("empty");
  });

  it("should handle values with spaces around equals sign", () => {
    const content = "KEY1 = value1\nKEY2= value2\nKEY3 =value3";
    const result = parseEnvFile(content);

    expect(getVariable(result, "KEY1")).toBe("value1");
    expect(getVariable(result, "KEY2")).toBe("value2");
    expect(getVariable(result, "KEY3")).toBe("value3");
  });

  it("should treat invalid lines as comments", () => {
    const content = `KEY1=value1
invalid line without equals
KEY2=value2`;

    const result = parseEnvFile(content);
    const blocks = toArray(result);

    expect(blocks.filter((b) => b.type === "variable")).toHaveLength(2);
    // Invalid line becomes a comment attached to KEY2
    if (blocks[1]?.type === "variable") {
      expect(
        blocks[1].comments.some((c) => c === "invalid line without equals"),
      ).toBe(
        true,
      );
    }
  });

  it("should handle empty file", () => {
    const result = parseEnvFile("");
    const blocks = toArray(result);

    expect(blocks.filter((b) => b.type === "variable")).toHaveLength(0);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.type).toBe("empty");
  });

  it("should compress consecutive empty lines in comment blocks", () => {
    const content = `# Comment 1
# Comment 2



# Comment 3`;

    const result = parseEnvFile(content);
    const blocks = toArray(result);

    // Should have 2 comment blocks
    expect(blocks).toHaveLength(2);
    expect(blocks[0]?.type).toBe("comment");
    expect(blocks[1]?.type).toBe("comment");

    // First block should have comments and one compressed empty line
    if (blocks[0]?.type === "comment") {
      expect(blocks[0].lines).toEqual(["# Comment 1", "# Comment 2", ""]);
    }

    // Second block should have the new comment
    if (blocks[1]?.type === "comment") {
      expect(blocks[1].lines).toEqual(["# Comment 3"]);
    }
  });

  it("should handle single empty line in comment block", () => {
    const content = `# Comment 1

# Comment 2`;

    const result = parseEnvFile(content);
    const blocks = toArray(result);

    // Should have 2 comment blocks
    expect(blocks).toHaveLength(2);

    if (blocks[0]?.type === "comment") {
      expect(blocks[0].lines).toEqual(["# Comment 1", ""]);
    }

    if (blocks[1]?.type === "comment") {
      expect(blocks[1].lines).toEqual(["# Comment 2"]);
    }
  });

  it("should create standalone comment block before variables", () => {
    const content = `# Comment


KEY=value`;

    const result = parseEnvFile(content);
    const blocks = toArray(result);

    // Should have: comment block, empty block, variable block
    expect(blocks).toHaveLength(3);
    expect(blocks[0]?.type).toBe("comment");
    expect(blocks[1]?.type).toBe("empty");
    expect(blocks[2]?.type).toBe("variable");

    if (blocks[0]?.type === "comment") {
      expect(blocks[0].lines).toEqual(["# Comment"]);
    }

    if (blocks[2]?.type === "variable") {
      expect(blocks[2].key).toBe("KEY");
      expect(blocks[2].comments).toEqual([]);
    }
  });
});

describe("quoteValue", () => {
  it("should not quote simple values", () => {
    expect(quoteValue("simple")).toBe("simple");
    expect(quoteValue("value123")).toBe("value123");
  });

  it("should quote values with spaces", () => {
    expect(quoteValue("value with spaces")).toBe('"value with spaces"');
  });

  it("should quote and escape special characters", () => {
    expect(quoteValue("line1\nline2")).toBe('"line1\\nline2"');
    expect(quoteValue("tab\there")).toBe('"tab\\there"');
    expect(quoteValue('quote"here')).toBe('"quote\\"here"');
    expect(quoteValue("back\\slash")).toBe('"back\\\\slash"');
  });

  it("should quote values with hash symbol", () => {
    expect(quoteValue("value#comment")).toBe('"value#comment"');
  });
});

describe("serializeToString", () => {
  it("should serialize back to original format", () => {
    const content = `# Comment
KEY1=value1
KEY2="quoted value"

KEY3=another`;

    const parsed = parseEnvFile(content);
    const serialized = serializeToString(parsed);

    // Re-parse to check integrity
    const reparsed = parseEnvFile(serialized);
    expect(getVariable(reparsed, "KEY1")).toBe("value1");
    expect(getVariable(reparsed, "KEY2")).toBe("quoted value");
    expect(getVariable(reparsed, "KEY3")).toBe("another");
  });

  it("should properly quote values when serializing", () => {
    const content = "KEY=value with spaces";
    const parsed = parseEnvFile(content);
    const serialized = serializeToString(parsed);

    expect(serialized).toBe('KEY="value with spaces"');
  });
});
