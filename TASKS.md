# Agent Progress Tracker — Worker Agent Tasks

> **Reference:** `SPEC.md`  
> **Purpose:** Step-by-step task breakdown for worker agents to implement the MCP server

---

## How to Use This Document

Each task section includes:

1. **Line Reference** — Specific lines in `SPEC.md` to read
2. **Objective** — What this task achieves
3. **Steps** — Ordered implementation steps
4. **Checkpoints** — Verification criteria before marking complete
5. **Handoff** — What the next agent needs to know

**Rules:**

- Complete ALL checkpoints before moving to next task
- Do NOT read sections outside your assigned line references
- Log your progress using the progress tracking tools when available
- If blocked, document the blocker and stop

---

## Task Overview

| Task | Agent | Lines | Dependency |
|------|-------|-------|------------|
| 1. Project Scaffolding | Agent A | 592-680 | None |
| 2. Spec-Driven Tests | Agent B | 122-190, 192-390, 392-470, 682-730 | Task 1 |
| 3. Configuration Module | Agent C | 532-590 | Task 1 |
| 4. Storage Module | Agent D | 122-190, 472-530 | Tasks 1, 2 |
| 5. Summariser Module | Agent E | 392-470 | Tasks 2, 3 |
| 6. Tool: log_progress | Agent F | 192-260 | Tasks 2, 4 |
| 7. Tool: get_context | Agent G | 262-320 | Tasks 2, 4, 5 |
| 8. Tool: search_logs | Agent H | 322-390 | Tasks 2, 4 |
| 9. Server Integration | Agent I | 60-120, 592-680 | Tasks 6, 7, 8 |
| 10. Error Handling | Agent J | 682-730 | Task 9 |
| 11. Final Validation | Agent K | Full document | Task 10 |

---

## Task 1: Project Scaffolding

**Assigned to:** Agent A  
**Read lines:** 592-680 (Section 8: NPM Package Structure)

### Objective

Create the project directory structure, `package.json`, and `tsconfig.json`.

### Steps

1. Create root directory `agent-progress-mcp/`
2. Create subdirectories as specified in lines 602-620:
   - `src/`
   - `src/tools/`
   - `src/storage/`
   - `src/summariser/`
   - `src/config/`
   - `src/__tests__/`
3. Create `package.json` using template from lines 626-658
4. Create `tsconfig.json` using template from lines 660-680
5. Run `npm install` to install dependencies
6. Create placeholder `src/index.ts` with shebang line only:
   ```typescript
   #!/usr/bin/env node
   console.error("Server not implemented yet");
   ```
7. Create `src/types.ts` with empty export:
   ```typescript
   export {};
   ```

### Checkpoints

- [ ] All directories exist as specified (including `src/__tests__/`)
- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles successfully (even if minimal)
- [ ] Directory structure matches lines 602-620 exactly

### Handoff

Project is scaffolded. Dependencies installed. Test directory created. Agent B can begin writing spec-driven tests.

---

## Task 2: Spec-Driven Tests

**Assigned to:** Agent B  
**Read lines:** 122-190 (Data Model), 192-390 (Tool Definitions), 392-470 (Summarisation), 682-730 (Error Handling)

### Objective

Write comprehensive test suites BEFORE any production code. Tests define expected behaviour from the specification. All tests will initially fail — this is expected and correct.

### Steps

1. Create test configuration `vitest.config.ts`:
   ```typescript
   import { defineConfig } from 'vitest/config';
   export default defineConfig({
     test: {
       globals: true,
       environment: 'node',
     },
   });
   ```

2. Create `src/__tests__/config.test.ts`:
   - Test: loads default values when no env vars set (expect API key error)
   - Test: reads `OPENAI_API_KEY` from environment
   - Test: reads `OPENAI_BASE_URL` with default fallback
   - Test: reads `AGENT_PROGRESS_MODEL` with default `gpt-4o-mini`
   - Test: expands `~` in `AGENT_PROGRESS_DB_PATH`
   - Test: throws if `OPENAI_API_KEY` missing

3. Create `src/__tests__/store.test.ts`:
   - Test: creates database file on initialization
   - Test: creates tables on first run
   - Test: `ensureProject()` creates project if not exists
   - Test: `ensureProject()` is idempotent (no error on duplicate)
   - Test: `createEntry()` generates 12-char nanoid
   - Test: `createEntry()` stores all fields correctly
   - Test: `getEntry()` returns entry by projectId + id
   - Test: `getEntry()` returns null for non-existent entry
   - Test: `updateSummary()` persists summary
   - Test: `searchEntries()` filters by projectId
   - Test: `searchEntries()` filters by title query (case-insensitive)
   - Test: `searchEntries()` filters by date range
   - Test: `searchEntries()` filters by tags (AND logic)
   - Test: `searchEntries()` respects limit
   - Test: `searchEntries()` sorts by createdAt descending

4. Create `src/__tests__/summariser.test.ts`:
   - Test: initializes OpenAI client with custom baseUrl
   - Test: calls API with correct system prompt (lines 408-410)
   - Test: calls API with correct user prompt format (lines 412-416)
   - Test: uses `max_tokens: 150` and `temperature: 0.3`
   - Test: returns summary from API response
   - Test: returns truncated content (500 chars) on API failure
   - Test: logs error to stderr on failure

5. Create `src/__tests__/tools/log-progress.test.ts`:
   - Test: rejects missing `projectId`
   - Test: rejects missing `title`
   - Test: rejects missing `content`
   - Test: rejects `title` exceeding 100 chars
   - Test: rejects `content` exceeding 10000 chars
   - Test: accepts valid input and returns id, projectId, title, createdAt
   - Test: returned id is 12 characters
   - Test: createdAt is valid ISO 8601
   - Test: auto-creates project on first entry
   - Test: response includes text content and structuredContent

6. Create `src/__tests__/tools/get-context.test.ts`:
   - Test: rejects missing `projectId`
   - Test: rejects missing `id`
   - Test: returns error for non-existent entry
   - Test: generates summary on first retrieval (mock LLM)
   - Test: caches summary after generation
   - Test: returns cached summary on subsequent calls (no LLM call)
   - Test: includes full content when `includeFull: true`
   - Test: excludes content when `includeFull: false`

7. Create `src/__tests__/tools/search-logs.test.ts`:
   - Test: rejects missing `projectId`
   - Test: accepts projectId-only query (returns all entries)
   - Test: applies default limit of 20
   - Test: respects max limit of 100
   - Test: filters by title query (case-insensitive substring)
   - Test: filters by startDate
   - Test: filters by endDate
   - Test: filters by tags (AND logic)
   - Test: sorts results by createdAt descending
   - Test: response excludes content and summary

8. Create `src/__tests__/integration.test.ts`:
   - Test: server starts and exposes three tools
   - Test: full workflow — log → search → get_context
   - Test: summary cached after first get_context

9. Add test script to `package.json`:
   ```json
   "scripts": {
     "test": "vitest run",
     "test:watch": "vitest"
   }
   ```

### Checkpoints

- [ ] All test files created in `src/__tests__/`
- [ ] `npm run test` executes (tests will FAIL — this is expected)
- [ ] Tests cover ALL input/output schemas from Section 4
- [ ] Tests cover ALL error cases from Section 9
- [ ] Tests verify summarisation prompt matches spec exactly
- [ ] No production code written — only test files

### Handoff

Test suite complete. All tests fail. Subsequent agents implement modules to make tests pass. Each agent should run `npm run test -- --grep "module-name"` to verify their implementation.

---

## Task 3: Configuration Module

**Assigned to:** Agent C  
**Read lines:** 532-590 (Section 7: Configuration)

### Objective

Implement configuration loading from environment variables and optional config file.

### Steps

1. Create `src/config/index.ts` that exports from `config.ts`
2. Create `src/config/config.ts` implementing:
   - Interface `Config` with fields from lines 540-548
   - Function `loadConfig(): Config`
   - Load order: defaults → config file → env vars (lines 572-576)
   - Validation logic from lines 578-582
3. Add to `src/types.ts`:
   ```typescript
   export interface OpenAIConfig {
     apiKey: string;
     baseUrl: string;
     model: string;
   }

   export interface Config {
     dbPath: string;
     openai: OpenAIConfig;
     logLevel: "debug" | "info" | "warn" | "error";
   }
   ```

### Checkpoints

- [ ] `loadConfig()` returns valid Config object with defaults
- [ ] Environment variables override config file values
- [ ] Throws descriptive error if `OPENAI_API_KEY` not set
- [ ] Expands `~` in `dbPath` to home directory
- [ ] Exports compile without TypeScript errors
- [ ] `npm run test -- --grep "config"` — all config tests pass

### Handoff

Configuration module complete. Other agents can import `loadConfig()` from `./config/index.js`.

---

## Task 4: Storage Module

**Assigned to:** Agent D  
**Read lines:** 122-190 (Section 3: Data Model), 472-530 (Section 6: Storage)

### Objective

Implement SQLite storage with `ProgressStore` class.

### Steps

1. Create `src/storage/index.ts` that exports from `store.ts`
2. Create `src/storage/schema.ts` with SQL from lines 176-190:
   - `CREATE_PROJECTS_TABLE` constant
   - `CREATE_ENTRIES_TABLE` constant
   - `CREATE_INDEXES` constant
   - `PRAGMA_STATEMENTS` constant
3. Create `src/storage/store.ts` implementing `ProgressStore` class:
   - Constructor takes `dbPath: string`
   - Initialize database (lines 488-494)
   - Implement methods:
     - `ensureProject(projectId: string): void`
     - `createEntry(entry: Omit<LogEntry, "summary">): LogEntry`
     - `getEntry(projectId: string, id: string): LogEntry | null`
     - `updateSummary(id: string, summary: string): void`
     - `searchEntries(params: SearchParams): SearchResult`
     - `close(): void`
4. Add to `src/types.ts`:
   ```typescript
   export interface Project {
     projectId: string;
     name: string;
     createdAt: string;
   }

   export interface LogEntry {
     id: string;
     projectId: string;
     title: string;
     content: string;
     summary: string | null;
     createdAt: string;
     tags: string[];
     agentId: string | null;
   }

   export interface SearchParams {
     projectId: string;
     query?: string;
     tags?: string[];
     startDate?: string;
     endDate?: string;
     limit?: number;
   }

   export interface SearchResult {
     entries: Pick<LogEntry, "id" | "title" | "createdAt" | "tags">[];
     total: number;
   }
   ```

### Checkpoints

- [ ] Database file created at specified path
- [ ] Tables created on first initialization
- [ ] `ensureProject()` creates project if not exists (idempotent)
- [ ] `createEntry()` generates ID via nanoid(12)
- [ ] `getEntry()` returns null for non-existent entries
- [ ] `searchEntries()` filters by projectId correctly
- [ ] All queries use parameterised statements (no SQL injection)
- [ ] Tags stored as JSON string, parsed on retrieval
- [ ] `npm run test -- --grep "store"` — all storage tests pass

### Handoff

Storage module complete. Agents can import `ProgressStore` from `./storage/index.js`.

---

## Task 5: Summariser Module

**Assigned to:** Agent E  
**Read lines:** 392-470 (Section 5: Summarisation)

### Objective

Implement LLM-based summarisation using OpenAI-compatible API.

### Steps

1. Create `src/summariser/index.ts` that exports from `summariser.ts`
2. Create `src/summariser/summariser.ts` implementing `Summariser` class:
   - Constructor takes `config: OpenAIConfig`
   - Initialize OpenAI client with baseUrl and apiKey
   - Implement `summarise(title: string, content: string): Promise<string>`
   - Use system prompt from lines 408-410
   - Use user prompt template from lines 412-416
   - API call structure from lines 454-464
   - Error handling from lines 440-446

### Checkpoints

- [ ] OpenAI client initialized with custom baseUrl support
- [ ] System prompt matches spec exactly
- [ ] `max_tokens: 150` and `temperature: 0.3` set
- [ ] On API failure, returns truncated content (500 chars) as fallback
- [ ] Fallback is NOT returned as cached summary (indicated by return type or flag)
- [ ] Errors logged to stderr
- [ ] `npm run test -- --grep "summariser"` — all summariser tests pass

### Handoff

Summariser module complete. Agents can import `Summariser` from `./summariser/index.js`.

---

## Task 6: Tool — log_progress

**Assigned to:** Agent F  
**Read lines:** 192-260 (Section 4.1: log_progress)

### Objective

Implement the `log_progress` MCP tool.

### Steps

1. Create `src/tools/log-progress.ts`
2. Import `ProgressStore` and types
3. Define Zod schema matching input schema (lines 204-230)
4. Implement tool handler function:
   ```typescript
   export function createLogProgressTool(store: ProgressStore) {
     // Return tool registration object
   }
   ```
5. Handler logic:
   - Validate input via Zod
   - Call `store.ensureProject(projectId)`
   - Generate ID via `nanoid(12)`
   - Create timestamp via `new Date().toISOString()`
   - Call `store.createEntry()`
   - Return response matching output schema (lines 232-242)
6. Format text content as: `Logged: {title} (ID: {id}) in project {projectId}`

### Checkpoints

- [ ] Input validation rejects missing required fields
- [ ] Input validation enforces maxLength constraints
- [ ] Project auto-created on first entry
- [ ] Response includes both `content` (text) and `structuredContent`
- [ ] Returned `id` is 12 characters
- [ ] `createdAt` is valid ISO 8601
- [ ] `npm run test -- --grep "log_progress"` — all log_progress tests pass

### Handoff

`log_progress` tool complete. Export from `src/tools/index.ts`.

---

## Task 7: Tool — get_context

**Assigned to:** Agent G  
**Read lines:** 262-320 (Section 4.2: get_context)

### Objective

Implement the `get_context` MCP tool with LLM summarisation.

### Steps

1. Create `src/tools/get-context.ts`
2. Import `ProgressStore`, `Summariser`, and types
3. Define Zod schema matching input schema (lines 272-290)
4. Implement tool handler function:
   ```typescript
   export function createGetContextTool(store: ProgressStore, summariser: Summariser) {
     // Return tool registration object
   }
   ```
5. Handler logic (lines 294-300):
   - Fetch entry via `store.getEntry(projectId, id)`
   - If not found, return error
   - If `summary` is null:
     - Call `summariser.summarise(entry.title, entry.content)`
     - If successful, call `store.updateSummary(id, summary)`
   - Return response matching output schema (lines 292-306)
   - Include `content` only if `includeFull === true`

### Checkpoints

- [ ] Returns error for non-existent entry
- [ ] Summary generated on first retrieval
- [ ] Summary cached after generation
- [ ] Subsequent calls return cached summary (no LLM call)
- [ ] `includeFull: true` includes full content in response
- [ ] `includeFull: false` (default) excludes content
- [ ] `npm run test -- --grep "get_context"` — all get_context tests pass

### Handoff

`get_context` tool complete. Export from `src/tools/index.ts`.

---

## Task 8: Tool — search_logs

**Assigned to:** Agent H  
**Read lines:** 322-390 (Section 4.3: search_logs)

### Objective

Implement the `search_logs` MCP tool.

### Steps

1. Create `src/tools/search-logs.ts`
2. Import `ProgressStore` and types
3. Define Zod schema matching input schema (lines 332-360)
4. Implement tool handler function:
   ```typescript
   export function createSearchLogsTool(store: ProgressStore) {
     // Return tool registration object
   }
   ```
5. Handler logic:
   - Validate input via Zod
   - Apply default `limit: 20` if not specified
   - Call `store.searchEntries(params)`
   - Format text content listing entries (lines 384-386)
   - Return response matching output schema (lines 362-378)

### Checkpoints

- [ ] Only `projectId` is required
- [ ] Default limit is 20, max is 100
- [ ] Results sorted by `createdAt` descending
- [ ] Query matches title substring (case-insensitive)
- [ ] Date range filtering works correctly
- [ ] Tag filtering requires ALL tags (AND logic)
- [ ] Response does NOT include `content` or `summary`
- [ ] `npm run test -- --grep "search_logs"` — all search_logs tests pass

### Handoff

`search_logs` tool complete. Export from `src/tools/index.ts`.

---

## Task 9: Server Integration

**Assigned to:** Agent I  
**Read lines:** 60-120 (Section 2: Architecture), 592-680 (Section 8: Entry Point)

### Objective

Wire all modules together in the MCP server entry point.

### Steps

1. Create `src/tools/index.ts`:
   ```typescript
   export { createLogProgressTool } from "./log-progress.js";
   export { createGetContextTool } from "./get-context.js";
   export { createSearchLogsTool } from "./search-logs.js";

   export function registerTools(server, store, summariser) {
     // Register all three tools with server
   }
   ```
2. Update `src/index.ts` using template from lines 682-710:
   - Import all modules
   - Load config
   - Initialize ProgressStore
   - Initialize Summariser
   - Create McpServer instance
   - Register tools
   - Connect via StdioServerTransport
   - Add graceful shutdown handling
3. Add to `package.json` bin field:
   ```json
   "bin": {
     "agent-progress-mcp": "./build/index.js"
   }
   ```

### Checkpoints

- [ ] Server starts without errors
- [ ] All three tools appear in `tools/list` response
- [ ] `console.error` used for logging (not `console.log`)
- [ ] Process exits cleanly on SIGINT/SIGTERM
- [ ] Database connection closed on shutdown
- [ ] `npm run test -- --grep "integration"` — integration tests pass

### Handoff

Server integration complete. Ready for error handling polish.

---

## Task 10: Error Handling

**Assigned to:** Agent J  
**Read lines:** 682-730 (Section 9: Error Handling)

### Objective

Implement comprehensive error handling across all modules.

### Steps

1. Review error categories (lines 688-694)
2. Update each tool handler to:
   - Return validation errors with descriptive messages (lines 716-720)
   - Use `isError: true` for tool execution errors
   - Log errors to stderr with timestamps
3. Create `src/utils/errors.ts`:
   ```typescript
   export class ValidationError extends Error { ... }
   export class NotFoundError extends Error { ... }
   export function formatError(error: Error): string { ... }
   ```
4. Update storage module:
   - Wrap database operations in try/catch
   - Throw descriptive errors for constraint violations
5. Update summariser module:
   - Handle network errors gracefully
   - Implement fallback logic from lines 440-446

### Checkpoints

- [ ] Missing required fields return clear validation error
- [ ] Non-existent entry returns "not found" error
- [ ] Database errors logged with stack trace
- [ ] LLM failures return truncated content fallback
- [ ] No unhandled promise rejections
- [ ] All errors include context (projectId, entryId where applicable)
- [ ] `npm run test` — ALL tests pass

### Handoff

Error handling complete. Ready for final validation.

---

## Task 11: Final Validation

**Assigned to:** Agent K  
**Read lines:** Full document

### Objective

Validate the complete implementation against the specification and prepare for release.

### Steps

1. Run full test suite:
   ```bash
   npm run test
   ```
2. Verify all tests pass
3. Build production bundle:
   ```bash
   npm run build
   ```
4. Manual integration test:
   - Start server: `node build/index.js`
   - Connect with MCP client (Claude Desktop, Cursor, or mcp-cli)
   - Execute full workflow:
     - Call `log_progress` → verify response
     - Call `search_logs` → verify entry appears
     - Call `get_context` → verify summary generated
     - Call `get_context` again → verify cached (no LLM call)
5. Validate against spec:
   - [ ] All input schemas match Section 4
   - [ ] All output schemas match Section 4
   - [ ] Summarisation prompt matches Section 5.2-5.3
   - [ ] Database schema matches Section 3.5
   - [ ] Error codes match Section 9
6. Create README.md with:
   - Installation instructions
   - Configuration (env vars)
   - MCP host integration (Claude Desktop, Cursor)
   - Tool usage examples

### Checkpoints

- [ ] `npm run test` — ALL tests pass
- [ ] `npm run build` produces working binary
- [ ] `npx agent-progress-mcp` starts server
- [ ] Manual test with MCP client succeeds
- [ ] README.md complete

### Handoff

Implementation complete and validated. Ready for release.

---

## Completion Checklist

Before marking the project complete, verify:

- [ ] All 11 tasks completed with checkpoints passed
- [ ] All spec-driven tests written BEFORE production code
- [ ] `npm run build` succeeds
- [ ] `npm run test` passes (all tests green)
- [ ] README.md documents installation and usage
- [ ] Server works with at least one MCP host (Claude Desktop, Cursor, etc.)
