// Üretilmiş varlıklar sözleşmesi.
//
// `public/typed-build/` depoya işlenmiş **üretim çıktısıdır**. Bunun nedeni
// `npm start`ın temiz bir kopyada derleme adımı beklememesi: sunucu
// `public/`i olduğu gibi servis eder, tarayıcı da `.mts` yükleyemez.
//
// İşlenmiş çıktının bedeli sessiz kaymadır: biri `.mts` kaynağını düzenleyip
// `npm run build` çalıştırmayı unutursa depo, kaynakla eşleşmeyen JavaScript
// servis etmeye devam eder ve hiçbir tip denetimi bunu yakalamaz. Bu yüzden
// paket dosya varlığını değil **tazeliği** ölçer: kaynaklar ayrı bir dizine
// yeniden derlenir ve çıktı bayt bayt karşılaştırılır.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BUILD_DIR = path.join(ROOT, 'public', 'typed-build');

/** `index.html` ve servis çalışanının birlikte yüklediği derlenmiş girişler. */
const ENTRIES = Object.freeze([
  'app-runtime',
  'prompt-library-smart-fill',
  'prompt-library-command-palette',
  'scheduled-tasks-countdown',
  'prompt-library-smart-fill-hints'
]);

const html = readFileSync(path.join(ROOT, 'public', 'index.html'), 'utf8');
const swPolicySource = readFileSync(path.join(ROOT, 'public', 'sw-policy.js'), 'utf8');

// --- Her giriş sayfada ve kabuk önbelleğinde birlikte yer alır --------------
for (const entry of ENTRIES) {
  assert.ok(html.includes(`/typed-build/${entry}.js`), `${entry} index.html tarafından yüklenmiyor`);
  assert.ok(swPolicySource.includes(`/typed-build/${entry}.js`), `${entry} PWA kabuk önbelleğinde yok`);
  // Taşınmış modülün ham `.js` sürümü hâlâ yükleniyorsa iki kopya çalışır.
  assert.equal(html.includes(`src="/${entry}.js"`), false, `${entry} hem ham hem derlenmiş hâliyle yükleniyor`);
}

// Taşınmış modüllerin `.mts` kaynağı yerinde durmalı: derlenmiş çıktı
// kaynaksız kalırsa yeniden üretilemez.
for (const source of [
  'public/typed/app-runtime.mts',
  'public/typed/hafize-api.mts',
  'public/typed/hafize-types.mts',
  'public/prompt-library-smart-fill.mts',
  'public/prompt-library-command-palette.mts',
  'public/prompt-library-smart-fill-hints.mts',
  'public/scheduled-tasks-countdown.mts'
]) {
  assert.ok(existsSync(path.join(ROOT, source)), `kaynak eksik: ${source}`);
}

// Çalışma zamanı tanılama biçemi sayfaya bağlıdır.
assert.ok(existsSync(path.join(ROOT, 'public', 'hafize-runtime.css')));
assert.ok(html.includes('/hafize-runtime.css'), 'tanılama biçem dosyası sayfaya bağlanmamış');

// Kaynak dosya sistemi yolu veya joker giriş sayfaya sızmamalı.
assert.equal(html.includes('/public/typed'), false, 'kaynak dosya sistemi yolu HTML içinde görünmemeli');
assert.equal(html.includes('typed-build/*.js'), false, 'joker giriş kullanılamaz');

// --- İşlenmiş çıktı kaynağıyla aynı mı? ------------------------------------
//
// Derleme geçici bir dizine yönlendirilir; `public/typed-build/` bu paket
// tarafından hiçbir koşulda değiştirilmez.
const scratch = mkdtempSync(path.join(tmpdir(), 'hafize-typed-build-'));
try {
  execFileSync(
    process.execPath,
    [path.join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js'), 'build', '--outDir', scratch, '--emptyOutDir'],
    { cwd: ROOT, stdio: 'pipe' }
  );

  const jsFile = (dir) => readdirSync(dir).filter((name) => name.endsWith('.js')).sort();
  const committed = jsFile(BUILD_DIR);
  const fresh = jsFile(scratch);

  assert.deepEqual(
    committed,
    fresh,
    'işlenmiş çıktı dosya listesi kaynaktan üretilenle eşleşmiyor — `npm run build` çalıştırıp sonucu işleyin'
  );
  assert.deepEqual(committed, ENTRIES.map((entry) => `${entry}.js`).sort(), 'beklenen giriş kümesi değişmiş');

  for (const name of committed) {
    const a = readFileSync(path.join(BUILD_DIR, name), 'utf8');
    const b = readFileSync(path.join(scratch, name), 'utf8');
    assert.equal(
      a,
      b,
      `public/typed-build/${name} kaynağıyla eşleşmiyor — bir .mts dosyası derlenmeden işlenmiş. ` +
        '`npm run build` çalıştırıp public/typed-build/ çıktısını da işleyin.'
    );
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
}

console.log(`generated assets OK: ${ENTRIES.length} derlenmiş giriş kaynağıyla bayt bayt aynı`);
