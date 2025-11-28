#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "./tools/index.js";
import { ProgressStore } from "./storage/index.js";
import { Summariser } from "./summariser/index.js";
import { loadConfig } from "./config/index.js";
import { VERSION } from "./version.js";

async function main() {
  const config = loadConfig();
  const store = new ProgressStore(config.dbPath);
  const summariser = new Summariser(config.openai);

  const server = new McpServer({
    name: "agent-progress-mcp",
    version: VERSION,
  });

  registerTools(server, store, summariser);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Agent Progress MCP Server running on stdio");

  // Handle graceful shutdown
  const shutdown = () => {
    console.error("Shutting down...");
    store.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
