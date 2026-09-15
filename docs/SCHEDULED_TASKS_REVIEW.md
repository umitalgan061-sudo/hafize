# Zamanlanmış Görevler — Review Checklist

## Product review

Görevler sol menüden keşfedilebilir olmalıdır.

Yeni görev formu açık ve kısa olmalıdır.

Ajan seçimi mevcut ajan yüzeyiyle tutarlı olmalıdır.

Task textarea yeterli genişliğe sahip olmalıdır.

Datetime picker native davranışı korunmalıdır.

Max attempts alanı anlaşılır olmalıdır.

Hızlı şablonlar keşfedilebilir olmalıdır.

Liste status'ları Türkçe ve tutarlı olmalıdır.

Cancel action açık confirmation gerektirmelidir.

Trace ID ikincil bilgi olarak sunulmalıdır.

## Interaction review

Panel açılışında refresh yapılmalıdır.

Panel kapanışında polling durmalıdır.

Manuel refresh çalışmalıdır.

Create submit sırasında duplicate click önlenmelidir.

POST failure sonrası task text korunmalıdır.

Başarılı POST sonrası form temizlenmelidir.

GET failure sonrası kullanıcıya anlaşılır hata verilmelidir.

409 cancel race sonrası yeniden GET yapılmalıdır.

## State review

Server state client state ile karıştırılmamalıdır.

Status filter yalnızca görsel filtre olmalıdır.

Schedule data browser persistence yapmamalıdır.

Selected filter modal reopen'da varsayılan hale dönebilir.

## API review

GET /api/schedules doğru method olmalıdır.

POST body yalnızca desteklenen fields taşımalıdır.

DELETE route encoded ID kullanmalıdır.

Client `credentials: same-origin` kullanmalıdır.

Response body raw HTML olarak render edilmemelidir.

## Security review

Secret references client bundle'da bulunmamalıdır.

Schedule auth token hiçbir UI field'ında bulunmamalıdır.

OwnerId client response'da olmamalıdır.

Plaintext credential task validation server-side kalmalıdır.

Cancel authentication ve ownership server-side kalmalıdır.

## Accessibility review

Dialog role doğru olmalıdır.

ARIA labelledby doğru başlığa işaret etmelidir.

Status live region bulunmalıdır.

Input/select/textarea accessible isim taşımalıdır.

Keyboard shortcut text editing sırasında çakışmamalıdır.

Escape close çalışmalıdır.

Focus close sonrası mümkün olduğunca restore edilmelidir.

## PWA review

Static asset shell listesinde olmalıdır.

Cache version bump edilmelidir.

API network-only kalmalıdır.

Offline client stale schedule data göstermemelidir.

## Performance review

GET listesi bounded olmalıdır.

DOM render bounded row count kullanmalıdır.

Task preview text bounded olmalıdır.

Task error text bounded olmalıdır.

Trace ID bounded olmalıdır.

Polling yalnızca panel open durumunda çalışmalıdır.

AbortController pending request sayısını azaltmalıdır.

## Browser review

Chromium.

Firefox.

Safari.

iOS Safari.

Android Chrome.

## Operational review

Schedule auth config.

Schedule model config.

Storage config.

Worker config.

Lease config.

## Rollback review

Client rollback server data'yı silmemelidir.

Service worker cache migration kontrollü olmalıdır.

Revert sonrası existing schedule data korunmalıdır.

## Future compatibility

Recurring schedule support için ayrı API contract review gerekir.

Schedule editing için yeni endpoint gerekir.

Retry-now action için ayrı authorization gerekir.

Notifications için privacy review gerekir.

Timezone chooser için explicit timezone model gerekir.

## Final sign-off

Functional QA geçer.

Security review geçer.

Accessibility review geçer.

PWA review geçer.

Performance review geçer.

Rollback review geçer.

No artificial filler code bulunmaz.

No duplicate scheduler implementation bulunmaz.
