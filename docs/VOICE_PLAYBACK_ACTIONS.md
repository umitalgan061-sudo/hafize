# Sesli yanıt playback kontrolleri

`public/voice-output.js`, mevcut açık opt-in TTS davranışına yalnız tarayıcı içi ve kullanıcı kontrollü playback aksiyonları ekler.

## Tekrar oku

`Tekrar oku` yalnız sesli yanıt açık, TTS idle ve aktif konuşmada render edilmiş bir Hafize yanıtı varken görünür. Kontrol yalnız `.message.assistant .content` seçicisinin son öğesinin düz metnini okur.

Metin yeni bir veri yoluna girmez; mevcut `normalizeSpeechText()` ve `splitSpeechText()` sınırlarından geçer. Kod blokları atlanır, URL'ler sözlü `bağlantı` işaretine çevrilir ve konuşma metni mevcut 2400 karakter üst sınırını aşamaz.

Tekrar okuma aktif bir utterance'ı sessizce değiştirmez. Konuşma veya düşünme devam ederken replay isteği fail-closed kalır. Sekme gizliyse mevcut TTS görünürlük sınırı replay için de geçerlidir.

## Durdur

`Durdur` yalnız aktif veya duraklatılmış bir TTS oturumu varken görünür. Açık kullanıcı tıklaması mevcut generation-safe `cancelSpeech()` yolunu kullanır; queue, aktif utterance ve pause state temizlenir.

Durdurma mesaj silmez, sohbet içeriğini değiştirmez ve model/provider çağrısı yapmaz. Kullanıcı isterse idle duruma döndükten sonra son Hafize yanıtını yeniden `Tekrar oku` ile başlatabilir.

## Kullanıcı kontrolü ve erişilebilirlik

Kontroller native `button` olarak oluşturulur ve açık `aria-label` değerleri taşır. Aynı anda yalnız geçerli aksiyon görünür/etkin olur: konuşma sırasında replay kapalı, stop açık; idle durumda uygun son yanıt varsa replay açık, stop kapalıdır.

Controller destroy edildiğinde dinamik playback kontrolleri ve event listener'ları temizlenir. Bu kontroller hiçbir tercihi kalıcı storage'a yazmaz.

## Güvenlik sınırı

- Network, `fetch`, XHR, WebSocket veya `sendBeacon` yoktur.
- Clipboard veya form submit yoktur.
- Tool/connector çağrısı ve dış gönderme/yazma yoktur.
- Agent registry veya backend permission sözleşmesi değişmez.
- TTS metni `voice-output-state` olayına eklenmez.
- Secret/credential için yeni okuma yüzeyi açılmaz.

## PWA ve geri alma

Davranış mevcut `voice-output.js` / `voice-output.css` shell asset'lerinde kalır; PWA cache v48 ile yenilenir ve `/api/*` network-only kalır. Bu değişiklik geri alındığında yalnız replay/stop UI, testler, bu belge ve cache ilerlemesi kaldırılır; pause/resume ile konuşma hızı kontrolleri korunur.
