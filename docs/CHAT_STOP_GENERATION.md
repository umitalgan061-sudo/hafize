# Hafize — yanıtı durdurma

Bir yanıt akarken composer'daki gönder düğmesinin yerini "Yanıtı durdur" düğmesi alır. Düğme yalnız akış sürerken görünür; akış bittiğinde gönder düğmesi geri gelir.

Durdurma tamamen istemci tarafındadır: çalışan `fetch` isteği bir `AbortController` ile iptal edilir. Ayrı bir iptal endpoint'i yoktur ve backend'den yapılmış bir işi geri alması istenmez; sunucu isteğin düştüğünü kendi akış sınırlarıyla görür.

O ana kadar gelen metin korunur ve sohbete `(Yanıt durduruldu.)` notuyla kalıcı olarak yazılır. Hiç içerik gelmediyse mesaj yalnızca `Yanıt durduruldu.` olur. Durdurma bir hata değildir; model hatası bildirimi üretmez.

`Esc` tuşu durdurma düğmesinin klavye karşılığıdır. Metin alanlarında (`input`, `textarea`, `select`) `Esc` kendi davranışını korur — geçmiş araması kendini temizler — ve mobil menü `Esc` ile kapanmaya devam eder.

Durdurma, composer üzerinde `hafize:stream-stopped` olayını yayınlar. Sesli yanıt modülü bu olayı dinler: durdurulan bir yanıt akış bittiğinde sesli okunmaz ve o an konuşan ses kesilir. Susturma yalnız o yanıt içindir; sonraki yanıt normal biçimde okunur.

Durdurma idempotenttir: iptal edilmiş bir akış için ikinci tıklama veya ikinci `Esc` hiçbir şey yapmaz. Akış durduğunda composer, ajan seçimi ve araç modu tekrar etkinleşir.
