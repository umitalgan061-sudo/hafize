# GitHub Güvenli Yazma Güvenlik Sözleşmesi

## Yetki sınırı
Yazma allowlist'i okuma allowlist'inden ayrıdır: HAFIZE_GITHUB_WRITE_REPOS. Bu değişken boşsa yazma runtime'ı yapılandırılmamış kabul edilir. Browser allowlist kararı vermez.

## Kullanıcı onayı
Her yazma işlemi ayrı planlanır ve checkbox ile açıkça onaylanır. UI onay sonrası bileti alır ve hemen tek write çağrısı yapar. Ticket ikinci bir eyleme taşınamaz.

## Path policy
Repository, ref ve branch alanları bounded normalizer'lardan geçer. .., @{, kontrol karakterleri ve Git ref için tehlikeli karakterler reddedilir.

Secret, credential, token, private key ve benzeri path'ler yazılamaz. .github/workflows yazımı ayrıca kapatılmıştır.

## İçerik policy
Commit içeriği ve commit mesajı plaintext credential policy'den geçer. API key assignment, Authorization Bearer/Basic, bilinen GitHub/NVIDIA token desenleri, Google OAuth token ve private key block'u reddedilir.

## Default branch
Dosya commit'inin hedef branch'i repository'nin GitHub API'den alınan default branch'i ile karşılaştırılır. Eşleşme varsa 403 ile durur. Güvenli akış branch oluşturma ve ardından PR açmadır.

## Token izolasyonu
GitHub tokenı yalnız server-side Authorization header'ına eklenir. UI payload'ı token alanı içermez. Hata yanıtları upstream response body taşımaz.

## DOM ve URL
Dinamik sonuçlar textContent ile oluşturulur. Dış bağlantılar yalnız github.com URL'lerine açılır ve noopener noreferrer kullanır.

## Telemetry
Yeni feature analytics, beacon, WebSocket veya uzak audit endpoint'i eklemez. Başarılı işlem geçmişi yalnız sessionStorage'da tutulur; dosya içeriği saklanmaz.

## Rollback
Feature revert edildiğinde backend write route'ları, UI ve cache asset'leri birlikte kaldırılabilir.
