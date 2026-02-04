import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { initDatabase, closeDatabase } from '../../../src/core/state-manager.js';
import {
  createCollection,
  getCollection,
  getCollectionByName,
  listCollections,
  updateCollection,
  deleteCollection,
  getCollectionCredentials
} from '../../../src/core/collection-manager.js';
import { generateMasterKey } from '../../../src/utils/crypto.js';
import { randomUUID } from 'crypto';

describe('collection-manager', () => {
  let testDbPath;

  beforeEach(async () => {
    testDbPath = `./test-collections-${randomUUID()}.db`;
    process.env.XSWARM_DB_PATH = testDbPath;
    process.env.XSWARM_ENCRYPTION_KEY = generateMasterKey();

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

  describe('createCollection', () => {
    it('creates collection with required fields', async () => {
      const collection = await createCollection({
        name: 'Test Gmail',
        adapter: 'gmail'
      });

      expect(collection).toBeTruthy();
      expect(collection.id).toBeTruthy();
      expect(collection.name).toBe('Test Gmail');
      expect(collection.adapter).toBe('gmail');
      expect(collection.enabled).toBe(true);
      expect(collection.status).toBe('configured');
    });

    it('creates collection with credentials', async () => {
      const credentials = { clientId: 'test', clientSecret: 'secret' };

      const collection = await createCollection({
        name: 'Test',
        adapter: 'gmail',
        credentials
      });

      expect(collection.credentials_encrypted).toBeTruthy();

      const decrypted = getCollectionCredentials(collection.id);
      expect(decrypted).toEqual(credentials);
    });

    it('creates collection with settings and metadata', async () => {
      const collection = await createCollection({
        name: 'Test',
        adapter: 'gmail',
        settings: { maxResults: 100 },
        metadata: { description: 'Test collection' },
        schedule: '0 * * * *'
      });

      expect(collection.settings).toEqual({ maxResults: 100 });
      expect(collection.metadata).toEqual({ description: 'Test collection' });
      expect(collection.schedule).toBe('0 * * * *');
    });

    it('throws on missing required fields', async () => {
      await expect(createCollection({ name: 'Test' })).rejects.toThrow();
      await expect(createCollection({ adapter: 'gmail' })).rejects.toThrow();
    });
  });

  describe('getCollection', () => {
    it('retrieves collection by ID', async () => {
      const created = await createCollection({
        name: 'Test',
        adapter: 'gmail'
      });

      const retrieved = getCollection(created.id);
      expect(retrieved).toEqual(created);
    });

    it('returns null for nonexistent ID', () => {
      const result = getCollection('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getCollectionByName', () => {
    it('retrieves collection by name', async () => {
      const created = await createCollection({
        name: 'Unique Name',
        adapter: 'gmail'
      });

      const retrieved = getCollectionByName('Unique Name');
      expect(retrieved.id).toBe(created.id);
    });
  });

  describe('listCollections', () => {
    it('lists all collections', async () => {
      await createCollection({ name: 'Test 1', adapter: 'gmail' });
      await createCollection({ name: 'Test 2', adapter: 'drive' });

      const collections = listCollections();
      expect(collections).toHaveLength(2);
    });

    it('filters by adapter', async () => {
      await createCollection({ name: 'Gmail 1', adapter: 'gmail' });
      await createCollection({ name: 'Drive 1', adapter: 'drive' });

      const gmailCollections = listCollections({ adapter: 'gmail' });
      expect(gmailCollections).toHaveLength(1);
      expect(gmailCollections[0].adapter).toBe('gmail');
    });

    it('filters by enabled status', async () => {
      await createCollection({ name: 'Enabled', adapter: 'gmail', enabled: true });
      await createCollection({ name: 'Disabled', adapter: 'gmail', enabled: false });

      const enabled = listCollections({ enabled: true });
      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe('Enabled');
    });
  });

  describe('updateCollection', () => {
    it('updates collection fields', async () => {
      const collection = await createCollection({
        name: 'Original',
        adapter: 'gmail'
      });

      const updated = await updateCollection(collection.id, {
        name: 'Updated',
        enabled: false
      });

      expect(updated.name).toBe('Updated');
      expect(updated.enabled).toBe(false);
    });

    it('updates credentials', async () => {
      const collection = await createCollection({
        name: 'Test',
        adapter: 'gmail',
        credentials: { old: 'creds' }
      });

      await updateCollection(collection.id, {
        credentials: { new: 'creds' }
      });

      const creds = getCollectionCredentials(collection.id);
      expect(creds).toEqual({ new: 'creds' });
    });

    it('throws on nonexistent collection', async () => {
      await expect(updateCollection('nonexistent', { name: 'Test' }))
        .rejects.toThrow();
    });
  });

  describe('deleteCollection', () => {
    it('deletes collection', async () => {
      const collection = await createCollection({
        name: 'To Delete',
        adapter: 'gmail'
      });

      await deleteCollection(collection.id);

      const result = getCollection(collection.id);
      expect(result).toBeNull();
    });

    it('throws on nonexistent collection', async () => {
      await expect(deleteCollection('nonexistent')).rejects.toThrow();
    });
  });
});
