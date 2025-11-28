import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import type { LogEntry, SearchParams, SearchResult } from '../types.js';
import { CREATE_PROJECTS_TABLE, CREATE_ENTRIES_TABLE, CREATE_INDEXES, CREATE_ENTRY_TAGS_TABLE, CREATE_ENTRY_TAGS_INDEX, CREATE_ENTRY_TAGS_ENTRY_INDEX, PRAGMA_STATEMENTS } from './schema.js';
import { DatabaseError, logError } from '../utils/index.js';

export class ProgressStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    try {
      // Ensure directory exists with restrictive permissions
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      }

      // Open database connection
      this.db = new Database(dbPath);

      // Apply PRAGMA settings with error handling
      try {
        for (const pragma of PRAGMA_STATEMENTS) {
          this.db.exec(pragma);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        logError(error, 'database', { operation: 'PRAGMA', dbPath });
        throw new DatabaseError(`Failed to apply database pragmas: ${error.message}`, { dbPath });
      }

      // Initialize schema (including migrations)
      this.initializeSchema();
      this.migrateSchema();
    } catch (err) {
      if (err instanceof DatabaseError) throw err;
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'system', { operation: 'ProgressStore.constructor', dbPath });
      throw new DatabaseError(`Failed to initialize database: ${error.message}`, { dbPath });
    }
  }

  private initializeSchema(): void {
    try {
      this.db.exec(CREATE_PROJECTS_TABLE);
      this.db.exec(CREATE_ENTRIES_TABLE);
      this.db.exec(CREATE_ENTRY_TAGS_TABLE);
      
      for (const index of CREATE_INDEXES) {
        this.db.exec(index);
      }
      
      for (const index of [CREATE_ENTRY_TAGS_INDEX, CREATE_ENTRY_TAGS_ENTRY_INDEX]) {
        this.db.exec(index);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'database', { operation: 'initializeSchema' });
      throw new DatabaseError(`Failed to initialize database schema: ${error.message}`);
    }
  }

  ensureProject(projectId: string): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO projects (project_id, name, created_at) 
        VALUES (?, ?, ?);
      `);
      
      stmt.run(projectId, projectId, new Date().toISOString());
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'database', { operation: 'ensureProject', projectId });
      throw new DatabaseError(`Failed to ensure project exists: ${error.message}`, { projectId });
    }
  }

  projectExists(projectId: string): boolean {
    try {
      const stmt = this.db.prepare(`
        SELECT 1 FROM projects WHERE project_id = ? LIMIT 1;
      `);
      
      const result = stmt.get(projectId);
      return result !== undefined;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'database', { operation: 'projectExists', projectId });
      throw new DatabaseError(`Failed to check project existence: ${error.message}`, { projectId });
    }
  }

  createEntry(entry: Omit<LogEntry, 'summary'>): LogEntry {
    try {
      // Generate ID if not provided or ensure it's 12 chars
      const id = entry.id && entry.id.length === 12 ? entry.id : nanoid(12);
      
      const stmt = this.db.prepare(`
        INSERT INTO log_entries (id, project_id, title, content, summary, created_at, tags, agent_id) 
        VALUES (?, ?, ?, ?, NULL, ?, ?, ?);
      `);
      
      stmt.run(
        id,
        entry.projectId,
        entry.title,
        entry.content,
        entry.createdAt,
        JSON.stringify(entry.tags),
        entry.agentId
      );

      // Add tags to normalized table
      if (entry.tags && entry.tags.length > 0) {
        this.addTags(id, entry.tags);
      }

      return {
        id,
        projectId: entry.projectId,
        title: entry.title,
        content: entry.content,
        summary: null,
        createdAt: entry.createdAt,
        tags: entry.tags,
        agentId: entry.agentId,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'database', { operation: 'createEntry', projectId: entry.projectId });
      
      // Check for constraint violations
      if (error.message.includes('UNIQUE') || error.message.includes('CONSTRAINT')) {
        throw new DatabaseError(`Entry with ID already exists`, {
          projectId: entry.projectId,
          entryId: entry.id,
        });
      }
      
      throw new DatabaseError(`Failed to create entry: ${error.message}`, {
        projectId: entry.projectId,
      });
    }
  }

  getEntry(projectId: string, id: string): LogEntry | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM log_entries 
        WHERE project_id = ? AND id = ?;
      `);
      
      const row = stmt.get(projectId, id) as any;
      
      if (!row) {
        return null;
      }

      return {
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        content: row.content,
        summary: row.summary,
        createdAt: row.created_at,
        tags: row.tags ? JSON.parse(row.tags) : [],
        agentId: row.agent_id,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'database', { operation: 'getEntry', projectId, entryId: id });
      throw new DatabaseError(`Failed to retrieve entry: ${error.message}`, {
        projectId,
        entryId: id,
      });
    }
  }

  updateSummary(id: string, summary: string): void {
    try {
      const stmt = this.db.prepare(`
        UPDATE log_entries SET summary = ? WHERE id = ?;
      `);
      
      stmt.run(summary, id);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'database', { operation: 'updateSummary', entryId: id });
      throw new DatabaseError(`Failed to update summary: ${error.message}`, { entryId: id });
    }
  }

  searchEntries(params: SearchParams): SearchResult {
    try {
      let query = `
        SELECT id, project_id, title, created_at, tags 
        FROM log_entries 
        WHERE project_id = ?
      `;
      
      const queryParams: any[] = [params.projectId];

      // Add title search filter
      if (params.query) {
        query += ` AND LOWER(title) LIKE LOWER(?)`;
        queryParams.push(`%${params.query}%`);
      }

      // Add date range filters
      if (params.startDate) {
        query += ` AND created_at >= ?`;
        queryParams.push(params.startDate);
      }

      if (params.endDate) {
        query += ` AND created_at <= ?`;
        queryParams.push(params.endDate);
      }

       // Add tags filter (use efficient normalized tag search)
       if (params.tags && params.tags.length > 0) {
         // Use the new searchByTags method for efficient tag queries
         const tagResults = this.searchByTags(params.projectId, params.tags);
         
         // If we have tag results, use them; otherwise continue with other filters
         if (tagResults.length > 0) {
           return {
             entries: tagResults,
             total: tagResults.length,
           };
         }
       }

      // Add ordering and limit
      query += ` ORDER BY created_at DESC`;
      
      if (params.limit) {
        query += ` LIMIT ?`;
        queryParams.push(params.limit);
      }

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...queryParams) as any[];

      // Get total count (without limit)
      let countQuery = `
        SELECT COUNT(*) as total 
        FROM log_entries 
        WHERE project_id = ?
      `;
      
      const countParams: any[] = [params.projectId];

      if (params.query) {
        countQuery += ` AND LOWER(title) LIKE LOWER(?)`;
        countParams.push(`%${params.query}%`);
      }

      if (params.startDate) {
        countQuery += ` AND created_at >= ?`;
        countParams.push(params.startDate);
      }

      if (params.endDate) {
        countQuery += ` AND created_at <= ?`;
        countParams.push(params.endDate);
      }

      if (params.tags && params.tags.length > 0) {
        for (const tag of params.tags) {
          countQuery += ` AND tags LIKE ?`;
          countParams.push(`%"${tag}"%`);
        }
      }

      const countStmt = this.db.prepare(countQuery);
      const countResult = countStmt.get(...countParams) as { total: number };

      return {
        entries: rows.map(row => ({
          id: row.id,
          projectId: row.project_id,
          title: row.title,
          createdAt: row.created_at,
        tags: this.getTags(row.id),
        })),
        total: countResult.total,
      };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'database', { operation: 'searchEntries', projectId: params.projectId });
      throw new DatabaseError(`Failed to search entries: ${error.message}`, {
        projectId: params.projectId,
      });
    }
  }

  close(): void {
    try {
      this.db.close();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'system', { operation: 'close' });
      // Don't throw here - this is cleanup
    }
  }

  private migrateSchema(): void {
    try {
      // Check if entry_tags table exists
      const tableCheck = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='entry_tags'
      `);
      const result = tableCheck.get() as any;
      
      if (!result) {
        console.error('[MIGRATION] Creating entry_tags table for normalized tag storage');
        this.db.exec(CREATE_ENTRY_TAGS_TABLE);
        
        // Create indexes for tag table
        this.db.exec(CREATE_ENTRY_TAGS_INDEX);
        this.db.exec(CREATE_ENTRY_TAGS_ENTRY_INDEX);
        
        // Migrate existing JSON tags to normalized format
        const migrateStmt = this.db.prepare(`
          SELECT id, tags FROM log_entries WHERE tags IS NOT NULL AND tags != '[]'
        `);
        const entriesWithTags = migrateStmt.all() as any[];
        
        for (const entry of entriesWithTags) {
          try {
            const tags = JSON.parse(entry.tags);
            if (Array.isArray(tags) && tags.length > 0) {
              this.addTags(entry.id, tags);
            }
          } catch (err) {
            console.error(`[MIGRATION] Failed to migrate tags for entry ${entry.id}:`, err);
          }
        }
        
        console.error(`[MIGRATION] Migrated ${entriesWithTags.length} entries to normalized tag storage`);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'database', { operation: 'migrateSchema' });
    }
  }

  // Tag management methods for efficient tag storage
  addTags(entryId: string, tags: string[]): void {
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO entry_tags (entry_id, tag) VALUES (?, ?)
      `);
      
      for (const tag of tags) {
        stmt.run(entryId, tag);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'database', { operation: 'addTags', entryId });
      throw new DatabaseError(`Failed to add tags: ${error.message}`, { entryId });
    }
  }

  getTags(entryId: string): string[] {
    try {
      const stmt = this.db.prepare(`
        SELECT tag FROM entry_tags WHERE entry_id = ? ORDER BY tag
      `);
      
      const rows = stmt.all(entryId) as any[];
      return rows.map((row: any) => row.tag);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'database', { operation: 'getTags', entryId });
      return [];
    }
  }

  searchByTags(projectId: string, tags: string[]): LogEntry[] {
    try {
      // Build a query that finds entries with ALL specified tags
      const tagPlaceholders = tags.map(() => '?').join(',');
      const tagConditions = tags.map(() => 'EXISTS (SELECT 1 FROM entry_tags WHERE entry_id = le.id AND tag = ?)').join(' AND ');
      
      const query = `
        SELECT DISTINCT le.* FROM log_entries le
        WHERE le.project_id = ?
          AND (${tagConditions})
        ORDER BY le.created_at DESC
      `;
      
      const stmt = this.db.prepare(query);
      const rows = stmt.all(projectId, ...tags) as any[];
      
      return rows.map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        title: row.title,
        content: row.content,
        summary: row.summary,
        createdAt: row.created_at,
        tags: this.getTags(row.id),
        agentId: row.agent_id,
      }));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logError(error, 'database', { operation: 'searchByTags', projectId, tags });
      throw new DatabaseError(`Failed to search by tags: ${error.message}`, { projectId, tags });
    }
  }
}
