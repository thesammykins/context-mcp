import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import os from 'os';
import { existsSync as realExistsSync, readFileSync as realReadFileSync } from 'fs';

// We need to mock fs before the config module imports it
// Using vi.hoisted ensures these are available when vi.mock runs
const { mockExistsSync, mockReadFileSync, mockMkdirSync, mockWriteFileSync, mockUnlinkSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
  mockReadFileSync: vi.fn(),
  mockMkdirSync: vi.fn(),
  mockWriteFileSync: vi.fn(),
  mockUnlinkSync: vi.fn(),
}));

// Mock the entire fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: mockExistsSync,
    readFileSync: mockReadFileSync,
    mkdirSync: mockMkdirSync,
    writeFileSync: mockWriteFileSync,
    unlinkSync: mockUnlinkSync,
  };
});

describe('config', () => {
  const originalEnv = process.env;
  let actualExistsSync: typeof realExistsSync;
  let actualReadFileSync: typeof realReadFileSync;

  beforeEach(async () => {
    // Get actual fs functions
    const actualFs = await vi.importActual<typeof import('fs')>('fs');
    actualExistsSync = actualFs.existsSync;
    actualReadFileSync = actualFs.readFileSync;

    // Configure mocks to block config file and pass through everything else
    mockExistsSync.mockImplementation((path: string) => {
      // Block any config file paths
      if (typeof path === 'string' && path.includes('agent-progress.config.json')) {
        return false;
      }
      // For database writability tests, make directories exist
      if (typeof path === 'string' && path.includes('/absolute/path')) {
        return true;
      }
      return actualExistsSync(path);
    });

    mockReadFileSync.mockImplementation((path: string, options?: any) => {
      if (typeof path === 'string' && path.includes('agent-progress.config.json')) {
        throw new Error('ENOENT: no such file');
      }
      return actualReadFileSync(path, options);
    });

    // Mock mkdirSync, writeFileSync, and unlinkSync to succeed for writability tests
    mockMkdirSync.mockImplementation(() => {});
    mockWriteFileSync.mockImplementation(() => {});
    mockUnlinkSync.mockImplementation(() => {});

    // Reset module cache to ensure fresh import with mocks
    vi.resetModules();

    // Set up clean environment
    process.env = { ...originalEnv };
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_BASE_URL;
    delete process.env.AGENT_PROGRESS_MODEL;
    delete process.env.AGENT_PROGRESS_DB_PATH;
    delete process.env.AGENT_PROGRESS_LOG_LEVEL;
    delete process.env.AGENT_PROGRESS_CONFIG_PATH;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('loads default values when no env vars set (expect API key error)', async () => {
    const { loadConfig } = await import('../config/index.js');
    expect(() => loadConfig()).toThrow();
  });

  it('reads OPENAI_API_KEY from environment', async () => {
    process.env.OPENAI_API_KEY = 'test-api-key';
    const { loadConfig } = await import('../config/index.js');

    const config = loadConfig();

    expect(config.openai.apiKey).toBe('test-api-key');
  });

  it('reads OPENAI_BASE_URL with default fallback', async () => {
    process.env.OPENAI_API_KEY = 'test-api-key';
    const { loadConfig } = await import('../config/index.js');

    const config = loadConfig();

    expect(config.openai.baseUrl).toBe('https://api.openai.com/v1');
  });

  it('reads AGENT_PROGRESS_MODEL with default gpt-4o-mini', async () => {
    process.env.OPENAI_API_KEY = 'test-api-key';
    const { loadConfig } = await import('../config/index.js');

    const config = loadConfig();

    expect(config.openai.model).toBe('gpt-4o-mini');
  });

  it('expands ~ in AGENT_PROGRESS_DB_PATH', async () => {
    process.env.OPENAI_API_KEY = 'test-api-key';
    process.env.AGENT_PROGRESS_DB_PATH = '~/custom/path/data.db';
    const { loadConfig } = await import('../config/index.js');

    const config = loadConfig();

    expect(config.dbPath).toBe(`${os.homedir()}/custom/path/data.db`);
  });

  it('throws if OPENAI_API_KEY missing', async () => {
    const { loadConfig } = await import('../config/index.js');
    expect(() => loadConfig()).toThrow(/OPENAI_API_KEY/i);
  });

  describe('URL validation', () => {
    it('accepts valid HTTPS URLs', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      process.env.OPENAI_BASE_URL = 'https://api.openai.com/v1';
      const { loadConfig } = await import('../config/index.js');

      expect(() => loadConfig()).not.toThrow();
    });

    it('accepts valid HTTP URLs', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      process.env.OPENAI_BASE_URL = 'http://localhost:8080/v1';
      const { loadConfig } = await import('../config/index.js');

      expect(() => loadConfig()).not.toThrow();
    });

    it('rejects invalid URLs', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      process.env.OPENAI_BASE_URL = 'not-a-url';
      const { loadConfig } = await import('../config/index.js');

      expect(() => loadConfig()).toThrow(/OpenAI baseUrl must be a valid URL/);
    });

    it('rejects non-HTTP/HTTPS protocols', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      process.env.OPENAI_BASE_URL = 'ftp://example.com';
      const { loadConfig } = await import('../config/index.js');

      expect(() => loadConfig()).toThrow(/OpenAI baseUrl must use HTTP or HTTPS protocol/);
    });
  });

  describe('Log level validation', () => {
    it('accepts valid log levels from config file', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('agent-progress.config.json')) return true;
        return actualExistsSync(path);
      });
      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes('agent-progress.config.json')) {
          return JSON.stringify({ logging: { level: 'debug' } });
        }
        return actualReadFileSync(path);
      });
      vi.resetModules();
      const { loadConfig } = await import('../config/index.js');

      expect(() => loadConfig()).not.toThrow();
    });

    it('rejects invalid log levels from config file', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      mockExistsSync.mockImplementation((path: string) => {
        if (path.includes('agent-progress.config.json')) return true;
        return actualExistsSync(path);
      });
      mockReadFileSync.mockImplementation((path: string) => {
        if (path.includes('agent-progress.config.json')) {
          return JSON.stringify({ logging: { level: 'invalid' } });
        }
        return actualReadFileSync(path);
      });
      vi.resetModules();
      const { loadConfig } = await import('../config/index.js');

      expect(() => loadConfig()).toThrow(/Log level must be one of/);
    });
  });

  describe('Database path validation', () => {
    it('accepts absolute paths with valid extensions', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      process.env.AGENT_PROGRESS_DB_PATH = '/absolute/path/data.db';
      const { loadConfig } = await import('../config/index.js');

      expect(() => loadConfig()).not.toThrow();
    });

    it('accepts home directory paths', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      process.env.AGENT_PROGRESS_DB_PATH = '~/data.db';
      const { loadConfig } = await import('../config/index.js');

      expect(() => loadConfig()).not.toThrow();
    });

    it('rejects relative paths', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      process.env.AGENT_PROGRESS_DB_PATH = 'relative/path/data.db';
      const { loadConfig } = await import('../config/index.js');

      expect(() => loadConfig()).toThrow(/Database path must be absolute or start with ~/);
    });

    it('rejects paths with dangerous characters', async () => {
      process.env.OPENAI_API_KEY = 'test-api-key';
      process.env.AGENT_PROGRESS_DB_PATH = '/path/../../../etc/passwd';
      const { loadConfig } = await import('../config/index.js');

      expect(() => loadConfig()).toThrow(/Database path contains invalid characters/);
    });
  });
});
