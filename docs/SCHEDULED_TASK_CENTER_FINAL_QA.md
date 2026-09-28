# Schedule Center Final QA

## Akış

Form hazırlanır, gerekirse hızlı zaman/şablon/taslak kullanılır. İlk Görevi planla submitinde Preview açılır ve POST durur. Kullanıcı ayrıntıları kontrol eder; onaydan sonra mevcut typed workspace handlerı çalışır.

## Tekrar planlama

Planlanmış, tamamlanmış, başarısız ve iptal edilmiş satırlarda Tekrar planla görünür. Yeni zaman en az beş dakika ileridir ve yine Preview kapısından geçer.

## Güvenlik

Preview, duplicate, template, draft, detail, insights, planning ve export yardımcıları yeni server endpointi açmaz. Credential ve Authorization bilgileri browser yardımcılarına eklenmez.

## PWA

Yeni static JS/CSS dosyaları index ve service worker shell listesinde bulunmalıdır. Cache version güncel olmalıdır.

## Release sign-off

Syntax kontrolleri ve schedule test paketleri çalıştırılmalı. Tam test runner bu oturumda çalıştırılamazsa PR açıklamasında açıkça belirtilmelidir.

## Rollback

UI assetlerini index ve service worker listesinden çıkar. Backend schedule API ve kullanıcı görev kayıtlarına dokunma.
