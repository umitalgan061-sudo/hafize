// Skill SDK for authors: defineSkill(manifest, handler) -> a validated manifest plus the sandbox
// code generated from the handler function, testSkill() runs it in the real sandbox and checks the
// declared return schema, packSkill() produces an (unsigned) bundle for signing and publishing.
import { normalizeSkillManifest } from './skills-manifest.ts';
import { validateJsonSchema } from './expert-registry.ts';
import { BUNDLE_FORMAT, type SkillBundle } from './skill-bundles.ts';
import type { SandboxRunner } from './sandbox-runner.ts';

type Json = Record<string, unknown>;
export type SkillHandler = (input: { args: Json }) => unknown;

export interface DefinedSkill {
  readonly manifest: Json;
  readonly code: string;
}

/** Turns a handler function into sandbox code: the function source is evaluated inside the sandbox. */
export function handlerToCode(handler: SkillHandler | string): string {
  if (typeof handler === 'string') return handler;
  const source = handler.toString();
  if (/\[native code\]/.test(source)) throw new Error('SKILL_HANDLER_NOT_SERIALIZABLE');
  return `const handler = (${source});\nreturn await handler(input);`;
}

export function defineSkill(manifest: Json, handler: SkillHandler | string, { network = false, timeoutMs = 5_000 }: { readonly network?: boolean; readonly timeoutMs?: number } = {}): DefinedSkill {
  const name = String(manifest.name || '');
  const withHandler = { ...manifest, handler: { type: 'sandbox', file: `${name}.js`, network, timeoutMs } };
  normalizeSkillManifest(withHandler);
  return Object.freeze({ manifest: withHandler, code: handlerToCode(handler) });
}

export async function testSkill(skill: DefinedSkill, args: Json, sandbox: SandboxRunner) {
  const manifest = normalizeSkillManifest(skill.manifest) as unknown as Json;
  const handler = manifest.handler as { network?: boolean; timeoutMs?: number } | null;
  const run = await sandbox.run({ code: skill.code, input: { args }, timeoutMs: handler?.timeoutMs ?? 5_000, permissions: { network: handler?.network === true } });
  const schemaErrors = run.ok && manifest.returns ? validateJsonSchema(run.result, manifest.returns as Json) : [];
  return { ok: run.ok && !schemaErrors.length, result: run.result, error: run.error, schemaErrors, logs: run.logs, durationMs: run.durationMs };
}

export function packSkill(skill: DefinedSkill, version: string, healthCheckArgs: Json = {}): SkillBundle {
  return {
    format: BUNDLE_FORMAT,
    name: String(skill.manifest.name),
    version,
    manifest: skill.manifest,
    code: skill.code,
    healthCheck: { args: healthCheckArgs },
    publishedAt: new Date().toISOString()
  };
}
