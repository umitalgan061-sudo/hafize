# TypeScript Kontrol Sözleşmesi

response-variants.ts strict TypeScript proje ayarlarında derlenebilmelidir.

response-variants.test.ts Vitest tarafından çalıştırılmalıdır.

app-shell.ts mevcut DOM tipleriyle uyumlu kalmalıdır.

Yeni helper DOM'a veya network'e bağımlı değildir.

ResponseGeneration interface bütün zorunlu metadata alanlarını içerir.

Optional ChatMessage alanları eski fixtures ile uyumludur.

NoUncheckedIndexedAccess altında tuple ayrıştırması null-safe olmalıdır.

Exact optional properties ile feedback deletion uyumlu kalmalıdır.

Build Vite generated typed entrypoint'i oluşturur.

Typecheck başarısızsa release sign-off verilmez.
