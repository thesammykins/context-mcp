import type { Config } from '../types.js';
import { readFileSync, existsSync, mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { dirname, resolve } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

interface ConfigFileData {
  dbPath?: string;
  openai?: {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  };
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
  };
}

function expandHomePath(path: string): string {
  if (path.startsWith('~/')) {
    return path.replace('~', homedir());
  }
  return path;
}

function loadConfigFile(): ConfigFileData | null {
  // Define potential config file locations in priority order
  const configPaths = [
    // 1. Environment variable override (highest priority)
    process.env.AGENT_PROGRESS_CONFIG_PATH,
    // 2. Current working directory
    './agent-progress.config.json',
    // 3. User home directory
    resolve(homedir(), '.agent-progress.config.json'),
    // 4. Package directory (relative to this module)
    resolve(dirname(fileURLToPath(import.meta.url)), '../../agent-progress.config.json')
  ].filter(Boolean) as string[]; // Remove null/undefined values

  for (const configPath of configPaths) {
    if (!existsSync(configPath)) {
      continue;
    }

    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content) as ConfigFileData;
    } catch (error) {
      // Log warning when config file exists but can't be parsed/read
      if (error instanceof SyntaxError) {
        console.warn(`[WARNING] Failed to parse config file at ${configPath}: ${error.message}`);
      } else {
        console.warn(`[WARNING] Failed to read config file at ${configPath}: ${(error as Error).message}`);
      }
      console.warn('[WARNING] Continuing with default configuration...');
      // Continue to next location if current one fails to parse
      continue;
    }
  }

  return null;
}

function expandEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_, envVar) => {
    return process.env[envVar] || '';
  });
}

function validateUrl(url: string, fieldName: string): void {
  try {
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`${fieldName} must use HTTP or HTTPS protocol`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes(`${fieldName} must use HTTP or HTTPS protocol`)) {
      throw error;
    }
    throw new Error(`${fieldName} must be a valid URL (e.g., https://api.openai.com/v1)`);
  }
}

function validateLogLevel(level: string, fieldName: string): void {
  const validLevels = ['debug', 'info', 'warn', 'error'];
  if (!validLevels.includes(level)) {
    throw new Error(`${fieldName} must be one of: ${validLevels.join(', ')}`);
  }
}

function validateDatabasePath(path: string): void {
  // Check if path is absolute or starts with ~/
  if (!path.startsWith('/') && !path.startsWith('~/')) {
    throw new Error('Database path must be absolute or start with ~/');
  }
  
  // Check for dangerous characters
  const dangerousChars = ['..', '\0', '\r', '\n'];
  for (const char of dangerousChars) {
    if (path.includes(char)) {
      throw new Error('Database path contains invalid characters');
    }
  }
  
  // Check if it has a valid database extension or is a valid SQLite path
  const validExtensions = ['.db', '.sqlite', '.sqlite3'];
  const hasValidExtension = validExtensions.some(ext => path.endsWith(ext));
  
  if (!hasValidExtension && !path.includes('/')) {
    throw new Error('Database path must end with .db, .sqlite, or .sqlite3');
  }
}

export function loadConfig(): Config {
  // 1. Start with defaults
  const config: Config = {
    dbPath: expandHomePath('~/.agent-progress-mcp/data.db'),
    openai: {
      apiKey: '',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    },
    logLevel: 'info',
  };

  // 2. Load config file (if exists)
  const configFile = loadConfigFile();
  if (configFile) {
    if (configFile.dbPath) {
      config.dbPath = expandHomePath(configFile.dbPath);
    }
    
    if (configFile.openai) {
      if (configFile.openai.apiKey) {
        config.openai.apiKey = expandEnvVars(configFile.openai.apiKey);
      }
      if (configFile.openai.baseUrl) {
        config.openai.baseUrl = configFile.openai.baseUrl;
      }
      if (configFile.openai.model) {
        config.openai.model = configFile.openai.model;
      }
    }
    
    if (configFile.logging?.level) {
      config.logLevel = configFile.logging.level;
    }
  }

  // 3. Override with environment variables
  if (process.env.AGENT_PROGRESS_DB_PATH) {
    config.dbPath = expandHomePath(process.env.AGENT_PROGRESS_DB_PATH);
  }
  
  if (process.env.OPENAI_API_KEY) {
    config.openai.apiKey = process.env.OPENAI_API_KEY;
  }
  
  if (process.env.OPENAI_BASE_URL) {
    config.openai.baseUrl = process.env.OPENAI_BASE_URL;
  }
  
  if (process.env.AGENT_PROGRESS_MODEL) {
    config.openai.model = process.env.AGENT_PROGRESS_MODEL;
  }
  
  if (process.env.AGENT_PROGRESS_LOG_LEVEL) {
    const logLevel = process.env.AGENT_PROGRESS_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error';
    if (['debug', 'info', 'warn', 'error'].includes(logLevel)) {
      config.logLevel = logLevel;
    }
  }

  // 4. Validation
  if (!config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is required');
  }
  
  if (!config.openai.model) {
    throw new Error('Model name cannot be empty');
  }
  
  // URL format validation for baseUrl
  validateUrl(config.openai.baseUrl, 'OpenAI baseUrl');
  
  // Log level validation (for both config file and env var values)
  validateLogLevel(config.logLevel, 'Log level');
  
  // Database path format validation
  validateDatabasePath(config.dbPath);

  // 5. Ensure database directory is writable
  try {
    const dbDir = dirname(config.dbPath);
    if (!existsSync(dbDir)) {
      mkdirSync(dbDir, { recursive: true });
    }
    // Test writability by trying to create a file
    const testFile = config.dbPath + '.test';
    writeFileSync(testFile, 'test');
    unlinkSync(testFile);
  } catch (error) {
    throw new Error(`Database path is not writable: ${config.dbPath}`);
  }

  return config;
}
