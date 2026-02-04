import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 64;

/**
 * Derives encryption key from master key and salt using PBKDF2
 */
function deriveKey(masterKey, salt) {
  return crypto.pbkdf2Sync(masterKey, salt, 100000, KEY_LENGTH, 'sha256');
}

/**
 * Encrypts data using AES-256-GCM
 * @param {string} plaintext - Data to encrypt
 * @param {string} masterKey - Base64-encoded master key
 * @returns {string} Base64-encoded encrypted data with salt, IV, authTag
 */
export function encrypt(plaintext, masterKey) {
  if (plaintext === null || plaintext === undefined || !masterKey) {
    throw new Error('plaintext and masterKey required');
  }

  const keyBuffer = Buffer.from(masterKey, 'base64');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`Master key must be ${KEY_LENGTH} bytes`);
  }

  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = deriveKey(keyBuffer, salt);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  // Format: salt(64) + iv(16) + authTag(16) + encrypted
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypts data encrypted with encrypt()
 * @param {string} ciphertext - Base64-encoded encrypted data
 * @param {string} masterKey - Base64-encoded master key
 * @returns {string} Decrypted plaintext
 */
export function decrypt(ciphertext, masterKey) {
  if (!ciphertext || !masterKey) {
    throw new Error('ciphertext and masterKey required');
  }

  const keyBuffer = Buffer.from(masterKey, 'base64');
  if (keyBuffer.length !== KEY_LENGTH) {
    throw new Error(`Master key must be ${KEY_LENGTH} bytes`);
  }

  const combined = Buffer.from(ciphertext, 'base64');

  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = deriveKey(keyBuffer, salt);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generates a random 256-bit master key
 * @returns {string} Base64-encoded master key
 */
export function generateMasterKey() {
  return crypto.randomBytes(KEY_LENGTH).toString('base64');
}

/**
 * Validates master key format
 */
export function isValidMasterKey(key) {
  try {
    const buffer = Buffer.from(key, 'base64');
    return buffer.length === KEY_LENGTH;
  } catch {
    return false;
  }
}
