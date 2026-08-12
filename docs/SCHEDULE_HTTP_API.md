# Authenticated schedule HTTP API

Bu katman, schedule command boundary'yi HTTP üzerinden açarken kimlik doğrulama ve sahiplik kontrollerini atlamadan küçük bir API yüzeyi sağlar.

## Endpoint'ler

Auth başarıyla server-side yapılandırılmışsa aşağıdaki yollar aktiftir:

- `GET /api/schedules` — doğrulanmış principal'a ait schedule kayıtlarını listeler.
- `POST /api/schedules` — `agentId`, `task`, `runAt`, `maxAttempts` alanlarıyla yeni schedule oluşturur.
- `DELETE /api/schedules/:scheduleId` — yalnızca aynı principal'a ait ve hâlâ `scheduled` durumundaki kaydı iptal eder.

Tüm endpoint'ler `schedule-command-boundary` üzerinden çalışır. HTTP katmanı raw schedule store'u doğrudan okumaz veya mutate etmez.

## Server-side auth yapılandırması

İlk güvenli wiring iki server-side environment değeri kullanır:

- `HAFIZE_SCHEDULE_AUTH_TOKEN`
- `HAFIZE_SCHEDULE_AUTH_SUBJECT`

Her ikisi de geçerli değilse schedule API yapılandırılmamış kabul edilir ve `/api/schedules...` yolları `404 NOT_FOUND` döndürür. Token hiçbir zaman `public/` altına, frontend JavaScript'ine, response'a, ajan context'ine veya task ledger'a yazılmamalıdır.

Bu Bearer primitive'i geçici/trusted-server kullanımı içindir. Statik PWA frontend'e bu token gömülmemelidir. Son kullanıcı schedule UI açılmadan önce token'ın yerini gerçek OIDC/Firebase/Google benzeri kullanıcı oturumu ve doğrulanmış principal adapter'ı almalıdır.

## Güvenlik davranışı

- Authentication request body okunmadan önce yapılır.
- Eksik/yanlış Bearer `401 AUTH_REQUIRED` döndürür ve command boundary çağrılmaz.
- Client `ownerId` veya `traceId` belirleyemez; mevcut command boundary bunları backend'de üretir/bağlar.
- Başka kullanıcıya ait schedule command boundary tarafından görünmez; HTTP katmanı bu kontrolü bypass etmez.
- `ownerId` public response DTO'sunda yer almaz.
- Unsupported method'lar auth sonrasında `405 METHOD_NOT_ALLOWED` döndürür.
- Schedule kapasitesi veya internal exception ayrıntıları secret/detail olarak response'a taşınmaz.
- Bearer token kullanılacak deployment'ta transport TLS/HTTPS ile korunmalıdır.

## Health

`/api/health` yalnızca `scheduleApiConfigured: true|false` bilgisini verir. Token, subject veya model adı dönmez.

## Bu turun kapsamı dışında

Bu değişiklik persistent database, distributed lease, OAuth/OIDC login, session cookie, frontend schedule ekranı veya cloud provider cron eklemez. In-memory schedule store process restartında hâlâ kaybolur.
