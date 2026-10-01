# Sistem Sağlığı ve Readiness

Hafize’nin public health yüzeyi artık tekil servis bayraklarının yanında typed bir sistem readiness özeti üretir.

## Kapsam

Sistem readiness; kimlik doğrulama, PWA, Skills, bellek, zamanlama, bağlantılar, model ve release bileşenlerini tek raporda toplar.

Durumlar:

- ready: bileşen bilinen kontrollerle kullanılabilir.
- warning: çalışma mümkün, ancak operasyonel uyarı vardır.
- degraded: sistemin bir bölümü çalışırken readiness tam değildir.
- blocked: üretim için kritik bir koşul sağlanmamıştır.
- unknown: bileşen güvenli biçimde doğrulanamamıştır.

## Public health sınırı

GET /api/health yalnız durum ve yapılandırılmış özet döndürür. Secret, token, credential, Authorization header, prompt veya kişisel veri döndürülmez.

Readiness config değerlendirmesi secret değerlerini rapora kopyalamaz. Secret alanlarının varlığı veya eksikliği yalnız durum ve finding kodları üzerinden değerlendirilir.

## Kullanıcı arayüzü

Sistem Sağlığı kartı:

- hazır, uyarı, engelli ve bilinmeyen durumlarını gösterir,
- bileşen bazlı durum rozetleri sunar,
- son kontrol zamanını gösterir,
- manuel yenileme sağlar,
- 60 saniyelik bounded yenileme kullanır,
- 8 saniyelik fetch timeout uygular,
- başarısız istekte mevcut sayfayı bozmadan güvenli hata gösterir.

UI yalnız GET /api/health isteği yapar. Browser storage, Authorization header, telemetry ve kullanıcı içeriği kullanmaz.

## PWA

Panel Vite build zincirine dahil edilir ve service worker shell listesinde cache'lenir. API cevapları cache kapsamına alınmaz.

## Geri alma

Panel ve readiness servisinin geri alınması health endpoint'in mevcut güvenli alanlarını bozmaz. Legacy tüketiciler için eski readiness yolları bridge olarak korunur.

## Kabul ölçütleri

- TS kaynakları strict typecheck kapsamındadır.
- Eski readiness implementasyonları yalnız bridge içerir.
- Server health çıktısı typed readiness taşır.
- UI network isteği GET health çağrısı ile sınırlıdır.
- UI localStorage ve sessionStorage kullanmaz.
- Vite entry ve PWA shell entegrasyonu ayrı gate'lerle doğrulanır.
