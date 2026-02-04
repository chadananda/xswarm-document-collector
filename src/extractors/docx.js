import mammoth from 'mammoth';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('extractor:docx');

/**
 * Extract text from DOCX buffer
 * @param {Buffer} buffer - DOCX file buffer
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extracted text and metadata
 */
export async function extractDocx(buffer, options = {}) {
  try {
    const result = await mammoth.extractRawText({
      buffer,
      ...options
    });

    logger.debug({
      length: result.value.length,
      messages: result.messages.length
    }, 'DOCX extracted');

    return {
      text: result.value,
      metadata: {
        messages: result.messages,
        warnings: result.messages.filter(m => m.type === 'warning')
      }
    };
  } catch (error) {
    logger.error({ error: error.message }, 'DOCX extraction failed');
    throw new Error(`DOCX extraction failed: ${error.message}`);
  }
}

/**
 * Extract HTML from DOCX (preserves formatting)
 */
export async function extractDocxHtml(buffer, options = {}) {
  try {
    const result = await mammoth.convertToHtml({
      buffer,
      ...options
    });

    return {
      html: result.value,
      metadata: {
        messages: result.messages
      }
    };
  } catch (error) {
    logger.error({ error: error.message }, 'DOCX HTML extraction failed');
    throw new Error(`DOCX HTML extraction failed: ${error.message}`);
  }
}

/**
 * Check if buffer is a DOCX file
 */
export function isDocx(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // DOCX files start with PK (ZIP format)
  return buffer[0] === 0x50 && buffer[1] === 0x4B;
}
