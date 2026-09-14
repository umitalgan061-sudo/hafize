# Smart Fill Uyumluluk

## Tarayıcı

Özellik modern DOM API'leri, `localStorage`, `MutationObserver`, `Event` ve `URL` gibi mevcut uygulama yüzeylerini kullanır. Desteği olmayan bir API için feature uygulamanın ana sohbet akışını durdurmamalıdır.

Clipboard bulunamazsa yalnız kopyalama işlemi başarısız olur. Smart Fill aktarımı clipboard'a bağlı değildir.

Storage erişilemiyorsa presetler boş kabul edilir; Prompt Library ana kayıtları ayrı hata yönetimine sahiptir.

## Tema

Stiller `var(--panel)`, `var(--text)`, `var(--muted)`, `var(--line)` ve mevcut accent token'larını kullanır. Ayrı bir tema sistemi yaratılmaz.

## Mobil

Panel genişliği viewport'a göre ayarlanır. 700px altında alan etiketleri dikey düzene geçer.

## PWA

Yeni CSS/JS dosyaları shell cache'de bulunur ve cache sürümü v28'dir. API yolları yine network-only'dir.

## Eski Prompt Library verisi

Yeni feature mevcut prompt schema'sına migration uygulamaz. Eski kayıtlardaki değişkenler çekirdek tarafından okunur.

## Geçiş

Feature asset'leri yüklenemezse eski `Kullan` davranışı değişkensiz promptlar için aynen kalır. Değişkenli promptlar Smart Fill'e özel enhanced event ile yakalanır.

## Veri taşınabilirliği

Smart Fill presetleri Prompt Library import/export dosyasına eklenmez. Bu nedenle eski yedek formatı bozulmaz.

## Kod sözleşmesi

Global exportlar:

- `HafizePromptLibrarySmartFill`
- `PromptLibraryCommandPalette`

Her iki global de modül ortamında API olarak tüketilebilecek şekilde korunur.
