// Encrypted snapshots of everything the server keeps for the user (memories, generated images,
// user skills, orchestrator runs) to a user-chosen place: a local or cloud-synced folder (OneDrive,
// Google Drive, iCloud Drive, NAS share) or a WebDAV server (Nextcloud, NAS). Snapshots are gzip +
// AES-256-GCM with a key derived from HAFIZE_BACKUP_PASSPHRASE (scrypt). Restore merges per record,
// last writer wins, so restoring an older snapshot never overwrites newer notes.
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { DatabaseSync } from 'node:sqlite';
import type { MemoryBackend } from './memory-backend.ts';

const MAGIC = Buffer.from('HZB1');
const MAX_IMAGE_BYTES = 200 * 1024 * 1024;
const KEEP_SNAPSHOTS = 14;

export class BackupError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'BackupError'; this.code = code; this.status = status; }
}

export function encryptSnapshot(data: unknown, passphrase: string): Buffer {
  if (!passphrase || passphrase.length < 8) throw new BackupError('BACKUP_PASSPHRASE_TOO_SHORT');
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(MAGIC);
  const body = Buffer.concat([cipher.update(gzipSync(Buffer.from(JSON.stringify(data), 'utf8'))), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

export function decryptSnapshot(buffer: Buffer, passphrase: string): Record<string, unknown> {
  if (buffer.length < 48 || !buffer.subarray(0, 4).equals(MAGIC)) throw new BackupError('BACKUP_FORMAT_INVALID');
  const salt = buffer.subarray(4, 20);
  const iv = buffer.subarray(20, 32);
  const tag = buffer.subarray(32, 48);
  try {
    const key = scryptSync(passphrase, salt, 32, { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(MAGIC);
    decipher.setAuthTag(tag);
    return JSON.parse(gunzipSync(Buffer.concat([decipher.update(buffer.subarray(48)), decipher.final()])).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new BackupError('BACKUP_DECRYPT_FAILED', 403);
  }
}

export interface BackupTarget {
  readonly kind: 'folder' | 'webdav';
  put(name: string, data: Buffer): Promise<void>;
  get(name: string): Promise<Buffer>;
  list(): Promise<string[]>;
  remove(name: string): Promise<void>;
}

export function folderTarget(dir: string): BackupTarget {
  return {
    kind: 'folder',
    async put(name, data) { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, basename(name)), data); },
    async get(name) { return readFileSync(join(dir, basename(name))); },
    async list() { return existsSync(dir) ? readdirSync(dir).filter((name) => name.endsWith('.hzb')).sort() : []; },
    async remove(name) { rmSync(join(dir, basename(name)), { force: true }); }
  };
}

export function webdavTarget({ url, username = '', password = '', fetchImpl = globalThis.fetch }: { readonly url: string; readonly username?: string; readonly password?: string; readonly fetchImpl?: typeof fetch }): BackupTarget {
  if (!/^https:\/\//.test(url)) throw new BackupError('WEBDAV_HTTPS_REQUIRED');
  const base = url.endsWith('/') ? url : `${url}/`;
  const headers: Record<string, string> = username ? { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` } : {};
  const request = async (method: string, name: string, body?: Buffer, extra: Record<string, string> = {}) => {
    const response = await fetchImpl(base + encodeURIComponent(basename(name)), { method, headers: { ...headers, ...extra }, ...(body ? { body: new Uint8Array(body) } : {}), signal: AbortSignal.timeout(60_000) });
    if (!response.ok && !(method === 'DELETE' && response.status === 404)) throw new BackupError(`WEBDAV_${method}_FAILED`, 502);
    return response;
  };
  return {
    kind: 'webdav',
    async put(name, data) { await request('PUT', name, data, { 'Content-Type': 'application/octet-stream' }); },
    async get(name) { return Buffer.from(await (await request('GET', name)).arrayBuffer()); },
    async list() {
      const response = await fetchImpl(base, { method: 'PROPFIND', headers: { ...headers, Depth: '1' }, signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new BackupError('WEBDAV_LIST_FAILED', 502);
      return [...(await response.text()).matchAll(/<(?:\w+:)?href>([^<]+)<\/(?:\w+:)?href>/gi)].map((match) => decodeURIComponent(match[1]!.split('/').filter(Boolean).pop() || '')).filter((name) => name.endsWith('.hzb')).sort();
    },
    async remove(name) { await request('DELETE', name); }
  };
}

export function createBackupService({ db, memory, imagesDir, userSkillsDir, target, passphrase, now = () => new Date() }: {
  readonly db: DatabaseSync; readonly memory: MemoryBackend; readonly imagesDir: string; readonly userSkillsDir: string;
  readonly target: BackupTarget | null; readonly passphrase: string; readonly now?: () => Date;
}) {
  let lastResult: Record<string, unknown> | null = null;

  function collect() {
    const owners = (db.prepare("SELECT DISTINCT owner_id FROM memories WHERE owner_id NOT LIKE '\\_\\_%' ESCAPE '\\'").all() as Array<{ owner_id: string }>).map((row) => row.owner_id);
    const memories = owners.flatMap((ownerId) => memory.list(ownerId, { namespace: 'private', limit: 5_000 }).map((record) => ({ ownerId, ...record })));
    const shared = memory.list('', { namespace: 'shared', limit: 5_000 }).map((record) => ({ ownerId: '', ...record }));
    let imageBytes = 0;
    const images = (db.prepare('SELECT * FROM images ORDER BY created_at DESC').all() as Array<Record<string, unknown>>).flatMap((row) => {
      const file = readdirSync(imagesDir).find((name) => name.startsWith(String(row.id)));
      if (!file) return [];
      const size = statSync(join(imagesDir, file)).size;
      if (imageBytes + size > MAX_IMAGE_BYTES) return [];
      imageBytes += size;
      return [{ ...row, file, data: readFileSync(join(imagesDir, file)).toString('base64') }];
    });
    const skills = existsSync(userSkillsDir) ? readdirSync(userSkillsDir).filter((name) => /\.(json|js)$/.test(name)).map((name) => ({ name, content: readFileSync(join(userSkillsDir, name), 'utf8') })) : [];
    const runs = db.prepare('SELECT id, owner_id, trace_id, goal, status, state, created_at, updated_at FROM orchestrator_runs ORDER BY updated_at DESC LIMIT 200').all();
    return { format: 'hafize-backup/v1', createdAt: now().toISOString(), memories: [...memories, ...shared], images, skills, orchestratorRuns: runs };
  }

  async function backupNow() {
    if (!target) throw new BackupError('BACKUP_TARGET_NOT_CONFIGURED', 503);
    const snapshot = collect();
    const name = `hafize-backup-${now().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.hzb`;
    const data = encryptSnapshot(snapshot, passphrase);
    await target.put(name, data);
    const all = await target.list();
    for (const old of all.slice(0, Math.max(0, all.length - KEEP_SNAPSHOTS))) await target.remove(old).catch(() => {});
    lastResult = { name, bytes: data.length, memories: snapshot.memories.length, images: snapshot.images.length, skills: snapshot.skills.length, at: snapshot.createdAt, target: target.kind };
    return lastResult;
  }

  async function restore(name?: string) {
    if (!target) throw new BackupError('BACKUP_TARGET_NOT_CONFIGURED', 503);
    const names = await target.list();
    const chosen = name ? names.find((item) => item === basename(name)) : names.at(-1);
    if (!chosen) throw new BackupError('BACKUP_NOT_FOUND', 404);
    const snapshot = decryptSnapshot(await target.get(chosen), passphrase);
    if (snapshot.format !== 'hafize-backup/v1') throw new BackupError('BACKUP_FORMAT_INVALID');
    let restoredMemories = 0; let skipped = 0; let restoredImages = 0;
    for (const item of (snapshot.memories as Array<Record<string, unknown>>) || []) {
      const ownerId = String(item.ownerId || '');
      const namespace = String(item.namespace || 'private');
      if (namespace === 'private' && !ownerId) { skipped += 1; continue; }
      const existing = memory.get(ownerId, String(item.id));
      if (existing && existing.updatedAt >= String(item.updatedAt)) { skipped += 1; continue; }
      if (existing) memory.remove(ownerId, [existing.id]);
      try {
        await memory.put({ ownerId: ownerId || 'restore', content: item.content, namespace, consentScope: namespace, kind: item.kind, tags: item.tags, source: String(item.source || 'restore'), sourceRef: String(item.sourceRef || ''), id: String(item.id) });
        restoredMemories += 1;
      } catch { skipped += 1; }
    }
    mkdirSync(imagesDir, { recursive: true });
    for (const image of (snapshot.images as Array<Record<string, unknown>>) || []) {
      if (!/^img_[a-f0-9]{20}\.(png|jpg|webp|gif|svg)$/.test(String(image.file))) continue;
      if (db.prepare('SELECT 1 FROM images WHERE id = ?').get(String(image.id))) continue;
      writeFileSync(join(imagesDir, String(image.file)), Buffer.from(String(image.data), 'base64'));
      db.prepare('INSERT INTO images (id, owner_id, model, prompt, seed, mime, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(String(image.id), String(image.owner_id), String(image.model), String(image.prompt), Number(image.seed) || 0, String(image.mime), Number(image.created_at) || Date.now());
      restoredImages += 1;
    }
    mkdirSync(userSkillsDir, { recursive: true });
    let restoredSkills = 0;
    for (const skill of (snapshot.skills as Array<{ name: string; content: string }>) || []) {
      if (!/^[a-z0-9][a-z0-9_.-]{0,80}\.(json|js)$/.test(skill.name) || existsSync(join(userSkillsDir, skill.name))) continue;
      writeFileSync(join(userSkillsDir, skill.name), skill.content);
      restoredSkills += 1;
    }
    return { restored: chosen, memories: restoredMemories, skipped, images: restoredImages, skills: restoredSkills, snapshotCreatedAt: snapshot.createdAt };
  }

  async function list() { return target ? target.list() : []; }

  return Object.freeze({ backupNow, restore, list, collect, get last() { return lastResult; }, configured: Boolean(target && passphrase) });
}
export type BackupService = ReturnType<typeof createBackupService>;
