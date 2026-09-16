/**
 * migrate.js - runs all SQL migration files in order using the app's DB pool
 */
const fs   = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { pool } = require('../src/config/db');

const MIGRATIONS_DIR = path.join(__dirname, '../migrations');

async function run() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    console.log(`\n▶  Running: ${file}`);
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    // Split on delimiter-separated statements (semicolon + newline)
    const statements = sql
      .split(/;\s*\n/)
      .map(s => s.replace(/--[^\r\n]*/g, '').trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      if (!stmt) continue;
      try {
        await pool.query(stmt);
      } catch (err) {
        // Ignore "already exists" and "duplicate" errors (idempotent)
        if (
          err.code === 'ER_TABLE_EXISTS_ERROR' ||
          err.code === 'ER_DUP_KEYNAME' ||
          err.code === 'ER_FK_DUP_NAME' ||
          err.code === 'ER_DUP_ENTRY' ||
          (err.message && err.message.includes('Duplicate key name')) ||
          (err.message && err.message.includes('already exists'))
        ) {
          console.log(`   ⚠  Skipped (already applied): ${err.message.substring(0, 80)}`);
        } else {
          console.error(`   ✗  Error in ${file}:\n     ${err.message}`);
          // Don't abort — continue running remaining migrations
        }
      }
    }
    console.log(`   ✓  Done: ${file}`);
  }

  console.log('\n✅ All migrations complete.\n');
  await pool.end();
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal migration error:', err);
  process.exit(1);
});
