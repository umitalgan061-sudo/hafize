# TypeScript entrypoint review

Bu inceleme notu, migration PR'ının davranış değişikliği ile kaynak-dil değişikliğini birbirinden ayırmak için tutulur.

## Kaynak gerçeği

Server için canonical entry `server.ts` dosyasıdır. Browser tarafında canonical production entry'leri Vite'ın `typed-build` çıktılarıdır.

## Korunan davranışlar

HTTP status kodları, JSON error contract'ları, SSE event isimleri, tool authorization, OAuth validation, schedule ownership ve encryption envelope sürümleri migration ile değiştirilmez.

Browser tarafında conversation storage anahtarı, prompt/workspace storage anahtarları, model/agent API uçları ve ses özelliklerinin kullanıcı akışları korunur.

## Genişletilen davranışlar

Typed HTTP runtime body limitini object-level JSON validation ile birleştirir. SSE tarafında disconnect/timeout abort sınırı vardır.

Browser app shell bağlantı kaybını izler, aktif isteği abort eder ve lifecycle anında local conversation state'i yeniden persist eder.

UI shell media-query değişimini izler; sidebar, calendar ve voice event listener'ları destroy sırasında temizlenir.

## Güvenlik değerlendirmesi

OAuth PKCE ve encryption katmanlarında TS dosyaları source-of-truth'tur. MJS compatibility bridge'leri aynı export yüzeyini taşır ve ikinci bir implementasyon içermez.

GitHub read boundary allowlist/path/credential kontrollerini korur. Connector runtime'ları partial configuration'da fail-closed davranışı sürdürür.

## Performans değerlendirmesi

Migration runtime'a yeni dependency eklemez. Vite build mevcut ES module artifact üretimini kullanır. Browser entry'leri tek kez module olarak yüklenir.

## Test yaklaşımı

Yeni Vitest testleri HTTP, graceful shutdown, GitHub read, schedule HTTP, OAuth PKCE, OAuth flow store, token encryption, memory encryption ve connector configuration sınırlarını doğrular.

Release gate scriptleri entrypoint, Vite, PWA cache ve canonical TS security source kurallarını kontrol eder.

## Kabul ölçütü

Bu tur, repository'nin tamamının bir anda TypeScript'e çevrilmesini değil, yüksek etkili server/browser/güvenlik sınırlarının güvenli ve geri alınabilir şekilde TypeScript-first hale getirilmesini amaçlar. Kalan legacy leaf modülleri sonraki bağımsız migration turlarına bırakılır.
