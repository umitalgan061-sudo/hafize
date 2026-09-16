# TypeScript migration matrix

| Alan | Mevcut durum | Bu tur | Kabul kapısı |
| --- | --- | --- | --- |
| Prompt Smart Fill | JavaScript | TypeScript | strict typecheck + tests + generated entry |
| Prompt Command Palette | JavaScript | TypeScript | search tests + generated entry |
| Scheduled Countdown | JavaScript | TypeScript | time edge tests + generated entry |
| Runtime diagnostics | Yok | TypeScript | health contract + offline state |
| API client | Ad hoc fetch boundaries | Typed client | retry/timeout/error tests |
| Build | Node tarafından doğrudan static JS | Vite | build sonrası generated assets |
| Test | Repository source checks | Vitest + source contracts | deterministic tests |
| PWA | Static JS shell | v34 + generated entries | cache contract |
| Server composition | JavaScript ESM | Korundu | regression-free boundary |

## Migration acceptance

Bir eski JS modülü kaldırılmadan önce aynı public behavior'ın typed karşılığı hazır olmalıdır.

### 1. API yüzeyi

Global entegrasyon gerekiyorsa isim korunur veya açık bir bridge oluşturulur. Global nesneye giren veriler `unknown` kabul edilir ve normalize edilir.

### 2. DOM güvenliği

Kullanıcı verisi HTML string interpolation ile DOM'a sokulmaz. `textContent`, typed DOM selectors ve explicit attributes tercih edilir.

### 3. Browser compatibility

Feature unsupported olduğunda tüm uygulama çökmez. Storage, clipboard, network ve timer API'leri capability checks kullanır.

### 4. Lifecycle

Mount edilen event listener, observer ve timer'ların tamamında destroy/cleanup yolu bulunur.

### 5. PWA

Runtime'da yüklenen generated entry service worker shell içinde bulunmalıdır. Cache listesi HTML ile senkron tutulur.

### 6. Rollback

Legacy JS dosyasının silinmesi ancak HTML entry generated output'a geçtiğinde yapılır. Revert edildiğinde frontend tekrar tek deploy ile çalışabilir.

## Sonraki adaylar

Migration için adaylar:

- composer history domain helpers,
- message workspace models,
- conversation workspace data adapters,
- voice capability contracts,
- API request/response models,
- schedule domain models.

Bunlar server composition root'a dokunmadan taşınmalıdır.

## Anti-patterns

TypeScript'e yalnız dosya uzantısı değiştirilerek geçmek kabul edilmez.

`any` ile eski JavaScript'in bütün belirsizliğini yeniden üretmek kabul edilmez.

Build çıktısını kaynak kabul etmek kabul edilmez.

Generated `typed-build` içinde manuel değişiklik yapılmaz.

Büyük migration tek PR'a zorlanmaz; domain sınırlarıyla bölünür.
