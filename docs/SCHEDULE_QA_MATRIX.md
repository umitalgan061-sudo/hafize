# Schedule QA Matrix

## A. Capacity

- [ ] Default store 1.000 task kabul ediyor.
- [ ] Default store 10.000 task kabul ediyor.
- [ ] Default store 50.000 task fixture restore edebiliyor.
- [ ] Default kapasite `Infinity`.
- [ ] Explicit `maxEntries` küçük testlerde enforce ediliyor.
- [ ] Capacity error provider çağrısından önce oluşuyor.

## B. List

- [ ] Default limit 50.
- [ ] Limit 1 kabul ediliyor.
- [ ] Limit 100 kabul ediliyor.
- [ ] Limit 101 reddediliyor.
- [ ] İlk cursor null.
- [ ] Son cursor null.
- [ ] Ara cursor ikinci sayfayı tekrar etmiyor.
- [ ] Sort cursor ile eşleşiyor.
- [ ] Farklı sort ile cursor kullanımı reddediliyor.
- [ ] Search task text üzerinde çalışıyor.
- [ ] Search agent id üzerinde çalışıyor.
- [ ] Search status üzerinde çalışıyor.

## C. Ownership

- [ ] Alice yalnız Alice tasklarını listeliyor.
- [ ] Bob yalnız Bob tasklarını listeliyor.
- [ ] Alice Bob task id'sini cancel edemiyor.
- [ ] Bulk cancel başka owner taskını etkilemiyor.
- [ ] Public payload ownerId göstermiyor.
- [ ] Stats owner scoped.

## D. Creation

- [ ] Authentication olmadan create reddediliyor.
- [ ] Geçersiz agent reddediliyor.
- [ ] Empty task reddediliyor.
- [ ] Çok uzun task reddediliyor.
- [ ] Unknown input fields reddediliyor.
- [ ] Plaintext credential task'a alınmıyor.
- [ ] Trace id server-side üretiliyor.

## E. Worker

- [ ] Due task claim ediliyor.
- [ ] Scheduled task running oluyor.
- [ ] Success completed oluyor.
- [ ] Max attempts sonrası failed oluyor.
- [ ] Retry zamanı gelecekte oluyor.
- [ ] Lease busy defer ediyor.
- [ ] Missing agent failed oluyor.
- [ ] Executor exception sanitized.
- [ ] Promise.allSettled wave failure izolasyonu sağlıyor.
- [ ] maxConcurrent üstüne çıkılmıyor.
- [ ] maxBatch üstüne çıkılmıyor.
- [ ] maxBatchesPerTick üstüne çıkılmıyor.

## F. Persistence

- [ ] İlk load null ise boş store açılıyor.
- [ ] Mutation save başarısızsa state değişmiyor.
- [ ] Durable reopen task sayısını koruyor.
- [ ] Cancel status korunuyor.
- [ ] Cursor listing reopen sonrası çalışıyor.
- [ ] Invalid snapshot startup'ı fail ediyor.

## G. Encryption

- [ ] Yeni envelope version 2.
- [ ] `compressed=true`.
- [ ] Plaintext task dosyada görünmüyor.
- [ ] Wrong key load başarısız.
- [ ] Tampered ciphertext başarısız.
- [ ] Unknown envelope field başarısız.
- [ ] 0600 file mode.
- [ ] Temporary file save sonunda temizleniyor.

## H. UI

- [ ] Dialog aria-labelledby taşıyor.
- [ ] Search input labeled.
- [ ] Status select labeled.
- [ ] Sort select labeled.
- [ ] Checkbox'lar task label taşıyor.
- [ ] Escape dialog'u kapatıyor.
- [ ] Focus restore çalışıyor.
- [ ] Load more yalnız `hasMore=true` iken görünür.
- [ ] Bulk cancel confirmation gerektiriyor.
- [ ] Mobile tek sütuna düşüyor.
- [ ] Forced colors görünürlüğü korunuyor.

## I. PWA

- [ ] scheduled-tasks.js shell asset.
- [ ] scheduled-tasks-stats.js shell asset.
- [ ] scheduled-tasks.css shell asset.
- [ ] Cache version yükselmiş.
- [ ] `/api/` network-only.
- [ ] Task JSON cache'e yazılmıyor.

## J. Regression

- [ ] Mevcut schedule HTTP create testleri geçiyor.
- [ ] Mevcut schedule worker testleri geçiyor.
- [ ] Mevcut encrypted adapter testleri geçiyor.
- [ ] Shell cache contract geçiyor.
- [ ] Production hardening geçiyor.
- [ ] Repository check gate geçiyor.

## Release gate

Tüm A–J gruplarının kritik maddeleri geçmeden production deploy yapılmaz. Test altyapısının olmadığı bir maddede davranış source contract veya deterministic fixture ile doğrulanmalıdır.
