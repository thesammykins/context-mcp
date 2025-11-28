import Database from 'better-sqlite3';
import { nanoid } from 'nanoid';
import fs from 'fs';
import path from 'path';
import type { LogEntry, SearchParams, SearchResult } from '../types.js';
import { CREATE_PROJECTS_TABLE, CREATE_ENTRIES_TABLE, CREATE_INDEXES, PRAGMA_STATEMENTS } from './schema.js';
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

      // Initialize schema
      this.initializeSchema();
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
      
      for (const index of CREATE_INDEXES) {
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

      // Add tags filter (AND logic)
      if (params.tags && params.tags.length > 0) {
        for (const tag of params.tags) {
          query += ` AND tags LIKE ?`;
          queryParams.push(`%"${tag}"%`);
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
          tags: row.tags ? JSON.parse(row.tags) : [],
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
}
