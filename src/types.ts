export interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface Config {
  dbPath: string;
  openai: OpenAIConfig;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

export interface Project {
  projectId: string;
  name: string;
  createdAt: string;
}

export interface LogEntry {
  id: string;
  projectId: string;
  title: string;
  content: string;
  summary: string | null;
  createdAt: string;
  tags: string[];
  agentId: string | null;
}

export interface SearchParams {
  projectId: string;
  query?: string;
  tags?: string[];
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export interface SearchResult {
  entries: Pick<LogEntry, 'id' | 'title' | 'createdAt' | 'tags'>[];
  total: number;
}
