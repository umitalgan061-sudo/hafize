# GitHub Güvenli Yazma Kullanıcı Akışları

## Akış 1 — Branch
Kullanıcı repository ve source ref'i okur, yeni branch adını girer, planı inceler ve açıkça onaylar. Server approval ticket üretir, branch oluşturulur ve güvenli GitHub bağlantısı gösterilir.

## Akış 2 — File
Kullanıcı feature branch'i seçer, path/message/content alanlarını doldurur ve planı inceler. Existing file güncellemesinde SHA verilmesi beklenir. Server secret/path/content policy kontrollerini tekrar uygular.

## Akış 3 — PR
Kullanıcı head branch ile base ref'i seçer, başlık/açıklamayı kontrol eder ve açık onay verir. PR oluşturulur; merge işlemi otomatik yapılmaz.

## Yapılandırılmamış ortam
Health kontrolü yazma capability'sinin kapalı olduğunu gösterirse action controls pasifleşir. Read-only GitHub workspace kullanılmaya devam eder.

## Hata sonrası
Approval mismatch, expired ticket, credential block veya default-branch block görüldüğünde kullanıcıya sabit ve anlaşılır mesaj gösterilir. Ticket tekrar kullanılmaz.

## History
Son başarılı işlemler filtrelenebilir. Copy yalnız görünür filtredeki güvenli metadata'yı panoya taşır. Clear yalnız session history'yi siler.

## Erişilebilirlik
Panelin başlığı aria-labelledby ile, status alanları aria-live ile tanımlanır. Form alanlarında aria-label bulunur ve klavye ile standart button/select/input akışı kullanılabilir.

## Gizlilik
Local history repository/target/zaman/reference dışında veri taşımaz. File content, PR body, token veya approval ticket kalıcı browser storage'a yazılmaz.
