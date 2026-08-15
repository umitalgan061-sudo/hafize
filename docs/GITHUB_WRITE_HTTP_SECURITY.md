# GitHub write HTTP güvenlik sözleşmesi

Bu katman, exact-user-approved GitHub write çekirdeğini production Node server'a authenticated ve default-deny bir HTTP sınırıyla bağlar.

## Endpoint sözleşmesi

Yalnız iki backend endpoint'i tanımlıdır:

- `POST /api/github/write/prepare` — normalize edilmiş bir komut için kısa ömürlü, kullanıcıya ve exact komuta bağlı approval token üretir.
- `POST /api/github/write/execute` — aynı authenticated kullanıcı, aynı exact komut ve tek kullanımlık approval token ile işlemi yürütür.

Her iki endpoint de bearer authentication ister. Model/tool çağrısı bu bearer kimliğini veya approval token'ını üretme yetkisine sahip değildir. `server.mjs` write runtime'ını NVIDIA tool allowlist'ine veya `executeNvidiaToolCall` context'ine eklemez.

## Production aktivasyonu

Write yüzeyi yalnız `HAFIZE_GITHUB_WRITE_ENABLED=true` exact opt-in'i ile açılır. Flag yoksa, boşsa veya `false` ise runtime `configured: false` kalır ve iki write path de production server'da `404 NOT_FOUND` döner. `1`, `yes`, `on` veya başka alias'lar kabul edilmez; belirsiz aktivasyon değeri startup'ı fail-closed durdurur.

Opt-in açıkken aşağıdaki server-side değerlerin tamamı zorunludur:

- `GITHUB_TOKEN`
- `HAFIZE_GITHUB_WRITE_REPOS`
- `HAFIZE_GITHUB_WRITE_APPROVAL_SECRET`
- `HAFIZE_GITHUB_WRITE_AUTH_TOKEN`
- `HAFIZE_GITHUB_WRITE_AUTH_SUBJECT`
- `HAFIZE_GITHUB_WRITE_OWNER_KEY`

Bunlardan biri eksikse startup composition fail-closed hata üretir. Approval secret ve owner key base64url olarak sunulur; owner key tam 32 byte, approval secret en az 32 byte olmalıdır. Read amaçlı bir `GITHUB_TOKEN` bulunması write yüzeyini kendi başına açmaz.

## Production route composition

`server.mjs`, `createGitHubWriteNodeServerRuntime` nesnesini process environment, ortak bounded `readJson`, ortak `sendJson` ve server-side `fetch` ile oluşturur. Runtime public yüzeyi yalnız `configured` ve `handle` taşır; writer, token, owner key veya approval secret dışarı açılmaz.

Server yalnız exact `/api/github/write/prepare` ve `/api/github/write/execute` path'lerini bu runtime'a yönlendirir. Node route response kapanmasını `AbortSignal`'a çevirir; bağlantı kapanmışsa sonradan JSON response yazılmaz. Disabled runtime request body'yi okumadan `matched: false` döner.

`GET /api/health` yalnız `githubWriteConfigured: boolean` yayınlar. Health response; activation flag değeri, repository listesi, auth tokenı, authenticated subject, approval secret, owner key veya GitHub tokenı taşımaz.

## Yetki sınırı

HTTP katmanı mevcut `github-write-contract`, approval, execution ve REST client sınırlarını değiştirmez. Bu nedenle repository allowlist, `hafize/*` branch zorunluluğu, exact blob SHA, secret/workflow path blokları, draft PR zorunluluğu ve head-SHA-pinned merge kuralları aynen geçerlidir.

Prepare endpoint'i GitHub'a network yazısı yapmaz. Execute endpoint'i approval token tüketildikten sonra writer'ı çağırır. Provider hatası veya başarısız write token'ı harcar; retry için yeni kullanıcı onayı gerekir.

## Ajan ve provider izolasyonu

GitHub write HTTP runtime'ının production server'da configured olması herhangi bir ajana yeni tool izni vermez. Ajan registry ve `tool-runtime` default-deny kalır; `approvalGranted: false` model tool execution sınırında korunur. NVIDIA NIM, local/Ollama veya ileride başka bir model provider seçilmesi bu HTTP yetki sözleşmesini değiştirmez.

Bu ayrım bilinçlidir: kullanıcı veya güvenilir yönetim UI'sı approval akışını HTTP üzerinden kullanabilir, fakat model kendiliğinden bearer credential veya approval token elde edip dış yazma başlatamaz.

## Veri minimizasyonu

Public cevaplar yalnız normalize command, expiry, approval token veya sanitize receipt taşır. GitHub bearer token, authenticated subject, owner id, approval secret, owner key, provider response body, filesystem path veya ham exception detail public cevaba yansıtılmaz.

## Regresyon kanıtı

Canonical testler üç katmanı ayrı ayrı kilitler:

- Node runtime testleri exact opt-in, full configuration ve approval-token davranışını doğrular.
- `test-github-write-production-server-http.mjs`, gerçek `server.mjs` process'inde disabled 404, health boolean, auth zorunluluğu, successful `prepare`, secret sızıntısı olmaması ve invalid opt-in startup failure davranışını doğrular.
- `test-github-write-production-tool-isolation.mjs`, production write runtime'ının model-visible tool allowlist veya tool execution context'ine girmediğini doğrular.

`execute` için GitHub REST yazıları daha alt sınırdaki fake-fetch testlerinde doğrulanır; production HTTP testi bilerek gerçek GitHub'a write yapmaz.
