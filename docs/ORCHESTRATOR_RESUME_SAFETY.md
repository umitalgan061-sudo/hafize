# Kesintiye dayanıklı görevler

Plan motoru her dış araç çağrısından önce ve sonra durumunu SQLite'a kaydeder. Planlayıcının checkpoint seçeneği bu güvenlik kaydını devre dışı bırakmaz. Başarılı adımlar tekrar çalıştırılmaz; yalnız açıkça izin verilen salt-okunur araçlar kesinti halinde otomatik tekrar denenebilir. Belirsiz dış yazma sonuçları `mutation_reconciliation_required` ile durur; commit, PR veya servis kaydı doğrulanmadan tekrarlanmaz.

Sürdürme çağrısında model kendi kendine onay veremez; gerçek onay kanalı ve araç denetimleri geçerlidir. Paralel çağrılar kalan bütçeyi aşamaz. Başarısız zorunlu adımlar başarı olarak raporlanmaz. Artırılan bütçe sunucu üst sınırlarını aşmaz.

Bu garanti yalnız `orchestrator_run`/`orchestrator_resume` ile yönetilen görevler ve mevcut veritabanı yaşam süresi içindir. Render ücretsiz hizmetin geçici diski silinir veya yeniden dağıtılırsa SQLite kayıtları korunmayabilir. Normal sohbet ajanının tüm araç çağrıları için kalıcı yeniden başlatma henüz uygulanmış değildir. Bu özellik yeni bir arka plan servisi veya otomatik yazma/merge/deploy yetkisi vermez.

Geri dönüş: ilgili PR'ı revert et. Onay korumalarını gevşetme.
