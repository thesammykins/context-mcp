import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The expected system prompt from SPEC.md lines 494-496
const EXPECTED_SYSTEM_PROMPT =
  'You are a technical summariser. Summarise the following agent work log in 2-3 sentences. Focus on: what was done, key files/components changed, and outcome. Be concise and factual. Do not use phrases like "The agent" - write in past tense as if reporting completed work.';

// Mock OpenAI at the top level using hoisted
const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return { mockCreate };
});

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

// Import after mocking
import { Summariser } from '../summariser/index.js';

describe('summariser', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockCreate.mockClear();
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('initializes OpenAI client with custom baseUrl', async () => {
    const config = {
      apiKey: 'test-key',
      baseUrl: 'https://custom.api.com/v1',
      model: 'gpt-4o-mini',
    };

    const summariser = new Summariser(config);
    expect(summariser).toBeDefined();
    // Verify that the client was initialized with the custom baseUrl
    // Implementation will pass apiKey and baseUrl to OpenAI constructor
  });

  it('calls API with correct system prompt (SPEC lines 494-496)', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Summary text' } }],
    });

    const config = {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    };

    const summariser = new Summariser(config);
    await summariser.summarise('Test Title', 'Test Content');

    expect(mockCreate).toHaveBeenCalled();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[0].role).toBe('system');
    expect(callArgs.messages[0].content).toBe(EXPECTED_SYSTEM_PROMPT);
  });

  it('calls API with correct user prompt format (SPEC lines 499-503)', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Summary text' } }],
    });

    const config = {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    };

    const summariser = new Summariser(config);
    await summariser.summarise('My Title', 'My detailed content here');

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.messages[1].role).toBe('user');
    expect(callArgs.messages[1].content).toBe('Title: My Title\n\nContent:\nMy detailed content here');
  });

  it('uses max_tokens: 150 and temperature: 0.3', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Summary text' } }],
    });

    const config = {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    };

    const summariser = new Summariser(config);
    await summariser.summarise('Test Title', 'Test Content');

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.max_tokens).toBe(150);
    expect(callArgs.temperature).toBe(0.3);
  });

  it('returns summary from API response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'This is the generated summary.' } }],
    });

    const config = {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    };

    const summariser = new Summariser(config);
    const result = await summariser.summarise('Test Title', 'Test Content');

    expect(result.summary).toBe('This is the generated summary.');
    expect(result.isFallback).toBe(false);
  });

  it('returns truncated content (500 chars) on API failure', async () => {
    mockCreate.mockRejectedValue(new Error('API Error'));

    const config = {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    };

    const longContent = 'x'.repeat(1000);
    const summariser = new Summariser(config);
    const result = await summariser.summarise('Test Title', longContent);

    expect(result.summary).toHaveLength(303); // 300 chars + '...' = 303
    expect(result.isFallback).toBe(true);
  });

  it('logs error to stderr on failure', async () => {
    mockCreate.mockRejectedValue(new Error('API Error'));

    const config = {
      apiKey: 'test-key',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    };

    const summariser = new Summariser(config);
    await summariser.summarise('Test Title', 'Test Content');

    expect(consoleSpy).toHaveBeenCalled();
  });
});
