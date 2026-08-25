# Hafize ekran görüntüsü gizlilik sözleşmesi

Bu belge web/PWA ekran paylaşımının güvenlik ve veri yaşam döngüsü sınırını tanımlar.

## Kullanıcı kontrolü

- Ekran seçici yalnız kullanıcı `Ekran` düğmesine bastığında açılır.
- Arka planda, sayfa açılışında veya model talimatıyla otomatik capture yapılmaz.
- Tarayıcının kendi `getDisplayMedia` seçim ekranı atlanmaz.
- Audio capture kapalıdır.
- Kullanıcı paylaşımı iptal ederse bu normal bir kullanıcı kararı olarak ele alınır.
- Düşük seviye `captureScreenFrame()` çağrısı da `explicitUserIntent: true` olmadan fail-closed reddedilir; yalnız UI event zincirine güvenilmez.

## Veri minimizasyonu

- Seçilen kaynaktan yalnız tek görüntü karesi alınır.
- Kare en fazla 1280×720 boyutunda JPEG olarak hazırlanır.
- Görüntü hazırlandıktan hemen sonra tüm display-media track'leri durdurulur.
- Preview yalnız mevcut sekmenin belleğinde tutulur.
- Object URL, kullanıcı kaldırdığında veya sayfa kapandığında revoke edilir.

## Kalıcılık ve model sınırı

- Ekran görüntüsü sohbet geçmişine veya localStorage'a otomatik yazılmaz.
- Bu aşamada ekran görüntüsü backend'e, NVIDIA NIM'e veya başka bir sağlayıcıya otomatik gönderilmez.
- Preview görülmesi modelin görüntüye eriştiği anlamına gelmez; UI bunu açıkça belirtir.
- Gelecekte vision analizi açılırsa ayrı açık gönderme eylemi ve server-side metadata doğrulaması gerekir.
- Vision isteği mevcut backend default-deny tool/permission sözleşmesini bypass edemez.

## Backend metadata sınırı

`normalizeScreenCaptureMetadata()` gelecekteki server sınırı için yalnız şu alanları kabul eder:

- `explicitUserIntent`
- `mimeType`
- `byteLength`
- `width`
- `height`

URL, pencere başlığı, dosya yolu, owner dışı metadata, credential veya key/value serbest alanları kabul edilmez. `explicitUserIntent` doğrulama sonrasında saklanan metadata'dan çıkarılır; bu alan yalnızca çağrı anındaki kullanıcı niyetini kanıtlayan bir gate'tir.

## Uygulama durumu

- `public/screen-share.js` mevcut Claude-benzeri composer içindeki ekran butonunu kullanır ve tek kare üretir.
- `lib/screen-capture-contract.mjs` backend'e taşınabilecek metadata için ayrı fail-closed doğrulama sınırıdır.
- `scripts/test-screen-share.mjs`, düşük seviye çağrının explicit intent olmadan `getDisplayMedia` açamadığını ve üretilen metadata'nın backend sözleşmesinden geçtiğini doğrular.
- Bu tur yeni, paralel bir capture sistemi eklememiştir; mevcut ekran paylaşımı akışı sertleştirilmiştir.

## Bilerek bu aşamaya alınmayanlar

- Sürekli ekran kaydı veya ekran izleme.
- Gizli screenshot alma.
- Mikrofon/sistem sesi kaydı.
- Capture'ın otomatik memory write'a dönüşmesi.
- Görüntüyü sohbet geçmişinde kalıcı base64/data URL olarak saklama.
- Provider seçimine göre güvenlik politikasını değiştirme.
