# xswarm-document-collector

Terse, robust document collection framework with extensible connectors for Gmail, Drive, websites, Dropbox, Facebook, and academic repositories.

## Features

- **6 Built-in Adapters**: Gmail, Google Drive, Website scraper, Dropbox, Facebook, ArXiv
- **Encrypted Credentials**: AES-256-GCM encryption with master key
- **Incremental Sync**: Checkpoint-based resumption for efficient updates
- **Rate Limiting**: Token bucket algorithm prevents API quota exhaustion
- **Scheduled Collections**: Cron-based automated document collection
- **Document Extraction**: PDF, DOCX, XLSX text extraction
- **Content Sanitization**: PII and credential removal via xswarm-ai-sanitize
- **CLI Interface**: Full command-line management
- **ES6 Modules**: Modern JavaScript with async/await

## Installation

```bash
npm install -g xswarm-document-collector
```

## Quick Start

```bash
# Set encryption key (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
export XSWARM_ENCRYPTION_KEY="your-base64-key"

# Add a Gmail collection
xswarm-collect add gmail --name "My Gmail" --credentials gmail-creds.json --schedule "0 * * * *"

# List collections
xswarm-collect list

# Start scheduler
xswarm-collect schedule --start
```

## Credentials Format

### Gmail
```json
{
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "refreshToken": "your-refresh-token"
}
```

### Google Drive
```json
{
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "refreshToken": "your-refresh-token"
}
```

### Dropbox
```json
{
  "accessToken": "your-access-token"
}
```

### Facebook
```json
{
  "accessToken": "your-access-token"
}
```

## Programmatic Usage

```javascript
import { initDatabase, createCollection } from 'xswarm-document-collector';

await initDatabase();

const collection = await createCollection({
  name: 'My Collection',
  adapter: 'gmail',
  credentials: { /* ... */ },
  settings: { maxResults: 100 },
  schedule: '0 * * * *'
});
```

## Documentation

- [API Documentation](docs/API.md)
- [CLI Reference](docs/CLI.md)
- [Adapter Development](docs/ADAPTERS.md)

## Environment Variables

- `XSWARM_DB_PATH` - Database file path (default: `./xswarm.db`)
- `XSWARM_ENCRYPTION_KEY` - Master encryption key (base64, 32 bytes)
- `XSWARM_LOG_LEVEL` - Log level (default: `info`)
- `XSWARM_SANITIZE_ENDPOINT` - Sanitization service URL (default: `http://localhost:3000`)

## License

MIT
