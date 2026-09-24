# Bağlantılar erişilebilirlik

## Semantik

Her provider paneli section olarak oluşturulur ve aria-labelledby ile başlığına bağlanır.

## Durum metni

Durumlar yalnız renk ile ifade edilmez. “Bağlı”, “Hazır”, “Oturum gerekli” ve “Devre dışı” metin olarak görünür.

## Klavye

Tüm etkileşimler native button kullanır. Sekme sırası doğal DOM sırasını izler.

## Focus

Düğmeler focus-visible ile görünür odak halkasına sahiptir.

## Gizle/göster

Panel toggle için aria-expanded ve aria-controls birlikte kullanılır.

## Mobil

700px altında provider durum satırları tek kolona düşer. Butonlar tam satır genişliğine yaklaşır.

## Reduced motion

Hub animasyon gerektirmez. Üst seviye transition kullanımı azaltılmış hareket tercihiyle çelişmez.

## Forced colors

Kenarlık, metin ve odak göstergeleri sistem renkleriyle görünür kalır.

## Screen reader

Durum metni açık ve kısa tutulur. Raw HTTP status veya exception adı kullanıcıya zorunlu tutulmaz.

## Hata

Timeout ve network hatası status metniyle belirtilir.

## QA

Klavye ile refresh, toggle ve workspace geçişi tamamlanabilir olmalıdır.

## DoD

- focus visible
- native buttons
- aria-expanded
- aria-controls
- text status
- forced-colors
- mobile layout
