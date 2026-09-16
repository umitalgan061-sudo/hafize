# Modern Runtime Acceptance

## Scope

Bu kabul listesi TypeScript-first backend entrypoint, critical boundary migration ve runtime hardening değişikliklerini kapsar.

## Build

`npm run build` frontend bundle ile birlikte Node TypeScript config'ini doğrulamalıdır. Typecheck başarısızsa release yapılmaz.

## Startup

Production start `server.ts` ile başlamalıdır. `server.mjs` yalnız bridge'dir. Bridge'in içinde business logic bulunmamalıdır.

## Security

Body size bounded, NIM URL HTTPS, error body sanitized ve static traversal blocked olmalıdır. `.ts` source public static route'tan erişilememelidir.

## Authentication

Bearer token validation minimum length, whitespace validation ve timing-safe comparison içerir. Subject bounded ve non-empty'dır.

## Model boundary

NVIDIA response normalize edilir. Invalid content, usage, tool call veya oversized argument public application layer'a taşınmaz.

## Abort handling

Client bağlantısı kapandığında upstream model request'i abort edilebilir olmalıdır. Timeout ve client abort aynı operation boundary içinde ele alınır.

## Scheduler

Scheduler timer yalnız gerekli dependency'ler configured ise aktif olur. Aynı anda iki tick çalışmaz. Shutdown sırasında active tick kontrol edilir.

## Observability

Metric snapshot prompt, response, credential veya auth header içermez. Snapshot immutable'dır ve active/peak concurrency ile toplam gecikme bilgisi verir.

## Compatibility

Legacy `.mjs` imports mevcut bridge'lerle çalışır. Public API route ve storage format değişikliği bu migration'ın kapsamı değildir.

## Documentation

README, architecture, migration, security, runbook ve rollback belgeleri aynı entrypoint politikasını anlatmalıdır.

## Review gates

- [ ] branch ayrı `hafize/auto-*`
- [ ] main'e feature commit'i yok
- [ ] secret dosyası değişmedi
- [ ] package start TS
- [ ] NodeNext config mevcut
- [ ] legacy bridge mevcut
- [ ] typed critical boundaries mevcut
- [ ] contract tests package script'e bağlı
- [ ] rollback belgeli
- [ ] diff 3000 altında
