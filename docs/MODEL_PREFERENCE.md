# Model tercihi kalıcılığı

`public/model-preference.js`, composer'daki `#modelSelect` seçimini yalnız
kullanıcının kendi cihazında hatırlar. Model listesi `/api/models` yanıtıyla
doldurulduğu için seçim her yeniden yüklemede tarayıcı varsayılanına — listenin
ilk modeline — düşüyordu; kullanıcı her oturumda aynı NIM modelini elle seçmek
zorunda kalıyordu.

## Sözleşme

- Tercih `localStorage` içinde `hafize.model.v1` anahtarıyla, düz metin model
  kimliği olarak tutulur. Anahtar; secret, token, oturum veya sohbet içeriği
  taşımaz.
- Yalnız `publisher/model-name` biçimine uyan, en fazla 200 karakterlik
  değerler saklanır veya okunur. Bozuk ya da dışarıdan enjekte edilmiş bir
  depolama değeri seçeneklerle karşılaştırılmadan elenir.
- Tercih yalnızca `#modelSelect` içinde gerçekten bulunan bir seçeneğe
  uygulanır; kayıtlı model listede yoksa seçim tarayıcı varsayılanında kalır.
  Kayıt silinmez, böylece model sağlayıcıda yeniden göründüğünde tercih geri
  gelir.
- `Modeller yükleniyor…` gibi boş değerli placeholder seçenekler tercih olarak
  kaydedilmez.
- Liste `/api/models` yanıtı geldiğinde tek seferde değiştiği için modül
  `MutationObserver` ile seçenek yenilenmesini izler ve tercihi o anda uygular.
  Kullanıcının aynı oturumda yaptığı seçim geri alınmaz.
- Depolama erişimi reddedilirse (private mode, kota, kilitli profil) modül
  sessizce devre dışı kalır; sohbet akışı etkilenmez.

## Sınırlar

Modül `public/app.js` içindeki sohbet durumuna dokunmaz ve model seçimini
sunucuya göndermez; hangi modelin kullanılacağına yine `app.js` istek anında
`#modelSelect` değerinden karar verir. Tercih cihaz başınadır, sohbet başına
değildir; sohbet başına model hafızası ayrı ve daha büyük bir değişikliktir.

## Test

`scripts/test-model-preference.mjs` saf yardımcıları (`isStorableModel`,
`resolvePreferredModel`, `readStoredModel`, `writeStoredModel`) ve sahte DOM
üzerinde `install()` davranışını doğrular: geç dolan liste, kaldırılmış model,
placeholder seçenek, kullanıcı seçiminin korunması, `MutationObserver`
bulunmayan ortam ve hata fırlatan depolama.

Modül `public/index.html` tarafından yüklenir ve `public/sw-policy.js` shell
cache listesindedir; liste değiştiği için `CURRENT_CACHE` sürümü `v19`'a
yükseltilmiştir.
