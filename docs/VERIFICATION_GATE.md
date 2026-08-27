# Doğrulama Kapısı (Verification Gate)

`scripts/run-checks.mjs`, Hafize'nin tek doğrulama kapısıdır. `npm run check` bu çalıştırıcıyı çağırır.

## Neden değişti

Önceki kapı, `package.json` içinde elle bakımı yapılan ~8 KB'lık tek bir `&&` zinciriydi. İki yapısal sorunu vardı:

1. **Sessiz kapsam kaybı.** Hedefler elle yazıldığı için yeni eklenen dosyalar zincire girmediğinde kapsam dışı kalıyordu. Değişim anında 86 test paketinin 32'si hiç çalışmıyordu (`test-oauth-*`, `test-personal-memory-runtime`, `test-canva-read-client`, `test-device-bridge-policy`, `test-google-token-exchange` ve diğerleri).
2. **İlk hatada durma.** `&&` zinciri ilk kırmızıda kesiliyor, arkasındaki tüm hedefler çalışmamış olmasına rağmen rapor tek bir hata gösteriyordu.

Bu iki sorun birlikte gerçek hataları gizledi: kapı kırmızıya döndüğünde arkasında `scripts/test-tool-runtime.mjs` (bayat tool permission beklentisi) ve `lib/gmail-read-client.mjs` (`null` girdide sözleşme hatası yerine `TypeError`) hataları birikmişti.

## Kapının açığa çıkardığı sınır hatası sınıfı

`{ ... } = {}` varsayılanı yalnız `undefined` için devreye girer. `null` veya skaler bir girdi geldiğinde sınır, sözleşme hatası yerine `TypeError` fırlatıyordu. Bu turda dört sınır sözleşmeye bağlandı:

| Sınır | Önce | Sonra |
| --- | --- | --- |
| `lib/gmail-read-client.mjs` `read` | `TypeError` | `INVALID_GMAIL_READ:input` |
| `lib/canva-read-client.mjs` `read` | `TypeError` | `INVALID_CANVA_READ:input` |
| `lib/schedule-http-api.mjs` `handle` | `TypeError` (istek yolunda) | `{ matched: false }` |
| `lib/server-auth.mjs` `authenticate` | `TypeError` | `{ ok: false, error: 'AUTH_REQUIRED' }` |

İki connector read sınırı artık bilinmeyen alanları da reddeder (strict object); istek yolundaki iki sınır ise hiçbir girdi için fırlatmaz. Her dördü de kendi test paketinde `undefined`, `null`, string, sayı, dizi ve fazladan alan girdileriyle doğrulanır.

## Sözleşme

- **Kapsam diskten keşfedilir.** Syntax hedefleri: kök `*.mjs`, `lib/*.mjs`, `scripts/*.mjs`, `public/*.js`. Test hedefleri: `scripts/test-*.mjs`. Yeni dosya eklemek için kapı dosyası düzenlenmez; hedef otomatik kapsanır.
- **Çalıştırıcının kendisi test listesine giremez** (`NON_TEST_SCRIPTS`), aksi halde kapı kendini özyinelemeli çağırır.
- **Kapı ilk hatada durmaz.** Tüm hedefler çalışır, tüm hatalar toplanır ve sonunda tek bir özet raporlanır.
- **Her hedef ayrı süreçte çalışır.** Bir test paketinin global durumu diğerini etkilemez.
- **Her hedefin zaman aşımı vardır** (varsayılan 120 s). Asılı kalan bir test kapıyı süresiz kilitleyemez.
- **Çıkış kodu.** Tek bir başarısızlık bile `exit 1` üretir.
- **Yakalanan çıktı sınırlıdır** (hedef başına son 4 KB); kapı raporu sınırsız log taşımaz.

## Kullanım

```
npm run check           # tam kapı: syntax + tüm testler
npm run check:syntax    # yalnız syntax
npm run check:tests     # yalnız testler
npm run check:list      # çalıştırmadan keşfedilen hedefleri listele

node scripts/run-checks.mjs --filter=gmail    # yalnız adı eşleşen hedefler
node scripts/run-checks.mjs --timeout=30000   # hedef başına zaman aşımı
```

Bilinmeyen argüman, boş kapsam (`--syntax-only --tests-only`) ve sınır dışı zaman aşımı sessizce yok sayılmaz; sözleşme hatası fırlatır. Kapının kapsamını daraltan bir `bypass` modu yoktur.

## Canlı servis gerektiren testler

Canlı bağımlılığı olan paketler (ör. `scripts/test-redis-schedule-lease-live.mjs`) kendi içinde ortam değişkeni yoksa `skip` edip `0` ile çıkar. Kapı bu paketleri dışlamaz; atlama kararı testin kendisine aittir ve görünürdür.

## Kapının kendi testi

`scripts/test-run-checks.mjs` keşif, filtre, argüman sözleşmesi ve hata toplama davranışını doğrular. Ayrıca daha önce kapsam dışı kalmış paketlerin artık keşfedildiğini açıkça kontrol eder — yani kapsam gerilemesi testle yakalanır.
