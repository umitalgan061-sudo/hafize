// Executes skills end to end: consent (asked inline through the approval gate when missing),
// idempotency key, execution (a runtime tool or user code in the sandbox), return-schema check,
// audit record with argument/result hashes, telemetry span and - for mutating skills with a
// compensate handler - an undo entry in the action journal. Skills without a handler keep the
// old behaviour: they resolve to a prompt and a tool scope for the model.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createIdempotencyStore, hashInvocation, type IdempotencyStore } from './skill-idempotency.ts';
import { validateJsonSchema } from './expert-registry.ts';
import type { SandboxRunner } from './sandbox-runner.ts';
import type { Telemetry } from './telemetry.ts';
import type { ActionJournal } from './action-journal.ts';

type Json = Record<string, unknown>;
type Handler = { type: 'tool'; tool: string } | { type: 'sandbox'; file: string; network: boolean; timeoutMs: number };
export type ToolInvoker = (tool: string, args: Json, context: { readonly signal?: AbortSignal | undefined }) => Promise<{ ok: boolean; value?: unknown; error?: string }>;
export type ConsentApprover = (request: { readonly skillId: string; readonly description: string; readonly scopes: readonly string[]; readonly riskLevel: string; readonly arguments: unknown }) => Promise<{ approved: boolean; mode: string }>;

interface SkillsRuntimeLike {
  readonly registry: { register(manifest: unknown, options: { source: string }): unknown; get(name: string): { manifest: Json } | null };
  readonly consentRuntime: { grant(input: Json): unknown };
  readonly auditLog: { record(entry: Json): unknown };
  resolveForAgent(input: Json): unknown;
}

export class SkillExecutionError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, status = 400) { super(code); this.name = 'SkillExecutionError'; this.code = code; this.status = status; }
}

/** Loads user skills (skills/user/*.json, code next to them) into the registry; bad files are reported, not fatal. */
export function registerUserSkills(runtime: Pick<SkillsRuntimeLike, 'registry'>, dir: string): { loaded: string[]; errors: { file: string; error: string }[] } {
  const loaded: string[] = [];
  const errors: { file: string; error: string }[] = [];
  if (!existsSync(dir)) return { loaded, errors };
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json')).slice(0, 64)) {
    try {
      const manifest = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Json;
      const handler = manifest.handler as Json | undefined;
      if (handler?.type === 'sandbox' && !existsSync(join(dir, String(handler.file)))) throw new Error('SKILL_HANDLER_FILE_MISSING');
      runtime.registry.register(manifest, { source: 'user' });
      loaded.push(String(manifest.name));
    } catch (error) {
      errors.push({ file, error: String((error as { code?: string })?.code || (error as Error).message).slice(0, 200) });
    }
  }
  return { loaded, errors };
}

export function createSkillExecutor({ skillsRuntime, sandbox, invokeTool, telemetry = null, journal = null, userSkillsDir, idempotencyStore = createIdempotencyStore({ ttlMs: 10 * 60 * 1000, maxEntries: 2_000 }) }: {
  readonly skillsRuntime: SkillsRuntimeLike;
  readonly sandbox: SandboxRunner;
  readonly invokeTool: ToolInvoker;
  readonly telemetry?: Telemetry | null;
  readonly journal?: ActionJournal | null;
  readonly userSkillsDir: string;
  readonly idempotencyStore?: IdempotencyStore;
}) {
  if (journal) {
    // Skill compensations run through the same machinery as the skill itself.
    journal.registerCompensator('skill', async (payload) => {
      const handler = payload.handler as Handler;
      return runHandler(handler, (payload.args || {}) as Json, { previous: payload.result });
    });
  }

  async function runHandler(handler: Handler, args: Json, extra: Json = {}, signal?: AbortSignal): Promise<unknown> {
    if (handler.type === 'tool') {
      const result = await invokeTool(handler.tool, args, { signal });
      if (!result.ok) throw new SkillExecutionError(result.error || 'SKILL_TOOL_FAILED', 502);
      return result.value;
    }
    const code = readFileSync(join(userSkillsDir, handler.file), 'utf8');
    const run = await sandbox.run({ code, input: { args, ...extra }, timeoutMs: handler.timeoutMs, permissions: { network: handler.network }, signal });
    if (!run.ok) throw Object.assign(new SkillExecutionError(run.error || 'SKILL_SANDBOX_FAILED', 502), { logs: run.logs });
    return run.result;
  }

  async function invoke({ agent, skillId, args = {}, traceId, ownerId, sessionId, idemKey, approveConsent, signal }: {
    readonly agent: unknown; readonly skillId: unknown; readonly args?: unknown; readonly traceId: string; readonly ownerId?: string | undefined; readonly sessionId?: string | undefined;
    readonly idemKey?: unknown; readonly approveConsent?: ConsentApprover | undefined; readonly signal?: AbortSignal | undefined;
  }): Promise<Json> {
    const id = typeof skillId === 'string' ? skillId.trim() : '';
    const span = telemetry?.startSpan('skill.start', { traceId, attributes: { 'skill.id': id } });
    const resolve = () => skillsRuntime.resolveForAgent({ agent, skillId: id, args, traceId, ownerId, sessionId, approvalGranted: false }) as Json | null;
    try {
      let invocation: Json | null;
      try {
        invocation = resolve();
      } catch (error) {
        const consent = (error as { consent?: Json }).consent;
        if ((error as { code?: string }).code !== 'SKILL_CONSENT_REQUIRED' || !consent || !approveConsent) throw error;
        // Ask the user right now instead of failing the call.
        const decision = await approveConsent({ skillId: id, description: String(consent.description || ''), scopes: (consent.scopes || []) as string[], riskLevel: String(consent.riskLevel || ''), arguments: consent.arguments });
        if (!decision.approved) throw new SkillExecutionError(decision.mode === 'never' ? 'SKILL_CONSENT_DENIED' : 'SKILL_CONSENT_REQUIRED', 403);
        skillsRuntime.consentRuntime.grant({ ownerId, sessionId, skillId: id, scopes: consent.scopes, mode: decision.mode, ...(decision.mode === 'once' ? { argsHash: consent.argsHash } : {}) });
        invocation = resolve();
      }
      if (!invocation) throw new SkillExecutionError('UNKNOWN_SKILL', 404);
      const handler = invocation.handler as Handler | null;
      if (!handler) {
        span?.end('ok', { 'skill.kind': 'prompt' });
        return { kind: 'prompt', skill: invocation.name, tools: invocation.tools, arguments: invocation.arguments, prompt: invocation.prompt, consentId: invocation.consentId, riskLevel: invocation.riskLevel, note: 'Bu skill çalıştırılabilir değil; talimatı (prompt) izleyerek listelenen araçlarla görevi sen yap.' };
      }
      const skillArgs = (invocation.arguments || {}) as Json;
      const key = typeof idemKey === 'string' && idemKey.trim() ? `${ownerId}:${idemKey.trim()}` : hashInvocation(id, skillArgs, ownerId, sessionId);
      const sideEffects = (invocation.sideEffects || {}) as { idempotent?: boolean; mutates?: boolean };
      if (sideEffects.idempotent !== false && idempotencyStore.has(key)) {
        span?.end('ok', { 'skill.idempotent_hit': true });
        return { ...(idempotencyStore.get(key) as Json), idempotentReplay: true };
      }
      skillsRuntime.auditLog.record({ stage: 'started', traceId, agentId: (agent as { id?: string })?.id, skillId: id, arguments: skillArgs, consentId: invocation.consentId });
      let result: unknown;
      try {
        result = await runHandler(handler, skillArgs, {}, signal);
      } catch (error) {
        skillsRuntime.auditLog.record({ stage: 'error', traceId, agentId: (agent as { id?: string })?.id, skillId: id, arguments: skillArgs, consentId: invocation.consentId, result: { error: (error as { code?: string }).code || 'SKILL_FAILED' } });
        throw error;
      }
      const returns = invocation.returns as Json | null;
      if (returns) {
        const errors = validateJsonSchema(result, returns);
        if (errors.length) throw Object.assign(new SkillExecutionError('SKILL_RETURN_SCHEMA_MISMATCH', 502), { detail: errors.slice(0, 5) });
      }
      skillsRuntime.auditLog.record({ stage: 'completed', traceId, agentId: (agent as { id?: string })?.id, skillId: id, arguments: skillArgs, consentId: invocation.consentId, result });
      let actionId = '';
      const compensate = invocation.compensate as Handler | null;
      if (journal && ownerId && sideEffects.mutates && compensate) {
        actionId = journal.record({ ownerId, traceId, tool: `skill:${id}`, summary: `${id} skill çalıştırıldı`, compensation: { type: 'skill', payload: { handler: compensate, args: skillArgs, result } } });
      }
      const output = { kind: 'result', skill: id, result, consentId: invocation.consentId || '', ...(actionId ? { actionId, undo: 'Bu işlem action_undo ile geri alınabilir.' } : {}) };
      if (sideEffects.idempotent !== false) idempotencyStore.set(key, output);
      span?.end('ok', { 'skill.kind': handler.type });
      return output;
    } catch (error) {
      span?.end('error', { 'error.code': String((error as { code?: string }).code || 'SKILL_FAILED') });
      throw error;
    }
  }

  return Object.freeze({ invoke });
}
export type SkillExecutor = ReturnType<typeof createSkillExecutor>;
