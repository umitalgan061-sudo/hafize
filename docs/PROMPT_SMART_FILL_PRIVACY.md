# Smart Fill Gizlilik Sınırları

Smart Fill kullanıcı tarafından girilen değişken değerlerini yalnızca yerel form ve preset akışında kullanır.

## Yerel veri

Prompt gövdesi mevcut Prompt Library kaydından okunur. Değişken değerleri form inputlarından alınır. Önizleme ve composer aktarımı tarayıcı belleğinde gerçekleşir.

## Uzak veri

Smart Fill API endpoint'i çağırmaz. Analytics, telemetry, remote sync ve üçüncü taraf prompt servisi yoktur.

## Clipboard

Clipboard yalnızca kullanıcı `Önizlemeyi kopyala` düğmesine bastığında kullanılır. Clipboard başarısızlığı ana feature'ı durdurmaz.

## Browser storage

Presetler localStorage'da istem bazlı anahtarlarda tutulur. Bu veriler Prompt Library export'undan bilerek ayrıdır.

## Log politikası

Smart Fill hata mesajları kullanıcı arayüzünde kısa ve içeriksiz tutulur. Prompt body veya değişken value server loglarına gönderilmez.

## Temizleme

Panel kapandığında aktif form alanları DOM'dan çıkar. Kalıcı presetler yalnız kullanıcı `Setleri temizle` eylemini yaptığında silinir.

## Gizlilik riskleri

Cihazın ortak kullanılması localStorage'daki presetlere erişim riski oluşturabilir. Uygulama bu cihaz düzeyi riski server-side hesabın konusu yapmaz.

## Export ayrımı

Prompt Library export'u prompt kaydını taşır ancak Smart Fill presetlerini taşımaz. Böylece yedek dosyası kişisel değerlerin istem dışı yayılmasına neden olmaz.

## Güvenli UX

Son metin gönderilmeden önce önizlemenin gösterilmesi kullanıcıya kişisel veya hassas bir değeri kontrol etme fırsatı verir.

## Veri minimizasyonu

Preset şeması yalnız `id`, `name` ve `values` tutar. Kullanıcı metadata'sı, conversation id'si, browser fingerprint veya analytics timestamp'i eklenmez.
