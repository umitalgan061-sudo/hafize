import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const MODES = new Set(['once', 'session', 'always', 'never']);
const MAX_ENTRIES = 10_000;
type ConsentMode = 'once' | 'session' | 'always' | 'never';
type GrantInput = { ownerId?: unknown; sessionId?: unknown; skillId?: unknown; scopes?: unknown; mode?: unknown; argsHash?: unknown };
type AuthorizeInput = { ownerId?: unknown; sessionId?: unknown; skillId?: unknown; scopes?: unknown; argsHash?: unknown };
type RevokeInput = { ownerId?: unknown; skillId?: unknown; scope?: unknown };

function identity(value: unknown, field: string, max = 200): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.length > max || /[\0\r\n]/.test(text)) throw new Error(`INVALID_SKILL_CONSENT:${field}`);
  return text;
}

function scopeList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 32) throw new Error('INVALID_SKILL_CONSENT:scopes');
  const scopes = value.map((item) => identity(item, 'scope', 120));
  if (new Set(scopes).size !== scopes.length) throw new Error('INVALID_SKILL_CONSENT:duplicate_scope');
  return scopes.sort();
}

function policyKey(ownerId: string, skillId: string, scope: string): string {
  return JSON.stringify([ownerId, skillId, scope]);
}

export function createSkillConsentRuntime({ filePath = resolve('data/skill-consents.json'), now = () => Date.now(), randomId = randomUUID } = {}) {
  if (typeof filePath !== 'string' || !filePath.trim()) throw new Error('INVALID_SKILL_CONSENT:filePath');
  if (typeof now !== 'function' || typeof randomId !== 'function') throw new Error('INVALID_SKILL_CONSENT:dependencies');
  const resolvedPath = resolve(filePath);
  const persistent = new Map<string, { ownerId: string; skillId: string; scope: string; mode: 'always' | 'never'; consentId: string; createdAt: number }>();
  const ephemeral = new Map<string, { ownerId: string; skillId: string; scope: string; mode: 'once' | 'session'; sessionId: string; consentId: string; createdAt: number; argsHash?: string }>();

  function persist() {
    const entries = [...persistent.values()].sort((a, b) => policyKey(a.ownerId, a.skillId, a.scope).localeCompare(policyKey(b.ownerId, b.skillId, b.scope)));
    if (entries.length > MAX_ENTRIES) throw new Error('SKILL_CONSENT_CAPACITY_REACHED');
    mkdirSync(dirname(resolvedPath), { recursive: true });
    const tempPath = resolvedPath + '.' + randomId() + '.tmp';
    try {
      writeFileSync(tempPath, JSON.stringify({ schemaVersion: 1, entries }), { encoding: 'utf8', flag: 'wx' });
      renameSync(tempPath, resolvedPath);
    } catch (error) {
      try { unlinkSync(tempPath); } catch {}
      throw error;
    }
  }

  try {
    const parsed = JSON.parse(readFileSync(resolvedPath, 'utf8')) as { schemaVersion?: unknown; entries?: unknown };
    if (parsed?.schemaVersion !== 1 || !Array.isArray(parsed.entries) || parsed.entries.length > MAX_ENTRIES) throw new Error('INVALID_SKILL_CONSENT_STORE');
    for (const item of parsed.entries) {
      if (!item || typeof item !== 'object' || (item.mode !== 'always' && item.mode !== 'never')) throw new Error('INVALID_SKILL_CONSENT_STORE');
      const ownerId = identity(item.ownerId, 'ownerId');
      const skillId = identity(item.skillId, 'skillId', 64);
      const scope = identity(item.scope, 'scope', 120);
      const consentId = identity(item.consentId, 'consentId', 120);
      if (!Number.isSafeInteger(item.createdAt)) throw new Error('INVALID_SKILL_CONSENT_STORE');
      persistent.set(policyKey(ownerId, skillId, scope), { ownerId, skillId, scope, mode: item.mode, consentId, createdAt: item.createdAt });
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }

  function grant({ ownerId: rawOwner, sessionId: rawSession, skillId: rawSkill, scopes: rawScopes, mode: rawMode, argsHash: rawArgsHash }: GrantInput = {}) {
    const ownerId = identity(rawOwner, 'ownerId');
    const skillId = identity(rawSkill, 'skillId', 64);
    const scopes = scopeList(rawScopes);
    const mode = typeof rawMode === 'string' ? rawMode : '';
    if (!MODES.has(mode)) throw new Error('INVALID_SKILL_CONSENT:mode');
    const checkedMode = mode as ConsentMode;
    const sessionId = checkedMode === 'once' || checkedMode === 'session' ? identity(rawSession, 'sessionId', 160) : '';
    const argsHash = checkedMode === 'once' ? identity(rawArgsHash, 'argsHash', 64) : undefined;
    if (checkedMode === 'once' && !/^[a-f0-9]{64}$/.test(argsHash!)) throw new Error('INVALID_SKILL_CONSENT:argsHash');
    const consentId = identity(randomId(), 'consentId', 120);
    const createdAt = now();
    if (!Number.isSafeInteger(createdAt) || createdAt < 0) throw new Error('INVALID_SKILL_CONSENT:clock');

    const previous = scopes.map((scope) => {
      const key = policyKey(ownerId, skillId, scope);
      return { key, persistent: persistent.get(key), ephemeral: ephemeral.get(key) };
    });
    try {
      for (const scope of scopes) {
        const key = policyKey(ownerId, skillId, scope);
        persistent.delete(key);
        ephemeral.delete(key);
        if (checkedMode === 'always' || checkedMode === 'never') persistent.set(key, { ownerId, skillId, scope, mode: checkedMode, consentId, createdAt });
        else ephemeral.set(key, { ownerId, skillId, scope, mode: checkedMode, sessionId, consentId, createdAt, ...(argsHash ? { argsHash } : {}) });
      }
      if (ephemeral.size > MAX_ENTRIES) throw new Error('SKILL_CONSENT_CAPACITY_REACHED');
      persist();
    } catch (error) {
      for (const previousEntry of previous) {
        persistent.delete(previousEntry.key);
        ephemeral.delete(previousEntry.key);
        if (previousEntry.persistent) persistent.set(previousEntry.key, previousEntry.persistent);
        if (previousEntry.ephemeral) ephemeral.set(previousEntry.key, previousEntry.ephemeral);
      }
      throw error;
    }
    return Object.freeze({ consentId, ownerId, skillId, scopes: Object.freeze(scopes), mode: checkedMode, createdAt });
  }

  function authorize({ ownerId: rawOwner, sessionId: rawSession, skillId: rawSkill, scopes: rawScopes, argsHash: rawArgsHash }: AuthorizeInput = {}) {
    const ownerId = identity(rawOwner, 'ownerId');
    const skillId = identity(rawSkill, 'skillId', 64);
    const scopes = scopeList(rawScopes);
    const sessionId = typeof rawSession === 'string' ? rawSession : '';
    const argsHash = typeof rawArgsHash === 'string' ? rawArgsHash : '';
    const matched = [];
    for (const scope of scopes) {
      const key = policyKey(ownerId, skillId, scope);
      const saved = persistent.get(key);
      const temporary = ephemeral.get(key);
      const policy = saved || temporary;
      if (!policy) return Object.freeze({ allowed: false, reason: 'consent_required', missingScope: scope });
      if (policy.mode === 'never') return Object.freeze({ allowed: false, reason: 'consent_denied', deniedScope: scope });
      if (policy.mode === 'session' && policy.sessionId !== sessionId) return Object.freeze({ allowed: false, reason: 'consent_required', missingScope: scope });
      if (policy.mode === 'once' && (policy.sessionId !== sessionId || policy.argsHash !== argsHash)) return Object.freeze({ allowed: false, reason: 'consent_required', missingScope: scope });
      matched.push({ key, policy });
    }
    const once = matched.filter(({ policy }) => policy.mode === 'once');
    if (once.length) {
      for (const { key } of once) ephemeral.delete(key);
      return Object.freeze({ allowed: true, reason: 'once', consentId: once[0].policy.consentId });
    }
    return Object.freeze({ allowed: true, reason: 'consented', consentId: matched[0]?.policy.consentId || '' });
  }

  function list(rawOwner: unknown) {
    const ownerId = identity(rawOwner, 'ownerId');
    return Object.freeze([...persistent.values(), ...ephemeral.values()]
      .filter((entry) => entry.ownerId === ownerId)
      .map((entry) => Object.freeze({ skillId: entry.skillId, scope: entry.scope, mode: entry.mode, consentId: entry.consentId, createdAt: entry.createdAt })));
  }

  function revoke({ ownerId: rawOwner, skillId: rawSkill, scope: rawScope }: RevokeInput = {}) {
    const ownerId = identity(rawOwner, 'ownerId');
    const skillId = identity(rawSkill, 'skillId', 64);
    const scope = identity(rawScope, 'scope', 120);
    const key = policyKey(ownerId, skillId, scope);
    const removedPersistent = persistent.delete(key);
    const removedEphemeral = ephemeral.delete(key);
    const removed = removedPersistent || removedEphemeral;
    if (removed) persist();
    return removed;
  }

  return Object.freeze({ grant, authorize, list, revoke, get filePath() { return resolvedPath; } });
}
