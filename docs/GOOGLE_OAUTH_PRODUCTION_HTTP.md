# Google OAuth production HTTP sınırı

Bu katman, Gmail read-only bağlantısını başlatmak ve Google Authorization Code + PKCE callback'ini güvenli biçimde tamamlamak için server-side HTTP boundary sağlar. `server.mjs` route wiring'i ayrı stacked değişikliktir; bu dosyadaki runtime doğrudan model/ajan tool context'ine verilmez.

## Endpoint sözleşmesi

- `POST /api/connectors/gmail/oauth/start` bearer-authenticated kullanıcı isteğidir.
- Start yalnız `gmail.read` capability'sini ister ve `gmail.readonly` scope'una sabitlenmiştir.
- Response yalnız Google `authorizationUrl` döndürür; owner, subject, verifier, client secret veya token dönmez.
- `GET /api/connectors/gmail/oauth/callback` Google redirect hedefidir ve bearer auth beklemez.
- Callback owner bilgisini query/body/header'dan almaz; yalnız #155 ile eklenen encrypted, single-use flow state kaydından çıkarır.
- `owner`, `ownerId`, `subject`, `token`, `access_token` ve `authorization` callback query alanları reddedilir.
- Kritik callback alanlarının duplicate kullanımı reddedilir; Google'ın `scope`, `authuser`, `prompt` gibi provider metadata alanları owner binding'i etkilemeden yok sayılır.

## Node HTTP adapter sınırı

`lib/google-oauth-node-http-route.mjs`, core OAuth runtime ile Node HTTP response lifecycle'ı arasındaki dar adapter'dır.

- Yalnız exact start ve callback path'lerini match eder; diğer route'lar OAuth runtime'a girmez.
- Raw Node request nesnesi veya request body core OAuth runtime'a aktarılmaz.
- Start isteğinde yalnız `authorization` header'ı aktarılır; cookie, forwarded veya başka request metadata'sı boundary'yi geçmez.
- Public callback'te `authorization` dahil hiçbir request header'ı core runtime'a aktarılmaz; kimlik yalnız encrypted single-use state'ten çözülür.
- Response kapanır/destroy edilirse runtime sonucu client'a yazılmaz. Adapter future cancellation kullanımı için bounded `AbortSignal` taşır.
- Core runtime sonucu `matched + HTTP status + object body` şekline uymuyorsa response yazılmadan fail-closed durur.
- Adapter `process.env`, OAuth secret, token store, owner resolver, NVIDIA/model tool context veya provider fetch sahibi değildir.

## Least privilege

Authorization URL `include_granted_scopes=false` kullanır. Token exchange önündeki guarded token store yalnız `https://www.googleapis.com/auth/gmail.readonly` scope'unu kabul eder. Boş scope veya `gmail.modify`, `gmail.send` dahil herhangi bir genişleme Redis'e yazılmadan önce fail-closed reddedilir.

Bu sınır yeni Gmail send/modify/delete tool'u açmaz. OAuth client secret, connector auth token, owner HMAC key, Redis URL'leri ve OAuth token encryption key frontend/model/ajan context'ine eklenmez.

## Production configuration

OAuth HTTP runtime şu değerlerin tamamı varsa etkinleşir:

- `HAFIZE_CONNECTOR_AUTH_TOKEN`
- `HAFIZE_CONNECTOR_AUTH_SUBJECT`
- `HAFIZE_CONNECTOR_OWNER_KEY_B64`
- `HAFIZE_GOOGLE_OAUTH_CLIENT_ID`
- `HAFIZE_GOOGLE_OAUTH_REDIRECT_URI`
- `HAFIZE_OAUTH_FLOW_REDIS_URL`
- shared token store için `HAFIZE_OAUTH_TOKEN_REDIS_URL` ve `HAFIZE_OAUTH_TOKEN_KEY_B64`

`HAFIZE_GOOGLE_OAUTH_CLIENT_SECRET` provider/client tipine göre opsiyoneldir. OAuth-specific env'lerin hiçbiri yoksa runtime disabled olur; kısmi OAuth configuration startup'ta fail-closed reddedilir. Token store production OAuth akışında `encrypted-redis` olmak zorundadır.

## Lifecycle ve hata yüzeyi

Flow store ile token store shutdown sırasında idempotent olarak kapatılır. Flow/store ve token exchange altyapı hataları raw Redis/Google credential ayrıntılarını HTTP cevabına taşımaz. Replay veya invalid callback `400`, flow backend unavailable `503`, token exchange failure `502` olarak sanitize edilir.

Sonraki wiring katmanı yalnız core runtime + Node adapter composition'ını oluşturmalı, `configured` boolean'ını health'e eklemeli, iki route'u adapter `handle()` fonksiyonuna delege etmeli ve shutdown'da core runtime `close()` çağırmalıdır. Runtime veya adapter nesnesi NVIDIA tool allowlist'ine, agent execution context'ine ya da connector request context'ine eklenmemelidir.
