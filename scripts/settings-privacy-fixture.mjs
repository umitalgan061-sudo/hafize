import { pathToFileURL } from 'node:url';

export function makeStorage(entries = {}) {
  const map = new Map(Object.entries(entries));
  return {
    get length() { return map.size; },
    key(index) { return Array.from(map.keys())[index] ?? null; },
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(String(key), String(value)); },
    removeItem(key) { map.delete(String(key)); },
    has(key) { return map.has(key); },
    dump() { return Object.fromEntries(map); }
  };
}

export async function loadApi() {
  await import(pathToFileURL('public/settings-privacy.js').href + '?test=' + Date.now());
  if (!globalThis.HafizePrivacyCenter) throw new Error('privacy api missing');
  return globalThis.HafizePrivacyCenter;
}
