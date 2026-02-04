import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GmailAdapter } from '../../../src/adapters/gmail.js';

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn(() => ({
        setCredentials: vi.fn()
      }))
    },
    gmail: vi.fn(() => ({
      users: {
        messages: {
          list: vi.fn(),
          get: vi.fn(),
          attachments: {
            get: vi.fn()
          }
        },
        history: {
          list: vi.fn()
        }
      }
    }))
  }
}));

// Mock sanitizeText
vi.mock('../../../src/utils/sanitize.js', () => ({
  sanitizeText: vi.fn(text => Promise.resolve(text))
}));

describe('GmailAdapter', () => {
  let adapter;
  let mockGmail;

  beforeEach(() => {
    adapter = new GmailAdapter({
      name: 'test-gmail',
      credentials: {
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        refreshToken: 'test-refresh-token'
      },
      settings: {
        maxResults: 10,
        includeAttachments: false
      }
    });

    mockGmail = {
      users: {
        messages: {
          list: vi.fn(),
          get: vi.fn()
        }
      }
    };
  });

  describe('constructor', () => {
    it('initializes with credentials', () => {
      expect(adapter.credentials.clientId).toBe('test-client-id');
      expect(adapter.maxResults).toBe(10);
      expect(adapter.includeAttachments).toBe(false);
    });
  });

  describe('initialize', () => {
    it('sets up OAuth2 and Gmail API', async () => {
      await adapter.initialize();
      expect(adapter.oauth2Client).toBeTruthy();
      expect(adapter.gmail).toBeTruthy();
    });

    it('throws on missing credentials', async () => {
      adapter.credentials = {};
      await expect(adapter.initialize()).rejects.toThrow('requires: clientId');
    });
  });

  describe('parseHeaders', () => {
    it('extracts relevant headers', () => {
      const headers = [
        { name: 'From', value: 'sender@example.com' },
        { name: 'To', value: 'recipient@example.com' },
        { name: 'Subject', value: 'Test Email' },
        { name: 'Date', value: '2024-01-01' },
        { name: 'X-Custom', value: 'ignored' }
      ];

      const parsed = adapter.parseHeaders(headers);

      expect(parsed.from).toBe('sender@example.com');
      expect(parsed.to).toBe('recipient@example.com');
      expect(parsed.subject).toBe('Test Email');
      expect(parsed.date).toBe('2024-01-01');
      expect(parsed['x-custom']).toBeUndefined();
    });
  });

  describe('decodeBody', () => {
    it('decodes base64url encoded data', () => {
      const encoded = Buffer.from('Hello World').toString('base64url');
      const decoded = adapter.decodeBody(encoded);
      expect(decoded).toBe('Hello World');
    });
  });

  describe('extractBody', () => {
    it('extracts text/plain body', () => {
      const payload = {
        parts: [
          {
            mimeType: 'text/plain',
            body: {
              data: Buffer.from('Plain text body').toString('base64url')
            }
          }
        ]
      };

      const body = adapter.extractBody(payload);
      expect(body).toBe('Plain text body');
    });

    it('extracts text/html if text/plain not available', () => {
      const payload = {
        parts: [
          {
            mimeType: 'text/html',
            body: {
              data: Buffer.from('<p>HTML body</p>').toString('base64url')
            }
          }
        ]
      };

      const body = adapter.extractBody(payload);
      expect(body).toBe('<p>HTML body</p>');
    });

    it('handles direct body data', () => {
      const payload = {
        body: {
          data: Buffer.from('Direct body').toString('base64url')
        }
      };

      const body = adapter.extractBody(payload);
      expect(body).toBe('Direct body');
    });

    it('returns empty string if no body found', () => {
      const payload = { parts: [] };
      const body = adapter.extractBody(payload);
      expect(body).toBe('');
    });
  });
});
