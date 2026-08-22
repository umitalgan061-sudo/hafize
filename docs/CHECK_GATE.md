# Doğrulama Kapısı (`npm run check`)

## Amaç

Her self-development turunun sonunda çalıştırılan tek doğrulama kapısı.
Kapı `scripts/run-checks.mjs` tarafından yürütülür ve **dosyaları diskten
keşfeder**; elle bakımı yapılan bir komut zinciri yoktur.

## Komutlar

| Komut | Kapsam | Süre |
| --- | --- | --- |
| `npm run precheck` | Yalnızca syntax (`node --check`) taraması | ~1 sn |
| `npm run check` | Syntax taraması + registry doğrulaması + tüm test suite'leri | ~12 sn |

## Kapsam kuralları

Kapı şu dosyaları otomatik olarak kapsar:

- `server.mjs`
- `lib/*.mjs`
- `public/*.js`
- `scripts/*.mjs`
- `scripts/validate-agent-registry.mjs` (registry doğrulaması)
- `scripts/test-*.mjs` (her biri ayrı bir suite olarak)

Yeni bir modül veya test dosyası eklendiğinde kapıya ayrıca eklenmesi
**gerekmez**; dosya adı yukarıdaki kalıplara uyduğu anda kapsama girer.

## Davranış

- Bir suite başarısız olduğunda kapı durmaz; kalan tüm suite'ler de çalışır ve
  sonunda başarısız olanların tam çıktısı birlikte raporlanır. Böylece ilk hata
  arkasındaki hataları gizlemez.
- Her suite için 120 saniyelik zaman aşımı uygulanır; asılı kalan bir test kapıyı
  süresiz bloke edemez.
- Herhangi bir başarısızlıkta çıkış kodu `1`'dir.
- Dış servis gerektiren entegrasyon testleri (örneğin
  `scripts/test-redis-schedule-lease-live.mjs`) ilgili ortam değişkeni yoksa
  kendilerini atlar ve kapıyı kırmaz.

## Neden bu biçim

Önceki kapı, `package.json` içinde elle büyütülen tek satırlık bir `&&`
zinciriydi. Bu yapının iki somut sorunu vardı:

1. **Sessiz kapsam kaybı** — 32 test dosyası (OAuth PKCE, token şifreleme,
   token store, Canva/Google OAuth akışları, ekran paylaşımı ve hands-free
   testleri dahil) zincire hiç eklenmemişti ve hiçbir turda çalışmıyordu.
2. **İlk hatada durma** — zincir ilk başarısız komutta kesildiğinden, aynı anda
   kırık olan diğer testler görünmüyordu.

Keşif tabanlı runner her iki sorunu da yapısal olarak ortadan kaldırır.

## Geri alma

`scripts/run-checks.mjs` dosyası silinip `package.json` içindeki `check` /
`precheck` komutları önceki commit'teki zincire döndürülerek geri alınabilir.
