# Tool runtime timeout ve iptal sözleşmesi

Hafize tool-calling katmanı artık her araç için açık bir timeout metadata'sına sahiptir.

| Alan | Değer |
| --- | ---: |
| Varsayılan timeout | 60.000 ms |
| Minimum timeout | 2.000 ms |
| Maksimum timeout | 120.000 ms |
| Diagnostic runtime_status | 10.000 ms |
| Delegation | 90.000 ms |
| Connector / GitHub read | 60.000 ms |
| Skill resolution | 30.000 ms |

## Request cancellation

Chat isteğinin AbortController signal'ı tool execution context'e aktarılır. Araç runtime bu signal'ı kendi timeout signal'ı ile birleştirir.

Bu yaklaşım, uzun süren fetch/IO kullanan araçların kullanıcının isteği kapatması halinde erken bırakılabilmesini sağlar.

## Sonuç telemetrisi

Tool sonucu durationMs ve tool adı taşıyabilir. SSE tool activity eventi de bu güvenli metadata'yı istemciye gösterebilir.

durationMs yalnızca süre ölçümüdür; prompt, credential, response body veya harici servis verisi içermez.

## Hata sözleşmesi

- TOOL_TIMEOUT: araç timeout sinyali abort olduğunda.
- TOOL_ABORTED: üst request tarafından abort olduğunda.
- TOOL_NOT_AUTHORIZED: agent permission kontrolü başarısız olduğunda.
- TOOL_UNAVAILABLE: gerekli runtime bağımlılığı hazır olmadığında.
- TOOL_RESULT_*: çıktı güvenlik projection'ından geçemediğinde.

## Yeni araç ekleme

Yeni bir tool CATALOG içine eklenmelidir. Timeout değeri 2.000 ile 120.000 ms arasında olmalıdır. Tool implementasyonu context.signal değerini ağ veya uzun IO çağrısına geçirmek için tasarlanmalıdır.

Ayrı bir ad hoc timeout mekanizması eklemek yerine ortak runtime signal kullanılmalıdır.
