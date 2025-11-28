export const CREATE_PROJECTS_TABLE = `CREATE TABLE IF NOT EXISTS projects (
  project_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);`;

export const CREATE_ENTRIES_TABLE = `CREATE TABLE IF NOT EXISTS log_entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  created_at TEXT NOT NULL,
  tags TEXT,
  agent_id TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(project_id)
);`;

export const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_entries_project ON log_entries(project_id);`,
  `CREATE INDEX IF NOT EXISTS idx_entries_created ON log_entries(created_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_entries_title ON log_entries(title);`
];

export const CREATE_ENTRY_TAGS_TABLE = `CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (entry_id, tag),
  FOREIGN KEY (entry_id) REFERENCES log_entries(id) ON DELETE CASCADE
);`;

export const CREATE_ENTRY_TAGS_INDEX = `CREATE INDEX IF NOT EXISTS idx_entry_tags_tag ON entry_tags(tag);`;
export const CREATE_ENTRY_TAGS_ENTRY_INDEX = `CREATE INDEX IF NOT EXISTS idx_entry_tags_entry ON entry_tags(entry_id);`;

export const PRAGMA_STATEMENTS = [
  'PRAGMA journal_mode=WAL;'
];