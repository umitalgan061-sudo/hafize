# Tip kapısı onarımı

## Neden

`claude/wizardly-sagan-nxmtp4` dalında `npm run check:modern` zinciri baştan sona
hiç yeşil çalışmıyordu. Zincirin ilk adımı olan `tsc --noEmit` iki dosyadaki
sözdizimi hatasıyla duruyordu; bu yüzden zincirin geri kalan on adımı hiç
çalışmamış, TypeScript dalgasının bıraktığı hatalar birikmişti.

Bu tur tek bir ana iyileştirmeye ayrılmıştır: **doğrulama kapısını gerçekten
yeşil hâle getirmek ve kapının yakaladığı gerçek hataları düzeltmek.** Kapıyı
yeşile boyamak için hiçbir kontrol gevşetilmemiş, atlanmamış veya silinmemiştir.

## Bulunan ve düzeltilen gerçek hatalar

### Derlenmeyen kaynak

- `lib/agent-run-ledger.ts` içinde üç ayrı `opts={}: {…}` imzası geçersiz
  TypeScript'ti; `opts: {…} = {}` biçimine alındı.
- `vite.config.ts` içindeki geliştirme HTML dönüşümü zincirinde dört fazladan
  noktalı virgül vardı; zincir kırıldığı için `github-workspace*` modülleri
  geliştirme sunucusunda hiç yeniden yazılmıyordu.
- `markdown-renderer` ve `conversation-workspace` dev dönüşümleri `/typed/…`
  altına bakıyordu; kaynaklar `public/` kökünde, build girişleriyle aynı yola
  çekildi.

### Üretim derlemesi

- `public/typed/app-shell.ts` dosya sonunda IIFE içindeki
  `normalizeConversation`, `normalizeMessage` ve `fetchJson` adlarını modül
  seviyesinden `export` ediyordu. Rolldown bunu `PARSE_ERROR` ile reddediyor ve
  **`npm run build` tamamen başarısız oluyordu** — `prestart` build'e bağlı
  olduğu için `npm start` da çalışmıyordu. Geçersiz export satırı kaldırıldı.
- `public/scheduled-tasks.js`, `public/message-workspace.js` ve
  `public/prompt-library.js` uyumluluk köprüleri `/typed-build/<ad>.ts.js`
  içe aktarıyordu; böyle bir çıktı hiç üretilmiyor. Köprüler gerçek çıktı
  adına (`/typed-build/<ad>.js`) çevrildi.

### PWA kabuğu

- `sw-policy.js` içindeki `SHELL_ASSETS` listesi artık var olmayan
  `/ui-shell.js`, `/voice-input.js` ve `/voice-output.js` dosyalarını
  sayıyordu. `cache.addAll()` bütün olarak reddettiği için **service worker
  install adımı tamamen başarısız oluyor, çevrimdışı kabuk hiç kurulmuyordu.**
- `index.html` `/github-workspace-actions.css` yüklüyor ve kabuk bu dosyayı
  önbelleğe alıyordu; dosya depoda yoktu. Eksik stil sayfası yazıldı.
- `index.html` yüklediği hâlde kabukta bulunmayan
  `/typed-build/markdown-renderer.js` listeye eklendi.
- Kabuk listesi değiştiği için cache sürümü `v42` → `v43` yükseltildi.

### Araç katmanı

- `lib/tool-runtime.ts` bir aracı önce "kullanılabilir mi" diye kontrol edip
  sonra yetkilendiriyordu; yetkisiz bir ajan bu sırayla `TOOL_UNAVAILABLE`
  alarak aracın yapılandırılıp yapılandırılmadığını öğrenebiliyordu. Sıra
  yetkilendirme öncelikli hâle getirildi.
- `github_read_file` kullanılabilirliği okuyucu handle'ının varlığına bağlı,
  ancak hem `server.ts` hem `lib/delegated-agent-runner.ts` katalog
  yayınlarken `githubReadFile` geçmiyordu. Sonuç: **GitHub okuma aracı hiçbir
  ajanın kataloğunda görünmüyordu.** İki çağrı yeri düzeltildi.

### Sözleşme sınırları

- `lib/schedule-http-api.ts` içindeki `scheduleIdFromPath`, `%2F` gibi
  kodlanmış ayırıcıları çözüp kimlik olarak kabul ediyordu. Çözülen kimlikte
  ayırıcı, kontrol karakteri ve göreli segment artık reddediliyor.
- `public/typed/hafize-types.ts` `parseAgents`, `__proto__` gibi prototip
  adlarını ajan kimliği olarak geçiriyordu; bu kimlikler artık düşürülüyor.
- `lib/agent-run-ledger.ts` `now` seçeneği `() => number` olarak tiplenmişti;
  alttaki defter `Date` bekliyor. Tip gerçeğe çekildi.
- `public/typed/voice-input.ts` enjekte edilen `root` yerine global
  `MutationObserver`'ı kullanıyordu ve desteklenmeyen tarayıcıda `title`
  ipucunu kaybetmişti; ikisi de geri alındı.
- `public/typed/voice-output.ts` `STORAGE_KEY` değerini dışa aktarmıyordu.

## Bağlayıcı sözleşmelerin kendisi

Kapının bazı adımları kaynakla değil, kendi bayat sabitleriyle kırılıyordu:

- `test-modern-toolchain.mjs` `v41`, `test-legacy-entry-contract.mjs` `v40`,
  `test-typescript-ui-wave.mjs` yine `v41` bekliyordu; kabuk `v42` idi.
  `docs/CHECK_GATE.md` zaten "shell cache sürümü sabit yazılmaz" diyor;
  üçü de sürümlü bildirim değişmezine çevrildi.
- `test-typescript-migration.mjs` `server.ts` içinde hiç bulunmayan
  `session-auth.ts`, `tool-call-boundary.ts`, `tool-execution-result-policy.ts`
  ve `production-guard.ts` importlarını arıyordu. Bunlar sırasıyla
  `production-guard.ts`, `tool-runtime.ts` ve `package.json` start
  betiklerinde kontrol ediliyor.
- `test-typescript-migration-depth.mjs` `public/message-workspace.ts` arıyordu;
  dosya `public/typed/` altında.
- `test-typescript-security-entrypoints.mjs` köprü metnini `./lib/x.ts` olarak
  kuruyordu; köprü kardeş dosyaya (`./x.ts`) işaret eder.
- `test-github-workspace-actions-security.mjs` geçersiz regex bayraklarıyla
  parse bile edilemiyordu.
- `package.json` içindeki `test:typed-core` betiği tırnaksız `lib/**/*.test.ts`
  glob'u yüzünden sıfır test çalıştırıyordu.

## Test paketleri

Kapının vitest adımı 12 başarısız testle geliyordu; hepsi düzeltildi.
Bir kısmı üründeki hatayı gösteriyordu (yukarıdaki listeye girdi), bir kısmı
testin kendi kurgusu yanlıştı:

- `lib/http-runtime.test.ts` sahte `ServerResponse` `writeHead` başlıklarını
  hiç kaydetmiyordu.
- `lib/graceful-shutdown.test.ts` HTTP sunucusunun en sonda kapanmasını
  bekliyordu; üretim davranışı (ve `server.mjs` öncesi hâli) sunucuyu en başta
  kapatmaya başlayıp en sonda beklemektir. Test gerçek sözleşmeyi ölçecek
  biçimde yeniden yazıldı.
- `lib/agent-run-ledger.test.ts` 8 karakterden kısa trace id kullanıyordu.
- `lib/context-compaction.test.ts` eşiği hiç aşmayan bir fixture ile
  "fail closed" davranışını ölçmeye çalışıyordu.
- `lib/github-read.test.ts` 1 KiB alt sınırının altında bir `maxFileBytes`
  ile kırpma bekliyordu.
- `public/typed/hafize-api.test.ts` sahte zamanlayıcıyı ilerletmeden önce
  reddi gözlemlemediği için işlenmemiş promise reddi üretiyordu.

## Connector TypeScript geçişi

Faz 2 planının ilk maddesi (Gmail/Canva connector adapter'ları) bu turda
tamamlandı. `oauth-token-store-runtime`, `canva-read-client`,
`canva-read-tool-boundary`, `gmail-read-client`, `gmail-read-tool-boundary` ve
`plaintext-credential-policy` TypeScript'e taşındı; eski `.mjs` adları depoda
zaten kullanılan tek satırlık `export * from './<ad>.ts';` köprüsü oldu.
`plaintext-credential-policy` için bu, aynı güvenlik politikasının iki farklı
regex kümesiyle paralel yaşamasını da bitirdi.

İki okuma aracı sınırı aynı sözleşmeyi paylaşıyor; ortak tipler
`lib/runtime-contracts.ts` içine alındı. GitHub okuma sınırlarının enjekte
ettiği `fetch` de aynı dosyadaki `GitHubApiFetch` ile daraltıldı: çağrı yerleri
her zaman hazır bir `URL` geçtiği için testler isteği cast olmadan gözlemliyor.

## Kalan iş

`npm run check` artık 390 paketin tamamını çalıştırıyor (önceden `precheck`
adımında duruyordu). 153 başarısız paketten 129'u kaldı; yeni başarısız olan
paket yok.

Kalanların büyük çoğunluğu tek bir kök nedene sahip: TypeScript dalgası
tarayıcı modüllerini `public/typed/*.ts` altına taşıdı, ancak kaynak-sözleşme
paketleri hâlâ `public/<ad>.js` dosyasını okuyor ve artık orada yalnızca
uyumluluk köprüsü var. Bir sonraki tur bu paketleri tipli kaynağa yöneltmeli;
`scripts/typed-browser-import.mjs` bunun için gereken inert `document`
kurulumunu zaten sağlıyor.

`lib/agent-runtime.mjs` (162 satır) ile `lib/agent-runtime.ts` (66 satır) hâlâ
ayrı uygulamalar; `tool-runtime.ts` ve `agent-delegation.ts` çalışma zamanında
`.mjs` olanı kullanıyor. Bu ikilik de kapanmayı bekliyor.
