# API Documentation

## Core Modules

### Database

```javascript
import { initDatabase, closeDatabase } from 'xswarm-document-collector';

// Initialize database
await initDatabase();

// Close database
await closeDatabase();
```

### Collections

```javascript
import {
  createCollection,
  getCollection,
  listCollections,
  updateCollection,
  deleteCollection
} from 'xswarm-document-collector';

// Create collection
const collection = await createCollection({
  name: 'My Gmail',
  adapter: 'gmail',
  credentials: { /* ... */ },
  settings: { maxResults: 100 },
  schedule: '0 * * * *', // Cron expression
  enabled: true
});

// Get collection by ID
const col = getCollection(collectionId);

// List collections
const collections = listCollections({
  adapter: 'gmail',  // Optional filter
  enabled: true      // Optional filter
});

// Update collection
await updateCollection(collectionId, {
  enabled: false,
  settings: { maxResults: 200 }
});

// Delete collection
await deleteCollection(collectionId);
```

### Credentials

```javascript
import {
  encryptCredentials,
  decryptCredentials,
  isEncryptionAvailable
} from 'xswarm-document-collector';

// Check if encryption is available
if (!isEncryptionAvailable()) {
  throw new Error('Set XSWARM_ENCRYPTION_KEY');
}

// Encrypt credentials
const encrypted = encryptCredentials({ token: 'secret' });

// Decrypt credentials
const decrypted = decryptCredentials(encrypted);
```

### Document Queue

```javascript
import { DocumentQueue } from 'xswarm-document-collector';

const queue = new DocumentQueue({ maxSize: 1000 });

// Enqueue document
queue.enqueue({
  id: 'doc-1',
  title: 'Document Title',
  content: 'Document content...',
  source: 'gmail'
});

// Dequeue document
const doc = queue.dequeue();

// Get queue size
const size = queue.size();

// Listen to events
queue.on('enqueued', (doc) => console.log('Added:', doc.id));
queue.on('dequeued', (doc) => console.log('Removed:', doc.id));
```

## Adapters

### Gmail

```javascript
import { GmailAdapter } from 'xswarm-document-collector/src/adapters/gmail.js';

const adapter = new GmailAdapter({
  credentials: {
    clientId: 'your-client-id',
    clientSecret: 'your-secret',
    refreshToken: 'your-refresh-token'
  },
  settings: {
    maxResults: 100,
    includeAttachments: true,
    maxAttachmentSize: 50 * 1024 * 1024,
    query: 'is:unread' // Gmail search query
  }
});

await adapter.initialize();

// Fetch all documents
for await (const doc of adapter.fetchDocuments()) {
  console.log(doc.title, doc.content);
}

// Incremental sync
for await (const doc of adapter.fetchIncremental()) {
  console.log('New/Updated:', doc.title);
}
```

## Utilities

### Encryption

```javascript
import { encrypt, decrypt, generateMasterKey } from 'xswarm-document-collector';

const key = generateMasterKey(); // Base64-encoded 256-bit key
const encrypted = encrypt('sensitive data', key);
const decrypted = decrypt(encrypted, key);
```

### Rate Limiting

```javascript
import { RateLimiter } from 'xswarm-document-collector';

const limiter = new RateLimiter({
  maxTokens: 100,
  refillRate: 10 // tokens per second
});

await limiter.acquire(5); // Wait for 5 tokens
```

### Retry

```javascript
import { retry, isRetryableError } from 'xswarm-document-collector';

const result = await retry(async () => {
  return fetchFromAPI();
}, {
  maxAttempts: 3,
  initialDelay: 1000,
  shouldRetry: isRetryableError
});
```
