# Zamanlanmış Görevler — Hata Sözleşmesi

## Amaç

Client kullanıcı deneyimi ile server API hata kodları arasında tahmin edilebilir bir eşleme sağlanır.

## AUTH_REQUIRED

HTTP: 401.

Anlam: authenticated principal yok veya geçersiz.

UI: Oturum açılması gerekiyor.

Client: task data persistence yapmaz.

Support: auth/session katmanı kontrol edilir.

## INVALID_SCHEDULE_COMMAND

HTTP: 400.

Anlam: request schema veya temel task validation başarısız.

UI: Görev planlanamadı.

Client: aynı submit isteğini otomatik tekrar etmez.

## INVALID_AGENT

HTTP: 400.

Anlam: registry'de seçilen agent mevcut değil.

UI: Görev planlanamadı.

Recovery: agent listesi yenilenebilir.

## SCHEDULE_NOT_FOUND

HTTP: 404.

Anlam: schedule bulunamadı veya ownership filtresi nedeniyle görünür değil.

UI: iptal işlemi başarısız.

Security: başka kullanıcı kayıtlarının varlığını gereksizce açığa çıkarmamalıdır.

## SCHEDULE_NOT_CANCELLABLE

HTTP: 409.

Anlam: schedule state DELETE kabul etmiyor.

UI: Görev artık iptal edilemez.

Recovery: GET refresh yapılır.

## SCHEDULE_CAPACITY_REACHED

HTTP: 503.

Anlam: schedule store kapasitesi dolu.

UI: Görev kapasitesi dolu.

Recovery: server-side capacity/retention incelenir.

## Unknown server error

HTTP: 500 veya diğer 5xx.

UI: Görev servisine ulaşılamadı.

Raw response HTML/stack trace DOM'a yazılmaz.

## Network exception

HTTP response yoktur.

UI: Görev servisine ulaşılamadı.

Client: malformed response gibi davranmamalıdır.

## Abort

Panel kapanışı veya yeni request nedeniyle AbortController tetiklenebilir.

UI: kullanıcıya fatal hata gösterilmesi gerekmez.

## Error payload

UI yalnızca güvenli kısa error code okumalıdır.

Task body error response içine eklenmemelidir.

Server detail alanları varsa client bunları HTML olarak render etmemelidir.

## Retry policy

UI yalnızca GET refresh yapabilir.

POST failure otomatik retry etmez.

DELETE failure otomatik retry etmez.

Execution retry server worker policy'sine aittir.

## Idempotency

Create endpoint için client duplicate-submit guard kullanır.

Cancel endpoint backend state transition ile güvence altındadır.

Client retry semantics backend contract'ını değiştiremez.

## Error UX

Status mesajları kısa olmalıdır.

Error status DOM'da textContent ile gösterilir.

Hata toast veya dialog içinde görünürse aynı security boundary geçerlidir.

## Observability

Trace ID server-created metadata olarak gösterilebilir.

Error code support için kullanılabilir.

Client analytics event'i oluşturulmaz.

## Release block

Authentication bypass error: block.

Ownership leak: block.

Unsafe DOM rendering: block.

API cache leak: block.

Client crash on malformed JSON: block.

## Testing

Her hata kodu source contract testinde aranır.

UI mapping testlerinde kullanıcıya gösterilen mesaj doğrulanır.

PWA test API network-only davranışını doğrular.

Security test secret absence doğrular.
