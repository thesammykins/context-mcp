#!/usr/bin/env node

import { ProgressStore } from '../build/storage/index.js';
import { createFallbackSummary } from '../build/summariser/index.js';

const store = new ProgressStore('/Users/samanthamyers/.agent-progress-mcp/data.db');

async function cleanupData() {
  try {
    console.log('Starting data cleanup...');
    
    // Get all entries without summaries
    const stmt = store.db.prepare(`
      SELECT id, project_id, title, content 
      FROM log_entries 
      WHERE summary IS NULL AND LENGTH(content) > 200
    `);
    
    const entries = stmt.all();
    console.log(`Found ${entries.length} entries without summaries`);
    
    let updated = 0;
    let errors = 0;
    
    for (const entry of entries) {
      try {
        // Generate intelligent fallback summary
        const summary = createFallbackSummary(entry.title, entry.content);
        
        // Update the entry
        store.updateSummary(entry.id, summary);
        updated++;
        
        console.log(`✅ Updated entry ${entry.id} with summary (${summary.length} chars)`);
      } catch (error) {
        console.error(`❌ Failed to update entry ${entry.id}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\nCleanup complete: ${updated} updated, ${errors} errors`);
    
  } catch (error) {
    console.error('Cleanup failed:', error);
  } finally {
    store.close();
  }
}

cleanupData();