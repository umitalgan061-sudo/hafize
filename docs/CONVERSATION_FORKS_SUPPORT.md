# Konuşma Dalları Destek Rehberi

## Kullanıcı fork göremiyor
Mesajların render edildiğini ve script entrypoint'inin yüklenmiş olduğunu kontrol et.

## Dal listesi boş
Aktif conversation'ın child forkOf alanlarını kontrol et.

## Fork açılamıyor
Streaming durumu, conversation kapasitesi, parent child limiti ve depth limitini kontrol et.

## Dal açıldı ama model yanıt vermiyor
Bu fork özelliği hatası olmayabilir. Dal oluşturma ağ çağrısı yapmaz; yeni message submit sonrası mevcut chat API akışını incele.

## Yanlış dal oluşturuldu
Normal conversation delete eylemi kullanılabilir. Parent mesajları fork tarafından değiştirilmez.
