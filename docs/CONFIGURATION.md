# Configuration Guide

This guide covers all configuration options for the Agent Progress MCP Server.

## Environment Variables

### Required

- `OPENAI_API_KEY` - OpenAI API key (or compatible API key for other providers)

### Optional

- `AGENT_PROGRESS_DB_PATH` - Database file path (default: `~/.agent-progress-mcp/data.db`)
- `AGENT_PROGRESS_ENCRYPTION_PASSWORD` - Password for database encryption (optional)
- `OPENAI_BASE_URL` - Custom API base URL (default: `https://api.openai.com/v1`)
- `AGENT_PROGRESS_MODEL` - LLM model for summarisation (default: `gpt-4o-mini`)
- `AGENT_PROGRESS_LOG_LEVEL` - Logging level: `debug`, `info`, `warn`, `error` (default: `info`)

## Configuration File

You can optionally create `agent-progress.config.json` in your working directory:

```json
{
  "dbPath": "~/.agent-progress-mcp/data.db",
  "encryptionPassword": "${AGENT_PROGRESS_ENCRYPTION_PASSWORD}",
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

### Configuration Loading Order

1. Default values
2. Config file (if exists)
3. Environment variables (override)

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

### MCP CLI

```bash
export OPENAI_API_KEY=your-api-key-here
export OPENAI_BASE_URL=https://api.openai.com/v1
export AGENT_PROGRESS_MODEL=gpt-4o-mini
mcp run agent-progress-mcp
```

## Alternative OpenAI-Compatible Providers

### Anthropic Claude API

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

### Azure OpenAI

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

### Local LLM with Ollama

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

## Database Configuration

### Default Database Location

- **Path**: `~/.agent-progress-mcp/data.db`
- **Customizable**: Set `AGENT_PROGRESS_DB_PATH` environment variable
- **Format**: SQLite database file with full-text search capabilities

### Database Encryption

If you set `AGENT_PROGRESS_ENCRYPTION_PASSWORD`, the database will be encrypted at rest. This provides an additional layer of security for sensitive progress data.

**Important**: If you enable encryption, you must always provide the same password when starting the server, or you will lose access to your data.

## Logging Configuration

### Log Levels

- `debug` - Detailed debugging information
- `info` - General information (default)
- `warn` - Warning messages
- `error` - Error messages only

### Setting Log Level

```bash
export AGENT_PROGRESS_LOG_LEVEL=debug
agent-progress-mcp
```

### Log Output

All logs are written to stderr with timestamps and structured information. This makes it easy to integrate with existing logging systems.

## Security Considerations

### API Key Protection

- API keys are loaded from environment variables only
- Keys are never logged or included in error messages
- Keys are not stored in the database

### File Permissions

- Database directory created with restrictive permissions (0700)
- Database file created with 0600 permissions
- Configuration file should have appropriate access restrictions

### Network Access

- No external network access except for configured LLM API calls
- STDIO transport only - no HTTP server exposed
- All SQL queries use parameterized statements to prevent injection