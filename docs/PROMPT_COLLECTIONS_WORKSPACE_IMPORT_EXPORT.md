# Prompt Collection Workspace — Import / Export

## Dosya biçimi

Workspace yedekleri JSON olarak üretilir.

Top-level `version` değeri 2'dir.

`source` değeri `hafize-prompt-library-collections-workspace` olur.

`exportedAt` yedek oluşturma zamanını temsil eder.

`collections` koleksiyon kayıtlarını içerir.

`metadataByName` workspace metadata'sını koleksiyon adıyla ilişkilendirir.

## Export

Export kullanıcı tarafından başlatılır.

Tarayıcıda bir Blob oluşturulur.

Object URL oluşturulur.

Dosya `hafize-prompt-collections-workspace.json` adıyla indirilir.

İndirme sonrasında Object URL revoke edilir.

Export sonucu kullanıcıya status alanında bildirilir.

Export için network bağlantısı gerekmez.

## Boyut sınırı

Workspace export 750 KB hedef sınırıyla bounded olur.

Çıktı sınırı aşarsa koleksiyon listesi küçültülür.

Bu fallback bellekte sınırsız çıktı üretmeye çalışmaz.

Kullanım metadata'sı da bounded koleksiyonlar üzerinden yazılır.

## Import

Import kullanıcı dosya seçtiğinde başlar.

Dosya 500 KB'ı geçerse işlenmez.

Dosya metin olarak okunur.

JSON parse başarısızsa mevcut state korunur.

Workspace API'nin `import` fonksiyonu çağrılır.

Core collection import mekanizması kullanılır.

## Dedupe

Aynı isimli mevcut koleksiyon tekrar oluşturulmaz.

Yeni koleksiyonlar core tarafından yeni id ile eklenebilir.

Metadata import sırasında isim üzerinden eşleşir.

Eşleşmeyen metadata kaydı saklanmaz.

## Metadata

Favori durumu korunabilir.

Arşiv durumu korunabilir.

Kullanım sayısı korunabilir.

Son kullanım zamanı korunabilir.

Geçersiz metadata normalize edilir.

## Prompt bağı

Collection export prompt body içeriğini kopyalamaz.

Yalnızca prompt id ilişkileri koleksiyon kaydında bulunur.

Eksik prompt id'leri çekirdek prune davranışına bırakılır.

Bir collection dosyası prompt yedeğinin yerine geçmez.

## Güvenli kullanım

Yedek dosyaları koleksiyon adlarını içerdiği için kullanıcı tarafından korunmalıdır.

Import bilinmeyen alanları kabul etse bile normalize edilmemiş değerleri doğrudan DOM'a basmaz.

Export kaydı dış servise göndermez.

Dosya yolu veya URL kullanıcı girdisi olarak kullanılmaz.

## Operasyon

Import sonrası imported/skipped değerleri status mesajında görünür.

Geçersiz dosyada mevcut koleksiyonlar korunur.

Import başarısız olduğunda yarım UI state bırakılmamalıdır.

Workspace state yeniden normalize edilir.

## Uyumluluk

Eski koleksiyon export dosyaları core import API üzerinden kullanılabilir.

Workspace v2 metadata'sı olmayan import'lar varsayılan değerleri alır.

Collection key değişmez.

Workspace key ilk kez import sonrası oluşturulabilir.

## Test

Dosya boyutu kontrolü test edilir.

JSON parse davranışı test edilir.

Metadata isim eşleşmesi test edilir.

PWA asset wiring test edilir.

Network izolasyonu test edilir.
