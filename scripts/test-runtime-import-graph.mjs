// Runtime import-graph gate for the server entrypoint.
//
// `npm start` runs `server.ts` under Node's TypeScript support, so a bad
// relative specifier or a TypeScript construct Node cannot strip is not a type
// error a reviewer can defer: the process fails before it listens. Both
// happened during the `.mjs` → `.ts` migration, so this suite resolves every
// relative import reachable from the server and then actually loads each
// `lib/*.ts` module.

import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g;
const ENTRYPOINTS = ['server.ts'];
const SOURCE_DIRECTORIES = ['lib', 'agents', 'skills'];
const SOURCE_EXTENSIONS = new Set(['.ts', '.mjs', '.js']);

function sourceFiles() {
  const files = ENTRYPOINTS.filter((file) => existsSync(path.join(ROOT, file)));
  for (const directory of SOURCE_DIRECTORIES) {
    const absolute = path.join(ROOT, directory);
    if (!existsSync(absolute) || !statSync(absolute).isDirectory()) continue;
    for (const entry of readdirSync(absolute, { withFileTypes: true })) {
      if (!entry.isFile() || !SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
      files.push(path.join(directory, entry.name));
    }
  }
  return files.sort();
}

const files = sourceFiles();
assert.ok(files.length > 20, `runtime source set is populated, found ${files.length}`);

// Every relative specifier resolves to a file that exists. A `.mjs` specifier
// left behind by a module that became `.ts` is the exact failure this catches.
const unresolved = [];
for (const file of files) {
  const source = readFileSync(path.join(ROOT, file), 'utf8');
  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1];
    const target = path.resolve(path.dirname(path.join(ROOT, file)), specifier);
    if (!existsSync(target)) unresolved.push(`${file} -> ${specifier}`);
  }
}
assert.deepEqual(unresolved, [], 'every relative import resolves to a file on disk');

// Resolving is not enough: Node has to be able to strip the TypeScript and run
// the module. `opts={}: T` parses as TypeScript but not as strippable syntax,
// and one such parameter took down the whole server import graph.
const libModules = readdirSync(path.join(ROOT, 'lib'), { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts'))
  .map((entry) => entry.name)
  .sort();
assert.ok(libModules.length > 20, `typed lib modules are present, found ${libModules.length}`);

const failed = [];
for (const name of libModules) {
  try {
    await import(pathToFileURL(path.join(ROOT, 'lib', name)).href);
  } catch (error) {
    failed.push(`${name}: ${String(error?.message ?? error).split('\n')[0]}`);
  }
}
assert.deepEqual(failed, [], 'every typed lib module loads under Node');

// A default value must not precede its type annotation: Node reports
// `Expected ',', got ':'` and refuses the file.
for (const file of files) {
  if (!file.endsWith('.ts')) continue;
  const source = readFileSync(path.join(ROOT, file), 'utf8');
  assert.doesNotMatch(source, /=\s*\{\s*\}\s*:\s*\{/, `${file} annotates a parameter type before its default`);
}

console.log(`runtime import graph OK: ${files.length} sources resolved, ${libModules.length} typed lib modules loaded`);
