# Connector yetenek kataloğu

## GitHub

Mevcut workspace salt-okunur yetenekleri:

- repository.read
- directory.read
- compare.read
- commit.read
- pull.read

Bu capability'ler connector hub tarafından yalnızca açıklama amacıyla gösterilir.

## Google / Gmail

- gmail.read

Mail gönderme veya modify capability'si bu hub'a ait değildir.

## Canva

- profile.read
- asset.read
- design.meta.read
- design.content.read

Yazma capability'leri burada gösterilmez ve tetiklenmez.

## Neden gösteriliyor?

Kullanıcı “bağlı” durumunun hangi işlev sınırlarıyla ilişkili olduğunu açıkça görebilir.

## Security

Capability listesi statiktir. Browser tarafından yetki vermez.

Server-side policy authoritative kaynaktır.

## UI

Capability'ler chip biçiminde görünür.

Renk tek başına anlam taşımaz.

## Compatibility

Yeni capability eklendiğinde katalog genişletilebilir. Eski provider durum kodları korunur.

## DoD

- capability listesi backend secret içermez
- write operation başlatmaz
- status state ile karışmaz
