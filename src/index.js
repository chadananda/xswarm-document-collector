/**
 * xswarm-document-collector
 * Terse, robust document collection framework
 */

export { initDatabase, closeDatabase, saveDatabase } from './core/state-manager.js';

export {
  createCollection,
  getCollection,
  getCollectionByName,
  listCollections,
  updateCollection,
  deleteCollection,
  getCollectionCredentials
} from './core/collection-manager.js';

export {
  encryptCredentials,
  decryptCredentials,
  isEncryptionAvailable
} from './core/credential-store.js';

export { DocumentQueue, defaultQueue } from './core/document-queue.js';

export { encrypt, decrypt, generateMasterKey, isValidMasterKey } from './utils/crypto.js';
export { logger, createLogger } from './utils/logger.js';
export { retry, isRetryableError } from './utils/retry.js';
export { RateLimiter } from './utils/rate-limiter.js';
export { sanitizeText, sanitizeBatch, checkSanitizeService } from './utils/sanitize.js';
