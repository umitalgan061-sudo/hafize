# Scheduled Tasks Bulk Actions

## Selection
Tek işlemde en fazla 40 task row seçilebilir.
Her checkbox accessible label taşır.

## Actions
Recurring scheduled görevleri pause.
Recurring paused görevleri resume.
Scheduled veya paused görevleri cancel.

## Authorization
Her mutation same-origin credentials kullanır.
Ownership ve transition kararını server verir.

## Confirmation
Bulk cancel explicit confirmation ister.
Bulk pause/resume reversible state change'tir.

## Failure
Tekil hata stack trace açığa çıkarmaz.
İşlemler sonunda canonical task listesi refresh edilir.

## Regression
Bulk action task text değiştirmez.
Non-recurring task pause/resume için ignore edilir.
Running, completed ve failed kayıtlar geçersiz UI durumundan cancel edilemez.

## UX
Seçili sayı görünür.
Selection network olmadan temizlenebilir.
Mobile controls wrap eder.
