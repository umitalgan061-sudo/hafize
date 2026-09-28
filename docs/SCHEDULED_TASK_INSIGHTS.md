# Görev Planlama Özeti

Görevler panelinde yerel görev listesinden dört sayı üretilir: toplam, yaklaşan, çalışan ve başarısız görevler. Ayrıca en yakın üç planlanmış görev kısa biçimde gösterilir.

Özet mevcut DOM listesinden hesaplanır; ekstra API isteği oluşturmaz. Liste yenilendiğinde MutationObserver görünümü günceller.

Bu panel yalnız kullanıcıya görünür durum bilgisidir. Schedule backend state'ini değiştirmez.
