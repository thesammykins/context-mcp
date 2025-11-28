import OpenAI from 'openai';
import type { OpenAIConfig } from '../types.js';
import { SummariserError, logError } from '../utils/index.js';

const SYSTEM_PROMPT = 'You are a technical summariser. Summarise the following agent work log in 2-3 sentences. Focus on: what was done, key files/components changed, and outcome. Be concise and factual. Do not use phrases like "The agent" - write in past tense as if reporting completed work.';

const FALLBACK_MAX_LENGTH = 500;
const LLM_TIMEOUT_MS = 30_000; // 30 second timeout for LLM API calls

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
      
      // Return truncated content as fallback (exactly FALLBACK_MAX_LENGTH chars)
      const fallback = content.length > FALLBACK_MAX_LENGTH 
        ? content.substring(0, FALLBACK_MAX_LENGTH) 
        : content;
      
      return {
        summary: fallback,
        isFallback: true,
      };
    }
  }
}
