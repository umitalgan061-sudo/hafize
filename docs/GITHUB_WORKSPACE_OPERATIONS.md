GitHub çalışma alanı operasyon runbook'u

## Yapılandırma

Sunucu tarafında GITHUB_TOKEN ve HAFIZE_GITHUB_READ_REPOS allowlist'i gereklidir. Token browser environment'a geçirilmez.

## Doğrulama

Önce workspace API'nin authentication davranışını kontrol edin. Sonra allowlistte bir repository ile repo, branch ve file read smoke yapın.

## Rate limit

Workspace mevcut genel API rate limit boundary'sini kullanır. GitHub upstream rate limit oluşursa kullanıcıya kısa hata verilir; retry storm oluşturacak otomatik polling yoktur.

## Gözlem

Workspace kendi telemetry event'i üretmez. Uygulama genel request/security log mekanizmaları mevcutsa endpoint path'i normal server request olayı olarak görülebilir.

## Sorun giderme

GITHUB_NOT_CONFIGURED görülürse server env kontrol edilir. GITHUB_REPO_NOT_ALLOWED görülürse allowlist kontrol edilir. GITHUB_CONTENT_CREDENTIAL_BLOCKED veya SENSITIVE_GITHUB_PATH_BLOCKED görülürse güvenlik kuralı bypass edilmeye çalışılmaz.

## GitHub API arızası

Upstream 4xx/5xx durumlarında endpoint sabit hata koduna düşer. Çalışma alanı başarısız sorgu sonrasında yeni istek dışında kendi kendine tekrar deneme yapmaz.

## PWA

Yeni workspace asset'i eklendiğinde sw-policy.js cache listesi ve CURRENT_CACHE sürümü birlikte güncellenmelidir. API endpoint'leri shell cache listesine hiçbir zaman eklenmemelidir.

## Rollback

Workspace bundle'ı revert edilebilir. Prompt Library, scheduled tasks ve conversation history storage alanları bağımsızdır ve rollback nedeniyle temizlenmemelidir.
