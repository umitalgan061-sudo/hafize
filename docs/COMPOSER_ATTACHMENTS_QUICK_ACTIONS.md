# Composer Ekleri — Hızlı Analiz Aksiyonları

## Aksiyonlar
Özetle: seçilen dosya parçaları için kısa özet talebi ekler.
Kod incele: tasarım, okunabilirlik, güvenlik ve bakım odaklı inceleme talebi ekler.
Hata ara: edge case ve olası bug talebi ekler.
Gereksinime dönüştür: fonksiyonel ve teknik gereksinim talebi ekler.

## Davranış
Hızlı aksiyon seçilen attachment payload'unu aynı insert bütçesi içinde composer'a taşır.

Aynı secret risk confirm akışı kullanılır.

Hızlı aksiyonlar network çağırmaz ve submit etmez.

Aksiyonlar seçilen start/end range'e saygı gösterir.

## Kullanıcı kontrolü
Kullanıcı composer metnini inceleyebilir, değiştirebilir veya normal gönderimi yapmayabilir.

## Failure
Payload kapasiteye sığmazsa composer değeri değişmez.

## Gizlilik
Aksiyonun ürettiği instruction metni dosya içeriğini ayrıca server'a göndermez; yalnız normal chat gönderilirse mevcut composer metni server-side chat akışına girer.