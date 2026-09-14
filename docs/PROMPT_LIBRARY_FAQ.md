# Prompt Library SSS

## Prompt'lar sunucuya gidiyor mu?

Hayır. Kütüphane kayıtları browser localStorage alanında tutulur.

Bir prompt'u `Kullan` ile composer'a aktarmak da yalnız textarea'yı değiştirir.

## Kullanınca otomatik gönderilir mi?

Hayır. Gönderme kullanıcı tarafından yapılır.

## Başlangıç prompt'ları neden tekrar oluşmuyor?

Starter seed mevcut collection boş değilse yeni kayıt eklemez. Restore eylemi yalnız eksik starter başlıklarını ekler.

## Aynı prompt dosyasını import edersem ne olur?

Kayıt overwrite edilmez. Çakışan id'ye yeni id atanır.

## Prompt'lar nerede?

`hafize.prompt-library.v1` browser storage anahtarında.

## Cihaz değiştirince gelir mi?

Hayır. Bu sürüm cloud sync sağlamaz. JSON export/import ile manuel taşıma yapılabilir.

## Kopyala ne yapar?

Prompt gövdesini clipboard'a verir. Clipboard API yoksa status mesajı gösterilir.

## Çoğalt ne yapar?

Aynı içeriğin yeni id'li kopyasını oluşturur; favorite kapalı, kullanım sayısı sıfırdır.

## Neden 120 kayıt sınırı var?

İlk sürümün arama ve render maliyetini bounded tutmak için.

## Neden 8.000 karakter sınırı var?

Tek bir prompt'un local UI ve export payload'ını aşırı büyütmesini önlemek için.

## Değişkenler nasıl çalışıyor?

`{{konu}}` gibi token'lar kullanım sırasında sorulur.

## Eksik değişken değeri ne olur?

Kullanıcı boş değer verebilir; token boş string ile değiştirilir.

## HTML yazabilir miyim?

Evet, metin olarak saklanabilir. HTML olarak çalıştırılmaz.

## Prompt body'de script olursa?

Script metin olarak saklanır ve textarea'ya text olarak yazılır. Execute edilmez.

## Import sırasında bozuk dosya verilirse?

Mevcut collection değişmeden hata status'u gösterilir.

## PWA offline çalışır mı?

Prompt library shell asset'leri cache edildiği için UI kodu offline shell ile gelir. Prompt kayıtları zaten local storage'dadır.
