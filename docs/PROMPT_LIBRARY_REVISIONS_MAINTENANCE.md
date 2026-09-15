# Revision History Maintenance

## Source changes

Revision source değiştirildiğinde core API ile uyumluluk kontrol edilmelidir.

## Storage key

`hafize.prompt-library.revisions.v1` değiştirilecekse migration planı zorunludur.

## Limits

MAX_PROMPTS, MAX_REVISIONS, title/body/tag sınırları testlerle birlikte değiştirilmelidir.

## UI selectors

Prompt card, action ve revision panel selector'leri core DOM değişiklikleriyle birlikte gözden geçirilmelidir.

## Events

Core storage refresh event davranışı değişirse restore regression testi güncellenmelidir.

## PWA

Yeni asset eklendiğinde service worker shell cache ve cache version birlikte güncellenir.

## CSS

Responsive, forced-colors ve reduced-motion davranışı korunmalıdır.

## Tests

Revision test dosyaları `scripts/test-prompt-library-revisions*.mjs` paterniyle birlikte çalıştırılmalıdır.

## Documentation

Kullanıcı rehberi, security, privacy, rollback ve QA dokümanları davranış değişirse güncellenmelidir.

## Release review

Merge öncesi release signoff checklist tamamlanmalıdır.

## Rollback

Rollback source loader ve PWA cache uyumlu şekilde geri alınır. Local data otomatik silinmez.

## Support

Support rehberi yeni hata mesajları ve browser farklılıklarıyla güncel tutulmalıdır.

## Performance

Bounded retention korunarak history render maliyeti kontrol edilir.

## Security

Network, telemetry ve connector erişimi eklenmemelidir.

## Compatibility

Eski main prompt schema'sı korunmalıdır.

## Ownership

Revision feature yalnız Prompt Library sınırında tutulmalıdır.
