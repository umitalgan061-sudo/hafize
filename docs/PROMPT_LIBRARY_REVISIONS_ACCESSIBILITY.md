# Revision History Accessibility

## Dialog semantiği

Revision paneli `role=dialog` ve `aria-modal=true` kullanır. Başlık `aria-labelledby` üzerinden ilişkilendirilir.

## Focus

Panel açılırken odak kapatma düğmesine alınır. Kapanırken önceki aktif elemana geri döndürülür.

## Keyboard

`Escape` paneli kapatır. `Tab` ve `Shift+Tab` paneldeki düğmeler arasında döngü oluşturur. Fare kullanımı zorunlu değildir.

## Status

Kullanıcı işlemlerinin sonucu `role=status` ve `aria-live=polite` ile duyurulur.

## Text rendering

Başlık, revision gövdesi, tarih ve durum metinleri DOM text node olarak eklenir. İçerik HTML olarak parse edilmez.

## High contrast

Panel ve revision satırları forced-colors senaryosunda Canvas/CanvasText uyumlu sınırlar ve Highlight focus görünümü kullanır.

## Responsive

700px altında modal padding ve footer davranışı küçülür. Revision preview taşan metni scroll ile gösterir.

## Reduced motion

Panel scroll davranışı reduced-motion tercihinde animasyonsuzdur.

## Screen reader

Revision listesi `role=list` ve kayıtları `role=listitem` ile işaretlenir. Butonların action label'ları açık Türkçe metindir.

## Test notları

A11y testleri role, label, focus trap, Escape ve text-only DOM kullanımını source-contract düzeyinde doğrular. Gerçek ekran okuyucu testi release öncesi manuel QA kapsamında yapılır.
