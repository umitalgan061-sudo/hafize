# Platform Runtime Architecture

## Katmanlar

```text
HTML shell
  ↓
Vite typed entry
  ↓
platform-app
  ├─ platform-runtime
  ├─ platform-policy
  ├─ platform-events
  ├─ platform-performance
  ├─ platform-diagnostics
  ├─ platform-error-boundary
  ├─ platform-accessibility
  ├─ platform-cache-policy
  ├─ platform-task-queue
  ├─ feature-registry
  └─ existing app-runtime
```

## Neden tek entry

Uygulama runtime'ı farklı bir bootstrap yolu oluşturursa feature sıralaması, telemetry sınırları ve cleanup davranışı dağılır. `platform-app.ts` typed özellikleri aynı build entry altında toplar.

## Dependency yönü

Platform modülleri birbirlerinden mümkün olduğunca yalnızca type import kullanmalıdır. UI modülleri runtime snapshot'ını okur; runtime UI implementation detaylarına bağımlı olmamalıdır.

## Lifecycle akışı

1. Browser module yüklenir.
2. Capability detection yapılır.
3. Platform self-check feature'ı register edilir.
4. Global lifecycle listener'ları bağlanır.
5. Storage estimate başlar.
6. Performance observers kurulmaya çalışılır.
7. Registered feature'lar priority sırasıyla başlatılır.
8. Phase `ready` olur.
9. UI dashboard snapshot event'lerini dinler.
10. Stop halinde abort + cleanup gerçekleşir.

## Event sınırı

Typed event bus application içi olaylar içindir. Window CustomEvent'leri UI compatibility için tutulur. Bu iki kanal birbirinin yerine geçmez.

## State sınırı

Snapshot immutable bir API'dir. Mutable collection'lar private field'lardır. Dışarıya yalnızca kopyalanmış veya freeze edilmiş görünümler verilir.

## Performans

Observer entry'leri bounded array'e append edilir. 80 üstü entry yaklaşınca eski kayıtlar atılır. Error kayıtları 24 ile sınırlıdır. Dashboard yalnızca panel görünürken repaint edilir.

## Storage

Runtime state localStorage içinde yalnızca küçük metadata olarak saklanır. Estimate API ayrı bir source of truth değildir; desteklenmiyorsa alanlar `null` olur.

## Capability policy

Capability detection ile feature policy ayrılmıştır. `platform-policy.ts`, feature'ın desteklenip desteklenmediğini ve fallback davranışını merkezi şekilde açıklar.

## Task queue

Düşük öncelikli UI bakım işleri task queue'ya aktarılabilir. Queue concurrency sınırı, timeout ve AbortSignal ile donatılmıştır. Queue dolduğunda yeni iş reddedilir; sonsuz birikim yoktur.

## Error boundary

Global error handler secret redaction uygular. Raw error stack'i UI'ya veya diagnostic JSON'a taşınmaz.

## Test stratejisi

Unit testler saf fonksiyonları hedefler. Contract testleri kaynak sözleşmesini doğrular. Browser smoke testleri build çıktısının gerçekten yüklenebildiğini doğrulamalıdır.

## Rollback

Platform runtime kaldırılırsa `app-runtime` eski entry'ye dönebilir. Mevcut API client ve legacy feature'lar bağımsız kalacak şekilde tasarlanmıştır.
