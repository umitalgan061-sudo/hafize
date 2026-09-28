# Recurrence Gizlilik

## Server data
Authenticated owner, agentId, task, runAt ve bounded schedule metadata zaten schedule özelliğine aittir.
Recurrence yalnız scheduling metadata ve safe history summaries ekler.

## History
History status, attempts, runAt, finishedAt ve controlled lastError alanlarını tutar.
Task output, connector token, prompt response veya secret history içine yazılmaz.

## Browser data
Preset storage localdir.
Dashboard filtreleri session scoped'dur.
Yeni UI schedule response'larını permanent browser storage'a kopyalamaz.

## Export
Preset export explicit local download'dur.
History summary export explicit local download'dur.
Export telemetry değildir.

## Cache
Service worker asset dosyalarını cache'ler; /api/schedules response'larını cache'lemez.

## Clearing
Preset local storage'ını silmek server schedule'ı iptal etmez.
Server schedule cancel işlemi local preset'leri temizlemez.

## User agency
Task planlama explicit kullanıcı submit'idir.
Preset kullanmak yalnız formu doldurur.
Pause, resume ve cancel explicit aksiyonlardır.
