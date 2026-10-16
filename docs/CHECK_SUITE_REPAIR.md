# Kontrol paketi onarımı (2026-10)

Bu tur `npm run check` / `npm test` regresyon kapısını yeniden çalışabilir hale getirdi
ve aynı çürümenin sessizce tekrarlanmasını engelleyen bir release gate ekledi.

## Sorun

TypeScript migration dalgaları `public/*.js` altındaki ~60 tarayıcı modülünü
`public/typed/**/*.ts` altına, `server.mjs` dosyasını `server.ts` dosyasına taşıdı.
`scripts/` altındaki paketler bu yeni yollara taşınmadı. Sonuç:

- 282 paket okunamayan bir dosya yüzünden `ENOENT` ile düştü,
- ~200 paket eski import, eksik export veya ESM dışı `require` yüzünden düştü,
- 6 paket repoya commit edilmiş syntax hatası taşıyordu (fazla kaçışlı regex
  literalleri ve yorum satırına dönüşen `//api/health` gibi ifadeler),
- ses girişi/çıkışı, UI shell ve sidebar erişilebilirlik paketleri migration
  commit'inden beri hiç çalışmıyordu.

`main` üzerinde toplam **480 kontrol kırmızıydı**. Bu görünmezdi, çünkü
`.github/workflows/quality.yml` yalnızca `typecheck`, `check:modern`, `build` ve
`audit` adımlarını çalıştırır; tam regresyon kapısı CI'da hiç koşmuyordu.

## Yapılanlar

- Syntax hatası taşıyan paketler düzeltildi; `node --check` taraması tamamen yeşil.
- Paketler silinmiş `public/*.js` yollarından kanonik TypeScript kaynaklarına taşındı.
- `public/typed/*` tarayıcı girişleri Node altında import edilebilir hale geldi:
  modül seviyesindeki DOM bootstrap'ı `typeof document !== 'undefined'` ile korunuyor.
  Tarayıcı davranışı değişmez; paket artık gerçek üretim modülünü test edebiliyor.
- UMD sarmalı taşıyan dokuz modül gerçek ES export yüzeyi kazandı. Bu modüller
  `"type": "module"` bir repoda erişilemeyen `module.exports` dalına yazıyordu;
  yani hiçbir importable API'leri yoktu. Global sözleşme (`window.HafizeX`) korunur.
- Asset sözleşmesi güncellendi: Vite artık eski tek tek modülleri
  `typed-build/legacy-app.js` içinde paketliyor, bu yüzden `index.html` içinde
  `/chat-drafts.js` gibi bir yol aramak anlamsız. Yeni yardımcılar modülün
  gerçekten sevk edildiğini doğrular.
- Sabit shell cache sürümü (`v45`, `v48`…) bekleyen paketler monotonik tabana geçti.
- `test-typescript-source-integrity.ts` artık üretilen `typed-build/` ağacını
  taramaz; kapı `npm run build` çalışmış olup olmamasına göre farklı davranmıyor.

### Bulunan gerçek regresyonlar

Paketler yeniden çalışmaya başlayınca migration sırasında kaybolmuş davranışlar ortaya çıktı:

| Alan | Regresyon | Düzeltme |
| --- | --- | --- |
| `server.ts` | Sohbet araç listesi `githubReadFile` taşımadığı için `github_read_file` aracı modele hiç sunulmuyordu | İlan bağlamı çalıştırma bağlamıyla eşitlendi |
| `lib/model-response-contract.ts` | String olmayan `content` sessizce `''`'a çevriliyordu; bozuk upstream yanıtı boş mesaj olarak kabul ediliyordu | Sınır yeniden reddediyor (`INVALID_MODEL_CONTENT`) |
| `lib/model-response-contract.ts` | `isTerminalModelResponse` ve `MODEL_RESPONSE_CONTRACT.finishReasons` kaybolmuştu | Geri getirildi; geçerli sebep listesi tek kaynaktan türüyor |
| `lib/model-response-contract.ts` | Eksik tool-call id/name tek bir genel hata kodu veriyordu | `..._ID` / `..._NAME` kodları geri geldi |
| `lib/agent-runtime.ts` | Üç ayrı güvenlik policy flag'i tek `policy` hatasına düşüyordu; tool policy hataları ajan id'si taşımıyordu | Hata mesajları hangi değişmezin eksik olduğunu söylüyor |
| `lib/tool-runtime.ts` | `allowedPermissions` yalnız `Set` kabul ediyordu, oysa skills runtime dizi döndürüyor | Herhangi bir iterable kabul ediliyor |
| `public/typed/voice-input.ts` | `MutationObserver` ve `Event` enjekte edilen root yerine global'den alınıyordu | Enjeksiyon sözleşmesi geri geldi |
| `public/typed/voice-input.ts` | "ses tanıma tarayıcı sağlayıcın tarafından işlenebilir" gizlilik bildirimi ve mikrofon tooltip'i kaybolmuştu | Geri getirildi |
| `public/typed/voice-output.ts` | `STORAGE_KEY` export edilmiyordu | Export edildi |
| `lib/tool-runtime.ts` | `Hafize skill'i hazırlanıyor` metni `Hafize skill hazırlanıyor` olmuştu | Türkçe ek geri geldi |

## Yeni release gate

`scripts/test-check-suite-integrity.mjs` paketleri çalıştırmaz; her paketin
**çalışabilir** olduğunu doğrular:

1. paket parse ediliyor mu,
2. okuduğu her repo yolu diskte var mı,
3. ESM içinde `createRequire` olmadan `require` kullanıyor mu,
4. migration'ın kaldırdığı bir `public/*.js` modülünü okuyor mu,
5. `scripts/` altındaki paylaşılan yardımcılar yanlışlıkla paket olarak mı toplanıyor.

Bir dosyanın yorumlarında eski bir yol anılması hata sayılmaz; yorumlar taranmadan
önce çıkarılır. Bir paketin kasıtlı yokluk iddiası (`existsSync(...) === false`)
muaftır.

Gate `check:modern` zincirine bağlıdır, yani CI'da koşar. Çalışamayan bir paket
düşen bir paketten daha kötüdür: hiçbir şey raporlamaz.

## Yardımcılar

Paylaşılan yardımcılar tek yerde toplanır; aynı iş için paralel modül açılmaz.

- `scripts/shell-cache-contract.mjs` — shell cache değişmezleri, asset listesi ve
  **sevk edilen modül** sözleşmesi:
  - `assertShippedBrowserModule(name)` modülün kanonik TS kaynağı, onu taşıyan
    build entry'si, `index.html` yüklemesi ve precache kaydını birlikte doğrular.
  - `assertShippedStylesheet(name)` aynı kontrolü stylesheet için yapar.
  - `assertCacheVersionAtLeast(n)` sabit sürüm yerine monotonik taban kullanır.
  - `assertMountOrder([...])` bundle içindeki import sırasını doğrular.
- `scripts/source-contract.mjs` — kaynak-sözleşme yardımcıları. Yeni eklenenler:
  - `assertNumericLimit(source, name, value)` bir sınırı yazımından bağımsız okur
    (`1000000`, `1_000_000` veya başka bir sabite dolaylı atama).
  - `assertSymbolDeclared(source, name)` sembolün hayatta kaldığını doğrular.
- `scripts/tool-result-contract.mjs` — `executeNvidiaToolCall` sonucunu
  `{ ok, value }` / `{ ok, error }` sözleşmesi üzerinden doğrular; zamana bağlı
  `durationMs` alanı değeri değil şekli ile kontrol edilir.

## Kalan iş

Bu tur sonunda 683 paketten **526'sı geçiyor** (tur başında 203). Kalan 157 paket
aynı sınıftan: migration sırasında yazımı değişmiş kaynak metnine bakan
assertion'lar. Her biri "paket mi eskimiş, uygulama mı bir şey kaybetmiş?"
sorusunun ayrı ayrı cevaplanmasını gerektiriyor ve bu nedenle ayrı bir tura
bırakıldı. Liste `npm run check` çıktısından üretilebilir.

## Ayrı bir bulgu: skills runtime bağlı değil

`lib/skills-runtime.ts` içindeki `createSkillsRuntime` üretim kodunda hiç
çağrılmıyor. `skill_invoke` aracı `context.skillsRuntime` gerektirdiği için
modele hiçbir zaman sunulamıyor, ancak `/api/health` `skills: ready` raporluyor.
Bu bir test sorunu değil, eksik bir özellik bağlantısıdır; bu turun kapsamına
alınmadı ve ayrı bir karar gerektiriyor.
