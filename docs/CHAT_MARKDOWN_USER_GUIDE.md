# Hafize Markdown Kullanım Kılavuzu

Hafize'nin asistan yanıtları, okunabilirliği artırmak için güvenli bir Markdown alt kümesiyle gösterilir. Bu özellik modelin gönderdiği metni değiştirerek kaydetmez; yalnız sohbet ekranında sunum biçimini iyileştirir.

## Neler destekleniyor?

Başlıklar, paragraflar, sıralı ve sırasız listeler, görev listeleri, alıntılar, yatay çizgiler, satır içi kod, kalın/eğik/üstü çizili metin, fenced kod blokları ve tablolar desteklenir.

Bir kaynak adresi `http://`, `https://` veya `mailto:` biçimindeyse tıklanabilir olabilir. Diğer URL biçimleri güvenlik nedeniyle metin olarak gösterilir.

## Kod blokları

Kod bloklarının üst kısmında `Kopyala` düğmesi bulunur. Düğme yalnızca görünen kodu panoya yazar. Kopyalama tarayıcının Clipboard desteğine bağlıdır.

Kodun içinde `<script>`, HTML veya başka etiketler varsa bunlar çalıştırılmaz. Kod, kod olarak kalır.

## Tablolar

Geniş tablolar kendi yatay kaydırma alanında gösterilir. Telefonda sayfanın tamamını sağa sola taşımak yerine yalnız tablo kaydırılır.

## Streaming cevaplar

Uzun bir cevap oluşturulurken Markdown ilk parçalardan itibaren görünmeye başlayabilir. Kod fence'i henüz kapanmadıysa geçici olarak açık kod bloğu görülebilir; cevap tamamlandığında son biçim otomatik oluşur.

## Güvenlik

Hafize raw HTML'yi çalıştırmaz. Zararlı URL şemaları tıklanabilir hale getirilmez. Renderer hesap, token, cookie veya sunucu anahtarı istemez.

## Uyum

Daha önce kaydedilmiş sohbetlerde migration gerekmez. Renderer kaldırılırsa ham mesaj metni yine sohbet içinde gösterilebilir.

## İpucu

Teknik cevaplarda başlık, liste, kod ve tablo kullanan istekler daha okunabilir sonuç verir. Çok uzun tek satırlı markup yerine satırları bölmek de daha iyi bir ekran deneyimi sağlar.
