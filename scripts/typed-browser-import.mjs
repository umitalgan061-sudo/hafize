// Shared helper for suites that exercise browser TypeScript modules in Node.
//
// The typed browser entrypoints self-mount on import (`install(document, …)`),
// so importing them from a Node suite needs a document that makes every mount
// bail out immediately. `documentElement: null` and a `querySelector` that
// finds nothing are exactly the guards those modules check first, so the module
// evaluates its exports without touching real DOM or browser APIs.
// This module is a helper, not a suite (run-checks only executes test-*/validate-*).

const INERT_DOCUMENT = Object.freeze({
  readyState: 'complete',
  documentElement: null,
  hidden: false,
  activeElement: null,
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  addEventListener: () => {},
  removeEventListener: () => {},
  createElement: () => { throw new Error('INERT_DOCUMENT_CANNOT_CREATE_ELEMENTS'); }
});

/**
 * Imports a browser TypeScript module with an inert `document`/`window` in
 * place, and restores whatever globals were there before.
 */
export async function importTypedBrowserModule(specifier) {
  const previous = {
    document: Object.getOwnPropertyDescriptor(globalThis, 'document'),
    window: Object.getOwnPropertyDescriptor(globalThis, 'window')
  };
  Object.defineProperty(globalThis, 'document', { value: INERT_DOCUMENT, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'window', { value: globalThis, configurable: true, writable: true });
  try {
    return await import(specifier);
  } finally {
    if (previous.document) Object.defineProperty(globalThis, 'document', previous.document);
    else delete globalThis.document;
    if (previous.window) Object.defineProperty(globalThis, 'window', previous.window);
    else delete globalThis.window;
  }
}
