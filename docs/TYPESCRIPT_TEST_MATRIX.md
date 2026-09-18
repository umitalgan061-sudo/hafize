# TypeScript test matrix

| Alan | Test | Korunan sözleşme |
|---|---|---|
| Session auth | session-auth.test.ts | signature, tamper rejection, cookie round-trip |
| Bearer auth | server-auth.test.ts | bearer parsing, timing-safe compare, limits |
| Rate limit | rate-limit.test.ts | quota, reset, concurrency, bounded entries |
| API errors | api-error-contract.test.ts | normalized status/code/message |
| Request failures | request-failure.test.ts | closed, abort ve stream classification |
| Security log | security-observability.test.ts | route normalization, secret filtering, fingerprints |
| Agent registry | agent-runtime.test.ts | default agent, permission policy, message normalization |
| Model response | model-response-contract.test.ts | provider normalization ve hard limits |
| Context | context-compaction.test.ts | threshold, preservation, fail-closed summary |
| Tool calls | tool-call-boundary.test.ts | input shape, JSON args, error sanitization |
| Credentials | plaintext-credential-policy.test.ts | provider token ve field detection |
| Tool result | tool-execution-result-policy.test.ts | graph safety, accessor/prototype blocking |
| Schedule worker | schedule-worker.test.ts | completion ve retry |
| Lease | schedule-lease-executor.test.ts | dedupe, busy ve release |
| Scheduled agent | scheduled-agent-executor.test.ts | invalid input ve credential block |

## Static migration checks

scripts/test-typescript-migration.mjs şunları denetler:

- Node engine hedefi 24.21.0 veya üzeri.
- TypeScript major sürümü 6.
- Vite major sürümü 8.
- Vitest major sürümü 5.
- start ve dev:server TypeScript production guard kullanıyor.
- server typed core importlarını kullanıyor.
- tsconfig lib/**/*.ts içeriyor.
- Vitest lib/**/*.test.ts içeriyor.
- modern check typed runtime kontrolünü çağırıyor.

## Kanıt ilkesi

Repository workflow sonucu üretmiyorsa local test kanıtı açıkça belirtilir. Çalıştırılmamış bir suite geçilmiş gibi gösterilmez.

## Regression rule

Bir legacy modülün TS karşılığı oluşturulduktan sonra gerçek import noktası değişmedikçe migration tamamlanmış sayılmaz.
