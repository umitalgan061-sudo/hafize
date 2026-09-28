# Preview Rollout ve Migration

Bu feature backend migration gerektirmez.

## Dosyalar

- scheduled-task-preview.js
- scheduled-task-preview.css
- scheduled-task-duplicate.js
- scheduled-task-duplicate.css
- typed/scheduled-tasks.ts metadata genişlemesi

## Rollout

1. Browser assetleri index'e eklenir.
2. Service worker cache version artırılır.
3. Schedule workspace mevcut POST akışı korunarak çalışır.
4. Preview smoke testi yapılır.
5. Duplicate satırlarının yalnız desteklenen durumlarda göründüğü doğrulanır.

## Geri dönüş

Asset bağlantıları kaldırılıp cache version yenilenebilir. Typed row metadata'sı kullanılmıyorsa satır dataset değişikliğinin geri alınması yeterlidir.
