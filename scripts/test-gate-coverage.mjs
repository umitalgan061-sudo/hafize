// Kapı kapsam sözleşmesi: yazılmış her testin gerçekten çalıştırıldığını doğrular.
//
// Bu test, "test dosyası var ama kapıda hiç çalışmıyor" ve "kaynak dosya var ama
// syntax kontrolü yok" regresyonlarını engeller.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ROOT, SKIPPED, runnableScripts, syntaxTargets } from './run-tests.mjs';

const scriptFiles = readdirSync(path.join(ROOT, 'scripts')).filter((name) => name.endsWith('.mjs'));
const runnable = new Set(runnableScripts());
const syntax = new Set(syntaxTargets());

// Her test ve validator ya kapıda çalışır ya da açık gerekçeyle atlanır.
for (const name of scriptFiles) {
  if (name === 'run-tests.mjs') continue;
  if (!name.startsWith('test-') && !name.startsWith('validate-')) continue;
  const skipReason = SKIPPED.get(name);
  if (skipReason !== undefined) {
    assert.equal(typeof skipReason, 'string', `${name} skip gerekçesi metin olmalı`);
    assert.ok(skipReason.trim().length >= 10, `${name} skip gerekçesi anlamlı olmalı`);
    assert.equal(runnable.has(`scripts/${name}`), false, `${name} hem atlanıp hem çalıştırılamaz`);
    continue;
  }
  assert.ok(runnable.has(`scripts/${name}`), `${name} kapıda çalıştırılmıyor`);
}

// Kapı kendi kendini çalıştırıp sonsuz döngüye girmez.
assert.equal(runnable.has('scripts/run-tests.mjs'), false);
assert.ok(runnable.has('scripts/test-gate-coverage.mjs'));
assert.ok(runnable.has('scripts/validate-agent-registry.mjs'));

// Sunucu, kütüphane ve istemci kaynakları syntax kontrolüne dahildir.
assert.ok(syntax.has('server.mjs'));
for (const name of readdirSync(path.join(ROOT, 'lib'))) {
  if (name.endsWith('.mjs')) assert.ok(syntax.has(`lib/${name}`), `lib/${name} syntax kontrolünde değil`);
}
for (const name of readdirSync(path.join(ROOT, 'public'))) {
  if (name.endsWith('.js')) assert.ok(syntax.has(`public/${name}`), `public/${name} syntax kontrolünde değil`);
}
for (const name of scriptFiles) assert.ok(syntax.has(`scripts/${name}`), `scripts/${name} syntax kontrolünde değil`);

// npm kapı komutları tek çalıştırıcıya bağlıdır; elle tutulan zincir geri gelmez.
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
assert.equal(pkg.scripts.check, 'node scripts/run-tests.mjs');
assert.ok(pkg.scripts.precheck.startsWith('node scripts/run-tests.mjs '));
assert.equal(pkg.scripts.check.includes('&&'), false);
assert.equal(pkg.scripts.precheck.includes('&&'), false);

console.log(`gate coverage OK: ${runnable.size} script kapıda, ${syntax.size} dosya syntax kontrolünde, ${SKIPPED.size} açık skip`);
