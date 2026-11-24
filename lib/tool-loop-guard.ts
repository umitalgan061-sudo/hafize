/** Stable semantic fingerprints prevent duplicate tool execution in long runs.
 * JSON key ordering and whitespace are irrelevant; array order is not.
 * Never cache a write result or automatically replay a mutation.
 */
function canonicalValue(value: unknown, depth = 0): unknown {
  if (depth > 32) throw new Error('tool arguments too deeply nested');
  if (Array.isArray(value)) return value.map(item => canonicalValue(item, depth + 1));
  if (value !== null && typeof value === 'object') {
    // A null-prototype object preserves even a literal "__proto__" data key.
    const normalized = Object.create(null) as Record<string, unknown>;
    const record = value as Record<string, unknown>;
    for (const key of Object.keys(record).sort()) normalized[key] = canonicalValue(record[key], depth + 1);
    return normalized;
  }
  return value;
}

function canonicalArguments(args: unknown): string {
  const raw = typeof args === 'string' ? args : '{}';
  try { return JSON.stringify(canonicalValue(JSON.parse(raw))); }
  catch { return raw; }
}

export function createToolLoopGuard(maxIdenticalCalls = 1) {
  const seen = new Map<string, number>();
  const key = (name: unknown, args: unknown): string =>
    `${typeof name === 'string' ? name : ''}\u0000${canonicalArguments(args)}`;
  return Object.freeze({
    shouldRun(name: unknown, args: unknown): boolean {
      const callKey = key(name, args);
      const count = seen.get(callKey) || 0;
      seen.set(callKey, count + 1);
      return count < maxIdenticalCalls;
    }
  });
}
