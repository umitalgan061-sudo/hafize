# GitHub Güvenli Yazma Yapılandırması

## Minimum
GitHub App ile güvenli kurulum tercih edilir: `HAFIZE_GITHUB_APP_ID`, `HAFIZE_GITHUB_APP_INSTALLATION_ID` ve `HAFIZE_GITHUB_APP_PRIVATE_KEY_PATH` sunucuda birlikte tanımlanır. GitHub App kimliği ile token sunucu tarafında kısa süreli alınır. Eski `GITHUB_TOKEN` yalnız App yapılandırması yoksa kullanılır.

Windows yerel backend rehberi: [GITHUB_APP_LOCAL_BACKEND.md](GITHUB_APP_LOCAL_BACKEND.md). Bu yöntem Firebase Hosting'e backend dağıtmaz.

HAFIZE_GITHUB_READ_REPOS salt-okunur workspace allowlist'idir.

HAFIZE_GITHUB_WRITE_REPOS yazma allowlist'idir ve read allowlist'ten bağımsızdır.

## Önerilen kurulum
Write allowlist yalnız geliştirme yapılmasına izin verilen repository'leri içermelidir. Wildcard, global '*' veya kullanıcıdan gelen dinamik repository listesi kullanılmamalıdır.

## Kapalı mod
Write allowlist boş bırakıldığında writer configured=false olur. Server approval ticket üretmez; mevcut read-only GitHub workspace çalışmaya devam eder.

## Health
/api/health içindeki githubWriteConfigured yalnız boolean durum döndürür; gerçek installation token erişiminin başarılı olduğunu garanti etmez. Token, repository isimleri veya secret değerleri expose edilmez.

## Değişken değişikliği
Write allowlist değiştirildikten sonra server restart edilmelidir; writer allowlist'i process başlangıcında oluşturulur.

## Environment hygiene
.env, token ve credential dosyaları repository'ye commit edilmez. .env.example yalnız isimleri ve boş değerleri taşır.
