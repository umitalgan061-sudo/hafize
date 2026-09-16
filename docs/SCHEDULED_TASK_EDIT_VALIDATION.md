# Schedule Edit Validation

Update input için yalnız dört field kabul edilir: `agentId`, `task`, `runAt`, `maxAttempts`.

`agentId` registry'de mevcut olmalıdır.

`task` trim edilir, 20.000 karakter sınırında tutulur ve plaintext credential politikasıyla denetlenir.

`runAt` ISO tarihe çevrilir ve update anından sonra olmalıdır.

`maxAttempts` integer olmalı, 1–5 aralığında kalmalı ve mevcut attempt sayısına göre güvenli alt sınırı korumalıdır.

Boş update veya bilinmeyen field state'i değiştirmeden reddedilir.

UI doğrulaması kullanıcı deneyimi içindir; backend validation nihai karardır.
