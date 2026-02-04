import initSqlJs from 'sql.js';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('state-manager');

function getDbPath() {
  return process.env.XSWARM_DB_PATH || './xswarm.db';
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  adapter TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  credentials_encrypted TEXT,
  settings TEXT,
  schedule TEXT,
  metadata TEXT,
  status TEXT DEFAULT 'configured',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  status TEXT NOT NULL,
  documents_discovered INTEGER DEFAULT 0,
  documents_extracted INTEGER DEFAULT 0,
  documents_indexed INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  checkpoint TEXT,
  FOREIGN KEY (collection_id) REFERENCES collections(id)
);

CREATE TABLE IF NOT EXISTS errors (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  details TEXT,
  occurred_at TEXT NOT NULL,
  FOREIGN KEY (run_id) REFERENCES runs(id)
);

CREATE INDEX IF NOT EXISTS idx_runs_collection ON runs(collection_id);
CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at);
CREATE INDEX IF NOT EXISTS idx_errors_run ON errors(run_id);
`;

let SQL = null;
let db = null;
let inTransaction = false;

/**
 * Initialize SQLite database
 */
export async function initDatabase() {
  const dbPath = getDbPath();

  // Close existing db if path changed
  if (db) {
    const currentPath = getDbPath();
    await closeDatabase();
  }

  logger.info({ path: dbPath }, 'Initializing database');

  if (!SQL) {
    SQL = await initSqlJs();
  }

  if (existsSync(dbPath)) {
    const data = await fs.readFile(dbPath);
    db = new SQL.Database(data);
    logger.info('Database loaded from disk');
  } else {
    db = new SQL.Database();
    logger.info('New database created');
  }

  db.run(SCHEMA);
  await saveDatabase();

  return db;
}

/**
 * Save database to disk
 */
export async function saveDatabase() {
  if (!db) throw new Error('Database not initialized');

  const dbPath = getDbPath();
  const data = db.export();
  const buffer = Buffer.from(data);

  const dir = path.dirname(dbPath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(dbPath, buffer);
}

/**
 * Execute query with parameters
 */
export function query(sql, params = []) {
  if (!db) throw new Error('Database not initialized');

  const stmt = db.prepare(sql);
  stmt.bind(params);

  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();

  return results;
}

/**
 * Execute statement (INSERT, UPDATE, DELETE)
 */
export async function execute(sql, params = []) {
  if (!db) throw new Error('Database not initialized');

  db.run(sql, params);

  // Only save if not in transaction
  if (!inTransaction) {
    await saveDatabase();
  }
}

/**
 * Get single row
 */
export function getOne(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

/**
 * Begin transaction
 */
export function beginTransaction() {
  if (!db) throw new Error('Database not initialized');
  db.run('BEGIN TRANSACTION');
  inTransaction = true;
}

/**
 * Commit transaction
 */
export async function commitTransaction() {
  if (!db) throw new Error('Database not initialized');
  db.run('COMMIT');
  inTransaction = false;
  await saveDatabase();
}

/**
 * Rollback transaction
 */
export function rollbackTransaction() {
  if (!db) throw new Error('Database not initialized');
  db.run('ROLLBACK');
  inTransaction = false;
}

/**
 * Close database connection
 */
export async function closeDatabase() {
  if (db) {
    await saveDatabase();
    db.close();
    db = null;
    logger.info('Database closed');
  }
}

/**
 * Get database instance
 */
export function getDatabase() {
  return db;
}
