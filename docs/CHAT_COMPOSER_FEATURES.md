# Sohbet oluşturucu özellikleri

Hafize sohbet alanı artık üç kullanıcı odaklı akışı destekler: metin/kod dosyasını doğrudan mesaja ekleme, yardımcı yanıtı panoya kopyalama ve önceki kullanıcı isteğini tek tıkla yeniden gönderme.

## Dosya ekleme

Eklenen dosya yalnızca tarayıcıda `File.text()` ile okunur ve mesaj metnine dönüştürülür. Ayrı bir dosya yükleme endpoint'i yoktur. En fazla 3 dosya, dosya başına 384 KB ve içerik başına 9.000 karakter sınırı uygulanır. Desteklenen yüzey metin ve yaygın kaynak/config uzantılarıdır; ikili dosyalar gönderilmez.

Dosyalar düğme, sürükle-bırak veya panodan dosya olarak eklenebilir. Chip üzerindeki `×` işareti aynı dosya bloğunu mesajdan da kaldırır. Mesaj gönderildiğinde geçici ek listesi temizlenir.

## Yanıt işlemleri

Her tamamlanan assistant mesajında `Kopyala` ve `Yeniden dene` düğmeleri bulunur. Kopyalama önce Clipboard API'yi, sonra tarayıcı destekliyorsa klasik clipboard fallback'ini kullanır. Yeniden deneme, en yakın önceki kullanıcı mesajını composer'a geri koyarak mevcut submit akışını yeniden kullanır; yeni bir API yolu oluşturmaz.

## PWA

Yeni JS/CSS dosyaları shell asset listesine eklenir ve service-worker cache revision artırılır. API cevapları yine service-worker cache'ine alınmaz.

## Sınırlar

Bu turda PDF, görsel, ses veya binary dosya analizi eklenmedi. Amaç güvenli ve düşük sürtünmeli metin/kod bağlamı sağlamaktır.
