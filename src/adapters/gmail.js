import { google } from 'googleapis';
import { BaseAdapter } from './base-adapter.js';
import { extractText } from '../extractors/index.js';
import { sanitizeText } from '../utils/sanitize.js';

const MAX_ATTACHMENT_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Gmail adapter for collecting emails and attachments
 */
export class GmailAdapter extends BaseAdapter {
  constructor(options) {
    super(options);

    this.gmail = null;
    this.oauth2Client = null;

    // Settings
    this.maxResults = this.settings.maxResults || 100;
    this.includeAttachments = this.settings.includeAttachments !== false;
    this.maxAttachmentSize = this.settings.maxAttachmentSize || MAX_ATTACHMENT_SIZE;
    this.query = this.settings.query || ''; // Gmail search query
  }

  /**
   * Initialize Gmail API with OAuth2
   */
  async initialize() {
    const { clientId, clientSecret, redirectUri, refreshToken } = this.credentials;

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error('Gmail requires: clientId, clientSecret, refreshToken');
    }

    // Create OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      redirectUri || 'urn:ietf:wg:oauth:2.0:oob'
    );

    this.oauth2Client.setCredentials({
      refresh_token: refreshToken
    });

    // Initialize Gmail API
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

    this.logger.info('Gmail adapter initialized');
  }

  /**
   * Fetch documents (emails) from Gmail
   */
  async *fetchDocuments() {
    let pageToken = this.checkpoint?.pageToken || null;
    let processedCount = 0;

    while (true) {
      try {
        // List messages
        const listResponse = await this.executeWithRetry(async () => {
          return this.gmail.users.messages.list({
            userId: 'me',
            q: this.query,
            maxResults: Math.min(this.maxResults, 500),
            pageToken
          });
        });

        const messages = listResponse.data.messages || [];

        if (messages.length === 0) {
          this.logger.info('No more messages');
          break;
        }

        // Process each message
        for (const messageRef of messages) {
          try {
            const document = await this.fetchMessage(messageRef.id);
            if (document) {
              yield document;
              processedCount++;

              this.emitProgress({
                processed: processedCount,
                lastMessageId: messageRef.id
              });
            }
          } catch (error) {
            this.emitError(error, { messageId: messageRef.id });
          }
        }

        // Check for next page
        pageToken = listResponse.data.nextPageToken;

        if (!pageToken) {
          this.logger.info({ total: processedCount }, 'All messages processed');
          break;
        }

        // Update checkpoint
        this.setCheckpoint({ pageToken, processedCount });

      } catch (error) {
        this.logger.error({ error: error.message }, 'Failed to list messages');
        throw error;
      }
    }
  }

  /**
   * Fetch single message with attachments
   */
  async fetchMessage(messageId) {
    const response = await this.executeWithRetry(async () => {
      return this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full'
      });
    });

    const message = response.data;

    // Extract headers
    const headers = this.parseHeaders(message.payload.headers);

    // Extract body
    const body = this.extractBody(message.payload);

    // Sanitize content
    const sanitizedBody = await sanitizeText(body);

    // Process attachments
    const attachments = [];
    if (this.includeAttachments) {
      await this.extractAttachments(message.payload, attachments, messageId);
    }

    return {
      id: `gmail-${messageId}`,
      title: headers.subject || '(No Subject)',
      content: sanitizedBody,
      source: 'gmail',
      sourceId: messageId,
      url: `https://mail.google.com/mail/u/0/#inbox/${messageId}`,
      metadata: {
        from: headers.from,
        to: headers.to,
        cc: headers.cc,
        date: headers.date,
        threadId: message.threadId,
        snippet: message.snippet,
        labels: message.labelIds || []
      },
      mimeType: 'message/rfc822',
      createdAt: new Date(parseInt(message.internalDate)),
      modifiedAt: new Date(parseInt(message.internalDate)),
      attachments
    };
  }

  /**
   * Parse message headers into object
   */
  parseHeaders(headers) {
    const parsed = {};

    headers.forEach(header => {
      const name = header.name.toLowerCase();
      if (['from', 'to', 'cc', 'subject', 'date'].includes(name)) {
        parsed[name] = header.value;
      }
    });

    return parsed;
  }

  /**
   * Extract email body (text/plain or text/html)
   */
  extractBody(payload) {
    let parts = [];

    if (payload.parts) {
      parts = payload.parts;
    } else if (payload.body && payload.body.data) {
      return this.decodeBody(payload.body.data);
    }

    // Find text/plain or text/html parts
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body && part.body.data) {
        return this.decodeBody(part.body.data);
      }
    }

    for (const part of parts) {
      if (part.mimeType === 'text/html' && part.body && part.body.data) {
        return this.decodeBody(part.body.data);
      }
    }

    // Recursive search in nested parts
    for (const part of parts) {
      if (part.parts) {
        const body = this.extractBody(part);
        if (body) return body;
      }
    }

    return '';
  }

  /**
   * Decode base64url encoded body
   */
  decodeBody(data) {
    return Buffer.from(data, 'base64url').toString('utf8');
  }

  /**
   * Extract attachments from message
   */
  async extractAttachments(payload, attachments, messageId) {
    if (!payload.parts) return;

    for (const part of payload.parts) {
      // Recursive search
      if (part.parts) {
        await this.extractAttachments(part, attachments, messageId);
      }

      // Check if this is an attachment
      if (part.filename && part.body && part.body.attachmentId) {
        const size = part.body.size || 0;

        if (size > this.maxAttachmentSize) {
          this.logger.warn({
            filename: part.filename,
            size,
            maxSize: this.maxAttachmentSize
          }, 'Attachment too large, skipping');
          continue;
        }

        try {
          const attachment = await this.fetchAttachment(messageId, part.body.attachmentId);

          // Extract text if possible
          let extractedText = '';
          try {
            const extracted = await extractText(attachment.content, part.filename);
            extractedText = extracted.text;
          } catch (error) {
            this.logger.debug({ filename: part.filename }, 'Could not extract text from attachment');
          }

          attachments.push({
            filename: part.filename,
            mimeType: part.mimeType,
            size: size,
            content: attachment.content,
            extractedText: extractedText || null
          });

        } catch (error) {
          this.logger.error({
            error: error.message,
            filename: part.filename
          }, 'Failed to fetch attachment');
        }
      }
    }
  }

  /**
   * Fetch attachment content
   */
  async fetchAttachment(messageId, attachmentId) {
    const response = await this.executeWithRetry(async () => {
      return this.gmail.users.messages.attachments.get({
        userId: 'me',
        messageId: messageId,
        id: attachmentId
      });
    });

    const data = response.data.data;
    const content = Buffer.from(data, 'base64url');

    return { content };
  }

  /**
   * Use History API for incremental sync
   * Fetches only messages that changed since last sync
   */
  async *fetchIncremental() {
    if (!this.checkpoint || !this.checkpoint.historyId) {
      this.logger.info('No history checkpoint, falling back to full fetch');
      yield* this.fetchDocuments();
      return;
    }

    const startHistoryId = this.checkpoint.historyId;

    try {
      const response = await this.executeWithRetry(async () => {
        return this.gmail.users.history.list({
          userId: 'me',
          startHistoryId,
          historyTypes: ['messageAdded', 'messageDeleted']
        });
      });

      const history = response.data.history || [];

      for (const record of history) {
        if (record.messagesAdded) {
          for (const added of record.messagesAdded) {
            const document = await this.fetchMessage(added.message.id);
            if (document) {
              yield document;
            }
          }
        }
      }

      // Update checkpoint with new history ID
      this.setCheckpoint({
        historyId: response.data.historyId
      });

    } catch (error) {
      if (error.code === 404) {
        this.logger.warn('History expired, performing full sync');
        yield* this.fetchDocuments();
      } else {
        throw error;
      }
    }
  }
}
