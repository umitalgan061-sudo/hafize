# Platform Runtime

## Amaç

Hafize'nin tarayıcı tarafındaki typed platform katmanı, özelliklerin cihaz yeteneklerini, ağ durumunu, depolama kapasitesini, yaşam döngüsünü ve sınırlı performans sinyallerini tek bir sözleşme üzerinden gözlemlemesini sağlar.

## Temel ilkeler

1. Runtime gözlemci olmalı, kullanıcı verisini sunucuya taşımamalıdır.
2. Feature başlatma ve durdurma idempotent olmalıdır.
3. Tarayıcı desteği yoksa özellik güvenli fallback ile çalışmalıdır.
4. Ölçüm verisi bounded olmalıdır.
5. Hata bir özelliği durdurmamalı; yalnızca ilgili feature'ı degraded duruma almalıdır.
6. State-changing dış servis çağrıları bu katmanın görevi değildir.
7. UI katmanı DOM API'lerini güvenli biçimde kullanmalıdır.

## Modüller

`platform-runtime.ts` ana yaşam döngüsünü yönetir. Capability snapshot, storage estimate, performance observer ve feature lifecycle burada toplanır.

`platform-policy.ts` capability matrix üretir. Her politika için `allowed` veya `fallback` kararı döndürür.

`platform-events.ts` typed event bus sağlar. Feature'lar string event sözleşmelerini doğrudan kopyalamak yerine merkezi tipleri kullanabilir.

`platform-performance.ts` Core Web Vitals ve etkileşim sinyallerini uygulama içi bütçelerle karşılaştırır.

`platform-diagnostics.ts` kullanıcı başlattığında güvenli bir yerel tanılama JSON'u üretir. Sohbet, secret ve credential içermemelidir.

`platform-task-queue-fixed.ts` kısa ömürlü, bounded, abortable görevleri önceliklendirir.

`platform-feature-registry.ts` mevcut legacy/typed feature global'lerini keşfedip runtime'a görünür hale getirir.

## Snapshot

Snapshot değişmez bir nesne olarak sunulur. UI hiçbir zaman runtime iç state'ini değiştiremez.

Ana alanlar:

- `phase`: booting, ready, degraded, stopped
- `network`: online, offline, unknown
- `visible`: sekme görünürlüğü
- `capabilities`: tarayıcı yetenek matrisi
- `storage`: kullanım ve kota tahmini
- `metrics`: son bounded metrikler
- `featureStates`: feature lifecycle durumu
- `errors`: sınırlı hata sayısı

## Lifecycle

Boot sırasında capability detection yapılır. Performance observer ve lifecycle event listener'ları kurulur. Storage estimate asenkron çalışır. Feature'lar priority sırasına göre başlatılır.

Ağ çevrimdışına düşerse snapshot degraded olur. Ağ geri geldiğinde storage estimate yenilenir.

`stop()` bütün feature controller'larını abort eder, cleanup callback'lerini çağırır ve listener'ları kaldırır.

## Feature sözleşmesi

Her feature benzersiz `id` taşır. `start` metodu typed context alır ve isteğe bağlı cleanup callback'i döndürür.

Context içinde:

- abort signal,
- capabilities,
- immutable snapshot erişimi,
- idle scheduling,
- metric ekleme

bulunur.

## Hata yönetimi

Window error ve unhandled rejection olayları bounded hata sayısına çevrilir. Feature exception'ları ilgili feature'ı `failed` yapar. Runtime kendisi çalışmaya devam eder.

## Depolama

Runtime kalıcılığı sadece küçük lifecycle metadata'sı içindir. Chat içerikleri, secret'lar veya authentication credential'ları runtime snapshot'a yazılmaz.

## PWA

Platform bundle mevcut `app-runtime` typed giriş noktasına dahil edilir. Böylece yeni bir auth/session yolu oluşturulmaz. Service worker statik shell politikasını korur ve API isteklerini cache dışı bırakır.

## Genişletme kuralı

Yeni feature önce policy tanımı ve lifecycle adapter ile sisteme alınmalı; doğrudan global listener eklemek son çare olmalıdır.
