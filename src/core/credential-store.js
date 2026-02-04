import { encrypt, decrypt } from '../utils/crypto.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('credential-store');

/**
 * Get master key from environment
 */
function getMasterKey() {
  return process.env.XSWARM_ENCRYPTION_KEY;
}

/**
 * Encrypt credentials for storage
 * @param {Object} credentials - Credential object to encrypt
 * @returns {string} Encrypted credentials as base64 string
 */
export function encryptCredentials(credentials) {
  if (!credentials) {
    throw new Error('credentials required');
  }

  const masterKey = getMasterKey();
  if (!masterKey) {
    throw new Error('XSWARM_ENCRYPTION_KEY environment variable not set');
  }

  const json = JSON.stringify(credentials);
  const encrypted = encrypt(json, masterKey);

  logger.debug('Credentials encrypted');
  return encrypted;
}

/**
 * Decrypt credentials from storage
 * @param {string} encryptedCredentials - Encrypted credentials string
 * @returns {Object} Decrypted credential object
 */
export function decryptCredentials(encryptedCredentials) {
  if (!encryptedCredentials) {
    throw new Error('encryptedCredentials required');
  }

  const masterKey = getMasterKey();
  if (!masterKey) {
    throw new Error('XSWARM_ENCRYPTION_KEY environment variable not set');
  }

  try {
    const json = decrypt(encryptedCredentials, masterKey);
    const credentials = JSON.parse(json);

    logger.debug('Credentials decrypted');
    return credentials;
  } catch (error) {
    logger.error({ error: error.message }, 'Failed to decrypt credentials');
    throw new Error('Invalid credentials or encryption key');
  }
}

/**
 * Check if credential encryption is available
 */
export function isEncryptionAvailable() {
  return Boolean(getMasterKey());
}
