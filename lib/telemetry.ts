// Observability hooks: OpenTelemetry-shaped spans (skill.start/end/error, tool calls, model rounds),
// token usage per model and purpose, and user feedback. Everything is kept in the local database;
// when OTEL_EXPORTER_OTLP_ENDPOINT is set, finished spans are also exported over OTLP/HTTP JSON.
import { randomBytes } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';

type AttributeValue = string | number | boolean;
export type SpanAttributes = Record<string, AttributeValue>;

export interface SpanHandle {
  readonly traceId: string;
  readonly spanId: string;
  setAttribute(key: string, value: AttributeValue): void;
  end(status?: 'ok' | 'error', attributes?: SpanAttributes): number;
}

export interface UsageRecord {
  readonly traceId: string;
  readonly model: string;
  readonly purpose: string;
  readonly promptTokens: number;
  readonly completionTokens: number;
}

const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_ATTRIBUTE_LENGTH = 300;
const EXPORT_BATCH = 200;

function hexTraceId(traceId: string): string {
  const hex = traceId.replace(/-/g, '').toLowerCase();
  return /^[0-9a-f]{32}$/.test(hex) ? hex : randomBytes(16).toString('hex');
}

function cleanAttributes(attributes: SpanAttributes = {}): SpanAttributes {
  const out: SpanAttributes = {};
  for (const [key, value] of Object.entries(attributes).slice(0, 40)) {
    if (typeof value === 'string') out[key] = value.slice(0, MAX_ATTRIBUTE_LENGTH);
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
  }
  return out;
}

export function percentile(sorted: readonly number[], p: number): number {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index]!;
}

export interface TelemetryOptions {
  readonly db: DatabaseSync;
  readonly serviceName?: string;
  readonly otlpEndpoint?: string;
  readonly otlpHeaders?: Record<string, string>;
  readonly costPerMillionTokens?: number;
  readonly now?: () => number;
  readonly fetchImpl?: typeof fetch;
}

export function createTelemetry(options: TelemetryOptions) {
  const { db } = options;
  const now = options.now ?? (() => Date.now());
  const serviceName = options.serviceName || 'hafize';
  const otlpEndpoint = (options.otlpEndpoint || '').replace(/\/+$/, '');
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const costPerMillion = Number.isFinite(options.costPerMillionTokens) ? Number(options.costPerMillionTokens) : 0;
  const insertSpan = db.prepare('INSERT INTO spans (span_id, trace_id, parent_span_id, name, kind, start_ms, end_ms, status, attributes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertUsage = db.prepare('INSERT INTO usage (trace_id, model, purpose, prompt_tokens, completion_tokens, created_at) VALUES (?, ?, ?, ?, ?, ?)');
  const upsertFeedback = db.prepare(`INSERT INTO feedback (owner_id, trace_id, message_id, rating, prompt_variant, created_at) VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(owner_id, message_id) DO UPDATE SET rating = excluded.rating, trace_id = excluded.trace_id, prompt_variant = excluded.prompt_variant, created_at = excluded.created_at`);
  const pendingExport: Array<Record<string, unknown>> = [];
  let exportTimer: ReturnType<typeof setTimeout> | null = null;
  let exportFailures = 0;

  function scheduleExport(span: Record<string, unknown>): void {
    if (!otlpEndpoint) return;
    pendingExport.push(span);
    if (pendingExport.length > EXPORT_BATCH * 5) pendingExport.splice(0, pendingExport.length - EXPORT_BATCH * 5);
    if (!exportTimer) {
      exportTimer = setTimeout(() => { exportTimer = null; void flush(); }, 2_000);
      exportTimer.unref?.();
    }
  }

  async function flush(): Promise<{ exported: number }> {
    if (!otlpEndpoint || !pendingExport.length) return { exported: 0 };
    const batch = pendingExport.splice(0, EXPORT_BATCH);
    const body = {
      resourceSpans: [{
        resource: { attributes: [{ key: 'service.name', value: { stringValue: serviceName } }] },
        scopeSpans: [{ scope: { name: 'hafize' }, spans: batch }]
      }]
    };
    try {
      const response = await fetchImpl(`${otlpEndpoint}/v1/traces`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(options.otlpHeaders || {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5_000)
      });
      if (!response.ok) throw new Error('OTLP_EXPORT_FAILED');
      exportFailures = 0;
      return { exported: batch.length };
    } catch {
      exportFailures += 1;
      if (exportFailures <= 3) pendingExport.unshift(...batch);
      return { exported: 0 };
    }
  }

  function startSpan(name: string, { traceId, parentSpanId, kind = 'internal', attributes = {} }: { readonly traceId: string; readonly parentSpanId?: string | undefined; readonly kind?: string; readonly attributes?: SpanAttributes }): SpanHandle {
    const spanId = randomBytes(8).toString('hex');
    const startMs = now();
    const attrs: SpanAttributes = cleanAttributes(attributes);
    let ended = false;
    return {
      traceId,
      spanId,
      setAttribute(key, value) { Object.assign(attrs, cleanAttributes({ [key]: value })); },
      end(status = 'ok', extra = {}) {
        if (ended) return 0;
        ended = true;
        const endMs = now();
        Object.assign(attrs, cleanAttributes(extra));
        try {
          insertSpan.run(spanId, traceId, parentSpanId || null, name.slice(0, 120), kind, startMs, endMs, status, JSON.stringify(attrs));
        } catch { /* telemetry must never break a request */ }
        scheduleExport({
          traceId: hexTraceId(traceId),
          spanId,
          ...(parentSpanId ? { parentSpanId } : {}),
          name,
          kind: 1,
          startTimeUnixNano: String(BigInt(startMs) * 1_000_000n),
          endTimeUnixNano: String(BigInt(endMs) * 1_000_000n),
          attributes: Object.entries(attrs).map(([key, value]) => ({
            key,
            value: typeof value === 'string' ? { stringValue: value } : typeof value === 'boolean' ? { boolValue: value } : Number.isInteger(value) ? { intValue: String(value) } : { doubleValue: value }
          })),
          status: { code: status === 'ok' ? 1 : 2 }
        });
        return endMs - startMs;
      }
    };
  }

  /** Runs fn inside a span; the span records an error status when fn throws. */
  async function withSpan<T>(name: string, context: { readonly traceId: string; readonly parentSpanId?: string | undefined; readonly attributes?: SpanAttributes }, fn: (span: SpanHandle) => Promise<T>): Promise<T> {
    const span = startSpan(name, context);
    try {
      const result = await fn(span);
      span.end('ok');
      return result;
    } catch (error) {
      span.end('error', { 'error.code': String((error as { code?: unknown })?.code || (error as Error)?.message || 'ERROR').slice(0, 120) });
      throw error;
    }
  }

  function recordUsage(record: UsageRecord): void {
    const prompt = Number.isFinite(record.promptTokens) ? Math.max(0, Math.round(record.promptTokens)) : 0;
    const completion = Number.isFinite(record.completionTokens) ? Math.max(0, Math.round(record.completionTokens)) : 0;
    if (!prompt && !completion) return;
    try { insertUsage.run(record.traceId, String(record.model).slice(0, 120), String(record.purpose).slice(0, 60), prompt, completion, now()); } catch {}
  }

  /** Extracts the OpenAI-style usage block of a completion, if any. */
  function recordCompletionUsage(traceId: string, purpose: string, model: string, completion: unknown): void {
    const usage = completion && typeof completion === 'object' ? (completion as { usage?: Record<string, unknown> }).usage : null;
    if (!usage || typeof usage !== 'object') return;
    recordUsage({ traceId, model, purpose, promptTokens: Number(usage.prompt_tokens), completionTokens: Number(usage.completion_tokens) });
  }

  function recordFeedback({ ownerId, traceId = '', messageId, rating, promptVariant = '' }: { readonly ownerId: string; readonly traceId?: string; readonly messageId: string; readonly rating: string; readonly promptVariant?: string }): boolean {
    if (!['up', 'down', ''].includes(rating) || typeof messageId !== 'string' || !messageId || messageId.length > 120) return false;
    if (rating === '') {
      db.prepare('DELETE FROM feedback WHERE owner_id = ? AND message_id = ?').run(ownerId, messageId);
      return true;
    }
    upsertFeedback.run(ownerId, String(traceId).slice(0, 80), messageId, rating, String(promptVariant).slice(0, 60), now());
    return true;
  }

  function summary({ windowMs = 24 * 60 * 60 * 1000 }: { readonly windowMs?: number } = {}) {
    const since = now() - windowMs;
    const spans = db.prepare('SELECT name, status, end_ms - start_ms AS duration, attributes FROM spans WHERE start_ms >= ?').all(since) as Array<{ name: string; status: string; duration: number; attributes: string }>;
    const groups = new Map<string, { durations: number[]; errors: number }>();
    const tools = new Map<string, { ok: number; error: number }>();
    for (const span of spans) {
      const group = groups.get(span.name) ?? { durations: [], errors: 0 };
      group.durations.push(Number(span.duration));
      if (span.status !== 'ok') group.errors += 1;
      groups.set(span.name, group);
      if (span.name === 'tool.call' || span.name.startsWith('skill.')) {
        let attrs: Record<string, unknown> = {};
        try { attrs = JSON.parse(span.attributes); } catch {}
        const key = String(attrs['tool.name'] || attrs['skill.id'] || span.name);
        const entry = tools.get(key) ?? { ok: 0, error: 0 };
        if (span.status === 'ok') entry.ok += 1; else entry.error += 1;
        tools.set(key, entry);
      }
    }
    const operations = [...groups.entries()].map(([name, group]) => {
      const sorted = group.durations.sort((a, b) => a - b);
      return { name, count: sorted.length, errorRate: sorted.length ? group.errors / sorted.length : 0, p50Ms: percentile(sorted, 50), p99Ms: percentile(sorted, 99) };
    }).sort((a, b) => b.count - a.count);
    const usageRows = db.prepare('SELECT model, purpose, SUM(prompt_tokens) AS prompt, SUM(completion_tokens) AS completion, COUNT(*) AS calls FROM usage WHERE created_at >= ? GROUP BY model, purpose').all(since) as Array<{ model: string; purpose: string; prompt: number; completion: number; calls: number }>;
    const totalTokens = usageRows.reduce((sum, row) => sum + Number(row.prompt) + Number(row.completion), 0);
    const feedbackRows = db.prepare('SELECT rating, prompt_variant AS variant, COUNT(*) AS n FROM feedback WHERE created_at >= ? GROUP BY rating, prompt_variant').all(since) as Array<{ rating: string; variant: string; n: number }>;
    const up = feedbackRows.filter((row) => row.rating === 'up').reduce((sum, row) => sum + Number(row.n), 0);
    const down = feedbackRows.filter((row) => row.rating === 'down').reduce((sum, row) => sum + Number(row.n), 0);
    const variants = new Map<string, { up: number; down: number }>();
    for (const row of feedbackRows) {
      const entry = variants.get(row.variant || 'default') ?? { up: 0, down: 0 };
      if (row.rating === 'up') entry.up += Number(row.n); else if (row.rating === 'down') entry.down += Number(row.n);
      variants.set(row.variant || 'default', entry);
    }
    const hallucinationFlags = spans.filter((span) => span.name === 'answer.verification' && span.status !== 'ok').length;
    return {
      windowMs,
      operations,
      tools: [...tools.entries()].map(([name, value]) => ({ name, ...value, successRate: value.ok + value.error ? value.ok / (value.ok + value.error) : 1 })).sort((a, b) => (b.ok + b.error) - (a.ok + a.error)),
      tokens: { total: totalTokens, estimatedCost: Math.round((totalTokens / 1_000_000) * costPerMillion * 10_000) / 10_000, byModel: usageRows.map((row) => ({ model: row.model, purpose: row.purpose, promptTokens: Number(row.prompt), completionTokens: Number(row.completion), calls: Number(row.calls) })) },
      feedback: { up, down, satisfaction: up + down ? up / (up + down) : null, byVariant: [...variants.entries()].map(([variant, value]) => ({ variant, ...value })) },
      hallucinationFlags
    };
  }

  function prometheus(): string {
    const data = summary({ windowMs: 60 * 60 * 1000 });
    const label = (value: string) => value.replace(/["\\\n]/g, '_');
    const lines = [
      '# HELP hafize_operation_latency_ms Operation latency over the last hour.',
      '# TYPE hafize_operation_latency_ms gauge'
    ];
    for (const op of data.operations) {
      lines.push(`hafize_operation_latency_ms{operation="${label(op.name)}",quantile="0.5"} ${op.p50Ms}`);
      lines.push(`hafize_operation_latency_ms{operation="${label(op.name)}",quantile="0.99"} ${op.p99Ms}`);
    }
    lines.push('# HELP hafize_operation_total Operations over the last hour.', '# TYPE hafize_operation_total gauge');
    for (const op of data.operations) lines.push(`hafize_operation_total{operation="${label(op.name)}"} ${op.count}`);
    lines.push('# HELP hafize_operation_error_ratio Error ratio over the last hour.', '# TYPE hafize_operation_error_ratio gauge');
    for (const op of data.operations) lines.push(`hafize_operation_error_ratio{operation="${label(op.name)}"} ${op.errorRate.toFixed(4)}`);
    lines.push('# HELP hafize_tool_success_ratio Tool and skill success ratio over the last hour.', '# TYPE hafize_tool_success_ratio gauge');
    for (const tool of data.tools) lines.push(`hafize_tool_success_ratio{tool="${label(tool.name)}"} ${tool.successRate.toFixed(4)}`);
    lines.push('# HELP hafize_tokens_total Model tokens over the last hour.', '# TYPE hafize_tokens_total gauge');
    for (const row of data.tokens.byModel) lines.push(`hafize_tokens_total{model="${label(row.model)}",purpose="${label(row.purpose)}"} ${row.promptTokens + row.completionTokens}`);
    lines.push('# HELP hafize_feedback_total Thumbs feedback over the last hour.', '# TYPE hafize_feedback_total gauge');
    lines.push(`hafize_feedback_total{rating="up"} ${data.feedback.up}`, `hafize_feedback_total{rating="down"} ${data.feedback.down}`);
    lines.push('# HELP hafize_hallucination_flags_total Answers whose verification failed over the last hour.', '# TYPE hafize_hallucination_flags_total gauge');
    lines.push(`hafize_hallucination_flags_total ${data.hallucinationFlags}`);
    return lines.join('\n') + '\n';
  }

  function trace(traceId: string) {
    return (db.prepare('SELECT span_id AS spanId, parent_span_id AS parentSpanId, name, start_ms AS startMs, end_ms AS endMs, status, attributes FROM spans WHERE trace_id = ? ORDER BY start_ms').all(traceId) as Array<Record<string, unknown>>)
      .map((row) => ({ ...row, attributes: JSON.parse(String(row.attributes || '{}')) }));
  }

  function prune(): number {
    const cutoff = now() - RETENTION_MS;
    const spans = db.prepare('DELETE FROM spans WHERE start_ms < ?').run(cutoff).changes;
    const usage = db.prepare('DELETE FROM usage WHERE created_at < ?').run(cutoff).changes;
    return Number(spans) + Number(usage);
  }

  return Object.freeze({ startSpan, withSpan, recordUsage, recordCompletionUsage, recordFeedback, summary, prometheus, trace, prune, flush, otlpEnabled: Boolean(otlpEndpoint) });
}
export type Telemetry = ReturnType<typeof createTelemetry>;
