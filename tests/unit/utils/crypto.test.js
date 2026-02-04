import { describe, it, expect } from 'vitest';
import { encrypt, decrypt, generateMasterKey, isValidMasterKey } from '../../../src/utils/crypto.js';

describe('crypto', () => {
  const masterKey = generateMasterKey();
  const plaintext = 'sensitive data 🔒';

  describe('generateMasterKey', () => {
    it('generates valid master key', () => {
      const key = generateMasterKey();
      expect(key).toBeTruthy();
      expect(isValidMasterKey(key)).toBe(true);
    });
  });

  describe('isValidMasterKey', () => {
    it('validates correct key format', () => {
      expect(isValidMasterKey(masterKey)).toBe(true);
    });

    it('rejects invalid key', () => {
      expect(isValidMasterKey('invalid')).toBe(false);
      expect(isValidMasterKey('')).toBe(false);
      expect(isValidMasterKey(null)).toBe(false);
    });
  });

  describe('encrypt/decrypt', () => {
    it('encrypts and decrypts successfully', () => {
      const encrypted = encrypt(plaintext, masterKey);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toBe(plaintext);

      const decrypted = decrypt(encrypted, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it('produces different ciphertext each time', () => {
      const encrypted1 = encrypt(plaintext, masterKey);
      const encrypted2 = encrypt(plaintext, masterKey);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('handles empty string', () => {
      const encrypted = encrypt('', masterKey);
      const decrypted = decrypt(encrypted, masterKey);
      expect(decrypted).toBe('');
    });

    it('handles unicode characters', () => {
      const text = '🔐 Unicode: ñ é ü 中文';
      const encrypted = encrypt(text, masterKey);
      const decrypted = decrypt(encrypted, masterKey);
      expect(decrypted).toBe(text);
    });

    it('throws on missing parameters', () => {
      expect(() => encrypt(null, masterKey)).toThrow();
      expect(() => encrypt(plaintext, null)).toThrow();
      expect(() => decrypt(null, masterKey)).toThrow();
    });

    it('throws on wrong key', () => {
      const encrypted = encrypt(plaintext, masterKey);
      const wrongKey = generateMasterKey();
      expect(() => decrypt(encrypted, wrongKey)).toThrow();
    });
  });
});
