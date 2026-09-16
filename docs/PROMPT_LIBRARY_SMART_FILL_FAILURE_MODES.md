# Smart Fill Failure Modes

## Dialog açılmıyor

Olası neden: Prompt Library kartı henüz oluşmadı, prompt id yok veya değişken bulunmuyor.

Beklenen sonuç: Ana Prompt Library çalışmaya devam eder; exception fırlatılmaz.

## Storage okunamıyor

Olası neden: browser storage engeli, bozuk JSON veya kota hatası.

Beklenen sonuç: Boş remembered/preset/history verisiyle devam edilir.

Ana prompt kaydı silinmez.

## Storage yazılamıyor

Olası neden: storage disabled veya quota exceeded.

Beklenen sonuç: Composer transferi mümkünse devam eder. Yalnız kalıcı hatırlama/history başarısız olabilir.

## Composer bulunamıyor

Beklenen sonuç: `Mesaja aktar` chat göndermez ve kullanım sayacı artırmaz.

## Prompt silinmiş

Beklenen sonuç: Dialog tekrar açıldığında prompt yeniden storage'dan doğrulanır. Bulunamayan kayda usage yazılmaz.

## Duplicate başlık

Beklenen sonuç: Prompt title değil `data-prompt-id` kullanılır. Aynı başlıklı iki prompt birbirinin preset/history değerini kullanmaz.

## Bozuk preset backup

Beklenen sonuç: JSON parse hatası güvenli şekilde yutulur; mevcut preset grubu olduğu gibi kalır.

## Çok büyük backup

Beklenen sonuç: Dosya kabul edilmez. Bounded limit uygulanır.

## Bozuk history backup

Beklenen sonuç: normalize edilmeyen kayıtlar atlanır.

## Çok uzun variable

Beklenen sonuç: 1000 karakter limiti uygulanır. Preview ve composer aynı bounded değeri görür.

## Çok fazla variable

Beklenen sonuç: Core değişken sınırı uygulanır; yardımcı UI bu sınırı aşmaz.

## Clipboard yok

Beklenen sonuç: Preview kopyalama başarısız olabilir; form aktarımı çalışmaya devam eder.

## Native dialog yok

Beklenen sonuç: Smart Fill yardımcı katmanı devre dışı kalabilir. Otomatik chat submit gerçekleşmez.

## MutationObserver yok

Beklenen sonuç: Temel fill API'si helper UI'lara bağımlı kalmadan mümkün olan yerde kullanılabilir.

## JS helper sırası

Beklenen sonuç: Usage loader assetleri marker ile tekilleştirir. Aynı script ikinci kez eklenmez.

## Service worker eski cache

Beklenen sonuç: Yeni asset shell cache'te yoksa browser network üzerinden isteyebilir. API request cache'e alınmaz.

## Page unload

Beklenen sonuç: Session Map temizlenir; persistent storage etkilenmez.

## Privacy cleanup

Beklenen sonuç: Smart Fill memory katmanları silinir. `hafize.prompt-library.v1` ana prompt kayıtları silinmez.

## Kullanıcı iptali

Beklenen sonuç: Prompt usage değişmez, history yazılmaz ve composer değiştirilmez.

## Preset seçimi

Beklenen sonuç: Input değerleri değişir ve preview yenilenir. Usage sayacı artmaz.

## History uygulama

Beklenen sonuç: Alanlar geçmiş değerlerle dolar ve preview yenilenir. Transfer yapılana kadar usage sayacı artmaz.

## Default uygulama

Beklenen sonuç: Boş ortak alanlar için sabit varsayılan öneriler yazılabilir. AI çağrısı yapılmaz.

## Auto-send kontrolü

Beklenen sonuç: Smart Fill hiçbir koşulda formun chat gönderim davranışını otomatik çalıştırmaz.

## Güvenlik özeti

Kullanıcı içeriği HTML olarak parse edilmez. Smart Fill credential veya token okuyamaz. Kendi ağı olmayan bir client helper olarak kalır.

## Destek ilkesi

Hata raporu prompt/variable içeriğini istememelidir. Browser bilgisi, prompt id ve hata adımı yeterli teşhis bağlamıdır.
