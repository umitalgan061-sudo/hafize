# Akıllı Görünümler Kullanım Kılavuzu

## Mevcut durumu kaydet

Prompt Library içinde istediğin arama, etiket, favori ve sıralama durumunu hazırla.
Akıllı Görünümler bölümünde “Mevcut durumu kaydet” düğmesine bas.
Görünüm adı ve isteğe bağlı açıklama gir.
İstersen gelişmiş sorguya ek koşullar ekle.

## Hazır görünümler

“Hazır görünümler” temel örnekleri oluşturur:

- Favori istemler.
- Sık kullanılanlar.
- Değişkenli istemler.

Aynı isimde kayıt varsa ikinci kez oluşturulmaz.

## Uygulama

Bir görünümün “Uygula” düğmesine bastığında Prompt Library core filtreleri ayarlanır ve ikinci katman koşulları uygulanır.
Mesaj gönderilmez.
Composer değişmez.

## Hızlı sorgu oluşturucu

Metin alanı başlık/gövde/etiket/değişken araması için kullanılabilir.
Etiket, favori ve değişken filtresi seçim kutularından belirlenebilir.
Minimum ve maksimum kullanım sayısı ayrı girilebilir.
“Uygula” geçici filtre oluşturur.
“Görünüm olarak kaydet” aynı filtreyi kalıcılaştırır.

## Son kullanılanlar

Bir görünüm uygulandığında geçmişe kaydedilir.
Aynı görünüm tekrar kullanıldığında sayaç artar.
Geçmişten doğrudan yeniden uygulama yapılabilir.
Silinen görünüm geçmişte kalmışsa “artık mevcut değil” olarak ele alınır.

## Sabitleme

Sabitleme görünümün listede üstte tutulmasını sağlar.
İstem kaydını veya istem favorisini değiştirmez.

## Yedek

Akıllı görünümleri JSON olarak dışa aktarabilirsin.
İçe aktarma yalnız görünüm tanımlarını işler.
İstem metinleri bu yedeğe dahil edilmez.

## Klavye

Ctrl / ⌘ + Shift + Q hızlı sorgu oluşturucuyu odaklamak için ayrılmıştır.
Düzenlenebilir alanlarda kısayol başka davranışları engellemez.

## Hata durumları

Geçersiz yedek kabul edilmez.
300 KB üzerindeki dosya reddedilir.
Kapasite doluysa yeni görünüm oluşturulmaz.
Storage yazılamıyorsa mevcut görünüm verisi korunur.