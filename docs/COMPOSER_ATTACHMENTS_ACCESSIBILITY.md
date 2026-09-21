# Composer Ekleri — Erişilebilirlik

## Semantik

Panel section olarak oluşturulur ve başlık ile aria-labelledby üzerinden ilişkilidir. Durum alanı role=status ve aria-live=polite kullanır.

Dosya satırı role=listitem ile list konteynerine bağlıdır. Checkbox dosyanın dahil edilmesini açıklar; Sil düğmesi etiketi dosya adıyla ilişkilidir.

## Klavye

- Ctrl / Command + Shift + A paneli açar veya kapatır.
- Escape paneli kapatır ve Dosya ekle düğmesine odak verir.
- Sürükle-bırak alanı role=button ve tabIndex=0 ile klavyeden kullanılabilir.
- Enter veya Space dosya seçiciyi açar.
- Preview details/summary ile gezilebilir.
- Range inputları Tab sırasına dahildir.

## Görsel erişilebilirlik

focus-visible göstergeleri korunur. reduced-motion altında özel hareket azaltılır. forced-colors altında border ve focus sistem renklerine döner.

## Canlı mesajlar

Dosya kabulü, dosya reddi, kapasite hatası ve mesaja ekleme sonucu status alanında kısa metinle bildirilir. Hata mesajları dosya gövdesini tekrar etmez.

## Odak davranışı

Panel açıldığında mevcut odak bozulmaz. Panel kapanışında tetikleyici düğmeye focus geri verilir.

## Screen reader senaryosu

1. Dosya ekle düğmesine ulaş.
2. Paneli aç.
3. Dosya seç.
4. Status mesajını dinle.
5. Checkbox ile dahil etme durumunu değiştir.
6. Başlangıç ve bitiş satırlarını ayarla.
7. Preview'ı aç.
8. Mesaja ekle düğmesini çalıştır.
9. Composer'a dön ve metni incele.

No-submit davranışı ayrıca korunur; erişilebilirlik akışı gönderimi kendi başına başlatmaz.