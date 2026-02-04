import fetch from 'node-fetch';
import { BaseAdapter } from './base-adapter.js';
import { extractPdf } from '../extractors/pdf.js';
import { sanitizeText } from '../utils/sanitize.js';

/**
 * ArXiv academic paper adapter
 */
export class ArxivAdapter extends BaseAdapter {
  constructor(options) {
    super(options);
    this.query = this.settings.query || 'all';
    this.category = this.settings.category || '';
    this.maxResults = this.settings.maxResults || 100;
  }

  async initialize() {
    this.logger.info({ query: this.query }, 'ArXiv adapter initialized');
  }

  async *fetchDocuments() {
    const searchQuery = this.category
      ? `cat:${this.category}`
      : `all:${this.query}`;

    const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent(searchQuery)}&max_results=${this.maxResults}`;

    const response = await this.executeWithRetry(async () => {
      return fetch(url);
    });

    const xml = await response.text();

    // Simple XML parsing
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

    for (const entryXml of entries) {
      const id = this.extractXmlTag(entryXml, 'id');
      const title = this.extractXmlTag(entryXml, 'title');
      const summary = this.extractXmlTag(entryXml, 'summary');
      const published = this.extractXmlTag(entryXml, 'published');
      const pdfLink = this.extractXmlTag(entryXml, 'link', 'pdf');

      const sanitized = await sanitizeText(`${title}\n\n${summary}`);

      yield {
        id: `arxiv-${id.split('/').pop()}`,
        title,
        content: sanitized,
        source: 'arxiv',
        sourceId: id,
        url: id,
        metadata: { pdfLink, abstract: summary },
        mimeType: 'application/pdf',
        createdAt: new Date(published),
        modifiedAt: new Date(published),
        attachments: []
      };
    }
  }

  extractXmlTag(xml, tag, filter = null) {
    const regex = filter
      ? new RegExp(`<${tag}[^>]*title="${filter}"[^>]*>([^<]*)<\/${tag}>`, 'i')
      : new RegExp(`<${tag}[^>]*>([^<]*)<\/${tag}>`, 'i');

    const match = xml.match(regex);
    return match ? match[1].trim() : '';
  }
}
