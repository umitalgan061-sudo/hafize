// Signed skill bundles and the auto-update channel. A bundle carries a skill manifest, its sandbox
// code and a version, signed with Ed25519. Installation: verify signature against trusted keys ->
// write files (old version backed up) -> health check (manifest validation + a sandbox run of the
// bundle's health-check input) -> keep, or roll back to the backup when anything fails.
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeSkillManifest } from './skills-manifest.ts';
import type { SandboxRunner } from './sandbox-runner.ts';

type Json = Record<string, unknown>;
export const BUNDLE_FORMAT = 'hafize-skill-bundle/v1';
const NAME = /^[a-z][a-z0-9-]{1,63}$/;
const SEMVER = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/;

export interface SkillBundle {
  readonly format: string;
  readonly name: string;
  readonly version: string;
  readonly manifest: Json;
  readonly code?: string;
  readonly healthCheck?: { readonly args?: Json };
  readonly publishedAt: string;
  readonly keyId?: string;
  readonly signature?: string;
}

export class SkillBundleError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'SkillBundleError'; this.code = code; this.status = status; }
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  return `{${Object.keys(value as Json).sort().map((key) => `${JSON.stringify(key)}:${canonical((value as Json)[key])}`).join(',')}}`;
}

/** The exact bytes that are signed: every field except keyId and signature, keys sorted. */
export function bundlePayload(bundle: SkillBundle): Buffer {
  const { keyId: _keyId, signature: _signature, ...rest } = bundle;
  return Buffer.from(canonical(rest), 'utf8');
}

export function compareSemver(a: string, b: string): number {
  const left = SEMVER.exec(a); const right = SEMVER.exec(b);
  if (!left || !right) return a.localeCompare(b);
  for (let index = 1; index <= 3; index += 1) {
    const diff = Number(left[index]) - Number(right[index]);
    if (diff) return Math.sign(diff);
  }
  return 0;
}

export function generateSigningKeys(): { publicKeyPem: string; privateKeyPem: string; keyId: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  return { publicKeyPem, privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), keyId: keyIdOf(publicKeyPem) };
}

export function keyIdOf(publicKeyPem: string): string {
  return createHash('sha256').update(createPublicKey(publicKeyPem).export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);
}

export function signBundle(bundle: SkillBundle, privateKeyPem: string): SkillBundle {
  const key = createPrivateKey(privateKeyPem);
  const keyId = keyIdOf(createPublicKey(key).export({ type: 'spki', format: 'pem' }).toString());
  const unsigned = { ...bundle };
  delete (unsigned as { signature?: string }).signature;
  delete (unsigned as { keyId?: string }).keyId;
  return { ...unsigned, keyId, signature: sign(null, bundlePayload(unsigned), key).toString('base64') };
}

/** Trusted public keys: every *.pem / *.pub file in the folder, indexed by key id. */
export function loadTrustedKeys(dir: string): Map<string, string> {
  const keys = new Map<string, string>();
  if (!existsSync(dir)) return keys;
  for (const file of readdirSync(dir).filter((name) => /\.(pem|pub)$/.test(name))) {
    try {
      const pem = readFileSync(join(dir, file), 'utf8');
      keys.set(keyIdOf(pem), pem);
    } catch { /* unreadable key files are ignored */ }
  }
  return keys;
}

export function verifyBundle(raw: unknown, trustedKeys: ReadonlyMap<string, string>): SkillBundle {
  const bundle = raw as SkillBundle;
  if (!bundle || typeof bundle !== 'object' || bundle.format !== BUNDLE_FORMAT) throw new SkillBundleError('INVALID_BUNDLE_FORMAT');
  if (!NAME.test(String(bundle.name)) || !SEMVER.test(String(bundle.version))) throw new SkillBundleError('INVALID_BUNDLE_IDENTITY');
  if (!bundle.manifest || typeof bundle.manifest !== 'object' || bundle.manifest.name !== bundle.name) throw new SkillBundleError('BUNDLE_MANIFEST_MISMATCH');
  if (bundle.code !== undefined && (typeof bundle.code !== 'string' || bundle.code.length > 40_000)) throw new SkillBundleError('INVALID_BUNDLE_CODE');
  const publicKey = trustedKeys.get(String(bundle.keyId || ''));
  if (!publicKey || typeof bundle.signature !== 'string') throw new SkillBundleError('BUNDLE_SIGNER_NOT_TRUSTED', 403);
  let valid = false;
  try { valid = verify(null, bundlePayload(bundle), createPublicKey(publicKey), Buffer.from(bundle.signature, 'base64')); } catch { valid = false; }
  if (!valid) throw new SkillBundleError('BUNDLE_SIGNATURE_INVALID', 403);
  return bundle;
}

export function installedVersion(dir: string, name: string): string | null {
  try { return String((JSON.parse(readFileSync(join(dir, `${name}.bundle.json`), 'utf8')) as Json).version || '') || null; } catch { return null; }
}

/** Verifies, installs, health-checks and - on failure - rolls back a skill bundle. */
export async function installBundle({ raw, trustedKeys, dir, sandbox, onInstalled }: {
  readonly raw: unknown; readonly trustedKeys: ReadonlyMap<string, string>; readonly dir: string; readonly sandbox: SandboxRunner;
  readonly onInstalled?: ((manifest: Json) => void) | undefined;
}): Promise<{ installed: true; name: string; version: string; previousVersion: string | null }> {
  const bundle = verifyBundle(raw, trustedKeys);
  const previousVersion = installedVersion(dir, bundle.name);
  if (previousVersion && compareSemver(bundle.version, previousVersion) <= 0) throw new SkillBundleError('BUNDLE_NOT_NEWER', 409);
  const manifest = normalizeSkillManifest(bundle.manifest) as unknown as Json;
  const handler = manifest.handler as Json | null;
  if (handler?.type === 'sandbox' && !bundle.code) throw new SkillBundleError('BUNDLE_CODE_MISSING');
  mkdirSync(dir, { recursive: true });
  const files = [`${bundle.name}.json`, `${bundle.name}.bundle.json`, ...(handler?.type === 'sandbox' ? [String(handler.file)] : [])];
  const backupDir = join(dir, '.backup', `${bundle.name}-${Date.now()}`);
  mkdirSync(backupDir, { recursive: true });
  for (const file of files) if (existsSync(join(dir, file))) copyFileSync(join(dir, file), join(backupDir, file));
  const rollback = () => {
    for (const file of files) {
      rmSync(join(dir, file), { force: true });
      if (existsSync(join(backupDir, file))) renameSync(join(backupDir, file), join(dir, file));
    }
  };
  try {
    writeFileSync(join(dir, `${bundle.name}.json`), JSON.stringify(bundle.manifest, null, 2));
    if (handler?.type === 'sandbox') writeFileSync(join(dir, String(handler.file)), bundle.code!);
    writeFileSync(join(dir, `${bundle.name}.bundle.json`), JSON.stringify({ name: bundle.name, version: bundle.version, keyId: bundle.keyId, publishedAt: bundle.publishedAt, installedAt: new Date().toISOString() }, null, 2));
    if (handler?.type === 'sandbox') {
      const check = await sandbox.run({ code: bundle.code!, input: { args: bundle.healthCheck?.args || {} }, timeoutMs: Number(handler.timeoutMs) || 5_000, permissions: { network: handler.network === true } });
      if (!check.ok) throw Object.assign(new SkillBundleError('BUNDLE_HEALTH_CHECK_FAILED', 422), { detail: check.error });
    }
    onInstalled?.(bundle.manifest);
  } catch (error) {
    rollback();
    throw error;
  } finally {
    rmSync(backupDir, { recursive: true, force: true });
  }
  return { installed: true, name: bundle.name, version: bundle.version, previousVersion };
}

/** Polls a feed ({ bundles: [{ url }] }) and installs newer signed bundles. Off unless a feed URL is set. */
export function createSkillUpdateChannel({ feedUrl, intervalMs = 6 * 60 * 60 * 1000, install, fetchImpl = globalThis.fetch }: {
  readonly feedUrl: string; readonly intervalMs?: number; readonly install: (raw: unknown) => Promise<unknown>; readonly fetchImpl?: typeof fetch;
}) {
  let timer: ReturnType<typeof setInterval> | null = null;
  const log: Array<{ at: string; url: string; result: string }> = [];
  async function checkNow() {
    if (!/^https:\/\//.test(feedUrl)) return { checked: 0, installed: 0 };
    const feed = await (await fetchImpl(feedUrl, { signal: AbortSignal.timeout(15_000) })).json() as { bundles?: Array<{ url?: string }> };
    let installed = 0;
    for (const entry of (feed.bundles || []).slice(0, 20)) {
      const url = String(entry.url || '');
      if (!/^https:\/\//.test(url)) continue;
      try {
        const bundle = await (await fetchImpl(url, { signal: AbortSignal.timeout(15_000) })).json();
        await install(bundle);
        installed += 1;
        log.push({ at: new Date().toISOString(), url, result: 'installed' });
      } catch (error) {
        log.push({ at: new Date().toISOString(), url, result: String((error as { code?: string }).code || (error as Error).message).slice(0, 80) });
      }
    }
    log.splice(0, Math.max(0, log.length - 50));
    return { checked: feed.bundles?.length || 0, installed };
  }
  function start() {
    if (timer || !feedUrl) return;
    timer = setInterval(() => { void checkNow().catch(() => {}); }, intervalMs);
    timer.unref?.();
  }
  function stop() { if (timer) clearInterval(timer); timer = null; }
  return Object.freeze({ checkNow, start, stop, log });
}
