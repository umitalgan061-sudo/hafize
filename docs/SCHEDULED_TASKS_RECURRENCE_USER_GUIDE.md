# Kullanıcı Rehberi — Tekrarlanan Görevler

## Yeni görev
Görevler panelini aç ve görev metnini yaz.
Ajanı seç.
Çalıştırma zamanını belirle.
Maksimum deneme sayısını seç.

## Tekrar seçimi
Tek sefer bir kez çalışır.
Günlük her belirlenen gün aralığında çalışır.
Haftalık bir veya daha fazla haftanın gününde çalışır.
Aylık ayın seçilen gününde çalışır.

## Haftalık
Birden fazla gün seçebilirsin.
Örneğin Pazartesi ve Cuma seçimi haftada iki oluşum üretir.
Aralık alanı 2 seçilirse seçilen günler iki haftada bir tekrarlanır.

## Aylık
Ayın 1–31 arası günü seçilir.
31 seçilip sonraki ayda 31 yoksa son geçerli gün kullanılır.
Bu nedenle Ocak 31 planı Şubat sonunda, sonra Mart 31 tarihinde devam eder.

## Geçmiş
Tekrarlanan satırındaki Geçmişi göster eylemi son koşuları açar.
Tamamlanan ve başarısız oluşumlar ayrı ayrı görünür.
Hata yalnız güvenli kod olarak gösterilir.

## İptal
Planlanan seri iptal edilirse gelecek oluşum durur.
Daha önceki geçmiş silinmez.

## Preset
Görev presetleri ile aynı görev ayarını tekrar doldurmadan forma aktarabilirsin.
Preset kullanmak sunucuya istek göndermez.
Son planlama için Görevi planla düğmesine ayrıca basılır.

## Yedek
Presetleri JSON olarak dışa aktarabilir ve başka cihazda içe aktarabilirsin.
Geçerli dosya sınırı 256 KB'dir.

## Gizlilik
Recurring task kaydı sunucu tarafında authenticated owner sınırındadır.
Presetler ve geçmişin özet alanları credential veya görev çıktısı taşımaz.
