# TypeScript Smart Insert Migration

## Amaç

Prompt Smart Insert alt sistemi eski tarayıcı JavaScript dosyalarından TypeScript-first üretim hattına taşındı. Bu turda mevcut kullanıcı yetenekleri korunurken kaynak dil, giriş noktası ve release zinciri modernleştirildi.

## Kapsam

Dokuz Smart Insert modülü `public/typed/legacy/` altında TypeScript olarak tutulur:

- ana değişken doldurma akışı,
- Smart Insert Center,
- kullanım geçmişi,
- history bridge,
- değişken presetleri,
- öneriler,
- değer doğrulama,
- aktivite özeti,
- klavye kısayolları.

Ortak sözleşmeler `prompt-library-smart-insert-contract.ts` ile tanımlanır. Tarayıcıdaki dinamik DOM/global API yüzeyi tek bir typed boundary ile sınırlandırılır.

## Üretim zinciri

Smart Insert modülleri ayrı HTML script etiketi olarak yüklenmez. `public/typed/legacy-app.ts` içine import edilir ve Vite tarafından `typed-build/legacy-app.js` içine paketlenir.

Bu yaklaşım tek bundle ile yükleme sırasını merkezi hale getirir, Vite build çıktısını standartlaştırır ve eski JS kaynaklarının yanlışlıkla yeniden etkinleştirilmesini önler.

## Güvenlik

Smart Insert kaynakları `fetch`, XHR, WebSocket veya telemetry çağrısı oluşturmaz. Prompt ve değişken verileri mevcut yerel storage akışlarında kalır. Secret, token veya OAuth credential erişimi yoktur.

## Geriye dönük davranış

Değişken, profil, preset, öneri, geçmiş ve klavye akışlarının storage anahtarları korunur. Dil geçişi veri migration'ı gerektirmez.

Eski JS kaynaklarının kaldırılması aynı davranışın iki runtime tarafından çift çalışmasını önler.

## PWA

Yeni bundle için shell cache sürümü `v55` yapılmıştır. Service worker Smart Insert kaynak dosyalarını değil, Vite tarafından üretilen `typed-build/legacy-app.js` çıktısını cache'ler.

## Test sözleşmesi

`node scripts/test-prompt-smart-insert-typescript-migration.mjs` dokuz TS kaynağını, eski JS dosyalarının kaldırılmasını, unified entrypoint wiring'ini, Vite entrypoint'i, PWA shell cache'i ve network sınırını doğrular.

## Typecheck notu

Bu modüller eski DOM/global sözleşmelerini taşıyan compatibility-adapter katmanında bulunduğundan `@ts-nocheck` boundary notu kullanır. Yeni domain ve runtime kodu strict TypeScript kapsamındadır.

## Rollback

Rollback gerektiğinde PR revert edilir. Storage anahtarlarının korunması nedeniyle yalnızca kaynak dilin geri alınması veri kaybı oluşturmaz.

## Kabul kriterleri

- [x] Dokuz modül TypeScript kaynaklarına taşındı.
- [x] Eski dokuz JS kaynağı kaldırıldı.
- [x] Unified legacy browser entrypoint'e bağlandı.
- [x] PWA cache sürümü güncellendi.
- [x] Network-free kaynak sözleşmesi eklendi.
- [x] Release gate eklendi.
