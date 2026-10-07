import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const sw=fs.readFileSync(path.join(root,'public/sw-policy.ts'),'utf8');
const vite=fs.readFileSync(path.join(root,'vite.config.ts'),'utf8');
const html=fs.readFileSync(path.join(root,'public/index.html'),'utf8');

// The shell cache version is bumped on every shell change, so a literal version
// turns an unrelated change into a failure here. The invariant is what matters.
assert.match(sw, /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v\d+`/, 'shell cache name carries a numeric version');
assert.match(sw,/github-workspace-write\.css/);
assert.match(sw,/typed-build\/github-workspace-write\.js/);
assert.match(vite,/github-workspace-write\.js/);
assert.match(vite,/github-workspace-write\.ts/);
assert.match(html,/type="module" src="\/typed-build\/github-workspace-write\.js"/);
console.log('github-workspace-write-pwa: ok');
