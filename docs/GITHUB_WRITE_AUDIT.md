# GitHub Güvenli Yazma Audit Modeli

Bu feature merkezi audit sistemi değildir. Kullanıcıya son başarılı işlemleri cihaz üzerinde anlaşılır biçimde göstermek için bounded local history kullanır.

## Saklanan metadata
- action
- repository
- target
- status
- timestamp
- güvenli GitHub reference URL

## Saklanmayanlar
- file content
- commit body
- PR body
- approval ticket
- GitHub token
- Authorization header
- raw upstream response

## Retention
En fazla 12 kayıt tutulur ve sessionStorage kullanılır. Session sonlandığında history garanti edilmiş kalıcı kayıt değildir.

## Kopyalama
Kullanıcı Kopyala düğmesine bastığında seçili history filtresinin metadata JSON'u clipboard'a verilir. Bu eylem server'a istek göndermez.

## Clear
Temizle yalnız local session history'yi siler. GitHub branch, commit veya PR varlıklarını değiştirmez.

## Sınır
Bu history güvenlik logu yerine geçmez. Kurumsal olay incelemesi için GitHub'ın kendi audit ve repository history kayıtları kullanılmalıdır.
