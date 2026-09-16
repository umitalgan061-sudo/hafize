# Schedule Storage ve Kapasite

## Varsayılan

Encrypted schedule persistence varsayılan olarak 64 MiB maksimum dosya boyutu ile açılır. Bu sınır görev sayısı kotası değildir; fiziksel encrypted snapshot boyutunun kontrollü tutulması içindir.

`HAFIZE_SCHEDULE_STORAGE_MAX_FILE_BYTES` ile deployment özelinde değer artırılabilir. İzin verilen aralık 4 MiB ile 256 MiB'dir.

Örnek:

```env
HAFIZE_SCHEDULE_STORAGE_FILE=/var/lib/hafize/schedules.enc
HAFIZE_SCHEDULE_STORAGE_KEY_BASE64=<32-byte-base64url-key>
HAFIZE_SCHEDULE_STORAGE_MAX_FILE_BYTES=134217728
```

## Şifreleme

Yeni dosyalar AES-256-GCM ve gzip sıkıştırmalı format v2 ile yazılır. Şifreli dosyada görev metni, schedule id veya trace id plaintext olarak görünmez.

Format v1 dosyaları geriye dönük olarak okunabilir. İlk başarılı v2 yazımı sonraki kaydı sıkıştırılmış biçime geçirir.

## Atomik yazma

Kaydetme geçici dosyaya yazılır, `sync()` sonrası hedef dosyaya rename edilir ve hedef dosya 0600 permission ile tutulur. Yazma başarısız olduğunda geçici dosya temizlenir.

## Sınırsız görev ifadesi

Uygulama store seviyesinde varsayılan olarak görev adedine sabit bir üst sınır koymaz. Ancak encrypted-file adapter tek dosya yaklaşımı kullandığı için gerçek dünya kapasitesi disk ve dosya boyutu ile sınırlıdır.

Çok büyük kurulumlarda şu ayrım korunmalıdır:

- görev sayısı için yapay uygulama kotası yoktur;
- tek isteğin boyutu, tek sayfanın boyutu ve bulk işlem boyutu bounded'dır;
- fiziksel storage kapasitesi bounded'dır;
- yüksek yazma/okuma yoğunluğunda queue/database tabanlı shard edilmiş storage tercih edilmelidir.

## Veri kaybı koruması

Persistence katmanı mutation'ları sıraya alır. Adapter save başarısız olursa yeni state aktif state'e geçirilmez. Böylece başarısız bir yazma çağrısı memory state ile durable state arasında sessiz divergence oluşturmaz.

## Anahtar yönetimi

Storage anahtarı 32 byte olmalıdır. Runtime config anahtarı kopyalayarak adapter'a verir ve kullanım sonrasında local buffer'ı sıfırlar. Secret repo veya frontend'e konulmamalıdır.
