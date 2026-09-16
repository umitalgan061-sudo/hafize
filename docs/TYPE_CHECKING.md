# Tip Denetimi

Hafize'nin tüm kaynak ağacı TypeScript ile denetlenir ve kapı sıfır hatada
tutulur. Derleme adımı yoktur: TypeScript burada yalnızca denetleyicidir.

## Neden derleme adımı yok

Node 22.18+ `.ts` dosyalarını yerel tip sıyırma ile doğrudan çalıştırır. Bu
yüzden proje bundler, `dist/` klasörü veya transpile adımı eklemeden
TypeScript'in tamamından yararlanabilir:

- `noEmit` her projede açıktır; hiçbir yapılandırma çıktı üretmez.
- `erasableSyntaxOnly` açıktır; Node'un çalıştıramayacağı sözdizimi (enum,
  namespace, parametre özellikleri) derleme zamanında reddedilir.
- `typescript` ve `@types/node` **devDependency**'dir. Çalışma zamanı
  bağımlılıkları değişmemiştir: yalnızca `redis`.

## Dört proje, dört global kümesi

Tek bir yapılandırma bu kod tabanını doğru denetleyemez, çünkü dosyalar dört
farklı ortamda çalışır. Her projenin kendi `lib` ve `types` kümesi vardır:

| Proje | Kapsam | Global'ler | Neden ayrı |
| --- | --- | --- | --- |
| `tsconfig.node.json` | `server.mjs`, `lib/**` | Node, DOM yok | `lib/` içinde `document`'a dokunmak hata olmalı |
| `tsconfig.scripts.json` | `scripts/**` | Node + DOM | Paketler `public/` modüllerini sahte DOM ile yükler |
| `tsconfig.browser.json` | `public/**` (sw hariç) | DOM, Node yok | Sayfa kodunda `process` veya Node'un `setTimeout`'u hata olmalı |
| `tsconfig.worker.json` | `public/sw.js` | WebWorker | Worker'ın `window`'u yok, `importScripts`'i var |

`tsconfig.json` yalnızca bu dördünü birbirine bağlar; kendisi hiçbir dosya
içermez.

## TypeScript'e geçiş

`lib/rate-limit.mts` projedeki ilk gerçek TypeScript modülüdür ve derleme adımı
olmadan çalışır: `npm start` onu `lib/production-guard.mjs` üzerinden doğrudan
yükler.

Uzantı `.mts`'tir, `.ts` değil. İki neden:

1. Mevcut `.mjs` kuralıyla eşleşir ve Node'a dosyanın ESM olduğunu açıkça
   söyler. `.ts` modül türünü tahmin ettirir ve her yüklemede uyarı üretir.
2. O uyarıyı `package.json` içine `"type": "module"` yazarak susturmak mümkün
   değildi: `public/` altındaki UMD modülleri kontrol paketleri tarafından
   `require()` ile yükleniyor ve o bayrak onları ESM'e çevirip kırardı.

İçe aktarma belirteci uzantıyı taşır (`from './rate-limit.mts'`); bu, Node'un
istediği biçimdir ve `allowImportingTsExtensions` ile TypeScript tarafında da
geçerlidir.

Geri kalan `.mjs` modülleri `checkJs` altında zaten tam denetleniyor, yani
dönüşüm tip güvenliği için gerekli değil — sıra geldiğinde her modül tek tek
taşınabilir, kapı her adımda yeşil kalır.

## Katılık

`strict` kapalıdır. Bu bilinçli bir seçimdir: `strictNullChecks` ve
`noImplicitAny` mevcut JavaScript üzerinde binlerce açıklama gerektirir ve
kazancı gerçek hata bulmaktan çok gürültü olur. Bunun yerine gürültüsüz değer
üreten denetimler açıktır:

- `alwaysStrict`, `strictBindCallApply`, `noImplicitThis`
- `noImplicitOverride`, `noFallthroughCasesInSwitch`
- `checkJs` — yani `.mjs` ve `.js` dosyaları da denetlenir

Yeni yazılan `.ts` dosyaları bu tabandan devralır; katılığı dosya bazında
artırmak isteyen bir sonraki tur `tsconfig.base.json` üzerinde tek satırla
yapabilir.

## Sözleşmeler nerede yazılı

`types/` altındaki üç bildirim dosyası çalışma zamanına hiçbir şey eklemez:

- **`types/shared.d.ts`** — alan modeli. Sohbet mesajı ve araç etkinliği, ajan
  özeti, araç çağrısı, zamanlanmış görev kaydı ve API hata şekli. Her tip
  onu üreten modülden türetilmiştir; HTTP sınırının iki yakası aynı adı
  kullanır.
- **`types/browser.d.ts`** — `public/` modüllerinin yayınladığı her
  `window.Hafize*` global'i ve modüller arası `hafize:*` olaylarının `detail`
  yükleri. Burada bildirilmemiş bir global artık hata verir.
- **`types/node.d.ts`** — sunucu tarafı yardımcı adları: `UnvalidatedInput`
  (doğrulamayı kendi yapan sınır fonksiyonlarının girdisi), `HafizeFetch` ve
  `HafizeFetchResponse` (modüllerin `fetch`'ten gerçekten kullandığı dar
  yüzey), `TestDouble<T>` (kontrol paketlerindeki kısmi ikizler).

`lib/` içindeki her dışa aktarılan fonksiyon JSDoc taşır: seçenek nesnesinin
şekli, yardımcıların aldığı ve döndürdüğü, ve bir değerin bilerek
doğrulanmamış olduğu yerler.

## Çalıştırma

```bash
npm run typecheck   # yalnızca tip denetimi, dört proje
npm run check       # tip denetimi + sözdizimi + 256 paket
```

`npm run check` tip denetimini en başta çalıştırır: bir imza uyuşmazlığını
256 paketi beklemeden görmek daha hızlıdır. `--filter` verildiğinde tip
denetimi atlanır; o mod tek bir paketi hızlı çalıştırmak içindir.

## Kapının gerçekten kapı olduğu nasıl doğrulanır

```bash
printf '\nconst probe = /** @type {number} */ ("metin");\n' >> lib/rate-limit.mjs
npm run typecheck   # başarısız olmalı
git checkout lib/rate-limit.mjs
```

## Bilinen tercihler

- **Ayrımlı birleşimlerde `ok` literaldir.** `{ ok: false; error }` ve
  `{ ok: true; … }` döndüren sınırlar (cihaz eylemleri, hız sınırlayıcı,
  OAuth akışı) dönüş tiplerini elle yazar; çağıran taraf tek bir
  `ok === false` karşılaştırmasıyla hangi alanların var olduğunu görür.
  Doğruluk testi (`!result.ok`) yerine açık karşılaştırma kullanılır, çünkü
  yalnızca ikincisi daraltır.
- **Test ikizleri `TestDouble<T>` ile işaretlenir.** Bir ikiz, sınadığı yüzeyin
  yalnızca kullanılan kadarını uygular; gerçek kodda bu ad görünüyorsa orada
  eksik bir tip vardır.
- **Bilerek geçersiz girdi `any` ile işaretlenir.** Bir paket doğrulamanın
  reddettiğini sınıyorsa, girdinin yanlış olduğu açıkça yazılır.
