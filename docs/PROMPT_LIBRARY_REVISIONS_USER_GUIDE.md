# İstem Sürüm Geçmişi — Kullanıcı Rehberi

## Geçmişi açma

İstem kartındaki `Geçmiş` düğmesi ilgili istemin geçmiş panelini açar. Panel yalnız o istemin revision kayıtlarını gösterir.

## Revision oluşması

Bir istem `Düzenle` ile açıldığında mevcut durum düzenleme öncesi snapshot olarak kaydedilir. Aynı içerik daha sonra tekrar düzenlense bile birebir aynı snapshot ikinci kez eklenmez.

## Geçmişi inceleme

Her kayıt; sıra, kayıt türü, tarih, başlık ve kısa içerik önizlemesi gösterir. `Karşılaştır` mevcut içerikle revision arasındaki temel karakter farkını ve güvenli önizlemeyi status alanında gösterir.

## Geri yükleme

`Geri yükle` seçilen sürümü ana prompt'a uygular. İşlemden hemen önce mevcut prompt `manual` revision olarak saklanır. Bu nedenle yanlış geri yükleme yeni bir geri dönüş noktası oluşturur.

## Neler korunur

Geri yükleme favori durumunu değiştirmez. Kullanım sayacı sıfırlanmaz veya eski revision'daki herhangi bir değere dönmez. Prompt'un ilk oluşturulma zamanı da korunur.

## Revision silme

Tek bir eski kayıt, `Sil` ile kaldırılabilir. Silme geri döndürülemez; uygulama kullanıcı onayı almadan bu işlemi yapmaz.

## Tüm geçmişi temizleme

`Geçmişi temizle` yalnız açık olan istemin revision kayıtlarını siler. Ana prompt kaydı, sohbet geçmişi ve kullanım istatistikleri etkilenmez.

## Export

`Geçmişi dışa aktar` açık istemin revision kayıtlarını JSON dosyası olarak cihazdan dışarı verir. Export bir upload değildir.

## Cihaz değişikliği

Revision geçmişi cihazın local storage alanındadır. Farklı tarayıcı veya cihazda otomatik görünmez. Kayıtların taşınması gereken durumlarda export alınmalıdır.

## Gizlilik

Revision metinleri, istem metni kadar hassas kabul edilmelidir. Ortak kullanılan bilgisayarda browser profilinin gizli tutulması önemlidir.

## Kurtarma davranışı

Storage yazılamıyorsa revision özelliği işlem sonucunu sessizce başarılı göstermemelidir. Kullanıcıya durum bildirimi verilir ve ana prompt akışı mümkün olduğunca korunur.

## Kısayol

Panel açıkken `Escape` ile kapatılabilir. Tab odağı dialog içinde döngü halinde tutulur.

## Ne zaman kullanmalı

Uzun prompt'larda büyük değişikliklerden önce geçmiş kaydı almak, tekrarlanan iş akışlarında farklı prompt sürümlerini korumak ve deneysel düzenlemeleri güvenle denemek için uygundur.
