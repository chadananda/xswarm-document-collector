import { google } from 'googleapis';
import { BaseAdapter } from './base-adapter.js';
import { extractText } from '../extractors/index.js';
import { sanitizeText } from '../utils/sanitize.js';

/**
 * Google Drive adapter
 */
export class DriveAdapter extends BaseAdapter {
  constructor(options) {
    super(options);
    this.drive = null;
    this.oauth2Client = null;
    this.folderId = this.settings.folderId || 'root';
    this.mimeTypes = this.settings.mimeTypes || [];
  }

  async initialize() {
    const { clientId, clientSecret, redirectUri, refreshToken } = this.credentials;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Drive requires: clientId, clientSecret, refreshToken');
    }

    this.oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });

    this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
    this.logger.info('Drive adapter initialized');
  }

  async *fetchDocuments() {
    yield* this.traverseFolder(this.folderId);
  }

  async *traverseFolder(folderId, path = '') {
    let pageToken = null;

    do {
      const response = await this.executeWithRetry(async () => {
        return this.drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)',
          pageToken
        });
      });

      const files = response.data.files || [];

      for (const file of files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          yield* this.traverseFolder(file.id, `${path}/${file.name}`);
        } else {
          const doc = await this.fetchFile(file, path);
          if (doc) yield doc;
        }
      }

      pageToken = response.data.nextPageToken;
    } while (pageToken);
  }

  async fetchFile(file, path) {
    try {
      let content = '';

      // Export Google Docs formats
      if (file.mimeType.startsWith('application/vnd.google-apps')) {
        const exportMime = file.mimeType.includes('document') ? 'text/plain' :
                          file.mimeType.includes('spreadsheet') ? 'text/csv' : 'text/plain';

        const response = await this.drive.files.export({
          fileId: file.id,
          mimeType: exportMime
        }, { responseType: 'text' });

        content = response.data;
      } else {
        // Download binary files
        const response = await this.drive.files.get({
          fileId: file.id,
          alt: 'media'
        }, { responseType: 'arraybuffer' });

        const buffer = Buffer.from(response.data);
        const extracted = await extractText(buffer, file.name);
        content = extracted.text;
      }

      const sanitized = await sanitizeText(content);

      return {
        id: `drive-${file.id}`,
        title: file.name,
        content: sanitized,
        source: 'drive',
        sourceId: file.id,
        url: file.webViewLink,
        metadata: { path, mimeType: file.mimeType, size: file.size },
        mimeType: file.mimeType,
        createdAt: new Date(file.modifiedTime),
        modifiedAt: new Date(file.modifiedTime),
        attachments: []
      };
    } catch (error) {
      this.logger.error({ error: error.message, file: file.name }, 'Failed to fetch file');
      return null;
    }
  }
}
