import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';
import { retry, isRetryableError } from '../utils/retry.js';

/**
 * Base adapter class - all adapters must extend this
 */
export class BaseAdapter extends EventEmitter {
  constructor(options = {}) {
    super();

    this.id = options.id;
    this.name = options.name || 'unnamed';
    this.credentials = options.credentials || {};
    this.settings = options.settings || {};
    this.logger = createLogger(`adapter:${this.name}`);

    // Rate limiter configuration
    const rateLimitConfig = options.rateLimit || {};
    this.rateLimiter = new RateLimiter({
      name: this.name,
      maxTokens: rateLimitConfig.maxTokens || 100,
      refillRate: rateLimitConfig.refillRate || 10
    });

    // Checkpoint for incremental sync
    this.checkpoint = options.checkpoint || null;
  }

  /**
   * Initialize adapter (setup auth, validate credentials)
   * Must be implemented by subclass
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Fetch documents from source
   * Must be implemented by subclass
   * @returns {AsyncGenerator<Document>} Document stream
   */
  async *fetchDocuments() {
    throw new Error('fetchDocuments() must be implemented by subclass');
  }

  /**
   * Validate adapter configuration
   * Can be overridden by subclass
   */
  async validate() {
    if (!this.credentials || Object.keys(this.credentials).length === 0) {
      throw new Error('Credentials required');
    }
    return true;
  }

  /**
   * Get current checkpoint for resuming
   */
  getCheckpoint() {
    return this.checkpoint;
  }

  /**
   * Set checkpoint for next run
   */
  setCheckpoint(checkpoint) {
    this.checkpoint = checkpoint;
    this.emit('checkpoint', checkpoint);
  }

  /**
   * Execute operation with rate limiting and retry
   */
  async executeWithRetry(fn, options = {}) {
    await this.rateLimiter.acquire(options.tokens || 1);

    return retry(fn, {
      maxAttempts: options.maxAttempts || 3,
      initialDelay: options.initialDelay || 1000,
      shouldRetry: options.shouldRetry || isRetryableError,
      onRetry: (error, attempt) => {
        this.logger.warn({ error: error.message, attempt }, 'Retrying operation');
        this.emit('retry', { error, attempt });
      }
    });
  }

  /**
   * Emit document discovered event
   */
  emitDocument(document) {
    this.emit('document', document);
  }

  /**
   * Emit error event
   */
  emitError(error, context = {}) {
    this.logger.error({ error: error.message, ...context }, 'Adapter error');
    this.emit('error', { error, context });
  }

  /**
   * Emit progress event
   */
  emitProgress(stats) {
    this.emit('progress', stats);
  }
}

/**
 * Standard document format returned by adapters
 * @typedef {Object} Document
 * @property {string} id - Unique document identifier
 * @property {string} title - Document title
 * @property {string} content - Extracted text content
 * @property {string} source - Source type (gmail, drive, etc)
 * @property {string} sourceId - Original ID from source system
 * @property {string} url - URL to original document
 * @property {Object} metadata - Additional metadata
 * @property {string} mimeType - MIME type
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} modifiedAt - Last modification timestamp
 * @property {Array<Attachment>} attachments - Document attachments
 */

/**
 * Attachment format
 * @typedef {Object} Attachment
 * @property {string} filename - Attachment filename
 * @property {string} mimeType - MIME type
 * @property {number} size - Size in bytes
 * @property {Buffer|string} content - Attachment content
 */
