# Agent Progress Tools - Technical Overview

This document explains what each agent progress tool does and how they work together.

## Tool Descriptions

### `agent-progress_log_progress`
**Purpose**: Records completed work with structured metadata for future reference.

**What it does**:
- Creates a new log entry in the database
- Auto-creates the project if it doesn't exist
- Generates a unique 12-character ID for the entry
- Validates and sanitizes all input data
- Returns the entry ID and metadata

**Input Parameters**:
- `projectId` (required): Project identifier, max 100 chars
- `title` (required): Short descriptive title, max 100 chars  
- `content` (required): Detailed work description, max 10,000 chars
- `tags` (optional): Array of categorization tags, max 10 items
- `agentId` (optional): Identifier of the logging agent, max 100 chars

**Output**: Returns entry ID, projectId, title, and creation timestamp.

### `agent-progress_search_logs`
**Purpose**: Discovers relevant log entries by searching within a project.

**What it does**:
- Searches log entries by multiple criteria
- Filters by project ID first (required)
- Applies text search, tag filtering, and date ranges
- Sorts results by creation date (newest first)
- Returns summary information without full content

**Input Parameters**:
- `projectId` (required): Project to search within
- `query` (optional): Case-insensitive text search in titles
- `tags` (optional): Array of tags (AND logic - must have ALL specified tags)
- `startDate` (optional): ISO 8601 date - entries on/after this date
- `endDate` (optional): ISO 8601 date - entries on/before this date
- `limit` (optional): Max results (default 20, max 100)

**Output**: Returns array of entries with ID, title, creation date, and tags, plus total count.

### `agent-progress_get_context`
**Purpose**: Retrieves detailed information about a specific log entry.

**What it does**:
- Fetches a specific entry by project ID and entry ID
- Generates AI summary on first access (if not cached)
- Caches summary for future retrievals
- Optionally includes full content
- Returns structured entry information

**Input Parameters**:
- `projectId` (required): Project containing the entry
- `id` (required): Unique entry ID to retrieve
- `includeFull` (optional): Include full content (default false)

**Output**: Returns entry ID, title, summary, creation date, tags, and optionally full content.

## How Tools Work Together

### Typical Workflow
1. **Discovery**: `agent-progress_search_logs` → Find relevant work
2. **Context**: `agent-progress_get_context` → Understand implementation details  
3. **Implementation**: Complete work based on context
4. **Documentation**: `agent-progress_log_progress` → Record your work

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

### Summarization
- **Trigger**: First call to `get_context` for an entry
- **LLM**: OpenAI-compatible API (configurable model)
- **Caching**: Summary stored in database after generation
- **Fallback**: Truncated content if LLM fails (not cached)

### Validation & Security
- **Input validation**: Zod schemas for all parameters
- **Sanitization**: PII removal and input cleaning
- **SQL safety**: Parameterized queries only
- **Error handling**: Comprehensive error categorization

## Performance Characteristics

### Response Times
- **log_progress**: ~10ms (database write)
- **search_logs**: ~5-50ms depending on result size
- **get_context**: ~100-500ms first time (LLM call), ~5ms cached

### Scalability
- **Entries**: Handles 10,000+ entries per project efficiently
- **Concurrent access**: Multiple agents can read/write simultaneously
- **Database growth**: Linear growth with entry count

### Caching Strategy
- **Summaries**: Cached after first generation
- **No cache invalidation**: Content is immutable after creation
- **Database indexes**: Optimized for common query patterns

## Error Handling

### Validation Errors
- Missing required fields
- Field length violations
- Invalid date formats
- Malformed tag arrays

### Runtime Errors
- Database connection failures
- LLM API failures
- File system permission issues
- Project not found errors

### Error Response Format
- **Protocol errors**: JSON-RPC error codes
- **Tool errors**: `isError: true` with descriptive message
- **Logging**: All errors logged to stderr with context

## Configuration

### Environment Variables
- `AGENT_PROGRESS_DB_PATH`: Database file location
- `OPENAI_API_KEY`: LLM API key (required)
- `OPENAI_BASE_URL`: Custom LLM endpoint
- `AGENT_PROGRESS_MODEL`: Summarization model
- `AGENT_PROGRESS_LOG_LEVEL`: Logging verbosity

### Default Settings
- **Database**: `~/.agent-progress-mcp/data.db`
- **Model**: `gpt-4o-mini`
- **Max entries per search**: 20
- **Summary length**: 150 tokens max

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

This system provides persistent memory and context sharing for AI agents working on collaborative software development tasks.