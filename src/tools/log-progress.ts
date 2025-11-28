import { z } from 'zod';
import { nanoid } from 'nanoid';
import type { ProgressStore } from '../storage/index.js';
import { ValidationError, DatabaseError, logError, sanitizeTitle, sanitizeContentWithPII, sanitizeTags, sanitizeAgentId, validateProjectId } from '../utils/index.js';

const LogProgressInputSchema = z.object({
  projectId: z.string().min(1, 'projectId is required').max(100, 'projectId must be at most 100 characters'),
  title: z.string().min(1, 'title is required').max(100, 'title must be at most 100 characters'),
  content: z.string().min(1, 'content is required and cannot be empty').max(10000, 'content must be at most 10000 characters'),
  tags: z.array(z.string().max(50)).max(10).optional(),
  agentId: z.string().max(100).optional(),
});

export function createLogProgressTool(store: ProgressStore) {
  return {
    handler: async (args: Record<string, unknown>) => {
      try {
        // Validate input
        const validated = LogProgressInputSchema.parse(args);
        
        // Sanitize all inputs
        const sanitizedProjectId = validateProjectId(validated.projectId);
        const sanitizedTitle = sanitizeTitle(validated.title);
        const sanitizedContent = sanitizeContentWithPII(validated.content);
        const sanitizedTags = sanitizeTags(validated.tags || []);
        const sanitizedAgentId = sanitizeAgentId(validated.agentId || null);
        
        try {
          // Ensure project exists
          store.ensureProject(sanitizedProjectId);
        } catch (err) {
          const error = err instanceof DatabaseError ? err : new Error(String(err));
          logError(error, 'database', { operation: 'log-progress:ensureProject', projectId: sanitizedProjectId });
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Failed to create project: ${error instanceof DatabaseError ? error.message : 'Unknown error'}` }],
          };
        }
        
        // Generate ID and timestamp
        const id = nanoid(12);
        const createdAt = new Date().toISOString();
        
        try {
          // Create entry
          const entry = await store.createEntry({
            id,
            projectId: sanitizedProjectId,
            title: sanitizedTitle,
            content: sanitizedContent,
            createdAt,
            tags: sanitizedTags,
            agentId: sanitizedAgentId,
          });
          
          // Format response
          const textContent = `Logged: ${sanitizedTitle} (ID: ${entry.id}) in project ${sanitizedProjectId}`;
          
          return {
            content: [{ type: 'text' as const, text: textContent }],
            structuredContent: {
              id: entry.id,
              projectId: sanitizedProjectId,
              title: sanitizedTitle,
              createdAt: entry.createdAt,
            },
          };
        } catch (err) {
          const error = err instanceof DatabaseError ? err : new Error(String(err));
          logError(error, 'database', { 
            operation: 'log-progress:createEntry', 
            projectId: sanitizedProjectId 
          });
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `Failed to log progress: ${error instanceof DatabaseError ? error.message : 'Unknown error'}` }],
          };
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          // Validation error - extract first error
          const firstError = error.errors[0];
          const fieldName = firstError.path.join('.');
          const message = firstError.message;
          
          logError(
            new ValidationError(`${fieldName} ${message}`),
            'validation',
            { tool: 'log-progress' }
          );
          
          return {
            isError: true,
            content: [{ type: 'text' as const, text: `${fieldName} ${message}` }],
          };
        }
        
        // Unexpected error
        const err = error instanceof Error ? error : new Error(String(error));
        logError(err, 'system', { tool: 'log-progress' });
        
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Unexpected error: ${err.message}` }],
        };
      }
    },
  };
}
