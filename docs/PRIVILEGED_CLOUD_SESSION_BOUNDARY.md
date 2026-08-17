# Privileged cloud-session boundary

Hafize browser oturumu, ayrıcalıklı backend işlemlerinde yalnız server-side doğrulanmış bir kimlik kaynağıdır. Bu belge GitHub write ve schedule mutation yollarındaki cookie fallback sınırını sabitler.

## Kimlik sırası

1. Ayrı servis/otomasyon bearer kimliği varsa önce o doğrulanır.
2. Bearer başarılıysa browser `Origin` başlığı aranmaz; bu yol server-to-server kullanım içindir.
3. Bearer yoksa veya geçersizse cloud-session cookie fallback denenebilir.
4. Cookie fallback ile **state-changing** işlem yapılacaksa request `Origin` değeri `HAFIZE_CLOUD_SESSION_ORIGIN` ile exact eşleşmelidir.
5. Origin eksik, yabancı, path/query/hash eklenmiş veya cloud session geçersiz/revoked ise işlem `AUTH_REQUIRED` ile fail-closed biter.

GitHub write `prepare` ve `execute` yalnız POST olduğu için cloud cookie kullanıldığında exact Origin her zaman zorunludur. Schedule `POST`, `PATCH` ve `DELETE` mutation yollarında aynı kural uygulanır. Schedule `GET` salt-okunur listeleme yolu mevcut cookie davranışını korur.

## Logout revocation sürekliliği

Production varsayılanındaki `createRevocableCloudSessionAuth()` örnekleri aynı process içindeki bounded revocation store'u paylaşır. Böylece `/api/session/logout` üzerinden revoke edilen bir cookie, aynı process içinde sonradan oluşturulmuş privileged GitHub veya schedule authenticator örneğinde de kabul edilmez.

Store'a ham session cookie yazılmaz. Anahtar, signing key ile domain-separated HMAC-SHA256 fingerprint'tir; değer yalnız token expiry zamanıdır. Store varsayılan 4096 aktif fingerprint ile bounded ve expiry-pruned kalır.

Bu değişiklik **restart/deploy dayanıklılığı sağlamaz**. Process yeniden başladığında in-memory revocation seti kaybolur. Çok-instance veya restart-surviving revocation için ayrı, testli ve fail-closed durable store tasarımı gerekir; senkron authenticator sözleşmesini aceleyle async Redis API'ye çevirmek bu PR'ın kapsamı değildir.

## Değişmeyen güvenlik sınırları

- NVIDIA NIM veya local provider seçimi tool permission vermez.
- Agent tool policy backend default-deny kalır.
- GitHub dış write/merge işlemleri mevcut prepare/approval/execute zincirini geçmek zorundadır.
- Schedule owner isolation ve command boundary değişmez.
- Secret, cookie, signing key veya bearer token agent context'ine taşınmaz.
- Yeni endpoint, browser storage, plaintext credential, shell/exec/spawn veya genel terminal çalıştırma eklenmez.
- `.env`, credential dosyaları ve `.github/workflows/` self-development alanına alınmaz.
- Dört profilli selector/specialist roster değişmez.

## DoD

Regresyon testleri şu davranışları doğrular:

- bearer auth Origin olmadan ve yabancı Origin varken çalışmaya devam eder;
- cloud cookie missing/foreign Origin ile privileged write yapamaz;
- exact configured Origin ile geçerli session kabul edilir;
- schedule GET ile mutation Origin politikası birbirinden ayrıdır;
- logout/revoke edilen cookie bağımsız privileged ve schedule auth örneklerinde reddedilir;
- fresh session nonce eski fingerprint revocation'ından etkilenmez;
- HTTP boundary yetkisiz isteği body parsing veya command execution'dan önce durdurur;
- roster dört profilde ve `denyByDefault`/external approval/secret isolation/shared trace politikalarında kalır.
