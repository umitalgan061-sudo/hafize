import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const source = await readFile(new URL('../public/typed/generation-history.ts', import.meta.url), 'utf8');

assert.match(source, /GenerationHistoryPhase/);
assert.match(source, /GenerationHistoryStopReason/);
assert.match(source, /GENERATION_HISTORY_LIMIT = 12/);
assert.match(source, /GENERATION_HISTORY_MAX_JSON = 24_000/);
assert.match(source, /normalizeGenerationHistory/);
assert.match(source, /readGenerationHistory/);
assert.match(source, /writeGenerationHistory/);
assert.match(source, /appendGenerationHistory/);
assert.match(source, /clearGenerationHistory/);
assert.match(source, /summarizeGenerationHistory/);
assert.match(source, /compactGenerationHistoryForCopy/);
assert.doesNotMatch(source, /content:.*prompt|response:/i);
console.log('generation-history contract: OK');
