# Storage Anahtar Sözlüğü

| Yüzey | Anahtar biçimi | Grup | Temizlenebilir |
|---|---|---|---|
| Sohbetler | hafize.conversations.v1 | data | evet |
| Mesaj workspace | hafize.message-workspace.v1 | data | evet |
| Prompt Library | hafize.prompt-library.v1 | data | evet |
| Prompt state | hafize.prompt-library.v1.state | preference | evet |
| Koleksiyonlar | hafize.prompt-library.collections.v1 | data | evet |
| Revizyonlar | hafize.prompt-library.revisions.v1 | data | evet |
| Smart Views | hafize.prompt-library.smart-views.v1 | data | evet |
| Smart Fill | hafize.prompt-library.smart-fill.v1.* | data | evet |
| Model tercihleri | hafize.model-preferences.v1 | preference | evet |
| Composer history | hafize.composer-history.v1 | data | evet |
| Composer settings | hafize.composer-history.settings.v1 | preference | evet |
| Görev şablonları | hafize.scheduled-task-templates.v1 | data | evet |
| Görev taslağı | hafize.scheduled-task-draft.v1 | data | evet |
| Tema | hafize.theme.v1 | preference | evet |
| Azaltılmış hareket | hafize.reduced-motion.v1 | preference | evet |
| Backup meta | hafize.workspace-backup.meta.v1 | preference | evet |

Bu tablo privacy center allowlist'iyle birlikte güncellenmelidir. Yeni storage alanları tabloya eklenmeden toplu temizlemeye alınmamalıdır.

Prefix yüzeyleri yalnız tanımlı prefix ile başlar. Benzer görünen anahtarlar yanlışlıkla eşleşmez.

Oturum, auth, token, secret ve credential alanları bu sözlüğe dahil edilmez.
