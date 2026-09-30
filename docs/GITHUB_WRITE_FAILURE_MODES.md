# GitHub Güvenli Yazma Hata Modları

## Onay
GITHUB_WRITE_APPROVAL_REQUIRED: checkbox veya approved flag yok.
GITHUB_WRITE_APPROVAL_EXPIRED: ticket yok, süresi dolmuş veya daha önce tüketilmiş.
GITHUB_WRITE_APPROVAL_MISMATCH: action, repository veya payload değişti.
GITHUB_WRITE_APPROVAL_CAPACITY: server memory ticket sınırı dolu.

## Validation
INVALID_GITHUB_REPOSITORY, INVALID_GITHUB_REF, INVALID_GITHUB_BRANCH ve INVALID_GITHUB_PATH kullanıcı girdisinin normalize edilmediğini gösterir.

## Security
GITHUB_SENSITIVE_PATH_BLOCKED, GITHUB_WORKFLOW_PATH_BLOCKED ve GITHUB_CONTENT_CREDENTIAL_BLOCKED açık security deny durumlarıdır.

## Upstream
GITHUB_ENDPOINT_FAILED upstream API hatasıdır. GITHUB_WRITE_FAILED yazma aşamasındaki diğer GitHub hatalarını temsil eder. Upstream body browser'a geçirilmez.

## Recovery
Write başarısızsa ticket tüketilmiş kabul edilir; aynı ticket tekrar denenmez. Kullanıcı read workspace üzerinden branch, commit ve PR durumunu kontrol edip yeni bir plan üretmelidir.
