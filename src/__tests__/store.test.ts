import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProgressStore } from '../storage/index.js';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('store', () => {
  let store: ProgressStore;
  let testDbPath: string;

  beforeEach(() => {
    testDbPath = path.join(os.tmpdir(), `test-progress-${Date.now()}.db`);
    store = new ProgressStore(testDbPath);
  });

  afterEach(() => {
    store.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    // Clean up WAL and SHM files
    if (fs.existsSync(`${testDbPath}-wal`)) {
      fs.unlinkSync(`${testDbPath}-wal`);
    }
    if (fs.existsSync(`${testDbPath}-shm`)) {
      fs.unlinkSync(`${testDbPath}-shm`);
    }
  });

  it('creates database file on initialization', () => {
    expect(fs.existsSync(testDbPath)).toBe(true);
  });

  it('creates tables on first run', () => {
    // If we can create entries, tables exist
    store.ensureProject('test-project');
    const entry = store.createEntry({
      id: 'test1234abcd',
      projectId: 'test-project',
      title: 'Test entry',
      content: 'Test content',
      createdAt: new Date().toISOString(),
      tags: [],
      agentId: null,
    });
    expect(entry).toBeDefined();
  });

  it('ensureProject() creates project if not exists', () => {
    store.ensureProject('new-project');
    // Should not throw, project should be created
    const entry = store.createEntry({
      id: 'test1234abcd',
      projectId: 'new-project',
      title: 'Test',
      content: 'Content',
      createdAt: new Date().toISOString(),
      tags: [],
      agentId: null,
    });
    expect(entry.projectId).toBe('new-project');
  });

  it('ensureProject() is idempotent (no error on duplicate)', () => {
    store.ensureProject('idempotent-project');
    expect(() => store.ensureProject('idempotent-project')).not.toThrow();
  });

  it('createEntry() generates 12-char nanoid', () => {
    store.ensureProject('test-project');
    const entry = store.createEntry({
      id: 'abcd1234ef56', // 12 chars
      projectId: 'test-project',
      title: 'Test',
      content: 'Content',
      createdAt: new Date().toISOString(),
      tags: [],
      agentId: null,
    });
    expect(entry.id).toHaveLength(12);
  });

  it('createEntry() stores all fields correctly', () => {
    store.ensureProject('test-project');
    const createdAt = new Date().toISOString();
    const entry = store.createEntry({
      id: 'abcd1234ef56',
      projectId: 'test-project',
      title: 'My Title',
      content: 'My Content',
      createdAt,
      tags: ['tag1', 'tag2'],
      agentId: 'agent-1',
    });

    expect(entry.id).toBe('abcd1234ef56');
    expect(entry.projectId).toBe('test-project');
    expect(entry.title).toBe('My Title');
    expect(entry.content).toBe('My Content');
    expect(entry.createdAt).toBe(createdAt);
    expect(entry.tags).toEqual(['tag1', 'tag2']);
    expect(entry.agentId).toBe('agent-1');
    expect(entry.summary).toBeNull();
  });

  it('getEntry() returns entry by projectId + id', () => {
    store.ensureProject('test-project');
    store.createEntry({
      id: 'abcd1234ef56',
      projectId: 'test-project',
      title: 'Test',
      content: 'Content',
      createdAt: new Date().toISOString(),
      tags: [],
      agentId: null,
    });

    const entry = store.getEntry('test-project', 'abcd1234ef56');
    expect(entry).not.toBeNull();
    expect(entry?.id).toBe('abcd1234ef56');
    expect(entry?.projectId).toBe('test-project');
  });

  it('getEntry() returns null for non-existent entry', () => {
    const entry = store.getEntry('no-project', 'no-entry');
    expect(entry).toBeNull();
  });

  it('updateSummary() persists summary', () => {
    store.ensureProject('test-project');
    store.createEntry({
      id: 'abcd1234ef56',
      projectId: 'test-project',
      title: 'Test',
      content: 'Content',
      createdAt: new Date().toISOString(),
      tags: [],
      agentId: null,
    });

    store.updateSummary('abcd1234ef56', 'This is the summary');

    const entry = store.getEntry('test-project', 'abcd1234ef56');
    expect(entry?.summary).toBe('This is the summary');
  });

  it('searchEntries() filters by projectId', () => {
    store.ensureProject('project-a');
    store.ensureProject('project-b');
    store.createEntry({
      id: 'entry-a-0001',
      projectId: 'project-a',
      title: 'Entry A',
      content: 'Content',
      createdAt: new Date().toISOString(),
      tags: [],
      agentId: null,
    });
    store.createEntry({
      id: 'entry-b-0001',
      projectId: 'project-b',
      title: 'Entry B',
      content: 'Content',
      createdAt: new Date().toISOString(),
      tags: [],
      agentId: null,
    });

    const result = store.searchEntries({ projectId: 'project-a' });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe('entry-a-0001');
  });

  it('searchEntries() filters by title query (case-insensitive)', () => {
    store.ensureProject('test-project');
    store.createEntry({
      id: 'entry-00001',
      projectId: 'test-project',
      title: 'Authentication Module',
      content: 'Content',
      createdAt: new Date().toISOString(),
      tags: [],
      agentId: null,
    });
    store.createEntry({
      id: 'entry-00002',
      projectId: 'test-project',
      title: 'Database Setup',
      content: 'Content',
      createdAt: new Date().toISOString(),
      tags: [],
      agentId: null,
    });

    const result = store.searchEntries({ projectId: 'test-project', query: 'auth' });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].title).toBe('Authentication Module');
  });

  it('searchEntries() filters by date range', () => {
    store.ensureProject('test-project');
    store.createEntry({
      id: 'entry-old01',
      projectId: 'test-project',
      title: 'Old Entry',
      content: 'Content',
      createdAt: '2025-01-01T00:00:00Z',
      tags: [],
      agentId: null,
    });
    store.createEntry({
      id: 'entry-new01',
      projectId: 'test-project',
      title: 'New Entry',
      content: 'Content',
      createdAt: '2025-06-15T00:00:00Z',
      tags: [],
      agentId: null,
    });

    const result = store.searchEntries({
      projectId: 'test-project',
      startDate: '2025-06-01T00:00:00Z',
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].title).toBe('New Entry');
  });

  it('searchEntries() filters by tags (AND logic)', () => {
    store.ensureProject('test-project');
    store.createEntry({
      id: 'entry-tag01',
      projectId: 'test-project',
      title: 'Entry with auth tag',
      content: 'Content',
      createdAt: new Date().toISOString(),
      tags: ['auth'],
      agentId: null,
    });
    store.createEntry({
      id: 'entry-tag02',
      projectId: 'test-project',
      title: 'Entry with auth and api tags',
      content: 'Content',
      createdAt: new Date().toISOString(),
      tags: ['auth', 'api'],
      agentId: null,
    });

    const result = store.searchEntries({
      projectId: 'test-project',
      tags: ['auth', 'api'],
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].title).toBe('Entry with auth and api tags');
  });

  it('searchEntries() respects limit', () => {
    store.ensureProject('test-project');
    for (let i = 0; i < 30; i++) {
      store.createEntry({
        id: `entry-lim${i.toString().padStart(3, '0')}`,
        projectId: 'test-project',
        title: `Entry ${i}`,
        content: 'Content',
        createdAt: new Date(Date.now() + i * 1000).toISOString(),
        tags: [],
        agentId: null,
      });
    }

    const result = store.searchEntries({ projectId: 'test-project', limit: 10 });
    expect(result.entries).toHaveLength(10);
  });

  it('searchEntries() sorts by createdAt descending', () => {
    store.ensureProject('test-project');
    store.createEntry({
      id: 'entry-first1',
      projectId: 'test-project',
      title: 'First Entry',
      content: 'Content',
      createdAt: '2025-01-01T00:00:00Z',
      tags: [],
      agentId: null,
    });
    store.createEntry({
      id: 'entry-secnd1',
      projectId: 'test-project',
      title: 'Second Entry',
      content: 'Content',
      createdAt: '2025-06-01T00:00:00Z',
      tags: [],
      agentId: null,
    });

    const result = store.searchEntries({ projectId: 'test-project' });
    expect(result.entries[0].title).toBe('Second Entry');
    expect(result.entries[1].title).toBe('First Entry');
  });
});
