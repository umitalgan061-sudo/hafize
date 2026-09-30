import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/typed/workspace-backup.ts', root), 'utf8');
for (const event of ['hafize:prompt-library-changed','hafize:prompt-library-collections-changed','hafize:message-workspace-changed','hafize:composer-history-changed','hafize:composer-history-settings-changed','hafize:model-preferences-changed','hafize:scheduled-task-templates-changed','hafize:conversation-forks-changed','hafize:workspace-backup-restored']) assert.ok(source.includes(event), 'refresh event missing: ' + event);
assert.ok(source.includes('renderSummary'));
console.log('workspace-backup-events: OK');
