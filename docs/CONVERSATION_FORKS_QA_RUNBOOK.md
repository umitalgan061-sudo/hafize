# Konuşma Dalları QA Runbook

## Temel senaryo
1. En az üç mesajlı sohbet oluştur.
2. Orta mesajda Buradan dallandır seç.
3. Dialog açıldığında storage değişmediğini kontrol et.
4. Başlık ve not gir.
5. Yeni dal oluştur.
6. Child sohbetin parent'tan doğru mesaj sayısını taşıdığını kontrol et.

## Gezinme
- Üst sohbet.
- Fork noktası.
- Soy ağacı breadcrumb.
- Karşılaştırma.
- Dal yedeği.
- Tüm dallar araması.

## Guard
Streaming sırasında fork denenir ve reddedilir.
30 conversation, 8 direct child ve 4 depth sınırları sınanır.
