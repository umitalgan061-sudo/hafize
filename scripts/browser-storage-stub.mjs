// Shared browser-storage stubs for suites that load a `public/*.js` module in
// Node. The frontend modules read `root.localStorage` lazily, so a suite can
// install one of these on `globalThis` before requiring the module and then
// exercise the real code instead of a copy of it. This module is a helper, not
// a suite (run-checks only executes test-*/validate-*).

/** In-memory Storage: the same surface the modules use, plus `snapshot()`. */
export function createStorageStub(initial = {}) {
  const memory = new Map(Object.entries(initial).map(([key, value]) => [String(key), String(value)]));
  return {
    get length() { return memory.size; },
    key: (index) => [...memory.keys()][index] ?? null,
    getItem: (key) => (memory.has(String(key)) ? memory.get(String(key)) : null),
    setItem: (key, value) => { memory.set(String(key), String(value)); },
    removeItem: (key) => { memory.delete(String(key)); },
    clear: () => { memory.clear(); },
    snapshot: () => Object.fromEntries(memory)
  };
}

/**
 * Storage that throws on the named operations, the way a browser does when
 * site data is blocked or the quota is exhausted.
 */
export function createThrowingStorage(operations = ['getItem', 'setItem', 'removeItem'], error = new Error('QuotaExceededError')) {
  const stub = createStorageStub();
  for (const operation of operations) {
    stub[operation] = () => { throw error; };
  }
  return stub;
}
