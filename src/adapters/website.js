import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { BaseAdapter } from './base-adapter.js';
import { sanitizeText } from '../utils/sanitize.js';

/**
 * Website scraper adapter
 */
export class WebsiteAdapter extends BaseAdapter {
  constructor(options) {
    super(options);
    this.startUrl = this.settings.startUrl;
    this.maxDepth = this.settings.maxDepth || 2;
    this.allowedDomains = this.settings.allowedDomains || [];
    this.visited = new Set();
  }

  async initialize() {
    if (!this.startUrl) {
      throw new Error('startUrl required');
    }

    const url = new URL(this.startUrl);
    if (this.allowedDomains.length === 0) {
      this.allowedDomains.push(url.hostname);
    }

    this.logger.info({ url: this.startUrl }, 'Website adapter initialized');
  }

  async *fetchDocuments() {
    yield* this.crawl(this.startUrl, 0);
  }

  async *crawl(url, depth) {
    if (depth > this.maxDepth || this.visited.has(url)) {
      return;
    }

    this.visited.add(url);

    try {
      await this.rateLimiter.acquire(1);

      const response = await fetch(url, {
        headers: { 'User-Agent': 'xswarm-document-collector/1.0' }
      });

      if (!response.ok) {
        this.logger.warn({ url, status: response.status }, 'Failed to fetch');
        return;
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      // Extract text content
      $('script, style, nav, footer').remove();
      const text = $('body').text().replace(/\s+/g, ' ').trim();
      const title = $('title').text() || $('h1').first().text() || url;

      const sanitized = await sanitizeText(text);

      yield {
        id: `web-${Buffer.from(url).toString('base64')}`,
        title,
        content: sanitized,
        source: 'website',
        sourceId: url,
        url,
        metadata: { depth },
        mimeType: 'text/html',
        createdAt: new Date(),
        modifiedAt: new Date(),
        attachments: []
      };

      // Find links for deeper crawling
      if (depth < this.maxDepth) {
        const links = $('a[href]').map((i, el) => $(el).attr('href')).get();

        for (const link of links) {
          try {
            const absoluteUrl = new URL(link, url).href;
            const linkUrl = new URL(absoluteUrl);

            if (this.allowedDomains.includes(linkUrl.hostname)) {
              yield* this.crawl(absoluteUrl, depth + 1);
            }
          } catch (error) {
            // Invalid URL, skip
          }
        }
      }
    } catch (error) {
      this.logger.error({ error: error.message, url }, 'Crawl failed');
    }
  }
}
