# TypeScript frontend migration matrisi

Bu belge, frontend kaynaklarının TypeScript-first mimariye geçişinde hangi katmanın hangi sözleşmeyi taşıdığını kaydeder.

## Tamamlanan dalga

| Yüzey | Yeni kaynak | Browser entry | PWA | Davranış testi |
|---|---|---|---|---|
| Composer özellikleri | typed/chat-composer-features.ts | typed-build/chat-composer-features.js | Evet | Release gate |
| Sohbet geçmişi yönetimi | typed/chat-history-management.ts | typed-build/chat-history-management.js | Evet | Release gate |
| Sohbet geçmişi arama | typed/chat-history-search.ts | typed-build/chat-history-search.js | Evet | Release gate |
| Eller serbest | typed/hands-free.ts | typed-build/hands-free.js | Evet | Existing + migration gate |
| Eller serbest arka plan koruması | typed/hands-free-background-guard.ts | typed-build/hands-free-background-guard.js | Evet | Migration gate |
| Gizlilik merkezi | typed/settings-privacy.ts | typed-build/settings-privacy.js | Evet | Existing privacy coverage |
| Workspace navigation | typed/workspace-navigation.ts | typed-build/workspace-navigation.js | Evet | Migration gate |
| Chat stream transport | typed/hafize-sse.ts | app-shell dependency | Bundle ile | SSE Vitest |
| Local storage | typed/hafize-storage.ts | app-shell dependency | Bundle ile | Storage Vitest |
| Async lifecycle | typed/hafize-async.ts | dependency | Bundle ile | Async Vitest |
| Stream state | typed/hafize-stream-state.ts | app-shell dependency | Bundle ile | Stream-state Vitest |

## Entrypoint sözleşmesi

Her browser modülü için kaynak, build ve runtime bağlantısı ayrı ayrı kontrol edilir.

Kaynak katmanında:
- TypeScript dosyası bulunur.
- Global veya module contract açıkça tanımlıdır.
- Browser API kullanımları sınırlandırılmıştır.
- Kullanıcı verisi için açık length/size sınırları vardır.
- Credential benzeri içerik bulunmaz.

Build katmanında:
- Vite entrypoint'i yeni TS kaynağını gösterir.
- Geliştirme sunucusu typed source'a resolve eder.
- Üretim çıktısı typed-build altında deterministik isim alır.
- sourcemap üretimi açık kalır.
- tek build için emptyOutDir kullanılır.

PWA katmanında:
- Service Worker shell cache typed build dosyasını içerir.
- Cache sürümü değişiklikte artırılır.
- API uçları cache dışında tutulur.
- cross-origin istekler cache dışındadır.
- range istekleri cache dışında kalır.

## Runtime sınırları

### API
HafizeApiClient JSON isteklerinde timeout, bounded retry, response parser ve trace-id ayrıştırır. UI modülleri doğrudan model/ajan API çağrısı yapmaz.

### SSE
HafizeSseClient yalnızca streaming POST akışları için kullanılır. Bu katmanda otomatik retry yoktur. Chat isteği tekrar gönderilerek iki kez üretim oluşturulması bu nedenle engellenir.

SSE parser aşağıdaki alanları destekler:
- event
- id
- retry
- data
- comment satırları
- çok satırlı data
- [DONE] terminal sentinel

Kaynak sınırları:
- frame maksimum 128 KiB varsayılanıyla bounded.
- buffer maksimum 256 KiB varsayılanıyla bounded.
- event maksimum 20.000 varsayılanıyla bounded.
- timeout maksimum 5 dakika üst sınırla bounded.

### Storage
Storage boundary raw veri biçimini zorunlu olarak değiştirmez. Bu özellik özellikle mevcut localStorage kayıtlarını migration sırasında bozmamak için seçilmiştir.

Byte hesabı UTF-8 üzerinden yapılır. String.length tek başına kota hesabı değildir.

Storage boundary:
- geçersiz key'i reddeder.
- büyük değeri reddeder.
- serialize edilemeyen nesneyi kontrollü hata olarak döndürür.
- abonelik callback'lerini birbirinden izole eder.
- bilinmeyen key'leri otomatik temizlemez.

### Async
Async controller aynı UI yüzeyinde yeni bir operation başladığında önceki operation'ı iptal eder. Böylece eski response'un yeni state'i ezmesi azaltılır.

State dizisi:
1. idle
2. queued
3. running
4. succeeded
5. failed
6. cancelled

Her operation monotonik operationId taşır.

### Stream state
Stream state transport'tan ayrı tutulur. Transport wire seviyesini, state controller UI seviyesini temsil eder.

State dizisi:
1. idle
2. connecting
3. streaming
4. completed
5. aborted
6. failed

UI durumundan analytics üretilmez. Son stream özeti sadece mevcut ekran bağlamında tutulur.

## Güvenlik kontrolleri

Frontend migration sırasında aşağıdaki davranışlar korunur:
- Secret'lar client bundle'a taşınmaz.
- Authorization Bearer değerleri localStorage'a yazılmaz.
- Sunucu cookie'si okunmaya çalışılmaz.
- hard-coded remote API URL'i oluşturulmaz.
- kullanıcı prompt'u HTML olarak yorumlanmaz.
- dynamic textContent tercih edilir.
- toplu silme işlemleri açık onay ister.

## Erişilebilirlik

Migrated yüzeylerde:
- status rollerinde aria-live kullanılır.
- toggle düğmeleri aria-expanded veya aria-pressed durumunu yansıtır.
- klavye kısayolları input, textarea ve contenteditable odaklarını ezmez.
- focus-visible stilleri korunur.
- mobile layout 700px altındaki dar görünüm için ayrıca ele alınır.
- forced-colors ve reduced-motion kuralları korunur.

## Test katmanları

Behavioral Vitest:
- hafize-sse.test.ts
- hafize-storage.test.ts
- hafize-async.test.ts
- hafize-stream-state.test.ts

Static release gates:
- test-typescript-frontend-wave.mjs
- test-sse-transport-contract.mjs
- mevcut TypeScript readiness gate'leri
- mevcut runtime bridge gate'leri

## Review kontrol listesi

Bir sonraki migration PR'sinde review şu sırayla yapılır:
1. Entrypoint gerçekten TS build'e mi bağlı?
2. Legacy .js dosyası yanlışlıkla korunuyor mu?
3. Service Worker yeni entrypoint'i cache'liyor mu?
4. Dynamic HTML üretiminde kullanıcı metni innerHTML ile mi işleniyor?
5. Storage verisi bounded mı?
6. Network isteğinde timeout ve abort var mı?
7. State-changing POST için yanlış retry eklenmiş mi?
8. Test, hata yolunu da kapsıyor mu?
9. Dokümantasyon rollback yolunu tarif ediyor mu?
10. Base→head diff 3000 sınırının altında mı?

## Risk matrisi

| Risk | Etki | Kontrol |
|---|---|---|
| Eski JS entrypoint unutulması | Runtime duplication | Migration gate |
| PWA cache'te stale entry | Eski UI | Cache version bump + shell gate |
| SSE sonsuz buffer | Bellek baskısı | Frame/buffer/event limitleri |
| Stream POST retry | Çift üretim | Automatic retry yok |
| LocalStorage quota | Veri kaybı | Byte bounds + typed error |
| Eski async response | Yanlış UI | operationId + cancellation |
| Accessibility regression | Klavye/ekran okuyucu sorunu | aria + keyboard tests |

## Sonraki dalgalar

Bu turda taşınmayan büyük frontend JavaScript yüzeyleri ayrı migration PR'larına bölünmelidir. Özellikle karmaşık prompt-library smart views, connector hub ve scheduled task yardımcıları tek PR'da birleştirilmemelidir.

Her sonraki dalga aynı üçlü bağlama uymalıdır: source → Vite entry → Service Worker cache.

## Rollback

Bir typed entrypoint sorun çıkarırsa PR revert edilerek build bağlantısı ve eski browser entrypoint'i birlikte geri alınmalıdır. Kullanıcı verisi formatı değiştirilmediği sürece rollback storage kaydı kaybına yol açmaz.

Streaming transport rollback'u özellikle tek PR sınırında tutulmalıdır. Transport ile UI state birbirinden ayrıldığı için yalnızca stream core'unun revert edilmesi mümkün olmalıdır.