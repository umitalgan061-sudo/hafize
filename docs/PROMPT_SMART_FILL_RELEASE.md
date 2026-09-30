# Smart Fill Release Checklist

## Kod

- Smart Fill yalnız değişkenli `Kullan` olayını yakalıyor.
- Değişkensiz istemler eski davranışı koruyor.
- Command palette `/prompt` ve `Ctrl/⌘+Shift+O` ile açılıyor.
- Değişkenli palette sonucu Smart Fill paneline devrediliyor.
- Otomatik form submit bulunmuyor.

## Depolama

- `hafize.prompt-library.smart-fill.v1.<promptId>` anahtarı kullanılıyor.
- Maksimum preset sayısı 6.
- Preset export'a dahil değil.
- JSON bozuksa boş preset listesi kullanılıyor.

## Sınırlar

- 12 değişken.
- 1000 karakter/değer.
- 8000 karakter/çıktı.
- 12 palette sonucu.
- 120 karakter palette sorgusu.

## Güvenlik

- network API yok.
- DOM injection API yok.
- textContent/value tabanlı çıktı var.
- Secret veya token storage yok.

## PWA

- v28 cache.
- smart fill CSS/JS cache listesinde.
- palette CSS/JS cache listesinde.

## Erişilebilirlik

- dialog semantics.
- labelled inputs.
- live preview.
- keyboard trap.
- focus return.
- listbox/option state.

## Test

PR öncesi source, security, a11y, limits, lifecycle, PWA ve command ranking testleri çalıştırılır. Tam browser E2E yoksa PR açıklamasında belirtilir.

## Geri alma

Tek PR revert edilebilir. Prompt Library ana kayıtlarına dokunulmadığı için rollback sonrasında istem verileri korunur.
