# Schedule command strict input contract

## Amaç

Zamanlanmış görev API'si istemci doğrulamasına güvenmez. Create ve reschedule komutları backend command boundary'de fail-closed doğrulanır; store'un daha toleranslı iç davranışları public API şeması yerine kullanılamaz.

## Gelecek zaman zorunluluğu

`runAt` alanı:

- RFC3339 biçiminde olmalıdır;
- en fazla 64 karakterdir;
- `Date.parse` ile geçerli bir zamana dönüşmelidir;
- command boundary'nin güvenilir server clock değerinden **kesin olarak ileri** olmalıdır.

Geçmiş veya server clock ile aynı anı gösteren create/reschedule istekleri `INVALID_SCHEDULE_COMMAND` ile reddedilir. Doğrulama başarısızsa schedule store'a mutation yapılmaz.

Bu sınır UI'daki `datetime-local` kontrolünün yerine geçmez; onu backend tarafında tekrar uygular. İstemci JavaScript'i atlatılsa veya doğrudan API çağrısı yapılsa da geçmiş schedule oluşturulamaz.

## `maxAttempts` strict sözleşmesi

Create isteğinde `maxAttempts` isteğe bağlıdır. Gönderilmezse store'un mevcut varsayılanı kullanılabilir. Alan gönderilmişse yalnız safe integer **1–5** kabul edilir.

Aşağıdaki değerler sessizce clamp/default edilmez; doğrudan `INVALID_SCHEDULE_COMMAND` olur:

- `0`, negatif değerler;
- `6` ve üzeri;
- ondalıklı sayılar;
- numeric string değerleri;
- `null`;
- safe-integer dışı sayılar.

Bu davranış özellikle public command boundary için geçerlidir. İç store katmanı geriye uyumluluk amacıyla kendi defensive normalizasyonunu koruyabilir; API bunu kullanıcı girdisi sözleşmesi olarak kullanmaz.

## Task doğrulaması

Create task metni backend'de trace ID üretilmeden ve store mutation yapılmadan önce doğrulanır:

- string olmalıdır;
- trim sonrası boş olamaz;
- en fazla **20.000 karakter** olabilir.

Geçersiz task, trace ID tüketmez ve schedule kaydı oluşturmaz.

## Clock dependency

Command boundary test edilebilir bir `now()` dependency'si kabul eder. Production varsayılanı `new Date()` kullanır.

Clock:

- exception atarsa;
- geçersiz tarih üretirse;
- sayısal timestamp'e dönüşemezse

zaman içeren create/reschedule isteği `SCHEDULE_COMMAND_FAILED` ile fail-closed durur. Private clock exception mesajı public hata olarak sızdırılmaz.

Yalnız `retryDelayMs` güncelleyen reschedule işlemi duvar saatine ihtiyaç duymaz; mevcut `runAt` değerini değiştirmediği için clock failure bu bağımsız mutation'ı gereksiz yere bloke etmez.

## Owner ve auth sınırları

Bu değişiklik mevcut kimlik ve ownership kurallarını değiştirmez:

- unauthenticated principal reddedilir;
- schedule listesi owner scope ile filtrelenir;
- reschedule/cancel yalnız aynı owner'ın `scheduled` kaydında çalışır;
- bearer/session auth ve exact Origin kuralları HTTP katmanında korunur.

## Tool ve secret güvenliği

Strict input doğrulaması agent tool policy'yi değiştirmez. Aktif roster dört profildir ve backend default-deny kalır. External write/send/merge işlemleri explicit approval gerektirir.

Bu katman:

- environment secret okumaz;
- Authorization/cookie parse etmez;
- credential değerini agent context'e sokmaz;
- local/session storage kullanmaz;
- shell/exec/spawn çalıştırmaz;
- yeni endpoint veya provider eklemez.

## Regresyon testleri

Test kapsamı en az şunları içerir:

- future create başarı;
- past/equal create rejection;
- past reschedule rejection ve sıfır mutation;
- `maxAttempts` 1 ve 5 kabulü, 0/6/string/null/decimal reddi;
- boş ve 20.001 karakter task reddi;
- geçerli timezone-offset RFC3339 kabulü;
- invalid/throwing clock fail-closed;
- retry-only reschedule'ın clock'tan bağımsızlığı;
- gerçek schedule HTTP API'de 400/201/200 mapping;
- dört profilli roster, default-deny ve forbidden secret/shell yüzeyleri.

## Geri alma

Revert için command boundary'deki strict time/task/attempt doğrulaması, `now()` dependency'si ve bu PR'ın test/sözleşme dosyaları kaldırılır. Store schema, durable snapshot formatı, token veya credential migrasyonu yoktur.
