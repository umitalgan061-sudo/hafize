# Smart Fill Event Kontratları

## `Kullan` click

Prompt Library kartındaki `Kullan` düğmesi değişkenli kayıt için capture phase'de Smart Fill tarafından yakalanır. `preventDefault` ve `stopImmediatePropagation` ile ikinci aktarımın önüne geçilir.

Değişkensiz kayıt Smart Fill tarafından ele alınmaz. Böylece mevcut davranış korunur.

## Form input

Değişken input'undaki her değişim `renderPreview` çalıştırır. Preview sadece aktif prompt ve aktif form değerlerinden üretilir.

## Preset seçimi

Select değiştiğinde yalnız aktif prompt'un preset listesi okunur. Bulunan değerler ilgili inputlara yazılır ve preview yeniden çizilir.

## `Mesaja aktar`

Aktarım composer textarea `value` alanına yazılır, ardından `input` event'i tetiklenir. Submit veya requestSubmit çağrılmaz.

## `Önizlemeyi kopyala`

Clipboard işlemi kullanıcı eylemiyle başlar. Promise rejection durumunda kullanıcıya hata durumu gösterilir.

## Escape

Dialog açıkken Escape browser varsayılanını durdurur ve paneli kapatır. Aktif form DOM'dan çıkarılır.

## Tab

Dialog açıkken Tab ve Shift+Tab son/ilk focusable elemanlar arasında döngü oluşturur. Böylece keyboard focus arka plana kaçmaz.

## Palette

Composer `/prompt` komutunu algıladığında palette açılır. Query alanı bağımsız tutulur; sonuçlar local Prompt Library'den hesaplanır.

ArrowUp/ArrowDown aktif option'ı değiştirir. Enter seçimi tamamlar. Escape palette'i kapatır.

## Smart Fill handoff

Palette sonucu değişken içeriyorsa `HafizePromptLibrarySmartFill.open(item)` çağrılır. Değişkensiz sonuç doğrudan composer'a yazılır.

## Hints

Live hints katmanı Smart Fill panelini MutationObserver ile izler ve karakter sayaçlarını ekler. Storage'a yazmaz.

## Lifecycle

Her module mount guard kullanır. Destroy işlemleri event listener ve observer temizliği yapar.
