# Platform Runtime Features

## Adapter amacı

Feature registry, mevcut feature'ları yeniden başlatmadan platform runtime'da görünür hale getirir.

## Adapter contract

Her adapter benzersiz id ve opsiyonel globalName içerir. Başlatma sırasında global mevcutsa feature-ready metriği eklenir; yoksa feature-missing sinyali bırakılır.

## Idempotency

Aynı feature id ikinci kez register edilmez. Runtime running durumundaki feature'ı tekrar başlatmaz.

## Priority

Application runtime yüksek önceliklidir. Diğer adapters standart öncelikte çalışır. Aynı priority'de id alfabetik düzeni uygulanır.

## Legacy compatibility

Registry yalnızca gözlemci rolündedir. Legacy module event listener'larını veya controller'larını çağırmaz.

## Failure

Adapter exception'ı yalnızca adapter feature'ını failed hale getirir. Runtime lifecycle devam eder.

## Removal

Feature modülü artık kullanılmıyorsa adapter listeden çıkarılabilir. Eski storage alanları otomatik silinmez.

## New feature checklist

- unique id
- capability policy
- abort-aware lifecycle
- bounded metrics
- cleanup callback
- source contract test
- browser smoke test
- rollback note

## Future

Gerçek feature controller'ları bu registry üzerinden merkezi health bilgisi sağlayabilir. Bu geçişte doğrudan controller API'larına zorunlu dependency getirilmemelidir.
