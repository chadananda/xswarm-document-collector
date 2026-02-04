import { createLogger } from './logger.js';

const logger = createLogger('retry');

/**
 * Retry an async operation with exponential backoff
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry configuration
 * @returns {Promise<any>} Result of successful function call
 */
export async function retry(fn, options = {}) {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    shouldRetry = () => true,
    onRetry = null
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !shouldRetry(error, attempt)) {
        throw error;
      }

      logger.warn({
        attempt,
        maxAttempts,
        delay,
        error: error.message
      }, 'Retrying operation');

      if (onRetry) {
        await onRetry(error, attempt);
      }

      await sleep(delay);
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (network, rate limit, temporary)
 */
export function isRetryableError(error) {
  if (!error) return false;

  const retryableCodes = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'ENETUNREACH'];
  const retryableStatusCodes = [408, 429, 500, 502, 503, 504];

  return retryableCodes.includes(error.code) ||
         retryableStatusCodes.includes(error.statusCode) ||
         retryableStatusCodes.includes(error.status);
}
