# Seçilebilir Yerel Veri Temizleme

Kullanıcı artık tüm yerel veriyi silmeden birden fazla yönetilen alanı seçebilir.

## Sınır

Aynı anda en fazla 8 alan seçilir. Bu sınır yanlışlıkla aşırı geniş destructive action oluşturulmasını önler.

## Görünenleri seç

Filtrelerle gizlenen alanlar otomatik olarak seçilmez. `Görünenleri seç` yalnız mevcut görünür satırlardan bounded seçim yapar.

## Confirmation

Seçili alanların label'ları confirmation metninde gösterilir. Kullanıcı iptal ederse hiçbir key silinmez.

## Clear

Clear yalnız registry'deki key'lere yönelir. Sonuç kısmi ise failure mesajı gösterilir.

## Cross-tab

Silme sonrasında data center normal storage event akışıyla yeniden snapshot üretir.

## Accessibility

Her seçim kutusu ilgili veri alanının adını aria-label ile taşır. Toplu buton açık destructive wording kullanır.

## Rollback

Bulk controller'ın kaldırılması existing tekli clear davranışını etkilemez.
