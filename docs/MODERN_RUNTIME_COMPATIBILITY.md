# Modern Runtime Compatibility

## Supported runtime

Production hedefi Node 24+. Browser tarafı Vite tarafından bundle edilir; TypeScript kaynakları doğrudan production browser'a açılmaz.

## Entry points

`server.ts` canonical entrypoint'tir. `server.mjs` yalnız compatibility bridge olarak kalır. `server-runtime.mjs` mevcut HTTP motorudur ve migration sırasında davranışın korunması için ayrıştırılmıştır.

## API compatibility

Mevcut `/api/health`, `/api/models`, `/api/agents`, `/api/chat`, `/api/agent/run` ve scheduler route'ları aynı endpoint adlarıyla korunur. Migration bu route'ların public adını değiştirmez.

## Response compatibility

Model yanıtları mevcut normalize edilmiş `content`, `finishReason`, `toolCalls`, `usage`, `model` ve `responseId` alanlarını korur. Public error kodları stable tutulur.

## Configuration compatibility

Mevcut environment değişkenleri korunur. Yeni runtime config boundary yalnız değerleri normalize eder ve güvenli limit uygular. Eksik optional değerler mevcut default'lara döner.

## Deployment compatibility

Node 24 native TypeScript execution kullanan deployment'lar doğrudan `server.ts` çalıştırabilir. Legacy deployment komutu `node server.mjs` bridge üzerinden aynı canonical entrypoint'e ulaşır.

## Cache compatibility

Frontend Vite generated output ve PWA shell policy ayrı kalır. Backend `.ts` source static route tarafından servis edilmez.

## Data compatibility

Migration server memory state, conversation storage veya prompt-library local storage formatını değiştirmez. Scheduler persistent store migration kapsamı dışındadır.

## Connector compatibility

GitHub, Gmail ve Canva runtime'larının authorization scope'ları migration nedeniyle genişletilmez. Typed boundary'ler mevcut connector runtime'larına adapter olarak bağlanır.

## Failure compatibility

Client abort, upstream timeout ve invalid JSON artık typed error boundary üzerinden sınıflandırılır. Stable public error kodları dışına çıkılmaz.

## Browser compatibility

Modern TypeScript browser kaynakları generated JavaScript ile yüklenmeye devam eder. `module`, `import` ve browser API kullanımı Vite build pipeline tarafından işlenir.

## Rollback compatibility

PR revert edildiğinde `server.mjs` eski entrypoint davranışına dönülebilir. No-downgrade Node policy korunur; yalnız runtime entrypoint geri alınır.

## Acceptance

- [ ] endpoint adları korunuyor
- [ ] public response alanları korunuyor
- [ ] error code'lar stable
- [ ] environment değişkenleri korunuyor
- [ ] storage formatları değiştirilmedi
- [ ] connector scope genişletilmedi
- [ ] legacy entrypoint mevcut
- [ ] static TS source kapalı
