import { randomUUID } from 'crypto';
import { query, execute, getOne } from './state-manager.js';
import { encryptCredentials, decryptCredentials } from './credential-store.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('collection-manager');

/**
 * Create a new collection
 */
export async function createCollection(data) {
  const {
    name,
    adapter,
    credentials,
    settings = {},
    schedule = null,
    metadata = {},
    enabled = true
  } = data;

  if (!name || !adapter) {
    throw new Error('name and adapter are required');
  }

  const id = randomUUID();
  const now = new Date().toISOString();

  const credentialsEncrypted = credentials
    ? encryptCredentials(credentials)
    : null;

  await execute(
    `INSERT INTO collections (
      id, name, adapter, enabled,
      credentials_encrypted, settings, schedule,
      metadata, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      name,
      adapter,
      enabled ? 1 : 0,
      credentialsEncrypted,
      JSON.stringify(settings),
      schedule,
      JSON.stringify(metadata),
      'configured',
      now,
      now
    ]
  );

  logger.info({ id, name, adapter }, 'Collection created');

  return getCollection(id);
}

/**
 * Get collection by ID
 */
export function getCollection(id) {
  const row = getOne('SELECT * FROM collections WHERE id = ?', [id]);

  if (!row) return null;

  return deserializeCollection(row);
}

/**
 * Get collection by name
 */
export function getCollectionByName(name) {
  const row = getOne('SELECT * FROM collections WHERE name = ?', [name]);

  if (!row) return null;

  return deserializeCollection(row);
}

/**
 * List all collections
 */
export function listCollections(options = {}) {
  const { adapter = null, enabled = null } = options;

  let sql = 'SELECT * FROM collections WHERE 1=1';
  const params = [];

  if (adapter) {
    sql += ' AND adapter = ?';
    params.push(adapter);
  }

  if (enabled !== null) {
    sql += ' AND enabled = ?';
    params.push(enabled ? 1 : 0);
  }

  sql += ' ORDER BY created_at DESC';

  const rows = query(sql, params);
  return rows.map(deserializeCollection);
}

/**
 * Update collection
 */
export async function updateCollection(id, updates) {
  const existing = getCollection(id);
  if (!existing) {
    throw new Error(`Collection ${id} not found`);
  }

  const fields = [];
  const params = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    params.push(updates.name);
  }

  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    params.push(updates.enabled ? 1 : 0);
  }

  if (updates.credentials !== undefined) {
    fields.push('credentials_encrypted = ?');
    params.push(updates.credentials ? encryptCredentials(updates.credentials) : null);
  }

  if (updates.settings !== undefined) {
    fields.push('settings = ?');
    params.push(JSON.stringify(updates.settings));
  }

  if (updates.schedule !== undefined) {
    fields.push('schedule = ?');
    params.push(updates.schedule);
  }

  if (updates.metadata !== undefined) {
    fields.push('metadata = ?');
    params.push(JSON.stringify(updates.metadata));
  }

  if (updates.status !== undefined) {
    fields.push('status = ?');
    params.push(updates.status);
  }

  if (fields.length === 0) {
    return existing;
  }

  fields.push('updated_at = ?');
  params.push(new Date().toISOString());
  params.push(id);

  const sql = `UPDATE collections SET ${fields.join(', ')} WHERE id = ?`;
  await execute(sql, params);

  logger.info({ id, updates: Object.keys(updates) }, 'Collection updated');

  return getCollection(id);
}

/**
 * Delete collection
 */
export async function deleteCollection(id) {
  const existing = getCollection(id);
  if (!existing) {
    throw new Error(`Collection ${id} not found`);
  }

  await execute('DELETE FROM collections WHERE id = ?', [id]);

  logger.info({ id, name: existing.name }, 'Collection deleted');
}

/**
 * Get collection credentials (decrypted)
 */
export function getCollectionCredentials(id) {
  const collection = getCollection(id);
  if (!collection) {
    throw new Error(`Collection ${id} not found`);
  }

  if (!collection.credentials_encrypted) {
    return null;
  }

  return decryptCredentials(collection.credentials_encrypted);
}

/**
 * Deserialize collection row from database
 */
function deserializeCollection(row) {
  return {
    id: row.id,
    name: row.name,
    adapter: row.adapter,
    enabled: Boolean(row.enabled),
    credentials_encrypted: row.credentials_encrypted,
    settings: row.settings ? JSON.parse(row.settings) : {},
    schedule: row.schedule,
    metadata: row.metadata ? JSON.parse(row.metadata) : {},
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}
