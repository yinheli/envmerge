import { describe, expect, it } from "vitest";
import { parseEnvFile } from "@/core/parser";
import { toArray } from "./test-helpers";

describe("Block Structure", () => {
  describe("Variable Blocks", () => {
    it("should create variable blocks with associated comments", () => {
      const content = `# This is a comment
KEY1=value1`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.type).toBe("variable");

      if (blocks[0]?.type === "variable") {
        expect(blocks[0].key).toBe("KEY1");
        expect(blocks[0].value).toBe("value1");
        expect(blocks[0].comments).toHaveLength(1);
        expect(blocks[0].comments[0]).toBe("# This is a comment");
      }
    });

    it("should create variable blocks with multiple comments", () => {
      const content = `# Comment 1
# Comment 2
# Comment 3
KEY=value`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      expect(blocks).toHaveLength(1);

      if (blocks[0]?.type === "variable") {
        expect(blocks[0].comments).toHaveLength(3);
        expect(blocks[0].comments[0]).toBe("# Comment 1");
        expect(blocks[0].comments[1]).toBe("# Comment 2");
        expect(blocks[0].comments[2]).toBe("# Comment 3");
      }
    });

    it("should create variable blocks without comments", () => {
      const content = `KEY=value`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      expect(blocks).toHaveLength(1);

      if (blocks[0]?.type === "variable") {
        expect(blocks[0].comments).toHaveLength(0);
        expect(blocks[0].key).toBe("KEY");
      }
    });

    it("should handle multiple variables", () => {
      const content = `# Comment
KEY1=value1

KEY2=value2`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      const variables = blocks.filter((b) => b.type === "variable");
      expect(variables).toHaveLength(2);
    });
  });

  describe("Comment Blocks", () => {
    it("should create standalone comment blocks", () => {
      const content = `# Standalone comment

KEY=value`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      expect(blocks).toHaveLength(3);
      expect(blocks[0]?.type).toBe("comment");

      if (blocks[0]?.type === "comment") {
        expect(blocks[0].lines).toHaveLength(1);
        expect(blocks[0].lines[0]).toBe("# Standalone comment");
      }
    });

    it("should create comment blocks for comments followed by empty lines", () => {
      const content = `# Comment 1
# Comment 2

KEY=value`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      expect(blocks[0]?.type).toBe("comment");

      if (blocks[0]?.type === "comment") {
        expect(blocks[0].lines).toHaveLength(2);
      }
    });

    it("should create comment blocks at EOF", () => {
      const content = `KEY=value

# Trailing comment`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      // Should have: variable, empty, comment
      expect(blocks).toHaveLength(3);
      expect(blocks[2]?.type).toBe("comment");

      if (blocks[2]?.type === "comment") {
        expect(blocks[2].lines[0]).toBe("# Trailing comment");
      }
    });

    it("should not create comment blocks for comments immediately before variables", () => {
      const content = `# This belongs to the variable
KEY=value`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      // Should only have one variable, not a comment block
      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.type).toBe("variable");
    });
  });

  describe("Empty Blocks", () => {
    it("should create empty blocks for blank lines", () => {
      const content = `KEY1=value1

KEY2=value2`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      expect(blocks).toHaveLength(3);
      expect(blocks[1]?.type).toBe("empty");
    });

    it("should compress multiple blank lines into single empty block", () => {
      const content = `KEY1=value1


KEY2=value2`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      // Multiple empty lines should be compressed to one empty block
      expect(blocks).toHaveLength(3);
      expect(blocks[0]?.type).toBe("variable");
      expect(blocks[1]?.type).toBe("empty");
      expect(blocks[2]?.type).toBe("variable");
    });

    it("should create empty block for empty file", () => {
      const content = ``;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.type).toBe("empty");
    });
  });

  describe("Mixed Content", () => {
    it("should correctly parse complex file structure", () => {
      const content = `# Application Configuration

# Database settings
DB_HOST=localhost
DB_PORT=5432

# API Configuration
API_URL=http://api.example.com
API_KEY=secret

# Trailing comment`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      // Verify block types in order
      // Note: "Application Configuration" comment is grouped with following "Database settings" comment
      // due to empty line compression
      expect(blocks).toHaveLength(8);
      expect(blocks[0]?.type).toBe("comment"); // Application Configuration (with compressed empty line)
      expect(blocks[1]?.type).toBe("variable"); // DB_HOST with "Database settings" comment
      expect(blocks[2]?.type).toBe("variable"); // DB_PORT
      expect(blocks[3]?.type).toBe("empty");
      expect(blocks[4]?.type).toBe("variable"); // API_URL with "API Configuration" comment
      expect(blocks[5]?.type).toBe("variable"); // API_KEY
      expect(blocks[6]?.type).toBe("empty");
      expect(blocks[7]?.type).toBe("comment"); // Trailing comment

      // Verify the first comment block has compressed empty line
      if (blocks[0]?.type === "comment") {
        expect(blocks[0].lines).toEqual(["# Application Configuration", ""]);
      }

      // Verify variable blocks have correct comments
      if (blocks[1]?.type === "variable") {
        expect(blocks[1].comments).toHaveLength(1);
        expect(blocks[1].comments[0]).toBe("# Database settings");
        expect(blocks[1].key).toBe("DB_HOST");
      }

      if (blocks[4]?.type === "variable") {
        expect(blocks[4].comments).toHaveLength(1);
        expect(blocks[4].comments[0]).toBe("# API Configuration");
        expect(blocks[4].key).toBe("API_URL");
      }
    });

    it("should handle consecutive variables with and without comments", () => {
      const content = `# Comment for KEY1
KEY1=value1
KEY2=value2
# Comment for KEY3
KEY3=value3
KEY4=value4`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      // KEY1 should have comment
      if (blocks[0]?.type === "variable") {
        expect(blocks[0].key).toBe("KEY1");
        expect(blocks[0].comments).toHaveLength(1);
      }

      // KEY2 should have no comments
      if (blocks[1]?.type === "variable") {
        expect(blocks[1].key).toBe("KEY2");
        expect(blocks[1].comments).toHaveLength(0);
      }

      // KEY3 should have comment
      if (blocks[2]?.type === "variable") {
        expect(blocks[2].key).toBe("KEY3");
        expect(blocks[2].comments).toHaveLength(1);
      }

      // KEY4 should have no comments
      if (blocks[3]?.type === "variable") {
        expect(blocks[3].key).toBe("KEY4");
        expect(blocks[3].comments).toHaveLength(0);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle file with only comments", () => {
      const content = `# Comment 1
# Comment 2
# Comment 3`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      expect(blocks).toHaveLength(1);
      expect(blocks[0]?.type).toBe("comment");

      if (blocks[0]?.type === "comment") {
        expect(blocks[0].lines).toHaveLength(3);
      }
    });

    it("should handle file with only empty lines", () => {
      const content = `


`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks.every((b) => b.type === "empty")).toBe(true);
    });

    it("should handle mixed comments and empty lines without variables", () => {
      const content = `# Comment 1

# Comment 2

`;

      const result = parseEnvFile(content);
      const blocks = toArray(result);

      // Should have: comment (with compressed empty line), comment, empty
      expect(blocks).toHaveLength(3);
      expect(blocks[0]?.type).toBe("comment");
      expect(blocks[1]?.type).toBe("comment");
      expect(blocks[2]?.type).toBe("empty");

      if (blocks[0]?.type === "comment") {
        expect(blocks[0].lines).toEqual(["# Comment 1", ""]);
      }

      if (blocks[1]?.type === "comment") {
        expect(blocks[1].lines).toEqual(["# Comment 2"]);
      }
    });
  });
});
