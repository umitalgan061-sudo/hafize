// Anti-rot gate for the regression suite.
//
// Most checks in scripts/ assert on the text of a source file. When a module is
// renamed or moved (for example during the TypeScript migration) a check that
// still points at the old path stops testing anything: it either throws ENOENT
// or, worse, is never run because it was already failing. This gate fails fast
// when a check references a repository path that no longer exists.
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const SCRIPT_DIR = join(ROOT, 'scripts');

// Paths that are test fixtures or must stay absent: these are asserted *not* to
// exist, or are synthetic inputs handed to a policy function.
const INTENTIONALLY_ABSENT = /(?:^|[\s(,'"])(?:assert[^\n]*(?:false|!\s*)|!)/;

const PATH_LITERAL = /(['"`])((?:\.\.\/)?(?:public|lib|scripts|docs|agents|skills)\/[A-Za-z0-9_.\-/]+\.(?:js|mjs|ts|css|html|md|json)|(?:\.\.\/)?(?:server|vite\.config|vitest\.config|package)\.(?:mjs|ts|json))\1/g;

const READ_CALL = /(?:readFileSync|readFile|existsSync|access|import|require|statSync|createReadStream)\s*\(/;

const files = (await readdir(SCRIPT_DIR, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && (entry.name.endsWith('.mjs') || entry.name.endsWith('.ts')))
  .map((entry) => entry.name)
  .sort();

const dangling = [];
let inspected = 0;

for (const name of files) {
  const source = await readFile(join(SCRIPT_DIR, name), 'utf8');
  for (const line of source.split('\n')) {
    if (!READ_CALL.test(line)) continue;
    if (INTENTIONALLY_ABSENT.test(line)) continue;
    for (const match of line.matchAll(PATH_LITERAL)) {
      const raw = match[2];
      const relative = raw.startsWith('../') ? raw.slice(3) : raw;
      inspected += 1;
      if (!existsSync(join(ROOT, relative))) dangling.push(`${name}: ${raw}`);
    }
  }
}

assert.ok(files.length > 100, 'the check suite should be discovered');
assert.ok(inspected > 100, 'source path literals should be discovered');
assert.deepEqual(dangling, [], `checks point at missing sources:\n${dangling.join('\n')}`);

console.log(JSON.stringify({ status: 'ok', checkScripts: files.length, sourceReferences: inspected }));
