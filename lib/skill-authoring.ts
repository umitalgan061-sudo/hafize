// @ts-nocheck
// Skill authoring: turns a natural-language skill request into a validated manifest that is written
// to the user skills folder and registered live, so the agent can learn a repeatable capability once
// and keep it instead of re-deriving it from scratch on every request.
//
// Safety model: the manifest goes through the exact same normalizer as built-in skills
// (normalizeSkillManifest), the agent may not declare a tool it cannot itself use, sandbox handlers
// are health-checked before registration, and the previous version stays undoable via action_undo.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeSkillManifest, containsSecretMaterial } from './skills-manifest.ts';
import type { SandboxRunner } from './sandbox-runner.ts';

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const HANDLER_FILE = /^[a-z0-9][a-z0-9_-]{0,63}\.js$/;
const MAX_CODE_BYTES = 40_000;
const MAX_MANIFEST_BYTES = 32_768;

export class SkillAuthoringError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'SkillAuthoringError'; this.code = code; this.status = status }
}

function fail(code: string, status = 400): never {
  throw new SkillAuthoringError(code, status);
}

export interface SkillAuthoringDeps {
  /** Registers the finished manifest into the skills registry (source: 'user'). */
  readonly register: (manifest: unknown) => void;
  readonly unregister: (name: string) => void;
  readonly has: (name: string) => boolean;
  /** Folder holding the user skills (skills/user). */
  readonly userSkillsDir: string;
  readonly sandbox: SandboxRunner;
  /** Permissions the authoring agent already holds; a skill may not ask for more. */
  readonly authorizeTool: (tool: string) => { readonly allowed: boolean; readonly reason?: string };
  readonly now?: () => Date;
}

export interface SkillCreateRequest {
  readonly manifest: Record<string, unknown>;
  readonly code?: string;
  readonly healthCheck?: Record<string, unknown>;
}

export interface SkillCreateResult {
  readonly created: true;
  readonly name: string;
  readonly version: string;
  readonly execution: string;
  readonly riskLevel: string;
  readonly sideEffects: Readonly<Record<string, boolean>>;
  readonly tools: readonly string[];
}

/** Semver bump helper: null -> 1.0.0, 1.2.3 -> 1.2.4 (major/minor/patch supported). */
export function nextVersion(previous: string | null, level: 'major' | 'minor' | 'patch' = 'patch'): string {
  if (!previous) return '1.0.0';
  const parts = SEMVER.exec(previous);
  if (!parts) return '1.0.0';
  let major = Number(parts[1]);
  let minor = Number(parts[2]);
  let patch = Number(parts[3]);
  if (level === 'major') { major += 1; minor = 0; patch = 0; }
  else if (level === 'minor') { minor += 1; patch = 0; }
  else patch += 1;
  return `${major}.${minor}.${patch}`;
}

/**
 * Reads the installed version of a user skill from its sidecar meta file. The version deliberately
 * never enters the manifest: the shared manifest contract has no version field.
 */
export function readSkillVersion(dir: string, name: string): string | null {
  const file = join(dir, `${name}.meta.json`);
  if (!existsSync(file)) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const version = typeof parsed.version === 'string' ? parsed.version.trim() : '';
    return version || null;
  } catch {
    return null;
  }
}

/**
 * Creates or updates a user skill end to end:
 *   validate manifest -> check tool authorization -> back up current files -> (optional) sandbox
 *   health check -> write files -> register live.
 * Any failure before registration restores the previous files, so a rejected skill never half-installs.
 */
export function createSkillAuthoringService(deps: SkillAuthoringDeps) {
  const now = deps.now ?? (() => new Date());

  function assertCodeSafe(code: string): void {
    if (typeof code !== 'string' || !code.trim()) fail('INVALID_SKILL_CODE');
    if (Buffer.byteLength(code, 'utf8') > MAX_CODE_BYTES) fail('SKILL_CODE_TOO_LARGE');
    // The sandbox is the real boundary; these patterns only stop obviously dangerous shapes early.
    if (/\brequire\s*\(|\bprocess\.(?:env|binding|exit)\b|child_process|node:fs\b|node:child_process|Deno\.|Bun\./.test(code)) fail('SKILL_CODE_FORBIDDEN_API');
  }

  async function create(request: SkillCreateRequest): Promise<SkillCreateResult> {
    const manifest = request?.manifest;
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) fail('INVALID_SKILL_MANIFEST');

    // 1. Normalize through the shared manifest contract (throws coded errors).
    const normalized = normalizeSkillManifest(manifest) as unknown as Record<string, unknown>;
    const name = String(normalized.name);
    const handler = normalized.handler as { type?: string; file?: string; network?: boolean; timeoutMs?: number } | null;

    // 2. The agent cannot mint a skill that is more privileged than itself.
    const requested = [...(normalized.allowedTools as string[]), ...(normalized.requiredScopes as string[])] as string[];
    const unauthorized = requested.filter((tool) => {
      const decision = deps.authorizeTool(tool);
      return !decision.allowed && decision.reason !== 'approval_required';
    });
    if (unauthorized.length) fail(`SKILL_TOOL_ESCALATION:${unauthorized[0]}`, 403);

    // 3. Code contract for sandbox handlers.
    let code: string | null = null;
    if (handler?.type === 'sandbox') {
      code = typeof request.code === 'string' ? request.code : '';
      assertCodeSafe(code);
      if (containsSecretMaterial(code)) fail('SKILL_CODE_SECRET_MATERIAL');
      if (!HANDLER_FILE.test(String(handler.file))) fail('INVALID_SKILL_HANDLER_FILE');
    } else if (request.code !== undefined && String(request.code).trim()) {
      // Code without a sandbox handler is meaningless; refuse rather than silently drop it.
      fail('SKILL_CODE_WITHOUT_HANDLER');
    }

    if (Buffer.byteLength(JSON.stringify(manifest), 'utf8') > MAX_MANIFEST_BYTES) fail('SKILL_MANIFEST_TOO_LARGE');

    // 4. Versioning + rollback paths.
    const dir = deps.userSkillsDir;
    const previousVersion = readSkillVersion(dir, name);
    const isUpdate = deps.has(name);
    const version = nextVersion(previousVersion, 'patch');
    const manifestFile = join(dir, `${name}.json`);
    const metaFile = join(dir, `${name}.meta.json`);
    const handlerFile = handler?.type === 'sandbox' ? join(dir, String(handler.file)) : null;
    const tracked = [manifestFile, metaFile, handlerFile].filter(Boolean) as string[];
    const backup = join(dir, '.backup', `${name}-${Date.now()}`);
    mkdirSync(dir, { recursive: true });
    mkdirSync(backup, { recursive: true });
    const snapshotOf = (file: string) => join(backup, file.slice(dir.length + 1));

    // Restores the pre-call state: current files are removed, snapshots are put back.
    const restore = () => {
      for (const file of tracked) {
        rmSync(file, { force: true });
        const snapshot = snapshotOf(file);
        if (existsSync(snapshot)) {
          try { writeFileSync(file, readFileSync(snapshot)); } catch { /* best effort */ }
        }
      }
      rmSync(backup, { recursive: true, force: true });
    };

    try {
      // 5. Back up the current files first, so any later failure can restore them.
      for (const file of tracked) {
        if (!existsSync(file)) continue;
        const snapshot = snapshotOf(file);
        mkdirSync(join(snapshot, '..'), { recursive: true });
        writeFileSync(snapshot, readFileSync(file));
      }

      // 6. Health-check sandbox code before it becomes reachable through skill_invoke.
      if (handler?.type === 'sandbox' && code) {
        const check = await deps.sandbox.run({
          code,
          input: { args: request.healthCheck || {} },
          timeoutMs: Number(handler.timeoutMs) || 5_000,
          permissions: { network: handler.network === true }
        });
        if (!check.ok) fail('SKILL_HEALTH_CHECK_FAILED', 422);
      }

      // 7. Write the new files.
      writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
      writeFileSync(metaFile, JSON.stringify({ name, version, updatedAt: now().toISOString() }, null, 2));
      if (handlerFile && code) writeFileSync(handlerFile, code);

      // 8. Register live (replacing any previous version under the same name).
      if (isUpdate) deps.unregister(name);
      deps.register(manifest);
    } catch (error) {
      restore();
      throw error;
    } finally {
      rmSync(backup, { recursive: true, force: true });
    }

    return {
      created: true,
      name,
      version,
      execution: String(normalized.execution),
      riskLevel: String(normalized.riskLevel),
      sideEffects: normalized.sideEffects as Readonly<Record<string, boolean>>,
      tools: normalized.allowedTools as string[]
    };
  }

  return Object.freeze({
    create,
    nextVersion,
    readSkillVersion: (name: string) => readSkillVersion(deps.userSkillsDir, name),
    actionIdFor: (name: string, version: string) => `skill_create:${name}:${createHash('sha256').update(`${name}@${version}`).digest('hex').slice(0, 12)}`
  });
}

export type SkillAuthoringService = ReturnType<typeof createSkillAuthoringService>;
