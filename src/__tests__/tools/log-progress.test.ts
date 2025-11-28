import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createLogProgressTool } from '../../tools/log-progress.js';
import { ProgressStore } from '../../storage/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { nanoid } from 'nanoid';

describe('log_progress tool', () => {
  let store: ProgressStore;
  let testDbPath: string;
  let tool: ReturnType<typeof createLogProgressTool>;

  beforeEach(() => {
    // Use nanoid to ensure truly unique database names
    testDbPath = path.join(os.tmpdir(), `test-progress-${nanoid()}.db`);
    store = new ProgressStore(testDbPath);
    tool = createLogProgressTool(store);
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
      title: 'Test',
      content: 'Content',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/projectId.*Required/);
  });

  it('rejects missing title', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      content: 'Content',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/title.*Required/);
  });

  it('rejects missing content', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      title: 'Test',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/content.*Required/);
  });

  it('rejects title exceeding 100 chars', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      title: 'x'.repeat(101),
      content: 'Content',
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/title.*100.*characters/);
  });

  it('rejects content exceeding 10000 chars', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      title: 'Test',
      content: 'x'.repeat(10001),
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/content.*10000.*characters/);
  });

  it('accepts valid input and returns id, projectId, title, createdAt', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      title: 'My Test Entry',
      content: 'This is the content of my entry',
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toHaveProperty('id');
    expect(result.structuredContent).toHaveProperty('projectId', 'test-project');
    expect(result.structuredContent).toHaveProperty('title', 'My Test Entry');
    expect(result.structuredContent).toHaveProperty('createdAt');
  });

  it('returned id is 12 characters', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      title: 'Test Entry',
      content: 'Content',
    });

    expect(result.structuredContent.id).toHaveLength(12);
  });

  it('createdAt is valid ISO 8601', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      title: 'Test Entry',
      content: 'Content',
    });

    const createdAt = result.structuredContent.createdAt;
    const parsed = new Date(createdAt);
    expect(parsed.toISOString()).toBe(createdAt);
  });

  it('auto-creates project on first entry', async () => {
    const result = await tool.handler({
      projectId: 'brand-new-project',
      title: 'First Entry',
      content: 'Content',
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent.projectId).toBe('brand-new-project');

    // Verify entry was stored
    const entry = store.getEntry('brand-new-project', result.structuredContent.id);
    expect(entry).not.toBeNull();
  });

  it('response includes text content and structuredContent', async () => {
    const result = await tool.handler({
      projectId: 'test-project',
      title: 'Test Entry',
      content: 'Content',
    });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toMatch(/Logged.*Test Entry/);
    expect(result.structuredContent).toBeDefined();
  });
});
