# Zamanlanmış Görevler — Erişilebilirlik Sözleşmesi

## Dialog

Görevler çalışma alanı modal dialog rolü kullanır.

Dialog visible olduğunda programatik olarak erişilebilir bir başlık taşır.

Kapanış Escape tuşu ile yapılabilir.

Backdrop tıklaması desteklendiğinde modalı kapatabilir; bunun güvenlik açısından kritik bir işlem olmadığı için ek onay gerektirmez.

## Focus

Panel açıldığında ilk kullanılabilir kapatma kontrolüne focus verilir.

Panel kapanırken mümkünse önceki focus elementine dönülür.

Klavye kullanıcıları focus ring'i görebilmelidir.

Focus kaybolduğunda kullanıcı paneli tekrar açmak zorunda kalmadan DOM içinde gezinmeye devam edebilmelidir.

## Form labels

Ajan select erişilebilir isim taşır.

Task textarea erişilebilir isim taşır.

Datetime input erişilebilir isim taşır.

Attempts select erişilebilir isim taşır.

Status filter erişilebilir isim taşır.

## Status announcements

Başarılı planlama status region üzerinden duyurulur.

İptal sonucu status region üzerinden duyurulur.

Kimlik doğrulama hatası status region üzerinden duyurulur.

Servis erişim hatası status region üzerinden duyurulur.

Liste yükleme durumu live region içinde görülebilir.

## Status badges

Renk tek başına anlam taşımaz.

Status label metin olarak yazılır.

Unknown status `Bilinmiyor` fallback'iyle metin olarak kalır.

## Keyboard shortcut

Ctrl+Shift+T veya Meta+Shift+T görevler panelini açar.

Global shortcut input, textarea, select veya contenteditable içindeyken tetiklenmez.

Bu nedenle kullanıcının task metni yazarken yanlışlıkla modal açması önlenir.

## Keyboard navigation

Standart Tab navigasyonu korunur.

Escape dialog'u kapatır.

Button elementleri gerçek button olarak oluşturulur.

Select elementleri native keyboard interaction kullanır.

Datetime input browser native control davranışına bırakılır.

## Mobile

Dar ekranlarda modal alt-sheet benzeri düzene geçer.

Form alanları tek sütuna iner.

Görev satır başlıkları dikey yerleşir.

Status badge taşmayacak şekilde başlığın altına geçebilir.

## Reduced motion

Animasyon eklenmemiş olsa dahi scroll davranışı reduced-motion kullanıcıları için otomatik davranışa bırakılır.

## Forced colors

Border, background ve text renkleri sistem Canvas/CanvasText renklerine düşebilir.

Focus outline sistem Highlight rengi kullanacak şekilde var olan odak görünürlüğünü korur.

## Screen reader semantics

Liste `role=list`, öğeler `role=listitem` semantiğine sahiptir.

Status region `aria-live=polite` ile user-facing updates yayınlar.

Dialog başlığı `aria-labelledby` ile ilişkilendirilir.

## Error messages

Hata metni yalnızca ikonla gösterilmez.

Kullanıcıya açık Türkçe açıklama sunulur.

Trace ID yardımcı bilgi olarak gösterilir; status semantiğinin yerine geçmez.

## Non-goals

Özel ekran okuyucu widget'i eklenmez.

ARIA role'ları native semantic elementlerin yerine gereksiz yere çoğaltılmaz.

Keyboard shortcut mevcut browser veya OS kısayollarını override edecek şekilde agresif kullanılmaz.

## Acceptance

Mouse olmadan görev oluşturulabilmelidir.

Mouse olmadan görev iptal edilebilmelidir.

Mouse olmadan filtre değiştirilebilmelidir.

Modal Escape ile kapatılabilmelidir.

Status değişiklikleri görsel ve metinsel olarak anlaşılmalıdır.
