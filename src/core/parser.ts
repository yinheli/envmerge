import type { Block } from "../types";

/**
 * Line representing a single parsed line (before grouping into blocks)
 */
type Line =
  | { type: "comment"; content: string }
  | { type: "empty" }
  | { type: "variable"; key: string; value: string; raw: string };

/**
 * Parse a single line from an .env file
 */
function parseLine(line: string): Line {
  const trimmed = line.trim();

  // Empty line
  if (trimmed === "") {
    return { type: "empty" };
  }

  // Comment line
  if (trimmed.startsWith("#")) {
    return { type: "comment", content: line };
  }

  // Variable line (KEY=VALUE)
  const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
  if (match) {
    const [, key, value] = match;
    return {
      type: "variable",
      key: key!,
      value: unquoteValue(value!),
      raw: line,
    };
  }

  // Treat invalid lines as comments to preserve them
  return { type: "comment", content: line };
}

/**
 * Remove quotes from a value if present
 */
function unquoteValue(value: string): string {
  const trimmed = value.trim();

  // Remove single quotes
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  // Remove double quotes and handle escape sequences
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed
      .slice(1, -1)
      .replace(/\\n/g, "\n")
      .replace(/\\r/g, "\r")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\")
      .replace(/\\"/g, '"');
  }

  return trimmed;
}

/**
 * Quote a value for .env format
 */
export function quoteValue(value: string): string {
  // If value contains special characters, use double quotes
  if (
    value.includes(" ") ||
    value.includes("\n") ||
    value.includes("\r") ||
    value.includes("\t") ||
    value.includes("#") ||
    value.includes('"') ||
    value.includes("'") ||
    value.includes("\\")
  ) {
    const escaped = value
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");
    return `"${escaped}"`;
  }

  return value;
}

/**
 * Parse an .env file content into block linked list
 */
export function parseEnvFile(content: string): Block | null {
  const lines = [];
  const contentLines = content.split(/\r?\n/);

  for (const line of contentLines) {
    const parsed = parseLine(line);
    lines.push(parsed);
  }

  return parseBlocks(lines);
}

/**
 * Parse lines into semantic block linked list
 *
 * A block represents a logical unit in .env file:
 * - Variable block: comments immediately before a variable belong to that variable
 * - Comment block: standalone comments followed by empty line or EOF
 * - Empty block: empty lines for structure
 *
 * Comment block grouping rules:
 * - When consecutive comment blocks are separated by empty lines, they are compressed:
 *   - Multiple empty lines are compressed to a single empty line
 *   - The compressed empty line belongs to the first comment block
 *   - The next comment line starts a new comment block
 * - When comments are followed by a variable, they belong to that variable (not a standalone block)
 */
function parseBlocks(lines: Line[]): Block | null {
  let head: Block | null = null;
  let current: Block | null = null;
  const pendingComments: string[] = [];
  let consecutiveEmptyLines = 0;
  let hasEmptyLineAfterComment = false;

  // Helper to peek if next non-empty line is a comment
  const isNextNonEmptyComment = (currentIndex: number): boolean => {
    for (let i = currentIndex + 1; i < lines.length; i++) {
      const nextLine = lines[i];
      if (nextLine!.type === "comment") return true;
      if (nextLine!.type === "variable") return false;
    }
    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;

    if (line.type === "variable") {
      // If there are pending comments, they become part of the variable
      const block: Block = {
        type: "variable",
        key: line.key,
        value: line.value,
        raw: line.raw,
        comments: [...pendingComments],
        next: null,
      };

      if (!head) {
        head = block;
        current = block;
      } else if (current) {
        current.next = block;
        current = block;
      }

      pendingComments.length = 0;
      consecutiveEmptyLines = 0;
      hasEmptyLineAfterComment = false;
    } else if (line.type === "comment") {
      // If there are pending comments with empty lines, and this is a new comment
      // finalize the previous comment block
      if (pendingComments.length > 0 && hasEmptyLineAfterComment) {
        const block: Block = {
          type: "comment",
          lines: [...pendingComments],
          next: null,
        };

        if (!head) {
          head = block;
          current = block;
        } else if (current) {
          current.next = block;
          current = block;
        }

        pendingComments.length = 0;
        hasEmptyLineAfterComment = false;
      }

      // Accumulate the new comment
      pendingComments.push(line.content);
      consecutiveEmptyLines = 0;
    } else if (line.type === "empty") {
      if (pendingComments.length > 0) {
        // Check if the next non-empty line is a comment
        const nextIsComment = isNextNonEmptyComment(i);

        if (nextIsComment) {
          // Empty line between comments: compress and add to current comment block
          if (consecutiveEmptyLines === 0) {
            pendingComments.push("");
            hasEmptyLineAfterComment = true;
          }
          consecutiveEmptyLines++;
        } else {
          // Empty line before a variable or EOF: create standalone comment block
          // Only do this once (when we first encounter empty line after comments)
          if (consecutiveEmptyLines === 0) {
            const block: Block = {
              type: "comment",
              lines: [...pendingComments],
              next: null,
            };

            if (!head) {
              head = block;
              current = block;
            } else if (current) {
              current.next = block;
              current = block;
            }

            pendingComments.length = 0;
            hasEmptyLineAfterComment = false;

            // Create empty block
            const emptyBlock: Block = {
              type: "empty",
              next: null,
            };

            if (!head) {
              head = emptyBlock;
              current = emptyBlock;
            } else if (current) {
              current.next = emptyBlock;
              current = emptyBlock;
            }
          }
          consecutiveEmptyLines++;
        }
      } else {
        // Empty line without preceding comments: create empty block only once (compress consecutive empty lines)
        if (consecutiveEmptyLines === 0) {
          const block: Block = {
            type: "empty",
            next: null,
          };

          if (!head) {
            head = block;
            current = block;
          } else if (current) {
            current.next = block;
            current = block;
          }
          consecutiveEmptyLines++;
        } else {
          consecutiveEmptyLines++;
        }
      }
    }
  }

  // Handle trailing comments (at EOF)
  if (pendingComments.length > 0) {
    const block: Block = {
      type: "comment",
      lines: pendingComments,
      next: null,
    };

    if (!head) {
      head = block;
    } else if (current) {
      current.next = block;
    }
  }

  return head;
}

/**
 * Serialize blocks linked list back to lines
 */
export function serializeBlocks(head: Block | null): Line[] {
  const lines: Line[] = [];
  let current = head;

  while (current) {
    if (current.type === "variable") {
      for (const comment of current.comments) {
        lines.push({ type: "comment", content: comment });
      }
      lines.push({
        type: "variable",
        key: current.key,
        value: current.value,
        raw: current.raw,
      });
    } else if (current.type === "comment") {
      for (const content of current.lines) {
        lines.push({ type: "comment", content });
      }
    } else {
      lines.push({ type: "empty" });
    }
    current = current.next;
  }

  return lines;
}

/**
 * Serialize parsed blocks linked list back to string format
 */
export function serializeToString(head: Block | null): string {
  const lines = serializeBlocks(head);
  return lines
    .map((line) => {
      switch (line.type) {
        case "comment":
          return line.content;
        case "empty":
          return "";
        case "variable":
          return `${line.key}=${quoteValue(line.value)}`;
      }
    })
    .join("\n");
}
