import XLSX from 'xlsx';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('extractor:xlsx');

/**
 * Extract text from XLSX buffer
 * @param {Buffer} buffer - XLSX file buffer
 * @param {Object} options - Extraction options
 * @returns {Promise<Object>} Extracted text and metadata
 */
export async function extractXlsx(buffer, options = {}) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const sheets = [];
    let allText = [];

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      // Convert to text
      const sheetText = data
        .map(row => row.join('\t'))
        .join('\n');

      sheets.push({
        name: sheetName,
        text: sheetText,
        rows: data.length,
        cols: data[0]?.length || 0
      });

      allText.push(`Sheet: ${sheetName}\n${sheetText}`);
    });

    const text = allText.join('\n\n');

    logger.debug({
      sheets: sheets.length,
      length: text.length
    }, 'XLSX extracted');

    return {
      text,
      metadata: {
        sheets,
        sheetNames: workbook.SheetNames
      }
    };
  } catch (error) {
    logger.error({ error: error.message }, 'XLSX extraction failed');
    throw new Error(`XLSX extraction failed: ${error.message}`);
  }
}

/**
 * Extract structured data from XLSX
 */
export async function extractXlsxStructured(buffer, options = {}) {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const data = {};
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      data[sheetName] = XLSX.utils.sheet_to_json(sheet);
    });

    return {
      data,
      metadata: {
        sheetNames: workbook.SheetNames,
        sheetCount: workbook.SheetNames.length
      }
    };
  } catch (error) {
    logger.error({ error: error.message }, 'XLSX structured extraction failed');
    throw new Error(`XLSX structured extraction failed: ${error.message}`);
  }
}

/**
 * Check if buffer is an XLSX file
 */
export function isXlsx(buffer) {
  if (!buffer || buffer.length < 4) return false;
  // XLSX files start with PK (ZIP format)
  return buffer[0] === 0x50 && buffer[1] === 0x4B;
}
