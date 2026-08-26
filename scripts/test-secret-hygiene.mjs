import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const BINARY_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.gif', '.webp', '.ico', '.woff', '.woff2']);

// Adı tek başına credential taşıdığını gösteren dosyalar depoda bulunmamalıdır.
const FORBIDDEN_NAMES = [/^\.env(\..+)?$/, /\.pem$/, /\.key$/, /\.p12$/, /\.pfx$/, /^id_rsa/];
// İstemciye giden hiçbir dosya bir secret ortam değişkenine atıfta bulunmamalıdır.
const CLIENT_FORBIDDEN = ['NVIDIA_API_KEY', 'GITHUB_TOKEN', 'client_secret', 'CLIENT_SECRET', 'refresh_token'];
const REQUIRED_IGNORES = ['node_modules/', '.env', '.env.*', '*.pem', '*.key', 'secrets/'];
// Desen dinamik kurulur; aksi hâlde tarayıcı kendi kaynağını eşleştirirdi.
const PRIVATE_KEY_BLOCK = new RegExp('-{5}BEGIN [A-Z ]*PRIVATE KEY-{5}');

function walk(relativeDir = '.') {
  const files = [];
  for (const name of readdirSync(path.join(ROOT, relativeDir))) {
    if (SKIP_DIRS.has(name)) continue;
    const relative = relativeDir === '.' ? name : `${relativeDir}/${name}`;
    if (statSync(path.join(ROOT, relative)).isDirectory()) files.push(...walk(relative));
    else files.push(relative);
  }
  return files;
}

const files = walk();
assert.ok(files.length > 50);

const ignore = readFileSync(path.join(ROOT, '.gitignore'), 'utf8').split('\n').map((line) => line.trim());
for (const pattern of REQUIRED_IGNORES) {
  assert.ok(ignore.includes(pattern), `.gitignore missing pattern: ${pattern}`);
}

for (const file of files) {
  const base = path.basename(file);
  for (const pattern of FORBIDDEN_NAMES) {
    assert.equal(pattern.test(base), false, `credential-shaped file committed: ${file}`);
  }
}

for (const file of files) {
  if (BINARY_EXTENSIONS.has(path.extname(file))) continue;
  const content = readFileSync(path.join(ROOT, file), 'utf8');
  assert.equal(PRIVATE_KEY_BLOCK.test(content), false, `private key block committed: ${file}`);
  if (!file.startsWith('public/')) continue;
  for (const marker of CLIENT_FORBIDDEN) {
    assert.equal(content.includes(marker), false, `client asset references secret ${marker}: ${file}`);
  }
}

console.log(`secret hygiene OK: ${files.length} tracked files carry no credential-shaped name, key block or client-side secret reference`);
