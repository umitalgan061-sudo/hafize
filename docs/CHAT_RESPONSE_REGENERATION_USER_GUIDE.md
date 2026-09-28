# Kullanıcı Rehberi: Yanıt Yeniden Üretme

## Ne işe yarar
Bir asistan cevabını beğenmediğinde aynı konuşma bağlamıyla yeni bir cevap oluşturur.

## Yeniden üret
Son Hafize yanıtının altındaki Yeniden üret düğmesine bas. Üretim sırasında composer geçici olarak kilitlenir.

## Önceki yanıt
Yeni cevap oluşturulduktan sonra önceki cevap kaybolmaz. Önceki yanıtı getir düğmesi son saklanan alternatifi geri alır.

## Kaç alternatif
Her assistant mesajı en fazla üç önceki cevap saklar.

## Geri bildirim
👍 ve 👎 ile yerel değerlendirme işareti koyabilirsin. Aynı düğmeye tekrar basarak işareti kaldırabilirsin.

## Kopyalama
Kopyala düğmesi yalnız mevcut görünen asistan yanıtını panoya aktarır.

## Otomatik gönderim
Hiçbir action composer formunu göndermez. Oluşturulan veya geri getirilen cevap gönderim öncesi metin olarak kalır.

## Model bilgisi
Yanıt altında model, ajan ve araç modu gibi üretim bağlamı görülebilir. Bu bilgiler secret değildir.

## Ne zaman kullanılmaz
Eski assistant mesajlarının yeniden üretme düğmesi pasiftir. Geçmiş yanıtı değiştirmek konuşmanın sonraki dönüşlerini belirsiz hale getireceği için yalnız son yanıt yeniden üretilebilir.

## Offline
İnternet yokken yeniden üretme başlamaz. Eski sohbet okunabilir.

## Gizlilik
Alternatifler cihazdaki mevcut conversation storage içinde tutulur.
