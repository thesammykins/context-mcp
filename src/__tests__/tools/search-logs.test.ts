import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createSearchLogsTool } from '../../tools/search-logs.js';
import { ProgressStore } from '../../storage/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { nanoid } from 'nanoid';

describe('search_logs tool', () => {
  let store: ProgressStore;
  let testDbPath: string;
  let tool: ReturnType<typeof createSearchLogsTool>;

  beforeEach(() => {
    // Use nanoid to ensure truly unique database names
    testDbPath = path.join(os.tmpdir(), `test-progress-${nanoid()}.db`);
    store = new ProgressStore(testDbPath);
    tool = createSearchLogsTool(store);

    // Set up test data
    store.ensureProject('test-project');
    store.createEntry({
      id: 'entry-auth01',
      projectId: 'test-project',
      title: 'Authentication Module',
      content: 'Implemented auth',
      createdAt: '2025-06-15T10:00:00Z',
      tags: ['auth', 'security'],
      agentId: null,
    });
    store.createEntry({
      id: 'entry-db-001',
      projectId: 'test-project',
      title: 'Database Setup',
      content: 'Set up database',
      createdAt: '2025-06-14T10:00:00Z',
      tags: ['database'],
      agentId: null,
    });
    store.createEntry({
      id: 'entry-api001',
      projectId: 'test-project',
      title: 'API Endpoints',
      content: 'Created API endpoints',
      createdAt: '2025-06-13T10:00:00Z',
      tags: ['api', 'auth'],
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
    const result = await tool.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/projectId.*Required/);
  });

  it('accepts projectId-only query (returns all entries)', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.entries.length).toBe(3);
  });

  it('applies default limit of 20', async () => {
    // Create more than 20 entries
    for (let i = 0; i < 25; i++) {
      store.createEntry({
        id: `entry-bulk${i.toString().padStart(3, '0')}`,
        projectId: 'test-project',
        title: `Bulk Entry ${i}`,
        content: 'Content',
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
        tags: [],
        agentId: null,
      });
    }

    const result = await tool.handler({
      projectId: 'test-project',
    });

    // Default limit is 20, but we have 28 total (3 original + 25 new)
    expect(result.structuredContent.entries.length).toBe(20);
  });

  it('respects max limit of 100', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      limit: 150, // Exceeds max
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/limit.*100/);
  });

  it('filters by title query (case-insensitive substring)', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      query: 'AUTH',
    });

    expect(result.structuredContent.entries.length).toBe(1);
    expect(result.structuredContent.entries[0].title).toBe('Authentication Module');
  });

  it('filters by startDate', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      startDate: '2025-06-14T00:00:00Z',
    });

    expect(result.structuredContent.entries.length).toBe(2);
    expect(result.structuredContent.entries.map((e: { title: string }) => e.title)).toContain('Authentication Module');
    expect(result.structuredContent.entries.map((e: { title: string }) => e.title)).toContain('Database Setup');
  });

  it('filters by endDate', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      endDate: '2025-06-14T23:59:59Z',
    });

    expect(result.structuredContent.entries.length).toBe(2);
    expect(result.structuredContent.entries.map((e: { title: string }) => e.title)).toContain('Database Setup');
    expect(result.structuredContent.entries.map((e: { title: string }) => e.title)).toContain('API Endpoints');
  });

  it('filters by tags (AND logic)', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      tags: ['auth', 'security'],
    });

    expect(result.structuredContent.entries.length).toBe(1);
    expect(result.structuredContent.entries[0].title).toBe('Authentication Module');
  });

  it('sorts results by createdAt descending', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
    });

    const titles = result.structuredContent.entries.map((e: { title: string }) => e.title);
    expect(titles).toEqual([
      'Authentication Module',
      'Database Setup',
      'API Endpoints',
    ]);
  });

  it('response excludes content and summary', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
    });

    const entry = result.structuredContent.entries[0];
    expect(entry).not.toHaveProperty('content');
    expect(entry).not.toHaveProperty('summary');
    expect(entry).toHaveProperty('id');
    expect(entry).toHaveProperty('title');
    expect(entry).toHaveProperty('createdAt');
    expect(entry).toHaveProperty('tags');
  });

  it('rejects invalid startDate format', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      startDate: 'invalid-date',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Invalid date format.*Expected ISO 8601 format/);
  });

  it('rejects invalid endDate format', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      endDate: 'not-a-date',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Invalid date format.*Expected ISO 8601 format/);
  });

  it('accepts valid ISO 8601 date formats', async () => {
    const validDates = [
      '2025-01-15T10:30:00Z',
      '2025-01-15T10:30:00.123Z',
      '2025-01-15T10:30:00+00:00',
      '2025-01-15T10:30:00-05:00',
    ];

    for (const date of validDates) {
      const result = await tool.handler({
        projectId: 'test-project',
        startDate: date,
      });

      expect(result.isError).toBeFalsy();
    }
  });

  it('accepts missing date parameters', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.entries.length).toBe(3);
  });

  it('returns error for non-existent project', async () => {
    const result = await tool.handler({
      projectId: 'non-existent-project',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Project not found: non-existent-project');
  });

  it('returns error for non-existent project with query', async () => {
    const result = await tool.handler({
      projectId: 'non-existent-project',
      query: 'test',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Project not found: non-existent-project');
  });

  it('distinguishes between empty project and non-existent project', async () => {
    // Create an empty project
    store.ensureProject('empty-project');

    const result = await tool.handler({
      projectId: 'empty-project',
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.total).toBe(0);
    expect(result.content[0].text).toBe('No entries found in empty-project');
  });
});
