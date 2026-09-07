# PWA readiness

PWA readiness artık install shell, manifest ve service-worker davranışını tek bir deterministic contract ile kontrol edebilir. API yollarının cache'e girmemesi ve offline navigation fallback'i temel güvenlik/UX koşullarıdır.

Service worker install adımı shell cache'lemesi başarıyla tamamlanmadan `skipWaiting()` çağırmaz. Böylece bozuk veya eksik shell ile yeni worker'ın aktifleşmesi engellenir.

Bu katman browser API'lerini mocklamaz; pure contract testleri ile statik yapılandırmayı doğrular. Gerçek tarayıcı install/offline testi ayrıca yapılmalıdır.
