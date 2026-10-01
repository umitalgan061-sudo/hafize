# Sistem Sağlığı Operasyon Rehberi

## Amaç

System readiness yüzeyi, üretim çalıştırmasına ilişkin kritik durumları tek bir güvenli raporda toplamak için kullanılır. Bu yüzey bir secret yöneticisi değildir ve hiçbir credential değeri göstermemelidir.

## Durumların yorumlanması

ready bütün temel kontrollerin bilinen ve kullanılabilir olduğunu gösterir.
degraded sistemin çalışabildiğini fakat bir veya daha fazla bileşende uyarı bulunduğunu gösterir.
blocked kritik bir koşulun sağlanmadığını ve üretim için engel bulunduğunu gösterir.
unknown güvenli değerlendirme için yeterli sinyal bulunmadığını gösterir; uygulama bu durumda tahmin yürütmez.

## Sağlık kartı

Kart her açılışta health verisini ister. Manuel yenileme aynı endpoint'i yeniden çağırır. Otomatik yenileme 60 saniyede bir yapılır.

HTTP isteği 8 saniyelik AbortController timeout'u ile sınırlandırılmıştır. Başarısız istek kartı veya sohbeti bozmaz; yalnız kullanıcıya genel hata durumu gösterilir.

Son başarılı rapor yalnız sayfa belleğinde tutulur. Browser storage'a yazılmaz.

## Güvenli rapor

Rapor kopyalama eylemi yalnız kullanıcı tarafından açıkça başlatılır. Kopyalanan içerik bileşen adları ve durum özetlerinden oluşur.

Rapor içinde:

- secret değerleri bulunmaz,
- token değerleri bulunmaz,
- Authorization header bulunmaz,
- prompt veya sohbet metni bulunmaz,
- dosya sistemi yolu bulunmaz,
- connector credential verisi bulunmaz.

Panoya aktarım da başarısız olabilir. Bu durumda uygulama hata mesajını gösterir ve mevcut readiness verisini silmez.

## PWA ve cache

System readiness panelinin JS ve CSS çıktıları shell cache listesine alınır.
GET /api/health cevapları service worker tarafından cache edilmez. Kullanıcı çevrimdışıysa panel eski health sonucunu uydurmaz.

Yeni panel dosyası eklendiğinde Vite entry, index yükleme satırı ve service worker shell kaydı birlikte güncellenmelidir.

## TypeScript migration

Readiness kaynakları TypeScript altında kanonik hale getirilmiştir. Eski MJS yolları yalnız compatibility bridge olarak tutulur.

Bridge bütünlüğü testinde her MJS dosyasının tam olarak ilgili TS export'ına yönlendirdiği doğrulanır.

Test kaynakları da TypeScript'e taşındığı için script typecheck kapsamındadır. Bu sayede migration yalnız üretim kodunda değil, doğrulama katmanında da ölçülür.

## Schedule lease

Schedule execution lease sınırı holder ID ve schedule ID gibi kimlikleri normalize eder. Fence değeri pozitif güvenli integer olmalıdır.

Provider çağrıları bounded timeout ile çalışır. Provider iç hataları dışarıya genel hata kodlarıyla çıkar; internal hata metinleri tekrar gönderilmez.

Idempotency anahtarı schedule kimliği üzerinden deterministik biçimde üretilir.

## Release kontrolü

PR açılmadan önce base ile head arasındaki changed lines ölçülür. Bu turun hard limit'i 3000 değişen satırdır ve hedef yaklaşık 2800 ile 3000 arasındadır.

Migration gate; TS kaynaklarının varlığını, MJS bridge biçimini, tsconfig kapsamını, health entegrasyonunu, Vite entry'sini ve panel asset kaydını kontrol eder.

## Geri alma

Bu dalganın geri alınması halinde legacy bridge dosyaları sayesinde eski import yolları yeniden kullanılabilir. Health endpoint'in eski güvenli alanları korunmalıdır.

UI katmanı geri alınırken localStorage içindeki kullanıcı verilerinin silinmemesi gerekir. Readiness paneli kendi kalıcı veri alanını oluşturmaz.

## Arıza inceleme sırası

1. /api/health yanıtının HTTP durumunu kontrol et.
2. readiness.state ve component durumlarını karşılaştır.
3. public deployment için auth secret ve HTTPS cookie ayarlarını kontrol et.
4. schedule durumunda provider config ve lease timeout değerlerini kontrol et.
5. PWA sorunu varsa Vite entry ve service worker shell kayıtlarını karşılaştır.
6. TypeScript migration sorunu varsa bridge integrity ve typecheck gate sonuçlarına bak.

## Veri kaybı ilkesi

Readiness paneli hiçbir storage temizliği yapmaz. Release veya rollback sırasında prompt, conversation, memory, schedule veya connector kullanıcı verilerini silen işlem bulunmamalıdır.

## Son kullanıcı beklentisi

Ready olmayan bir bileşen için panel ayrıntılı secret teşhisi vermek yerine genel durum gösterir. Operasyonel ayrıntılar server logları veya güvenli yönetim araçlarında ayrı tutulmalıdır.

## Kabul kanıtları

TypeScript source gate geçmeli, UI contract gate geçmeli ve bridge bütünlüğü bozulmamalıdır.
PR diff'i 3000 değişen satırı geçmemeli ve merge sonrasında main ref'i PR merge commit'ine işaret etmelidir.
