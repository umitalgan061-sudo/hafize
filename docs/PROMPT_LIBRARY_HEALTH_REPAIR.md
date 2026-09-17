# Health Center Onarım Akışı

## Ön koşul

Kullanıcı önce sağlık raporunu görür ve `Güvenli onarım` düğmesini kendisi çalıştırır.

## Onarım kapsamı

Prompt kayıtları mevcut Prompt Library normalizer'ından geçirilir.

Geçersiz gövde, aşırı uzun alan veya normalize edilemeyen kayıtlar normalizer'ın güvenli davranışına bırakılır.

Koleksiyon varsa üyeler mevcut prompt id'leriyle yeniden eşleştirilir.

## Onarım kapsamı dışı

Revision geçmişi kullanıcı adına otomatik olarak silinmez.

Smart Fill presetleri otomatik temizlenmez.

Konuşma geçmişi veya mesaj workspace verisi değiştirilmez.

## Onay

Yazma işlemi öncesi tarayıcı confirmation mekanizması kullanılır.

İptal edilirse storage değişmeden kalır.

## Rapor sonrası

Onarımın ardından tarama tekrar çalıştırılır ve yeni sonuç gösterilir.

Kullanıcı isterse raporu dosya olarak indirebilir.

## Veri kaybı yaklaşımı

Amaç mümkün olduğunca geçerli veriyi korumaktır.

Normalizasyon sırasında desteklenmeyen alanlar görmezden gelinebilir; ana işlev için gereken standart alanlar korunur.

## Geri dönüş

Onarımın geri dönüşü normalizer'ın ürettiği kayıtları kendiliğinden eski ham biçime çevirmediği için export öncesi yedekleme önerilir.

Kullanıcı mevcut JSON export işleviyle onarım öncesi yedeğini alabilir.
