# Smart Insert — Veri Göçü ve Sürümleme

## Sürüm 1 alanı

Smart Insert profilleri `hafize.prompt-library.variable-profiles.v1` anahtarında saklanır. History ve preset alanları farklı anahtarlar kullanır. Bu ayrım, bir bileşenin geri alınmasının diğer bileşenlerin kullanıcı verisini etkilememesini sağlar.

## Geriye uyumluluk

Profil nesnesinin bilinmeyen alanları normalize edilirken korunmaz. Uygulama yalnızca ihtiyaç duyduğu bounded alanları yeniden yazar. Böylece eski veya bozuk kayıtların DOM'a sızması engellenir.

## Favori alanı

Profil merkezi favorite alanını destekler. Smart Insert modalı aynı profile bağlı değişken değerlerini okurken favorite metadata'sına bağımlı değildir. Eski profiller favorite alanı olmadan yüklenebilir ve varsayılan `false` değerine normalize edilir.

## ID politikası

Mevcut profil import edildiğinde isim eşleşmesiyle var olan ID korunur. Yeni profil veya kopya oluşturulduğunda yeni random UUID benzeri kimlik üretilir. Aynı kimliğe sahip iki kayıt normalize sırasında tekilleştirilir.

## Import sözleşmesi

Hem dizi hem `{ profiles: [...] }` payload'ı desteklenir. Dosya boyutu sınırı parse öncesi kontrol edilir. JSON bozuksa hiçbir kayıt kaydedilmez. Kısmi kayıtlar normalize edilebilir ama kapasite sınırı aşılmaz.

## Storage hatası

Local storage read hatası boş listeye dönüşür. Write hatası kullanıcıya durum mesajı ile bildirilir. Smart Insert'in manuel alan doldurma yüzeyi storage olmadan da açılabilirse açılır; profil kalıcılığı zorunlu değildir.

## History migrasyonu

History anahtarı profil anahtarından bağımsızdır. Eski bir geçmiş kaydı prompt body veya variable values içeriyorsa mevcut normalizeEntry yalnızca promptId, label, usedAt ve reason alanlarını seçtiği için hassas alanları UI katmanına taşımaz.

## Preset migrasyonu

Preset'ler profil merkezinden ayrı tutulur. Aynı isimde preset geldiğinde upsert davranışı kullanılır. Variable name sanitization aynı alfasayısal/underscore/hyphen politikasını izler.

## Cache versiyonu

Yeni Smart Insert asset seti ile service worker cache sürümü v39'a yükseltilir. Eski shell cache'leri prefix karşılaştırmasıyla silinebilir. Kullanıcı local storage verisinin service worker cache'inden bağımsız olması gözetilir.

## Rollback

Sadece Smart Insert UI geri alınacaksa loader ve Smart Insert asset'leri geri alınabilir. Profil/history/preset local storage anahtarları silinmeden bırakılmalıdır. Yeniden deploy edildiğinde eski kod yeni kullanıcı verisini güvenli normalize etmelidir.

## Test kriterleri

Migration testleri eski profile shape, favorite'sız kayıt, duplicate ID, duplicate name, malformed JSON, oversize import, missing values ve unknown fields senaryolarını doğrulamalıdır.
