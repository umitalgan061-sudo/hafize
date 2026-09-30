# GitHub Güvenli Yazma Veri Modeli

## Onay bileti
Server-memory Map içinde action, repository, fingerprint ve expiresAt tutulur. Ticket disk, browser storage veya GitHub'a yazılmaz.

## Branch planı
repository + branch + fromRef normalize edilerek fingerprint'e dahil edilir.

## File planı
repository + branch + path + content + message + existingSha fingerprint'in parçasıdır. Onaylanan dosya gövdesi değiştirilirse bilet geçersiz olur.

## PR planı
repository + head + base + title + body + draft fingerprint'in parçasıdır. PR body'si credential policy'den geçer.

## Local history
UI başarılı işlemlerden en fazla 12 kayıt tutar. Alanlar action, repository, target, status, at ve güvenli GitHub reference URL'sidir. Content, commit body, token, Authorization header ve approval ticket history'ye yazılmaz.

History sessionStorage'dadır ve Temizle ile silinebilir.

## Uyum
Mevcut Prompt Library, conversation, workspace backup ve read-only GitHub storage şemaları değiştirilmez.
