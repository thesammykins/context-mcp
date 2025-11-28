# Development Guide

This guide covers development setup, testing, and contribution guidelines for the Agent Progress MCP Server.

## Prerequisites

- Node.js >= 18.0.0
- npm or yarn package manager
- Git

## Development Setup

### 1. Clone and Install

```bash
git clone https://github.com/thesammykins/context-mcp.git
cd context-mcp
npm install
```

### 2. Development Commands

```bash
# Build the project
npm run build

# Development build (no clean)
npm run build:dev

# Watch mode for development
npm run dev

# Start the built server
npm start

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test -- --coverage

# Lint code (currently no ESLint config)
npm run lint
```

## Project Structure

```
context-mcp/
├── src/
│   ├── __tests__/          # Test files
│   ├── config/            # Configuration loading
│   ├── storage/           # Database operations
│   ├── summariser/        # LLM summarisation
│   ├── tools/             # MCP tool implementations
│   ├── utils/             # Utility functions
│   ├── index.ts           # Entry point
│   └── types.ts           # TypeScript interfaces
├── docs/                 # Documentation
├── build/                # Compiled output
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── vitest.config.ts
```

## Code Style Guidelines

### TypeScript Configuration

- **Strict mode** enabled
- **ES2022** target with **Node16** modules
- **ESM** imports with `.js` extensions
- **Declaration files** generated for better IDE support

### Code Patterns

- **Interfaces** defined in `types.ts`
- **Tool functions** return handlers with consistent structure
- **Error handling** with try/catch and console.error logging
- **Validation** using Zod schemas
- **Database operations** use better-sqlite3 with proper cleanup

### Testing

- **Vitest** for testing with globals enabled
- **Test files** in `src/__tests__/` with `.test.ts` suffix
- **Database cleanup** in afterEach hooks
- **Mock external dependencies** (LLM APIs, file system)

## Development Workflow

### 1. Making Changes

```bash
# Start development mode
npm run dev

# Make your changes
# Tests will run automatically in watch mode
```

### 2. Testing

```bash
# Run all tests
npm test

# Run specific test file
npm run test -- src/__tests__/tools/get-context.test.ts

# Run with coverage
npm run test -- --coverage
```

### 3. Building

```bash
# Clean build
npm run build

# Development build (faster, no clean)
npm run build:dev
```

## Adding New Tools

### 1. Create Tool File

```typescript
// src/tools/new-tool.ts
import { z } from 'zod';
import type { ToolHandler } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProgressStore } from '../storage/index.js';

export function createNewTool(store: ProgressStore): { handler: ToolHandler } {
  return {
    handler: async (args) => {
      // Implementation here
      return {
        content: [{ type: 'text', text: 'Result' }],
        structuredContent: { /* structured data */ }
      };
    }
  };
}
```

### 2. Register Tool

```typescript
// src/tools/index.ts
import { createNewTool } from './new-tool.js';

export function registerTools(server: McpServer, store: ProgressStore, summariser: Summariser): void {
  // Add to existing tools
  server.registerTool(
    'new_tool',
    {
      title: 'New Tool',
      description: 'Description of what the tool does',
      inputSchema: z.object({
        // Define input schema
      }),
      outputSchema: z.object({
        // Define output schema
      })
    },
    createNewTool(store).handler
  );
}
```

### 3. Add Tests

```typescript
// src/__tests__/tools/new-tool.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProgressStore } from '../../storage/index.js';
import { createNewTool } from '../../tools/new-tool.js';

describe('new_tool tool', () => {
  let store: ProgressStore;

  beforeEach(() => {
    store = new ProgressStore(':memory:');
  });

  afterEach(() => {
    store.close();
  });

  it('should handle valid input', async () => {
    const tool = createNewTool(store);
    const result = await tool.handler({ /* valid args */ });
    
    expect(result.content).toBeDefined();
    expect(result.structuredContent).toBeDefined();
  });
});
```

## Database Schema Changes

### 1. Update Schema

```typescript
// src/storage/schema.ts
export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS log_entries (
    -- existing columns
    new_column TEXT
  );
`;
```

### 2. Add Migration

```typescript
// src/storage/store.ts
private initializeDatabase(): void {
  // Create tables
  this.db.exec(CREATE_TABLES_SQL);
  
  // Add migrations
  this.migrateDatabase();
}

private migrateDatabase(): void {
  // Check if new column exists
  const result = this.db.prepare(`
    PRAGMA table_info(log_entries)
  `).all();
  
  const hasNewColumn = result.some((col: any) => col.name === 'new_column');
  
  if (!hasNewColumn) {
    this.db.exec(`
      ALTER TABLE log_entries ADD COLUMN new_column TEXT
    `);
  }
}
```

### 3. Update Types

```typescript
// src/types.ts
export interface LogEntry {
  // existing fields
  newColumn?: string | null;
}
```

## Configuration Changes

### 1. Add Environment Variable

```typescript
// src/config/config.ts
export interface Config {
  // existing fields
  newOption?: string;
}

export function loadConfig(): Config {
  return {
    // existing config
    newOption: process.env.AGENT_PROGRESS_NEW_OPTION,
  };
}
```

### 2. Update Documentation

- Add to `docs/CONFIGURATION.md`
- Update README.md if it's a major option
- Add tests for new configuration

## Release Process

### 1. Conventional Commits

Use conventional commit format:

```bash
git commit -m "feat: add new feature"
git commit -m "fix: resolve bug in tool"
git commit -m "docs: update configuration guide"
git commit -m "chore: update dependencies"
```

### 2. Automated Release

The project uses `release-please` for automated releases:

1. Push commits to `main` branch
2. `release-please` creates/updates Release PR
3. Review and merge Release PR
4. GitHub Release created automatically
5. npm publish triggered automatically

### 3. Version Bumping

- `feat:` → minor version bump
- `fix:` → patch version bump
- `feat!:` or `BREAKING CHANGE:` → major version bump
- Other types don't trigger releases

## Performance Considerations

### Database Optimization

- Use parameterized queries
- Add appropriate indexes
- Use WAL mode for concurrent reads
- Clean up test databases properly

### Memory Management

- Close database connections
- Clean up resources in error handlers
- Use efficient data structures
- Avoid memory leaks in long-running processes

## Debugging

### Enable Debug Logging

```bash
export AGENT_PROGRESS_LOG_LEVEL=debug
agent-progress-mcp
```

### Test with In-Memory Database

```typescript
const store = new ProgressStore(':memory:');
// Tests run faster and don't leave files
```

### Common Issues

1. **Database locked**: Ensure proper cleanup in tests
2. **Import errors**: Use `.js` extensions for ESM
3. **Type errors**: Check strict mode configuration
4. **Test failures**: Verify database cleanup in afterEach

## Contributing Guidelines

### Before Contributing

1. Read existing code to understand patterns
2. Check if similar feature already exists
3. Create issue for major changes
4. Follow existing code style

### Submitting Changes

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes with tests
4. Ensure all tests pass: `npm test`
5. Build successfully: `npm run build`
6. Commit with conventional format
7. Push to fork: `git push origin feature/amazing-feature`
8. Open Pull Request

### Code Review Process

- Automated tests must pass
- Code must follow project patterns
- Documentation updated for new features
- Breaking changes clearly documented
- Performance impact considered

This development guide should help you get started with contributing to the Agent Progress MCP Server.