# GitHub Güvenli Yazma Yapılandırması

## Minimum
GITHUB_TOKEN GitHub API çağrısı için server-side tutulur.

HAFIZE_GITHUB_READ_REPOS salt-okunur workspace allowlist'idir.

HAFIZE_GITHUB_WRITE_REPOS yazma allowlist'idir ve read allowlist'ten bağımsızdır.

## Önerilen kurulum
Write allowlist yalnız geliştirme yapılmasına izin verilen repository'leri içermelidir. Wildcard, global '*' veya kullanıcıdan gelen dinamik repository listesi kullanılmamalıdır.

## Kapalı mod
Write allowlist boş bırakıldığında writer configured=false olur. Server approval ticket üretmez; mevcut read-only GitHub workspace çalışmaya devam eder.

## Health
/api/health içindeki githubWriteConfigured yalnız boolean durum döndürür. Token, repository isimleri veya secret değerleri expose edilmez.

## Değişken değişikliği
Write allowlist değiştirildikten sonra server restart edilmelidir; writer allowlist'i process başlangıcında oluşturulur.

## Environment hygiene
.env, token ve credential dosyaları repository'ye commit edilmez. .env.example yalnız isimleri ve boş değerleri taşır.
