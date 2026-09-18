# Smart Fill Migration ve Geri Alma

## Migration ilkesi

Smart Fill mevcut Prompt Library kayıt formatını değiştirmeyi zorunlu kılmaz.

Eski bir prompt kaydında `variables` alanı eksik olsa bile core extraction body içinden değişkenleri yeniden çıkarabilir.

Kullanıcı prompt gövdesini değiştirmeden Smart Fill kullanabilir.

No-op migration tercih edilir.

## Storage namespaces

Ana prompt verisi: `hafize.prompt-library.v1`

Hatırlanan değerler: `hafize.prompt-library.fill.v1`

Presetler: `hafize.prompt-library.fill.presets.v1`

History: `hafize.prompt-library.fill.history.v1`

Her namespace bağımsızdır.

## İlk kullanım

Eski prompt storage okunduğunda hiçbir ayrı migration job çalıştırılmaz.

Smart Fill ilk açıldığında değişkenleri hesaplar.

Hatırlama seçilmezse yeni storage yazılmaz.

Preset kaydedilmezse preset storage yazılmaz.

History oluşturulmazsa history storage yazılmaz.

## Upgrade

Yeni bir Smart Fill sürümü yalnız kendi bounded storage formatını normalize eder.

Bozuk JSON boş fallback'e düşer.

Beklenmeyen property'ler yok sayılır.

Değer limitleri yeniden uygulanır.

Prompt id foreign key olarak korunur.

## Duplicate prompt ids

Prompt import işlemi duplicate id'leri yeni id ile normalize ediyorsa Smart Fill doğru yeni id'yi kullanır.

Preset grupları eski id'ye bağlı kalabilir; bunun otomatik prompt migration'ına dönüşmemesi için id eşleşmesi açık tutulur.

Silinen promptun presetinin yeni prompta otomatik taşınması beklenmez.

## Rollback

Smart Fill UI katmanı kaldırılabilir.

Prompt Library core kalır.

Usage Insights kalır.

Ana prompt storage silinmez.

Hatırlanan değerler ayrı namespace'tedir.

Presetler ayrı namespace'tedir.

History ayrı namespace'tedir.

Rollback sonrası uygulama açıldığında core prompt listesi Smart Fill olmadan çalışmaya devam etmelidir.

## Temizlik

Kullanıcı Smart Fill verisini privacy UI üzerinden temizleyebilir.

Gerekirse manuel bakımda üç ayrı namespace silinebilir.

Bu işlem prompt kayıtlarını silmez.

Backup dosyaları silinebilir.

## Compatibility

Tarayıcı storage API çalışmıyorsa core Prompt Library mevcut davranışına dönmelidir.

Native dialog desteklenmiyorsa hiçbir auto-send yapılmaz.

MutationObserver yoksa yardımcı UI katmanları çalışmayabilir; core davranış korunur.

Clipboard veya Blob API yoksa backup/copy işlevleri tek başına devre dışı kalabilir.

## Release checklist

[ ] Ana prompt storage formatı korunuyor.

[ ] Yeni key isimleri versioned.

[ ] Key'ler birbirine yazılmıyor.

[ ] Prompt id başlık yerine key olarak kullanılıyor.

[ ] Rollback ana sohbeti bozmuyor.

[ ] Testler namespace ayrımını doğruluyor.

[ ] PWA asset listesi sürümlendi.

[ ] PR açıklaması gerçek diff ölçüsünü içeriyor.
