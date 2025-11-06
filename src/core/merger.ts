import type { Block, CommentBlock, VariableBlock } from "../types";
import { quoteValue } from "./parser";

/**
 * Type guard for variable blocks
 */
function isVariableBlock(
  block: Block | null,
): block is Block & { type: "variable" } {
  return block?.type === "variable";
}

/**
 * Type guard for comment blocks
 */
function isCommentBlock(
  block: Block | null,
): block is Block & { type: "comment" } {
  return block?.type === "comment";
}

/**
 * Append a block to the end of linked list
 */
function appendToTail(head: Block, blockToAppend: Block): void {
  let tail = head;
  while (tail.next) {
    tail = tail.next;
  }
  tail.next = blockToAppend;
  blockToAppend.next = null;
}

/**
 * Insert a block before a target block in the linked list
 * Returns the new head if it changed
 */
function insertBefore(
  head: Block | null,
  targetBlock: Block,
  blockToInsert: Block,
): Block {
  if (!head) return blockToInsert;

  // Special case: insert before head
  if (head === targetBlock) {
    blockToInsert.next = head;
    return blockToInsert;
  }

  // Find the node before the target
  let current: Block | null = head;
  while (current.next) {
    if (current.next === targetBlock) {
      // Insert between current and current.next (targetBlock)
      blockToInsert.next = current.next;
      current.next = blockToInsert;
      return head;
    }
    current = current.next;
  }

  // Target not found (shouldn't happen), append to end
  current.next = blockToInsert;
  blockToInsert.next = null;
  return head;
}

/**
 * Find a variable block by key in linked list
 */
export function findVariableBlock(
  head: Block | null,
  key: string,
): VariableBlock | null {
  let current = head;
  while (current) {
    if (isVariableBlock(current) && current.key === key) {
      return current;
    }
    current = current.next;
  }
  return null;
}

/**
 * Find the next variable block after a given block
 */
function findNextVariable(block: Block | null): VariableBlock | null {
  let current = block?.next ?? null;
  while (current) {
    if (isVariableBlock(current)) {
      return current;
    }
    current = current.next;
  }
  return null;
}

/**
 * Find the intersection point between source and base variable lists
 * Returns the Block in base where the two lists intersect
 */
function findIntersectionPoint(
  sourceStart: Block | null,
  base: Block | null,
): Block | null {
  let current = sourceStart;

  while (current) {
    if (isVariableBlock(current)) {
      const baseBlock = findVariableBlock(base, current.key);
      if (baseBlock) {
        return baseBlock;
      }
    }
    current = current.next;
  }

  return null;
}

function areBlocksEqual(a: Block | null, b: Block | null): boolean {
  if (a === null || b === null) return false;
  if (a.type !== b.type) return false;

  switch (a.type) {
    case "comment":
      return a.lines.join("\n").trim() ===
        (b as CommentBlock).lines.join("\n").trim();
    case "empty":
      return true;
    case "variable":
      return a.key === (b as VariableBlock).key &&
        a.value === (b as VariableBlock).value;
    default:
      return false;
  }
}

/**
 * Check if a comment block already exists right before the target block
 * Skips empty blocks when searching backwards
 */
function hasCommentBlockBefore(
  head: Block | null,
  point: Block,
  comment: CommentBlock,
): boolean {
  let current = head;
  let prev: Block | null = null;

  while (current) {
    if (current === point) {
      // Look backwards, skipping empty blocks
      let checkBlock = prev;
      while (checkBlock && checkBlock.type === "empty") {
        // Find the block before this empty block
        let temp = head;
        let beforeEmpty: Block | null = null;
        while (temp && temp !== checkBlock) {
          beforeEmpty = temp;
          temp = temp.next;
        }
        checkBlock = beforeEmpty;
      }

      if (areBlocksEqual(checkBlock, comment)) {
        return true;
      }
      break;
    }
    prev = current;
    current = current.next;
  }

  return false;
}

/**
 * Insert a comment block with smart positioning logic
 */
function insertCommentBlock(
  head: Block,
  comment: CommentBlock,
): Block {
  const node: Block = { ...comment, next: null };
  const variable = findNextVariable(comment);

  if (variable) {
    const point = findVariableBlock(head, variable.key);
    if (point) {
      if (!hasCommentBlockBefore(head, point, comment)) {
        return insertBefore(head, point, node);
      } else {
        return head;
      }
    }
  }

  if (hasCommentBlockBefore(head, head, comment)) {
    return head;
  }

  appendToTail(head, node);
  return head;
}

/**
 * Merge multiple source env files into one using ordered merge strategy
 * Later sources override earlier ones
 */
export function mergeSources(...sources: Array<Block | null>): Block | null {
  const validSources = sources.filter((s): s is Block => s !== null);

  if (validSources.length === 0) return null;
  if (validSources.length === 1) return validSources[0]!;

  let result: Block = validSources[0]!;

  for (let i = 1; i < validSources.length; i++) {
    result = mergeTwo(result, validSources[i]!)!;
  }

  return result;
}

/**
 * Merge two blocks using ordered merge strategy
 * Source overrides base for existing variables
 */
function mergeTwo(base: Block, source: Block): Block {
  let head: Block = base;
  let current: Block | null = source;

  while (current) {
    if (!isVariableBlock(current)) {
      current = current.next;
      continue;
    }
    const baseBlock = findVariableBlock(head, current.key);

    if (isVariableBlock(baseBlock)) {
      // Update existing variable
      baseBlock.value = current.value;
      baseBlock.raw = `${baseBlock.key}=${quoteValue(current.value)}`;

      baseBlock.comments = current.comments;
    } else {
      const newNode: Block = { ...current, next: null };
      const point = findIntersectionPoint(
        current.next,
        head,
      );

      if (point) {
        head = insertBefore(head, point, newNode);
      } else {
        appendToTail(head, newNode);
      }
    }
    current = current.next;
  }

  // handle comments from source
  current = source;
  while (current) {
    if (!isCommentBlock(current)) {
      current = current.next;
      continue;
    }
    head = insertCommentBlock(head, current);
    current = current.next;
  }

  return head;
}
