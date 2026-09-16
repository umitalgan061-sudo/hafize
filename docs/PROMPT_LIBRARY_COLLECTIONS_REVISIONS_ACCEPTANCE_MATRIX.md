# Collections + Revisions acceptance matrix

| Alan | Kabul kriteri | Kanıt |
| --- | --- | --- |
| Collection create | geçerli isimle kayıt oluşur | runtime test |
| Empty name | reddedilir | bounds test |
| Duplicate name | case-insensitive reddedilir | runtime test |
| Collection update | açıklama ve isim değişir | runtime test |
| Collection delete | yalnız koleksiyon kaydı silinir | runtime test |
| Member add | yalnız mevcut prompt id'leri kabul edilir | membership test |
| Member remove | seçilen id'ler çıkarılır | membership test |
| Member dedupe | duplicate ids tekilleştirilir | membership test |
| Member cap | 120 sınırı uygulanır | bounds test |
| Collection cap | 40 sınırı uygulanır | bounds test |
| Query bound | 100 karakter | bounds test |
| Import bound | 500 KB üstü reddedilir | import/export test |
| Export | prompt body içermez | security test |
| Orphan prune | olmayan prompt id'leri siler | orphan test |
| Offline | ağ çağrısı yoktur | security/source test |
| DOM | kullanıcı verisi textContent ile yazılır | UI test |
| Accessibility | labels + expanded state vardır | UI test |
| Forced colors | forced-colors kuralı vardır | CSS contract |
| Reduced motion | reduced-motion kuralı vardır | CSS contract |
| Lifecycle | observer/event cleanup vardır | lifecycle test |
| Revision capture | değişiklikte snapshot oluşur | runtime test |
| Duplicate revision | aynı içerik tekrar kaydedilmez | runtime test |
| Revision cap | 20/prompt, 600/global | bounds test |
| Revision restore | confirmation + before-restore | restore test |
| Stable prompt id | restore prompt id'sini değiştirmez | restore test |
| Stable createdAt | restore creation timestamp'i korur | restore test |
| Stable useCount | restore kullanım sayısını korur | restore test |
| Orphan revision | silinen prompt geçmişi prune edilir | orphan/runtime test |
| Revision export | yalnız seçilen prompt geçmişi çıkar | export test |
| Revision security | no fetch/XHR/WebSocket/beacon | security test |
| Collection enhancements | selection/duplicate/keyboard actions | enhancement test |
| Revision enhancements | current prompt/clear history actions | enhancement test |
| PWA shell | yeni JS/CSS assets cache'te | regression test |
| Cache version | v36 | PWA regression test |
| API safety | `/api/` network-only | service-worker contract |
| Backward compatibility | existing prompt key değişmez | regression test |
| Backend impact | API/schema değişikliği yok | review |
| Credential impact | secret/OAuth erişimi yok | security review |

## Release gate

A release is accepted only when each applicable row has source, runtime, or review evidence. Missing evidence is a release blocker rather than an implicit pass.

## Data preservation gate

Normal UI rollback may remove feature entry points, but it must not delete collection or revision storage automatically. Destructive migration requires a separate approval and migration plan.

## UX gate

Collections must not auto-submit a chat. Revisions must not auto-send a restored prompt. All actions remain explicit user operations.

## Performance gate

All data structures are bounded before render. No unbounded recursive traversal, interval, or network retry is introduced.

## Security gate

Imported JSON is parsed as inert data. DOM output is constructed with native nodes. Feature scope contains no authentication state, connector token, OAuth credential or server-side write path.

## Compatibility gate

The current TypeScript/Vite mainline remains authoritative. These legacy-style prompt library modules are isolated add-ons and must not replace typed Smart Fill, Command Palette or runtime diagnostics.
