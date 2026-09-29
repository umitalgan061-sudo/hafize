# Konuşma Dalları Senaryoları

## 1. Araştırma alternatifi
Uzun bir araştırma sohbetinin belirli bir assistant mesajından alternatif bir yorum açılır. Parent korunur; yeni dal bağımsız devam eder.

## 2. Kod çözüm varyantı
User mesajının olduğu noktadan fork alınarak ikinci teknik çözüm denenir. Aynı başlangıç context'i korunur.

## 3. Farklı model/ajan yolu
Fork child mevcut conversation agent/model seçimlerini miras alır. Kullanıcı daha sonra seçimlerini değiştirebilir.

## 4. Derin dallanma
Bir child içinden tekrar fork açılabilir. Dördüncü seviyede limit kullanıcıya bildirilir.

## 5. Çoklu dal
Aynı parent'tan sekiz doğrudan dal oluşturulabilir. Global hub bu dalları tek listede aratır.

## 6. Branch karşılaştırması
Child panelindeki Karşılaştır ile ortak mesaj sayısı, parent/child toplamı ve child'ın fork sonrasındaki mesajları görülür.

## 7. Recovery
Dal yedeği JSON olarak alınır. Export, server veya telemetry katmanına veri göndermez.

## 8. Form güvenliği
Dialogdaki title ve note alanları bounded'dır. Kullanıcı metni DOM'a textContent ile yazılır.

## 9. Streaming
Model yanıtı akarken fork eylemi başlamaz. Partial response kopyalanmaz.

## 10. Parent navigation
Aktif child içinden Üst sohbet veya breadcrumb ile parent seviyesine dönülebilir. Fork noktası eylemi ortak başlangıç mesajına odaklanır.
