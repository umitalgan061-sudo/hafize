# Tema uyumlu kaydırma çubukları ve pencereler

## Tema değişkenleri

`public/styles.css` içinde `:root`:

| Değişken | Açık tema | Koyu tema (`clean-ui.css`) | Kullanım |
| --- | --- | --- | --- |
| `--surface` | `#fffdfa` | `#302f2c` | Diyalog yüzeyi |
| `--text` | `#252824` | `#f0ede8` | Diyalog metni |
| `--scrim` | `rgba(32,28,20,.34)` | `rgba(0,0,0,.6)` | Modal arkası perde |

**Neden gerekliydi:** `--surface` ve `--text` 30'dan fazla CSS dosyasında kullanılıyordu ama
**tanımlı değildi**. Tanımsız `var()` içeren `background`/`color` beyaza düşüyordu; koyu temada
onay penceresi (`approval-dialog`) beyaz kutu + siyah metin olarak görünüyordu. `--scrim` de
her modalde elle seçilmiş siyah perdeler vardı; koyu temada yetersiz kalıyorlardı.

## Kaydırma çubukları

`public/styles.css`:

```css
*::-webkit-scrollbar { width: 8px; height: 8px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb {
  background: var(--line);
  border-radius: 4px;
  border: 2px solid transparent;
  background-clip: content-box;
}
*::-webkit-scrollbar-thumb:hover { background: var(--muted); }
*::-webkit-scrollbar-thumb:active { background: var(--accent); }
* { scrollbar-width: thin; scrollbar-color: var(--line) transparent; }
```

- Tüm tema değişkenlerini kullandığı için koyu temada otomatik uyum sağlar.
- Firefox için `scrollbar-color`, Webkit için `::-webkit-scrollbar*` birlikte.
- `*` seçicisi olduğu için mesaj listesi, ayarlar sayfası, diyaloglar ve kenar çubuğu dahil her
  kaydırılabilir alanı kapsar.

## Temalanmış perdeler (scrim)

Aşağıdaki dosyalardaki sabit siyah perdeler `var(--scrim)` ile değiştirildi:

- `public/clean-ui.css` — `.approval-backdrop`
- `public/styles.css` — `.response-variant-dialog`, `.response-regeneration-options`, `.modal-overlay`/`.dialog-overlay`
- `public/prompt-library-smart-insert.css` — `.prompt-library-variable-dialog`
- `public/prompt-library-import-preview.css`
- `public/prompt-library-smart-fill.css`
- `public/prompt-library-bulk-organizer.css`
- `public/scheduled-tasks.css` — `.scheduled-tasks-overlay`

## Sesli asistan görsel geri bildirimi

`voice-input.ts` butonu `aria-pressed` ile yönetir. `public/styles.css` bu duruma görsel
karşılık ekler:

```css
#micBtn[aria-pressed="true"] {
  color: var(--accent-strong);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
}
#micBtn[aria-pressed="true"]::after { /* nabız atan halka */ }
```

- Renk değişimi + iki katmanlı nabız halkası (`micPulse`, 1.4 sn).
- `prefers-reduced-motion` destekli: animasyon kapalı, sabit halka gösterilir.
- Erişilebilirlik: durum `aria-pressed` ve `aria-label` ile de duyurulur, yalnızca görsele
  bağlı kalmaz.

## Test

- `public/typed/chat-scroll.test.ts` — 8 test.
- `public/typed/user-attachments.test.ts` — 6 test.
- `lib/attachment-expansion.test.ts` — 7 test.
