import fetch from 'node-fetch';
import { BaseAdapter } from './base-adapter.js';
import { sanitizeText } from '../utils/sanitize.js';

/**
 * Facebook Graph API adapter
 */
export class FacebookAdapter extends BaseAdapter {
  constructor(options) {
    super(options);
    this.accessToken = this.credentials.accessToken;
    this.pageId = this.settings.pageId || 'me';
  }

  async initialize() {
    if (!this.accessToken) {
      throw new Error('Facebook accessToken required');
    }

    this.logger.info('Facebook adapter initialized');
  }

  async *fetchDocuments() {
    yield* this.fetchPosts();
  }

  async *fetchPosts() {
    let url = `https://graph.facebook.com/v18.0/${this.pageId}/posts?fields=id,message,created_time,permalink_url&access_token=${this.accessToken}`;

    while (url) {
      const response = await this.executeWithRetry(async () => {
        return fetch(url);
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(`Facebook API error: ${data.error.message}`);
      }

      for (const post of data.data || []) {
        if (post.message) {
          const sanitized = await sanitizeText(post.message);

          yield {
            id: `facebook-${post.id}`,
            title: post.message.substring(0, 100),
            content: sanitized,
            source: 'facebook',
            sourceId: post.id,
            url: post.permalink_url,
            metadata: {},
            mimeType: 'text/plain',
            createdAt: new Date(post.created_time),
            modifiedAt: new Date(post.created_time),
            attachments: []
          };
        }
      }

      url = data.paging?.next;
    }
  }
}
