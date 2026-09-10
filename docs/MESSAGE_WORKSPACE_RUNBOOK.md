# Mesaj Çalışma Alanı Operasyon Runbook'u

## Yayın öncesi

`public/index.html` içindeki üç Message Workspace asset'inin doğru sırada olduğunu kontrol et.

Policy script'i UI script'inden önce gelmelidir.

`public/sw-policy.js` aynı üç asset'i shell listesinde içermelidir.

Shell cache revision'ının current değerinin değiştiğini doğrula.

Yeni test dosyalarının `scripts/` altında olduğunu doğrula.

## Yerel testler

Önce syntax kontrolü çalıştırılır.

Ardından policy testi çalıştırılır.

Sonra source contract testi çalıştırılır.

Adversarial test çalıştırılır.

Compatibility testi çalıştırılır.

Keyboard testi çalıştırılır.

Regression testi çalıştırılır.

Tam `npm run check` son adımdır.

Testlerden biri başarısızsa başarısız sonuç PR açıklamasına yazılır.

## Manuel smoke

Uygulama açıldığında mevcut sohbet geçmişi görünmelidir.

Mevcut konuşmalardaki her mesaj altında yeni action bar görünmelidir.

Yeni sohbette action bar ilk mesaj oluştuktan sonra görünmelidir.

Kaydet düğmesi yıldız durumunu değiştirmelidir.

Olumlu geri bildirim seçilebilir ve tekrar tıklanarak kaldırılabilir.

Olumsuz geri bildirim olumlu geri bildirimin yerine geçmelidir.

Not düğmesi prompt ile not eklemelidir.

Etiket düğmesi virgülle ayrılmış etiketleri kaydetmelidir.

Panel yalnız kayıtlı metadata bulunan mesajları listelemelidir.

Arama mesaj metninde eşleşme bulmalıdır.

Arama notta eşleşme bulmalıdır.

Arama etikette eşleşme bulmalıdır.

Filtreler sonuç kümesini değiştirmelidir.

Sıralama seçenekleri sonuçları değiştirmelidir.

Mesaja git düğmesi sohbet içindeki gerçek mesajı odaklamalıdır.

JSON export tarayıcı indirmesi başlatmalıdır.

## Cross-tab smoke

İki aynı-origin sekme açılır.

Bir sekmede mesaj kaydedilir.

Diğer sekmenin paneli güncellenmelidir.

Bir sekmede seçim değiştirildiğinde diğer sekmenin seçim durumu `storage` üzerinden okunabilmelidir.

## Storage bozulması

`hafize.message-workspace.v1` geçersiz JSON yapılır.

Sayfa yeniden yüklenir.

Uygulama sohbet geçmişini kaybetmemelidir.

Mesaj paneli boş veya güvenli varsayılanla açılmalıdır.

Aynı işlem `state` anahtarında da denenebilir.

## Quota gözlemi

240 aktif metadata kaydının üstüne yeni kayıt eklemek gerekir.

En yeni güncellemelerin bounded liste içinde kaldığı doğrulanır.

100'den fazla export seçiminin 100 kayıtla sınırlandığı doğrulanır.

Not 600 karakterde kesilmelidir.

Etiket 24 karakterde kesilmelidir.

Etiket listesi 8 öğede kesilmelidir.

## Erişilebilirlik

Klavye ile action button'lara ulaşılmalıdır.

`aria-label` her action button'da bulunmalıdır.

Saved ve feedback düğmeleri `aria-pressed` değerini güncellemelidir.

Panel durum satırı `role=status` taşımalıdır.

Güçlendirilmiş renk teması için forced-colors görünümü kontrol edilir.

Reduced-motion ortamında odak animasyonu olmamalıdır.

Dar ekranda panel taşmamalıdır.

## Geri alma

Feature dosyaları kaldırılır.

Index asset referansları çıkarılır.

Service worker asset referansları çıkarılır.

README ve doküman değişiklikleri geri alınır.

Mevcut `hafize.conversations.v1` verisine dokunulmaz.

Tarayıcıda kalan `hafize.message-workspace.v1` anahtarı etkisiz metadata olarak temizlenebilir.
