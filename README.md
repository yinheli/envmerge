# envmerge

A CLI tool to intelligently merge multiple `.env` files while preserving
comments, handling conflicts, and maintaining file structure.

[![CI](https://github.com/yinheli/envmerge/workflows/CI/badge.svg)](https://github.com/yinheli/envmerge/actions)
[![npm version](https://badge.fury.io/js/%40yinheli%2Fenvmerge.svg)](https://www.npmjs.com/package/@yinheli/envmerge)
[![JSR](https://jsr.io/badges/@yinheli/envmerge)](https://jsr.io/@yinheli/envmerge)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🔄 **Smart Merging**: Merge multiple `.env` files with configurable priority
- 🎯 **Intelligent Positioning**: New variables are automatically grouped with
  related variables based on comments and naming patterns
- 💬 **Preserve Comments**: Keep all comments and empty lines from source files
- 🔒 **Automatic Backups**: Creates timestamped backups before modifying
  destination files
- ⚡ **Conflict Resolution**: Choose between interactive, overwrite, or keep
  strategies

## Installation

### npm

```bash
npm install -g @yinheli/envmerge
```

### JSR (Deno)

```bash
deno install -Agf jsr:@yinheli/envmerge
```

### Bun

```bash
bun install -g @yinheli/envmerge
```

> **Note**: After installation, the CLI command is available as `envmerge`.

## Usage

### Basic Usage

Merge multiple source files into a destination file:

```bash
envmerge .env.base .env.local .env
```

This will:

1. Read `.env.base` and `.env.local` (in that order)
2. Merge them with later files taking priority
3. Create a backup of `.env` if it exists
4. Interactively resolve any conflicts with existing values in `.env`
5. Write the merged result to `.env`

### Command Line Options

```
envmerge [options] <sources...> <destination>

Arguments:
  sources       Source .env files to merge (in priority order, left to right)
  destination   Destination .env file path

Options:
  -V, --version              Output the version number
  -h, --help                 Display help information
  --no-backup                Skip creating a backup of the destination file
  -s, --strategy <type>      Conflict resolution strategy (choices: "interactive", "overwrite", "keep", default: "interactive")
```

### Examples

#### Merge with automatic overwrite

```bash
envmerge --strategy overwrite .env.defaults .env.production .env
```

#### Merge without backup

```bash
envmerge --no-backup .env.base .env.local .env
```

#### Keep existing values on conflicts

```bash
envmerge --strategy keep .env.template .env
```

#### Interactive conflict resolution (default)

```bash
envmerge .env.base .env.local .env
```

When conflicts are detected, you'll see:

```
Found 2 conflict(s) to resolve:

? How would you like to resolve conflicts?
❯ Review each conflict individually
  Overwrite all with source values
  Keep all destination values
```

If you choose individual review:

```
Conflict for key: DATABASE_URL
  Current (destination): postgresql://localhost/old_db
  New (source):          postgresql://localhost/new_db

? Which value should be used?
❯ Use new value: postgresql://localhost/new_db
  Keep current value: postgresql://localhost/old_db
```

## Conflict Resolution Strategies

### `interactive` (default)

Prompts you to resolve each conflict individually or apply a bulk resolution
(overwrite all or keep all). Best for manual review and control.

### `overwrite`

Automatically uses values from source files, overwriting any conflicting values
in the destination. Best for automated deployments where source files are
authoritative.

### `keep`

Preserves all existing values in the destination file, only adding new variables
from sources. Best when you want to add new variables without modifying existing
configuration.

## How It Works

### Merge Priority

When merging multiple source files, **later files override earlier files**:

```bash
envmerge .env.base .env.dev .env.local .env
```

Priority order (highest to lowest):

1. `.env.local` (highest priority)
2. `.env.dev`
3. `.env.base`
4. `.env` (destination - only for variables not in sources)

### Conflict Detection

A conflict occurs when:

- A variable exists in both the merged sources and the destination file
- The values are different

### Backup Naming

Backups are created with the format:

```
.env-backup-envmerge-YYYYMMDDHHmmss
```

Example: `.env-backup-envmerge-20250106123045`

### Comment and Structure Preservation

envmerge preserves:

- All comments (lines starting with `#`)
- Empty lines
- Original formatting and order from source files
- Destination file structure when merging

Example:

**Input (.env.base):**

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432

# API Keys
API_KEY=base_key
```

**Input (.env.local):**

```bash
# Override for local development
API_KEY=local_key
API_SECRET=secret123
```

**Output (.env):**

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432

# API Keys
API_KEY=local_key
API_SECRET=secret123
```

### Intelligent Variable Positioning

envmerge uses smart positioning algorithms to place new variables in logical
locations:

#### Comment Group Matching

New variables are inserted near variables with matching comment groups:

**Destination (.env):**

```bash
# Database
DB_HOST=localhost

# API
API_URL=http://api.example.com
```

**Source (.env.local):**

```bash
# Database
DB_PORT=5432
DB_USER=admin
```

**Result (.env):**

```bash
# Database
DB_HOST=localhost
DB_PORT=5432     # ← Automatically grouped with DB_HOST
DB_USER=admin    # ← Automatically grouped with DB_HOST

# API
API_URL=http://api.example.com
```

#### Variable Prefix Matching

Variables with similar prefixes (like `DB_*`, `API_*`) are grouped together even
without matching comments:

**Destination (.env):**

```bash
DB_HOST=localhost
API_URL=http://api
```

**Source (.env.local):**

```bash
DB_PORT=5432
API_KEY=secret
```

**Result (.env):**

```bash
DB_HOST=localhost
DB_PORT=5432     # ← Grouped by DB_ prefix
API_URL=http://api
API_KEY=secret   # ← Grouped by API_ prefix
```

#### Source File Order Preservation

The relative order of variables from source files is always preserved:

```bash
# Source has: FIRST=1, SECOND=2, THIRD=3
# Result maintains: FIRST, SECOND, THIRD in the same order
```

## Development

### Prerequisites

- [Bun](https://bun.sh) (recommended) or Node.js >=18
- TypeScript knowledge

### Setup

```bash
# Clone the repository
git clone https://github.com/yinheli/envmerge.git
cd envmerge

# Install dependencies
bun install

# Run tests
bun test

# Run tests with coverage
bun run test:coverage

# Type check
bun run typecheck

# Build
bun run build

# Run locally
bun run dev .env.example .env
```

### Testing

The project uses Vitest for testing with a comprehensive test suite:

```bash
# Run all tests
bun test

# Watch mode
bun run test:watch

# Coverage report
bun run test:coverage
```

## API

While primarily a CLI tool, you can also use envmerge programmatically:

```typescript
import { mergeSources, parseEnvFile, writeEnvFile } from "@yinheli/envmerge";
import { readFileSync } from "node:fs";

// Parse files (returns linked list of blocks)
const source1 = parseEnvFile(readFileSync(".env.base", "utf-8"));
const source2 = parseEnvFile(readFileSync(".env.local", "utf-8"));

// Merge (source2 overrides source1 for existing variables)
const merged = mergeSources(source1, source2);

// Write result
writeEnvFile(".env", merged);
```

### Advanced Usage

The library uses a linked list data structure to represent `.env` files as
blocks. Each block can be a variable, comment, or empty line:

```typescript
import type { Block } from "@yinheli/envmerge";
import { parseEnvFile, serializeToString } from "@yinheli/envmerge";

const content = readFileSync(".env", "utf-8");
const head = parseEnvFile(content);

// Traverse the linked list
let current = head;
while (current) {
  switch (current.type) {
    case "variable":
      console.log(`${current.key}=${current.value}`);
      console.log(`Comments: ${current.comments.join("\n")}`);
      break;
    case "comment":
      console.log(`Comment block: ${current.lines.join("\n")}`);
      break;
    case "empty":
      console.log("Empty line");
      break;
  }
  current = current.next;
}

// Convert back to string
const output = serializeToString(head);
```

### Type Definitions

```typescript
type CommentBlock = {
  type: "comment";
  lines: string[];
  next: Block | null;
};

type EmptyBlock = {
  type: "empty";
  next: Block | null;
};

type VariableBlock = {
  type: "variable";
  key: string;
  value: string;
  raw: string;
  comments: string[]; // Comments immediately before this variable
  next: Block | null;
};

type Block = CommentBlock | EmptyBlock | VariableBlock;
```

## Contributors

![Contributors](https://contrib.rocks/image?repo=yinheli/envmerge)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

[MIT](LICENSE) © yinheli

## Related Projects

- [dotenv](https://github.com/motdotla/dotenv) - Load environment variables from
  `.env` files
- [dotenv-expand](https://github.com/motdotla/dotenv-expand) - Variable
  expansion for dotenv
- [env-cmd](https://github.com/toddbluhm/env-cmd) - Execute commands with
  specific environment variables
