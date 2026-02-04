import { describe, it, expect } from 'vitest';
import { isXlsx } from '../../../src/extractors/xlsx.js';

describe('xlsx extractor', () => {
  describe('isXlsx', () => {
    it('detects ZIP/XLSX signature', () => {
      // XLSX files are ZIP archives starting with PK
      const xlsxBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
      expect(isXlsx(xlsxBuffer)).toBe(true);
    });

    it('rejects non-XLSX', () => {
      const textBuffer = Buffer.from('Hello world');
      expect(isXlsx(textBuffer)).toBe(false);
    });

    it('handles empty buffer', () => {
      expect(isXlsx(Buffer.from(''))).toBe(false);
      expect(isXlsx(null)).toBe(false);
    });
  });

  // Note: Full XLSX extraction tests would require valid XLSX files
  // which are complex binary formats. For now, we test detection only.
});
