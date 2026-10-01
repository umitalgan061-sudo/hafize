
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=readFileSync('public/settings-privacy.js','utf8');
for (const key of ['hafize.conversations.v1','hafize.message-workspace.v1','hafize.prompt-library.v1','hafize.prompt-library.collections.v1','hafize.prompt-library.revisions.v1','hafize.model-preferences.v1','hafize.composer-history.v1','hafize.scheduled-task-templates.v1','hafize.scheduled-task-draft.v1','hafize.theme.v1','hafize.reduced-motion.v1','hafize.workspace-backup.meta.v1']) assert.ok(source.includes(key),key);
assert.ok(source.includes('hafize.prompt-library.smart-fill.v1.'));
assert.ok(source.includes('unknownKeys'));
assert.ok(source.includes('Tanınmayan localStorage alanları'));
console.log('privacy inventory contract ok');
