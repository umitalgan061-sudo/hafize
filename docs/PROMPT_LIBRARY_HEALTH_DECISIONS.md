# Health Center Tasarım Kararları

## Yerel tasarım

Health center backend endpoint kullanmaz. Bu, prompt verisini kalite raporu için uzak bir sisteme göndermeme kararını korur.

## Read-only tarama

Tanı işlemi varsayılan olarak read-only'dir. Kullanıcı onayı olmadan yazma işlemi yapılmaz.

## Mevcut normalizer

Yeni bir normalizasyon katmanı oluşturmak yerine Prompt Library çekirdeğinin davranışı kullanılır.

## Severity

Üç seviye yeterli kabul edilmiştir: error, warning, info.

## Benzerlik

Semantic model kullanmak yerine bounded token similarity seçilmiştir. Böylece offline/PWA kullanım korunur.

## Storage bağımsızlığı

Health state ana Prompt Library kaydına eklenmez. Böylece panel tercihleri veri modelini kirletmez.

## Export ayrımı

Tanı raporu ile problemli prompt export ayrı tutulur. Kullanıcı yalnızca teşhis sonucunu paylaşmak istiyorsa prompt gövdelerini dışa aktarmak zorunda kalmaz.

## Destructive action

Toplu silme eklenmemiştir. Health center yanlış pozitiflerde veri kaybı oluşturmamalıdır.

## Accessibility

Native form kontrolleri ve aria durumları tercih edilmiştir. Custom keyboard widget yapılmamıştır.

## PWA

Health asset'leri shell cache'tedir; prompt storage cache'e konmaz.

## Geliştirilebilirlik

Yeni issue kodları mevcut `addIssue` sözleşmesine eklenebilir; public API version 1 olarak korunur.
