import { describe, it, expect } from 'vitest';
import { extractPdf, isPdf } from '../../../src/extractors/pdf.js';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('pdf extractor', () => {
  describe('isPdf', () => {
    it('detects PDF signature', () => {
      const pdfBuffer = Buffer.from('%PDF-1.4\n%âãÏÓ');
      expect(isPdf(pdfBuffer)).toBe(true);
    });

    it('rejects non-PDF', () => {
      const textBuffer = Buffer.from('Hello world');
      expect(isPdf(textBuffer)).toBe(false);
    });

    it('handles empty buffer', () => {
      expect(isPdf(Buffer.from(''))).toBe(false);
      expect(isPdf(null)).toBe(false);
    });
  });

  describe('extractPdf', () => {
    it('handles invalid PDF', async () => {
      const invalidPdf = Buffer.from('Not a PDF');
      await expect(extractPdf(invalidPdf)).rejects.toThrow('PDF extraction failed');
    });

    it('handles malformed PDF header', async () => {
      const malformedPdf = Buffer.from('%PDF-1.4\nInvalid content');
      await expect(extractPdf(malformedPdf)).rejects.toThrow('PDF extraction failed');
    });
  });
});
