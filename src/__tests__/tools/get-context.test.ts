import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createGetContextTool } from '../../tools/get-context.js';
import { ProgressStore } from '../../storage/index.js';
import { Summariser } from '../../summariser/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { nanoid } from 'nanoid';

describe('get_context tool', () => {
  let store: ProgressStore;
  let summariser: Summariser;
  let testDbPath: string;
  let tool: ReturnType<typeof createGetContextTool>;
  let mockSummarise: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Use nanoid to ensure truly unique database names
    testDbPath = path.join(os.tmpdir(), `test-progress-${nanoid()}.db`);
    store = new ProgressStore(testDbPath);

    // Create a mock summariser
    mockSummarise = vi.fn().mockResolvedValue({
      summary: 'Generated summary text',
      isFallback: false,
    });

    summariser = {
      summarise: mockSummarise,
    } as unknown as Summariser;

    tool = createGetContextTool(store, summariser);

    // Set up a test entry
    store.ensureProject('test-project');
    store.createEntry({
      id: 'testentry001',
      projectId: 'test-project',
      title: 'Test Entry',
      content: 'This is the full content of the test entry.',
      createdAt: new Date().toISOString(),
      tags: ['test'],
      agentId: null,
    });
  });

  afterEach(() => {
    try {
      store.close();
    } catch {
      // Ignore close errors
    }
    
    // Clean up database files
    for (const suffix of ['', '-wal', '-shm']) {
      const filePath = `${testDbPath}${suffix}`;
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch {
          // Ignore deletion errors
        }
      }
    }
  });

  it('rejects missing projectId', async () => {
    const result = await tool.handler({
      id: 'testentry001',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/projectId.*Required/);
  });

  it('rejects missing id', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/id.*Required/);
  });

  it('returns error for non-existent entry', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      id: 'nonexistent1',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Entry not found/);
  });

  it('generates summary on first retrieval (mock LLM)', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      id: 'testentry001',
    });

    expect(mockSummarise).toHaveBeenCalledTimes(1);
    expect(mockSummarise).toHaveBeenCalledWith(
      'Test Entry',
      'This is the full content of the test entry.'
    );
    expect(result.structuredContent.summary).toBe('Generated summary text');
  });

  it('caches summary after generation', async () => {
    await tool.handler({
      projectId: 'test-project',
      id: 'testentry001',
    });

    // Verify summary was cached in database
    const entry = store.getEntry('test-project', 'testentry001');
    expect(entry?.summary).toBe('Generated summary text');
  });

  it('returns cached summary on subsequent calls (no LLM call)', async () => {
    // First call - generates summary
    await tool.handler({
      projectId: 'test-project',
      id: 'testentry001',
    });

    // Reset mock to track subsequent calls
    mockSummarise.mockClear();

    // Second call - should use cache
    const result = await tool.handler({
      projectId: 'test-project',
      id: 'testentry001',
    });

    expect(mockSummarise).not.toHaveBeenCalled();
    expect(result.structuredContent.summary).toBe('Generated summary text');
  });

  it('includes full content when includeFull: true', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      id: 'testentry001',
      includeFull: true,
    });

    expect(result.structuredContent.content).toBe(
      'This is the full content of the test entry.'
    );
  });

  it('excludes content when includeFull: false', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      id: 'testentry001',
      includeFull: false,
    });

    expect(result.structuredContent.content).toBeUndefined();
  });
});
