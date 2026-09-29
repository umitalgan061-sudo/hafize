# Konuşma Dalları Failure Recovery

## Storage okunamıyor
Fork modülü boş liste kabul eder ancak aktif sohbet bulunmadığı için yeni kayıt üretmez. Mevcut app-shell state'i değiştirilmez.

## Storage yazılamıyor
Yeni conversation oluşturulmadan kullanıcıya kalıcı kayıt hatası bildirilir.

## Source değişti
Dialog açıkken başka bir local işlem kaynak conversation'ı değiştirirse onay anında güncel kayıt yeniden okunur. Source bulunamazsa işlem iptal edilir.

## Kapasite
Conversation, child veya depth sınırı aşıldığında işlem reddedilir.

## Streaming
aria-busy true iken fork eylemi başlamaz. Böylece yarım response kopyalanmaz.
