export type AgentRole = 'user' | 'assistant' | 'system' | 'tool';
export type ToolActivityState = 'queued' | 'running' | 'success' | 'failure';
export interface AgentMessage { readonly role: AgentRole; readonly content: string; readonly name?: string; readonly toolCallId?: string; }
export interface AgentRequest { readonly agentId: string; readonly model?: string; readonly messages: readonly AgentMessage[]; readonly stream?: boolean; readonly toolsEnabled?: boolean; readonly signal?: AbortSignal; }
export interface AgentToolActivity { readonly id: string; readonly name: string; readonly state: ToolActivityState; readonly detail?: string; }
export interface AgentChunk { readonly type: 'text' | 'tool' | 'done' | 'error'; readonly text?: string; readonly activity?: AgentToolActivity; readonly error?: string; }
export interface AgentTransportOptions { readonly endpoint?: string; readonly timeoutMs?: number; readonly maxResponseBytes?: number; readonly fetchImpl?: typeof fetch; }

const MAX = Object.freeze({ agentId: 120, model: 160, message: 12_000, messages: 80, requestBytes: 1_000_000, responseBytes: 5_000_000, toolName: 80, toolDetail: 1_000, line: 20_000 });
const clamp = (value: unknown, limit: number): string => typeof value === 'string' ? value.slice(0, limit) : '';

export function normalizeAgentMessage(message: unknown): AgentMessage | null {
  if (!message || typeof message !== 'object') return null;
  const item = message as Record<string, unknown>;
  const role: AgentRole | null = item.role === 'assistant' || item.role === 'system' || item.role === 'tool' || item.role === 'user' ? item.role : null;
  const content = clamp(item.content, MAX.message);
  if (!role || !content) return null;
  return Object.freeze({ role, content, ...(typeof item.name === 'string' ? { name: clamp(item.name, 120) } : {}), ...(typeof item.toolCallId === 'string' ? { toolCallId: clamp(item.toolCallId, 120) } : {}) });
}

export function normalizeAgentRequest(request: AgentRequest): AgentRequest {
  const agentId = clamp(request.agentId, MAX.agentId).trim();
  if (!agentId) throw new Error('AGENT_ID_REQUIRED');
  const messages = request.messages.map(normalizeAgentMessage).filter((item): item is AgentMessage => item !== null).slice(-MAX.messages);
  if (!messages.length) throw new Error('AGENT_MESSAGES_REQUIRED');
  const model = clamp(request.model, MAX.model).trim();
  const next: AgentRequest = Object.freeze({ agentId, messages, ...(model ? { model } : {}), stream: request.stream !== false, toolsEnabled: request.toolsEnabled === true, signal: request.signal });
  const serialized = JSON.stringify({ ...next, signal: undefined });
  if (new TextEncoder().encode(serialized).byteLength > MAX.requestBytes) throw new Error('AGENT_REQUEST_TOO_LARGE');
  return next;
}

export function parseSseLines(input: string): AgentChunk[] {
  const chunks: AgentChunk[] = [];
  for (const line of input.split(/\r?\n/)) {
    const value = line.startsWith('data:') ? line.slice(5).trim() : '';
    if (!value || value === '[DONE]' || value.length > MAX.line) continue;
    try {
      const parsed: unknown = JSON.parse(value);
      if (!parsed || typeof parsed !== 'object') continue;
      const item = parsed as Record<string, unknown>;
      const type = item.type === 'tool' || item.type === 'done' || item.type === 'error' ? item.type : 'text';
      if (type === 'text') { const text = clamp(item.text ?? item.content, MAX.message); if (text) chunks.push(Object.freeze({ type, text })); continue; }
      if (type === 'tool') {
        const activityValue = item.activity;
        if (!activityValue || typeof activityValue !== 'object') continue;
        const activity = activityValue as Record<string, unknown>;
        const id = clamp(activity.id, 120); const name = clamp(activity.name, MAX.toolName).trim();
        if (!id || !name) continue;
        const state: ToolActivityState = activity.state === 'queued' || activity.state === 'running' || activity.state === 'failure' ? activity.state : 'success';
        chunks.push(Object.freeze({ type, activity: Object.freeze({ id, name, state, ...(clamp(activity.detail, MAX.toolDetail) ? { detail: clamp(activity.detail, MAX.toolDetail) } : {}) }) }));
        continue;
      }
      if (type === 'error') chunks.push(Object.freeze({ type, error: clamp(item.error ?? item.message, 400) || 'AGENT_STREAM_ERROR' }));
      else chunks.push(Object.freeze({ type: 'done' }));
    } catch { /* malformed SSE frame is ignored */ }
  }
  return chunks;
}

async function readResponseStream(response: Response, onChunk: (chunk: AgentChunk) => void, maxBytes: number): Promise<void> {
  if (!response.body) return;
  const reader = response.body.getReader(); const decoder = new TextDecoder(); let carry = ''; let bytes = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      bytes += result.value.byteLength; if (bytes > maxBytes) throw new Error('AGENT_RESPONSE_TOO_LARGE');
      carry += decoder.decode(result.value, { stream: true });
      const boundary = carry.lastIndexOf('\n'); if (boundary < 0) continue;
      for (const chunk of parseSseLines(carry.slice(0, boundary))) onChunk(chunk);
      carry = carry.slice(boundary + 1);
    }
    carry += decoder.decode(); for (const chunk of parseSseLines(carry)) onChunk(chunk);
  } finally { reader.releaseLock(); }
}

export async function runAgent(request: AgentRequest, options: AgentTransportOptions = {}, onChunk: (chunk: AgentChunk) => void = () => undefined): Promise<Response> {
  const normalized = normalizeAgentRequest(request);
  const controller = new AbortController(); const timeout = options.timeoutMs ?? 30_000; const timer = setTimeout(() => controller.abort(), timeout);
  const relay = (): void => controller.abort(); normalized.signal?.addEventListener('abort', relay, { once: true });
  const fetchImpl = options.fetchImpl ?? fetch; const responseLimit = options.maxResponseBytes ?? MAX.responseBytes;
  try {
    const response = await fetchImpl(options.endpoint ?? '/api/agent/run', { method: 'POST', credentials: 'same-origin', signal: controller.signal, headers: { Accept: normalized.stream ? 'text/event-stream, application/json' : 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: normalized.agentId, model: normalized.model, messages: normalized.messages, stream: normalized.stream, toolsEnabled: normalized.toolsEnabled }) });
    if (!response.ok) throw new Error(`AGENT_HTTP_${response.status}`);
    if (normalized.stream) await readResponseStream(response, onChunk, responseLimit);
    else { const clone = response.clone(); const raw = await clone.arrayBuffer(); if (raw.byteLength > responseLimit) throw new Error('AGENT_RESPONSE_TOO_LARGE'); }
    return response;
  } finally { clearTimeout(timer); normalized.signal?.removeEventListener('abort', relay); }
}

export const HafizeAgentClient = Object.freeze({ normalizeAgentMessage, normalizeAgentRequest, parseSseLines, runAgent });
