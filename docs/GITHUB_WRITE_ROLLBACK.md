# GitHub Güvenli Yazma Rollback

## Feature rollback
PR revert edildiğinde safe write server route'ları, writer module'ü, UI paneli, style ve Vite/PWA entry'leri kaldırılabilir.

## GitHub tarafındaki değişiklikler
Daha önce oluşturulmuş branch, commit veya PR'lar GitHub'da bağımsız varlıklardır. Feature revert'i bu varlıkları geri silmez. Merge veya force-push API'si bu modülde bulunmaz.

## Data rollback
UI sessionStorage history feature'a özgüdür. Read workspace, Prompt Library ve workspace backup storage anahtarlarına dokunulmaz.

## Yanlış commit
Yanlış branch üzerinde commit oluştuysa önce branch ve PR durumunu kontrol et. Bu modül destructive delete sağlamadığı için geri alma mevcut GitHub governance akışı üzerinden yapılmalıdır.

## Ticket
Ticketlar server memory'dedir. Restart ile temizlenir; persistent ticket migration yoktur.
