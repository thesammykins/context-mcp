# Agent Progress Tools - HOWTO Guide

This guide explains how to effectively use the agent progress tools for tracking work across multi-agent workflows.

## Quick Overview

The agent progress system provides three tools for maintaining shared context across agents:

1. **`log_progress`** - Record completed work
2. **`search_logs`** - Discover previous work  
3. **`get_context`** - Get detailed context of specific work

## When to Use Each Tool

### 📝 `log_progress`
**Use when:** You've completed a meaningful piece of work that other agents should know about.

**Perfect for:**
- ✅ Implementing major features or components
- ✅ Completing refactoring tasks
- ✅ Setting up project infrastructure
- ✅ Fixing critical bugs
- ✅ Adding comprehensive tests
- ✅ Creating documentation

**Don't use for:**
- ❌ Minor code tweaks or style changes
- ❌ Temporary debugging code
- ❌ Work that will be immediately undone
- ❌ Personal notes or reminders

**Best Practices:**
```bash
# Good example - specific and informative
log_progress(
  projectId="web-app",
  title="Implemented JWT authentication system",
  content="Created JWT token generation/validation utilities, added auth middleware, implemented login/register endpoints with bcrypt password hashing. All tests passing.",
  tags=["authentication", "security", "api"],
  agentId="backend-agent"
)

# Bad example - too vague
log_progress(
  projectId="web-app", 
  title="Did some auth stuff",
  content="Fixed auth"
)
```

### 🔍 `search_logs`
**Use when:** You need to understand what work has been done before starting new work.

**Perfect for:**
- ✅ Starting work on a new project
- ✅ Looking for similar implementations
- ✅ Understanding project history
- ✅ Finding who worked on specific features
- ✅ Discovering related work before making changes

**Search Strategies:**
```bash
# Search by keyword (case-insensitive)
search_logs(projectId="web-app", query="auth")

# Filter by tags (AND logic - must have ALL tags)
search_logs(projectId="web-app", tags=["security", "api"])

# Date range filtering
search_logs(
  projectId="web-app", 
  startDate="2025-11-01T00:00:00Z",
  endDate="2025-11-30T23:59:59Z"
)

# Combined search
search_logs(
  projectId="web-app",
  query="database",
  tags=["migration"],
  limit=10
)
```

### 📖 `get_context`
**Use when:** You've found an interesting entry from search and need full details.

**Perfect for:**
- ✅ Understanding how previous work was implemented
- ✅ Learning about architectural decisions
- ✅ Finding specific files or code locations
- ✅ Understanding testing approaches used
- ✅ Getting context before continuing someone's work

**Usage Patterns:**
```bash
# Get summary (quick overview)
get_context(
  projectId="web-app",
  id="abc123def456",
  includeFull=false
)

# Get full details (when you need to understand implementation)
get_context(
  projectId="web-app", 
  id="abc123def456",
  includeFull=true
)
```

## Typical Multi-Agent Workflow

### Agent A (Starting Work)
```bash
# 1. Check what's been done
search_logs(projectId="mobile-app", query="navigation")

# 2. Get context on relevant work
get_context(projectId="mobile-app", id="found-id", includeFull=true)

# 3. Log your completed work
log_progress(
  projectId="mobile-app",
  title="Added bottom navigation with 3 tabs",
  content="Implemented Flutter bottom navigation bar with Home, Profile, Settings tabs. Used Material Design, added route handling, updated theme.",
  tags=["flutter", "navigation", "ui"],
  agentId="ui-agent"
)
```

### Agent B (Continuing Work)
```bash
# 1. Discover recent work
search_logs(projectId="mobile-app")

# 2. Understand what Agent A did
get_context(projectId="mobile-app", id="agent-a-entry-id", includeFull=true)

# 3. Build upon their work and log your contribution
log_progress(
  projectId="mobile-app",
  title="Implemented navigation routing logic",
  content="Extended Agent A's navigation setup by adding route definitions, navigation state management, and deep linking support. Integrated with existing bottom navigation.",
  tags=["flutter", "navigation", "routing"],
  agentId="logic-agent"
)
```

## Project Management Best Practices

### Project ID Conventions
- Use repository names: `web-app`, `mobile-app`, `api-service`
- Be consistent: always use the same projectId for the same codebase
- Avoid spaces: use hyphens or underscores instead

### Tag Strategy
- **Technology tags**: `react`, `flutter`, `nodejs`, `typescript`
- **Feature tags**: `authentication`, `navigation`, `database`, `api`
- **Type tags**: `frontend`, `backend`, `testing`, `documentation`
- **Keep tags simple**: 1-3 words max, consistent naming

### Content Guidelines
- **Be specific**: Mention exact files, libraries, and approaches used
- **Include outcomes**: "All tests passing", "Performance improved by 50%", etc.
- **Reference dependencies**: "Built on Agent X's authentication system"
- **Keep it focused**: One major accomplishment per entry

## Advanced Usage

### Finding Related Work
```bash
# Find all authentication-related work
search_logs(projectId="web-app", query="auth")

# Find all database work
search_logs(projectId="web-app", tags=["database"])

# Find recent work by specific agent
search_logs(projectId="web-app", limit=20)
# Then filter results by agentId in the structured content
```

### Understanding Project Evolution
```bash
# Get chronological view
search_logs(projectId="web-app", limit=50)

# Get specific time period
search_logs(
  projectId="web-app",
  startDate="2025-11-01T00:00:00Z",
  endDate="2025-11-30T23:59:59Z"
)
```

### Debugging and Troubleshooting
```bash
# Find who worked on a specific feature
search_logs(projectId="web-app", query="payment")

# Get full implementation details
get_context(projectId="web-app", id="payment-entry-id", includeFull=true)
```

## Common Pitfalls to Avoid

1. **Vague entries**: "Fixed bugs" → "Fixed authentication token expiration bug"
2. **Missing context**: "Updated API" → "Updated user API to include new profile fields"
3. **Inconsistent projectIds**: Using `webapp` vs `web-app` inconsistently
4. **Over-tagging**: Adding every possible tag vs 3-4 relevant ones
5. **Not searching**: Starting work without checking what's already been done

## Integration with Development Workflow

### Before Starting Work
1. Search for related work in the project
2. Get context on relevant entries
3. Plan your approach based on existing work

### After Completing Work  
1. Log your accomplishment with specific details
2. Include relevant tags for discoverability
3. Reference related work when applicable

### When Handing Off Work
1. Ensure your work is properly logged
2. Search shows comprehensive history
3. Next agent can understand your decisions

This system works best when everyone consistently logs meaningful work and searches before starting new work.