# Konuşma Dalları Gizlilik

Fork oluşturma işlemi tamamen browser-local bir işlemdir.

## Veri konumu
Fork kayıtları mevcut `hafize.conversations.v1` localStorage anahtarında tutulur. Ayrı analytics veya telemetry anahtarı oluşturulmaz.

## Network
Fork module kendi içinde fetch, XMLHttpRequest, WebSocket veya Beacon kullanmaz. Yeni model isteği ancak kullanıcı yeni mesaj gönderdiğinde mevcut chat runtime tarafından yapılır.

## Dialog
Onay penceresindeki mesaj önizlemesi yalnız cihazdaki DOM'a yazılır. İçerik textContent ile eklenir.

## Kullanıcı kontrolü
Storage değişimi açık “Yeni dal oluştur” onayından sonra gerçekleşir. Kapatma veya Escape hiçbir kayıt yazmaz.
