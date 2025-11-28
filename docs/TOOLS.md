# Agent Progress Tools - Technical Overview

This document explains what each agent progress tool does and how they work together.

## Tool Descriptions

### `log_progress`
**Purpose**: Records completed work with structured metadata for future reference.

**What it does**:
- Creates a new log entry in the database
- Auto-creates the project if it doesn't exist
- Generates a unique 12-character ID using nanoid
- Validates all input data using Zod schemas
- Sanitizes input to prevent security issues
- Returns entry ID and metadata

**Input Schema**:
```json
{
  "projectId": {
    "type": "string",
    "minLength": 1,
    "maxLength": 100,
    "description": "Project ID (max 100 chars)"
  },
  "title": {
    "type": "string", 
    "minLength": 1,
    "maxLength": 100,
    "description": "Entry title (max 100 chars)"
  },
  "content": {
    "type": "string",
    "minLength": 1,
    "maxLength": 10000,
    "description": "Entry content (max 10000 chars)"
  },
  "tags": {
    "type": "array",
    "items": {"type": "string", "maxLength": 50},
    "maxItems": 10,
    "description": "Optional tags (max 10 tags, each max 50 chars)"
  },
  "agentId": {
    "type": "string",
    "maxLength": 100,
    "description": "Optional agent ID (max 100 chars)"
  }
}
```

**Output Schema**:
```json
{
  "id": {"type": "string", "description": "Generated entry ID"},
  "projectId": {"type": "string", "description": "Project ID"},
  "title": {"type": "string", "description": "Entry title"},
  "createdAt": {"type": "string", "description": "Creation timestamp"}
}
```

### `search_logs`
**Purpose**: Discovers relevant log entries by searching within a project.

**What it does**:
- Searches log entries by multiple criteria
- Filters by project ID first (required)
- Applies case-insensitive text search in titles
- Filters by tags using AND logic (must have ALL specified tags)
- Applies date range filtering if provided
- Sorts results by creation date (newest first)
- Returns summary information without full content or summaries

**Input Schema**:
```json
{
  "projectId": {
    "type": "string",
    "minLength": 1,
    "description": "Project ID"
  },
  "query": {
    "type": "string",
    "description": "Optional search query"
  },
  "tags": {
    "type": "array",
    "items": {"type": "string"},
    "description": "Optional tags to filter by"
  },
  "startDate": {
    "type": "string",
    "description": "Optional start date (ISO string)"
  },
  "endDate": {
    "type": "string", 
    "description": "Optional end date (ISO string)"
  },
  "limit": {
    "type": "integer",
    "minimum": 1,
    "maximum": 100,
    "default": 20,
    "description": "Maximum number of results (1-100)"
  }
}
```

**Output Schema**:
```json
{
  "entries": {
    "type": "array",
    "items": {
      "id": {"type": "string"},
      "projectId": {"type": "string"},
      "title": {"type": "string"},
      "createdAt": {"type": "string"},
      "tags": {"type": "array", "items": {"type": "string"}}
    },
    "description": "Matching entries"
  },
  "total": {
    "type": "integer",
    "description": "Total number of matching entries"
  }
}
```

### `get_context`
**Purpose**: Retrieves detailed information about a specific log entry.

**What it does**:
- Fetches a specific entry by project ID and entry ID
- Generates AI summary on first access using OpenAI-compatible API
- Caches summary in database for future retrievals
- Optionally includes full content based on includeFull parameter
- Returns structured entry information with summary

**Input Schema**:
```json
{
  "projectId": {
    "type": "string",
    "minLength": 1,
    "description": "Project ID"
  },
  "id": {
    "type": "string",
    "minLength": 1,
    "description": "Entry ID"
  },
  "includeFull": {
    "type": "boolean",
    "default": false,
    "description": "Include full content in response"
  }
}
```

**Output Schema**:
```json
{
  "id": {"type": "string", "description": "Entry ID"},
  "projectId": {"type": "string", "description": "Project ID"},
  "title": {"type": "string", "description": "Entry title"},
  "summary": {"type": "string", "description": "Entry summary"},
  "createdAt": {"type": "string", "description": "Creation timestamp"},
  "tags": {"type": "array", "items": {"type": "string"}, "description": "Entry tags"},
  "content": {"type": "string", "description": "Full content (only if includeFull=true)"}
}
```

## How Tools Work Together

### Typical Workflow
1. **Discovery**: `search_logs` → Find relevant work
2. **Context**: `get_context` → Understand implementation details  
3. **Implementation**: Complete work based on context
4. **Documentation**: `log_progress` → Record your work

### Data Flow
```
log_progress → stores entry with content
search_logs → finds entries by metadata
get_context → retrieves entry + generates summary
```

## Technical Implementation

### Storage
- **Database**: SQLite via better-sqlite3
- **Location**: Configurable path (default `~/.agent-progress-mcp/data.db`)
- **Schema**: Projects table + Log entries table with foreign keys
- **Indexes**: Optimized for project-based queries and date sorting
- **Encryption**: Optional database encryption via `encryptionPassword`

### Summarization
- **Trigger**: First call to `get_context` for an entry
- **LLM**: OpenAI-compatible API (configurable model)
- **System Prompt**: "You are a technical summariser. Summarise the following agent work log in 2-3 sentences. Focus on: what was done, key files/components changed, and outcome. Be concise and factual. Do not use phrases like "The agent" - write in past tense as if reporting completed work."
- **Caching**: Summary stored in database after generation
- **Fallback**: Truncated content if LLM fails (not cached)
- **Max Tokens**: 150 tokens enforced via API parameter

### Validation & Security
- **Input validation**: Zod schemas for all parameters
- **Sanitization**: PII removal and input cleaning via utils/sanitization.ts
- **SQL safety**: Parameterized queries only
- **Error handling**: Comprehensive error categorization via utils/errors.ts
- **Field limits**: Strict enforcement of maxLength constraints

## Performance Characteristics

### Response Times
- **log_progress**: ~10ms (database write)
- **search_logs**: ~5-50ms depending on result size
- **get_context`: ~100-500ms first time (LLM call), ~5ms cached

### Scalability
- **Entries**: Handles 10,000+ entries per project efficiently
- **Concurrent access**: Multiple agents can read/write simultaneously
- **Database growth**: Linear growth with entry count
- **WAL mode**: Enabled for better concurrent read performance

### Caching Strategy
- **Summaries**: Cached after first generation
- **No cache invalidation**: Content is immutable after creation
- **Database indexes**: Optimized for common query patterns
- **Connection management**: Single connection opened at startup

## Error Handling

### Validation Errors
- Missing required fields (projectId, title, content for log_progress)
- Field length violations (100 chars for title, 10,000 for content)
- Invalid date formats (ISO 8601 required)
- Malformed tag arrays (max 10 items, 50 chars each)

### Runtime Errors
- Database connection failures
- LLM API failures (with fallback to truncated content)
- File system permission issues
- Project not found errors
- Entry not found errors

### Error Response Format
- **Protocol errors**: JSON-RPC error codes (-32602 for invalid params, -32603 for internal errors)
- **Tool errors**: `isError: true` with descriptive message
- **Logging**: All errors logged to stderr with structured context and timestamps

## Configuration

### Environment Variables
- `AGENT_PROGRESS_DB_PATH`: Database file location
- `AGENT_PROGRESS_ENCRYPTION_PASSWORD`: Database encryption password (optional)
- `OPENAI_API_KEY`: LLM API key (required)
- `OPENAI_BASE_URL`: Custom LLM endpoint
- `AGENT_PROGRESS_MODEL`: Summarization model (default: gpt-4o-mini)
- `AGENT_PROGRESS_LOG_LEVEL`: Logging verbosity (debug, info, warn, error)

### Default Settings
- **Database**: `~/.agent-progress-mcp/data.db`
- **Model**: `gpt-4o-mini`
- **Max entries per search**: 20 (max 100)
- **Summary length**: 150 tokens max
- **Logging level**: `info`

## Integration Patterns

### Multi-Agent Coordination
- Agents discover previous work before starting
- Context sharing across different agent types
- Work handoff with full implementation details
- Project-based isolation for different codebases

### Development Workflow Integration
- Pre-commit hooks for logging significant changes
- CI/CD pipeline integration for deployment tracking
- Documentation generation from logged work
- Progress reporting for project management

## Database Schema

### Projects Table
```sql
CREATE TABLE projects (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

### Log Entries Table
```sql
CREATE TABLE log_entries (
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
```

### Indexes
```sql
CREATE INDEX idx_entries_project ON log_entries(project_id);
CREATE INDEX idx_entries_created ON log_entries(created_at DESC);
CREATE INDEX idx_entries_title ON log_entries(title);
```

This system provides persistent memory and context sharing for AI agents working on collaborative software development tasks.