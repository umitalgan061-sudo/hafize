# GitHub Güvenli Yazma Operasyonları

## Yapılandırma
Server ortamına GITHUB_TOKEN, HAFIZE_GITHUB_READ_REPOS ve gerektiğinde HAFIZE_GITHUB_WRITE_REPOS verilir.

Write allowlist yalnız gerçekten değişiklik yapılmasına izin verilen repository'leri içermelidir. Read allowlist'ten otomatik türetilmez.

## Kapalı mod
HAFIZE_GITHUB_WRITE_REPOS boşsa server write ticket üretmez ve yapılandırma hatası döndürür. Özellik deploy edilip write yetkisi daha sonra etkinleştirilebilir.

## İzleme
Health yanıtı yalnız githubWriteConfigured boolean sinyali verir. Credential veya allowlist içeriği döndürmez.

Başarılı browser write history merkezi audit log değildir; sessionStorage metadata'sıdır.

## Olay yönetimi
Şüpheli yazım görüldüğünde önce write allowlist'i kaldır. Sonra read workspace ile branch durumunu kontrol et. Gerekiyorsa PR revert edilebilir.

## Kapasite
Approval ticket Map'i 1000 kayıtla bounded'dır. Süresi geçen kayıtlar purge edilir. UI history 12 kayıtla bounded'dır.

## Release
Typecheck, modern testler ve GitHub safe-write kaynak sözleşmeleri release öncesi yürütülmelidir.
