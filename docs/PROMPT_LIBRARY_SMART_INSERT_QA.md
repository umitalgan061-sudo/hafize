# Smart Insert — QA Planı

## Temel akış

Değişkenli prompt açılır, modal görünür, değişken alanları oluşur, önizleme güncellenir ve Composer’a aktar düğmesi yalnızca textarea değerini değiştirir. Gönderim kullanıcının ayrıca yaptığı bir eylemdir.

## Profil akışı

Yeni profil adı sınırlandırılır. Aynı isim ikinci kez kullanılırsa yeni kayıt yerine mevcut profil güncellenir. Profil seçildiğinde eşleşen değişkenler alanlara gelir. Profil silme onay gerektirir. Profil favorisi listede öncelik kazanır.

## Yedekleme

Geçerli JSON içe aktarılır, hatalı kayıtlar normalize edilir, 300 KB üzerindeki dosya reddedilir. Dışa aktarma JSON dosyası oluşturur ve object URL'i revoke eder.

## Geçmiş

Başarılı Smart Insert kullanımı prompt ID ve kısa başlık ile geçmişe yazılır. Değişken değerleri ve prompt body geçmişe yazılmaz. Aynı prompt tekrar kullanıldığında tek kayıt güncellenir. Tek kayıt kaldırma ve tüm geçmişi temizleme desteklenir.

## Öneriler

Profildeki değişken isimleri ile istem değişkenleri eşleştiğinde puan yükselir. Beşten fazla öneri gösterilmez. Eksik profil değerleri kullanıcıya açıkça işaretlenir.

## Kısayollar

Ctrl/Cmd+Shift+I ilk Smart Insert düğmesini açar. Ctrl/Cmd+Shift+L profil merkezi aramasına odaklanır. Ctrl/Cmd+Shift+H geçmiş bölümünü gösterip gizler. Textarea veya input içinde bu kısayollar yanlışlıkla tetiklenmez.

## Erişilebilirlik

Dialog role/aria-modal/aria-labelledby ile tanımlıdır. Tab odak döngüsü dialog içinde kalır. Escape kapatır ve açan düğmeye odak geri döner. Dinamik metinler textContent ile oluşturulur. Mobil ve forced-colors CSS kuralları bulunur.

## PWA

Yeni JS ve CSS asset'leri shell cache'e dahil edilir. Cache sürümü artırılır. API yolları network-only kalır ve Smart Insert modülleri network üzerinden veri göndermez.

## Regresyon

Mevcut Prompt Library CRUD, import/export, arama, favoriler ve usage insights davranışları değişmemelidir. Smart Insert modülleri yalnızca kendi sabit ID/class alanlarını eklemelidir.

## Hata senaryoları

Bozuk JSON, storage yazma hatası, eksik composer, eksik değişken, fazla değer, fazla profil ve silme iptali ayrı test edilmelidir. Her durumda uygulamanın chat composer'ı kullanılabilir kalmalıdır.
