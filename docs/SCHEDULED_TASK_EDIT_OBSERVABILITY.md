# Schedule Edit Observability

Edit işlemi mevcut `traceId` değerini korur; yeni trace kimliği üretilmez.

HTTP response hata kodları mevcut normalize API hata sözleşmesine gider.

Sunucuya yeni analytics veya usage event'i eklenmez.

UI başarı/hata mesajları yalnız kullanıcıya gösterilen status alanındadır.

Bulk işlemler başarılı toplamını ve hedef toplamını status mesajında gösterir; task içeriği loglanmaz.

`ownerId` public response'a çıkarılmaz.

Worker, lease ve execution telemetry sözleşmeleri değişmez.
