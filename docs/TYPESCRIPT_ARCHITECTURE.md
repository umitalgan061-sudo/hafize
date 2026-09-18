# TypeScript architecture

## Composition root

server.mjs HTTP composition root olarak kalır. Route wiring dışında domain davranışı typed runtime modüllerine bırakılır.

## Ortak sözleşmeler

lib/runtime-contracts.ts auth, rate-limit, request failure, API error, task ledger ve security event modellerini isimlendirir.

## Security layer

lib/session-auth.ts ve lib/server-auth.ts kimlik doğrulama kararlarını üretir. lib/production-guard.ts HTTP request yaşam döngüsüne auth, CSRF ve rate-limit uygular.

## Agent layer

lib/agent-runtime.ts registry validation, mesaj normalizasyonu, system message üretimi ve tool authorization sağlar.

lib/agent-delegation.ts yalnız uzman specialist agent'lara delege eder. lib/agent-run-ledger.ts trace ve child task ilişkilerini tutar.

## Tool layer

lib/tool-call-boundary.ts provider tool call'ını normalize eder.

lib/plaintext-credential-policy.ts prompt ve result içindeki credential sızıntısını algılar.

lib/tool-execution-result-policy.ts object graph ve sensitive field kontrollerini uygular.

lib/tool-runtime.ts yalnız authorize edilmiş katalog üyelerini çağırır.

## Model layer

lib/model-response-contract.ts NVIDIA cevabını application level normalized shape'e çevirir.

lib/context-compaction.ts context threshold, summary source ve recent message preservation kararını tipli hale getirir.

## Schedule layer

lib/schedule-command-boundary.ts ownership kontrolünü yapar.

lib/scheduled-agent-executor.ts scheduled task'ı agent runner'a bağlar.

lib/schedule-worker.ts retry, defer ve complete kararlarını yönetir.

lib/schedule-lease-executor.ts acquire, renew, complete ve release yaşam döngüsünü sınırlar.

## Import yönü

~~~text
server.mjs
  -> agent-runtime.ts
  -> agent-delegation.ts
  -> agent-run-ledger.ts
  -> model-response-contract.ts
  -> context-compaction.ts
  -> tool-runtime.ts
  -> schedule-command-boundary.ts
  -> schedule-execution-runtime.ts
  -> schedule-worker.ts

production-guard.ts
  -> session-auth.ts
  -> server-auth.ts
  -> rate-limit.ts
  -> security-observability.ts
~~~

Kalan .mjs bağımlılıkları yaprak seviyesindedir ve adapter gibi ele alınır.

## TypeScript kuralları

- strict açık kalır.
- noUncheckedIndexedAccess korunur.
- exactOptionalPropertyTypes korunur.
- Relative TS imports .ts ile yazılır.
- external data unknown olarak alınır.
- JSON ve provider verileri normalize edilmeden internal state olmaz.
