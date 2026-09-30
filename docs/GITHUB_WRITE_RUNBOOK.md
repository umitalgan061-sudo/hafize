# GitHub Güvenli Yazma Runbook

## Write açma
1. GITHUB_TOKEN server ortamında hazır olmalı.
2. HAFIZE_GITHUB_WRITE_REPOS yalnız hedef repository'leri içermeli.
3. Server restart edilmeli.
4. /api/health içinde githubWriteConfigured true kontrol edilmeli.
5. Read workspace ile repository erişimi önce doğrulanmalı.

## Branch workflow
Source ref'i oku. Safe write panelinde yeni branch oluştur. Başarılı URL ve branch adı görüldükten sonra read workspace ile yeni branch'i tekrar oku.

## Commit workflow
Feature branch'i hedefle. Path, message ve content gir. Var olan dosyada güncel SHA kullan. Onaydan sonra commit sonucunu kontrol et.

## PR workflow
Head branch ile base ref'i karşılaştır. PR başlığı ve açıklamasını gözden geçir. Draft tercih edilebilir. PR oluşturmak merge değildir.

## Incident
Beklenmeyen write görülürse HAFIZE_GITHUB_WRITE_REPOS değerini daralt veya boşalt. Read workspace ile branch ve commit state'ini incele. Yanlış değişiklik için repository'nin normal PR/revert governance akışı kullanılmalıdır.

## Token olayı
GitHub tokenının browser response veya UI source'ta görülmesi halinde write allowlist'i kapat, tokenı GitHub tarafında revoke/rotate et ve deployment loglarını incele.

## Stale SHA
Contents API conflict verirse retry için yeni SHA oku. Eski approval ticket kullanma; yeni plan ve yeni approval gerekir.

## Memory
Approval Map restart ile temizlenir. 1000 ticket cap aşılırsa yeni approval geçici olarak 503 olabilir; expired ticket'lar purge edilir.

## Rollback
Feature rollback yalnız Hafize tarafını etkiler. GitHub'da oluşturulmuş branch/commit/PR ayrıca yönetilir.
