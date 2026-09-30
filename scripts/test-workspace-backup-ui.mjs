import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/typed/workspace-backup.ts', root), 'utf8');
const css = await readFile(new URL('public/workspace-backup.css', root), 'utf8');
for (const marker of ['workspaceBackupPanel','workspaceBackupTitle','workspaceBackupPreview','aria-labelledby','aria-live','aria-modal','activeElement']) assert.ok(source.includes(marker), 'ui marker missing: ' + marker);
for (const marker of ['prefers-reduced-motion','forced-colors','focus-visible','@media (max-width:700px)']) assert.ok(css.includes(marker), 'css marker missing: ' + marker);
console.log('workspace-backup-ui: OK');
