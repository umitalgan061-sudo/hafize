# Smart Fill Değişiklik Günlüğü

## v1

### Guided variable fill

- değişkenli promptlar için panel,
- canlı preview,
- kontrollü composer aktarımı,
- yerel preset desteği,
- preset limitleri,
- keyboard focus trap,
- accessibility labels,
- storage hata fallback'leri.

### Composer command palette

- `/prompt` araması,
- `Ctrl/⌘+Shift+O` kısayolu,
- başlık/etiket/gövde sıralı eşleşme,
- en fazla 12 sonuç,
- değişkenli promptlarda Smart Fill handoff.

### Live limits

- variable karakter sayacı,
- preview karakter sayacı,
- limits kullanım sırasında görünür hale getirildi.

### PWA

- shell cache v29,
- Smart Fill CSS/JS,
- command palette CSS/JS,
- live hints JS.

## Güvenlik etkisi

Yeni feature backend'e veri göndermez. Prompt değerleri DOM'a düz metin olarak yazılır ve form submit çağrısı üretmez.

## Veri etkisi

Mevcut Prompt Library kayıt formatı değişmez. Yeni preset namespace'i ayrı tutulur.

## Rollback

Feature commitleri veya PR komple revert edilebilir. Ana prompt kayıtları korunur.

## Test etkisi

Source, security, a11y, PWA, lifecycle, ranking, storage isolation ve no-submit kontratları eklendi.
