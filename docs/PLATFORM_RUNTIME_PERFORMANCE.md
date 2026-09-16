# Platform Runtime Performance

## Ölçüm amacı

Runtime performans gözlemini uygulama davranışından ayırır. Ölçüm mekanizması kendi başına kullanıcı deneyimini bozacak kadar ağır olmamalıdır.

## İzlenen sinyaller

- navigation
- resource
- longtask
- largest-contentful-paint
- layout-shift
- event

## Budget

| Metrik | Uyarı | Kritik |
| --- | ---: | ---: |
| Sayfa açılışı | 1800 ms | 3500 ms |
| LCP | 2500 ms | 4000 ms |
| Uzun görev | 120 ms | 300 ms |
| Etkileşim | 100 ms | 250 ms |
| Kaynak yükleme | 1500 ms | 4000 ms |
| Layout shift | 0.10 | 0.25 |

## Bounded collection

Runtime yalnızca son 80 metriği tutar. Dashboard yalnızca son 8 değeri gösterir. Bu iki sınır CPU ve DOM maliyetini sınırlamak içindir.

## Observer başarısızlığı

Bazı tarayıcılar bazı PerformanceObserver entry type'larını desteklemeyebilir. Her observer ayrı `try/catch` bloğunda kurulduğu için bir entry type'ın eksikliği runtime boot'unu başarısız kılmaz.

## Idle work

Düşük öncelikli işler `requestIdleCallback` bulunduğunda idle dönemine, bulunmadığında kısa timeout fallback'ine bırakılır. Uzun ve kritik işler idle queue'ya atılmamalıdır.

## Storage estimate

Storage estimate asenkron ve best-effort'tur. API bulunmadığında dashboard `—` veya `Bilinmiyor` gösterir. Estimate başarısızlığı feature failure değildir.

## Task queue

Queue concurrency varsayılanı 2'dir. Her iş için timeout üst sınırı 120 saniyedir. Queue 32 bekleyen/kayıtlı task limitini aşamaz.

## Dashboard repaint

Dashboard kapalıyken snapshot event'leri DOM'u yeniden çizmez. Açıldığında tek render yapılır. Bu nedenle runtime metrikleri artarken gereksiz layout çalışması engellenir.

## Performans regressions

Yeni feature ekleyen geliştirici:

1. yeni observer eklemeden önce mevcut metric adlarını kontrol eder,
2. büyük payload saklamaz,
3. dashboard'ı kapalıyken render etmez,
4. queue'ya timeout koyar,
5. fallback yolunu test eder.

## Release kabulü

En azından production build, typed no-emit check, runtime source tests ve PWA asset testleri çalıştırılmalıdır. Browser smoke testinde console error ve duplicate dashboard paneli kontrol edilir.
