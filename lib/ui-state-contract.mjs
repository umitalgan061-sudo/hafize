const UI_STATES = Object.freeze(['idle', 'loading', 'success', 'empty', 'error', 'offline']);
const MAX_MESSAGE = 500;

function text(value, max = MAX_MESSAGE) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function normalizeUiState(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('INVALID_UI_STATE');
  const state = text(input.state, 32);
  if (!UI_STATES.includes(state)) throw new Error('INVALID_UI_STATE_NAME');
  const message = text(input.message);
  const retryable = input.retryable === true;
  const requestId = input.requestId == null ? null : text(input.requestId, 120);
  return Object.freeze({ state, message, retryable, requestId });
}

export function evaluateUiStateTransition(from, to) {
  const current = normalizeUiState(from);
  const next = normalizeUiState(to);
  const allowed = current.state !== 'loading' || ['success', 'empty', 'error', 'offline', 'loading'].includes(next.state);
  return Object.freeze({ from: current.state, to: next.state, allowed });
}

export function buildUiState({ loading = false, dataCount = 0, error = '', offline = false, requestId = null } = {}) {
  const state = offline ? 'offline' : error ? 'error' : loading ? 'loading' : dataCount === 0 ? 'empty' : 'success';
  return normalizeUiState({ state, message: error || '', retryable: state === 'error' || state === 'offline', requestId });
}

export const UI_STATE_CONTRACT = Object.freeze({ states: UI_STATES, maxMessageLength: MAX_MESSAGE });
