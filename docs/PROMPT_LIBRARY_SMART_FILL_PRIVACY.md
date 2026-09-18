# Smart Fill Gizlilik Modları

Smart Fill üç ayrı yerel veri katmanı kullanabilir: kalıcı hatırlama, preset ve oturumluk değerler.

## Kalıcı hatırlama

`Dolu değerleri bu cihazda hatırla` seçilirse değerler `hafize.prompt-library.fill.v1` altında saklanır.

Bu veri tarayıcı profiline bağlıdır.

Tarayıcı verisi temizlenirse kaybolabilir.

Cihazı paylaşan kişiler bu verilere erişebilir.

## Preset

Presetler `hafize.prompt-library.fill.presets.v1` altında saklanır.

Preset bir prompt id'sine bağlıdır.

Preset prompt gövdesini veya chat history'yi değiştirmez.

Presetler kullanıcı tarafından yedeklenebilir ve temizlenebilir.

## Oturumluk değer

`Bu oturumda hatırla` seçeneği yalnız JavaScript belleğindeki Map içinde tutulur.

Oturum bitişinde veri temizlenir.

Bu katman localStorage yazmaz.

Bu mod, tekrar kullanım kolaylığı ile kalıcı saklama arasındaki daha kısa ömürlü seçenek için kullanılır.

## Veri paylaşımı

Smart Fill kendi başına backend'e variable value göndermez.

Smart Fill analytics çağrısı yapmaz.

Smart Fill remote error logging yapmaz.

Composer'a aktarım sonrası normal chat gönderimi mevcut uygulama davranışıdır.

## Hassas değerler

Parola, API anahtarı, refresh token, session cookie, OTP ve diğer sırlar hiçbir Smart Fill memory modunda saklanmamalıdır.

Özellikle kalıcı hatırlama ve presetler cihaz depolamasında kaldığı için hassas içeriklerde oturumluk mod tercih edilmelidir; ancak bu da yalnızca tarayıcı sekmesi açıkken tutulur.

## Temizleme

Tek promptun kalıcı değerleri temizlenebilir.

Tek promptun presetleri temizlenebilir.

Boş hatırlamalar temizlenebilir.

Tüm Smart Fill verisi açık onayla temizlenebilir.

Oturumluk değerler sayfa yaşam döngüsü boyunca otomatik temizlenir.

Hiçbir temizleme eylemi Prompt Library ana kayıtlarını silmemelidir.

## Export sınırı

Prompt export'ları kalıcı hatırlama değerlerini içermemelidir.

Preset backup ayrı bir dosya alanıdır.

History ayrı bir lokal veri katmanıdır.

Oturum Map'i export edilmez.

Bu ayrım yanlışlıkla gizli değerlerin prompt yedeğine girmesini azaltır.

## Browser boundary

Gizlilik kontrolü aynı origin localStorage mekanizmasına dayanır.

Browser extension veya aynı origin'deki başka kodlar storage alanlarını etkileyebilir.

Bu nedenle Smart Fill bir secret vault değildir.

## Support

Hata bildirirken variable değerlerini destek kanalına kopyalamayın.

Prompt başlığı ve id'si yeterli teşhis bilgisi olabilir.

Backup dosyası paylaşılacaksa önce hassas alanlar temizlenmelidir.

## Release policy

Yeni bir Smart Fill memory türü eklenirse ayrı bir versioned namespace kullanılmalıdır.

Bir memory türü diğerinin namespace'ini silmemelidir.

Persistent memory eklenmesi açık bir kullanıcı aksiyonu gerektirir.

Session memory disk'e yazılmamalıdır.

## Sonuç

Smart Fill kullanım kolaylığını artırırken veri ömrünü kullanıcının seçimine göre ayırır: tek kullanım, oturum, kalıcı hatırlama ve preset. Hiçbir katman ana Prompt Library record'larını veya chat history'yi otomatik olarak değiştirmez.
