# Yanıt Geri Bildirim ve Varyant Gizlilik

## Yerel tasarım
Feedback ve alternatif yanıtlar mevcut sohbet kaydı içinde tutulur.

## Gönderilen veri
Regeneration request'i önceki user ve assistant dönüşlerinden oluşur. Alternatif geçmişi ayrı alan olduğu için API mesaj listesine eklenmez.

## Telemetry
Beğeni, beğenmeme, yeniden üretme ve geri alma eylemleri için yeni analytics çağrısı yoktur.

## Saklama
Alternatifler mesaj başına üç ile sınırlıdır. Sohbet geçmişinin mevcut bounded kapasitesi içinde kalır.

## Silme
Sohbet geçmişi temizlendiğinde alternatifler de aynı kayıt ile birlikte silinir.

## Export
Mevcut export davranışı korunur. Remote export servisi eklenmez.

## Connectorlar
Google, GitHub, Gmail ve Canva connector'larına regeneration verisi gönderilmez.

## Kullanıcı bilgilendirmesi
Dokümantasyon geri bildirim verisinin cihazda tutulduğunu açıklar.
