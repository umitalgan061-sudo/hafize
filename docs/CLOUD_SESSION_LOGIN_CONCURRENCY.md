# Cloud session login concurrency contract

Hafize cloud login parola doğrulaması scrypt kullanır. Peer başına deneme limiti tek bir istemcinin abuse trafiğini sınırlar, fakat birbirinden farklı peer'ların aynı anda pahalı scrypt işleri başlatmasını tek başına engellemez. Bu sözleşme login doğrulama kaynaklarını process içinde ayrıca bounded tutar.

## Sınır

- Production varsayılanı aynı anda en fazla **2** parola doğrulamasıdır.
- Runtime test/özel kurulum sınırı **1–16** aralığındadır; sınırsız değer kabul edilmez.
- Kapasite doluysa istek kuyruğa alınmaz ve scrypt başlatılmaz. Hafize `503 SESSION_AUTH_BUSY` ve bounded `Retry-After` döndürür.
- Global slot yalnız JSON body tam okunup exact login şeması doğrulandıktan sonra, `auth.login()` çağrısından hemen önce alınır. Yavaş body gönderimi pahalı doğrulama slotunu tutamaz.
- Slot başarı, yanlış parola veya auth subsystem exception sonucunda exactly-once serbest bırakılır.

## Peer rate-limit ile ilişki

Global kapasite doluluğu kullanıcının yanlış credential göndermesi değildir. Bu nedenle busy sonucu peer failure sayacını artırmaz; alınmış peer reservation yalnız serbest bırakılır. Buna karşılık malformed JSON, geçersiz login body ve gerçek yanlış parola mevcut abuse bütçesine yazılmaya devam eder.

Peer kimliği server-side socket `remoteAddress` olmaya devam eder. `X-Forwarded-For` veya başka istemci kontrollü forwarding header bu turda güven kaynağı yapılmamıştır.

## Güvenlik sınırı

Bu değişiklik yeni auth yöntemi, endpoint, session cookie biçimi veya ajan yetkisi eklemez. `__Host-hafize_session` cookie sözleşmesi `Path=/; HttpOnly; Secure; SameSite=Strict` olarak kalır. Active/previous signing-key rotation, canonical token doğrulaması, logout revocation ve exact HTTPS Origin sınırları değişmez.

NVIDIA/local model seçimi tool permission vermez. Aktif ajan roster'ı iki selector + iki specialist olmak üzere dört profildir; backend default-deny, external write/send/merge approval, shared trace/task ledger ve secret izolasyonu korunur.

## Bilinen kapsam

Gate process-local'dir. Birden çok Hafize process/instance çalışıyorsa her instance kendi bounded kapasitesini uygular. Bu yine her process'in kaynak kullanımını sınırlar; cluster genelinde tek bir dağıtık semaphore sağladığı iddia edilmez. Böyle bir ihtiyaç doğarsa Redis tabanlı lease/semaphore ayrı failure, timeout ve recovery sözleşmesiyle tasarlanmalıdır.

## Geri alma

`lib/cloud-session-login-concurrency.mjs` kaldırılır, HTTP API'deki verification gate ve Node runtime wiring geri alınır. Kalıcı veri, session schema veya storage migrasyonu yoktur.
