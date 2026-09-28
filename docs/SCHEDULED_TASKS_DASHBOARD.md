# Scheduled Tasks Dashboard

## Metrics
Eşleşen görev.
Tekrarlı görev.
Duraklatılan görev.
History satırı.

## Filters
Task text search.
Frequency filter.
Recurring-only toggle.
Existing status filter korunur ve yeni filtrelerle birlikte çalışır.

## Sort
Next run default.
Newer.
Older.

## Session state
Dashboard filters bounded state olarak sessionStorage'da tutulur.
Server sync yapılmaz.

## History export
Yalnız safe row metadata ve görünen history summaries export edilir.
Output local JSON download'dur.
256 KB sınırı summary hacmini sınırlar.

## Lifecycle
MutationObserver dinamik rows'u izler.
Dashboard refresh sonrası yeniden uygulanır.
Yeni interval veya background polling eklemez; mevcut Tasks refresh'i aynen korunur.

## Accessibility
Inputs aria-label taşır.
Buttons button elementidir.
Metric values text'tir.
Forced-colors ve reduced-motion kuralları korunur.

## Security
Dashboard fetch, XHR veya WebSocket eklemez.
