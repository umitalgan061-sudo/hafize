// Araç zinciri sözleşmesi.
//
// Projede iki ayrı TypeScript rejimi vardır ve bu paket ikisinin de
// sınırlarını sabitler:
//
//   • `lib/`, `server.mts`, `scripts/` ve `public/*.js` — Node'un yerel tip
//     sıyırması ve `checkJs` ile **derlenmeden** denetlenir.
//   • `public/**/*.mts` — tarayıcı `.mts` yükleyemediği için vite ile
//     `public/typed-build/` altına derlenir.
//
// Burada sürüm numarası değil değişmez sabitlenir: "TypeScript 7" gibi bir
// iddia bir sonraki yükseltmede yanlışlıkla kırmızıya döner, oysa "tip
// denetimi derleme üretmez" iddiası sürümden bağımsızdır. Tek istisna
// motorun alt sınırıdır: yerel tip sıyırma 22.18'den önce yoktur, yani o
// sayının kendisi bir sözleşmedir.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [pkgRaw, solutionRaw, typedRaw, baseRaw, vite, api, runtime, index] = await Promise.all([
  read('package.json'),
  read('tsconfig.json'),
  read('tsconfig.typed.json'),
  read('tsconfig.base.json'),
  read('vite.config.mts'),
  read('public/typed/hafize-api.mts'),
  read('public/typed/app-runtime.mts'),
  read('public/index.html')
]);

const pkg = JSON.parse(pkgRaw);
// Yapılandırmalar açıklama amaçlı `"// Neden"` anahtarları taşır; JSON bunu
// kabul eder, tsc yok sayar.
const solution = JSON.parse(solutionRaw);
const typed = JSON.parse(typedRaw);
const base = JSON.parse(baseRaw);

// --- Motor: yerel tip sıyırma için alt sınır --------------------------------
{
  const match = /^>=(\d+)\.(\d+)\./.exec(String(pkg.engines?.node ?? ''));
  assert.ok(match, `engines.node bir alt sınır belirtmeli, bulunan: ${pkg.engines?.node}`);
  const [major, minor] = [Number(match[1]), Number(match[2])];
  assert.ok(
    major > 22 || (major === 22 && minor >= 18),
    `yerel TypeScript tip sıyırması Node 22.18 ile geldi; alt sınır daha düşük olamaz (${pkg.engines?.node})`
  );
}

// --- Çalışma zamanı bağımlılıkları TypeScript'ten etkilenmez ----------------
{
  assert.deepEqual(Object.keys(pkg.dependencies ?? {}), ['redis'], 'tip araçları çalışma zamanına sızmamalı');
  for (const name of ['typescript', 'vite', '@types/node']) {
    assert.ok(pkg.devDependencies?.[name], `${name} devDependency olmalı`);
    assert.equal(pkg.dependencies?.[name], undefined, `${name} çalışma zamanı bağımlılığı olmamalı`);
  }
}

// --- Tek bir test koşucusu --------------------------------------------------
{
  assert.equal(pkg.scripts?.test, 'node scripts/run-checks.mjs');
  assert.equal(pkg.scripts?.check, 'node scripts/run-checks.mjs');
  for (const name of ['vitest', 'jest', 'mocha', 'ava']) {
    assert.equal(pkg.devDependencies?.[name], undefined, `${name} ikinci bir test sistemi kurar; koşucu tektir`);
  }
  assert.equal(
    JSON.stringify(pkg.scripts).includes('vitest'),
    false,
    'hiçbir npm betiği ikinci bir test koşucusu çağırmamalı'
  );
}

// --- Başlatma derleme adımı beklemez ---------------------------------------
{
  assert.equal(pkg.scripts?.prestart, undefined, 'npm start temiz bir kopyada derleme beklemeden çalışmalı');
  assert.match(pkg.scripts?.start ?? '', /^node .*server\.m[jt]s$/, 'start doğrudan sunucuyu açar');
  assert.equal(pkg.scripts?.typecheck, 'node scripts/run-typecheck.mjs');
  assert.match(pkg.scripts?.build ?? '', /run-typecheck\.mjs.*vite build/, 'build önce tip denetler, sonra paketler');
}

// --- Beş proje, tek çözüm dosyası ------------------------------------------
{
  const referenced = (solution.references ?? []).map((entry) => entry.path);
  assert.deepEqual(
    [...referenced].sort(),
    ['./tsconfig.browser.json', './tsconfig.node.json', './tsconfig.scripts.json', './tsconfig.typed.json', './tsconfig.worker.json'],
    'kök tsconfig yalnızca beş projeyi birbirine bağlar'
  );
  assert.deepEqual(solution.files ?? [], [], 'çözüm dosyası kendisi hiçbir dosya içermez');
}

// --- Denetim rejimi: taban derleme üretmez, typed projesi üretir ------------
{
  assert.equal(base.compilerOptions?.noEmit, true, 'taban yapılandırma yalnızca denetler');
  assert.equal(base.compilerOptions?.erasableSyntaxOnly, true, "Node'un sıyıramayacağı sözdizimi reddedilir");
  assert.equal(base.compilerOptions?.checkJs, true, '.mjs ve .js dosyaları da denetlenir');

  assert.notEqual(typed.compilerOptions?.noEmit, true, 'tarayıcı .mts modülleri gerçekten derlenir');
  assert.equal(typed.compilerOptions?.strict, true, 'sıfırdan yazılan TypeScript katı kipte denetlenir');
  assert.equal(typed.compilerOptions?.noUncheckedIndexedAccess, true);
  assert.equal(typed.compilerOptions?.exactOptionalPropertyTypes, true);
  assert.ok(typed.include?.includes('public/**/*.mts'), 'tarayıcı TypeScript kaynakları denetim kapsamında');
  assert.ok(typed.exclude?.includes('public/typed-build/**'), 'üretilmiş çıktı ikinci kez denetlenmez');
}

// --- Vite: her giriş bir `.mts` kaynağına bakar -----------------------------
{
  const entries = [
    ['app-runtime', 'public/typed/app-runtime.mts'],
    ['prompt-library-smart-fill', 'public/prompt-library-smart-fill.mts'],
    ['prompt-library-command-palette', 'public/prompt-library-command-palette.mts'],
    ['scheduled-tasks-countdown', 'public/scheduled-tasks-countdown.mts'],
    ['prompt-library-smart-fill-hints', 'public/prompt-library-smart-fill-hints.mts']
  ];
  for (const [name, source] of entries) {
    assert.ok(vite.includes(`'${name}': resolve(ROOT, '${source}')`), `vite girişi eksik: ${name}`);
    assert.ok(index.includes(`/typed-build/${name}.js`), `derlenmiş çıktı index.html tarafından yüklenmiyor: ${name}`);
    // Aynı modülün hem kaynağı hem derlenmişi yüklenirse iki kopya çalışır.
    assert.equal(index.includes(`src="/${name.replace('app-runtime', 'typed/app-runtime')}.mts"`), false, `ham kaynak da yükleniyor: ${name}`);
  }
  assert.ok(vite.includes("'/api':"), 'geliştirme sunucusunda API vekili tanımlı');
  assert.ok(vite.includes('transformIndexHtml'), 'geliştirme kipinde giriş yeniden yazımı tanımlı');
}

// --- Tarayıcı istemcisi kimlik bilgisi taşımaz ------------------------------
{
  assert.ok(api.includes('retryable'), 'geçici arıza ayrımı korunur');
  assert.ok(api.includes('TimeoutError'), 'zaman aşımı sınırı korunur');
  assert.doesNotMatch(api, /Authorization/, 'tarayıcı istemcisi kimlik bilgisi sahiplenemez');
  assert.doesNotMatch(api, /nvapi-|api[_-]?key\s*[:=]\s*['"]/i, 'istemciye gömülü anahtar yok');
  assert.ok(runtime.includes("'hafize:runtime-ready'"), 'çalışma zamanı yaşam döngüsü olayı korunur');
}

console.log('modern toolchain OK: tek koşucu, derlemesiz denetim, derlenen tek proje tarayıcı modülleri');
