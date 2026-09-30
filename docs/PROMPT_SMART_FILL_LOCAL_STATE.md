# Smart Fill — Yerel Durum Sözleşmesi

## Amaç

Akıllı istem doldurma sırasında kullanılan değişken değerlerinin sunucuya gitmeden tekrar kullanılabilmesini sağlar.

## Anahtarlar

Ana anahtar `hafize.prompt-library.smart-fill.v1` olup prompt başına `presets` ve `last` alt anahtarları kullanılır. Prompt kimliği en fazla 120 karaktere sınırlandırılır.

## Preset

En fazla 8 set tutulur. Set adı en fazla 60 karakterdir. Bir sette en fazla 12 değişken bulunur ve her değer 1000 karaktere kırpılır. Boş veya bozuk kayıtlar okunurken elenir.

## Son değerler

Son değerler yalnızca açıkça **Mesaja aktar** işlemi tamamlandığında yazılır. Böylece kullanıcı sadece önizleme yaparken veri kalıcı hale getirilmez.

## Silme

Preset silindiğinde yalnızca ilgili prompt'un preset anahtarı güncellenir. Ana Prompt Library kayıtları silinmez.

## Güvenlik

Değerler DOM'a `textContent` ve form value üzerinden yazılır. HTML olarak yorumlanmaz. Ağ isteği, fetch, XHR, WebSocket veya harici telemetry yoktur.

## Geriye uyumluluk

Smart Fill verisinin bulunmaması veya bozulması ana Prompt Library'yi etkilemez. Modül yoksa standart `Kullan` davranışı korunur.
