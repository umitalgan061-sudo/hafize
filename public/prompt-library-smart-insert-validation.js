(function installPromptSmartInsertValidation(root) {
  'use strict';
  const MAX_NAME = 32;
  const MAX_VALUE = 1000;
  const MAX_BODY = 8000;
  const VARIABLE_RE = /^([a-zA-Z0-9_-]{1,32})$/;

  const cleanVariable = (value) => String(value ?? '').trim().replace(/[^a-zA-Z0-9_-]/g, '').slice(0, MAX_NAME);
  const cleanValue = (value) => String(value ?? '').replace(/\0/g, '').slice(0, MAX_VALUE);

  function inspect(body, values = {}) {
    const source = String(body || '').slice(0, MAX_BODY);
    const names = root.HafizePromptLibrary?.extractVariables?.(source) || [];
    const normalized = Object.create(null);
    const missing = [];
    const invalid = [];
    for (const rawName of names) {
      const name = cleanVariable(rawName);
      if (!VARIABLE_RE.test(name)) { invalid.push(name); continue; }
      const value = cleanValue(values[name]); normalized[name] = value;
      if (!value.trim()) missing.push(name);
    }
    return Object.freeze({ names, normalized, missing, invalid, valid: invalid.length === 0 && missing.length === 0 });
  }

  function resolve(body, values) {
    const result = inspect(body, values);
    if (!result.valid) return Object.freeze({ text: String(body || '').slice(0, MAX_BODY), ...result });
    const text = root.HafizePromptLibrary?.replaceVariables?.(body, result.normalized) || String(body || '');
    return Object.freeze({ text: text.slice(0, MAX_BODY), ...result });
  }

  function unresolved(body) {
    const names = root.HafizePromptLibrary?.extractVariables?.(body) || [];
    return names.filter((name) => !VARIABLE_RE.test(cleanVariable(name)));
  }

  function preview(documentRef, body, values, host) {
    if (!documentRef || !host) return null;
    const result = resolve(body, values);
    host.replaceChildren();
    const status = documentRef.createElement('span');
    status.className = 'prompt-smart-insert-validation-status';
    status.textContent = result.valid ? 'Tüm değişkenler hazır.' : `Eksik: ${result.missing.join(', ') || 'yok'}`;
    const text = documentRef.createElement('pre');
    text.className = 'prompt-smart-insert-validation-preview';
    text.textContent = result.text;
    host.append(status, text);
    return result;
  }

  root.HafizePromptLibrarySmartInsertValidation = Object.freeze({ MAX_NAME, MAX_VALUE, MAX_BODY, cleanVariable, cleanValue, inspect, resolve, unresolved, preview });
})(typeof globalThis !== 'undefined' ? globalThis : self);
