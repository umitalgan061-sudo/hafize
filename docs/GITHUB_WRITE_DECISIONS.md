# GitHub Güvenli Yazma Tasarım Kararları

## Neden ayrı writer
Read workspace GET yüzeyi ile write capability aynı modülde tutulmadı. Böylece mevcut salt-okunur reader'ın güvenlik varsayımları değişmeden bırakıldı.

## Neden ayrı write allowlist
Okuma izni değişiklik yapma izni anlamına gelmemelidir. HAFIZE_GITHUB_WRITE_REPOS bu nedenle HAFIZE_GITHUB_READ_REPOS'tan bağımsızdır.

## Neden ticket
Tek bir POST request'inde hem approval hem upstream write yapmak kullanıcı arayüzündeki plan ile gerçek yazma arasında denetim noktası bırakmaz. Ticket iki aşamalı akış sağlar.

## Neden fingerprint
Kullanıcı onayından sonra repository, branch, path veya content değiştirilirse ticket geçerli kalmamalıdır.

## Neden default branch engeli
Hızlı yazma ergonomisi accidental production/default branch commit riskini artırabilir. Server-side default branch kontrolü bu capability'yi sınırlar.

## Neden file SHA
Existing SHA GitHub Contents API ile optimistic concurrency sağlar. Eski dosyanın sessizce üstüne yazılması yerine conflict oluşması tercih edilir.

## Neden workflow engeli
Self-development güvenlik kuralıyla uyum için .github/workflows writer capability'sinin dışında tutuldu.

## Neden local history
Kullanıcı yaptığı başarılı işlemleri görebilmeli, ancak merkezi telemetry veya content retention oluşturulmamalı. Bu yüzden sessionStorage'da yalnız metadata tutulur.
