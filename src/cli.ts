import { Command } from "commander";
import { existsSync, readFileSync } from "node:fs";
import prompts from "prompts";
import {
  type Block,
  type ConflictResolution,
  type ConflictStrategy,
  type MergeOptions,
} from "./types";
import { parseEnvFile, quoteValue } from "./core/parser";
import { findVariableBlock, mergeSources } from "./core/merger";
import { cleanupRedundantBackup, createBackup } from "./core/backup";
import { writeEnvFile } from "./core/writer";

/**
 * Interactively resolve a single conflict with the user
 */
async function resolveInteractively(
  key: string,
  sourceValue: string,
  destinationValue: string,
): Promise<ConflictResolution> {
  console.log(`\nConflict for key: ${key}`);
  console.log(`  Current (destination): ${destinationValue}`);
  console.log(`  New (source):          ${sourceValue}`);

  const response = await prompts({
    type: "select",
    name: "value",
    message: "Which value should be used?",
    choices: [
      {
        title: `Use new value: ${sourceValue}`,
        value: "overwrite",
      },
      {
        title: `Keep current value: ${destinationValue}`,
        value: "keep",
      },
    ],
    initial: 0,
  });

  // Handle cancellation
  if (!response.value) {
    throw new Error("Operation cancelled by user");
  }

  return response.value as ConflictResolution;
}

async function mergeEnvFiles(
  sourcePaths: string[],
  destinationPath: string,
  options: MergeOptions,
): Promise<void> {
  try {
    for (const sourcePath of sourcePaths) {
      if (!existsSync(sourcePath)) {
        throw new Error(`Source file not found: ${sourcePath}`);
      }
    }

    // Parse source files
    const sources = sourcePaths.map((path) => {
      const content = readFileSync(path, "utf-8");
      return parseEnvFile(content);
    });

    // Merge sources (later files override earlier ones)
    const merged = mergeSources(...sources);

    const destinationExists = existsSync(destinationPath);
    let destination = destinationExists
      ? parseEnvFile(readFileSync(destinationPath, "utf-8"))
      : null;

    // Create backup if needed
    let backupPath: string | undefined;
    if (options.backup && destinationExists) {
      backupPath = createBackup(destinationPath);
      if (backupPath) {
        console.log(`Created backup: ${backupPath}`);
      }
    }

    // Traverse destination and handle conflicts in one pass
    let conflictCount = 0;

    if (destination) {
      let current: Block | null = destination;

      while (current) {
        if (current.type !== "variable") {
          current = current.next;
          continue;
        }

        // Find matching variable in merged
        const mergedBlock = findVariableBlock(merged, current.key);

        if (!mergedBlock || mergedBlock.value === current.value) {
          current = current.next;
          continue;
        }

        // Handle conflict
        conflictCount++;

        let strategy = "keep";

        if (options.strategy === "interactive") {
          strategy = await resolveInteractively(
            current.key,
            mergedBlock.value,
            current.value,
          );
        } else if (options.strategy === "overwrite") {
          strategy = "overwrite";
        }

        if (strategy === "overwrite") {
          current.value = mergedBlock.value;
          current.raw = `${current.key}=${quoteValue(mergedBlock.value)}`;
        }

        current = current.next;
      }
    }

    if (conflictCount === 0) {
      console.log("No conflicts detected.");
    }

    const final = mergeSources(merged, destination);

    writeEnvFile(destinationPath, final);

    // Cleanup redundant backup if the file didn't actually change
    if (backupPath && cleanupRedundantBackup(destinationPath, backupPath)) {
      console.log(`Removed redundant backup (file unchanged): ${backupPath}`);
    }

    console.log(
      `\nSuccessfully merged ${sourcePaths.length} file(s) into ${destinationPath}`,
    );
    if (conflictCount > 0) {
      console.log(`Resolved ${conflictCount} conflict(s)`);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`\nError: ${error.message}`);
    } else {
      console.error("\nAn unexpected error occurred");
    }
    process.exit(1);
  }
}

/**
 * Create and configure the CLI
 */
export function createCLI(): Command {
  const program = new Command();

  program
    .name("envmerge")
    .description(
      "Merge multiple .env files while preserving comments and handling conflicts",
    )
    .version("0.1.0")
    .argument(
      "<files...>",
      "Source .env files followed by destination file (last argument is destination)",
    )
    .option("--no-backup", "Skip creating a backup of the destination file")
    .option(
      "-s, --strategy <type>",
      "Conflict resolution strategy: interactive, overwrite, or keep",
      "interactive",
    )
    .action(
      async (
        files: string[],
        options: { backup: boolean; strategy: string },
      ) => {
        // Extract destination (last argument) and sources (all before last)
        if (files.length < 2) {
          console.error(
            "Error: At least one source and one destination file are required",
          );
          console.error("Usage: envmerge <source1> [source2...] <destination>");
          process.exit(1);
        }

        const destination = files[files.length - 1]!;
        const sources = files.slice(0, -1);

        // Validate strategy
        const validStrategies: ConflictStrategy[] = [
          "interactive",
          "overwrite",
          "keep",
        ];
        if (!validStrategies.includes(options.strategy as ConflictStrategy)) {
          console.error(
            `Error: Invalid strategy "${options.strategy}". Must be one of: ${
              validStrategies.join(", ")
            }`,
          );
          process.exit(1);
        }

        const mergeOptions: MergeOptions = {
          backup: options.backup,
          strategy: options.strategy as ConflictStrategy,
        };

        await mergeEnvFiles(sources, destination, mergeOptions);
      },
    );

  return program;
}
