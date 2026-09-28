# Sohbet Yanıtı Yeniden Üretme

## Amaç
Asistan yanıtı beklenen kaliteyi karşılamadığında aynı kullanıcı mesajı için yeni bir yanıt üretmek.

## Kapsam
- Yalnızca konuşmanın son asistan yanıtı yeniden üretilebilir.
- Yeniden üretme aynı aktif sohbet, ajan, model ve araç modu ile yapılır.
- Eski yanıt cihazda sınırlı alternatif geçmişi olarak korunur.
- Başarısız istek mevcut yanıtı geri koyar.
- Aktarım sonrası sohbet otomatik gönderilmez.

## Kullanıcı akışı
1. Kullanıcı son asistan yanıtında Yeniden üret eylemini seçer.
2. Composer ve seçim kontrolleri geçici olarak kilitlenir.
3. Mevcut yanıt yeniden üretilir.
4. Başarılı sonuçta önceki yanıt alternatif olarak saklanır.
5. Önceki yanıtı getir ile en son alternatif geri alınabilir.
6. Geri alma da mevcut yanıtı alternatif listesine koyar.

## Sınırlar
- En fazla 3 alternatif tutulur.
- Her alternatif en fazla 12000 karakterdir.
- Boş yanıt alternatif olarak saklanmaz.
- Aynı alternatif iki kez tutulmaz.
- Orta konuşma mesajları yeniden üretilemez.

## Veri
Alternatifler sohbet nesnesindeki alternates alanındadır. Üretim bağlamı generation alanındadır. Alanlar localStorage üzerindeki mevcut konuşma kaydının parçasıdır.

## Güvenlik
İstek mevcut same-origin chat veya agent endpoint'lerine gider. Yeni üçüncü taraf telemetry eklenmez.

## Hata davranışı
HTTP, SSE, ağ veya boş sonuç hatasında önceki yanıt korunur ve kullanıcıya kısa bir bildirim verilir.

## Kabul
- Sohbet sırası bozulmaz.
- Önceki yanıt kaybolmaz.
- 3'ten fazla alternatif saklanmaz.
- Yeniden üretme otomatik submit yapmaz.
- Tool-calling açıkken doğru endpoint kullanılır.
