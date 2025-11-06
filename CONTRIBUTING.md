# Contributing to envmerge

Thank you for your interest in contributing to envmerge! This document provides
guidelines and instructions for contributing.

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) v1.0.0 or higher (recommended)
- OR Node.js v20.0.0 or higher
- Git

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/envmerge.git
   cd envmerge
   ```

3. Install dependencies:
   ```bash
   bun install
   ```

4. Create a branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode
bun run test:watch

# Run tests with coverage (requires Node.js)
npm run test:coverage
```

### Type Checking

```bash
bun run typecheck
```

### Building

```bash
bun run build
```

### Testing Locally

```bash
# Run the CLI in development mode
bun run dev <source1> <source2> <destination>

# Example
bun run dev .env.base .env.local .env --strategy overwrite
```

## Code Style

- **TypeScript**: All code must be written in TypeScript with strict mode
  enabled
- **No `any` types**: Use `unknown` with type guards or specific types instead
- **Formatting**: Code will be automatically formatted (ensure consistent style)
- **Comments**: Add JSDoc comments for public APIs and complex logic
- **Naming**:
  - Use camelCase for variables and functions
  - Use PascalCase for types and interfaces
  - Use UPPER_SNAKE_CASE for constants

## Testing Guidelines

- Write tests for all new features
- Maintain or improve code coverage (target: >85%)
- Include both unit tests and integration tests where appropriate
- Test edge cases and error conditions
- Use descriptive test names that explain what is being tested

## Commit Messages

**Important**: Commit messages are used to automatically generate release notes!

- Use clear, descriptive commit messages
- Follow the [Conventional Commits](https://www.conventionalcommits.org/)
  format:
  - `feat:` for new features
  - `fix:` for bug fixes
  - `docs:` for documentation changes
  - `test:` for test additions or changes
  - `refactor:` for code refactoring
  - `chore:` for maintenance tasks

Examples:

```
feat: add support for .env.local files
fix: handle escaped quotes in values correctly
docs: update README with new examples
test: add integration tests for conflict resolution
```

**Why this matters**: When a new release is created, GitHub automatically
generates release notes from your commit messages and PR titles. Well-formatted
commits make it easier for users to understand what changed.

## Pull Request Process

1. Ensure all tests pass: `bun test`
2. Ensure type checking passes: `bun run typecheck`
3. Update the README.md if you've added features
4. Create a pull request with a clear title and description
5. Add appropriate labels to your PR (feature, bug, documentation, etc.)
6. Link any related issues in the PR description

**Note**: We don't maintain a manual CHANGELOG.md file. Release notes are
automatically generated from git history when tags are pushed.

### PR Title Format

Use a clear, descriptive title:

- ✅ "Add support for environment variable validation"
- ✅ "Fix backup path generation on Windows"
- ❌ "Update code"
- ❌ "Fixes"

### PR Description

Include:

- What changes were made and why
- How to test the changes
- Any breaking changes
- Screenshots (if applicable)

## Code Review

- Be respectful and constructive in code reviews
- Address all review comments or explain why changes weren't made
- Request re-review after making changes

## Adding New Features

Before starting work on a major new feature:

1. Open an issue to discuss the feature
2. Wait for feedback from maintainers
3. Ensure the feature aligns with project goals
4. Get approval before investing significant time

## Bug Reports

When reporting bugs, include:

- Clear, descriptive title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Bun/Node version, etc.)
- Minimal reproduction example if possible

## Questions?

- Open an issue with the "question" label
- Check existing issues for similar questions

## License

By contributing, you agree that your contributions will be licensed under the
MIT License.

Thank you for contributing to envmerge! 🎉
