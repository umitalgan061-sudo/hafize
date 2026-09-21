# Composer Ekleri — Gizlilik

## Veri yaşam döngüsü

Dosya içeriği yalnızca aktif browser belleğinde yaşar.

Akış: seçim → doğrulama → okuma → normalize → önizleme → açık kullanıcı onayı → composer metni → isteğe bağlı normal gönderim.

Dosya seçilmesi tek başına network isteği değildir.

## Kalıcı olmayan alanlar

Attachment içeriği localStorage, sessionStorage, IndexedDB, Cache API, cookie, URL, Prompt Library storage veya Composer History storage içine yazılmaz.

Service worker da dosya içeriği tutmaz.

## Sunucuya ulaşma noktası

Kullanıcı seçilen metni composer'a ekledikten sonra normal sohbet gönderisini kendisi başlatırsa içerik chat request'ine girebilir. Bu, normal mesaj akışıdır; attachment modülü ayrı bir upload endpoint'i çağırmaz.

## Kullanıcı kontrolü

Kullanıcı her eki dahil veya hariç tutabilir. Ayrıca satır aralığını daraltabilir, preview inceleyebilir ve bekleyen kuyruğu tamamen silebilir.

Paneli kapatmak staged veriyi silmez; bu nedenle gizlilik yalnız panel kapanışına bağlanmaz. Otomatik expiry bağımsız güvenlik bariyeridir.

## Hassas veri

Gizli kod, erişim anahtarı, kişisel belge veya müşteri verisi içeren dosyalar seçilebilir. UI bu veriyi redakte ettiğini iddia etmez; kullanıcı gönderimden önce final composer metnini incelemelidir.

## Telemetry

Attachment modülü dosya adı, boyut, içerik veya kullanım davranışı için telemetry üretmez.