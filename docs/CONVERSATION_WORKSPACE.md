# Conversation Workspace

## Amaç

`conversation-workspace.js`, Hafize'nin yerel sohbet geçmişini yalnızca tek tek açma/silme eylemlerinden çıkarıp kontrollü bir çalışma alanına dönüştürür. Özellik tamamen tarayıcı içindedir. Sunucuya yeni uç, dosya yükleme protokolü, OAuth scope veya yeni secret eklemez.

Bu yüzeyde tek bir yönetim akışı bulunur. Kullanıcı arama yapabilir, görünümü filtreleyebilir, sıralamayı değiştirebilir, sohbetleri topluca seçebilir ve seçilen kayıtlar üzerinde arşivleme, sabitleme, çoğaltma, etiketleme, dışa aktarma veya silme işlemlerini uygulayabilir. JSON yedekleri de aynı doğrulama katmanından geçirilerek içe alınır.

## Yerel veri modeli

Sohbetler `hafize.conversations.v1` anahtarında tutulur. Çalışma alanının kendi görünüm tercihi ayrı olarak `hafize.conversation-workspace.v1` anahtarına yazılır. Görünüm state'i sohbet içeriğinden ayrıdır ve bozulmuşsa güvenli varsayılana döner.

Conversation nesnesinde mevcut alanlar korunur; workspace yeni olarak şu opsiyonel alanları kullanır:

```text
archived: boolean
pinned: boolean
tags: string[]
```

Bir dışa aktarma kaydı şu yapıyı kullanır:

```json
{
  "format": "hafize-conversations",
  "version": 2,
  "exportedAt": "ISO-8601",
  "conversations": []
}
```

İçe aktarma ayrıca yalnızca ham conversation dizisini de kabul eder. Böylece önceki basit JSON yedekleri kırılmaz.

## Sınırlar

| Alan | Sınır | Neden |
| --- | ---: | --- |
| Yerel sohbet sayısı | 30 | Uygulamanın mevcut history sınırıyla aynı |
| Başlık | 80 karakter | Sidebar düzenini korumak |
| Etiket | 24 karakter | Dar ekranlarda taşmayı önlemek |
| Etiket sayısı | 8 / sohbet | Yerel veri patlamasını önlemek |
| İçe aktarma dosyası | 1 MB | Tarayıcı belleğini sınırlamak |
| İçe aktarma sohbet sayısı | 30 | Tek yedek işlemini bounded tutmak |
| Mesaj sayısı | 200 / sohbet | Kötü niyetli veya bozuk yedeği sınırlamak |
| Mesaj içeriği | 12000 karakter | Composer sözleşmesiyle aynı üst sınır |
| Tool etkinlikleri | 4 / mesaj | Mevcut mesaj UI bütçesiyle uyum |
| Arama | 120 karakter | Görünüm state'inin gereksiz büyümesini önlemek |

Bu sınırlar üretim server davranışının yerine geçmez. Yalnız tarayıcıda işlenecek yerel verinin yüzey alanını daraltır.

## Filtreleme ve sıralama

`Tüm sohbetler` tüm kayıtları gösterir. `Arşivlenmemiş` ve `Arşivlenmiş` karşılıklı görünüm sağlar. `Sabitlenmiş` yalnız `pinned === true` kayıtlarını listeler. `Etiketli` en az bir etiket taşıyan sohbetleri gösterir.

Etiket seçicisi ayrıca belirli bir etikete daraltır. Kullanıcı etiket seçtiğinde filtre otomatik olarak `Etiketli` görünümüne alınır.

Arama başlık, ajan kimliği, etiket ve mesaj metnini kapsar. Arama normalleştirmesinde Türkçe küçük harf davranışı kullanılır. Ham HTML/DOM eşleşmesi yapılmaz.

Sıralama:

```text
updated-desc   Son güncellenen
updated-asc    En eski güncellenen
title-asc      Başlığa göre
created-desc   Yeni oluşturulan
created-asc    Eski oluşturulan
```

Tarih alanları geçersizse epoch tabanına düşer. Böylece bozuk import kaydı UI sıralamasını çökertmez.

## Toplu seçim

Her görünür sidebar satırı yönetim checkbox'ı kazanır. Checkbox tıklaması sohbet açma davranışını durdurur. `Tümünü seç` yalnız mevcut filtre sonucundaki görünür satırları seçer; `Seçimi temizle` tüm seçimi boşaltır.

Seçim state'i yalnız id listesi olarak tutulur. Sohbet nesneleri UI state içine kopyalanmaz. Depodaki kayıt silinmiş veya başka bir sekmede kaldırılmışsa `pruneMissingSelection()` ile id seçimden çıkarılır.

## Arşivleme

Arşiv, kaydı silmez. `archived=true` yapılır ve güncelleme zamanı yenilenir. Arşivden çıkarma aynı alanı `false` yapar. Eski history management modülünün tekli sabitleme davranışı korunur.

Arşivlenen sohbetler normal aktif görünümde saklanabilir ama varsayılan `all` görünümünde bulunmaya devam eder. Kullanıcı bunları tamamen ayırmak isterse `Arşivlenmiş` filtresi vardır.

## Sabitleme

`pinned=true` kaydı silmeden daha sonra hızlı erişim için işaretler. Workspace bulk pin/unpin ile mevcut tekli pin özelliğini tamamlar.

Pin işlemi sohbet başlığını veya mesajları değiştirmez. Kalıcı veri yalnız boolean alan üzerinden güncellenir.

## Etiketler

Etiketler serbest metindir fakat trim edilir, ardışık boşluklar sadeleştirilir ve baştaki `#` karakterleri temizlenir. Büyük/küçük harf karşılaştırması Türkçe locale ile normalleştirilir.

Her sohbet en fazla sekiz benzersiz etiket taşır. Aynı etiket tekrar eklenirse ikinci kez yazılmaz. Bulk etiket işlemi kullanıcıya açık bir `prompt()` adımıyla gerçekleşir; workspace kendi kendine etiket üretemez.

Etiketler mesaj içeriğinin parçası değildir ve backend'e gönderilmez. Arama sırasında yalnız yerel history metadata olarak kullanılır.

## Çoğaltma

Kopyalama yalnız seçilen sohbetlerin mevcut yerel verisini klonlar. Orijinal kimliği tekrar kullanmak yerine yeni benzersiz bir `copy-*` kimliği üretilir. Kopyanın oluşturulma ve güncellenme tarihleri yeni zamana alınır; mesajların kimlikleri içeride korunabilir çünkü conversation kimliği benzersizdir.

Yerel 30 sohbet sınırı doluysa yeni kopya üretilmez. Üretim sırasında mevcut kayıtlar yanlışlıkla silinmez.

## Silme

Toplu silme geri alınamaz. İşlem öncesinde seçili sohbet sayısı açıkça kullanıcıya gösterilir ve `confirm()` kullanılır. Onay yoksa hiçbir veri yazılmaz.

Silme sonrasında UI, mevcut uygulama başlangıç mantığının yeni aktif conversation seçmesini sağlayacak kontrollü bir yeniden yükleme yapar. Bu yeniden yükleme yalnız veri mutasyonundan sonra gerçekleşir.

## JSON dışa aktarma

Seçilen sohbetler JSON yedeği olarak Blob üzerinden indirilir. Yalnız seçilmiş kayıtlar çıkar. Dışa aktarma için ağ isteği yapılmaz.

Dosya adı tarih içerir:

```text
hafize-sohbet-secili-YYYY-MM-DD.json
```

Object URL kısa ömürlü tutulur ve `URL.revokeObjectURL()` ile bırakılır.

## JSON içe aktarma

İçe aktarma dosyası önce boyut açısından kontrol edilir. Sonra JSON ayrıştırılır; yalnız beklenen `conversations` dizisi veya ham dizi kabul edilir. Her conversation normalize edilir.

Normalize aşamasında:

- id yoksa kayıt reddedilir,
- duplicate id'ler ayıklanır,
- role yalnız `assistant` veya `user` olarak normalize edilir,
- mesaj içeriği bounded substring'e indirilir,
- başlık ve tag'ler uzunluk sınırına çekilir,
- tag sayısı bounded tutulur,
- mesaj sayısı bounded tutulur,
- tool activity sayısı ve state'leri allowlist ile sınırlanır,
- tarih bozuksa güvenli fallback kullanılır.

Mevcut id çakışması varsa import edilen kayıt yeni `import-*` id'si alır. Var olan sohbetin üzerine sessizce yazılmaz.

Birleştirme sonucu en fazla 30 kayıt tutulur. Dosyanın geri kalanı sessizce sonsuz büyütülmez.

## Güvenlik

Workspace frontend'de çalıştığı için kullanıcıya ait yerel veriyi güvenilmeyen import girdisi gibi ele alır. JSON kaynağı uygulamanın kendi ürettiği bir yedek olsa bile normalize edilmeden doğrudan DOM'a yazılmaz.

Hiçbir import alanı `innerHTML`, `outerHTML` veya script üretimi için kullanılmaz. UI metinleri `textContent` veya DOM text node'ları üzerinden eklenir.

Workspace herhangi bir Authorization header üretmez ve `fetch()` kullanmaz. Bu nedenle NVIDIA, GitHub, Google, Gmail veya Canva secret'ları bu akışa girmez.

Destructive işlemler yalnız kullanıcının açık `confirm()` onayıyla çalışır. Etiket mutasyonu için açık `prompt()` kullanılır.

## PWA

`conversation-workspace.js` ve `.css` shell cache listesinde yer alır. Cache revision `v22`'ye yükseltilmiştir. `/api/*` yolları için service worker davranışı değişmez; workspace yalnız localStorage ile çalışır.

Offline durumda daha önce yüklenmiş sohbet yönetim yüzeyi açılabilir. Model çağrıları veya dış provider istekleri workspace üzerinden başlatılmaz.

## Çoklu sekme

Bu bölüm cross-tab (sekmeler arası) tutarlılık sözleşmesini tanımlar.

Tarayıcının yerleşik `storage` olayı başka sekmede yapılan history veya workspace state değişikliklerini takip eder. Aynı sekmedeki toplu mutation sonrasında ayrıca `hafize:conversation-workspace-changed` CustomEvent yayınlanır.

CustomEvent, global uygulama event oturumuna veri taşıyan yeni bir backend protokolü değildir. Payload kısa bir `reason` metni ile sınırlıdır.

## Erişilebilirlik

Çalışma alanı `section` olarak tanımlanır. Arama alanı, filtreler, sıralama, etiket seçicisi ve tüm yönetim düğmeleri `aria-label` taşır. Seçili count ve quota durumu `role=status` veya progressbar semantiğiyle duyurulur.

Checkbox kontrolleri native input olarak tutulur. Klavye ile Enter/Space kullanımı tarayıcının native checkbox davranışına bırakılır; click event yalnız sohbet satırının açılmasını engeller.

`Escape`, workspace aramasını temizlemenin geri dönüş yoludur. Bu olay textarea gibi başka input'ların normal davranışını hedef almaz çünkü yalnız workspace search alanında dinlenir.

## Performans

Workspace her storage değişikliğinde tüm local history'yi yeniden parse eder. History üst sınırı 30 olduğu için maliyet bounded kalır. Sidebar MutationObserver ise yalnız conversation satırları değiştiğinde checkbox dekorasyonunu tazeler.

Arama sırasında DOM için ayrı bir kopya listesi oluşturulmaz. Mevcut satırlar `hidden` ve `order` alanlarıyla kontrol edilir.

İçe aktarma sırasında dosya, JSON parse edilmeden önce boyut limitiyle kesilir. Conversation/message/tag dizileri daha sonra tekrar bounded edilir.

## Hata davranışı

LocalStorage okuma başarısızsa boş history veya default workspace state kullanılır. LocalStorage yazma başarısızsa kullanıcıya toast gösterilir ve mutasyonun devam etmesine izin verilmez.

JSON parse, Blob oluşturma, URL üretme, structured clone ve tarih normalizasyonu hata fırlatsa bile workspace global uygulamayı çökertmemelidir.

## Test sözleşmesi

`node scripts/test-conversation-workspace.mjs` statik contract ve güvenlik guard'larını doğrular. Adversarial suite import sınırlarını, duplicate id davranışını, role/tag normalization sözleşmesini ve secret/network yokluğunu kontrol eder.

CI ortamında tam `npm run check` ayrıca çalıştırılmalıdır. Bu değişiklik `.github/workflows/` dosyalarına dokunmaz.

## Geri alma

Özellik tek squash commit ile geri alınabilir. Geri alma sırasında:

- `public/index.html` içinden iki workspace asset referansı çıkarılır,
- `public/sw-policy.js` içinden workspace assetleri ve v22 revision değişikliği kaldırılır,
- `conversation-workspace.js`, `.css`, test ve bu doküman silinir,
- eski localStorage anahtarları temizlenmek zorunda değildir; kullanılmadıklarında etkisiz kalırlar.

Mevcut `hafize.conversations.v1` verisi workspace kaldırıldığında silinmez.
