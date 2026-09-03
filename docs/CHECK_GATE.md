# Doğrulama kapısı (`npm run check`)

## Neden

Kapı daha önce `package.json` içinde tek satırlık dev bir komuttu. Yeni bir test
dosyası eklendiğinde bu satıra elle eklenmesi gerekiyordu ve unutulduğunda test
sessizce hiç çalışmıyordu: 85 test scriptinden 33'ü kapının dışında kalmıştı ve
`scripts/test-tool-runtime.mjs` uzun süre kırmızı kaldığı fark edilmedi.

## Nasıl çalışır

`scripts/run-checks.mjs` kontrol edilecek her şeyi diskten keşfeder:

- **Syntax**: `server.mjs`, `lib/*.mjs`, `public/*.js`, `scripts/*.mjs` için
  `node --check` (8 paralel süreç).
- **Doğrulayıcılar**: `EXTRA_VALIDATORS` (şu an `validate-agent-registry.mjs`),
  testlerden önce.
- **Testler**: `scripts/test-*.mjs` dosyalarının tamamı, sırayla — bazı testler
  geçici dosya ve sahte saat kullandığı için paralel çalıştırılmaz.

Kapı ilk hatada durmaz; tüm testleri çalıştırıp başarısız olanların son 25 satırını
özet halinde basar ve çıkış kodu `1` olur.

## Komutlar

| Komut | Ne yapar |
| --- | --- |
| `npm run check` | Syntax + doğrulayıcılar + tüm testler (~11 sn). |
| `npm run precheck` | Yalnızca syntax; `check` öncesi npm tarafından da çağrılır. |
| `node scripts/run-checks.mjs --list` | Kapsanan dosya ve testleri listeler, hiçbir şey çalıştırmaz. |

## Dışlanan testler

Yalnızca dış bir servis gerektiren testler `EXCLUDED_TESTS` haritasına gerekçesiyle
eklenebilir. Şu an tek dışlama `test-redis-schedule-lease-live.mjs` (canlı Redis).

`scripts/test-run-checks.mjs` her turda şunları doğrular: her `test-*.mjs` ya kapıda
çalışır ya da gerekçeli olarak dışlanmıştır, dışlanan dosyalar diskte gerçekten
vardır, syntax kapsamı `lib/` ve `public/` ağaçlarının tamamıdır ve doğrulayıcılar
iki kez çalışmaz.

## Geri alma

`package.json` içindeki `check`/`precheck` komutları eski tek satırlık hâline
döndürülebilir; `scripts/run-checks.mjs` ve `scripts/test-run-checks.mjs` başka
hiçbir modül tarafından içe aktarılmaz.
