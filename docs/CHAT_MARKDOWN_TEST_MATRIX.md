# Chat Markdown Test Matrisi

Bu dosya Markdown katmanının test kapsamını davranış alanlarına göre düzenler. Amaç test sayısını artırmak değil, her güvenlik ve UX sınırının tek bir sahipli assertion ile görünür olmasıdır.

| Alan | Beklenti | Kontrol |
| --- | --- | --- |
| Girdi | 64 KiB üstü veri bounded kalır | bounds suite |
| Parser | Blok sayısı sınırlıdır | bounds suite |
| Inline | Aşırı uzun satır düz metne düşer | bounds suite |
| Heading | Model başlığı h1/h2'yi ele geçiremez | parser suite |
| Liste | Ordered/unordered ayrımı korunur | structured suite |
| Task | `[x]` ve `[ ]` görsel metadata olur | structured suite |
| Quote | Birden fazla quote satırı tek blok olur | parser suite |
| Code | Fence içeriği textContent semantiği taşır | parser suite |
| Table | Başlık/ayırıcı yapısı olmadan tablo üretilmez | structured suite |
| Link | Yalnız allowlist protokolleri tıklanabilir | links suite |
| Security | HTML-string sink bulunmaz | security/source suite |
| PWA | JS/CSS shell cache'te bulunur | PWA suite |
| Accessibility | focus/reduced-motion/forced-colors stilleri bulunur | source suite |

## Regresyon prensipleri

Her yeni parser kuralı en az bir normal, bir sınır ve bir hostile örnekle temsil edilmelidir. Hostile örnek model çıktısının doğrudan DOM veya browser navigation yetkisi kazanıp kazanmadığını sınar.

Streaming için testler kapanmamış code fence ve art arda gelen DOM mutation senaryolarını hedefler. Observer kendi render'ını tekrar görse bile sonsuz mutation döngüsüne girmemelidir.

Kopyalama eylemi ayrı tutulur; parser testleri Clipboard API'yi taklit etmek zorunda değildir. UI smoke testi düğmenin mevcut olduğunu, copy boundary ise yalnız `pre` metnini kopyaladığını doğrular.

PWA testi belirli tarihsel cache numarasına bağlanmamalı; sürümün biçimini ve asset inclusion sözleşmesini doğrulamalıdır.
