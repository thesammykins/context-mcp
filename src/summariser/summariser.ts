import OpenAI from 'openai';
import type { OpenAIConfig } from '../types.js';
import { SummariserError, logError, updateSummarizationMetrics } from '../utils/index.js';

const SYSTEM_PROMPT = 'You are a technical summariser. Summarise the following agent work log in 2-3 sentences. Focus on: what was done, key files/components changed, and outcome. Be concise and factual. Do not use phrases like "The agent" - write in past tense as if reporting completed work.';

const FALLBACK_MAX_LENGTH = 300;
const LLM_TIMEOUT_MS = 30_000; // 30 second timeout for LLM API calls

/**
 * Create intelligent fallback summary when LLM fails
 */
function createFallbackSummary(title: string, content: string): string {
  // Extract key information from content
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);

  if (sentences.length === 0) {
    return content.substring(0, FALLBACK_MAX_LENGTH) + (content.length > FALLBACK_MAX_LENGTH ? '...' : '');
  }

  // Try to create a meaningful summary from first few sentences
  let summary = '';
  let usedChars = 0;

  for (const sentence of sentences) {
    if (usedChars + sentence.length + 1 <= FALLBACK_MAX_LENGTH) {
      summary += sentence.trim() + '. ';
      usedChars += sentence.length + 1;
    } else {
      break;
    }
  }

  // If still too short, add key context
  if (summary.length < 100 && content.length > 200) {
    // Look for key technical terms
    const techTerms = ['implemented', 'created', 'added', 'updated', 'fixed', 'built', 'developed'];
    for (const term of techTerms) {
      if (content.toLowerCase().includes(term) && summary.length + term.length + 2 <= FALLBACK_MAX_LENGTH) {
        summary += `${term.charAt(0).toUpperCase() + term.slice(1)} `;
        break;
      }
    }
  }

  // If we still have no summary content, fall back to truncating the original content
  if (summary.trim().length === 0) {
    return content.substring(0, FALLBACK_MAX_LENGTH) + (content.length > FALLBACK_MAX_LENGTH ? '...' : '');
  }

  return summary.trim() + (content.length > FALLBACK_MAX_LENGTH ? '...' : '');
}

export interface SummariseResult {
  summary: string;
  isFallback: boolean;
}

export class Summariser {
  private openai: OpenAI;
  private model: string;

  constructor(config: OpenAIConfig) {
    this.openai = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
    this.model = config.model;
  }

  async summarise(title: string, content: string): Promise<SummariseResult> {
    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Title: ${title}\n\nContent:\n${content}` }
        ],
        max_tokens: 150,
        temperature: 0.3,
      }, {
        timeout: LLM_TIMEOUT_MS,
      });

      const summary = response.choices[0]?.message?.content || '';
      
      if (!summary) {
        throw new SummariserError('Empty response from LLM API', true);
      }

      // Update metrics for successful request
      const usage = response.usage;
      updateSummarizationMetrics(true, false, usage?.total_tokens);
      
      return {
        summary,
        isFallback: false,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      
      // Categorize the error for better logging
      let contextInfo: Record<string, unknown> = { title: title.substring(0, 50) };

      if (error.message.includes('rate')) {
        contextInfo.reason = 'rate_limited';
      } else if (error.message.includes('timeout') || error.message.includes('ECONNREFUSED')) {
        contextInfo.reason = 'network_error';
      } else if (error.message.includes('401') || error.message.includes('403')) {
        contextInfo.reason = 'auth_error';
      } else {
        contextInfo.reason = 'unknown_error';
      }

      logError(error, 'llm', contextInfo);
      
      // Return intelligent fallback summary
      const fallback = createFallbackSummary(title, content);
      
      // Update metrics for failed request
      updateSummarizationMetrics(false, true);
      
      return {
        summary: fallback,
        isFallback: true,
      };
    }
  }
}
