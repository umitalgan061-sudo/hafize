# Composer Ekleri — Güvenlik

## Güvenlik hedefi

Dosya ekleri, yerel dosya içeriğini minimum yetkiyle işleyerek kullanıcı istemine dönüştürür. Dosya içeriğini kalıcılaştırmak veya otomatik göndermek kapsam dışıdır.

## Savunma katmanları

1. Uzantı allowlist: bilinmeyen türler okunmadan reddedilir.
2. Byte sınırı: tek dosya 256 KB ile sınırlıdır ve okuma öncesi kontrol edilir.
3. Dosya sayısı: kuyrukta en fazla dört kayıt tutulur.
4. Karakter sınırı: tek dosya 80.000, toplam 200.000 karakterdir.
5. Binary sezgisi: NUL ve kontrol karakter yoğunluğu yüksek içerik reddedilir.
6. Güvenli ad: slash, backslash ve kontrol karakterleri temizlenir.
7. DOM güvenliği: kullanıcı içeriği textContent ve pre text node olarak çizilir.
8. Ağ sınırı: attachment modülü fetch, XMLHttpRequest, WebSocket veya Beacon kullanmaz.
9. Kalıcı depolama yok: file content hiçbir browser storage API'sine yazılmaz.
10. Açık kullanıcı eylemi: composer değişikliği yalnız Mesaja ekle ile olur.
11. No-submit: ekleme sonrası yalnız input olayı gönderilir.
12. Auto-expiry: staged içerik 15 dakika sonra temizlenir.

## Tehditler

Kötü niyetli dosya adı HTML injection denemesi yapabilir. Güvenli metin düğümü bunu HTML olarak yorumlatmaz.

Aşırı büyük dosya memory pressure yaratabilir. Pre-read byte kontrolü dosyayı okumadan reddeder.

Binary dosya metin gibi gösterilmeye çalışabilir. Uzantı allowlist ve içerik sezgisi iki ayrı bariyer sağlar.

Kullanıcı hassas bir dosya seçebilir. Sistem bu içeriği otomatik yüklemez; ancak kullanıcı açıkça composer'a ekleyip normal mesaj gönderdiğinde içerik chat isteğinin parçası olabilir.

## Güvenlik değişmezleri

- Attachment queue Prompt Library ve Composer History storage anahtarlarına dokunmaz.
- Service worker kullanıcı dosya içeriği cache'lemez.
- Insert fonksiyonu submit çağırmaz.
- Dosya içeriği HTML sink'lerine gönderilmez.
- Limitler policy katmanında tutulur.

Yeni kod bu değişmezlerden birini kaldırıyorsa aynı turda güvenlik değerlendirmesi gerekir.