# Smart Fill Mimari Kararları

## ADR-01 — Ayrı modül

Smart Fill mevcut Prompt Library çekirdeğine ek dev bir handler olmak yerine ayrı JS modülü olarak tutulur. Böylece feature gerektiğinde devreden çıkarılabilir.

## ADR-02 — Core replacement

Değişken çözümleme ve replacement için Prompt Library'nin mevcut `extractVariables` ve `replaceVariables` fonksiyonları yeniden kullanılır. İki farklı regex davranışı oluşmaz.

## ADR-03 — Local preset

Presetler localStorage'da tutulur. Bu karar backend dependency'sini ve kullanıcı onayı gerektiren remote write kapsamını azaltır.

## ADR-04 — Preview before insert

Kullanıcı son metni görmeden composer'a aktarılmaz. Özellikle değişkenli promptlarda yanlış bağlam riskini azaltır.

## ADR-05 — No submit

Smart Fill form submit etmez. Bu karar açık kullanıcı eylemi olmadan model çağrısı başlamasını engeller.

## ADR-06 — Command palette

Composer seviyesinde `/prompt` seçici kullanılır. Bu, kullanıcıyı utility rail'e gitmek zorunda bırakmaz.

## ADR-07 — Result bound

Palette en fazla 12 sonuç gösterir. Daha fazla kayıt için arama daraltılır.

## ADR-08 — Preset isolation

Presetler Prompt Library export'una dahil edilmez. Böylece kişisel değerler yedek dosyalarına sızmaz.

## ADR-09 — Cache version

Shell asset listesi her değiştiğinde `CURRENT_CACHE` sürümü bir artırılır. Eski cache ile yeni index arasında kısmi yükleme riskini azaltır. Kontrol paketleri sabit bir sürüm numarası beklemez; `scripts/shell-cache-contract.mjs` yalnızca sürümlü isim biçimini, eski sürümlerin temizlendiğini ve listenin `index.html` ile iki yönlü eşleştiğini doğrular.

## ADR-10 — Live hints

Kullanıcı limitleri gönderimden önce görür. Sayaçlar yalnız form içeriğini özetler ve remote telemetry üretmez.

## ADR-11 — Security API

User-provided strings DOM'a yalnız text/value API'leriyle yazılır. HTML injection riskini azaltmak için HTML parsing yapılmaz.

## ADR-12 — Future work

Preset export/import ve encrypted vault bilinçli olarak kapsam dışıdır; bunlar ayrı threat model ve kullanıcı onayı gerektirir.
