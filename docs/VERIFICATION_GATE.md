# Doğrulama kapısı (keşif tabanlı)

`npm run check` artık `package.json` içindeki elle tutulan uzun komut zinciri yerine
`scripts/run-checks.mjs` üzerinden çalışır.

## Neden

Elle tutulan zincir sürüklendi:

- 86 doğrulama betiğinin **33'ü** kapıya hiç eklenmemişti. Aralarında OAuth PKCE, token
  şifreleme, token file store, Google/Canva token exchange, personal memory encryption ve
  screen-share testleri gibi güvenlik açısından en hassas dosyalar vardı.
- Zincir `&&` ile bağlı olduğu için ilk hatada duruyordu; `test-tool-runtime.mjs` kırmızıya
  döndüğünde arkasındaki tüm kontroller sessizce çalışmıyordu.

## Davranış

- Kaynak keşfi: kökteki `*.mjs`, `lib/**/*.mjs`, `scripts/**/*.mjs`, `public/**/*.js`.
  Her biri `node --check` ile syntax kontrolünden geçer.
- Betik keşfi: `scripts/` altındaki `test-*.mjs` ve `validate-*.mjs` dosyaları çalıştırılır.
  Başka bir önek taşıyan `scripts/` dosyaları yalnız syntax kontrolüne girer.
- Kapı ilk hatada durmaz; tüm hataları toplayıp sonunda raporlar ve çıkış kodu `1` verir.
- Betik başına 120 sn zaman aşımı vardır; zaman aşımı hata sayılır.
- Keşif hiçbir kaynak veya betik bulamazsa kapı yeşile dönmez, `1` ile çıkar (fail-closed).

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm run check` | Syntax + tüm doğrulama betikleri |
| `npm run check:syntax` | Yalnız syntax kontrolü |
| `npm run check:list` | Keşfedilen dosya listesini yazdırır |

`node scripts/run-checks.mjs --root=DIR` yalnız kapının kendi testi (`scripts/test-run-checks.mjs`)
için vardır; geçici bir fixture kökünde çalışmayı sağlar.

## Yeni dosya eklerken

Yeni bir `lib/` modülü veya `scripts/test-*.mjs` dosyası eklendiğinde `package.json`
güncellenmez; kapı dosyayı kendiliğinden bulur. Bir betiğin bilinçli olarak kapı dışında
kalması gerekiyorsa `scripts/run-checks.mjs` içindeki `OPT_IN_SCRIPTS` kümesine eklenir ve
nedeni burada belgelenir.

## Geri alma

`package.json` içindeki `scripts` bloğu eski zincire döndürülerek geri alınabilir; ancak bu,
33 doğrulama betiğini yeniden kapı dışında bırakır.
