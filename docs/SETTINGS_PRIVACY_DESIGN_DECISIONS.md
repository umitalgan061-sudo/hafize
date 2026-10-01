# Gizlilik Merkezi Tasarım Kararları

## Allowlist over discovery

Storage'daki bütün anahtarları kullanıcıya sunmak yerine yalnız uygulamanın bildiği yüzeyler sunulur. Böylece başka uygulamaların veya gelecekteki deneysel alanların yanlışlıkla silinmesi önlenir.

## Counts over content

Gizlilik paneli içerik inceleme aracı değildir. Kullanıcıya kapasite ve yüzey bilgisi verir; metin veya kayıt değerlerini göstermemeyi tercih eder.

## Explicit destructive confirmation

Bir tıklamayla toplu silme yapılmaz. Özellikle tüm bilinen alanları temizleyen akış ikinci bir metin doğrulama kullanır.

## Unknown preservation

Bilinmeyen alanlar saklanır. Kullanıcının başka bir özelliğe ait veriyi kaybetme ihtimali azaltılır.

## Local-only

Sunucuya yeni veri yolu eklenmez. Rapor download/copy kullanıcı eylemiyle cihaz üzerinde gerçekleşir.

## Progressive enhancement

Storage estimate gibi isteğe bağlı browser yetenekleri kullanılabildiğinde zenginleştirme sağlar; yoksa temel inventory ve clear işlevleri devam eder.
