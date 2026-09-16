# Smart Insert — Güvenlik Sözleşmesi

## Tehdit yüzeyi

Smart Insert tamamen browser-side çalışır. Profil, geçmiş ve ön ayar verileri local storage alanlarında tutulur. Backend endpoint'i veya OAuth scope'u eklenmez. Böylece yeni özellik mevcut server secret'larına erişim gerektirmez.

## DOM güvenliği

Kullanıcı kaynaklı profil adı, prompt etiketi ve değişken değeri DOM'a `textContent`, form `value` veya güvenli attribute atamaları üzerinden taşınır. `innerHTML`, `outerHTML` veya kullanıcı verisi içeren template HTML kullanılmamalıdır.

## Girdi sınırları

Profil adı, değişken adı, değişken değeri, profil sayısı, geçmiş kayıt sayısı, dosya boyutu ve arama sorgusu bounded değerlerdir. Limitler hem normalize katmanında hem de kullanıcı arayüzünde uygulanır.

## Dosya işlemleri

İçe aktarma yalnızca JSON kabul eder. Dosyanın byte boyutu kontrol edilir; parse başarısızsa veri yazılmaz. İçe aktarılan nesneler doğrudan kullanılmaz, önce normalize edilir. Büyük veya bozuk dosyalar kullanıcıya hata mesajı ile döner.

## İndirme

Dışa aktarma `Blob` ve geçici object URL ile yapılır. URL işlem sonrası revoke edilir. Dışa aktarma otomatik olarak başlatılmaz; kullanıcı butonuna ihtiyaç duyar.

## Profil birleştirme

İçe aktarma aynı isimde profil bulursa mevcut kimlik korunur ve yalnızca mevcut olmayan değerler veya gelen değerler normalize edilerek birleştirilir. Rastgele yeni ID üretimi yalnızca yeni profil içindir.

## XSS önleme

Değişken değerleri önizlemeye ve input alanlarına yazı olarak taşınır. Preview `pre.textContent` kullanır. Markdown veya HTML parse edilmez. CSS class isimleri sabittir.

## CSRF ve yetki

Bu özellik harici state-changing API çağrısı yapmadığı için yeni bir CSRF token akışı gerektirmez. Composer aktarımı da yalnızca mevcut textarea değerini değiştirir; network isteği başlatmaz.

## Privacy by construction

Smart Insert geçmişi yalnızca prompt ID, etiket, zaman ve neden alanlarını kaydeder. Değişken değerleri profil anahtarında kalır ve geçmişe kopyalanmaz. Öneri modülü değişken isimlerini skorlar; hassas değerleri göndermeden veya dış servise taşımadan çalışır.

## Recovery

Storage erişimi kesilirse Smart Insert kapanmaz; kullanıcı manuel değer girebilir. Profil veya geçmiş storage'ının silinmesi Prompt Library kayıtlarını silmez. Service worker cache temizlense bile storage verisi tarayıcıda kalabilir.

## Güvenlik regresyonları

Her release'te no-network source scan, no-innerHTML scan, input bounds, import size, profile count, history count, no-auto-submit ve PWA asset kontrolleri çalıştırılmalıdır.
