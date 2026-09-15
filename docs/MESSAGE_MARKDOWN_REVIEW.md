# Markdown uygulama review notu

## Mimari

Renderer bağımsız bir browser IIFE olarak çalışır.

Ana `app.js` akışını zorunlu bağımlılık haline getirmez.

Enhancement katmanı mevcut mesaj DOM'unu gözlemler.

## Güvenlik

Model çıktısı untrusted input'tur.

HTML string parse edilmez.

URL allowlist sınırlıdır.

Kod execute edilmez.

Clipboard ve download network dışıdır.

## UX

Başlıklar semantic HTML alır.

Listeler gerçek list elementleridir.

Kod blokları kopyalanabilir.

Uzun yanıtlar daraltılabilir.

Yanıtlar quote olarak composer'a alınabilir.

## Accessibility

Button kontrolleri keyboard erişimlidir.

Status mesajları polite live region'dır.

Heading hierarchy korunur.

Task checkbox'ları disabled'dır.

Forced colors için border/focus kuralları vardır.

## Performance

Input bounded'dır.

Block ve line limitleri vardır.

Observer sayısı sınırlıdır.

Aynı source tekrar render edilmez.

## PWA

Renderer CSS/JS shell cache'tedir.

Message action ve outline assetleri cache'tedir.

Cache version değişikliği ile rollout güvenli tutulur.

## Compatibility

Storage schema değişmez.

Plain text fallback devam eder.

Clipboard yokluğunda yalnız action başarısız olur.

## Maintenance

Yeni Markdown syntax eklenirken source, runtime ve security testleri güncellenmelidir.

Yeni DOM elementleri accessibility ve security review gerektirir.

## Test

Focused test komutu:

`npm run check:markdown`

Runtime smoke:

`node scripts/test-message-markdown-runtime.mjs`

Consolidated suite:

`node scripts/test-message-markdown-suite.mjs`

## Release criteria

Syntax checks temiz olmalıdır.

Security contract testleri geçmelidir.

PWA asset listesi güncel olmalıdır.

Rollback planı uygulanabilir olmalıdır.

## Known limitations

Tam Markdown standardı desteklenmez.

Nested table/list parsing sade tutulur.

Streaming sırasında incomplete fence geçici plain text görünümü oluşturabilir.

Bu sınırlamalar ürün güvenliğini ve fallback davranışını etkilememelidir.
