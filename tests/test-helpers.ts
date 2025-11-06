import type { Block } from "@/types";

/**
 * Helper to convert linked list to array for testing
 */
export function toArray(head: Block | null): Block[] {
  const arr: Block[] = [];
  let current = head;
  while (current) {
    arr.push(current);
    current = current.next;
  }
  return arr;
}

/**
 * Helper to get variable value from linked list
 */
export function getVariable(
  head: Block | null,
  key: string,
): string | undefined {
  let current = head;
  while (current) {
    if (current.type === "variable" && current.key === key) {
      return current.value;
    }
    current = current.next;
  }
  return undefined;
}

/**
 * Helper to find a variable block by key
 */
export function findVariable(
  head: Block | null,
  key: string,
): Block | undefined {
  let current = head;
  while (current) {
    if (current.type === "variable" && current.key === key) {
      return current;
    }
    current = current.next;
  }
  return undefined;
}

/**
 * Helper to count blocks in linked list
 */
export function countBlocks(head: Block | null): number {
  let count = 0;
  let current = head;
  while (current) {
    count++;
    current = current.next;
  }
  return count;
}
