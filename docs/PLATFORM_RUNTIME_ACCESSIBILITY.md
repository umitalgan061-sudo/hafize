# Platform Runtime Accessibility

## Focus

Platform dashboard açıldığında kapatma butonu focus alır. Kapatıldığında focus tetikleyiciye döner.

## Keyboard

Escape açık paneli kapatır. Tab sırası tarayıcı doğal sırasını izler. Runtime status düğmesi `aria-expanded` ve `aria-controls` kullanır.

## Screen readers

Panel `dialog` rolüne, başlığa ve açıklamaya sahiptir. Durum metni kısa tutulur. Accessibility live region gerektiğinde `role=status` kullanır.

## Reduced motion

`prefers-reduced-motion: reduce` aktif olduğunda panel için animasyon beklentisi yoktur. Runtime logic timing'e bağlı değildir.

## Forced colors

Yüksek kontrast ve forced colors ortamında panel ve section border'ları sistem renklerine bırakılır.

## Contrast

Durum renkleri tek iletişim kanalı olmamalıdır; metin değerleri de aynı state'i açıkça belirtir.

## Mobile

700px altında grid tek kolona düşer. Panel viewport genişliğini aşmamalıdır.

## Failure behavior

Accessibility API bulunmadığında temel HTML kontrolü çalışmaya devam eder. Runtime accessibility helper'ı feature failure sebebi değildir.

## QA

Keyboard-only akış, screen reader label kontrolü, forced-colors görünümü ve reduced-motion davranışı release öncesi kontrol edilmelidir.
