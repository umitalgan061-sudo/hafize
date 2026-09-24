# Tip Denetimi

Hafize'nin tüm kaynak ağacı TypeScript ile denetlenir ve kapı sıfır hatada
tutulur. Sunucu tarafında derleme adımı yoktur: TypeScript orada yalnızca
denetleyicidir.

## Sunucu tarafında derleme adımı yok

Node 22.18+ TypeScript dosyalarını yerel tip sıyırma ile doğrudan çalıştırır.
Bu yüzden `server.mts`, `lib/**` ve `scripts/**` için bundler, `dist/` klasörü
veya transpile adımı yoktur:

- `noEmit` bu dört projede açıktır; hiçbiri çıktı üretmez.
- `erasableSyntaxOnly` açıktır; Node'un çalıştıramayacağı sözdizimi (enum,
  namespace, parametre özellikleri) derleme zamanında reddedilir.
- `typescript`, `vite` ve `@types/node` **devDependency**'dir. Çalışma zamanı
  bağımlılığı değişmemiştir: yalnızca `redis`.

`npm start` doğrudan `node --import ./lib/production-guard.mts server.mts`
çalıştırır. Temiz bir kopyada hiçbir hazırlık adımı gerekmez.

**Tek istisna tarayıcıdır.** Tarayıcı `.mts` yükleyemez, bu yüzden
`public/**/*.mts` vite ile `public/typed-build/` altına derlenir ve çıktı
depoya işlenir. Ayrıntı için aşağıdaki "Beşinci proje".

## Beş proje, beş global kümesi

Tek bir yapılandırma bu kod tabanını doğru denetleyemez, çünkü dosyalar farklı
ortamlarda çalışır. Her projenin kendi `lib` ve `types` kümesi vardır:

| Proje | Kapsam | Global'ler | Neden ayrı |
| --- | --- | --- | --- |
| `tsconfig.node.json` | `server.mts`, `lib/**` | Node, DOM yok | `lib/` içinde `document`'a dokunmak hata olmalı |
| `tsconfig.scripts.json` | `scripts/**` | Node + DOM | Paketler `public/` modüllerini sahte DOM ile yükler |
| `tsconfig.browser.json` | `public/**/*.js` | DOM, Node yok | Sayfa kodunda `process` veya Node'un `setTimeout`'u hata olmalı |
| `tsconfig.worker.json` | `public/sw.js` | WebWorker | Worker'ın `window`'u yok, `importScripts`'i var |
| `tsconfig.typed.json` | `public/**/*.mts` | DOM, **`strict: true`** | Sıfırdan TypeScript; katılığın bedeli yok |

`tsconfig.json` yalnızca bu beşini birbirine bağlar; kendisi hiçbir dosya
içermez.

### Beşinci proje: derlenen tek yer

`public/**/*.mts` tarayıcıda çalışır ve tarayıcı TypeScript yükleyemez. Bu beş
modül vite ile `public/typed-build/` altına derlenir; çıktı depoya işlenir,
çünkü `npm start` temiz bir kopyada derleme beklememeli.

İşlenmiş çıktının bedeli sessiz kaymadır: biri kaynağı düzenleyip
`npm run build` çalıştırmayı unutabilir. `scripts/test-generated-assets-contract.mjs`
bunu kapatır — kaynakları geçici bir dizine yeniden derler ve çıktıyı bayt bayt
karşılaştırır.

## Kaynak ağacı TypeScript'tir

`lib/` altındaki **101 modülün tamamı** ve `server.mts` artık TypeScript.
`public/` tarafında beş modül `.mts`; geri kalan `public/*.js` dosyaları UMD
sarmalayıcılarıdır ve `checkJs` altında tam denetlenir (aşağıya bakın).

Uzantı her yerde `.mts`, `.ts` değil. İki neden:

1. Mevcut `.mjs` kuralıyla eşleşir ve Node'a dosyanın ESM olduğunu açıkça
   söyler. `.ts` modül türünü tahmin ettirir ve her yüklemede uyarı üretir.
2. O uyarıyı `package.json` içine `"type": "module"` yazarak susturmak mümkün
   değildi: `public/` altındaki UMD modülleri kontrol paketleri tarafından
   `require()` ile yükleniyor ve o bayrak onları ESM'e çevirip kırardı.

İçe aktarma belirteci uzantıyı taşır (`from './task-ledger.mts'`); bu, Node'un
istediği biçimdir ve `allowImportingTsExtensions` ile TypeScript tarafında da
geçerlidir.

### Neden `public/*.js` dönüştürülmedi

O dosyalar sayfaya `<script src="…">` ile, derleme adımı olmadan giriyor.
TypeScript'e taşımak her birini `typed-build/` üzerinden geçirmeyi gerektirirdi
— yani beş modüllük istisnayı kırk bir modüle büyütmek. `checkJs` zaten tam
denetim veriyor, dolayısıyla dönüşüm tip güvenliği için gerekli değil.

`scripts/*.mjs` de aynı gerekçeyle `.mjs` kaldı: kontrol paketleri
çalıştırılabilir betiklerdir, dışa aktardıkları bir yüzey yoktur ve `checkJs`
altında denetlenirler.

## Katılık

Taban yapılandırmada `strict` kapalıdır. Bu bilinçli bir seçimdir:
`strictNullChecks` ve `noImplicitAny` mevcut JavaScript üzerinde binlerce
açıklama gerektirir ve kazancı gerçek hata bulmaktan çok gürültü olur. Bunun
yerine gürültüsüz değer üreten denetimler açıktır:

- `alwaysStrict`, `strictBindCallApply`, `noImplicitThis`
- `noImplicitOverride`, `noFallthroughCasesInSwitch`
- `checkJs` — yani `.mjs` ve `.js` dosyaları da denetlenir

`tsconfig.typed.json` bu kuralın dışındadır: orada `strict`,
`noUncheckedIndexedAccess` ve `exactOptionalPropertyTypes` açıktır, çünkü o kod
sıfırdan TypeScript yazıldı ve geriye dönük anlamlandırma yükü yok.

## Sözleşmeler nerede yazılı

`types/` altındaki bildirim dosyaları çalışma zamanına hiçbir şey eklemez:

- **`types/shared.d.ts`** — alan modeli. Sohbet mesajı ve araç etkinliği, ajan
  özeti, araç çağrısı, zamanlanmış görev kaydı ve API hata şekli. Her tip onu
  üreten modülden türetilmiştir; HTTP sınırının iki yakası aynı adı kullanır.
- **`types/browser.d.ts`** — `public/` modüllerinin yayınladığı her
  `window.Hafize*` global'i ve modüller arası `hafize:*` olaylarının `detail`
  yükleri. Burada bildirilmemiş bir global hata verir. Prompt kütüphanesi,
  akıllı doldurma, komut paleti ve geri sayım sözleşmeleri de burada — tek
  yerde, çünkü modüller kendi `Window` alt tiplerini bildirdiğinde küresel
  bildirimle çakışıyorlardı.
- **`types/node.d.ts`** — sunucu tarafı yardımcı adları: `UnvalidatedInput`
  (doğrulamayı kendi yapan sınır fonksiyonlarının girdisi), `HafizeFetch` ve
  `HafizeFetchResponse` (modüllerin `fetch`'ten gerçekten kullandığı dar yüzey),
  `TestDouble<T>` (kontrol paketlerindeki kısmi ikizler).

## Çalıştırma

```bash
npm run typecheck   # yalnızca tip denetimi, beş proje
npm run check       # tip denetimi + sözdizimi + 240 paket
```

`npm run check` tip denetimini en başta çalıştırır: bir imza uyuşmazlığını
240 paketi beklemeden görmek daha hızlıdır. `--filter` verildiğinde tip
denetimi atlanır; o mod tek bir paketi hızlı çalıştırmak içindir.

### Sözdizimi taraması neden yalnızca JavaScript'i kapsar

`node --check` bir `.mts` dosyasını güvenilir biçimde denetleyemez:

1. Dosya önce CommonJS olarak ayrıştırılır; yalnızca bu deneme *ESM sözdizimi*
   yüzünden düşerse tip sıyırmalı ESM moduna geçilir. Bir tip açıklaması ilk
   `import`/`export`tan önce geliyorsa CJS ayrıştırması orada patlar ve geçerli
   bir modül, sözdizimi hatası gibi raporlanır.
2. ESM moduna geçildiğinde bile sıyırma, tip bölgesini **doğrulamadan** boşluğa
   çevirir: `function broken(a: string {` gibi bozuk bir imza sıfır çıkış
   koduyla geçer.

Yani kapı ya yanlış yere alarm verirdi ya da gerçek hatayı kaçırırdı. `.mts`
dosyalarının ayrıştırıcısı `tsc`'dir ve zaten kapının ilk adımıdır: aynı bozuk
imza orada tam satır numarasıyla `TS1005` olarak raporlanır.

## Kapının gerçekten kapı olduğu nasıl doğrulanır

```bash
printf '\nconst probe: number = "metin";\n' >> lib/task-ledger.mts
npm run typecheck   # başarısız olmalı
git checkout lib/task-ledger.mts
```

## Bilinen tercihler

- **Ayrımlı birleşimlerde `ok` literaldir.** `{ ok: false; error }` ve
  `{ ok: true; … }` döndüren sınırlar (cihaz eylemleri, hız sınırlayıcı,
  OAuth akışı, kişisel bellek, zamanlama) dönüş tiplerini elle yazar ya da
  `as const` kullanır. Çağıran taraf tek bir `ok === false` karşılaştırmasıyla
  hangi alanların var olduğunu görür.

  Doğruluk testi (`!result.ok`) yerine açık karşılaştırma kullanılır, çünkü
  **yalnızca ikincisi daraltır**. Bu soyut bir ayrım değil: altı modül erken
  dönüşü `if (!result.ok) return result;` ile yazıyordu ve başarılı dalın şekli
  fonksiyonun dönüş tipine sızıyordu.

- **Okunur tip, değiştirilebilir kayıt.** `AgentRun` ve `HafizeScheduleEntry`
  dışarıya `Readonly` verilir ama kayıtlar haritada yerinde güncellenir.
  `MutableAgentRun` gibi eşlenik tipler hangi tarafın yazabildiğini açık tutar.

- **Sınır fonksiyonları `unknown` alır.** Girdiyi kendisi doğrulayan bir
  fonksiyon imzasında hiçbir şey varsaymaz; şekil kontrolünden sonra tek bir
  daraltma yapar. `any` denetimi tümüyle kapatırdı.

- **Test ikizleri `TestDouble<T>` ile işaretlenir.** Bir ikiz, sınadığı yüzeyin
  yalnızca kullanılan kadarını uygular; gerçek kodda bu ad görünüyorsa orada
  eksik bir tip vardır.

- **Ayrımlı sonuçlar `scripts/expect-result.mjs` ile okunur.** `expectOk`,
  `expectError` ve `expectMatched` önce ayrımcıyı doğrular, sonra değeri verir.
  Doğrudan `result.records` yazmak, başarısız bir çağrıda `undefined.map is not
  a function` veriyordu — asıl nedeni söylemeden.

- **Bilerek geçersiz girdi `any` ile işaretlenir.** Bir paket doğrulamanın
  reddettiğini sınıyorsa, girdinin yanlış olduğu açıkça yazılır.
