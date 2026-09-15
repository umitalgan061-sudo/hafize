# Final Revision Release Check

## Feature

Revision History local-only olarak Prompt Library'ye eklenmiştir.

## User paths

Geçmiş açma, manuel checkpoint, edit öncesi snapshot, compare, restore, tek revision silme, history clear ve export akışları tanımlıdır.

## Data safety

Restore sırasında prompt identity, favorite, useCount ve createdAt korunur. Current state restore öncesinde manual snapshot olur.

## Storage safety

Revision storage bağımsız key kullanır. Parse ve write hataları catch edilir. Bounded retention uygulanır.

## UI safety

Dialog semantics vardır. User metni textContent/pre ile render edilir. HTML string interpolation kullanılmaz.

## Interaction safety

Restore, revision silme ve history clear confirmation gerektirir. Export açık kullanıcı eylemidir.

## Keyboard

Escape kapanır. Tab ve Shift+Tab focus trap oluşturur. Kapanırken previous focus geri gelir.

## PWA

Revision scripti shell cache'tedir. Check sürümü feature asset'i içerecek şekilde ilerletilmiştir.

## Privacy

Revision network, telemetry veya connector çağrısı yapmaz.

## Performance

Prompt başına 10 revision, toplam 120 prompt ve preview limitleri uygulanır.

## Regression

Usage statistics restore ile bozulmamalıdır. Existing Prompt Library CRUD aynen devam eder.

## Support

Troubleshooting, support, rollback ve manual QA belgeleri mevcuttur.

## Acceptance

Source-contract ve runtime smoke testleri bulunmalıdır. GitHub Actions sonucu yoksa bu durum release notunda açıkça belirtilir.

## Rollback

Revision loader/checkpoint ve PWA asset değişiklikleri birlikte geri alınabilir. Local revision storage silinmez.
