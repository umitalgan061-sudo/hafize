# Yerel Veri Merkezi — Kullanıcı Rehberi

## Nerede?

Ayarlar bölümünü açtığında Yerel Veri Merkezi alanı uygulamanın cihazında tuttuğu temel verileri listeler.

## Ne görebilirsin?

Her satır hangi veri alanının bulunduğunu, ne kadar yaklaşık yer kullandığını ve kaç kayıt/alan içerdiğini gösterir. Ham mesaj geçmişi veya prompt gövdesi topluca açılmaz.

## Tek alanı silme

Bir alanın yanındaki `Sil` düğmesine bas. Onay penceresinde alanı doğrula. İptal edersen hiçbir değişiklik yapılmaz.

## Tüm yönetilen verileri silme

`Yönetilen verileri temizle` düğmesi yalnız allowlist'e ait alanları etkiler. Bu işlem geri alınamaz; onay verilmeden storage'a dokunulmaz.

## Manifest

`Veri manifestini indir` uygulamanın hangi alanları kullandığını ve yaklaşık boyutlarını içeren teknik bir özet indirir. Bu dosya mesaj/prompt yedeği değildir.

## Yönetilmeyen veriler

Tanımlanmamış `hafize.*` anahtarları varsa arayüz bunu bildirir. Bunlar otomatik olarak silinmez.

## Sorun giderme

Depolama kullanılamıyorsa alanlar boş veya erişilemez görünebilir. Bu durum sohbet gönderimini engellemez. Tarayıcı özel modunda quota davranışı farklı olabilir.

## Önemli

Prompt ve composer history yedekleri gerekiyorsa ilgili özelliklerin kendi explicit export araçlarını kullan. Veri merkezi yalnız yönetim ve metadata görünürlüğü sağlar.
