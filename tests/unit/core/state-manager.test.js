import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { randomUUID } from 'crypto';
import {
  initDatabase,
  closeDatabase,
  query,
  execute,
  getOne,
  beginTransaction,
  commitTransaction,
  rollbackTransaction
} from '../../../src/core/state-manager.js';

describe('state-manager', () => {
  let testDbPath;

  beforeEach(async () => {
    testDbPath = `./test-xswarm-${randomUUID()}.db`;
    process.env.XSWARM_DB_PATH = testDbPath;
    if (existsSync(testDbPath)) {
      await unlink(testDbPath);
    }
    await initDatabase();
  });

  afterEach(async () => {
    await closeDatabase();
    if (existsSync(testDbPath)) {
      await unlink(testDbPath);
    }
  });

  describe('initDatabase', () => {
    it('creates database file', () => {
      expect(existsSync(testDbPath)).toBe(true);
    });

    it('creates schema tables', () => {
      const tables = query(
        "SELECT name FROM sqlite_master WHERE type='table'"
      );
      const tableNames = tables.map(t => t.name);

      expect(tableNames).toContain('collections');
      expect(tableNames).toContain('runs');
      expect(tableNames).toContain('errors');
    });
  });

  describe('query and execute', () => {
    it('inserts and queries data', async () => {
      await execute(
        'INSERT INTO collections (id, name, adapter, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['test-id', 'Test Collection', 'gmail', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z']
      );

      const results = query('SELECT * FROM collections WHERE id = ?', ['test-id']);
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Test Collection');
    });

    it('getOne returns single row', async () => {
      await execute(
        'INSERT INTO collections (id, name, adapter, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['test-id', 'Test', 'gmail', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z']
      );

      const row = getOne('SELECT * FROM collections WHERE id = ?', ['test-id']);
      expect(row).toBeTruthy();
      expect(row.name).toBe('Test');
    });

    it('getOne returns null if not found', () => {
      const row = getOne('SELECT * FROM collections WHERE id = ?', ['nonexistent']);
      expect(row).toBeNull();
    });
  });

  describe('transactions', () => {
    it('commits transaction', async () => {
      beginTransaction();

      await execute(
        'INSERT INTO collections (id, name, adapter, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['test-id', 'Test', 'gmail', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z']
      );

      await commitTransaction();

      const row = getOne('SELECT * FROM collections WHERE id = ?', ['test-id']);
      expect(row).toBeTruthy();
    });

    it('rolls back transaction', async () => {
      beginTransaction();

      await execute(
        'INSERT INTO collections (id, name, adapter, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        ['test-id', 'Test', 'gmail', '2024-01-01T00:00:00Z', '2024-01-01T00:00:00Z']
      );

      rollbackTransaction();

      const row = getOne('SELECT * FROM collections WHERE id = ?', ['test-id']);
      expect(row).toBeNull();
    });
  });
});
