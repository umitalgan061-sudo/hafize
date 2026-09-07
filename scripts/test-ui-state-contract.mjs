import assert from 'node:assert/strict';
import { buildUiState, evaluateUiStateTransition, normalizeUiState } from '../lib/ui-state-contract.mjs';

assert.equal(buildUiState({ loading: true }).state, 'loading');
assert.equal(buildUiState({ dataCount: 0 }).state, 'empty');
assert.equal(buildUiState({ dataCount: 2 }).state, 'success');
assert.equal(buildUiState({ error: 'Sunucu hatası' }).state, 'error');
assert.equal(buildUiState({ offline: true }).state, 'offline');
assert.equal(buildUiState({ error: 'x' }).retryable, true);
assert.throws(() => normalizeUiState({ state: 'weird' }), /INVALID_UI_STATE_NAME/);
assert.equal(evaluateUiStateTransition({ state: 'loading' }, { state: 'success' }).allowed, true);
assert.equal(evaluateUiStateTransition({ state: 'loading' }, { state: 'idle' }).allowed, false);
assert.equal(normalizeUiState({ state: 'empty', message: '  hazır  ' }).message, 'hazır');

console.log('ui state contract tests passed');
