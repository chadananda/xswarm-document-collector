import pdfParse from 'pdf-parse';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('extractor:pdf');

/**
 * Extract text from PDF buffer
 * @param {Buffer} buffer - PDF file buffer
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extracted text and metadata
 */
export async function extractPdf(buffer, options = {}) {
  try {
    const data = await pdfParse(buffer, {
      max: options.maxPages || 0, // 0 = no limit
      version: 'v1.10.100'
    });

    logger.debug({
      pages: data.numpages,
      length: data.text.length
    }, 'PDF extracted');

    return {
      text: data.text,
      metadata: {
        pages: data.numpages,
        info: data.info || {},
        version: data.version
      }
    };
  } catch (error) {
    logger.error({ error: error.message }, 'PDF extraction failed');
    throw new Error(`PDF extraction failed: ${error.message}`);
  }
}

/**
 * Check if buffer is a PDF
 */
export function isPdf(buffer) {
  if (!buffer || buffer.length < 4) return false;
  return buffer.toString('utf8', 0, 4) === '%PDF';
}
