/** Stops an agent from spending a turn repeating an identical tool call. */
export function createToolLoopGuard(maxIdenticalCalls = 1) {
  const seen = new Map<string, number>();
  const key = (name: unknown, args: unknown): string => `${typeof name === 'string' ? name : ''}\u0000${typeof args === 'string' ? args : '{}'}`;
  return Object.freeze({
    shouldRun(name: unknown, args: unknown): boolean {
      const callKey = key(name, args);
      const count = seen.get(callKey) || 0;
      seen.set(callKey, count + 1);
      return count < maxIdenticalCalls;
    }
  });
}
