# Smart Fill Test Matrisi

| Alan | Kontrol |
|---|---|
| Mount | card, dialog ve global export |
| Variables | 0, 1, 12, 13+ |
| Values | empty, 1 char, 1000, 1001+ |
| Preview | replacement, truncation, text-only |
| Presets | empty, 1, 6, 7 |
| Storage | valid JSON, invalid JSON, unavailable |
| Clipboard | available, unavailable, rejection |
| Keyboard | Escape, Tab, Shift+Tab, Enter, arrows |
| Focus | open, navigation, close |
| Intercept | variable vs non-variable |
| Palette | exact, prefix, substring, tag, body |
| Palette limit | 12 result cap |
| Submit | no automatic submit |
| PWA | v28 assets |
| Responsive | <=700px |
| Forced colors | system color rules |

## Beklenen davranış

Her satır feature'ın mevcut uygulama sözleşmesiyle uyumlu kalmalıdır. Hata durumlarında ana sohbet akışı çalışmaya devam eder.

## Regression

Prompt Library CRUD, usage insights ve starter seed fonksiyonları Smart Fill tarafından değiştirilemez.
