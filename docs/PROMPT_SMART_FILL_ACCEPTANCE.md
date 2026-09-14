# Smart Fill Kabul Kriterleri

## Kullanıcı akışı

- [ ] Prompt Library'de `Kullan` değişkensiz istemi bozmadan composer'a aktarır.
- [ ] Değişkenli istem `Kullan` sonrası Smart Fill panelini açar.
- [ ] İlk değişken alanı otomatik odaklanır.
- [ ] Kullanıcı bütün değerleri girince önizleme doğru metni gösterir.
- [ ] `Mesaja aktar` composer'ı doldurur.
- [ ] `Mesaja aktar` model çağrısı başlatmaz.

## Preset

- [ ] Preset adı boşsa kayıt yapılmaz.
- [ ] En fazla 6 preset tutulur.
- [ ] Set seçildiğinde değerler doğru alanlara gelir.
- [ ] Setleri temizle yalnız ilgili prompt'u etkiler.

## Palette

- [ ] `/prompt` komutu palette'i açar.
- [ ] Arama metni 120 karakterle sınırlıdır.
- [ ] En fazla 12 sonuç gösterilir.
- [ ] Tam başlık en yüksek önceliktedir.
- [ ] Değişkenli sonuç Smart Fill'e devredilir.

## Erişilebilirlik

- [ ] Dialog semantiği vardır.
- [ ] Inputlar labelled'dır.
- [ ] Escape kapatır.
- [ ] Tab panel içinde dolaşır.
- [ ] Panel kapanınca önceki focus geri döner.
- [ ] Palette active option `aria-selected` ile bellidir.

## Güvenlik

- [ ] Remote fetch yoktur.
- [ ] HTML injection yoktur.
- [ ] Prompt değerleri loglanmaz.
- [ ] Secret/token storage yoktur.
- [ ] Storage hatası ana UI'ı durdurmaz.

## PWA

- [ ] Smart Fill asset'leri shell cache'dedir.
- [ ] Hint asset'i shell cache'dedir.
- [ ] Palette asset'leri shell cache'dedir.
- [ ] Cache sürümü günceldir.

## Release sonucu

Tüm kaynak kontratları başarılı ve browser E2E ayrıca uygulanmışsa feature release'e hazır kabul edilir. E2E yoksa bu durum release notuna yazılır.
