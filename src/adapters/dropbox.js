import fetch from 'node-fetch';
import { BaseAdapter } from './base-adapter.js';
import { extractText } from '../extractors/index.js';
import { sanitizeText } from '../utils/sanitize.js';

/**
 * Dropbox adapter
 */
export class DropboxAdapter extends BaseAdapter {
  constructor(options) {
    super(options);
    this.accessToken = this.credentials.accessToken;
    this.path = this.settings.path || '';
  }

  async initialize() {
    if (!this.accessToken) {
      throw new Error('Dropbox accessToken required');
    }

    this.logger.info('Dropbox adapter initialized');
  }

  async *fetchDocuments() {
    yield* this.listFolder(this.path);
  }

  async *listFolder(path) {
    let cursor = this.checkpoint?.cursor;
    let hasMore = true;

    while (hasMore) {
      const response = await this.executeWithRetry(async () => {
        if (cursor) {
          return this.apiCall('/files/list_folder/continue', { cursor });
        } else {
          return this.apiCall('/files/list_folder', { path: path || '', recursive: true });
        }
      });

      const data = await response.json();

      for (const entry of data.entries) {
        if (entry['.tag'] === 'file') {
          const doc = await this.fetchFile(entry);
          if (doc) yield doc;
        }
      }

      hasMore = data.has_more;
      cursor = data.cursor;

      if (cursor) {
        this.setCheckpoint({ cursor });
      }
    }
  }

  async fetchFile(entry) {
    try {
      const response = await this.apiCall('/files/download', null, {
        'Dropbox-API-Arg': JSON.stringify({ path: entry.id })
      });

      const buffer = Buffer.from(await response.arrayBuffer());
      const extracted = await extractText(buffer, entry.name);
      const sanitized = await sanitizeText(extracted.text);

      return {
        id: `dropbox-${entry.id}`,
        title: entry.name,
        content: sanitized,
        source: 'dropbox',
        sourceId: entry.id,
        url: `https://www.dropbox.com/home${entry.path_display}`,
        metadata: { path: entry.path_display, size: entry.size },
        mimeType: 'application/octet-stream',
        createdAt: new Date(entry.client_modified),
        modifiedAt: new Date(entry.server_modified),
        attachments: []
      };
    } catch (error) {
      this.logger.error({ error: error.message, file: entry.name }, 'Failed to fetch file');
      return null;
    }
  }

  async apiCall(endpoint, body, extraHeaders = {}) {
    const response = await fetch(`https://api.dropboxapi.com/2${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...extraHeaders
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (!response.ok) {
      throw new Error(`Dropbox API error: ${response.statusText}`);
    }

    return response;
  }
}
