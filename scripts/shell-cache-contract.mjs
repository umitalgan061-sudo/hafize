// Paylaşılan PWA shell cache sözleşmesi yardımcıları.
//
// Her yeni istemci özelliği `public/sw-policy.js` içindeki `CURRENT_CACHE`
// sürümünü bir artırır. Özellik testleri bu sürümü sabit bir değere
// kilitlediğinde, sonraki her özellik eski testleri kırıyordu. Gerçek
// sözleşme "bu özellik en az vN gerektirdi ve sürüm geriye gitmemeli"
// olduğundan, testler artık sabit eşitlik yerine monotonluk kontrolü yapar.
//
// Bu dosya `test-` veya `validate-` ile başlamadığı için `run-checks.mjs`
// tarafından paket olarak çalıştırılmaz; yalnızca syntax kontrolüne girer.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const CACHE_PREFIX = 'hafize-shell-';

export function readShellPolicy() {
  return require(path.join(ROOT, 'public', 'sw-policy.js'));
}

export function readShellPolicySource() {
  return fs.readFileSync(path.join(ROOT, 'public', 'sw-policy.js'), 'utf8');
}

export function parseShellCacheVersion(cacheName) {
  const match = /^hafize-shell-v(\d+)$/.exec(String(cacheName ?? ''));
  assert.ok(match, `shell cache adı sözleşmeye uymuyor: ${cacheName}`);
  const version = Number(match[1]);
  assert.ok(Number.isInteger(version) && version > 0, `shell cache sürümü geçersiz: ${cacheName}`);
  return version;
}

export function shellCacheVersion() {
  return parseShellCacheVersion(readShellPolicy().CURRENT_CACHE);
}

// Kaynak metni üzerinden çalışan testler için: sürüm literali beklenen
// biçimde yazılmış mı ve en az `minVersion` mı?
export function assertShellCacheAtLeast(minVersion, label = 'shell cache sürümü') {
  const source = readShellPolicySource();
  const match = /CURRENT_CACHE = `\$\{CACHE_PREFIX\}v(\d+)`/.exec(source);
  assert.ok(match, `${label}: CURRENT_CACHE literali beklenen biçimde değil`);
  const version = Number(match[1]);
  assert.ok(
    version >= minVersion,
    `${label}: shell cache sürümü v${version}, en az v${minVersion} olmalı`
  );
  assert.equal(version, shellCacheVersion(), `${label}: kaynak ve runtime sürümü ayrışmış`);
  return version;
}

export function assertShellAssets(assets, label = 'shell asset') {
  const policy = readShellPolicy();
  for (const asset of assets) {
    assert.ok(policy.SHELL_ASSETS.includes(asset), `${label}: ${asset} precache listesinde yok`);
  }
  return policy;
}
