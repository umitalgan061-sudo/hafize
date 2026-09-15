# Hafize Markdown kullanıcı rehberi

Hafize asistan yanıtlarını başlık, liste, alıntı, kod, tablo ve güvenli bağlantılarla daha okunabilir gösterebilir.

## Başlıklar

Model `#`, `##` veya `###` ile başlayan satırlarda başlık kullanabilir.

Başlıklar ayrıca uzun yanıtların özetinde görünür.

## Listeler

`-` veya `*` ile başlayan satırlar madde listesi olur.

Numaralı listelerde `1.` gibi gösterim kullanılabilir.

## Görev listeleri

`- [ ] yapılacak` ve `- [x] tamamlandı` görev satırları gösterilir.

Kutular bilerek devre dışıdır; model çıktısı üzerinden uygulama durumu değiştirilemez.

## Kod

Tek satırlık kod için backtick kullanılır.

Çok satırlı kod için üç backtick kullanılabilir.

Kod bloğu üzerinde kopyalama düğmesi bulunur.

Uzun bloklarda aç/kapa seçeneği görülür.

## Tablolar

Dört veya daha az temel sütunlu veri tabloları doğrudan okunabilir.

Tablo hücrelerinde aynı güvenli inline Markdown kuralları geçerlidir.

## Linkler

HTTP, HTTPS ve mailto bağlantıları link olarak gösterilir.

Geçersiz protokoller link olmaz.

## Yanıt araçları

Asistan yanıtlarında Kopyala, İndir, Alıntıla ve Ham metin araçları bulunabilir.

İndir özelliği yerel bir `.md` dosyası oluşturur.

Alıntıla yanıtı `>` önekleriyle composer alanına aktarır.

Ham metin görünümü biçimlendirmeyi geçici olarak kapatır.

## Gizlilik

Markdown render işlemi tarayıcıda yapılır.

Yanıt kopyalama ve indirme eylemleri yeni telemetry endpoint'i kullanmaz.

## Fallback

Renderer çalışmazsa Hafize yanıtı düz metin olarak göstermeye devam eder.

Bu nedenle özellik bir sohbet yanıtının görünür olmasını engelleyen zorunlu bir bağımlılık değildir.
