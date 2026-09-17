# Modern runtime operasyon runbook'u

## Geliştirme

Geliştirme sırasında iki süreç vardır: mevcut Node API runtime ve Vite development server.

`npm run dev:server` mevcut backend'i 127.0.0.1:4173 üzerinde çalıştırır.

`npm run dev` Vite'i 127.0.0.1 üzerinde açar. `/api` istekleri Node runtime'a proxy edilir.

Typed entry'ler development sırasında Vite tarafından doğrudan `.ts` kaynaklarından sunulur. Üretim sırasında aynı entry'ler `public/typed-build/` altında generated `.js` olarak servis edilir.

## Üretim

`npm start` önce `prestart` nedeniyle `npm run build` çalıştırır. TypeScript typecheck başarısızsa server başlatılmaz.

Vite build başarısızsa generated output kullanılmaz. Bu davranış eksik veya eski typed bundle ile üretime çıkmayı önler.

## Cache

Service worker shell cache v34'tür. Typed generated entry'lerde değişiklik olduğunda cache sürümü yükseltilmelidir.

Cache listesinde HTML tarafından yüklenmeyen generated dosya bırakılmamalıdır. HTML'de yüklenen generated dosya cache listesinde bulunmalıdır.

API endpoint'leri cache'e alınmaz.

## Sağlık kontrolü

Typed runtime her 60 saniyede bir `/api/health` kontrolü yapar.

Browser offline olduğunda backend isteği gönderilmez ve kullanıcıya çevrimdışı durum gösterilir.

Backend erişilebilir fakat NVIDIA hazır değilse durum sınırlı olarak gösterilir.

Panelde secret, Authorization header veya connector credential gösterilmez.

## Hata yönetimi

Typed API client:

- timeout uygular,
- geçici 5xx ve 429 yanıtlarını sınırlı sayıda tekrarlar,
- 4xx hataları tekrar denemez,
- trace id header'ını korur,
- response payload'ı `unknown` olarak normalize eder.

UI tarafına sınırsız upstream body taşınmaz.

## Rollback

En güvenli rollback sırası:

1. ilgili generated entry'nin HTML referansını önceki sürüme döndür,
2. TypeScript kaynak migration commit'ini revert et,
3. service worker cache sürümünü önceki çalışan sürüme döndür,
4. `npm start` ile temiz build al,
5. `/api/health` ve ana sohbet akışını smoke test et.

Backend migration yoksa browser migration bağımsız olarak geri alınabilir.

## Arıza senaryoları

### Generated entry 404

`npm run build` çalıştırılmamış olabilir veya `public/typed-build` yanlışlıkla temizlenmiş olabilir. Production start'ın prestart adımı build'i yeniden üretmelidir.

### Vite dev API 502

Node backend 4173 portunda çalışmıyor olabilir. `npm run dev:server` ayrı terminalde başlatılmalıdır.

### Typecheck hatası

Migration yeni kodunda tip sözleşmesi bozulmuştur. `as any` eklemek yerine API boundary normalize edilmelidir.

### PWA eski JS çalıştırıyor

Service worker cache sürümü yükseltilmeli ve generated entry listesi güncellenmelidir.

## DoD

Bir modern runtime değişikliği şu dört kapıdan geçmeden release edilmemelidir:

- `npm run typecheck`
- `npm run build`
- `npm run test:modern`
- `node scripts/test-modern-toolchain.mjs` ve `node scripts/test-legacy-entry-contract.mjs`

Repository ana test suite'i ayrıca korunur.
