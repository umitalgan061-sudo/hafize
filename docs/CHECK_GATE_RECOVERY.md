# Kontrol kapısı kurtarma turu

Bu belge, TypeScript migration dalgasının ardından kontrol kapısının neden
kırmızı kaldığını ve hangi yapısal düzeltmelerin yapıldığını kaydeder.

## Kök neden

Migration `server.mjs`, `public/app.js`, `lib/*.mjs` ve `public/*.js`
kaynaklarını `.ts` karşılıklarına taşıdı, ancak kapıyı koruyan katmanlar bu
taşımayı takip etmedi:

1. **`npm run check` TypeScript derlemiyordu.** Kapı yalnızca `node --check` ile
   `.mjs`/`.js` dosyalarını tarıyordu. `node --check`, ESM olarak algılanan bir
   `.ts` dosyasını ayrıştırmadan sessizce başarılı sayar — bu yüzden
   `vite.config.ts` içindeki bozuk bir metot zinciri ve
   `lib/agent-run-ledger.ts` içindeki hatalı parametre sözdizimi kapıdan geçti ve
   `npm run build` tamamen kırıldı.
2. **Testler taşınmış dosyaları okumaya devam ediyordu.** ~110 suite hâlâ
   `public/app.js`, `public/prompt-library-smart-fill.js`, `server.mjs` gibi artık
   var olmayan yolları açıyordu.
3. **Typed tarayıcı girişleri import anında `document`'a dokunuyordu.** Bu yüzden
   ui-shell, sidebar, voice-input ve voice-output davranış testleri hiç
   yüklenemiyordu — `npm run precheck` daha ilk adımda düşüyordu.
4. **Özellik kapıları belirli bir PWA önbellek sürümünü sabitliyordu.** `v35`,
   `v36`, `v38`, `v40`, `v41` bekleyen kapılar aynı anda yeşil olamazdı.

## Yapısal düzeltmeler

- `scripts/run-checks.mjs` artık her koşuda iki TypeScript projesini derler.
  `--skip-typescript` bayrağı hızlı `precheck` için ayrılmıştır.
- Typed tarayıcı girişleri otomatik kurulumu `globalThis.document` varlığına
  bağlar ve platform bağımlılıklarını parametre olarak alır; davranış testleri
  doğrudan `.ts` kaynağına karşı çalışır.
- PWA kapıları sürüm numarası yerine "önbellek sürümlenmiş mi" sözleşmesini
  doğrular. `scripts/shell-cache-contract.mjs` ayrıca çalışma zamanında enjekte
  edilen varlıkları da erişilebilir kabul eder.
- Üretilen `public/typed-build/` çıktısı `.gitignore` içine alındı.

## Bu turda düzeltilen üretim hataları

| Sorun | Etki |
| --- | --- |
| `vite.config.ts` içinde bozuk metot zinciri | `npm run build` ve `npm start` çalışmıyordu |
| `lib/agent-run-ledger.ts` hatalı parametre sözdizimi | Aynı; ayrıca ledger birim testleri hiç yüklenemiyordu |
| `lib/scheduled-agent-executor.*` silinmiş `.mjs` modülünü import ediyordu | Zamanlanmış ajan görevleri çalışma anında patlıyordu |
| `github_read_file` aracı hiçbir ajana sunulmuyordu | Tool-calling üzerinden GitHub okuma tamamen devre dışıydı |
| `make(documentRef, 'Dizin listele', …)` çağrıları | Etiket metni etiket adı yerine geçiyordu; `createElement` panelleri açılırken hata veriyordu |
| `public/github-workspace-actions.css` eksikti | Her sayfa yüklemesinde 404; service worker precache tamamen başarısız |
| Precache listesi silinmiş `/app.js`, `/ui-shell.js`, `/voice-*.js` dosyalarını içeriyordu | `cache.addAll` reddediliyor, çevrimdışı kabuk hiç kurulmuyordu |
| Legacy köprüler var olmayan `*.ts.js` paketlerini import ediyordu | Message Workspace, Prompt Library ve Scheduled Tasks köprüleri ölüydü |

## Kapanmayan işler

`npm run check` hâlâ 46 pakette kırmızıdır ve `npm run test:modern` 8 testte
başarısızdır. Bu başarısızlıkların tamamı bu branch'ten **önce** `origin/main`
üzerinde de mevcuttur; kaynak ile test beklentileri arasında daha eski turlardan
kalan kaymalardan doğarlar (örneğin `prompt-library-collections.js` içinde
`clip(...)` kullanılırken testin `slice(0, MAX_QUERY)` beklemesi). Her biri
hangi tarafın doğru olduğuna dair ayrı bir ürün kararı gerektirdiğinden ayrı bir
iş paketine bırakılmıştır.
