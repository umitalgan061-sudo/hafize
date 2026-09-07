# HTTP API contract

API boundary request method, absolute-path, request-id ve body boyutunu normalize eder. API state-changing çağrılarında JSON body beklentisi ve response cache davranışı ayrı, provider-independent kontrollerdir.

Sensitive response'lar varsayılan olarak `Cache-Control: no-store` ile sınırlıdır. Credential taşıyan yüzeylerde `Vary: Cookie, Authorization` kullanımı cache anahtarının yanlış paylaşılmasını önlemek için sözleşmeye dahildir.

Bu pure contract mevcut production guard'ın auth/CSRF kararını değiştirmez; HTTP input/output şeklinin test edilebilir bir tabanını sağlar.
