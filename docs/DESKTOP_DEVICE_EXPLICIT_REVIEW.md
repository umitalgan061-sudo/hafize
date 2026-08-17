# Hafize Desktop Device Explicit Review Contract

Bu sözleşme Hafize Electron cihaz köprüsünün görünür kullanıcı yüzeyini sınırlar. Amaç sistem bilgisini salt-okunur göstermek ve zaten allowlist ile sınırlandırılmış tarayıcı/uygulama açma eylemlerini kullanıcıya açıkça kontrol ettirmektir.

## Güven sınırı

- Renderer genel sistem veya terminal API'si almaz. Yalnız preload tarafından yayınlanan `getSystemInfo`, `getCapabilities`, `openBrowser` ve `openApp` yöntemleri kullanılabilir.
- `getSystemInfo` salt-okunurdur. UI platform, mimari, Hafize sürümü, CPU sayısı ve toplam bellek gibi bounded alanları gösterir.
- Browser hedefleri yalnız main process'in verdiği HTTPS origin allowlist'inden gelir. UI de hedefi yeniden normalize eder ve path/query/hash/credential içeren URL'leri reddeder.
- Uygulama hedefleri yalnız main process'in verdiği app-id allowlist'inden gelir. UI app-id için dar karakter allowlist'i uygular.
- Main process allowlist kontrolü kaynak otoritedir. Renderer doğrulaması savunma katmanıdır, yetki kaynağı değildir.
- Preload `navigator.userActivation.isActive` şartını korur. Açma IPC'si aktif kullanıcı jesti olmadan gönderilmez.

## Açık kullanıcı onayı

Browser veya uygulama açmak tek tıklamalı değildir:

1. Kullanıcı allowlist içindeki hedef düğmesine tıklar.
2. Hafize yalnız geçici bir inceleme paneli hazırlar; bu aşamada `openBrowser` veya `openApp` çağrılmaz.
3. Panel tam hedefi açık metinle gösterir.
4. Kullanıcı ayrı `Onayla ve ... aç` düğmesine basarsa bridge çağrısı aynı kullanıcı jesti içinde, ilk `await` öncesinde yapılır.
5. `Vazgeç`, geçersiz hedef veya kapanmış UI hiçbir açma IPC'si üretmez.

Onay kalıcı değildir. Pending hedef yalnız renderer belleğinde yaşar ve işlem tamamlanınca veya iptal edilince temizlenir. LocalStorage, sessionStorage, IndexedDB, cookie veya clipboard'a yazılmaz.

## Web/PWA davranışı

`public/ui-shell.js` masaüstü cihaz assetlerini yalnız `window.hafizeDevice` sözleşmesi eksiksizse yükler. Normal web/PWA ortamında bridge yoksa loader no-op olur ve cihaz kartı oluşturulmaz. Asset yolları kod içinde sabit same-origin path'lerdir; bridge veya kullanıcı girdisi script/style URL'si belirleyemez.

Service worker masaüstü cihaz JS/CSS dosyalarını shell asset olarak tanır. Bu, çevrimdışı masaüstü kabuğunun statik assetlere erişmesini sağlar; herhangi bir cihaz izni veya network API'si açmaz.

## Veri minimizasyonu

- UI yalnız bounded public sistem alanlarını işler.
- Token, Authorization header, cookie, OAuth credential, owner kimliği, trace içeriği veya provider secret okunmaz.
- Browser/app eylem geçmişi persist edilmez.
- Cihaz bilgisi ajan mesajına, tool context'ine veya kişisel memory'ye otomatik eklenmez.
- Kullanıcı kaynaklı veya bridge kaynaklı metinler `textContent` ile render edilir; HTML parse edilmez.

## Agent ve tool policy

Bu geliştirme yeni agent tool'u değildir. Dört profilli selector/specialist roster değişmez. Model sağlayıcısı cihaz yetkisi vermez. Agent runtime'ın backend default-deny tool sözleşmesi ve dış write/send/merge onay kuralları aynen korunur.

Cihaz eylemi yalnız insanın Electron UI içindeki açık etkileşimiyle gerçekleşir. Bir prompt, agent cevabı veya connector sonucu kendiliğinden browser/app açamaz.

## DoD

Regresyon kapsamı en az şunları doğrular:

- HTTPS origin ve app-id normalizasyonu,
- capability dedupe ve bounded liste,
- mount/refresh sırasında sıfır dış açma,
- ilk hedef tıklamasında sıfır dış açma,
- ikinci açık onayda tam bir bridge çağrısı,
- geçersiz hedeflerde fail-closed davranış,
- web/PWA bridge yokken sıfır desktop asset injection,
- asset loader idempotence ve fixed same-origin paths,
- preload user-activation guard'ının korunması,
- main-process allowlist'lerinin korunması,
- storage/network/secret/shell/HTML yüzeylerinin eklenmemesi,
- dört profilli agent roster'ının değişmemesi,
- mobil 44 px hedef, focus-visible, reduced-motion ve forced-colors davranışı,
- PWA shell cache wiring'i.

## Geri alma

Bu özellik kalıcı veri veya schema migration oluşturmaz. Geri almak için desktop status review UI/CSS, bridge-gated shell loader wiring'i, PWA asset kaydı, testler ve bu sözleşme kaldırılabilir. Main-process device bridge ve preload güvenlik sınırları bağımsız olarak korunabilir.
