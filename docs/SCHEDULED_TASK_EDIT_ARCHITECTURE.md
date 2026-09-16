# Schedule Edit Architecture

## Katman 1 — UI
`public/scheduled-tasks.js` mevcut görev panelini genişletir. Form ve hızlı aksiyonlar kullanıcı etkileşimini yönetir.

## Katman 2 — HTTP
`schedule-http-api.mjs` PATCH item route'u çözer ve normalized error response üretir.

## Katman 3 — Boundary
`schedule-command-boundary.mjs` authenticated principal, owner, agent ve credential kurallarını uygular.

## Katman 4 — Persistence
`task-schedule-persistence.mjs` update mutationını mevcut serial queue üzerinden persist eder.

## Katman 5 — Store
`task-schedule-store.mjs` state transition ve field validation kararlarının kaynağıdır.

## Execution
Worker update edilmiş `task` ve `runAt` değerini claim sırasında okur. Yeni status veya worker endpointi gerekmez.

## Repeat-plan
Tekrar planlama update değil create semantiğidir ve yeni kimlik üretir.

## Bulk
Bulk UI bounded tekil mutation'ları ardışık uygular; backend her kaydı ayrı ayrı yetkilendirir.

## Cache
UI asset'i shell cache'dedir; schedule API network-only kalır.

## Persistence version
Schema version değiştirilmez. Migration gerekmemesi amaçlanmıştır.
