# Adapter Development Guide

## Creating a Custom Adapter

All adapters extend `BaseAdapter` and implement:

1. `initialize()` - Setup authentication and validate credentials
2. `fetchDocuments()` - Async generator that yields documents

## Minimal Example

```javascript
import { BaseAdapter } from 'xswarm-document-collector/src/adapters/base-adapter.js';

export class MyAdapter extends BaseAdapter {
  async initialize() {
    // Validate credentials
    if (!this.credentials.apiKey) {
      throw new Error('apiKey required');
    }

    // Setup API client
    this.client = new APIClient(this.credentials.apiKey);
  }

  async *fetchDocuments() {
    // Fetch documents from source
    const items = await this.executeWithRetry(async () => {
      return this.client.list();
    });

    // Yield documents in standard format
    for (const item of items) {
      yield {
        id: `my-adapter-${item.id}`,
        title: item.title,
        content: item.content,
        source: 'my-adapter',
        sourceId: item.id,
        url: item.url,
        metadata: {},
        mimeType: 'text/plain',
        createdAt: new Date(item.created),
        modifiedAt: new Date(item.modified),
        attachments: []
      };
    }
  }
}
```

## Document Format

```javascript
{
  id: string,              // Unique ID (prefix with adapter name)
  title: string,           // Document title
  content: string,         // Text content (sanitized)
  source: string,          // Adapter name
  sourceId: string,        // Original ID from source
  url: string,             // Link to original
  metadata: object,        // Additional metadata
  mimeType: string,        // MIME type
  createdAt: Date,         // Creation timestamp
  modifiedAt: Date,        // Modification timestamp
  attachments: Array       // Document attachments
}
```

## BaseAdapter Features

### Rate Limiting

```javascript
// Automatically rate-limited
await this.executeWithRetry(async () => {
  return this.api.fetch();
});
```

### Checkpointing

```javascript
// Save checkpoint for incremental sync
this.setCheckpoint({ pageToken: 'abc123' });

// Resume from checkpoint
const lastToken = this.checkpoint?.pageToken;
```

### Events

```javascript
// Emit progress
this.emitProgress({ processed: 10, total: 100 });

// Emit errors
this.emitError(error, { context: 'fetching item 5' });

// Emit documents
this.emitDocument(document);
```

### Logging

```javascript
this.logger.info('Starting fetch');
this.logger.warn('Rate limit approaching');
this.logger.error({ error }, 'Failed to fetch');
```

## Configuration

### Constructor Options

```javascript
const adapter = new MyAdapter({
  id: 'collection-id',
  name: 'My Collection',
  credentials: {
    apiKey: 'key',
    secret: 'secret'
  },
  settings: {
    maxResults: 100,
    customOption: 'value'
  },
  rateLimit: {
    maxTokens: 100,
    refillRate: 10
  },
  checkpoint: { lastId: '123' }
});
```

## Best Practices

1. **Always use `executeWithRetry`** for API calls
2. **Save checkpoints frequently** for resumable sync
3. **Validate credentials** in `initialize()`
4. **Emit progress events** for long operations
5. **Handle rate limits** gracefully
6. **Sanitize content** before yielding documents
7. **Use consistent ID format** (`adapter-sourceId`)
8. **Log errors** with context

## Testing

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { MyAdapter } from './my-adapter.js';

describe('MyAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new MyAdapter({
      credentials: { apiKey: 'test' },
      settings: { maxResults: 10 }
    });
  });

  it('initializes correctly', async () => {
    await adapter.initialize();
    expect(adapter.client).toBeTruthy();
  });

  it('fetches documents', async () => {
    await adapter.initialize();

    const docs = [];
    for await (const doc of adapter.fetchDocuments()) {
      docs.push(doc);
    }

    expect(docs.length).toBeGreaterThan(0);
    expect(docs[0]).toHaveProperty('id');
    expect(docs[0]).toHaveProperty('content');
  });
});
```
