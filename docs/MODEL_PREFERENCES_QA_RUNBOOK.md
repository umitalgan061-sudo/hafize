# Model ve Ajan Tercihleri QA Runbook

## Test ortamı

Temiz bir tarayıcı profiliyle başlamak önerilir.
Uygulama normal development veya production güvenlik koşullarıyla açılabilir.
Model ve ajan endpointlerinin normal şekilde yanıt verdiği ortam tercih edilir.

## A. İlk açılış

1. Uygulamayı aç.
2. Model select alanının dolmasını bekle.
3. Agent select alanının dolmasını bekle.
4. Tercihler düğmesinin görünür olduğunu kontrol et.
5. Tercihler panelini aç.
6. Boş profil mesajını kontrol et.

Beklenen: sohbet alanı normal çalışır ve tercihler paneli ayrı bir yardımcı yüzeydir.

## B. Son seçimi hatırlama

1. Bir model seç.
2. Bir ajan seç.
3. Tool mode durumunu gözden geçir.
4. Sayfayı yenile.
5. Model ve ajan seçeneklerini kontrol et.

Beklenen: hâlâ geçerli olan son model ve ajan seçimi geri gelir.
Geçersiz hale gelen seçim zorla uygulanmaz.

## C. Profil oluşturma

1. Model seç.
2. Ajan seç.
3. Araç modunu belirle.
4. Tercihler panelini aç.
5. Mevcut seçimi profil olarak kaydet.
6. Profil adını yaz.
7. Profil satırını kontrol et.

Beklenen: profil altı kayıt sınırına tabidir ve model, ajan ve araç durumu görünür.

## D. Profil uygulama

1. Başka bir model seç.
2. Profil panelini aç.
3. Kaydedilmiş profilde Uygula seç.
4. Composer state'ini gözle.
5. Sohbet geçmişini kontrol et.

Beklenen: seçimler profil değerlerine döner.
Yeni kullanıcı mesajı gönderilmez.
Conversation mesajları değiştirilmez.

## E. Adlandırma

1. Profil satırında Adlandır seç.
2. Yeni isim gir.
3. Paneli yenile.
4. Profil ID'sinin değişmediğini kontrol et.

Beklenen: yalnız isim değişir.
Model, ajan, araç modu ve usage count korunur.

## F. Çoğaltma

1. Profilde Çoğalt seç.
2. Yeni satırı kontrol et.
3. Kullanım sayısını kontrol et.
4. İki profilin ID'sini karşılaştır.

Beklenen: yeni ID üretilir ve yeni profilin kullanım sayısı sıfırdır.

## G. Import önizleme

1. Geçerli bir preference JSON dosyası hazırla.
2. Aynı ID içeren bir profile dosyada yer ver.
3. Bir geçersiz kayıt ekle.
4. İçe aktar seç.
5. Boyut kontrolünün geçildiğini doğrula.
6. Önizleme özetini gözle.
7. İptal seç.
8. Profil listesinin değişmediğini kontrol et.
9. Aynı dosyayı yeniden seç.
10. Onayla.
11. Yeni ID ve reddedilen kayıt sayısını kontrol et.

Beklenen: onaydan önce storage değişmez.
Collision overwrite yapmaz.

## H. Export

1. En az bir profil oluştur.
2. Dışa aktar seç.
3. JSON dosyasını aç.
4. source ve version alanlarını kontrol et.
5. Secret alanı bulunmadığını kontrol et.

Beklenen: export yalnız preference state taşır.

## I. Reset

1. En az bir profil ve son seçim oluştur.
2. Tercihleri sıfırla seç.
3. Onay verme ve sonucu kontrol et.
4. Yeniden dene ve onay ver.

Beklenen: reset yalnız preference state'i temizler.
Conversation history korunur.

## J. Klavye

1. Panel kapalıyken Ctrl/⌘+Shift+M uygula.
2. Panelin açıldığını kontrol et.
3. Escape uygula.
4. Panelin kapandığını kontrol et.
5. Paneli tekrar aç.
6. Tab tuşuyla son öğeden devam et.
7. Shift+Tab ile ters yönde dolaş.

Beklenen: focus panel dışına kaçmaz ve kapanınca tetikleyiciye döner.

## K. Cross-tab

1. Aynı origin'de iki sekme aç.
2. Bir sekmede profil ekle veya sil.
3. Diğer sekmede panel açıksa yenilenmesini gözle.

Beklenen: storage event yalnız preference key için ele alınır.

## L. Network sınırı

Browser network panelini aç.
Profil oluştur, uygula, adlandır ve export et.
Preference eylemleri sırasında yeni preference endpoint'i aranır.

Beklenen: model preference modülünün kendisi fetch, XHR veya WebSocket başlatmaz.

## M. PWA

Service worker yeni sürümle aktifken uygulamayı yeniden yükle.
Offline koşulunda shell asset'lerinin erişilebilirliğini kontrol et.

Beklenen: model-preferences.css shell cache içinde bulunur.

## N. Release sonucu

Aşağıdaki kontrollerin raporu kaydedilir:
- typed unit test
- model-preferences contract
- security
- accessibility
- PWA
- lifecycle
- import/export
- selection restore
- profile actions
- import preview
- cross-tab
- smoke

Bir kontrol başarısızsa merge öncesi düzeltilmelidir.
