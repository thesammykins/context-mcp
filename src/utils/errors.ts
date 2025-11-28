/**
 * Custom error classes and formatting utilities
 */

// Metrics tracking for summarization
interface SummarizationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  fallbackUsed: number;
  totalTokensUsed: number;
}

let metrics: SummarizationMetrics = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  fallbackUsed: 0,
  totalTokensUsed: 0,
};

export function getSummarizationMetrics(): SummarizationMetrics {
  return { ...metrics };
}

export function updateSummarizationMetrics(
  success: boolean,
  isFallback: boolean,
  tokensUsed?: number
): void {
  metrics.totalRequests++;
  if (success) {
    metrics.successfulRequests++;
  } else {
    metrics.failedRequests++;
  }
  if (isFallback) {
    metrics.fallbackUsed++;
  }
  if (tokensUsed) {
    metrics.totalTokensUsed += tokensUsed;
  }
}

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

/**
 * Log summarization metrics periodically
 */
export function logSummarizationMetrics(): void {
  const { totalRequests, successfulRequests, failedRequests, fallbackUsed, totalTokensUsed } = getSummarizationMetrics();
  const successRate = totalRequests > 0 ? (successfulRequests / totalRequests * 100).toFixed(1) : '0.0';
  const fallbackRate = totalRequests > 0 ? (fallbackUsed / totalRequests * 100).toFixed(1) : '0.0';
  
  console.error(`[METRICS] Summarization: ${totalRequests} requests, ${successRate}% success, ${fallbackRate}% fallback, ${totalTokensUsed} tokens used`);
}