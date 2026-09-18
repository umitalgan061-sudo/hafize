(function installPromptLibraryFillSession(root) {
  'use strict';
  const MAX_VALUE = 1000;
  const MAX_PROMPTS = 30;
  const sessions = new Map();

  const normalize = (values) => {
    const output = {};
    for (const [name, value] of Object.entries(values || {}).slice(0, 12)) {
      const key = String(name || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
      const text = typeof value === 'string' ? value.slice(0, MAX_VALUE) : '';
      if (key) output[key] = text;
    }
    return output;
  };
  const set = (promptId, values) => {
    if (!promptId) return false;
    sessions.set(String(promptId).slice(0, 120), normalize(values));
    while (sessions.size > MAX_PROMPTS) sessions.delete(sessions.keys().next().value);
    return true;
  };
  const get = (promptId) => ({ ...(sessions.get(String(promptId).slice(0, 120)) || {}) });
  const clear = (promptId) => sessions.delete(String(promptId).slice(0, 120));
  const clearAll = () => sessions.clear();
  const size = () => sessions.size;
  root.HafizePromptLibraryFillSession = Object.freeze({ MAX_VALUE, MAX_PROMPTS, normalize, set, get, clear, clearAll, size });
  root.addEventListener?.('beforeunload', clearAll, { once: true });
})(typeof globalThis !== 'undefined' ? globalThis : self);
