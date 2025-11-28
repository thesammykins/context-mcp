import { z } from 'zod';
import type { ProgressStore } from '../storage/index.js';
import type { Summariser } from '../summariser/index.js';
import { ValidationError, NotFoundError, DatabaseError, logError } from '../utils/index.js';

const GetContextInputSchema = z.object({
  projectId: z.string().min(1, 'projectId is required'),
  id: z.string().min(1, 'id is required'),
  includeFull: z.boolean().default(false),
});

export function createGetContextTool(store: ProgressStore, summariser: Summariser) {
  return {
    handler: async (args: Record<string, unknown>) => {
      try {
        // Validate input
        const validated = GetContextInputSchema.parse(args);
        
        try {
          // Fetch entry from storage
          const entry = store.getEntry(validated.projectId, validated.id);
          
          if (!entry) {
            logError(
              new NotFoundError(`Entry with ID '${validated.id}' not found in project '${validated.projectId}'`),
              'not_found',
              { projectId: validated.projectId, entryId: validated.id }
            );
            return {
              isError: true,
              content: [{ type: 'text' as const, text: `Entry not found: ${validated.id} in project ${validated.projectId}` }],
            };
          }
          
           // Generate summary if not present
           let summary = entry.summary;
           if (summary === null) {
             const result = await summariser.summarise(entry.title, entry.content);
             summary = result.summary;
             
             // Cache the summary only if it's not a fallback (real LLM result)
             // This prevents caching truncated fallbacks and avoids masking LLM failures
             if (!result.isFallback) {
               try {
                 store.updateSummary(entry.id, summary);
               } catch (err) {
                 const error = err instanceof Error ? err : new Error(String(err));
                 logError(error, 'database', { 
                   operation: 'get-context:updateSummary',
                   projectId: validated.projectId,
                   entryId: validated.id,
                 });
                 // Don't fail the request if caching fails - we still have the summary
               }
             }
           }
          
          // Build response object
          const response: any = {
            id: entry.id,
            projectId: entry.projectId,
            title: entry.title,
            summary,
            createdAt: entry.createdAt,
            tags: entry.tags,
          };
          
          // Include full content only if requested
          if (validated.includeFull) {
            response.content = entry.content;
          }
          
          // Format text content for display
          const textContent = summary;
          
          return {
            content: [{ type: 'text' as const, text: textContent }],
            structuredContent: response,
          };
        } catch (err) {
          // DatabaseError or unexpected error during storage operations
          if (err instanceof DatabaseError) {
            logError(err, 'database', { 
              tool: 'get-context',
              projectId: validated.projectId,
              entryId: validated.id,
            });
            return {
              isError: true,
              content: [{ type: 'text' as const, text: `Failed to retrieve context: ${err.message}` }],
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
            { tool: 'get-context' }
          );
          
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `${fieldName} ${message}` }],
          };
        }
        
        // Unexpected error
        const err = error instanceof Error ? error : new Error(String(error));
        logError(err, 'system', { tool: 'get-context' });
        
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Unexpected error: ${err.message}` }],
        };
      }
    },
  };
}
