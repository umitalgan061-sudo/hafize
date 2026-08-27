# Check gate — `npm run check`

Hafize'nin tek doğrulama kapısı `scripts/run-checks.mjs` üzerinden çalışır.

## Neden keşif tabanlı

Gate daha önce `package.json` içinde elle bakımı yapılan tek satırlık ~120
komutluk bir `&&` zinciriydi. Bu tasarımın iki somut maliyeti ölçüldü:

- 85 test dosyasının 32'si zincire hiç eklenmemişti ve hiçbir turda
  çalışmıyordu;
- zincir fail-fast olduğu için eskimiş tek bir assertion (`test-tool-runtime`
  içindeki üç kayıtlı tool listesi) kendinden sonraki ~100 kontrolü tamamen
  gizliyordu. Bu sırada `lib/gmail-read-client.mjs` içindeki null istek
  çökmesi fark edilmeden kaldı.

Yeni runner bu iki hata sınıfını yapısal olarak ortadan kaldırır.

## Kapsam

Runner her çalıştırmada diskten keşfeder:

- **Syntax hedefleri** (`node --check`): `server.mjs`, `lib/*.mjs`,
  `public/*.js`, `scripts/*.mjs`.
- **Test scriptleri**: `scripts/validate-agent-registry.mjs` ve sıralı olarak
  tüm `scripts/test-*.mjs` dosyaları.

Yeni bir modül veya test eklendiğinde gate'e ayrıca kaydedilmesi gerekmez;
dosya diske eklendiği anda kapsama girer.

## Davranış

- Tüm kontroller çalıştırılır; ilk hatada durulmaz. Başarısızlıklar sonda
  toplu olarak, her birinin tam çıktısıyla raporlanır.
- Çıkış kodu herhangi bir kontrol başarısızsa 1, aksi halde 0'dır.
- Her test kendi başarı satırını yazar; runner bunu `ok <script>` satırında
  özetler.
- Canlı dış servis gerektiren testler kendi içinde atlanır. Örnek:
  `test-redis-schedule-lease-live.mjs`, `HAFIZE_TEST_REDIS_URL` tanımlı
  değilse skip yazıp başarıyla döner.

## Invariant testi

`scripts/test-check-runner.mjs` gate'in kendi sözleşmesini kilitler:

- diskteki her `scripts/test-*.mjs` dosyası gate kapsamında olmalıdır;
- hedef listeleri tekrarsız ve deterministik sıralı olmalıdır;
- her `lib/*.mjs` modülü ve her test dosyası syntax kontrolüne girmelidir;
- runner kendi testini de kapsamalıdır.

Bu test geçmeden gate'in "yeşil" olması anlamlı değildir.

## Kullanım

```
npm run check
```

Tek bir testi ayrıca çalıştırmak için doğrudan `node scripts/test-*.mjs`
kullanılır. `precheck` scripti kaldırılmıştır: kapsadığı dört test zaten
keşifle çalışıyordu ve npm onları `check` öncesinde ikinci kez çalıştırıyordu.
