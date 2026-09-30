# Smart Fill — Sorun Giderme

## Panel açılmıyor

Prompt Library kartının ve `#messageInput` alanının mevcut olduğundan emin olun. Modül kart bulunamadığında sessizce çıkış yapar.

## Değişken görünmüyor

Değişken sözdizimi `{{ad}}` biçiminde olmalıdır. Değişken isimleri harf, rakam, alt çizgi ve tire ile sınırlandırılır.

## Aktarım engellendi

Boş bırakılan zorunlu değişkenler aktarımı durdurur. Önce panelde bildirilen tüm değişkenleri doldurun.

## Son değer gelmiyor

Son değerler yalnızca başarılı bir aktarım sonrasında yerel olarak saklanır. Önizleme yapmak tek başına kayıt oluşturmaz.

## Preset kayboldu

Tarayıcı local storage temizlenmişse presetler de temizlenir. Ana Prompt Library verisi ayrı anahtarda tutulduğu için bundan bağımsızdır.

## PWA eski paneli gösteriyor

Service worker shell cache sürümü yükseltilmelidir. Smart Fill asset'leri `sw-policy.js` içindeki shell listesinde bulunmalıdır.
