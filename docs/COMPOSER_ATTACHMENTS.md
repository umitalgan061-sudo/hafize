# Composer Ekleri

Composer Ekleri, kullanıcı tarafından seçilen metin ve kod dosyalarını sohbet composer'ına kontrollü biçimde taşıyan yerel bir çalışma alanıdır.

## Temel sözleşme

Dosyanın kendisi sunucuya yüklenmez. Tarayıcı File API ile okunur ve içerik yalnızca aktif sayfa belleğindeki ek kuyruğunda tutulur.

Kullanıcı üç ayrı adım üzerinde tam kontrol sahibidir:
1. Dosyayı seçer.
2. Dosyayı mesaja dahil edip etmeyeceğini checkbox ile belirler.
3. Seçilenleri mesaja ekle düğmesine basar.

Üçüncü adım gerçekleşmeden composer değeri dosya içeriği nedeniyle değişmez.

## Sınırlar

| Kaynak | Sınır |
| --- | ---: |
| Eşzamanlı ek | 4 |
| Tek dosya | 256 KB |
| Tek dosya metni | 80.000 karakter |
| Bekleyen toplam metin | 200.000 karakter |
| Tek ekleme | 11.500 karakter |
| Tek satır aralığı | 400 satır |
| Dosya adı | 120 karakter |
| Önizleme | 12 satır |

Composer'ın kendi maxlength değeri ayrıca son yazma sınırını belirler.

## İçerik

Allowlist metin ve kaynak kodu odaklıdır. Markdown, JSON, CSV, JavaScript/TypeScript, CSS, HTML/XML, YAML, Python, Java, Kotlin, C/C++, C#, Go, Rust, Ruby, PHP, Swift, shell, SQL, GraphQL ve log türleri desteklenir.

CRLF ve CR satır sonları LF biçimine dönüştürülür. Satır sonu boşlukları ve NUL karakterleri temizlenir.

## Satır aralığı

Büyük kaynak dosyalarında yalnız gerekli bölüm seçilebilir. Başlangıç ve bitiş satırı policy katmanında clamp edilir ve aralık 400 satırı geçemez.

## Gönderim

Ekleme eylemi yalnız textarea değerini değiştirir ve input olayı yayınlar. Submit, requestSubmit veya gönder düğmesi çağrılmaz.

Kullanıcı son metni inceleyip normal Gönder eylemini kendisi başlatır.

## Gizlilik

Bekleyen dosya içeriği localStorage, sessionStorage, IndexedDB, Cache API, cookie veya URL alanına yazılmaz. Kullanım telemetry'si üretilmez.

Bekleyen içerik yaklaşık 15 dakika sonra otomatik temizlenir.

## PWA

Uygulama kodu ve CSS shell cache'e girer; kullanıcı dosya içeriği cache'lenmez.

Bu özellik bir dosya yükleme servisi değildir. Composer'a metin hazırlama özelliğidir.