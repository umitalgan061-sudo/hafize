# Hafize self-development durum kaydı

Otomatik turların birbirini görebilmesi için tutulur: tur başında okunur, tur
sonunda güncellenir. Son güncelleme: 2026-09-03.

## `main` doğrulama kapısı

`npm run check` **2026-08-14'ten beri kırmızıydı**: `canva_read` ve `gmail_read`
eklendiğinde `scripts/test-tool-runtime.mjs` içindeki `listToolPermissions()`
beklentisi güncellenmemişti. Zincir ilk hatada durduğu için ikinci hata da
gizlenmişti: `gmailReadClient.read(null)` sözleşme hatası yerine ham
`TypeError` üretiyordu. İkisi de bu turda onarıldı, kapı yerelde yeşil.

## Açık PR yığılması

2026-09-03: **722 açık PR**, toplam **12 merge**; son merge PR #111
(2026-08-14). #681–#737 turlarının çoğu bağımsız olarak aynı iki işi yeniden
yazdı: kapı onarımı ve "strict skills manifest + registry". Neden: turlar açık
PR listesini okumuyordu — `HAFIZE_RULES.md` içine önleyici bölüm eklendi.

## Yerelde doğrulanmış açık PR'lar

Bu turda fetch edilip `npm run check` ile çalıştırıldı; üçü de yeşil:

| PR | Branch | İçerik |
| --- | --- | --- |
| #734 | `claude/wizardly-sagan-kn87lz` | Keşif tabanlı `scripts/run-checks.mjs` (247 kontrol) + iki gerçek hata onarımı |
| #736 | `claude/wizardly-sagan-wuf9il` | Kapı onarımı + strict skills manifest ve registry |
| #735 | `claude/wizardly-sagan-mx567f` | Kapı onarımı + sınır girdilerinin fail-closed hâle getirilmesi |

## Önerilen merge sırası (karar kullanıcıya aittir)

1. **#734** — kapıyı elle bakılan zincirden kurtarır, bu regresyon sınıfının
   tekrarını engeller.
2. Bu turun PR'ı — ortak düzeltmeler #734 ile aynı içerikte, çakışma beklenmez.
3. **#736**, ardından stacked **#737** (alt ajan yaşam döngüsü).
4. Kalan PR'lar aynı konunun eski kopyalarıdır; kapatılabilir.

## Sıradaki iş

Bellek konsolidasyonunun HTTP sınırı, calendar/reminder read-first connector
(yazma yalnız `external.write` onayıyla), reviewer kalite kapılarının
genişletilmesi.
