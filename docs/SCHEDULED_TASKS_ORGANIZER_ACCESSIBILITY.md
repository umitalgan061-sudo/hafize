# Organizer — Erişilebilirlik Sözleşmesi

## Controls

Arama input'u erişilebilir isim taşır.

Ajan ve sıralama select'leri erişilebilir isim taşır.

Kayıtlı görünüm select'i erişilebilir isim taşır.

Zaman penceresi select'i erişilebilir isim taşır.

Toplu işlem düğmeleri gerçek `button` elementidir.

## Status

Görünür görev sayacı `role=status` ve `aria-live=polite` kullanır.

Başarı ve hata mesajları mevcut scheduled task status region'ında yayınlanır.

Görsel renk tek başına durum anlamı taşımaz.

## Detail dialog

Ayrıntı paneli `role=dialog` ve `aria-modal=true` taşır.

Dialog başlığı `aria-labelledby` ile ilişkilidir.

Escape ile kapatılabilir.

Kapatma kontrolü keyboard focus alabilir.

## Selection

Checkbox'lar gerçek input elementidir.

İptal edilemeyen görevlerin seçim kontrolü disabled olur.

Seçim durumu renk dışında checkbox state'i ile görünür.

## Focus

Filter controls normal Tab akışını kullanır.

Organizer özel focus trap uygulamaz.

Detay paneli kapanınca normal dialog kontrolüne geri dönülebilir.

## Mobile

Dar ekranlarda toolbar iki sütuna düşer.

Ayrıntı paneli alt-sheet gibi görünür.

Button metinleri taşma yaratmayacak şekilde wrap edilebilir.

## Reduced motion

Organizer zorunlu animasyon kullanmaz.

Native scroll davranışı reduced-motion tercihine bırakılır.

## Forced colors

Border ve yüzeyler Canvas/CanvasText fallback'i destekler.

Focus göstergesi sistem Highlight rengine düşebilir.

## Screen readers

Liste satırları mevcut role semantiğini korur.

Detail alanları `dl/dt/dd` ile anlamlı label/value düzeni kullanır.

Hata mesajları yalnızca ikon olarak sunulmaz.

## Keyboard safety

Global görev kısayolu input benzeri alanlarda engellenir.

Organizer kontrol kısayolu browser'ın text editing davranışını override etmez.

## Acceptance

Mouse olmadan arama yapılabilir.

Mouse olmadan görünüm seçilebilir.

Mouse olmadan detay açılıp Escape ile kapanabilir.

Mouse olmadan görev seçilebilir ve kullanıcı onayından sonra iptal edilebilir.
