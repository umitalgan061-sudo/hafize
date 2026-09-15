# Markdown hata modları

## Renderer yüklenemiyor

Beklenen sonuç assistant içeriğinin plain text kalmasıdır.

Retry mekanizması 12 denemeden sonra durur.

Bu durumda sohbet gönderimi durmamalıdır.

## Parser beklenmeyen input alıyor

Null byte temizlenir.

Input 24.000 karaktere kırpılır.

Blok sayısı 240 ile sınırlıdır.

Satırların işlenen kısmı 1.200 karakterle sınırlıdır.

## Güvensiz link

Link allowlist eşleşmezse link elementi oluşturulmaz.

Model metni görüntülenebilir ancak tıklanabilir navigation olmaz.

## Bozuk table

Header ve divider sütun sayıları eşleşmezse tablo oluşturulmaz.

Yalnız bir ayraç satırı bulunan metin plain text gibi işlenebilir.

## Açık fence

Kapanmayan code fence durumunda parser kalan satırları code block içinde güvenli text olarak tutar.

## Clipboard hatası

Clipboard API yoksa veya Promise reject olursa status mesajı gösterilir.

Mesajın kendisi korunur.

## Download hatası

Blob veya URL API başarısızlığında yalnız action status değişir.

Conversation storage etkilenmez.

## Observer hatası

MutationObserver browser tarafından desteklenmiyorsa renderer ilk scan ile çalışır; dynamic delta güncellemeleri limited kalabilir.

Ana chat çalışmaya devam eder.

## Outline hatası

Heading sayısı iki altındaysa outline oluşturulmaz.

Heading metni 80 karaktere kadar gösterilir.

## Code actions

22 satırdan kısa bloklarda collapse button görünmez.

Copy yalnız kullanıcı action'ından sonra denenir.

## Güvenlik olayı

Beklenmeyen HTML execution görülürse Markdown enhancement kaldırılmalıdır.

Plain text fallback zorunlu güvenli yoldur.

## Veri kaybı

Renderer hiçbir conversation storage alanını yazmaz.

Rollback veri migrasyonu gerektirmez.

## Operasyon

Hata tekrar üretildiğinde ham assistant içeriği, renderer console hatası, browser sürümü ve ilgili Markdown örneği kaydedilmelidir.
