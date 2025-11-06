/**
 * Represents a comment block in an .env file
 */
export type CommentBlock = {
  type: "comment";
  lines: string[];
  next: Block | null;
};

/**
 * Represents an empty line block in an .env file
 */
export type EmptyBlock = {
  type: "empty";
  next: Block | null;
};

/**
 * Represents a variable assignment block in an .env file
 */
export type VariableBlock = {
  type: "variable";
  key: string;
  value: string;
  raw: string;
  comments: string[];
  next: Block | null;
};

/**
 * Represents a logical block in an .env file (linked list node)
 */
export type Block =
  | CommentBlock
  | EmptyBlock
  | VariableBlock;

/**
 * Conflict between source and destination files
 */
export interface Conflict {
  key: string;
  sourceValue: string;
  destinationValue: string;
}

/**
 * Strategy for resolving conflicts
 */
export type ConflictStrategy = "interactive" | "overwrite" | "keep";

/**
 * Resolution decision for a conflict
 */
export type ConflictResolution = "overwrite" | "keep";

/**
 * Options for merging env files
 */
export interface MergeOptions {
  backup: boolean;
  strategy: ConflictStrategy;
}
