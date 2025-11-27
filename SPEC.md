# Agent Progress Tracker MCP Server — Specification

> **Version:** 1.0.0  
> **Protocol:** MCP 2025-06-18  
> **Package:** `@your-org/agent-progress-mcp`

---

## Table of Contents

| Section | Lines |
|---------|-------|
| 1. Overview | 24-58 |
| 2. Architecture | 60-120 |
| 3. Data Model | 122-190 |
| 4. Tool Definitions | 192-390 |
| 5. Summarisation | 392-470 |
| 6. Storage | 472-530 |
| 7. Configuration | 532-590 |
| 8. NPM Package Structure | 592-680 |
| 9. Error Handling | 682-730 |
| 10. Security | 732-760 |

---

## 1. Overview

### 1.1 Purpose

This MCP server enables AI agents to:

- **Log progress** — Record completed work with structured metadata
- **Retrieve context** — Fetch summarised information about prior work by ID
- **Search logs** — Discover relevant log entries by title, date, or keywords

All logs are scoped to a **project** (derived from repository name), preventing unbounded database growth and keeping context relevant to the current working context.

### 1.2 Problem Statement

Agents operating in multi-step or multi-agent workflows lack persistent memory of what was accomplished. This server provides a shared ledger where agents can:

1. Declare "I did X, here's how I did it"
2. Query "What did the previous agent do?" and receive a concise summary
3. Look up specific entries by ID for detailed context

### 1.3 Design Principles

- **Project-scoped** — All entries belong to a project (auto-created from repo name)
- **Simplicity** — Three tools, minimal configuration
- **Interoperability** — OpenAI-compatible summarisation endpoint (works with OpenAI, Anthropic, local models)
- **Lightweight summaries** — Non-frontier models with constrained prompts
- **Auto-creation** — Projects created automatically on first log entry

---

## 2. Architecture

### 2.1 High-Level Flow

```
┌─────────────┐     tools/call      ┌──────────────────┐
│   Agent     │ ──────────────────► │  MCP Server      │
│  (Client)   │ ◄────────────────── │  (This Package)  │
└─────────────┘     result          └────────┬─────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
                    ▼                        ▼                        ▼
            ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
            │ log_progress │        │ get_context  │        │ search_logs  │
            └──────┬───────┘        └──────┬───────┘        └──────────────┘
                   │                       │
                   ▼                       ▼
            ┌──────────────┐        ┌──────────────┐
            │   Storage    │        │  LLM API     │
            │   (SQLite)   │        │ (Summarise)  │
            └──────────────┘        └──────────────┘
```

### 2.2 Components

| Component | Responsibility |
|-----------|----------------|
| `McpServer` | Handles JSON-RPC transport, tool registration |
| `ProgressStore` | Persists and retrieves log entries, manages projects |
| `Summariser` | Calls OpenAI-compatible API to condense content |
| `Tools` | Three tool handlers: `log_progress`, `get_context`, `search_logs` |

### 2.3 Transport

The server uses **STDIO transport** by default for compatibility with Claude Desktop, Cursor, and other MCP hosts.

### 2.4 Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server implementation |
| `zod` | Input schema validation |
| `openai` | OpenAI-compatible API client |
| `nanoid` | Unique ID generation |
| `better-sqlite3` | Persistent storage |

### 2.5 Project Auto-Creation

When `log_progress` is called with a `projectId` that does not exist:

1. A new project record is created with that ID
2. The `createdAt` timestamp is set to current time
3. The log entry is then created under that project

No explicit project creation tool is required.

---

## 3. Data Model

### 3.1 Project Schema

```typescript
interface Project {
  projectId: string;       // Derived from repo name (e.g., "mobile-app")
  name: string;            // Defaults to projectId if not specified
  createdAt: string;       // ISO 8601 timestamp
}
```

### 3.2 Log Entry Schema

```typescript
interface LogEntry {
  id: string;              // Unique identifier (nanoid, 12 chars)
  projectId: string;       // Foreign key to project
  title: string;           // Short descriptive title
  content: string;         // Full "here's how I did it" content
  summary: string | null;  // LLM-generated summary (populated on first retrieval)
  createdAt: string;       // ISO 8601 timestamp
  tags: string[];          // Optional categorisation tags
  agentId: string | null;  // Optional identifier of the logging agent
}
```

### 3.3 Field Constraints

| Field | Type | Required | Max Length | Notes |
|-------|------|----------|------------|-------|
| `id` | string | Auto | 12 chars | Generated via `nanoid(12)` |
| `projectId` | string | Yes | 100 chars | Derived from repo name |
| `title` | string | Yes | 100 chars | Human-readable, searchable |
| `content` | string | Yes | 10,000 chars | Detailed description of work |
| `summary` | string | No | 500 chars | Generated on first `get_context` call |
| `createdAt` | string | Auto | — | ISO 8601 format |
| `tags` | string[] | No | 10 items | Each tag max 50 chars |
| `agentId` | string | No | 100 chars | Identifies source agent |

### 3.4 Example Entry

```json
{
  "id": "a1b2c3d4e5f6",
  "projectId": "mobile-app",
  "title": "Refactored authentication module",
  "content": "I refactored the authentication module to use JWT tokens instead of sessions. Changes made: 1. Added jsonwebtoken package, 2. Created src/auth/jwt.ts with sign/verify functions, 3. Updated src/middleware/auth.ts to validate tokens, 4. Modified user login endpoint to return tokens. All tests pass.",
  "summary": null,
  "createdAt": "2025-06-15T14:32:00Z",
  "tags": ["auth", "refactor"],
  "agentId": "coding-agent-1"
}
```

### 3.5 Database Schema (SQLite)

```sql
CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS log_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL,
  tags TEXT,  -- JSON array stored as string
  agent_id TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

CREATE INDEX idx_entries_project ON log_entries(project_id);
CREATE INDEX idx_entries_created ON log_entries(created_at DESC);
CREATE INDEX idx_entries_title ON log_entries(title);
```

---

## 4. Tool Definitions

### 4.1 `log_progress`

Logs a completed action with title and detailed content under a project.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project identifier (typically repo name). Auto-creates project if not exists.",
      "maxLength": 100
    },
    "title": {
      "type": "string",
      "description": "Short title describing what was done (max 100 chars)",
      "maxLength": 100
    },
    "content": {
      "type": "string",
      "description": "Detailed description of the work completed and how it was done",
      "maxLength": 10000
    },
    "tags": {
      "type": "array",
      "items": { "type": "string", "maxLength": 50 },
      "maxItems": 10,
      "description": "Optional tags for categorisation"
    },
    "agentId": {
      "type": "string",
      "description": "Optional identifier for the agent logging this entry",
      "maxLength": 100
    }
  },
  "required": ["projectId", "title", "content"]
}
```

#### Output Schema

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "description": "Unique ID assigned to this log entry" },
    "projectId": { "type": "string" },
    "title": { "type": "string" },
    "createdAt": { "type": "string", "description": "ISO 8601 timestamp" }
  },
  "required": ["id", "projectId", "title", "createdAt"]
}
```

#### Example Call

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "log_progress",
    "arguments": {
      "projectId": "mobile-app",
      "title": "Implemented user registration endpoint",
      "content": "Created POST /api/users endpoint with validation. Added bcrypt for password hashing. Wrote integration tests.",
      "tags": ["api", "users"]
    }
  }
}
```

#### Example Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "Logged: Implemented user registration endpoint (ID: x7k9m2p4q1w3) in project mobile-app" }],
    "structuredContent": {
      "id": "x7k9m2p4q1w3",
      "projectId": "mobile-app",
      "title": "Implemented user registration endpoint",
      "createdAt": "2025-06-15T14:32:00Z"
    }
  }
}
```

---

### 4.2 `get_context`

Retrieves a summarised version of a log entry by ID within a project.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project identifier to search within"
    },
    "id": {
      "type": "string",
      "description": "The unique ID of the log entry to retrieve"
    },
    "includeFull": {
      "type": "boolean",
      "description": "If true, include full content in addition to summary",
      "default": false
    }
  },
  "required": ["projectId", "id"]
}
```

#### Output Schema

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "projectId": { "type": "string" },
    "title": { "type": "string" },
    "summary": { "type": "string", "description": "LLM-generated summary of the work" },
    "content": { "type": "string", "description": "Full content (only if includeFull=true)" },
    "createdAt": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["id", "projectId", "title", "summary", "createdAt"]
}
```

#### Behaviour

1. Fetch entry from storage by `projectId` + `id`
2. If `summary` is null, call LLM to generate summary (see Section 5)
3. Cache summary in storage for future retrievals
4. Return summary (and optionally full content)

#### Example Response

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [{ "type": "text", "text": "Previous agent refactored auth to use JWT tokens. Created jwt.ts, updated middleware, modified login endpoint. Tests pass." }],
    "structuredContent": {
      "id": "a1b2c3d4e5f6",
      "projectId": "mobile-app",
      "title": "Refactored authentication module",
      "summary": "Refactored authentication from sessions to JWT. Added jsonwebtoken package, created sign/verify utilities, updated auth middleware, and modified login endpoint to return tokens. All tests passing.",
      "createdAt": "2025-06-15T14:32:00Z",
      "tags": ["auth", "refactor"]
    }
  }
}
```

---

### 4.3 `search_logs`

Searches for log entries within a project by title, date range, or tags.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "projectId": {
      "type": "string",
      "description": "Project identifier to search within"
    },
    "query": {
      "type": "string",
      "description": "Text to search in titles (case-insensitive substring match)"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Filter by tags (entries must have ALL specified tags)"
    },
    "startDate": {
      "type": "string",
      "description": "ISO 8601 date. Return entries created on or after this date"
    },
    "endDate": {
      "type": "string",
      "description": "ISO 8601 date. Return entries created on or before this date"
    },
    "limit": {
      "type": "integer",
      "description": "Maximum number of results to return",
      "default": 20,
      "maximum": 100
    }
  },
  "required": ["projectId"]
}
```

#### Output Schema

```json
{
  "type": "object",
  "properties": {
    "entries": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "title": { "type": "string" },
          "createdAt": { "type": "string" },
          "tags": { "type": "array", "items": { "type": "string" } }
        }
      }
    },
    "total": { "type": "integer", "description": "Total matching entries (before limit)" }
  },
  "required": ["entries", "total"]
}
```

#### Behaviour

1. Filter by `projectId` first
2. Apply filters in order: `query` → `tags` → `startDate`/`endDate`
3. Sort by `createdAt` descending (newest first)
4. Return up to `limit` entries
5. Does NOT return `content` or `summary` — agents must call `get_context` for details

#### Example Call

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "search_logs",
    "arguments": {
      "projectId": "mobile-app",
      "query": "auth",
      "startDate": "2025-06-01T00:00:00Z",
      "limit": 5
    }
  }
}
```

#### Example Response

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{ "type": "text", "text": "Found 2 entries matching 'auth' in mobile-app:\n1. a1b2c3d4e5f6 - Refactored authentication module (2025-06-15)\n2. z9y8x7w6v5u4 - Added auth middleware (2025-06-10)" }],
    "structuredContent": {
      "entries": [
        { "id": "a1b2c3d4e5f6", "title": "Refactored authentication module", "createdAt": "2025-06-15T14:32:00Z", "tags": ["auth", "refactor"] },
        { "id": "z9y8x7w6v5u4", "title": "Added auth middleware", "createdAt": "2025-06-10T09:15:00Z", "tags": ["auth", "middleware"] }
      ],
      "total": 2
    }
  }
}
```

---

## 5. Summarisation

### 5.1 LLM Requirements

- **Endpoint:** Any OpenAI-compatible chat completions API
- **Model:** Non-frontier, cost-effective (e.g., `gpt-4o-mini`, `claude-3-haiku-20240307`)
- **Max output tokens:** 150 (enforced via API parameter)

### 5.2 System Prompt

```
You are a technical summariser. Summarise the following agent work log in 2-3 sentences. Focus on: what was done, key files/components changed, and outcome. Be concise and factual. Do not use phrases like "The agent" - write in past tense as if reporting completed work.
```

### 5.3 User Prompt Template

```
Title: {{title}}

Content:
{{content}}
```

### 5.4 Example Summarisation

**Input:**
```
Title: Refactored authentication module

Content:
I refactored the authentication module to use JWT tokens instead of sessions. Changes made: 1. Added jsonwebtoken package, 2. Created src/auth/jwt.ts with sign/verify functions, 3. Updated src/middleware/auth.ts to validate tokens, 4. Modified user login endpoint to return tokens. All tests pass.
```

**Output:**
```
Refactored authentication from sessions to JWT tokens. Created jwt.ts with sign/verify utilities, updated auth middleware for token validation, and modified login endpoint to return tokens. All tests passing.
```

### 5.5 Caching Strategy

- Summary is generated **once** on first `get_context` call
- Stored in `summary` field of log entry
- Subsequent calls return cached summary
- No cache invalidation (content is immutable after creation)

### 5.6 Error Handling

If LLM summarisation fails:

1. Log error to stderr
2. Return full content truncated to 500 chars as fallback summary
3. Do NOT cache the fallback (retry on next call)

### 5.7 API Call Structure

```typescript
const response = await openai.chat.completions.create({
  model: config.summaryModel,  // e.g., "gpt-4o-mini"
  messages: [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Title: ${entry.title}\n\nContent:\n${entry.content}` }
  ],
  max_tokens: 150,
  temperature: 0.3  // Low temperature for consistent, factual output
});
```

---

## 6. Storage

### 6.1 Database Choice

**SQLite** via `better-sqlite3` package:

- Embedded, no external server required
- Single file per installation
- Synchronous API suitable for STDIO transport
- Handles concurrent reads well

### 6.2 File Location

Default: `~/.agent-progress-mcp/data.db`

Configurable via `AGENT_PROGRESS_DB_PATH` environment variable.

### 6.3 Initialisation

On server startup:

1. Ensure directory exists
2. Create database file if not exists
3. Run schema migrations (create tables if not exist)
4. Open connection

### 6.4 Connection Management

- Single connection opened at startup
- Connection closed on server shutdown
- Use WAL mode for better concurrent read performance:

```sql
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
```

### 6.5 Queries

#### Insert Project (if not exists)

```sql
INSERT OR IGNORE INTO projects (project_id, name, created_at)
VALUES (?, ?, ?);
```

#### Insert Log Entry

```sql
INSERT INTO log_entries (id, project_id, title, content, summary, created_at, tags, agent_id)
VALUES (?, ?, ?, ?, NULL, ?, ?, ?);
```

#### Get Entry by ID

```sql
SELECT * FROM log_entries WHERE project_id = ? AND id = ?;
```

#### Update Summary

```sql
UPDATE log_entries SET summary = ? WHERE id = ?;
```

#### Search Entries

```sql
SELECT id, title, created_at, tags
FROM log_entries
WHERE project_id = ?
  AND (? IS NULL OR title LIKE '%' || ? || '%')
  AND (? IS NULL OR created_at >= ?)
  AND (? IS NULL OR created_at <= ?)
ORDER BY created_at DESC
LIMIT ?;
```

Tag filtering is handled in application code after retrieval (JSON array parsing).

---

## 7. Configuration

### 7.1 Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AGENT_PROGRESS_DB_PATH` | No | `~/.agent-progress-mcp/data.db` | Path to SQLite database file |
| `OPENAI_API_KEY` | Yes | — | API key for summarisation endpoint |
| `OPENAI_BASE_URL` | No | `https://api.openai.com/v1` | Base URL for OpenAI-compatible API |
| `AGENT_PROGRESS_MODEL` | No | `gpt-4o-mini` | Model to use for summarisation |
| `AGENT_PROGRESS_LOG_LEVEL` | No | `info` | Logging level: debug, info, warn, error |

### 7.2 Configuration File (Optional)

Support optional `agent-progress.config.json` in current directory:

```json
{
  "dbPath": "./data/progress.db",
  "openai": {
    "apiKey": "${OPENAI_API_KEY}",
    "baseUrl": "https://api.openai.com/v1",
    "model": "gpt-4o-mini"
  },
  "logging": {
    "level": "info"
  }
}
```

Environment variables take precedence over config file.

### 7.3 Configuration Loading Order

1. Default values
2. Config file (if exists)
3. Environment variables (override)

### 7.4 Validation

On startup, validate:

- `OPENAI_API_KEY` is set (error if missing)
- Database path directory is writable
- Model name is non-empty string

---

## 8. NPM Package Structure

### 8.1 Directory Layout

```
agent-progress-mcp/
├── src/
│   ├── index.ts           # Entry point, server setup
│   ├── server.ts          # McpServer configuration
│   ├── tools/
│   │   ├── index.ts       # Tool exports
│   │   ├── log-progress.ts
│   │   ├── get-context.ts
│   │   └── search-logs.ts
│   ├── storage/
│   │   ├── index.ts
│   │   ├── store.ts       # ProgressStore class
│   │   └── schema.ts      # SQL schema definitions
│   ├── summariser/
│   │   ├── index.ts
│   │   └── summariser.ts  # Summariser class
│   ├── config/
│   │   ├── index.ts
│   │   └── config.ts      # Configuration loading
│   └── types.ts           # Shared TypeScript interfaces
├── build/                 # Compiled output
├── package.json
├── tsconfig.json
├── README.md
└── LICENSE
```

### 8.2 package.json

```json
{
  "name": "@your-org/agent-progress-mcp",
  "version": "1.0.0",
  "description": "MCP server for tracking AI agent progress across projects",
  "type": "module",
  "main": "./build/index.js",
  "bin": {
    "agent-progress-mcp": "./build/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node build/index.js",
    "lint": "eslint src/",
    "test": "vitest"
  },
  "files": ["build", "README.md", "LICENSE"],
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "better-sqlite3": "^11.0.0",
    "nanoid": "^5.0.0",
    "openai": "^4.0.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.0.0",
    "eslint": "^9.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 8.3 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "./build",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "build"]
}
```

### 8.4 Entry Point (src/index.ts)

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { ProgressStore } from "./storage/store.js";
import { Summariser } from "./summariser/summariser.js";
import { loadConfig } from "./config/config.js";

async function main() {
  const config = loadConfig();
  const store = new ProgressStore(config.dbPath);
  const summariser = new Summariser(config.openai);

  const server = new McpServer({
    name: "agent-progress-mcp",
    version: "1.0.0",
  });

  registerTools(server, store, summariser);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Agent Progress MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
```

---

## 9. Error Handling

### 9.1 Error Categories

| Category | JSON-RPC Code | Description |
|----------|---------------|-------------|
| Invalid params | -32602 | Missing required fields, validation failures |
| Not found | -32602 | Entry or project not found |
| Internal error | -32603 | Database errors, unexpected failures |
| Tool execution | N/A | Returned in result with `isError: true` |

### 9.2 Error Response Format

**Protocol error (unknown tool, invalid params):**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32602,
    "message": "Entry not found: x7k9m2p4q1w3 in project mobile-app"
  }
}
```

**Tool execution error (LLM failure, etc.):**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [{ "type": "text", "text": "Failed to generate summary: API rate limit exceeded" }],
    "isError": true
  }
}
```

### 9.3 Validation Errors

Return immediately with descriptive message:

- `projectId is required`
- `title exceeds maximum length of 100 characters`
- `content is required and cannot be empty`
- `Invalid date format for startDate: expected ISO 8601`

### 9.4 Logging

All errors logged to stderr with:

- Timestamp
- Error category
- Full error message
- Stack trace (for internal errors only)

---

## 10. Security

### 10.1 Input Validation

- All string inputs sanitised before SQL queries (parameterised queries only)
- Length limits enforced on all fields
- Invalid JSON in tags array rejected

### 10.2 API Key Handling

- `OPENAI_API_KEY` never logged
- Not included in error messages
- Not stored in database

### 10.3 File System

- Database path validated to prevent directory traversal
- Parent directories created with restrictive permissions (0700)
- Database file created with 0600 permissions

### 10.4 No Network Exposure

- STDIO transport only — no HTTP server
- No external network access except LLM API calls

### 10.5 Rate Limiting

Not implemented at server level (assumes trusted host environment). Hosts should implement their own rate limiting if exposed to untrusted agents.
