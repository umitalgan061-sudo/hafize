# Markdown performans guardrail'ları

## Hedef

Markdown katmanı sohbet ana akışını bloke etmemelidir.

Renderer senkron olsa da input boyutu bounded olduğu için iş yükü sınırlıdır.

## Sınırlar

Maksimum input 24.000 karakterdir.

Maksimum block 240'tır.

Maksimum satır 1.200 karakterlik işlenmiş pencereye sahiptir.

Uzun kod bloğu yüksekliği CSS ile sınırlandırılır.

## Observer

MutationObserver sadece `#messages` alt ağacını izler.

Renderer kendi mutation'larını tekrar işleme riskini kaynak imzasıyla azaltır.

Kod araçları da yalnız `pre` elementleri tarar.

## Streaming

Her delta yeni kaynak hash'i yerine string karşılaştırmasıyla kontrol edilir.

Aynı kaynak için DOM replace yapılmaz.

## DOM

Her render sırasında mevcut `.content` çocukları bounded bir fragment ile değiştirilir.

Renderer globali hazır değilse sınırlı retry vardır.

## Clipboard

Kopyalama yalnız kullanıcı tıklamasıyla başlar.

Background interval kullanılmaz.

## Memory

Observer sayısı sayfa yaşam döngüsünde bir olarak tutulur.

`beforeunload` ile observer disconnect edilir.

Kod pre state'i WeakMap ile tutulur.

## Profiling

QA sırasında aşağıdaki senaryolar ölçülmelidir:

- 1 KB response,
- 8 KB response,
- 24 KB response,
- 20 satırlık code,
- 100 satırlık code,
- 240 blok sınırı.

Amaç UI frame drop ve kontrolsüz node büyümesi oluşturmamaktır.

## Kötü örnekler

Sınırsız Markdown parser eklenmemelidir.

Her mutation için debounce'suz ağır parser çalıştırılmamalıdır.

Image embed veya remote preview bu katmana eklenmemelidir.
