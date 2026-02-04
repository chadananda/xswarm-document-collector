import fetch from 'node-fetch';
import { createLogger } from './logger.js';

const logger = createLogger('sanitize');

const SANITIZE_ENDPOINT = process.env.XSWARM_SANITIZE_ENDPOINT || 'http://localhost:3000';

/**
 * Sanitize text content using xswarm-ai-sanitize
 * @param {string} text - Text to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Promise<string>} Sanitized text
 */
export async function sanitizeText(text, options = {}) {
  if (!text) return '';

  try {
    const response = await fetch(`${SANITIZE_ENDPOINT}/sanitize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        options: {
          removePII: options.removePII !== false,
          removeCredentials: options.removeCredentials !== false,
          normalizeWhitespace: options.normalizeWhitespace !== false,
          ...options
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Sanitization failed: ${response.statusText}`);
    }

    const result = await response.json();
    logger.debug({ length: text.length, sanitized: result.text.length }, 'Text sanitized');

    return result.text;
  } catch (error) {
    logger.error({ error: error.message }, 'Sanitization failed');
    // Fallback: return original text if sanitization service unavailable
    logger.warn('Returning unsanitized text due to error');
    return text;
  }
}

/**
 * Batch sanitize multiple texts
 */
export async function sanitizeBatch(texts, options = {}) {
  return Promise.all(texts.map(text => sanitizeText(text, options)));
}

/**
 * Check if sanitization service is available
 */
export async function checkSanitizeService() {
  try {
    const response = await fetch(`${SANITIZE_ENDPOINT}/health`, {
      method: 'GET',
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    logger.warn({ endpoint: SANITIZE_ENDPOINT }, 'Sanitization service unavailable');
    return false;
  }
}
