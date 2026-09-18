# TypeScript runtime migration

## Amaç

Hafize server/runtime kodunda JavaScript ve .mjs tabanından TypeScript tabanına güvenli ve kademeli geçiş sağlamak. Bu tur çalışan HTTP, agent ve schedule sınırlarını taşır; bütün legacy modülleri tek seferde yeniden yazmaz.

## Teknoloji tabanı

- Node.js 24 LTS production hedefidir.
- TypeScript 6 strict mode kullanılır.
- Vite 8 frontend build zincirini taşır.
- Vitest 5 typed runtime testlerini çalıştırır.
- Node'un yerleşik type-stripping yeteneği server entry için ayrı runtime transpiler bağımlılığını azaltır.

## Bu turda taşınan çekirdek

Authentication: session auth ve bearer principal doğrulaması.

HTTP güvenliği: production guard, bounded rate limit, request failure/SSE hata sınırı ve security observability.

Model/runtime: NVIDIA response normalization ve context compaction.

Agent: registry validation, delegation, run ledger.

Tools: tool-call boundary, credential detection, result safety ve tool runtime.

Scheduling: command boundary, scheduled agent executor, worker ve lease executor.

## Geçiş ilkeleri

### Typed boundary first

Önce dışarıdan veri alan sınırlar TypeScript'e alınır. JSON, header, tool call, schedule ve model cevabı gibi yüzeylerde unknown değer normalize edilmeden domain tipine çevrilmez.

### Legacy compatibility

Henüz taşınmayan alt bağımlılıklar .mjs olarak kalabilir. TypeScript modülü bu bağımlılığı dar bir adapter sınırından çağırır.

### Runtime path must be typed

Server gerçek çalışma yolunda .ts import eder. Yanında duran bir .ts dosyası tek başına migration sayılmaz.

### Security parity

Göç; timing-safe credential compare, deny-by-default tool policy, credential redaction, CSRF, rate-limit ve result inspection kontrollerini azaltamaz.

### Rollback

Her typed boundary bağımsızdır. Sorun halinde yalnız o import legacy karşılığına geri alınabilir.

## Sonraki fazlar

1. Connector runtime'larını TypeScript'e taşımak.
2. Memory ve persistence katmanlarını typed contracts ile bölmek.
3. Skill registry ve tool catalogue'u discriminated union yapısına geçirmek.
4. HTTP route handler'larını typed request/response sözleşmesine geçirmek.
5. Kalan .mjs modüllerini domain bazında azaltmak.

## Başarı ölçütleri

- npm run typecheck:runtime temiz çalışmalı.
- npm run test:typed-core typed boundary suite'ini çalıştırmalı.
- scripts/test-typescript-migration.mjs entry ve config sözleşmesini doğrulamalı.
- Mevcut endpoint davranışı istemsiz biçimde değiştirilmemeli.

## Dürüst migration sınırı

Bu tur bütün dosyaların TypeScript olduğu anlamına gelmez. Güvenli yaklaşım, çalışan yolun önce taşınması ve kalan legacy katmanın ölçülebilir fazlarla azaltılmasıdır.
