import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync('public/prompt-library-revisions.js', 'utf8');
assert.match(source, /function restore\(promptId, revisionId/);
assert.match(source, /const revision = readRevisions\(storage\)\.find/);
assert.match(source, /const index = prompts\.findIndex/);
assert.match(source, /capture\(current, 'before-restore'/);
assert.match(source, /id: promptId/);
assert.match(source, /createdAt: current\.createdAt/);
assert.match(source, /updatedAt: isoNow\(\)/);
assert.match(source, /useCount: current\.useCount/);
assert.match(source, /capture\(restored, 'restore'/);
assert.match(source, /storage\?\.setItem/);
assert.match(source, /return null/);
assert.doesNotMatch(source, /window\.location/);
assert.doesNotMatch(source, /submit\(/);
assert.doesNotMatch(source, /dispatchEvent\([^)]*submit/);
console.log('prompt revision restore contract: ok');
