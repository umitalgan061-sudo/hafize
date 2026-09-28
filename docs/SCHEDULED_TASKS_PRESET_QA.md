# Scheduled Task Preset QA

## Create
Formdan task, agent, attempts ve recurrence okunur.
Boş task preset'e dönüşmez.

## Use
Task text doğru textarea'ya gelir.
Agent ve attempts bounded değerlerle doldurulur.
Recurrence select doğru moda geçer.
Haftalık checkbox'lar normalize edilir.
Aylık day doğru alana gelir.

## Delete
Delete explicit confirm ister.
Cancel edilirse storage değişmez.

## Import
File <=256 KB.
JSON object veya array.
Unknown properties ignored.
Duplicate title mevcut kaydı ezmez.
User confirmation olmadan write yok.

## Export
Version, source, exportedAt ve items.
Blob download.
No network.

## Failure
FileReader error.
Invalid JSON.
Storage write failure.
Full capacity.

## Accessibility
Buttons keyboard reachable.
Status textual.
Section aria-label taşır.
Hidden file input focus hedefi değildir.

## Regression
Preset use schedule POST çağırmaz.
Preset data service worker API cache'e girmez.
