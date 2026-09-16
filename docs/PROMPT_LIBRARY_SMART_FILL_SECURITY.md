# Smart Fill Güvenlik Modeli

## 1. Sınır

Smart Fill yalnızca tarayıcı tarafındaki Prompt Library verisini işler.

Ana prompt kaynağı `hafize.prompt-library.v1` anahtarıdır.

Son değerler ayrı `hafize.prompt-library.fill.v1` anahtarında tutulur.

Named preset verileri ayrı `hafize.prompt-library.fill.presets.v1` anahtarında tutulur.

Hiçbir secret bu anahtarların içine yazılmaz.

NVIDIA credential'ları bu modül tarafından okunmaz.

OAuth token'ları bu modül tarafından okunmaz.

Cookie değerleri bu modül tarafından okunmaz.

Session token'ları bu modül tarafından okunmaz.

## 2. Veri minimizasyonu

Varsayılan davranış son girilen değerleri kalıcı olarak saklamaz.

Hatırlama seçeneği açıkça işaretlenmelidir.

Hatırlanan tek değer değişken alanının metnidir.

Her değer 1000 karakter ile sınırlıdır.

Her istem için hatırlanan değişken sayısı 12 ile sınırlıdır.

Hatırlama sözlüğü istem başına tek kayıt şeklinde tutulur.

En fazla 30 istem için hatırlama verisi tutulur.

Preset başına en fazla 8 kayıt tutulur.

Preset adı 48 karakter ile sınırlıdır.

Preset değeri 1000 karakter ile sınırlıdır.

Preset değişken sayısı 12 ile sınırlıdır.

## 3. DOM güvenliği

Prompt başlığı DOM'a textContent ile yazılır.

Değişken adı DOM'a textContent ile yazılır.

Preview plain-text `pre` düğümüdür.

Kullanıcı değeri HTML olarak yorumlanmaz.

`innerHTML` ataması yapılmaz.

`outerHTML` kullanılmaz.

eval kullanılmaz.

`new Function` kullanılmaz.

Inline script üretilmez.

Inline event attribute üretilmez.

Preset adı DOM'a metin düğümü olarak eklenir.

Preset değeri form kontrolünün value alanında tutulur.

## 4. Ağ sınırı

Smart Fill doğrudan fetch çağrısı yapmaz.

XMLHttpRequest kullanılmaz.

Beacon API kullanılmaz.

WebSocket açılmaz.

EventSource açılmaz.

Analytics endpoint'i çağrılmaz.

Remote logging endpoint'i çağrılmaz.

Smart Fill sonucu composer'a yazılır ve mevcut uygulamanın normal gönderim akışı kullanılır.

Dolayısıyla ağ gönderimi Smart Fill'in kendi sorumluluğu değildir.

## 5. Storage hataları

JSON parse hatasında boş nesne kullanılır.

Storage erişim hatası açılan formu bozmaz.

Storage yazma hatası akıllı doldurmayı başarısız saymaz.

Hatırlama başarısız olsa bile composer'a açıkça istenen metin yazılabilir.

Preset kaydı başarısızsa mevcut alanlar silinmez.

Preset silme başarısızlığı açık formu kapatmaz.

Bozuk bir kayıt dizisi filtrelenir.

Beklenmeyen primitive değerler atlanır.

## 6. Kullanım sayacı

Kullanım sayacı yalnızca `Mesaja aktar` işleminden sonra artırılır.

Form açmak kullanım sayısını artırmaz.

Preview güncellemek kullanım sayısını artırmaz.

Preset seçmek kullanım sayısını artırmaz.

Kapatmak kullanım sayısını artırmaz.

İptal etmek kullanım sayısını artırmaz.

Composer yoksa kullanım sayacı artırılmaz.

Prompt storage kaydında istem bulunmuyorsa kullanım sayacı artırılmaz.

## 7. Prompt kimliği

Prompt id değeri satır dataset'inden alınır.

Storage'dan yeniden bulunur.

DOM başlığı prompt kimliği olarak kullanılmaz.

Prompt başlığı değişse bile doğru id ile kayıt bulunur.

Eksik id ile işlem yapılmaz.

## 8. Preset güvenliği

Preset verisi prompt gövdesinden bağımsız tutulur.

Preset export mekanizması varsa yalnızca prompt presetlerini taşır.

Presetler prompt JSON export'una zorunlu olarak eklenmez.

Presetler başka prompt id'sine otomatik bağlanmaz.

Preset adları case-insensitive çakışmayı kontrol eder.

Aynı isimde yeni kayıt mevcut kaydı günceller.

Toplam preset sayısı sabittir.

## 9. Erişilebilirlik güvenliği

Dialog bir başlık ile etiketlenir.

Her input erişilebilir bir ada sahiptir.

Kapatma düğmesi klavyeyle erişilebilir.

Vazgeç düğmesi klavyeyle erişilebilir.

Aktarım düğmesi klavyeyle erişilebilir.

Escape kapatma davranışı korunur.

Focus ilk alana taşınır.

Forced-colors görünümü sistem sınırlarını yok saymaz.

Reduced-motion tercihi animasyonu kapatır.

## 10. PWA

Smart Fill CSS shell asset'i olarak kullanılabilir.

Smart Fill JS shell asset'i olarak kullanılabilir.

Preset JS shell asset'i olarak kullanılabilir.

API istekleri cache kapsamına alınmaz.

Offline uygulama davranışında prompt verisi cihaz storage'ından gelir.

## 11. Threat cases

Kullanıcı prompt içine HTML yazabilir; preview bunu HTML çalıştırmadan gösterir.

Kullanıcı değişken değerine script metni yazabilir; değer text olarak kalır.

Kullanıcı preset adına HTML yazabilir; değer text olarak kalır.

Storage'a devasa JSON yazılabilir; modül sınırlı veri okur.

Bozuk JSON yazılabilir; boş güvenli fallback kullanılır.

Storage erişimi exception atabilir; çağrı catch edilir.

Dialog DOM dışından kaldırılabilir; lifecycle observer tekrar hata üretmemelidir.

Composer DOM'dan kaldırılabilir; submit başarısız güvenli dönüş yapmalıdır.

## 12. Review checklist

[ ] Secret okunmuyor.

[ ] Token okunmuyor.

[ ] Ağ çağrısı yapılmıyor.

[ ] HTML injection yüzeyi yok.

[ ] Değer limitleri uygulanıyor.

[ ] Preset sayısı bounded.

[ ] Storage anahtarları ayrık.

[ ] Kullanıcı onayı olmadan auto-send yok.

[ ] Kullanım sayacı doğru aşamada güncelleniyor.

[ ] Dialog klavyeyle kullanılabiliyor.

[ ] Reduced-motion destekleniyor.

[ ] Forced-colors destekleniyor.

[ ] PWA asset listesi güncel.

## 13. Geri alma

Smart Fill dosyaları kaldırılır.

Preset dosyaları kaldırılır.

Prompt Library çekirdeği değişmeden kalır.

Ana prompt verisi korunur.

Usage insights korunur.

Smart fill preference key gelecekte temizlenebilir.

Preset key gelecekte temizlenebilir.

Rollback ana sohbet gönderim davranışını değiştirmez.
