# Agent Progress Tracker MCP Server

[![npm version](https://img.shields.io/npm/v/@thesammykins/agent-progress-mcp.svg)](https://www.npmjs.com/package/@thesammykins/agent-progress-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/GitHub-thesammykins/context--mcp-blue)](https://github.com/thesammykins/context-mcp)
[![Package Size](https://img.shields.io/bundlephobia/minzip/@thesammykins/agent-progress-mcp)](https://bundlephobia.com/package/@thesammykins/agent-progress-mcp)

An MCP (Model Context Protocol) server that enables AI agents to track, search, and retrieve their progress across projects. Provides persistent memory and context sharing for multi-step or multi-agent workflows.

## Features

- **Log Progress** - Record completed work with structured metadata
- **Search Logs** - Discover relevant entries by title, date, keywords, or tags  
- **Get Context** - Retrieve summarized information about prior work by ID
- **Project-scoped** - All entries organized by project to keep context relevant
- **LLM-powered Summarisation** - Automatic summarisation using OpenAI-compatible APIs
- **SQLite Storage** - Fast, local database with full-text search capabilities
- **Comprehensive Error Handling** - Graceful fallbacks and detailed error reporting

## Quick Start

### 1. Install

```bash
npm install -g @thesammykins/agent-progress-mcp
```

### 2. Configure API Key

```bash
export OPENAI_API_KEY=your-api-key-here
```

### 3. Add to Claude Desktop

Add to your Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "agent-progress": {
      "command": "agent-progress-mcp",
      "env": {
        "OPENAI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### 4. Start Tracking Progress

- Log completed work: `log_progress`
- Search previous work: `search_logs`  
- Get context: `get_context`

## Documentation

- **[Configuration Guide](./docs/CONFIGURATION.md)** - Environment variables, MCP host setup, alternative providers
- **[Development Guide](./docs/DEVELOPMENT.md)** - Contributing, testing, building from source
- **[Tools Overview](./docs/TOOLS.md)** - Technical details about each tool
- **[How-To Guide](./docs/HOWTO.md)** - Practical usage patterns and workflows
- **[Troubleshooting](./docs/TROUBLESHOOTING.md)** - Common issues and solutions
- **[Technical Specification](./docs/SPEC.md)** - Complete technical specification

## Usage Example

```bash
# Log completed work
log_progress(
  projectId="web-app",
  title="Implemented JWT authentication",
  content="Created JWT token generation/validation utilities, added auth middleware, implemented login/register endpoints with bcrypt password hashing. All tests passing.",
  tags=["authentication", "security", "api"]
)

# Search for related work
search_logs(projectId="web-app", query="authentication")

# Get detailed context
get_context(projectId="web-app", id="found-entry-id", includeFull=true)
```

## Installation Options

### Development Install

```bash
git clone https://github.com/thesammykins/context-mcp.git
cd context-mcp
npm install
npm run build
npm link  # Optional: for local development
```

## MCP Host Integration

The server works with any MCP-compatible host:

- **Claude Desktop** - Native integration
- **Cursor** - Add to MCP servers configuration
- **MCP CLI** - Command-line usage
- **Custom hosts** - STDIO transport protocol
- **OpenCode** - Add to opencode.jsonc configuration

### OpenCode Configuration

Add to your `opencode.jsonc`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "agent-progress": {
      "type": "local",
      "command": ["npx", "-y", "@thesammykins/agent-progress-mcp"],
      "environment": {
        "OPENAI_API_KEY": "{env:OPENAI_API_KEY}"
      }
    }
  }
}
```

Use `use the agent-progress tool` in your prompts to enable progress tracking.

## Database & Privacy

- **Local Storage**: All data stored locally on your machine
- **SQLite Database**: Fast, reliable, file-based storage
- **Optional Encryption**: Password-protect your progress data
- **No Telemetry**: Your work context never leaves your environment (except for optional LLM summarisation)

## License

MIT License - See [LICENSE](LICENSE) file for details.

## Contributing

We welcome contributions! Please see the [Development Guide](./docs/DEVELOPMENT.md) for details on contributing, testing, and building from source.

## Support

- **[GitHub Issues](https://github.com/thesammykins/context-mcp/issues)** - Report bugs or request features
- **[GitHub Discussions](https://github.com/thesammykins/context-mcp/discussions)** - Ask questions and share ideas
- **[Documentation](./docs/)** - Complete documentation and guides