# TypeScript migration test matrix

Bu dalga için kalite kapıları build, typecheck, unit contract, source security ve PWA asset doğrulamasını kapsar.

## Build

`npm run build` Vite production bundle'larını üretir. Her typed entry ayrı çıktıya sahip olmalıdır.

Beklenen sonuçlar:

- TypeScript kaynakları transpile edilir.
- ES2022 hedefi korunur.
- sourcemap üretimi açık kalır.
- bundle çıktıları `public/typed-build` altında oluşur.
- index entry'leri eksik bundle referansı içermez.

## Typecheck

`npm run typecheck` strict compiler seçenekleriyle çalışmalıdır. Özellikle `strict`, `moduleResolution=bundler`, `noUncheckedIndexedAccess` ve `exactOptionalPropertyTypes` korunmalıdır.

## Unit tests

Saf davranış testleri Vitest ile çalıştırılır. Bu dalganın testleri browser DOM'una ihtiyaç duymayan normalize/filter/sort/boundary helper'larını mümkün olduğunca izole eder.

Covered areas:

- browser platform primitives
- authentication boundary
- voice input transcript/error policy
- voice output normalization/chunking
- hands-free wake phrase/retry
- screen capture dimensions and track cleanup
- scheduled task date/status rules
- composer history retention
- conversation workspace state/filter/sort
- chat history search

## Source-contract tests

`scripts/test-typescript-runtime-wave.mjs` ve `scripts/test-typescript-runtime-integration.mjs` repository kaynaklarını tarar.

Kontroller:

- typed entry dosyalarının varlığı
- export yüzeyi
- `innerHTML`/`outerHTML` gibi injection riskleri
- legacy script duplicate loading
- Vite entry kayıtları
- Service Worker shell cache kayıtları
- auth CSRF boundary
- browser capability policy
- local-only diagnostics

## PWA

Service Worker shell listesi generated bundle'ları içermelidir. `/api/` istekleri network-only kalır.

Cache version her shell değişiminde artırılır. Eski Hafize cache'lerinin temizlenmesi `CACHE_PREFIX` ve `CURRENT_CACHE` üzerinden yapılır.

## Accessibility

Typed module testleri şu davranışları doğrular:

- aria-label
- aria-expanded
- aria-pressed
- role=status/log/dialog/list/listitem
- Escape ile kapanma
- keyboard shortcut çakışması
- focus geri verme

## Media

Screen share testleri boyut küçültme ve track cleanup'ını kapsar. Voice input testleri recognition error mapping'i kapsar. Voice output testleri markdown temizleme ve chunking'i kapsar.

## Storage

Malformed JSON, oversized values, disabled retention ve null-character temizliği test kapsamındadır.

## Regression

Migration sonrası aynı feature'ın legacy ve typed runtime tarafından iki kez yüklenmemesi kritik regresyon kapısıdır. HTML'de migrated legacy `src` referansı bulunmamalıdır.

## Manual smoke

Otomatik unit testlerin kapsamadığı alanlar için release öncesi şu manuel akışlar doğrulanmalıdır:

1. Giriş yap ve sohbet gönder.
2. Dosya ekle, sürükle-bırak ve çıkar.
3. Taslak oluştur, sekme değiştir, geri yükle.
4. Sohbet ara, pinle, yeniden adlandır ve export et.
5. Görev planla ve iptal et.
6. Mikrofonu aç/kapat.
7. Sesli çıktıyı aç/kapat.
8. Eller serbest açıp wake phrase kullan.
9. Ekran paylaşımını kullanıcı ile başlat ve kapat.
10. Tema ve calendar keyboard navigation kullan.

## Failure policy

Bir test başarısızsa davranışın kırıldığı modül belirlenir ve PR merge edilmeden önce düzeltilir veya açıkça belgelenir. Satır kotası test/DoD gereksiniminin önüne geçmez.

## CI absence

Repository branch'i için GitHub Actions sonucu görünmüyorsa bunu "başarılı" varsaymak yasaktır. Yerel test çalıştırılmadıysa PR gövdesinde açıkça belirtilmelidir.
