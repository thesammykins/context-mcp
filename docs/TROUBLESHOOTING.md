# Troubleshooting Guide

This guide covers common issues and solutions for Agent Progress MCP Server.

## Server Startup Issues

### Server fails to start

**Symptoms:**
- Server exits immediately
- Error messages on stderr
- MCP host reports server not responding

**Common Causes:**

1. **Missing OPENAI_API_KEY**
   ```bash
   export OPENAI_API_KEY=your-api-key-here
   ```

2. **Invalid Node.js version**
   ```bash
   node --version  # Should be >= 18.0.0
   ```

3. **Database permission issues**
   ```bash
   # Check database directory permissions
   ls -la ~/.agent-progress-mcp/
   
   # Create directory with proper permissions
   mkdir -p ~/.agent-progress-mcp/
   chmod 700 ~/.agent-progress-mcp/
   ```

4. **Corrupted database file**
   ```bash
   # Backup and reset database
   mv ~/.agent-progress-mcp/data.db ~/.agent-progress-mcp/data.db.backup
   # Server will create new database on next start
   ```

## Configuration Issues

### Environment variables not working

**Symptoms:**
- Default values being used instead of configured values
- Configuration file being ignored

**Solutions:**

1. **Verify environment variables are set**
   ```bash
   env | grep AGENT_PROGRESS
   env | grep OPENAI
   ```

2. **Check configuration file syntax**
   ```bash
   # Validate JSON syntax
   cat agent-progress.config.json | jq .
   ```

3. **Configuration loading order**
   - Default values → Config file → Environment variables
   - Environment variables override config file settings

### API key authentication failures

**Symptoms:**
- 401 Unauthorized errors
- Summarisation not working
- Error messages about invalid API keys

**Solutions:**

1. **Verify API key is valid**
   ```bash
   # Test with curl (OpenAI example)
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
        https://api.openai.com/v1/models
   ```

2. **Check API endpoint URL**
   ```bash
   # Verify custom base URL is accessible
   curl -H "Authorization: Bearer $OPENAI_API_KEY" \
        $OPENAI_BASE_URL/models
   ```

3. **Check API credits/usage**
   - Log into your API provider dashboard
   - Verify account has available credits
   - Check for any account restrictions

## Database Issues

### Database locked errors

**Symptoms:**
- "database is locked" errors
- Multiple server instances failing
- Test failures with database access

**Solutions:**

1. **Kill existing server processes**
   ```bash
   # Find and kill agent-progress-mcp processes
   pkill -f agent-progress-mcp
   
   # Or find specific process
   ps aux | grep agent-progress-mcp
   kill <PID>
   ```

2. **Check for database file locks**
   ```bash
   # On macOS/Linux
   lsof ~/.agent-progress-mcp/data.db
   
   # Remove lock files if server crashed
   rm -f ~/.agent-progress-mcp/data.db-wal
   rm -f ~/.agent-progress-mcp/data.db-shm
   ```

3. **Use WAL mode for better concurrency**
   - Server automatically enables WAL mode
   - Ensure file system supports it

### Database corruption

**Symptoms:**
- "malformed database schema" errors
- Data appearing missing or corrupted
- Queries failing unexpectedly

**Solutions:**

1. **Check database integrity**
   ```bash
   sqlite3 ~/.agent-progress-mcp/data.db "PRAGMA integrity_check;"
   ```

2. **Recover from backup**
   ```bash
   # If you have backups
   cp ~/.agent-progress-mcp/data.db.backup ~/.agent-progress-mcp/data.db
   ```

3. **Reset database (last resort)**
   ```bash
   # This will lose all data!
   rm ~/.agent-progress-mcp/data.db
   # Server will create fresh database
   ```

## Performance Issues

### Slow response times

**Symptoms:**
- Tools taking seconds to respond
- Search queries being slow
- High CPU usage

**Solutions:**

1. **Optimize search queries**
   ```bash
   # Use specific date ranges
   search_logs(projectId="my-project", startDate="2025-11-01T00:00:00Z")
   
   # Use tags for filtering
   search_logs(projectId="my-project", tags=["api"])
   ```

2. **Check database size**
   ```bash
   # Check database file size
   ls -lh ~/.agent-progress-mcp/data.db
   
   # Count entries
   sqlite3 ~/.agent-progress-mcp/data.db "SELECT COUNT(*) FROM log_entries;"
   ```

3. **Enable debug logging**
   ```bash
   export AGENT_PROGRESS_LOG_LEVEL=debug
   agent-progress-mcp
   ```

### Memory usage growing

**Symptoms:**
- Process memory increasing over time
- System becoming slow
- Out of memory errors

**Solutions:**

1. **Monitor memory usage**
   ```bash
   # Watch process memory
   ps aux | grep agent-progress-mcp
   
   # Or use top/htop
   top -p $(pgrep agent-progress-mcp)
   ```

2. **Check for memory leaks**
   - Restart server periodically
   - Monitor with debug logging
   - Report issue if memory grows continuously

## MCP Host Integration Issues

### Claude Desktop not detecting server

**Symptoms:**
- Server not appearing in Claude Desktop
- Tools not available
- Connection timeouts

**Solutions:**

1. **Check configuration file syntax**
   ```bash
   # Validate JSON syntax
   cat ~/Library/Application\ Support/Claude/claude_desktop_config.json | jq .
   ```

2. **Verify command path**
   ```bash
   # Check if command is available
   which agent-progress-mcp
   
   # Test command directly
   agent-progress-mcp --help 2>/dev/null || echo "Command failed"
   ```

3. **Check Claude Desktop logs**
   ```bash
   # macOS logs
   log show --predicate 'process == "Claude"' --last 1h
   
   # Or check Console.app for Claude Desktop
   ```

### Cursor integration problems

**Symptoms:**
- Server not connecting in Cursor
- Tools not showing up
- Configuration errors

**Solutions:**

1. **Verify Cursor settings format**
   ```json
   {
     "mcpServers": [
       {
         "name": "agent-progress",
         "command": "agent-progress-mcp",
         "args": [],
         "env": { "OPENAI_API_KEY": "your-key" }
       }
     ]
   }
   ```

2. **Check Cursor logs**
   - Open Cursor developer tools
   - Look for MCP connection errors
   - Check console for error messages

## Network Issues

### API connectivity problems

**Symptoms:**
- Timeout errors
- Connection refused
- DNS resolution failures

**Solutions:**

1. **Test network connectivity**
   ```bash
   # Test basic connectivity
   curl -I https://api.openai.com/v1/models
   
   # Test with custom endpoint
   curl -I $OPENAI_BASE_URL/models
   ```

2. **Check firewall/proxy settings**
   ```bash
   # Check if ports are blocked
   telnet api.openai.com 443
   
   # Check proxy settings
   echo $HTTP_PROXY
   echo $HTTPS_PROXY
   ```

3. **DNS resolution**
   ```bash
   # Check DNS resolution
   nslookup api.openai.com
   dig api.openai.com
   ```

## Debugging Techniques

### Enable debug logging

```bash
export AGENT_PROGRESS_LOG_LEVEL=debug
agent-progress-mcp
```

Debug logging provides:
- Detailed error messages
- Database query information
- API call details
- Configuration values

### Test with in-memory database

For testing and debugging:

```bash
export AGENT_PROGRESS_DB_PATH=:memory:
agent-progress-mcp
```

This uses a temporary in-memory database that's discarded when the server stops.

### Manual tool testing

Test tools directly without MCP host:

```bash
# Create test script
cat > test.mcp.json << 'EOF'
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_logs",
    "arguments": {
      "projectId": "test-project",
      "limit": 5
    }
  }
}
EOF

# Test server
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{"tools":{}},"clientInfo":{"name":"test","version":"1.0.0"}}}' | agent-progress-mcp
cat test.mcp.json | agent-progress-mcp
```

## Getting Help

### Collect diagnostic information

When reporting issues, include:

1. **System information**
   ```bash
   node --version
   npm --version
   uname -a
   ```

2. **Configuration**
   ```bash
   env | grep -E "(AGENT_PROGRESS|OPENAI)"
   cat agent-progress.config.json 2>/dev/null || echo "No config file"
   ```

3. **Database information**
   ```bash
   ls -la ~/.agent-progress-mcp/
   sqlite3 ~/.agent-progress-mcp/data.db "SELECT COUNT(*) FROM log_entries;" 2>/dev/null || echo "Database inaccessible"
   ```

4. **Error logs**
   ```bash
   # Run with debug logging and capture output
   AGENT_PROGRESS_LOG_LEVEL=debug agent-progress-mcp 2>&1 | tee debug.log
   ```

### Report issues

- **GitHub Issues**: [Report bugs or request features](https://github.com/thesammykins/context-mcp/issues)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/thesammykins/context-mcp/discussions)
- **Documentation**: Check [Configuration Guide](./CONFIGURATION.md) and [Development Guide](./DEVELOPMENT.md)

### Common workarounds

1. **Server won't start**: Reset database
   ```bash
   rm ~/.agent-progress-mcp/data.db
   ```

2. **API errors**: Try different model or endpoint
   ```bash
   export AGENT_PROGRESS_MODEL=gpt-3.5-turbo
   ```

3. **Performance issues**: Use date ranges in searches
   ```bash
   search_logs(projectId="project", startDate="2025-11-01T00:00:00Z")
   ```

This troubleshooting guide should help resolve most common issues with Agent Progress MCP Server.