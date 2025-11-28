/**
 * Custom error classes and formatting utilities
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public readonly context?: Record<string, unknown>) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class SummariserError extends Error {
  constructor(message: string, public readonly isFallback: boolean = false) {
    super(message);
    this.name = 'SummariserError';
  }
}

/**
 * Format error for logging to stderr with timestamp and context
 */
export function formatErrorLog(
  error: Error,
  category: 'validation' | 'not_found' | 'database' | 'llm' | 'system',
  context?: Record<string, unknown>
): string {
  const timestamp = new Date().toISOString();
  const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
  const stack = error.stack ? `\n${error.stack}` : '';
  return `[${timestamp}] [${category.toUpperCase()}] ${error.message}${contextStr}${stack}`;
}

/**
 * Log error to stderr (uses console.error for compatibility)
 */
export function logError(
  error: Error,
  category: 'validation' | 'not_found' | 'database' | 'llm' | 'system',
  context?: Record<string, unknown>
): void {
  const formattedError = formatErrorLog(error, category, context);
  // For database and system errors, include stack trace
  if (category === 'database' || category === 'system') {
    console.error(formattedError);
  } else {
    // For other errors, just log message
    console.error(formattedError.split('\n')[0]);
  }
}
