import { z } from 'zod';
import { createLogProgressTool } from './log-progress.js';
import { createGetContextTool } from './get-context.js';
import { createSearchLogsTool } from './search-logs.js';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ProgressStore } from '../storage/index.js';
import type { Summariser } from '../summariser/index.js';

export { createLogProgressTool } from './log-progress.js';
export { createGetContextTool } from './get-context.js';
export { createSearchLogsTool } from './search-logs.js';

export function registerTools(
  server: McpServer,
  store: ProgressStore,
  summariser: Summariser
): void {
  // Register log_progress tool
  server.registerTool(
    'log_progress',
    {
      title: 'Log Progress',
      description: 'Log completed work with title, content, and optional tags. Use after finishing significant tasks, decisions, or milestones. Returns entry ID for future reference.',
      inputSchema: z.object({
        projectId: z.string().min(1).max(100).describe('Project ID (max 100 chars)'),
        title: z.string().min(1).max(100).describe('Entry title (max 100 chars)'),
        content: z.string().min(1).max(10000).describe('Entry content (max 10000 chars)'),
        tags: z.array(z.string().max(50)).max(10).optional().describe('Optional tags (max 10 tags, each max 50 chars)'),
        agentId: z.string().max(100).optional().describe('Optional agent ID (max 100 chars)')
      }),
      outputSchema: z.object({
        id: z.string().describe('Generated entry ID'),
        projectId: z.string().describe('Project ID'),
        title: z.string().describe('Entry title'),
        createdAt: z.string().describe('Creation timestamp')
      })
    },
    createLogProgressTool(store).handler
  );

  // Register get_context tool
  server.registerTool(
    'get_context',
    {
      title: 'Get Context',
      description: 'Retrieve detailed context and AI-generated summary for a specific entry. Use search_logs first to find relevant IDs, then get full context with this tool.',
      inputSchema: z.object({
        projectId: z.string().min(1).describe('Project ID'),
        id: z.string().min(1).describe('Entry ID'),
        includeFull: z.boolean().default(false).describe('Include full content in response')
      }),
      outputSchema: z.object({
        id: z.string().describe('Entry ID'),
        projectId: z.string().describe('Project ID'),
        title: z.string().describe('Entry title'),
        summary: z.string().describe('Entry summary'),
        createdAt: z.string().describe('Creation timestamp'),
        tags: z.array(z.string()).describe('Entry tags'),
        content: z.string().optional().describe('Full content (only if includeFull=true)')
      })
    },
    createGetContextTool(store, summariser).handler
  );

  // Register search_logs tool
  server.registerTool(
    'search_logs',
    {
      title: 'Search Logs',
      description: 'Find relevant progress entries by query, tags, or date range. Use to discover prior work before starting new tasks or when context is needed.',
      inputSchema: z.object({
        projectId: z.string().min(1).describe('Project ID'),
        query: z.string().optional().describe('Optional search query'),
        tags: z.array(z.string()).optional().describe('Optional tags to filter by'),
        startDate: z.string().optional().describe('Optional start date (ISO string)'),
        endDate: z.string().optional().describe('Optional end date (ISO string)'),
        limit: z.number().int().min(1).max(100).default(20).describe('Maximum number of results (1-100)')
      }),
      outputSchema: z.object({
        entries: z.array(z.object({
          id: z.string(),
          projectId: z.string(),
          title: z.string(),
          createdAt: z.string(),
          tags: z.array(z.string())
        })).describe('Matching entries'),
        total: z.number().describe('Total number of matching entries')
      })
    },
    createSearchLogsTool(store).handler
  );
}
