export interface ResponseGeneration {
  model: string;
  agentId: string;
  toolsEnabled: boolean;
  generatedAt: string;
  durationMs: number | null;
}

export interface ResponseAlternateState {
  current: string;
  alternates: string[];
}

export const MAX_RESPONSE_ALTERNATES = 3;
export const MAX_RESPONSE_LENGTH = 12000;
export const MAX_GENERATION_MODEL = 160;
export const MAX_GENERATION_AGENT = 120;

export function normalizeResponseAlternates(
  value: unknown,
  maxItems = MAX_RESPONSE_ALTERNATES,
  maxLength = MAX_RESPONSE_LENGTH
): string[] {
  if (!Array.isArray(value) || maxItems <= 0 || maxLength <= 0) return [];
  const output: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== 'string') continue;
    const clean = entry.trim().slice(0, maxLength);
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    output.push(clean);
    if (output.length >= maxItems) break;
  }
  return output;
}

export function rememberResponseAlternate(
  history: unknown,
  previous: unknown,
  maxItems = MAX_RESPONSE_ALTERNATES,
  maxLength = MAX_RESPONSE_LENGTH
): string[] {
  const clean = typeof previous === 'string' ? previous.trim().slice(0, maxLength) : '';
  const existing = normalizeResponseAlternates(history, maxItems, maxLength);
  if (!clean) return existing;
  return [clean, ...existing.filter((entry) => entry !== clean)].slice(0, maxItems);
}

export function restoreLatestResponseAlternate(
  current: unknown,
  history: unknown,
  maxItems = MAX_RESPONSE_ALTERNATES,
  maxLength = MAX_RESPONSE_LENGTH
): ResponseAlternateState | null {
  const currentValue = typeof current === 'string' ? current.trim().slice(0, maxLength) : '';
  const existing = normalizeResponseAlternates(history, maxItems, maxLength);
  if (!existing.length) return null;
  const [previous, ...rest] = existing;
  if (!previous) return null;
  const nextHistory = rememberResponseAlternate(rest, currentValue, maxItems, maxLength);
  return { current: previous, alternates: nextHistory };
}

export function canRegenerateResponse(messages: unknown, index: number): boolean {
  if (!Array.isArray(messages) || !Number.isInteger(index) || index < 1 || index !== messages.length - 1) return false;
  const message = messages[index];
  return Boolean(
    message &&
    typeof message === 'object' &&
    (message as { role?: unknown }).role === 'assistant' &&
    typeof (message as { content?: unknown }).content === 'string' &&
    String((message as { content?: unknown }).content).trim()
  );
}

export function createGenerationSnapshot(
  model: unknown,
  agentId: unknown,
  toolsEnabled: unknown,
  durationMs: unknown,
  at = new Date().toISOString()
): ResponseGeneration {
  const cleanDuration = Number.isFinite(Number(durationMs)) && Number(durationMs) >= 0
    ? Math.min(600000, Math.floor(Number(durationMs)))
    : null;
  return Object.freeze({
    model: typeof model === 'string' ? model.trim().slice(0, MAX_GENERATION_MODEL) : '',
    agentId: typeof agentId === 'string' ? agentId.trim().slice(0, MAX_GENERATION_AGENT) : '',
    toolsEnabled: toolsEnabled === true,
    generatedAt: typeof at === 'string' ? at.slice(0, 40) : new Date().toISOString(),
    durationMs: cleanDuration
  });
}

export function rotateResponseAlternate(
  state: ResponseAlternateState,
  maxItems = MAX_RESPONSE_ALTERNATES,
  maxLength = MAX_RESPONSE_LENGTH
): ResponseAlternateState | null {
  return restoreLatestResponseAlternate(state.current, state.alternates, maxItems, maxLength);
}

export interface ResponseVariant {
  index: number;
  kind: 'current' | 'previous';
  content: string;
}

export function listResponseVariants(
  current: unknown,
  history: unknown,
  maxLength = MAX_RESPONSE_LENGTH
): ResponseVariant[] {
  const cleanCurrent = typeof current === 'string' ? current.trim().slice(0, maxLength) : '';
  const previous = normalizeResponseAlternates(history, MAX_RESPONSE_ALTERNATES, maxLength);
  const output: ResponseVariant[] = [];
  if (cleanCurrent) output.push({ index: 0, kind: 'current', content: cleanCurrent });
  previous.forEach((content, offset) => output.push({ index: output.length, kind: 'previous', content }));
  return output;
}

export function selectResponseVariant(
  current: unknown,
  history: unknown,
  variantIndex: unknown,
  maxLength = MAX_RESPONSE_LENGTH
): ResponseAlternateState | null {
  const variants = listResponseVariants(current, history, maxLength);
  const chosen = typeof variantIndex === 'number' && Number.isInteger(variantIndex) ? variantIndex : -1;
  if (chosen <= 0 || chosen >= variants.length) return null;
  const selected = variants[chosen];
  if (!selected) return null;
  const remaining = variants
    .filter((_variant, index) => index !== 0 && index !== chosen)
    .map((variant) => variant.content);
  return {
    current: selected.content,
    alternates: normalizeResponseAlternates([variants[0]?.content || '', ...remaining], MAX_RESPONSE_ALTERNATES, maxLength)
  };
}
