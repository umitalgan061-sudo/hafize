// Every relative module specifier in the repository must resolve to a file that
// exists.
//
// This gate exists because one unresolvable specifier - the typed schedule
// executor importing a legacy bridge the TypeScript migration never created -
// made npm start fail with ERR_MODULE_NOT_FOUND while every other check stayed
// green.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_EXTENSIONS = new Set(['.ts', '.mjs', '.js']);
const SKIPPED_DIRECTORIES = new Set(['node_modules', 'typed-build', '.git', 'coverage', 'runtime', 'data']);

// A statement-shaped specifier: `import x from './a.ts'`, `export * from
// './a.ts'`, the `} from './a.ts'` tail of a multi-line import, or a bare
// `import './a.ts'`. Anchoring to the start of the line keeps quoted import
// text inside assertions (`assert(source.includes("from './a.ts'"))`) out of
// the result, because that text is data the suite checks, not an import.
const STATEMENT_PATTERNS = [
  /^(?:import|export)\b[^'"]*\bfrom\s*(['"])(\.[^'"]*)\1/,
  /^\}[^'"]*\bfrom\s*(['"])(\.[^'"]*)\1/,
  /^from\s*(['"])(\.[^'"]*)\1/,
  /^import\s*(['"])(\.[^'"]*)\1/
];
// Runtime loads can appear anywhere in an expression.
const CALL_PATTERN = /\b(?:import|require)\s*\(\s*(['"])(\.[^'"]*)\1/g;

function collectSourceFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (SKIPPED_DIRECTORIES.has(entry.name)) continue;
      files.push(...collectSourceFiles(absolute));
      continue;
    }
    if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

function specifiersOf(source) {
  const found = new Set();
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('//') || line.startsWith('*')) continue;
    for (const pattern of STATEMENT_PATTERNS) {
      const match = pattern.exec(line);
      if (match) {
        found.add(match[2]);
        break;
      }
    }
    CALL_PATTERN.lastIndex = 0;
    let call;
    while ((call = CALL_PATTERN.exec(line)) !== null) found.add(call[2]);
  }
  return [...found];
}

const files = collectSourceFiles(ROOT);
assert.ok(files.length > 100, 'module resolution gate found suspiciously few sources');

const unresolved = [];
let checked = 0;

for (const file of files) {
  for (const specifier of specifiersOf(readFileSync(file, 'utf8'))) {
    // Computed specifiers are only known at runtime.
    if (specifier.includes('${')) continue;
    checked += 1;
    const target = path.resolve(path.dirname(file), specifier);
    if (!existsSync(target) || !statSync(target).isFile()) {
      unresolved.push(`${path.relative(ROOT, file)} -> ${specifier}`);
    }
  }
}

if (unresolved.length) {
  console.error(`${unresolved.length} unresolvable relative module specifiers:`);
  for (const entry of unresolved) console.error('  ' + entry);
}
assert.equal(unresolved.length, 0, 'every relative module specifier must resolve to an existing file');

console.log(`module resolution: ${checked} relative specifiers across ${files.length} files resolve`);
