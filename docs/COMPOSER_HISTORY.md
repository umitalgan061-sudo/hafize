# Composer mesaj geçmişi geri çağırma sözleşmesi

`public/composer-history.js`, yalnız aktif sohbetin ekranda render edilmiş kullanıcı mesajlarını yazı alanında klavyeyle geri çağırır.

## Kullanıcı kontrolü

- Yazı alanında imleç en baştayken `ArrowUp`, aktif sohbetteki önceki kullanıcı mesajına gider.
- Gezinme başladıktan sonra imleç sondaysa `ArrowDown`, daha yeni mesaja gider.
- En yeni kaydın ötesine geçildiğinde gezinme başlamadan önceki taslak aynen geri yüklenir.
- Seçili metin, modifier tuşları, IME composition veya key-repeat varken geçmiş gezinmesi çalışmaz.
- Kullanıcı yazı alanını elle değiştirirse geçmiş modu hemen kapanır; yeni yazı korunur.
- Durum `role=status`, `aria-live=polite` ve `aria-atomic=true` ile duyurulur.

## Veri sınırı

- Yalnız `#messages .message.user .content` düz metni okunur.
- En fazla son 50 görünür kullanıcı mesajı tutulur.
- Tek mesaj 12.000 karakterden uzunsa history corpus'una alınmaz.
- CRLF/CR satır sonları LF'ye normalize edilir ve NUL karakterleri çıkarılır.
- Assistant mesajları, tool activity, trace, agent metadata, message id ve başka sohbetler okunmaz.
- Geçmiş snapshot'ı yalnız controller belleğinde tutulur; yeni storage katmanı eklenmez.

## Güvenlik

Controller `fetch`, XHR, WebSocket, beacon, clipboard, local/session storage, cookie, form submit veya tool çağrısı yapmaz. Mesaj hiçbir zaman otomatik gönderilmez. Her gönderim kullanıcının normal composer akışındaki açık gönderme eylemini gerektirir.

## Etkileşim ayrıntıları

- `ArrowUp` yalnız selection çökmüşken ve caret `0` konumundayken yakalanır; çok satırlı metinde normal yukarı hareket aksi halde bozulmaz.
- `ArrowDown` yalnız selection çökmüşken ve caret mevcut değerin sonunda olduğunda yakalanır.
- En eski kaydın ötesindeki `ArrowUp` metni değiştirmez ve sınır durumunu status alanında bildirir.
- History controller kendi yazdığı `input` event'ini ayırt eder; manuel giriş history modunu kapatır.
- Mount/destroy lifecycle event listener'ları temizler ve geçici status node'unu kaldırır.

## PWA

`/composer-history.js` same-origin shell asset olarak cache listesine eklenir. Shell cache sürümü v40'tır. `/api/*` istekleri network-only kalır.

## Geri alma

Controller, loader satırı, shell cache kaydı, testler ve bu belge kaldırıldığında mevcut composer davranışı geri gelir; konuşma veri formatı değişmez.
