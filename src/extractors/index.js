import { extractPdf, isPdf } from './pdf.js';
import { extractDocx, extractDocxHtml, isDocx } from './docx.js';
import { extractXlsx, extractXlsxStructured, isXlsx } from './xlsx.js';

/**
 * Auto-detect and extract text from buffer
 * @param {Buffer} buffer - File buffer
 * @param {string} filename - Original filename (for hint)
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extracted text and metadata
 */
export async function extractText(buffer, filename = '', options = {}) {
  // Try detection by content first
  if (isPdf(buffer)) {
    return extractPdf(buffer, options);
  }

  // For DOCX/XLSX, check filename extension since both are ZIP format
  const ext = filename.toLowerCase().split('.').pop();

  if (ext === 'docx' || (ext === '' && isDocx(buffer))) {
    return extractDocx(buffer, options);
  }

  if (ext === 'xlsx' || ext === 'xls') {
    return extractXlsx(buffer, options);
  }

  // Fallback: treat as plain text
  return {
    text: buffer.toString('utf8'),
    metadata: { type: 'plain' }
  };
}

export {
  extractPdf,
  isPdf,
  extractDocx,
  extractDocxHtml,
  isDocx,
  extractXlsx,
  extractXlsxStructured,
  isXlsx
};
