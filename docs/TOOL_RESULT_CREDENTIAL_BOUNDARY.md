# Tool Result Credential Boundary

Hafize tool çağrıları yalnız yetkili araçların çalıştırılmasına değil, aracın ürettiği sonucun modele geri taşınmasına da güvenlik sınırı uygular.

## Sözleşme

`executeNvidiaToolCall()` başarılı bir araç sonucu üretmeden önce `projectSafeToolExecutionResult()` üzerinden geçer. Sonucun `value` alanı aşağıdaki kontrollerden geçmelidir:

- Bilinen plaintext credential biçimleri content içinde bulunmamalıdır.
- `access_token`, `refreshToken`, `apiKey`, `clientSecret`, `authorization`, `password` veya `secret` gibi credential alanları dolu string değer taşımamalıdır.
- Getter/setter accessor'ları olan object'ler okunmadan reddedilir.
- Sıradan object veya `null` prototype dışındaki custom prototype'lar reddedilir.
- Aşırı derin veya çok büyük object graph'ları sınırlı düğüm/derinlik bütçesi nedeniyle reddedilir.

Engellenen başarılı tool sonucu credential değerini, ham exception mesajını veya payload'ı kullanıcıya/model context'ine taşımaz. Sabit bir public error code döner.

## GitHub read ile ilişkisi

`github-read.mjs` dosya yolu allowlist'ine ek olarak decoded `content` değerini aynı plaintext credential politikasından geçirir. Böylece izin verilen bir README/source dosyasının içine yanlışlıkla commit edilmiş anahtar veya token doğrudan tool result'a çıkamaz.

## Bilinçli sınırlar

Bu politika secret manager veya upstream servis tarafındaki credential'ları silmez ve redakte edilmiş/şifrelenmiş verinin güvenli olduğunu varsaymaz. Amaç, model veya tool result sınırına ulaşmadan önce görünen plaintext credential materyalini fail-closed engellemektir.

Yeni credential biçimleri `lib/plaintext-credential-policy.mjs` içindeki ortak policy'ye eklenmelidir; ayrı araçlarda paralel regex setleri oluşturulmamalıdır.

## Test

- `scripts/test-tool-execution-result-policy.mjs` doğrudan policy'yi test eder.
- `scripts/test-tool-runtime.mjs` production tool-call wiring'inin policy'yi gerçekten uyguladığını test eder.
- `scripts/test-github-read.mjs` izinli repo içeriğinde credential egress'ini test eder.

Bu dosya workflow veya secret yapılandırması değiştirmez.

## Karmaşıklık bütçesi

Node bütçesi (2.000) incelenen her değeri sayar; yalnız iç içe nesneleri değil. Böylece binlerce skaler alan taşıyan geniş bir sonuç da derin bir sonuç kadar sınırlıdır ve `TOOL_RESULT_COMPLEXITY_BLOCKED` ile durdurulur.
