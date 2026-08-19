# Conversation search keyboard continuity

## Amaç

Sohbet aramasındaki `Alt+↑` / `Alt+↓` geziniminin yalnız arama kutusu odaktayken değil, odak görünür bir arama sonucuna veya arama gezinme kontrollerine taşındıktan sonra da devam etmesini sağlar.

## Sorun

İlk uygulamada `keydown` yalnız `#conversationSearchInput` üzerine bağlanmıştı. İlk `Alt+↓` sonucu `.conversation-open` düğmesine odakladıktan sonra ikinci klavye komutu artık input'a ulaşmıyordu. Görsel kontroller çalışsa da klavye kullanıcıları sonuçlar arasında yalnız tek adım ilerleyebiliyordu.

## Sınır

Document-level dinleyici global bir kısayol sahiplenmez. Komut yalnız şu koşulların tamamı sağlandığında tüketilir:

- arama sorgusu boş değildir;
- `Alt` basılıdır;
- `Ctrl`, `Meta` ve `Shift` basılı değildir;
- key repeat değildir;
- tuş `ArrowUp` veya `ArrowDown`'dır;
- event hedefi arama input'u, arama navigation kontrolü veya o anda görünür `.conversation-open` sonucudur.

Composer, başka butonlar veya uygulamanın diğer yüzeylerinde aynı tuş kombinasyonu fail-open bırakılır. Gizlenmiş arama sonuçları keyboard navigation target olamaz.

## Lifecycle

Controller mount sırasında document-level `keydown` dinleyicisini bir kez bağlar. `destroy()` aynı handler referansını kaldırır, MutationObserver'ı kapatır ve navigation DOM'unu temizler. Böylece remount sırasında ghost listener birikmez.

## Güvenlik

Bu değişiklik yalnız odak yönetimidir. Yeni network isteği, backend endpoint, provider/connector çağrısı, storage yazımı, clipboard erişimi veya agent tool permission eklemez. Programatik click/submit yapılmaz; sonuç yalnız `focus()` ile seçilir. Dört profilli agent roster, backend default-deny ve external write/send/merge approval sınırları değişmez.

## Regresyon kanıtı

Testler şunları kilitler:

- input → ilk sonuç → ikinci sonuç → üçüncü sonuç şeklinde kesintisiz klavye gezinimi;
- yukarı/aşağı wrap-around;
- navigation düğmesinden keyboard devamı;
- dış yüzeylerde shortcut'ın tüketilmemesi;
- Ctrl/Meta/Shift/repeat varyantlarının reddi;
- gizlenmiş sonuçların atlanması;
- boş sorguda sıfır gezinim;
- destroy sonrasında document listener temizliği.
