import { z } from 'zod';
import type { ProgressStore } from '../storage/index.js';
import { ValidationError, DatabaseError, logError } from '../utils/index.js';

function isValidISO8601Date(dateString: string): boolean {
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return false;
    }
    
    // Check if the string can be parsed as a valid date
    // This accepts various ISO 8601 formats that Date.parse() can handle
    return Date.parse(dateString) === date.getTime();
  } catch {
    return false;
  }
}

const SearchLogsInputSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  query: z.string().optional(),
  tags: z.array(z.string()).optional(),
  startDate: z.string().optional().refine((date) => !date || isValidISO8601Date(date), {
    message: 'Invalid date format. Expected ISO 8601 format (e.g., 2025-01-15T10:30:00Z)',
  }),
  endDate: z.string().optional().refine((date) => !date || isValidISO8601Date(date), {
    message: 'Invalid date format. Expected ISO 8601 format (e.g., 2025-01-15T10:30:00Z)',
  }),
  limit: z.number().int().min(1).max(100).default(20),
});

export function createSearchLogsTool(store: ProgressStore) {
  return {
    handler: async (args: Record<string, unknown>) => {
      try {
        // Validate input
        const validated = SearchLogsInputSchema.parse(args);
        
        try {
          // Check if project exists
          if (!store.projectExists(validated.projectId)) {
            return {
              isError: true,
              content: [{ type: 'text' as const, text: `Project not found: ${validated.projectId}` }],
            };
          }

          // Search entries
          const result = store.searchEntries({
            projectId: validated.projectId,
            query: validated.query,
            tags: validated.tags,
            startDate: validated.startDate,
            endDate: validated.endDate,
            limit: validated.limit,
          });
          
          // Format text content for display
          const textContent = result.total > 0 
            ? `Found ${result.total} entr${result.total === 1 ? 'y' : 'ies'} matching${validated.query ? ` '${validated.query}'` : ''} in ${validated.projectId}:\n` +
              result.entries.map((entry, index) => 
                `${index + 1}. ${entry.id} - ${entry.title} (${new Date(entry.createdAt).toISOString().split('T')[0]})`
              ).join('\n')
            : `No entries found${validated.query ? ` matching '${validated.query}'` : ''} in ${validated.projectId}`;
          
          return {
            content: [{ type: 'text' as const, text: textContent }],
            structuredContent: {
              entries: result.entries,
              total: result.total,
            },
          };
        } catch (err) {
          // DatabaseError or unexpected error during storage operations
          if (err instanceof DatabaseError) {
            logError(err, 'database', { 
              tool: 'search-logs',
              projectId: validated.projectId,
            });
            return {
              isError: true,
              content: [{ type: 'text' as const, text: `Failed to search logs: ${err.message}` }],
            };
          }
          throw err;
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Validation error
          const firstError = error.errors[0];
          const fieldName = firstError.path.join('.');
          const message = firstError.message;
          
          logError(
            new ValidationError(`${fieldName} ${message}`),
            'validation',
            { tool: 'search-logs' }
          );
          
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `${fieldName} ${message}` }],
          };
        }
        
        // Unexpected error
        const err = error instanceof Error ? error : new Error(String(error));
        logError(err, 'system', { tool: 'search-logs' });
        
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Unexpected error: ${err.message}` }],
        };
      }
    },
  };
}
