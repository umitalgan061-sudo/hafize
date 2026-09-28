# Yanıt Regeneration Code Review

## Kontrol
- Son assistant eligibility guard mevcut.
- isStreaming tek generation invariantını koruyor.
- Alternates bounded.
- Feedback enum bounded.
- Generation metadata sanitized.

## Request
Regeneration yalnız önceki turn'leri API message listesine dahil eder. Alternates requestMessages'e karışmaz.

## Persistence
Başarısız generation önceki içeriği geri koyar. Başarılı generation eski içeriği history'ye taşır.

## UI
Actions DOM APIs ile oluşturulur. Kullanıcı metni action HTML olarak kullanılmaz.

## Security
Yeni token, endpoint veya third-party SDK yok.

## Accessibility
Buttons, labels, pressed state, disabled state ve focus-visible kapsanır.

## Performance
Yeni per-generation timer dışında global poller eklenmez. Timer yalnız elapsed calculation için kullanılır ve async iş bittikten sonra tutulmaz.

## Testing
Pure helper module unit tests ve source-contract scripts birlikte kullanılır.

## Release
Typecheck ve build olmadan release sign-off verilmez.
