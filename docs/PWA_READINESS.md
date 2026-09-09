# PWA readiness

PWA readiness artık install shell, manifest ve service-worker davranışını tek bir deterministic contract ile kontrol edebilir. API yollarının cache'e girmemesi ve offline navigation fallback'i temel güvenlik/UX koşullarıdır.

Service worker install adımı shell cache'lemesi başarıyla tamamlanmadan `skipWaiting()` çağırmaz. Böylece bozuk veya eksik shell ile yeni worker'ın aktifleşmesi engellenir.

Bu katman browser API'lerini mocklamaz; pure contract testleri ile statik yapılandırmayı doğrular. Gerçek tarayıcı install/offline testi ayrıca yapılmalıdır.

## Shell manifest tutarlılığı

`public/sw-policy.js` içindeki `SHELL_ASSETS` offline shell'in tek kaynağıdır ve iki yönlü tutarlı olmalıdır: listedeki her yol `public/` altında gerçekten bulunmalı, `index.html`'in yüklediği her same-origin alt kaynak da listede yer almalıdır. Eksik dosya `cache.addAll()` çağrısının tamamını reddeder; listede olmayan bir script ise cache'den açılan sayfada network-only sınıflanıp offline kırılmaya yol açar. Service worker'ın kendisi (`/sw.js`) hiçbir zaman shell'e girmez, aksi hâlde güncelleme kilitlenir.

`scripts/test-pwa-shell-manifest.mjs` bu iki yönlü kapsamayı ve sınıflandırma tutarlılığını doğrular. Shell içeriği değiştiğinde `CURRENT_CACHE` sürümü artırılır; testler sürüm sabitine değil `hafize-shell-v<N>` biçimine ve `shouldDeleteCache` semantiğine bağlanır, böylece sürüm artışı ilgisiz paketleri kırmaz.
