# Kullanım İstatistikleri — SSS

## Kullanım sayısı nereye kaydediliyor?

Prompt Library kayıtları gibi kullanım sayısı da cihazın `localStorage` alanındaki `hafize.prompt-library.v1` kaydında tutulur. Ayrı analytics deposu yoktur.

## Hafize kullanım verisini sunucuya gönderiyor mu?

Hayır. Bu özellik yalnızca yerel storage okuması ve DOM güncellemesi yapar. Kullanım istatistiği için backend endpoint'i, beacon, WebSocket veya harici analytics çağrısı yoktur.

## “Kullanılan” ne demek?

`useCount` değeri sıfırdan büyük olan kayıt “Kullanılan” kabul edilir. Bir istemi `Kullan` ile composer alanına aktarmak çekirdek modül tarafından sayacı bir artırır.

## En çok kullanılan nasıl hesaplanıyor?

Kullanım sayısı yüksek olan kayıtlar önce gelir. Eşit kullanım değerlerinde daha güncel kayıt tercih edilir. Liste beş kayıtla sınırlandırılır.

## Son kullanılan nasıl hesaplanıyor?

Mevcut Prompt Library güncelleme zamanı kullanılır. `Kullan` akışı güncelleme zamanını değiştirdiği için son kullanım adayları güncel sıralamaya yansır.

## Eski kayıtlarda useCount yoksa?

Eksik veya geçersiz değer sıfır kabul edilir. Eski kayıtların çalışması için migrasyon dosyası gerekmez.

## Bozuk localStorage ne yapar?

İstatistik paneli boş güvenli durumuna geçer. Prompt Library'nin diğer bölümleri yalnızca bu nedenle silinmez veya backend'e taşınmaz.

## Panel neden görünmüyor?

Usage modülü Prompt Library kartı oluşmadan mount olmaz. Uygulama sayfasında Prompt Library kartının bulunması ve mevcut scriptin yüklenmesi gerekir.

## Paneli nasıl gizlerim?

`Gizle` düğmesi panel gövdesini kapatır ve `aria-expanded` durumunu günceller. Tekrar `Göster` ile açılabilir.

## Mobilde ne değişir?

İstatistik kutuları dar ekranlarda tek kolona iner. En çok kullanılan satırları yatay taşma üretmeden kısaltılmış başlıkla gösterilir.

## PWA neden önemli?

Usage scripti shell cache'e dahil edilerek Prompt Library kartının çevrimdışı açılışında eksik statik varlık bırakılmaması amaçlanır.

## Usage modülü geri alınırsa kullanım sayıları silinir mi?

Hayır. Panelin kaldırılması storage'daki Prompt Library kaydını otomatik silmez. Geri alma yalnızca kullanım yüzeyini kaldırmalıdır.

## Destek ekibi kullanım sayılarını sıfırlamalı mı?

Otomatik destek işlemi olarak sıfırlama yapılmamalıdır. Bu veri kullanıcının yerel kütüphane tercihidir. Veri silme ancak açık kullanıcı işlemi ve ilgili ürün akışıyla yapılmalıdır.

## Özellik performansı etkiler mi?

Panel en fazla mevcut Prompt Library kayıt sınırı kadar veriyi değerlendirir ve yalnızca ilk beş sonucu listeler. MutationObserver refresh'leri kısa bir timer ile gruplanır.

## Güvenlik açısından ana karar nedir?

Kullanıcı kaynaklı başlıklar DOM `textContent` ile yerleştirilir. HTML yorumlama yapılmaz. Bu yüzey, prompt içeriğini uzaktaki bir servise taşımayacak şekilde tasarlanmıştır.

## Hangi testler kritik?

Usage contracts, data-shape, lifecycle, accessibility, PWA ve regression testleri birlikte değerlendirilmelidir. Ayrıca gerçek tarayıcıda `Kullan → sayaç artışı → panel yenilenmesi` smoke akışı görülmelidir.
