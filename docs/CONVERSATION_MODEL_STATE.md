# Sohbet bazlı model seçimi

Hafize model seçimini artık yalnız geçici bir dropdown değeri olarak değil, sohbetin yerel kullanıcı tercihinin bir parçası olarak ele alır.

## Davranış

- Aktif sohbet için seçilen model `hafize.conversations.v1` kaydındaki `modelId` alanında tutulur.
- Saklanan değer yalnız o anda `/api/models` tarafından oluşturulmuş gerçek bir option ile birebir eşleşiyorsa geri yüklenir.
- Eski sohbetlerde `modelId` yoksa mevcut geçerli seçim kontrollü olarak o sohbete taşınır.
- Artık model listesinde bulunmayan eski bir kimlik çalıştırılmaz; mevcut geçerli seçim varsa onunla migrate edilir.
- Sohbet değiştirildiğinde ilgili sohbetin modeli geri yüklenir.
- Aktif yanıt boyunca model seçici kilitlenir; yanıt bittiğinde önceki disabled durumu geri yüklenir.

## Güvenlik sınırı

Bu katman yeni ağ çağrısı yapmaz ve model listesini kendisi üretmez. Yalnız mevcut `#modelSelect` option allowlist'ini kullanır. Token, credential, prompt veya tool sonucu saklamaz. Provider/tool authorization backend'de default-deny kalır ve `local:` model + tool güvenlik sınırı `model-selector-enhancement.js` tarafından ayrıca korunur.

## Geri alma

`conversation-model-state.js` loader ve PWA shell listesinden çıkarılıp cache sürümü geri alınabilir. Mevcut konuşmalardaki ek `modelId` alanı eski istemci tarafından yok sayılır; mesaj geçmişi veya diğer sohbet alanları silinmez.
