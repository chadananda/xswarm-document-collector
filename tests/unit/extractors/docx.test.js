import { describe, it, expect } from 'vitest';
import { isDocx } from '../../../src/extractors/docx.js';

describe('docx extractor', () => {
  describe('isDocx', () => {
    it('detects ZIP/DOCX signature', () => {
      // DOCX files are ZIP archives starting with PK
      const docxBuffer = Buffer.from([0x50, 0x4B, 0x03, 0x04]);
      expect(isDocx(docxBuffer)).toBe(true);
    });

    it('rejects non-DOCX', () => {
      const textBuffer = Buffer.from('Hello world');
      expect(isDocx(textBuffer)).toBe(false);
    });

    it('handles empty buffer', () => {
      expect(isDocx(Buffer.from(''))).toBe(false);
      expect(isDocx(null)).toBe(false);
    });
  });

  // Note: Full DOCX extraction tests would require valid DOCX files
  // which are complex binary formats. For now, we test detection only.
});
