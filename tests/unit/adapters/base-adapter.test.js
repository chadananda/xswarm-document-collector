import { describe, it, expect, beforeEach } from 'vitest';
import { BaseAdapter } from '../../../src/adapters/base-adapter.js';

// Test adapter implementation
class TestAdapter extends BaseAdapter {
  async initialize() {
    this.initialized = true;
  }

  async *fetchDocuments() {
    yield {
      id: 'doc1',
      title: 'Test Document',
      content: 'Test content',
      source: 'test',
      sourceId: 'test-1'
    };
  }
}

describe('BaseAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new TestAdapter({
      name: 'test',
      credentials: { token: 'test-token' },
      settings: { maxResults: 10 }
    });
  });

  describe('constructor', () => {
    it('initializes with options', () => {
      expect(adapter.name).toBe('test');
      expect(adapter.credentials).toEqual({ token: 'test-token' });
      expect(adapter.settings).toEqual({ maxResults: 10 });
      expect(adapter.rateLimiter).toBeTruthy();
    });

    it('uses default values', () => {
      const minimal = new TestAdapter({});
      expect(minimal.name).toBe('unnamed');
      expect(minimal.credentials).toEqual({});
      expect(minimal.settings).toEqual({});
    });
  });

  describe('initialize', () => {
    it('can be implemented by subclass', async () => {
      await adapter.initialize();
      expect(adapter.initialized).toBe(true);
    });

    it('throws if not implemented', async () => {
      const base = new BaseAdapter({ name: 'base' });
      await expect(base.initialize()).rejects.toThrow('must be implemented');
    });
  });

  describe('fetchDocuments', () => {
    it('returns async generator', async () => {
      const docs = [];
      for await (const doc of adapter.fetchDocuments()) {
        docs.push(doc);
      }
      expect(docs).toHaveLength(1);
      expect(docs[0].id).toBe('doc1');
    });

    it('throws if not implemented', async () => {
      const base = new BaseAdapter({ name: 'base' });
      await expect(async () => {
        for await (const doc of base.fetchDocuments()) {
          // Should throw before yielding
        }
      }).rejects.toThrow('must be implemented');
    });
  });

  describe('validate', () => {
    it('validates credentials exist', async () => {
      await expect(adapter.validate()).resolves.toBe(true);
    });

    it('throws on missing credentials', async () => {
      adapter.credentials = {};
      await expect(adapter.validate()).rejects.toThrow('Credentials required');
    });
  });

  describe('checkpoint', () => {
    it('gets and sets checkpoint', () => {
      expect(adapter.getCheckpoint()).toBeNull();

      adapter.setCheckpoint({ lastId: '123' });
      expect(adapter.getCheckpoint()).toEqual({ lastId: '123' });
    });

    it('emits checkpoint event', () => {
      return new Promise((resolve) => {
        adapter.on('checkpoint', (checkpoint) => {
          expect(checkpoint).toEqual({ lastId: '456' });
          resolve();
        });

        adapter.setCheckpoint({ lastId: '456' });
      });
    });
  });

  describe('events', () => {
    it('emits document event', () => {
      return new Promise((resolve) => {
        const doc = { id: 'test' };

        adapter.on('document', (emittedDoc) => {
          expect(emittedDoc).toEqual(doc);
          resolve();
        });

        adapter.emitDocument(doc);
      });
    });

    it('emits error event', () => {
      return new Promise((resolve) => {
        const error = new Error('Test error');

        adapter.on('error', ({ error: emittedError }) => {
          expect(emittedError).toBe(error);
          resolve();
        });

        adapter.emitError(error);
      });
    });

    it('emits progress event', () => {
      return new Promise((resolve) => {
        const stats = { processed: 10 };

        adapter.on('progress', (emittedStats) => {
          expect(emittedStats).toEqual(stats);
          resolve();
        });

        adapter.emitProgress(stats);
      });
    });
  });

  describe('executeWithRetry', () => {
    it('executes function successfully', async () => {
      const result = await adapter.executeWithRetry(async () => {
        return 'success';
      });

      expect(result).toBe('success');
    });

    it('retries on failure', async () => {
      let attempts = 0;

      const result = await adapter.executeWithRetry(async () => {
        attempts++;
        if (attempts < 2) {
          const error = new Error('Temporary failure');
          error.statusCode = 503;
          throw error;
        }
        return 'success';
      });

      expect(result).toBe('success');
      expect(attempts).toBe(2);
    });
  });
});
