// `package.json` betiklerinin işaret ettiği her dosya gerçekten var mı?
//
// Bu paket, `npm run check`in göremediği bir boşluğu kapatır. Kontrol kapısı
// paketleri doğrudan `node scripts/test-*.mjs` ile çalıştırır; `npm start`in
// kendisi hiç çalıştırılmaz. Bu yüzden `lib/production-guard.mjs` → `.mts`
// taşındığında `start` betiği eski yolu göstermeye devam etti ve kapı sonuna
// kadar yeşil kaldı — oysa temiz bir kopyada `npm start` ilk saniyede
// `ERR_MODULE_NOT_FOUND` ile düşüyordu.
//
// Bir modül yolunun varlığını doğrulamak, betiği çalıştırmaktan çok daha
// ucuz ve bu arıza sınıfını tümüyle kapatıyor.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

/**
 * Bir betik komutundaki depo içi dosya yollarını çıkarır.
 *
 * Yalnızca `./` ya da `lib/`, `scripts/` gibi göreli yollar aranır; `node`,
 * `vite` ve bayraklar atlanır.
 *
 * @param {string} command
 * @returns {string[]}
 */
function referencedFiles(command) {
  return command
    .split(/\s+/)
    .filter((token) => /^\.?\.?\/?(?:lib|scripts|server)[\w./-]*\.(?:mjs|mts|js|ts)$/.test(token))
    .map((token) => token.replace(/^\.\//, ''));
}

const checked = [];
for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
  for (const file of referencedFiles(String(command))) {
    assert.ok(
      existsSync(path.join(ROOT, file)),
      `package.json → scripts.${name} var olmayan bir dosyayı gösteriyor: ${file}`
    );
    checked.push(`${name}:${file}`);
  }
}

assert.ok(checked.length >= 4, `en az dört betik yolu denetlenmeliydi, bulunan: ${checked.length}`);

// `start` üretim girişidir: hem koruyucuyu hem sunucuyu adlandırmalı.
{
  const start = String(pkg.scripts?.start ?? '');
  assert.match(start, /production-guard\.(?:mjs|mts)/, 'start üretim koruyucusunu yüklemeli');
  // Uzantı sabitlenmez: sunucu `.mjs` ya da `.mts` olabilir.
  assert.match(start, /server\.m[jt]s/, 'start sunucuyu açmalı');
  for (const file of referencedFiles(start)) {
    assert.ok(existsSync(path.join(ROOT, file)), `start girişi eksik: ${file}`);
  }
}

// Kaynak ağacındaki içe aktarma belirteçleri de var olan dosyaları göstermeli.
// Taşıma sırasında bir `.mjs` → `.mts` yeniden bağlaması atlanırsa tip
// denetimi bunu göremez: `checkJs` çözümlemesi Node'un çalışma zamanı
// çözümlemesinden farklıdır.
{
  const { globSync } = await import('node:fs');
  const sources = [
    ...globSync('lib/*.{mjs,mts}', { cwd: ROOT }),
    ...globSync('scripts/*.mjs', { cwd: ROOT }),
    'server.mts'
  ];
  const missing = [];
  for (const relative of sources) {
    const file = path.join(ROOT, relative);
    if (!existsSync(file)) continue;
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+\.(?:mjs|mts))['"]/g)) {
      const target = path.resolve(path.dirname(file), match[1]);
      if (!existsSync(target)) missing.push(`${relative} → ${match[1]}`);
    }
  }
  assert.deepEqual(missing, [], `çözümlenemeyen içe aktarmalar:\n  ${missing.join('\n  ')}`);
}

console.log(`package entrypoints OK: ${checked.length} betik yolu ve tüm göreli içe aktarmalar çözümleniyor`);
