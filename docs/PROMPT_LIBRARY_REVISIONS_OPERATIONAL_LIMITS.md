# Revision Operational Limits

## Prompt limit

Revision sistemi en fazla 120 prompt id'sini işler.

## Revision limit

Her prompt için en fazla 10 revision tutulur.

## Text limits

Title 100, body 8000, tag 24 karakter ile sınırlandırılır.

## Tag limit

Bir revision en fazla 8 tag içerir.

## Export limit

Revision export çıktısı en fazla 1 MB olur.

## Preview limit

List preview 260, comparison preview 2000 karakter ile bounded tutulur.

## UI limit

Panel yalnız aktif prompt'un revision kayıtlarını render eder.

## Observer limit

MutationObserver yalnız mevcut card subtree'sini gözlemler.

## Storage behavior

Read ve write işlemleri try/catch ile korunur.

## Event behavior

Restore sonrası core refresh event gönderilir.

## Browser behavior

StorageEvent desteklenmezse generic event fallback'i kullanılır.

## User interaction

Restore ve destructive işlemler confirmation gerektirir.

## Rollback

Kod rollback local revision data'yı otomatik temizlemez.

## Maintenance

Limit değişiklikleri test matrisi ve migration planıyla birlikte yapılır.
