# Agent Progress Tracker MCP Server

[![npm version](https://img.shields.io/npm/v/@thesammykins/agent-progress-mcp.svg)](https://www.npmjs.com/package/@thesammykins/agent-progress-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/GitHub-thesammykins/context--mcp-blue)](https://github.com/thesammykins/context-mcp)

An MCP (Model Context Protocol) server that enables AI agents to track, search, and retrieve their progress across projects. Provides persistent memory and context sharing for multi-step or multi-agent workflows.

## AGENT.md

### Progress Tracking Workflow
1. **Before starting**: Search existing entries to understand prior work and avoid duplication
2. **After completing**: Log significant outcomes, decisions, and technical details with descriptive tags
3. **When context needed**: Search → Review IDs → Get detailed context for relevant entries

## Features

- **Log Progress** - Record completed work with structured metadata
- **Search Logs** - Discover relevant entries by title, date, keywords, or tags  
- **Get Context** - Retrieve summarized information about prior work by ID
- **Project-scoped** - All entries are organized by project to keep context relevant
- **LLM-powered Summarisation** - Automatic summarisation using OpenAI-compatible APIs
- **SQLite Storage** - Fast, local database with full-text search capabilities
- **Comprehensive Error Handling** - Graceful fallbacks and detailed error reporting

## Installation

### NPM Package Install

```bash
npm install -g @thesammykins/agent-progress-mcp
```

### Development Install

```bash
git clone https://github.com/thesammykins/context-mcp.git
cd agent-progress-mcp
npm install
npm run build
npm link  # Optional: for local development
```

## Configuration

The server requires configuration via environment variables:

### Required

- `OPENAI_API_KEY` - OpenAI API key (or compatible API key for other providers)

### Optional

- `AGENT_PROGRESS_DB_PATH` - Database file path (default: `~/.agent-progress-mcp/data.db`)
- `OPENAI_BASE_URL` - Custom API base URL (default: `https://api.openai.com/v1`)
- `AGENT_PROGRESS_MODEL` - LLM model for summarisation (default: `gpt-4o-mini`)
- `AGENT_PROGRESS_LOG_LEVEL` - Logging level: `debug`, `info`, `warn`, `error` (default: `info`)

### Configuration File (Optional)

Create `agent-progress.config.json` in your working directory:

```json
{
  "dbPath": "~/.agent-progress-mcp/data.db",
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

## MCP Host Integration

### Claude Desktop

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-progress": {
      "command": "agent-progress-mcp",
      "env": {
        "OPENAI_API_KEY": "your-api-key-here",
        "OPENAI_BASE_URL": "https://api.openai.com/v1",
        "AGENT_PROGRESS_MODEL": "gpt-4o-mini"
      }
    }
  }
}
```

**Note**: Only `OPENAI_API_KEY` is required. The other environment variables are optional and will use defaults if not specified.

### Cursor

Add to your Cursor settings:

```json
{
  "mcpServers": [
    {
      "name": "agent-progress",
      "command": "agent-progress-mcp",
      "args": [],
      "env": {
        "OPENAI_API_KEY": "your-api-key-here",
        "OPENAI_BASE_URL": "https://api.openai.com/v1",
        "AGENT_PROGRESS_MODEL": "gpt-4o-mini"
      }
    }
  ]
}
```

**Note**: Only `OPENAI_API_KEY` is required. The other environment variables are optional and will use defaults if not specified.

### MCP CLI

```bash
export OPENAI_API_KEY=your-api-key-here
export OPENAI_BASE_URL=https://api.openai.com/v1
export AGENT_PROGRESS_MODEL=gpt-4o-mini
mcp run agent-progress-mcp
```

**Note**: Only `OPENAI_API_KEY` is required. The other environment variables are optional and will use defaults if not specified.

### Alternative OpenAI-Compatible Providers

The server works with any OpenAI-compatible API. Here are examples for popular providers:

#### Anthropic Claude API
```json
{
  "mcpServers": {
    "agent-progress": {
      "command": "agent-progress-mcp",
      "env": {
        "OPENAI_API_KEY": "your-anthropic-api-key",
        "OPENAI_BASE_URL": "https://api.anthropic.com/v1",
        "AGENT_PROGRESS_MODEL": "claude-3-haiku-20241022"
      }
    }
  }
}
```

#### Azure OpenAI
```json
{
  "mcpServers": {
    "agent-progress": {
      "command": "agent-progress-mcp",
      "env": {
        "OPENAI_API_KEY": "your-azure-api-key",
        "OPENAI_BASE_URL": "https://your-resource.openai.azure.com/openai/deployments/your-deployment",
        "AGENT_PROGRESS_MODEL": "gpt-4"
      }
    }
  }
}
```

#### Local LLM with Ollama
```json
{
  "mcpServers": {
    "agent-progress": {
      "command": "agent-progress-mcp",
      "env": {
        "OPENAI_API_KEY": "not-required",
        "OPENAI_BASE_URL": "http://localhost:11434/v1",
        "AGENT_PROGRESS_MODEL": "llama3.1:8b"
      }
    }
  }
}
```

## Tool Usage

### 1. log_progress

Log a completed action with title and detailed content.

**Parameters:**
- `projectId` (string, required) - Project identifier (max 100 chars)
- `title` (string, required) - Short title describing what was done (max 100 chars)
- `content` (string, required) - Detailed description of the work completed (max 10000 chars)
- `tags` (array, optional) - Tags for categorisation (max 10 tags, each max 50 chars)
- `agentId` (string, optional) - Agent identifier (max 100 chars)

**Example:**
```json
{
  "name": "log_progress",
  "arguments": {
    "projectId": "mobile-app",
    "title": "Implemented user registration endpoint",
    "content": "Created POST /api/users endpoint with validation. Added bcrypt for password hashing. Wrote integration tests.",
    "tags": ["api", "users", "backend"],
    "agentId": "agent-001"
  }
}
```

**Response:**
```json
{
  "content": [{"type": "text", "text": "Logged: Implemented user registration endpoint (ID: x7k9m2p4q1w3) in project mobile-app"}],
  "structuredContent": {
    "id": "x7k9m2p4q1w3",
    "projectId": "mobile-app", 
    "title": "Implemented user registration endpoint",
    "createdAt": "2025-06-15T14:32:00Z"
  }
}
```

### 2. search_logs

Search for log entries within a project.

**Parameters:**
- `projectId` (string, required) - Project identifier
- `query` (string, optional) - Search query to match in titles
- `tags` (array, optional) - Tags to filter by
- `startDate` (string, optional) - Start date (ISO 8601)
- `endDate` (string, optional) - End date (ISO 8601)
- `limit` (number, optional) - Maximum results (1-100, default: 20)

**Example:**
```json
{
  "name": "search_logs",
  "arguments": {
    "projectId": "mobile-app",
    "query": "registration",
    "limit": 10
  }
}
```

**Response:**
```json
{
  "content": [{"type": "text", "text": "Found 1 entry matching 'registration' in mobile-app:\n1. x7k9m2p4q1w3 - Implemented user registration endpoint (2025-06-15)"}],
  "structuredContent": {
    "entries": [{
      "id": "x7k9m2p4q1w3",
      "projectId": "mobile-app",
      "title": "Implemented user registration endpoint", 
      "createdAt": "2025-06-15T14:32:00Z",
      "tags": ["api", "users", "backend"]
    }],
    "total": 1
  }
}
```

### 3. get_context

Retrieve context and summary for a specific progress entry.

**Parameters:**
- `projectId` (string, required) - Project identifier
- `id` (string, required) - Entry ID
- `includeFull` (boolean, optional) - Include full content in response (default: false)

**Example:**
```json
{
  "name": "get_context",
  "arguments": {
    "projectId": "mobile-app",
    "id": "x7k9m2p4q1w3"
  }
}
```

**Response:**
```json
{
  "content": [{"type": "text", "text": "Created POST /api/users endpoint with validation and password hashing using bcrypt. Includes comprehensive integration tests."}],
  "structuredContent": {
    "id": "x7k9m2p4q1w3",
    "projectId": "mobile-app",
    "title": "Implemented user registration endpoint",
    "summary": "Created POST /api/users endpoint with validation and password hashing using bcrypt. Includes comprehensive integration tests.",
    "createdAt": "2025-06-15T14:32:00Z",
    "tags": ["api", "users", "backend"]
  }
}
```

## Development

### Building

```bash
npm run build
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test -- --coverage
```

### Linting

```bash
npm run lint
```

### Local Development

```bash
# Start in development mode with file watching
npm run dev

# Start the built server
npm start
```

## Database Schema

The server uses SQLite with the following schema:

```sql
CREATE TABLE projects (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE log_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL,
  tags TEXT,
  agent_id TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(project_id)
);

-- Indexes for performance
CREATE INDEX idx_entries_project ON log_entries(project_id);
CREATE INDEX idx_entries_created ON log_entries(created_at DESC);
CREATE INDEX idx_entries_title ON log_entries(title);
```

## Error Handling

The server provides comprehensive error handling with the following error categories:

- **Validation Errors** - Invalid input parameters
- **Database Errors** - Storage operation failures  
- **LLM Errors** - Summarisation service failures (with fallback)
- **System Errors** - Unexpected server errors

All errors are logged to stderr with timestamps and context information.

## Security

- API keys are loaded from environment variables only
- Database is stored locally with file permissions
- Input validation on all parameters
- No external network access except configured LLM API
- SQL injection protection via parameterized queries

## License

MIT License - See [LICENSE](LICENSE) file for details. This project is open source and available under the MIT License.

## Contributing

We welcome contributions! Please feel free to submit a Pull Request. For major changes:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes using [Conventional Commits](#commit-format)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Commit Format

This project uses [Conventional Commits](https://www.conventionalcommits.org/) for automated releases:

```
<type>: <description>

[optional body]

[optional footer]
```

**Types that trigger releases:**
- `fix:` - Bug fix → **patch** release (1.0.0 → 1.0.1)
- `feat:` - New feature → **minor** release (1.0.0 → 1.1.0)
- `feat!:` or `BREAKING CHANGE:` - Breaking change → **major** release (1.0.0 → 2.0.0)

**Types that don't trigger releases:**
- `docs:` - Documentation only
- `chore:` - Maintenance tasks
- `test:` - Adding/updating tests
- `refactor:` - Code changes that don't fix bugs or add features
- `style:` - Formatting, whitespace, etc.
- `ci:` - CI/CD changes

**Examples:**
```bash
git commit -m "fix: resolve database connection timeout"
git commit -m "feat: add bulk import capability"
git commit -m "feat!: change API response format"
git commit -m "docs: update installation instructions"
```

### Release Process

Releases are automated via [release-please](https://github.com/googleapis/release-please):

1. Push commits to `main` using conventional commit format
2. release-please creates/updates a "Release PR" with changelog
3. Review and merge the Release PR when ready
4. GitHub Release is created automatically
5. npm publish triggers on the release

For questions or suggestions, please [open an issue](https://github.com/thesammykins/context-mcp/issues).

## Support

Have questions or need help? Here are some resources:

- **[GitHub Issues](https://github.com/thesammykins/context-mcp/issues)** - Report bugs or request features
- **[GitHub Discussions](https://github.com/thesammykins/context-mcp/discussions)** - Ask questions and share ideas
- **[Project Repository](https://github.com/thesammykins/context-mcp)** - Source code and documentation