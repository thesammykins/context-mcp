/**
 * Security utilities for input sanitization and validation
 */

// Patterns for potentially dangerous content
const DANGEROUS_PATTERNS = [
  // SQL injection patterns
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
  // Script injection patterns
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  // HTML tags (allow basic formatting but remove dangerous attributes)
  /<[^>]*\s+(on\w+|javascript:|data:)[^>]*>/gi,
  // Control characters
  /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
];

// PII detection patterns
const PII_PATTERNS = [
  // Email addresses
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[REDACTED_EMAIL]'
  },
  // Phone numbers (various formats)
  {
    pattern: /\b(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})\b/g,
    replacement: '[REDACTED_PHONE]'
  },
  // Social Security Numbers
  {
    pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    replacement: '[REDACTED_SSN]'
  },
  // Credit card numbers (basic pattern)
  {
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[REDACTED_CARD]'
  },
  // IP addresses
  {
    pattern: /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g,
    replacement: '[REDACTED_IP]'
  },
  // URLs with potential sensitive info
  {
    pattern: /\bhttps?:\/\/[^\s]*\?(?:[^&]*&)?(?:token|key|password|secret|auth)=[^&\s]*/gi,
    replacement: '[REDACTED_URL]'
  },
  // API keys (common patterns)
  {
    pattern: /\b(?:sk_|pk_|AIza|AKIA|ya29)[A-Za-z0-9_-]{20,}\b/g,
    replacement: '[REDACTED_API_KEY]'
  },
];

// Allowed HTML tags for basic formatting
const ALLOWED_HTML_TAGS = ['b', 'i', 'em', 'strong', 'code', 'pre'];

/**
 * Detects and redacts PII from text content
 */
export function redactPII(text: string): string {
  if (typeof text !== 'string') {
    throw new Error('Input must be a string');
  }

  let redacted = text;

  // Apply PII patterns
  for (const { pattern, replacement } of PII_PATTERNS) {
    redacted = redacted.replace(pattern, replacement);
  }

  return redacted;
}

/**
 * Sanitizes text content by removing dangerous patterns and redacting PII
 */
export function sanitizeText(text: string): string {
  if (typeof text !== 'string') {
    throw new Error('Input must be a string');
  }

  let sanitized = text;

  // Remove dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Remove HTML tags except allowed ones
  sanitized = sanitized.replace(/<\/?([a-z][a-z0-9]*)\b[^>]*>/gi, (match, tagName) => {
    const lowerTagName = tagName.toLowerCase();
    if (ALLOWED_HTML_TAGS.includes(lowerTagName)) {
      return match; // Keep allowed tags
    }
    return ''; // Remove disallowed tags
  });

  // Redact PII
  sanitized = redactPII(sanitized);

  // Normalize whitespace
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized;
}

/**
 * Validates and sanitizes a title
 */
export function sanitizeTitle(title: string): string {
  const sanitized = sanitizeText(title);
  
  // Additional title-specific validation
  if (sanitized.length === 0) {
    throw new Error('Title cannot be empty after sanitization');
  }
  
  if (sanitized.length > 100) {
    throw new Error('Title too long (maximum 100 characters)');
  }
  
  // Remove excessive punctuation
  return sanitized.replace(/[!?]{3,}/g, '!!').replace(/[.]{3,}/g, '...');
}

/**
 * Validates and sanitizes content with PII redaction
 */
export function sanitizeContentWithPII(content: string): string {
  const sanitized = sanitizeText(content);
  
  if (sanitized.length === 0) {
    throw new Error('Content cannot be empty after sanitization');
  }
  
  if (sanitized.length > 10000) {
    throw new Error('Content too long (maximum 10000 characters)');
  }
  
  return sanitized;
}

/**
 * Validates and sanitizes content (legacy function for backward compatibility)
 */
export function sanitizeContent(content: string): string {
  return sanitizeContentWithPII(content);
}

/**
 * Validates and sanitizes tags array
 */
export function sanitizeTags(tags: string[]): string[] {
  if (!Array.isArray(tags)) {
    throw new Error('Tags must be an array');
  }
  
  if (tags.length > 10) {
    throw new Error('Too many tags (maximum 10 allowed)');
  }
  
  const sanitized = tags
    .filter(tag => typeof tag === 'string' && tag.trim().length > 0)
    .map(tag => sanitizeText(tag.trim()))
    .filter(tag => tag.length > 0 && tag.length <= 50)
    .slice(0, 10); // Ensure max 10 tags
  
  return sanitized;
}

/**
 * Validates and sanitizes agent ID
 */
export function sanitizeAgentId(agentId: string | null): string | null {
  if (agentId === null || agentId === undefined) {
    return null;
  }
  
  if (typeof agentId !== 'string') {
    throw new Error('Agent ID must be a string or null');
  }
  
  const sanitized = sanitizeText(agentId.trim());
  
  if (sanitized.length === 0) {
    return null;
  }
  
  if (sanitized.length > 100) {
    throw new Error('Agent ID too long (maximum 100 characters)');
  }
  
  return sanitized;
}

/**
 * Validates project ID format
 */
export function validateProjectId(projectId: string): string {
  if (typeof projectId !== 'string') {
    throw new Error('Project ID must be a string');
  }
  
  const sanitized = projectId.trim();
  
  if (sanitized.length === 0) {
    throw new Error('Project ID cannot be empty');
  }
  
  if (sanitized.length > 100) {
    throw new Error('Project ID too long (maximum 100 characters)');
  }
  
  // Allow only alphanumeric, hyphens, underscores
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new Error('Project ID can only contain letters, numbers, hyphens, and underscores');
  }
  
  return sanitized;
}