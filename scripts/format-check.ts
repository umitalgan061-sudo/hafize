import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('../', import.meta.url);
const DIRECTORIES = ['public', 'src', 'scripts'];
const EXTENSIONS = new Set(['.ts', '.mjs']);
const MAX_LINE_LENGTH = 240;

async function walk(directory, output = []) {
  let entries;
  try {
    entries = await readdir(new URL(directory, ROOT), { withFileTypes: true });
  } catch {
    return output;
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'typed-build') continue;
    const relative = join(directory, entry.name);
    if (entry.isDirectory()) await walk(relative, output);
    else if (EXTENSIONS.has(relative.slice(relative.lastIndexOf('.')))) output.push(relative);
  }
  return output;
}

const files = (await Promise.all(DIRECTORIES.map((directory) => walk(directory)))).flat();
const violations = [];

for (const file of files) {
  const content = await readFile(new URL(file, ROOT), 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\s+$/.test(line)) violations.push(`${file}:${index + 1}: trailing whitespace`);
    if (line.length > MAX_LINE_LENGTH) violations.push(`${file}:${index + 1}: line exceeds ${MAX_LINE_LENGTH} characters`);
  });
  if (!content.endsWith('\n')) violations.push(`${file}: missing final newline`);
}

if (violations.length) {
  console.error(violations.join('\n'));
  process.exit(1);
}

console.log(`format-check: ${files.length} source files clean`);
