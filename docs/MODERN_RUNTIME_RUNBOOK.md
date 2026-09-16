# Modern Runtime Runbook

## Geliştirme

Geliştirme iki ayrı execution hattı kullanır: Vite browser tooling ve Node runtime. Typed runtime değişikliği browser bundle ile karıştırılmamalıdır.

`npm run dev` Vite development server'ını başlatır. `npm run dev:server` production'a yakın Node entrypoint'i kullanır. API çağrıları browser tarafında mevcut server sınırından geçer.

## Üretim

`npm start` önce build ve Node typecheck yapar. Typecheck başarısızsa server başlatılmaz. Production entrypoint `server.ts` olmalıdır.

Eski `node server.mjs` komutu yalnız uyumluluk bridge'ini çalıştırır. Bridge'de business logic bulunmaz.

## Configuration

`HAFIZE_UPSTREAM_TIMEOUT_MS`, `HAFIZE_MAX_BODY_BYTES` ve scheduler limitleri bounded olarak okunur. NIM endpoint'i HTTPS olmalıdır. Node major sürümü 24'ün altında ise bootstrap fail-fast davranır.

## Health

`GET /api/health` yalnız operasyonel durum döndürür. Secret, Authorization header, prompt, model response veya connector credential döndürülmez.

## Request lifecycle

Her dış model çağrısında request abort ile timeout birlikte değerlendirilir. Client bağlantısı kapanırsa upstream request'i de iptal edilir. Body sınırı aşılırsa upstream'e hiçbir veri gönderilmez.

## Model response

NVIDIA response typed canonical contract'ta normalize edilir. Unknown finish reason kararlı fallback kullanır. Tool call count ve argument length bounded'dır.

## Hata yönetimi

JSON response başladıktan sonra hata oluşursa stable public error code kullanılır. SSE stream başladıysa aynı boundary stream-safe terminal event üretir. Upstream diagnostic body doğrudan client'a geçirilmez.

## Scheduler

Scheduler yalnız gereken runtime'lar configured olduğunda timer açar. Aynı anda tek tick çalışır. Shutdown öncesi timer durdurulur ve aktif tick'in güvenli biçimde tamamlanmasına izin verilir.

## Static dosyalar

Path traversal reddedilir. Public dışına çıkılamaz. TypeScript source browser static endpoint'i üzerinden servis edilmez.

## Rollback

Migration sorunu çıkarsa PR revert edilir. Legacy bridge mevcut olduğu için deployment komutunun biçimi korunabilir. Rollback sonrası typecheck, build, health ve temel chat smoke test tekrar çalıştırılır.

## Incident checklist

- Node version
- NIM endpoint
- upstream timeout
- body limit
- active/peak requests
- upstream error count
- authentication failures
- scheduler lease/storage state
- PWA/static cache state

## Release gates

- [ ] `npm run typecheck`
- [ ] `npm run test:modern`
- [ ] `npm run format:check`
- [ ] modern runtime contract tests
- [ ] legacy entry contract
- [ ] production hardening
- [ ] no secret file changes
- [ ] no direct main write
