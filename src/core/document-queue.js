import { EventEmitter } from 'events';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('document-queue');

/**
 * Queue for documents ready for indexing
 */
export class DocumentQueue extends EventEmitter {
  constructor(options = {}) {
    super();
    this.maxSize = options.maxSize || 1000;
    this.queue = [];
    this.processing = false;
  }

  /**
   * Add document to queue
   */
  enqueue(document) {
    if (this.queue.length >= this.maxSize) {
      logger.warn({ maxSize: this.maxSize }, 'Queue full, dropping oldest document');
      this.queue.shift();
    }

    this.queue.push({
      ...document,
      enqueuedAt: new Date().toISOString()
    });

    this.emit('enqueued', document);
    logger.debug({ id: document.id, size: this.queue.length }, 'Document enqueued');
  }

  /**
   * Get next document from queue
   */
  dequeue() {
    const document = this.queue.shift();
    if (document) {
      this.emit('dequeued', document);
      logger.debug({ id: document.id, remaining: this.queue.length }, 'Document dequeued');
    }
    return document;
  }

  /**
   * Get queue size
   */
  size() {
    return this.queue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty() {
    return this.queue.length === 0;
  }

  /**
   * Clear all documents from queue
   */
  clear() {
    const count = this.queue.length;
    this.queue = [];
    logger.info({ count }, 'Queue cleared');
  }

  /**
   * Peek at next document without removing
   */
  peek() {
    return this.queue[0];
  }

  /**
   * Get all documents in queue
   */
  getAll() {
    return [...this.queue];
  }
}

export const defaultQueue = new DocumentQueue();
