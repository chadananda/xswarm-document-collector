# xSwarm Document Collector - PRD

**Version**: 1.0 | **Date**: Feb 3, 2026 | **Author**: Chad Jones

## Overview

Document collection framework that fetches content from diverse online sources (email, cloud storage, websites, social media, academic repos) and delivers it to xSwarm's document retrieval system. Each source configured as a monitored "collection" with independent auth, scheduling, and filtering.

**Architecture Position**: The collector is the "fetch once" layer - it efficiently retrieves documents from external sources and hands them to the indexer for local storage. The indexer (xswarm-document-retrieval) then ingests and runs multiple analysis passes (OCR improvement, entity extraction, summarization) over the locally stored copies without hitting external APIs repeatedly. This separation minimizes API costs while enabling unlimited downstream AI processing.

**Integration Points**:
- **Input**: External sources (Gmail API, Google Drive API, websites, etc.)
- **Sanitization**: xswarm-ai-sanitize (removes injection attacks)
- **Output**: xswarm-document-retrieval (Meilisearch-based indexing and multi-pass analysis)
- **LLM Gateway**: liteLLM-based routing for cost-effective AI operations

## Core Concepts

**Collection**: Monitored data source (gmail account, drive folder, website, research query) with unique ID, adapter type, credentials, traversal config, update schedule, and metadata tags.

**Adapter**: Pluggable module implementing standard interface for source-specific authentication, traversal, extraction, and change detection.

**Document**: Extracted content unit with source metadata, sanitized text, attachments, and context (thread, folder, URL path).

## Primary Use Cases

- **Email Context**: Index work Gmail for AI assistant to reference threads and attachments
- **Research Monitoring**: Track ArXiv papers, auto-extract PDFs, enable citation-based queries
- **Website Archive**: Scrape educational site for AI-powered search
- **Cross-Source Research**: Synthesize from Drive docs, websites, and email threads
- **Social Analysis**: Ingest Facebook posts/comments for engagement analysis

## Functional Requirements

### Collection Management
- Create/update/delete collections via CLI or API (unique ID, name, adapter type, credentials, settings, schedule, tags, enabled state)
- Lifecycle states: configured, active, paused, error, archived
- Secure credential storage with encryption at rest (OAuth2, API keys, basic auth)
- Custom metadata (tags, categories, priority) propagates to all extracted documents
- List/filter collections by adapter type, tags, or status with statistics

### Adapter Framework
- Standard interface: `authenticate()`, `traverse()`, `extract()`, `detectChanges()`, `extractAttachments()`, `getMetadataSchema()`
- Base adapter class provides rate limiting, error handling, progress reporting
- Dynamic adapter registration via plugin pattern
- Checkpoint-based incremental updates (adapter-specific checkpoint format)
- Change detection using source-specific mechanisms (timestamps, version IDs, hashes, API change logs)
- Exponential backoff retry for transient errors, logging for persistent errors

### Data Extraction
- Extract to standard schema: ID, source metadata, text content, author/timestamp, context, content type
- Separate attachment extraction with filename, MIME type, size, parent reference
- Text extraction from PDFs, DOCX, XLSX
- All content → xswarm-ai-sanitize before indexing (quarantine on sanitization failure)
- Format normalization (HTML→text, thread segmentation, nested structure flattening)
- Optional content-hash based deduplication across collections

### Scheduling & Updates
- Cron-based scheduling per collection, prevent overlapping runs
- Manual trigger option bypassing rate limits with real-time progress
- Incremental updates via checkpoint-based change detection
- Full re-scan option when checkpoint corrupted
- Log: start/end time, documents discovered/extracted/indexed, errors, checkpoint state
- Configurable rate limits per adapter type with exponential backoff

### Indexing Integration
- Document queue for xswarm-document-retrieval consumption
- Configurable batch sizes for throughput optimization
- Retry failed batches with exponential backoff
- Status feedback loop for indexing success/failure
- Collection metadata propagates to index for filtered searches

## Technical Requirements

**Architecture**: Node.js ES6+ monorepo package, async/await, functional style, no React. Clean API for sanitize/retrieval integration.

**Storage**: SQLite for configs/state, encrypted credentials via system keychain or encrypted columns.

**Adapters**: ES6 classes extending BaseAdapter, dynamic loading via import(), adapter discovery from configured directory.

**Logging**: Structured logs (winston/pino), levels: debug/info/warn/error, separate system vs adapter logs.

**Dependencies**: Minimal "boring stack" - simple-oauth2, better-sqlite3, node-fetch, cheerio, pdf-parse, node-cron.

**Performance**: Concurrent collection processing, streaming for large batches, memory-safe with configurable batch sizes. Targets: 100+ collections, 1M+ documents, 10K+ docs/update, months uptime.

**Security**: AES-256 credential encryption, mandatory sanitization (no bypass), audit logging, HTTPS-only API, rate limiting.

## Adapter Specifications

### Gmail
**Implementation**: Built on `googleapis` npm package (official Gmail API v1 client)

- OAuth2 with auto token refresh, service account delegation support
- Label-based filtering (inbox, sent, custom labels), date range queries
- Thread extraction as individual messages, preserve thread metadata
- Attachment download (configurable size limit), text extraction from docs
- Incremental sync via Gmail History API (historyId checkpointing)
- Rate limiting: 250 quota units/user/sec, exponential backoff

### Google Drive
**Implementation**: Built on `googleapis` npm package (official Drive API v3 client)
- OAuth2 (drive.readonly scope), service account support
- Recursive folder traversal (configurable depth), MIME type/size/date filtering
- Export Google Docs/Sheets/Slides to text formats, download native files
- Extract comments/suggestions with author/timestamp
- Track file modification times for change detection
- Respect sharing permissions (owner, viewer, editor context)

### Website Scraper
- Parse XML sitemaps for URL discovery, fall back to link crawling
- Strict robots.txt compliance, honor crawl-delay
- Readability algorithm for main content extraction, remove boilerplate
- Internal link following (configurable depth), URL normalization
- Polite crawling: 1 sec default delay, reduce on errors
- Optional JS rendering via Playwright/Puppeteer (configurable)

### Dropbox
- OAuth2 with long-lived refresh tokens
- Recursive folder traversal with path filtering
- Delta sync via list_folder/continue API
- Resumable downloads for large files, respect shared folder permissions

### Facebook
- OAuth2 with long-lived user tokens (pages_read_engagement, groups_access_member_info)
- Extract posts, comments, reactions from managed pages
- Group content from member groups, respect privacy settings
- Strict Graph API rate limit adherence, exponential backoff

### Academic Repositories
- **ArXiv**: Query by category/keywords/date, download PDFs, extract text, preserve metadata (authors, abstract, DOI)
- **PubMed**: Search PMC for open access, extract abstracts/full text, preserve MeSH terms
- **CrossRef**: DOI lookup, metadata enrichment, link to publisher full text

## Non-Functional Requirements

**Reliability**: Continuous operation, graceful transient failure handling, resumable from checkpoints, no data loss on restart.

**Usability**: Clear JSON/CLI configuration, easy status/log access, actionable error messages, comprehensive docs.

**Code Quality**: Compact functional ES6+ style per user prefs, no React, unit tests for core/base adapter, stable adapter interface.

**Compatibility**: Linux/macOS primary, Windows secondary, Node.js LTS (20.x, 22.x).

## Design Rationale

**Collections**: Different sources have different update patterns and access requirements. Collections enable independent configuration per source.

**Sanitization Boundary**: Separate mandatory sanitization protects against AI injection from user content before indexing.

**SQLite**: Structured storage without server dependency, portable, sufficient for scale (100s of collections).

**Adapter Pattern**: Source-specific logic isolated, enables community contributions without core changes.

**Checkpoints**: Efficient incremental updates avoid re-indexing everything, enable continuous monitoring.

## Implementation Phases

**Phase 1: Core Framework (3-4 weeks)**
Collection manager (CRUD), SQLite storage, credential encryption, BaseAdapter + utilities, scheduling, xswarm-ai-sanitize integration, document queue, Gmail adapter, basic CLI, unit tests.

**Phase 2: Essential Adapters (3-4 weeks)**
Google Drive, website scraper, Dropbox adapters. Enhanced error handling/retry, monitoring CLI, attachment improvements, integration testing, performance optimization.

**Phase 3: Social & Academic (2-3 weeks)**
Facebook, ArXiv, PubMed adapters. Rate limiting enhancements, advanced filtering, comprehensive docs, example configs.

**Phase 4: Production Polish (2-3 weeks)**
Production monitoring/alerting, graceful shutdown, config migration, security audit, performance benchmarks, backup/recovery, programmatic API, community plugin system.

## Implementation Example

Here's how clean adapter implementation is with googleapis:

```javascript
import {google} from 'googleapis'
import BaseAdapter from './base-adapter.js'

class GmailAdapter extends BaseAdapter {
  async authenticate() {
    const auth = new google.auth.OAuth2(
      this.config.credentials.clientId,
      this.config.credentials.clientSecret,
      this.config.credentials.redirectUri
    )
    auth.setCredentials({refresh_token: this.config.credentials.refreshToken})
    this.gmail = google.gmail({version: 'v1', auth})
    this.authenticated = true
  }

  async traverse(checkpoint = null) {
    const {historyId} = checkpoint || {}
    // Incremental via History API if we have checkpoint
    const res = historyId
      ? await this.gmail.users.history.list({userId: 'me', startHistoryId: historyId})
      : await this.gmail.users.messages.list({userId: 'me', maxResults: 100, labelIds: this.config.settings.labels})

    const messageIds = historyId
      ? res.data.history?.flatMap(h => h.messages?.map(m => m.id) || []) || []
      : res.data.messages?.map(m => m.id) || []

    return {
      documents: messageIds.map(id => ({id, sourceType: 'gmail'})),
      checkpoint: {historyId: res.data.historyId}
    }
  }

  async extract(documentIds) {
    const docs = await Promise.all(
      documentIds.map(id => this.gmail.users.messages.get({userId: 'me', id, format: 'full'}))
    )
    return docs.map(res => this.normalizeMessage(res.data))
  }
  // ... rest of implementation
}
```

The official Google libraries handle OAuth refresh, API quirks, and rate limiting - you just implement your business logic.

## Key Risks

- **API Rate Limiting**: Conservative defaults, exponential backoff, clear quota docs
- **OAuth Token Expiration**: Auto-refresh, clear re-auth flow, expiration monitoring
- **Large Attachments**: Configurable size limits (50MB default), streaming, metadata-only option
- **Scraper Legal/Technical**: Strict robots.txt compliance, manual allowlist option, CAPTCHA handling
- **Sanitization Bypass**: Non-optional in code, unit tests, quarantine failures
- **Credential Leakage**: Encryption at rest, never log, audit access, keychain integration

## Success Metrics

**MVP Launch**: Gmail + Drive + scraper adapters working end-to-end with incremental sync, sanitization, indexing. 10+ collections, 30 days stable operation, comprehensive docs.

**3-Month Goals**: 5+ adapter types, 100K+ documents indexed, 80%+ efficiency from incremental updates, 95%+ auto-recovery from transient errors.

**6-Month Goals**: Community-contributed adapters, zero security incidents, user satisfaction with config/observability.

## Open Questions

1. **Attachment limits**: 50MB default, configurable per collection, metadata-only for larger?
2. **Deduplication**: Index separately with hashes (default) or dedupe in retrieval layer?
3. **Webhooks**: Defer to Phase 3+ (polling sufficient for MVP)
4. **Multi-tenancy**: Single-user initially, design for extension (user_id column or separate DBs)
5. **Deployment**: Local-first (SQLite), cloud-ready (env-based secrets)
6. **Batch failures**: Continue batch, log failures, provide retry for failed docs
7. **Credential sharing**: Support credential profiles for reuse across collections
8. **Historical limits**: Configurable per collection (6 months email default, unlimited Drive)
9. **Chunking**: Leave to retrieval system (connector does extraction only)
10. **Progress reporting**: Emit events, store last state in DB

## Appendix: Core Schemas

### Document Schema
```javascript
{
  id: "collection-id:source-id", // unique identifier
  collectionId: "gmail-work",
  sourceType: "gmail", // adapter name
  sourceId: "msg-123", // source-specific ID
  url: "https://...", // link to original
  title: "Document title",
  content: "Sanitized text...",
  contentType: "email|document|webpage|social-post|paper",
  author: {name: "...", email: "...", id: "..."},
  timestamp: "2026-01-15T10:30:00Z",
  context: {/* adapter-specific: threadId, labels, folderId, urlPath, etc */},
  attachments: [{id, filename, mimeType, size, content, checksum}],
  metadata: {tags: [], priority: "", project: ""},
  checksum: "sha256-...",
  processing: {extractedAt, sanitizedAt, sanitizationPassed, indexedAt}
}
```

### Collection Config
```javascript
{
  id: "gmail-work-inbox",
  name: "Work Email - Inbox",
  adapter: "gmail",
  enabled: true,
  credentials: {type: "oauth2", oauth_token: "encrypted", oauth_refresh: "encrypted"},
  settings: {/* adapter-specific: labels, folders, filters, limits */},
  schedule: "*/30 * * * *", // cron
  metadata: {tags: [], description: "", priority: "", category: ""},
  state: {
    status: "active|paused|error|archived",
    lastRun: "2026-02-03T14:00:00Z",
    checkpoint: {/* adapter-specific */},
    statistics: {documentsIndexed, attachmentsProcessed, lastRunDocuments, errorCount}
  },
  createdAt: "2025-11-01T10:00:00Z",
  updatedAt: "2026-02-03T14:00:00Z"
}
```

### BaseAdapter Interface
```javascript
class BaseAdapter {
  constructor(config) {} // initialize with collection config
  async authenticate() {} // validate credentials, set this.authenticated
  async traverse(checkpoint = null) {} // return {documents: [], checkpoint: {}}
  async extract(documentIds) {} // return array of full document objects
  async detectChanges(lastCheckpoint) {} // return changed document IDs
  async extractAttachments(documentId) {} // return attachment objects
  getMetadataSchema() {} // return JSON schema for adapter settings
}
```

### Error Codes
- **AUTH_00x**: Token expired, invalid credentials, permission denied
- **RATE_00x**: Rate limit exceeded, quota exhausted
- **EXTRACT_00x**: Document not found, extraction failed, attachment too large
- **SANITIZE_00x**: Sanitization failed, timeout
- **INDEX_00x**: Indexing failed, queue full
- **CHECKPOINT_00x**: Corrupted, expired
- **SYSTEM_00x**: Out of memory, database error
- **ADAPTER_00x**: Not found, invalid config

## Dependencies and Integration

**Internal (xSwarm monorepo)**:
- **xswarm-ai-sanitize**: Mandatory content sanitization before indexing
- **xswarm-document-retrieval**: Meilisearch-based multi-pass document analysis and search

**External Services**:
- Google APIs (Gmail, Drive OAuth2), Dropbox API, Facebook Graph API
- ArXiv/PubMed APIs (public, rate-limited)

**Key Libraries**:
- **googleapis**: Google's official Node.js client for Gmail, Drive, Docs APIs (handles OAuth2, API calls)
- **simple-oauth2**: Generic OAuth2 flows for non-Google services
- **better-sqlite3**: SQLite for config/state storage
- **node-fetch**: HTTP client for general API calls
- **cheerio**: HTML parsing for web scraping
- **pdf-parse**: PDF text extraction
- **node-cron**: Schedule parsing and execution
- **winston/pino**: Structured logging

**Architecture Decision**: Rather than using higher-level abstraction libraries (like LlamaIndex which is Python-only, or LangChain.js which lacks Google connectors), we build adapters directly on official provider SDKs. This "boring stack" approach provides full control, minimal dependencies, and uses battle-tested official libraries.

**LLM Gateway (Planned Integration)**:
- Consider liteLLM (https://github.com/BerriAI/litellm) for cost tracking, load balancing, and provider routing in downstream multi-pass analysis operations

---
*PRD v1.0 - xSwarm Document Collector - Feb 3, 2026*