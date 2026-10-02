# TypeScript frontend release checklist

Bu checklist, typed frontend migration PR'ının merge öncesi son kontrolüdür.

## Kaynak
- [ ] Yeni modül TypeScript kaynağında bulunuyor.
- [ ] Eski JavaScript entrypoint kaldırılmış veya bilinçli bridge olarak işaretlenmiş.
- [ ] Browser/global contract korunuyor.
- [ ] Dynamic kullanıcı verisi textContent veya güvenli attribute ile işleniyor.
- [ ] Secret, token ve credential benzeri veri kaynakta bulunmuyor.
- [ ] localStorage kullanımı bounded ve hata kontrollü.

## Build
- [ ] Vite entrypoint'i doğru TS kaynağına işaret ediyor.
- [ ] Development transformIndexHtml eşlemesi doğru.
- [ ] Production output typed-build altında oluşuyor.
- [ ] ESM format korunuyor.
- [ ] sourcemap açık.
- [ ] emptyOutDir açık.
- [ ] TypeScript typecheck build öncesinde çalışıyor.

## HTML
- [ ] index.html typed-build entrypoint'ini kullanıyor.
- [ ] Aynı modülün legacy ve typed script'i birlikte yüklenmiyor.
- [ ] CSS asset'i head içine bağlanmış.
- [ ] accessibility label'ları korunmuş.
- [ ] stream status gibi yeni state yüzeyleri aria-live ile sunuluyor.

## Service Worker
- [ ] Cache version migration ile artırılmış.
- [ ] Yeni JS bundle shell cache'e eklenmiş.
- [ ] Yeni CSS asset shell cache'e eklenmiş.
- [ ] API istekleri cache dışında.
- [ ] cross-origin içerik cache dışında.
- [ ] range istekleri cache dışında.

## Network
- [ ] JSON API çağrıları typed API boundary üzerinden gidiyor.
- [ ] Streaming çağrıları typed SSE boundary üzerinden gidiyor.
- [ ] Timeout bounded.
- [ ] AbortSignal parent'tan child'a aktarılıyor.
- [ ] SSE reader hata sonrası cancel ediliyor.
- [ ] SSE reader lock serbest bırakılıyor.
- [ ] Frame, buffer ve event limitleri uygulanıyor.
- [ ] State-changing POST için otomatik retry yok.
- [ ] Trace-id varsa yalnız tanımlayıcı olarak tutuluyor.

## State
- [ ] Async işlemlerde operation id veya eşdeğer stale-response koruması var.
- [ ] Stream state connecting/streaming/completed/aborted/failed durumlarını ayırıyor.
- [ ] Destroy sonrası listener ve timer temizliği yapılıyor.
- [ ] Yeni operation önceki operation'ı sonlandırabiliyor.
- [ ] Kullanıcı verisi ile telemetry state'i ayrılmış.

## Test
- [ ] Vitest behavioral testleri eklendi.
- [ ] Başarılı akış test edildi.
- [ ] HTTP hata akışı test edildi.
- [ ] Network hata akışı test edildi.
- [ ] Timeout test edildi.
- [ ] Abort test edildi.
- [ ] Büyük veri/frame sınırı test edildi.
- [ ] PWA cache entry test edildi.
- [ ] Legacy entrypoint absence test edildi.
- [ ] Credential marker testi çalıştı.

## Dokümantasyon
- [ ] Migration matrisi güncel.
- [ ] Mimari doküman güncel.
- [ ] Rollback yolu yazılı.
- [ ] Kullanıcı verisi migration gerektiriyorsa ayrıca belirtilmiş.
- [ ] PR body ne/niçin/test/rollback bölümlerini içeriyor.

## Diff bütçesi
- [ ] Base → head diff tekrar ölçüldü.
- [ ] Toplam additions + deletions 3000 altında.
- [ ] Değişikliklerin tamamı anlamlı davranış, test veya operasyon dokümantasyonu.
- [ ] Quota doldurmak için yapay tekrar eklenmedi.

## Merge sonrası
- [ ] main ref yeni merge commit'ine işaret ediyor.
- [ ] PR merged=true.
- [ ] Merge commit SHA kaydedildi.
- [ ] Sonraki tur için yeni branch base main'den açılacak.